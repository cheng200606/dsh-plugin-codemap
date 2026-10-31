/**
 * The `repoWiki` service.
 *
 * Every operation of the plugin is implemented here exactly once; the tools,
 * the `/wiki` command and (in the future) the Web panel are thin shells around
 * these methods. The service owns the whole pipeline:
 *
 *   S0 Preflight  → resolve the repository root
 *   S1 Index      → scan the tree and build a compact symbol/module/route index
 *   S2 Plan       → derive (or read) `wiki_plan.yaml`
 *   S3 Evidence   → collect one EvidencePack per planned page
 *   S4 Write      → render the page from its EvidencePack
 *   S5 Verify     → check every `path:line` citation against the real file
 *   S6 Persist    → write pages, metadata and the retrieval index
 *
 * The pipeline is deterministic: no model call is required, so the plugin works
 * offline and always produces verifiable citations.
 */
import { join } from 'node:path'
import { createFsAdapter } from './fs-adapter.js'
import { normalizeConfig } from './config.js'
import { scanRepository, collectScanSignature } from './scan.js'
import { buildModuleGraph, buildFileGraph, impactFrom } from './graph.js'
import { buildIndex } from './indexer.js'
import { buildPlan, parsePlanYaml, planToYaml, validatePlan, pageFileName } from './plan.js'
import { collectEvidence } from './evidence.js'
import { renderPage, renderIndexPage, renderCard } from './render.js'
import { verifyCitations } from './verify.js'
import { searchPages } from './search.js'
import { resolveClientStatus } from './client-graph.js'
import {
  buildIndexMeta,
  buildMetadata,
  GENERATOR_NAME,
  GENERATOR_VERSION,
  hashInputs,
  layoutFor,
  loadMetadata,
  loadPlanText,
  parseFrontmatter,
  readPageFile,
  repoRelative,
  resolveOutputDir,
  saveCardFile,
  saveIndex,
  saveMetadata,
  savePageFile,
  savePlanText,
  saveVersion,
  SCHEMA_VERSION,
} from './store.js'
import { hashText, nowIso, toPosix } from './util.js'

const DEFAULT_LANGUAGE = 'zh'

/**
 * Minimum number of verifiable claims a page needs before it may be marked
 * "fresh". Below that the page is reported as "needs-review".
 */
const MIN_CLAIMS_FOR_FRESH = 4
const KNOWLEDGE_CARD_ID = 'repo-overview'

/**
 * The repository wiki service.
 */
export class RepoWikiService {
  /**
   * @param {object} ctx - the plugin context.
   * @param {object} [config] - the effective configuration.
   */
  constructor(ctx, config) {
    this.ctx = ctx
    this.config = normalizeConfig(config)
    this.fs = createFsAdapter(ctx.fs)
    this.runtime = null
    this.sessionId = null
    // The last root this plugin resolved. The Web routes have no agent, so this
    // is the bridge between what the model asked for and what the panel shows.
    this.lastRoot = null
    // One generation per repository and language at a time: two writers would
    // interleave their page files and their metadata.
    this.runs = new Map()
    // Retrieval corpus cache: `root|language` -> { stamp, at, entries }.
    this.cache = new Map()
    // Scan+index reuse cache: `root` -> { signature, scan, index, at }. The
    // signature is the cheap change fingerprint of the source tree; while it
    // matches, the expensive scan walk and the per-file index reads are
    // skipped entirely.
    this.profiles = new Map()
    // Live generation progress: `root|language` -> { runId, mode, status, phase,
    // total, done, failed, current, startedAt, finishedAt, error? }. The panel
    // polls it through `/api/repowiki/progress` while a run is active.
    this.progressStates = new Map()
  }

  /**
   * Remember what the plugin registered when it was loaded.
   *
   * The receipt is written to `meta/runtime.json` with every generated wiki, so
   * a reader can tell which plugin build produced the pages and which
   * capabilities were live in the harness at that moment.
   *
   * @param {object} receipt
   */
  setRuntimeReceipt(receipt) {
    this.runtime = receipt
  }

  /**
   * Remember which session asked for the last operation.
   *
   * The harness does not export its session id into the plugin environment, so
   * the identity travels with the call: the tools know `exec.agent.id` and the
   * slash command knows `invocation.agent.id`.
   *
   * @param {string|null} sessionId
   */
  setActiveSession(sessionId) {
    this.sessionId = typeof sessionId === 'string' && sessionId ? sessionId : null
  }

  /* ---------------------------------------------------------------- *
   * S0 — preflight
   * ---------------------------------------------------------------- */

  /**
   * Resolve the repository root of the current session.
   *
   * The working-directory service is authoritative; `process.cwd()` is only a
   * last resort so the service never throws in an unknown environment.
   *
   * @param {object} [agent] - the agent asking for the root.
   * @returns {string} an absolute native path.
   */
  resolveRoot(agent) {
    const workingDirectory = optionalService(this.ctx, 'workingDirectory')
    const session = agent?.session ?? this.activeSession()
    if (workingDirectory && session) {
      try {
        if (typeof workingDirectory.get === 'function') {
          const directory = workingDirectory.get(session)
          if (typeof directory === 'string' && directory) {
            this.lastRoot = directory
            return directory
          }
        }
      } catch {
        // fall through to the remembered root
      }
    }
    // A root this plugin already resolved is a far better guess than the
    // harness profile directory, which is what `defaultDirectory` reports in
    // the desktop app.
    if (typeof this.lastRoot === 'string' && this.lastRoot) return this.lastRoot
    if (typeof workingDirectory?.defaultDirectory === 'string' && workingDirectory.defaultDirectory) {
      return workingDirectory.defaultDirectory
    }
    return process.cwd()
  }

  /**
   * The Session of the last tool or command call, when it is still live.
   *
   * The Web routes have no agent, so this is how a request recovers the
   * repository the caller was working in.
   *
   * @returns {object|null}
   */
  activeSession() {
    if (!this.sessionId) return null
    try {
      const agents = optionalService(this.ctx, 'agents')
      const agent = agents && typeof agents.get === 'function' ? agents.get(this.sessionId) : undefined
      return agent?.session ?? null
    } catch {
      return null
    }
  }

  /**
   * Resolve the repository root of a Web request.
   *
   * A Fetch route carries no agent and no session, so the plugin walks a
   * fallback chain and picks the first candidate that already holds a generated
   * wiki: the explicit `?root=` hint, the root of the last call, the root of the
   * calling session, the roots of the live sessions, the registered workspaces,
   * the harness default directory, and finally the process directory. Preferring
   * a candidate with content is what keeps the panel from opening on the
   * profile directory while the wiki lives in the workspace.
   *
   * @param {string} [explicit] - an explicit `?root=` hint.
   * @returns {Promise<string>} an absolute native path.
   */
  async resolveRequestRoot(explicit) {
    const candidates = []
    const push = (value) => {
      if (typeof value !== 'string') return
      const trimmed = value.trim()
      if (!trimmed || candidates.includes(trimmed)) return
      candidates.push(trimmed)
    }
    // An explicit hint wins whenever it names an existing directory: the user
    // asked for that repository, even if it has no wiki yet. A typo (or a stale
    // bookmark) falls through to the chain below instead of producing a root
    // that cannot be written to.
    if (await this.isDirectory(explicit)) {
      this.lastRoot = explicit.trim()
      return this.lastRoot
    }
    push(this.lastRoot)
    const workingDirectory = optionalService(this.ctx, 'workingDirectory')
    const session = this.activeSession()
    if (session && workingDirectory) {
      try {
        if (typeof workingDirectory.get === 'function') push(workingDirectory.get(session))
      } catch {
        // ignore a session that cannot resolve its directory
      }
    }
    for (const root of this.sessionRoots()) push(root)
    for (const root of this.workspaceRoots()) push(root)
    push(workingDirectory?.defaultDirectory)
    push(process.cwd())

    for (const root of candidates) {
      if (await this.rootHasWiki(root)) {
        this.lastRoot = root
        return root
      }
    }
    return candidates[0] ?? process.cwd()
  }

  /**
   * The directories of every live session, newest first when the host keeps
   * insertion order.
   *
   * @returns {string[]}
   */
  sessionRoots() {
    const roots = []
    try {
      const agents = optionalService(this.ctx, 'agents')
      const workingDirectory = optionalService(this.ctx, 'workingDirectory')
      if (!agents || typeof agents.list !== 'function' || !workingDirectory) return roots
      if (typeof workingDirectory.get !== 'function') return roots
      for (const agent of agents.list()) {
        try {
          const directory = workingDirectory.get(agent.session)
          if (typeof directory === 'string' && directory) roots.push(directory)
        } catch {
          // a session without a directory is simply skipped
        }
      }
    } catch {
      // the agent service is optional
    }
    return roots.reverse()
  }

  /**
   * The registered workspace directories.
   *
   * @returns {string[]}
   */
  workspaceRoots() {
    return this.listWorkspaces().map((workspace) => workspace.path)
  }

  /**
   * The registered workspaces, as `{ id, path, title }`.
   *
   * @returns {Array<{ id: string|null, path: string, title: string }>}
   */
  listWorkspaces() {
    try {
      const registry = optionalService(this.ctx, 'workspaceRegistry')
      if (!registry || typeof registry.list !== 'function') return []
      const workspaces = []
      for (const workspace of registry.list()) {
        const path = workspace?.path ?? workspace?.root ?? workspace?.directory
        if (typeof path !== 'string' || !path) continue
        const title = typeof workspace?.title === 'string' && workspace.title ? workspace.title : path
        workspaces.push({ id: workspace?.id ?? null, path, title })
      }
      return workspaces
    } catch {
      return []
    }
  }

  /**
   * Whether a directory already holds a generated wiki.
   *
   * @param {string} root
   * @returns {Promise<boolean>}
   */
  async rootHasWiki(root) {
    try {
      const meta = await this.fs.stat(join(resolveOutputDir(root, this.config.outputDir), 'meta', 'repowiki.json'))
      return Boolean(meta && meta.type === 'file')
    } catch {
      return false
    }
  }

  /**
   * Whether a path names an existing directory.
   *
   * @param {unknown} path
   * @returns {Promise<boolean>}
   */
  async isDirectory(path) {
    if (typeof path !== 'string' || !path.trim()) return false
    try {
      const info = await this.fs.stat(path.trim())
      return Boolean(info && info.type === 'directory')
    } catch {
      return false
    }
  }

  /* ---------------------------------------------------------------- *
   * Status
   * ---------------------------------------------------------------- */

  /**
   * Report the state of the wiki of one repository.
   *
   * @param {string} root - the repository root.
   * @returns {Promise<object>}
   */
  async status(root) {
    const repository = root || this.resolveRoot()
    const meta = await loadMetadata(this.fs, repository, this.config.outputDir)
    const git = await this.readGitInfo(repository)
    const pages = Array.isArray(meta?.pages) ? meta.pages : []
    const counts = { fresh: 0, stale: 0, failed: 0, draft: 0 }
    for (const page of pages) {
      const status = page?.status ?? 'draft'
      if (status === 'fresh') counts.fresh += 1
      else if (status === 'stale') counts.stale += 1
      else if (status === 'needs-review') counts.failed += 1
      else counts.draft += 1
    }
    const recordedHead = meta?.repo?.head ?? null
    return {
      root: repository,
      outputDir: this.config.outputDir,
      exists: Boolean(meta),
      branch: git.branch,
      head: git.head,
      dirty: Boolean(recordedHead && git.head && recordedHead !== git.head),
      pages: pages.length,
      cards: Array.isArray(meta?.cards) ? meta.cards.length : 0,
      fresh: counts.fresh,
      stale: counts.stale,
      failed: counts.failed,
      draft: counts.draft,
      lastGeneratedAt: meta?.generatedAt ?? null,
      generatorVersion: meta?.generator?.version ?? GENERATOR_VERSION,
      languages: meta?.repo?.languages ?? {},
      fileCount: meta?.repo?.fileCount ?? 0,
      run: await this.readRunJournal(repository),
    }
  }

  /**
   * Read the git branch and HEAD of a repository without running git.
   *
   * @param {string} root
   * @returns {Promise<{ branch: string|null, head: string|null }>}
   */
  async readGitInfo(root) {
    const result = { branch: null, head: null }
    const head = await this.fs.readFile(join(root, '.git', 'HEAD'))
    if (typeof head !== 'string') return result
    const trimmed = head.trim()
    if (trimmed.startsWith('ref:')) {
      const ref = trimmed.slice(4).trim()
      result.branch = ref.replace(/^refs\/heads\//, '')
      const loose = await this.fs.readFile(join(root, '.git', ...ref.split('/')))
      if (typeof loose === 'string' && loose.trim()) {
        result.head = loose.trim().split(/\s+/)[0]
      } else {
        const packed = await this.fs.readFile(join(root, '.git', 'packed-refs'))
        if (typeof packed === 'string') {
          for (const line of packed.split(/\r?\n/)) {
            const match = /^([0-9a-f]{7,40})\s+(.+)$/.exec(line.trim())
            if (match && match[2].trim() === ref) {
              result.head = match[1]
              break
            }
          }
        }
      }
    } else if (trimmed) {
      result.head = trimmed.split(/\s+/)[0]
      result.branch = '(detached)'
    }
    return result
  }

  /* ---------------------------------------------------------------- *
   * S1/S2 — scan, index and plan
   * ---------------------------------------------------------------- */

  /**
   * Scan the repository and build the compact index.
   *
   * Both steps are expensive (a tree walk and a read of every source file), so
   * the pair is cached per repository: a cheap change signature of the tree is
   * computed first, and while it matches the cached one — and the cache is
   * still inside its TTL — the previous scan and index are reused as-is. Any
   * source change that moves a file size or a change token produces a new
   * signature and forces a rebuild.
   *
   * @param {string} root
   * @param {AbortSignal} [signal]
   */
  async buildRepositoryProfile(root, signal) {
    const options = {
      maxFiles: this.config.maxFiles,
      maxFileBytes: this.config.maxFileBytes,
      outputDir: this.config.outputDir,
      signal,
    }
    const signature = await collectScanSignature(this.fs, root, options)
    const ttl = Number(this.config.cacheTtlMs ?? 5000)
    const cached = signature ? this.profiles.get(root) : null
    if (cached && cached.signature === signature && Date.now() - cached.at <= ttl) {
      return { scan: cached.scan, index: cached.index }
    }
    const scan = await scanRepository(this.fs, root, options)
    const index = await buildIndex(this.fs, scan, {
      signal,
      maxConcurrentReads: this.config.maxConcurrentReads,
    })
    if (signature) this.profiles.set(root, { signature, scan, index, at: Date.now() })
    return { scan, index }
  }

  /**
   * Compute the page plan.
   *
   * A hand-edited `wiki_plan.yaml` always wins over the derived plan, so a
   * user can restructure the wiki without touching the code.
   *
   * @param {string} root
   * @param {{ template?: string, audience?: string, language?: string }} [options]
   */
  async plan(root, options = {}) {
    const repository = root || this.resolveRoot()
    const { scan, index } = await this.buildRepositoryProfile(repository, options.signal)
    const prepared = this.preparePlan(repository, scan, index, options)
    return {
      ...prepared,
      scan: {
        totalFiles: scan.totalFiles,
        languages: scan.languages,
        buildFiles: scan.buildFiles,
        entryPoints: scan.entryPoints,
        warnings: scan.warnings,
      },
      index: {
        modules: index.modules?.length ?? 0,
        symbols: index.symbols?.length ?? 0,
        routes: index.routes?.length ?? 0,
        configKeys: index.configKeys?.length ?? 0,
        warnings: index.warnings,
      },
    }
  }

  /**
   * Derive the plan (or read the one stored in the repository) and validate it.
   */
  preparePlan(root, scan, index, options = {}) {
    const template = options.template || this.config.defaultTemplate
    const warnings = []
    let plan = null
    let source = 'derived'

    // The derived plan is always computed: it carries the source mapping
    // (which files and symbols feed a page) that the small, hand-editable
    // `wiki_plan.yaml` deliberately does not store.
    const derived = buildPlan(scan, index, {
      template,
      audience: options.audience,
      maxPages: this.config.maxPages,
      language: options.language ?? this.config.defaultLanguage,
    })

    const stored = options.planText ?? null
    if (typeof stored === 'string' && stored.trim()) {
      try {
        const parsed = parsePlanYaml(stored)
        if (parsed?.repowiki?.documents?.length) {
          plan = parsed
          source = 'file'
        }
      } catch (error) {
        warnings.push(`wiki_plan.yaml 无法解析，已改用自动推导的规划：${error?.message ?? error}`)
      }
    }

    if (!plan) {
      plan = derived
    }

    // Every document needs its output location and its source mapping.
    const derivedById = new Map((derived?.repowiki?.documents ?? []).map((document) => [document.id, document]))
    for (const document of plan.repowiki?.documents ?? []) {
      if (!document.path) document.path = pageFileName(document)
      const fallback = derivedById.get(document.id)
      const own = document.sources ?? {}
      const ownFiles = Array.isArray(own.files) ? own.files : []
      const ownSymbols = Array.isArray(own.symbols) ? own.symbols : []
      document.sources = {
        files: ownFiles.length ? ownFiles : (fallback?.sources?.files ?? []),
        symbols: ownSymbols.length ? ownSymbols : (fallback?.sources?.symbols ?? []),
      }
    }

    const validation = validatePlan(plan)
    for (const warning of warnings) {
      if (!validation.warnings) validation.warnings = []
      validation.warnings.push(warning)
    }
    return { plan, validation, source }
  }

  /* ---------------------------------------------------------------- *
   * S3–S6 — generate / update
   * ---------------------------------------------------------------- */

  /**
   * Generate the whole wiki.
   *
   * @param {object} request - `{root, mode, language, template, dryRun, force}`
   * @param {AbortSignal} [signal]
   * @returns {Promise<object>} the generation result.
   */
  async generate(request = {}, signal) {
    return this.run(request, 'full', signal)
  }

  /**
   * Refresh only the pages whose sources changed.
   *
   * @param {object} request
   * @param {AbortSignal} [signal]
   */
  async update(request = {}, signal) {
    return this.run(request, 'update', signal)
  }

  /**
   * The shared generation pipeline.
   *
   * @param {object} request
   * @param {'full'|'update'} mode
   * @param {AbortSignal} [signal]
   */
  async run(request, mode, signal) {
    const started = Date.now()
    const root = request.root || this.resolveRoot()
    const language = request.language || this.config.defaultLanguage
    const lockKey = `${root}|${language}`
    const running = this.runs.get(lockKey)
    if (running) {
      const error = new Error(`同一仓库已有生成任务在执行（runId=${running.runId}），请等待它结束。`)
      error.code = 'conflict'
      error.hint = '请等待当前任务结束后重试。'
      throw error
    }
    const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const startedAt = nowIso()
    // The panel-driven entry points pass no signal: the run owns one so the
    // user can cancel it from the progress card.
    const controller = signal ? null : new AbortController()
    const activeSignal = signal ?? controller.signal
    this.runs.set(lockKey, { runId, started, controller })
    this.progressStates.set(lockKey, {
      runId,
      mode,
      status: 'running',
      phase: 'scan',
      total: 0,
      done: 0,
      failed: 0,
      current: null,
      startedAt,
      finishedAt: null,
      error: null,
    })
    await this.writeRunJournal(root, language, { runId, mode, status: 'running', startedAt })
    try {
      const result = await this.runPipeline(request, mode, activeSignal, { runId, started, root, language })
      await this.writeRunJournal(root, language, {
        runId,
        mode,
        status: 'done',
        startedAt,
        finishedAt: nowIso(),
        pages: result.pagesWritten ?? 0,
        skipped: result.pagesSkipped ?? 0,
        failed: result.pagesFailed ?? 0,
        citations: result.citations ?? null,
        durationMs: result.durationMs ?? 0,
      })
      this.bumpProgress(root, language, { status: 'done', phase: 'done', finishedAt: nowIso(), current: null, error: null })
      return result
    } catch (error) {
      const aborted = activeSignal?.aborted === true
      await this.writeRunJournal(root, language, {
        runId,
        mode,
        status: 'failed',
        startedAt,
        finishedAt: nowIso(),
        error: {
          code: aborted ? 'aborted' : typeof error?.code === 'string' ? error.code : 'failed',
          message: aborted ? '生成已被用户取消。' : error instanceof Error ? error.message : String(error),
        },
      })
      this.bumpProgress(root, language, {
        status: 'failed',
        finishedAt: nowIso(),
        current: null,
        error: aborted ? '生成已被用户取消。' : error instanceof Error ? error.message : String(error),
      })
      throw error
    } finally {
      this.runs.delete(lockKey)
    }
  }

  /**
   * Cancel the active generation of one repository and language.
   *
   * @param {string} root
   * @param {string} [language]
   * @returns {boolean} true when a run was aborted, false when none was active.
   */
  abortRun(root, language = this.config.defaultLanguage) {
    const running = this.runs.get(`${root}|${language}`)
    if (!running?.controller || running.controller.signal.aborted) return false
    running.controller.abort()
    return true
  }

  /**
   * The live progress of a generation, or the final state of the last one.
   *
   * @param {string} root
   * @param {string} [language]
   * @returns {object|null}
   */
  progress(root, language = this.config.defaultLanguage) {
    const state = this.progressStates.get(`${root}|${language}`)
    return state ? { ...state } : null
  }

  /**
   * Merge one patch into the live progress entry, if it is still tracked.
   */
  bumpProgress(root, language, patch) {
    const current = this.progressStates.get(`${root}|${language}`)
    if (current) Object.assign(current, patch)
  }

  /**
   * True when a generation is already running for a repository and language.
   *
   * @param {string} root
   * @param {string} [language]
   * @returns {boolean}
   */
  isRunning(root, language = this.config.defaultLanguage) {
    return this.runs.has(`${root}|${language}`)
  }

  /**
   * The generation pipeline itself. `run()` owns the lock and the run journal.
   *
   * @param {object} request
   * @param {'full'|'update'} mode
   * @param {AbortSignal} [signal]
   * @param {{ runId: string, started: number, root: string, language: string }} context
   */
  async runPipeline(request, mode, signal, context) {
    const { runId, started, root, language } = context
    const template = request.template || this.config.defaultTemplate
    const warnings = []

    const { scan, index } = await this.buildRepositoryProfile(root, signal)
    for (const warning of scan.warnings ?? []) warnings.push(warning)
    for (const warning of index.warnings ?? []) warnings.push(warning)
    this.bumpProgress(root, language, { phase: 'plan' })

    const storedPlanText = await loadPlanText(this.fs, root, this.config.outputDir)
    const { plan, validation, source } = this.preparePlan(root, scan, index, {
      template,
      language,
      planText: storedPlanText,
    })
    for (const error of validation.errors ?? []) warnings.push(`计划校验：${error}`)

    const documents = plan.repowiki?.documents ?? []
    if (documents.length === 0) {
      warnings.push('没有可生成的页面：计划为空。')
    }

    const evidence = await collectEvidence(this.fs, plan, index, scan, {
      root,
      signal,
      maxBytes: this.config.maxFileBytes * 64,
    })
    for (const warning of evidence.warnings ?? []) warnings.push(warning)

    const previous = await loadMetadata(this.fs, root, this.config.outputDir)
    const previousById = new Map((previous?.pages ?? []).map((page) => [page.id, page]))

    const generatedAt = nowIso()
    const pages = []
    const cards = []
    const skippedIds = new Set()
    let pagesWritten = 0
    let pagesSkipped = 0
    let pagesFailed = 0
    let citationsTotal = 0
    let citationsValid = 0

    // Live progress: the panel polls it while this pipeline is running.
    this.bumpProgress(root, language, { phase: 'write', total: documents.length, done: 0, failed: 0, current: null })
    let progressDone = 0
    for (const document of documents) {
      if (signal?.aborted) throw new Error('生成已被用户取消。')
      this.bumpProgress(root, language, { current: document.id })
      const pack = (evidence.packs ?? []).find((candidate) => candidate.pageId === document.id)
      if (!pack) {
        pagesFailed += 1
        progressDone += 1
        this.bumpProgress(root, language, { done: progressDone, failed: pagesFailed })
        warnings.push(`页面 ${document.id}：没有收集到证据，已跳过。`)
        continue
      }
      const inputHash = this.hashPageInputs(document, index)
      const previousPage = previousById.get(document.id)
      const unchanged = mode === 'update'
        && previousPage
        && previousPage.hashes?.inputs === inputHash
        && (previousPage.status === 'fresh' || previousPage.status === 'needs-review')

      if (unchanged && !request.force) {
        pagesSkipped += 1
        progressDone += 1
        this.bumpProgress(root, language, { done: progressDone })
        skippedIds.add(document.id)
        pages.push(previousPage)
        citationsTotal += previousPage.citations?.length ?? 0
        citationsValid += previousPage.citations?.length ?? 0
        continue
      }

      const verification = await verifyCitations(this.fs, root, renderPage(pack, {
        id: document.id,
        title: document.title,
        goal: document.goal,
        parent: document.parent,
        sources: document.sources?.files ?? [],
        symbols: document.sources?.symbols ?? [],
        generatedAt,
        sourceHash: inputHash,
        confidence: 'medium',
      }))
      citationsTotal += verification.total
      citationsValid += verification.valid
      const ratio = verification.total > 0 ? verification.valid / verification.total : 0
      const claimCount = Array.isArray(pack.claims) ? pack.claims.length : 0
      const citationsOk = verification.total > 0 && ratio >= this.config.citationThreshold
      // A page with fewer than MIN_CLAIMS_FOR_FRESH verifiable claims stays
      // "needs-review" even when every citation resolves, otherwise the
      // metadata would claim more confidence than the evidence supports.
      const evidenceOk = claimCount >= MIN_CLAIMS_FOR_FRESH
      const status = citationsOk && evidenceOk ? 'fresh' : 'needs-review'
      if (!citationsOk) {
        warnings.push(`页面 ${document.id}：引用有效率 ${(ratio * 100).toFixed(0)}%，低于阈值 ${(this.config.citationThreshold * 100).toFixed(0)}%。`)
      }

      const markdown = renderPage(pack, {
        id: document.id,
        title: document.title,
        goal: document.goal,
        parent: document.parent,
        sources: document.sources?.files ?? [],
        symbols: document.sources?.symbols ?? [],
        generatedAt,
        sourceHash: inputHash,
        status,
        confidence: this.confidenceOf(ratio, pack),
      })

      const citations = this.collectCitations(pack)
      pages.push({
        id: document.id,
        title: document.title,
        goal: document.goal,
        parent: document.parent ?? null,
        path: null,
        status,
        sources: {
          globs: [],
          files: document.sources?.files ?? [],
          symbols: document.sources?.symbols ?? [],
          routes: [],
          configKeys: [],
        },
        hashes: { inputs: inputHash, output: hashText(markdown) },
        citations,
        confidence: this.confidenceOf(ratio, pack),
        generatedAt,
      })
      pagesWritten += 1
      progressDone += 1
      this.bumpProgress(root, language, { done: progressDone })
    }

    if (request.dryRun) {
      return {
        runId,
        mode,
        root,
        language,
        template,
        planSource: source,
        pagesWritten: 0,
        pagesSkipped: 0,
        pagesFailed,
        planned: documents.length,
        pages: pages.map((page) => ({ id: page.id, title: page.title, status: page.status })),
        citations: { total: citationsTotal, valid: citationsValid },
        durationMs: Date.now() - started,
        warnings,
      }
    }

    // S6 — persist.
    this.bumpProgress(root, language, { phase: 'persist', current: null })
    const layout = layoutFor(root, this.config.outputDir, language)
    const written = []
    for (const page of pages) {
      if (!page?.id) continue
      const document = documents.find((candidate) => candidate.id === page.id)
      const pack = (evidence.packs ?? []).find((candidate) => candidate.pageId === page.id)
      if (!document || !pack) continue
      if (skippedIds.has(page.id)) {
        written.push(page)
        continue
      }
      const markdown = renderPage(pack, {
        id: document.id,
        title: document.title,
        goal: document.goal,
        parent: document.parent,
        sources: document.sources?.files ?? [],
        symbols: document.sources?.symbols ?? [],
        generatedAt,
        sourceHash: page.hashes?.inputs,
        status: page.status,
        confidence: page.confidence,
      })
      const saved = await savePageFile(this.fs, {
        root,
        outputDir: this.config.outputDir,
        language,
        relativePath: document.path ?? pageFileName(document),
        markdown,
      })
      page.path = saved.path
      written.push(page)
    }

    // The landing page links every page of the wiki.
    const indexPage = renderIndexPage(
      written.map((page) => ({
        id: page.id,
        title: page.title,
        path: this.contentRelative(page.path, language),
        status: page.status,
        goal: page.goal,
      })),
      { title: '仓库 Wiki', generatedAt },
    )
    const savedIndexPage = await savePageFile(this.fs, {
      root,
      outputDir: this.config.outputDir,
      language,
      relativePath: 'index.md',
      markdown: indexPage,
    })

    // Knowledge cards: one parent card summarising the repository plus one
    // card per wiki section, mirroring the reference product's card library.
    this.bumpProgress(root, language, { phase: 'cards', current: null })
    const cardSet = this.buildKnowledgeCards(plan, scan, written)
    for (const card of cardSet) {
      const cardMarkdown = renderCard(card, { generatedAt })
      const savedCard = await saveCardFile(this.fs, {
        root,
        outputDir: this.config.outputDir,
        language,
        relativePath: `${card.id}.md`,
        markdown: cardMarkdown,
      })
      cards.push({
        id: card.id,
        title: card.title,
        path: savedCard.path,
        tags: card.tags,
        tag: card.tag ?? card.tags?.[0] ?? '',
        summary: card.summary ?? '',
        parent: card.parent ?? null,
      })
    }

    const git = await this.readGitInfo(root)
    await savePlanText(this.fs, root, this.config.outputDir, planToYaml(plan))
    await this.writeRuntimeReceipt(root, language, { runId, mode, pages: written.length })

    // The duration is measured once and reported identically by the tool result
    // and by the persisted metadata, so the two can never disagree.
    const durationMs = Date.now() - started
    const meta = buildMetadata({
      generatedAt,
      repo: {
        head: git.head,
        branch: git.branch,
        dirty: false,
        fileCount: scan.totalFiles ?? 0,
        loc: index.stats?.loc ?? scan.totalFiles ?? 0,
        languages: scan.languages ?? {},
      },
      plan: { template, audience: plan.repowiki?.audience ?? 'engineering' },
      pages: written,
      cards,
      stats: { modelCalls: 0, tokensIn: 0, tokensOut: 0, durationMs },
    })
    await saveMetadata(this.fs, root, this.config.outputDir, meta)
    await saveIndex(this.fs, root, this.config.outputDir, buildIndexMeta(meta))
    await saveVersion(this.fs, root, this.config.outputDir, {
      schemaVersion: SCHEMA_VERSION,
      generator: { name: GENERATOR_NAME, version: GENERATOR_VERSION },
      node: process.version,
      language,
      lastRun: { runId, mode, generatedAt, pages: written.length },
    })
    // The pages on disk changed: the cached corpus is stale.
    this.invalidateCorpus(root)

    return {
      runId,
      mode,
      root,
      language,
      template,
      planSource: source,
      pagesWritten,
      pagesSkipped,
      pagesFailed,
      pages: written.map((page) => ({ id: page.id, title: page.title, path: page.path, status: page.status })),
      indexPage: savedIndexPage.path,
      citations: { total: citationsTotal, valid: citationsValid },
      durationMs,
      warnings,
    }
  }

  /**
   * Write the run journal of the current run.
   *
   * The journal tells a reader whether the last run finished: `running` while
   * the pipeline works, `done` when it completed, `failed` when it broke. The
   * file is only ever overwritten — the filesystem service cannot remove or
   * rename files, so the journal carries the state instead of a marker file.
   *
   * @param {string} root
   * @param {string} language
   * @param {object} entry
   * @returns {Promise<string|null>} the path of the journal.
   */
  async writeRunJournal(root, language, entry) {
    try {
      const layout = layoutFor(root, this.config.outputDir, language)
      const path = join(layout.base, 'meta', 'run.json')
      await this.fs.writeFile(path, `${JSON.stringify(entry, null, 2)}\n`, { workspaceRoot: root })
      return path
    } catch {
      // The journal is a diagnostic aid: a missing one must never fail a run.
      return null
    }
  }

  /**
   * Read the run journal of a repository.
   *
   * @param {string} root
   * @param {string} [language]
   * @returns {Promise<object|null>}
   */
  async readRunJournal(root, language = this.config.defaultLanguage) {
    try {
      const layout = layoutFor(root, this.config.outputDir, language)
      const text = await this.fs.readFile(join(layout.base, 'meta', 'run.json'))
      if (typeof text !== 'string' || !text.trim()) return null
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  /**
   * The state of the browser half of this plugin.
   *
   * @returns {Promise<object>}
   */
  async clientStatus() {
    return resolveClientStatus(this.ctx)
  }

  /**
   * The knowledge graph of one repository, derived from the cached
   * scan + index pair (plan v2 §四 P0'-1).
   *
   * @param {string} root
   * @param {{ level?: 'module'|'file', module?: string, limit?: number, signal?: AbortSignal }} [options]
   * @returns {Promise<object>}
   */
  async buildGraph(root, options = {}) {
    const repository = root || this.resolveRoot()
    const { scan, index } = await this.buildRepositoryProfile(repository, options.signal)
    if (options.level === 'file') {
      return buildFileGraph(index, options.module ?? '')
    }
    const graph = buildModuleGraph(scan, index, { limit: options.limit })
    return {
      level: 'module',
      root: repository,
      ...graph,
    }
  }

  /**
   * The upstream / downstream impact set of one module over the import graph.
   *
   * @param {string} root
   * @param {string} moduleDir - the module directory (possibly '').
   * @returns {Promise<{ upstream: string[], downstream: string[] }>}
   */
  async impactGraph(root, moduleDir) {
    const repository = root || this.resolveRoot()
    const { index } = await this.buildRepositoryProfile(repository)
    return impactFrom(index, moduleDir ?? '')
  }

  /**
   * Write the runtime receipt of this plugin build next to the wiki.
   *
   * The receipt records what was registered in the harness (service, tools,
   * command, prompt section), the effective configuration and the identity of
   * the host process, so a reader can prove which build produced the pages.
   *
   * @param {string} root
   * @param {string} language
   * @param {object} [run]
   */
  async writeRuntimeReceipt(root, language, run = {}) {
    if (!this.runtime) return null
    const layout = layoutFor(root, this.config.outputDir, language)
    // The client probe costs a graph lookup and a bundle fetch; the
    // configuration can turn it off, in which case the receipt still carries
    // a shape-compatible section that says why it is empty.
    const client = this.config.clientBundleCheck === false
      ? {
          available: false,
          composed: false,
          served: false,
          rev: null,
          bytes: 0,
          url: null,
          error: '已通过配置关闭探测（clientBundleCheck=false）。',
          origin: null,
          webUrl: null,
        }
      : await this.clientStatus()
    const receipt = {
      ...this.runtime,
      harness: { ...(this.runtime.harness ?? {}), sessionId: this.sessionId ?? this.runtime.harness?.sessionId ?? null },
      lastRun: { ...run, sessionId: this.sessionId ?? null, at: nowIso() },
      client,
      outputDir: this.config.outputDir,
      language,
    }
    const path = join(layout.base, 'meta', 'runtime.json')
    await this.fs.writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, { workspaceRoot: root })
    return path
  }

  /**
   * Hash the inputs of one page so an update can detect real changes.
   */
  hashPageInputs(document, index) {
    const files = document?.sources?.files ?? []
    const sizes = new Map()
    for (const file of index?.files ?? []) {
      if (typeof file === 'string') sizes.set(toPosix(file), 0)
      else if (file && typeof file === 'object') sizes.set(toPosix(file.path ?? file.file ?? ''), Number(file.size ?? file.bytes ?? 0))
    }
    for (const module of index?.modules ?? []) {
      if (!module || typeof module !== 'object') continue
      for (const file of module.files ?? []) {
        const path = toPosix(typeof file === 'string' ? file : (file?.path ?? ''))
        if (path && !sizes.has(path)) sizes.set(path, Number(module.loc ?? 0))
      }
    }
    const entries = files.map((file) => ({ path: toPosix(file), content: String(sizes.get(toPosix(file)) ?? 0) }))
    entries.push({ path: '#document', content: `${document?.id ?? ''}|${document?.title ?? ''}|${(document?.sources?.symbols ?? []).join(',')}` })
    return hashInputs(entries)
  }

  /**
   * Confidence of a page, derived from its citation ratio.
   */
  confidenceOf(ratio, pack) {
    const claimCount = Array.isArray(pack?.claims) ? pack.claims.length : 0
    if (claimCount === 0) return 'low'
    if (ratio >= 0.99) return claimCount >= MIN_CLAIMS_FOR_FRESH ? 'high' : 'medium'
    if (ratio >= 0.8) return 'medium'
    return 'low'
  }

  /**
   * Flatten the citations of one evidence pack.
   */
  collectCitations(pack) {
    const citations = []
    for (const claim of pack?.claims ?? []) {
      for (const citation of claim?.citations ?? []) {
        if (!citation?.path) continue
        citations.push({
          path: toPosix(citation.path),
          startLine: Number(citation.startLine ?? 1),
          endLine: Number(citation.endLine ?? citation.startLine ?? 1),
        })
      }
    }
    const seen = new Set()
    return citations.filter((citation) => {
      const key = `${citation.path}:${citation.startLine}:${citation.endLine}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /**
   * Build the knowledge card set of the repository.
   *
   * Card #0 is the parent card ("仓库速览") that links every section card;
   * cards #1..n summarise one wiki section each — title, digest of the pages
   * inside it and their tag — the shape the reference product calls a card
   * library. Children are addressed as `card:<id>` so a reader can hop from
   * the parent card straight into a section card.
   *
   * @param {object} plan
   * @param {object} scan
   * @param {Array<{id,title,goal,path}>} pages - the written pages.
   * @returns {Array<object>}
   */
  buildKnowledgeCards(plan, scan, pages) {
    const documents = plan?.repowiki?.documents ?? []
    const goalById = new Map(documents.map((document) => [document.id, document.goal ?? '']))
    const languages = Object.entries(scan?.languages ?? {})
      .sort((a, b) => b[1] - a[1])
      .map(([language, count]) => `${language} ${count}`)
    const pageLinks = (list) =>
      list.map((page) => ({
        title: page.title,
        path: this.contentRelative(page.path, this.config.defaultLanguage),
      }))
    const parent = {
      id: KNOWLEDGE_CARD_ID,
      title: '仓库速览',
      summary: [
        `仓库共 ${scan?.totalFiles ?? 0} 个文件（${languages.join('、') || '未知语言'}），`,
        `规划了 ${documents.length} 个 Wiki 页面。`,
        '所有结论都以 `path:line` 引用源码，需要精确行为时必须回到源码核对。',
      ].join(''),
      links: pageLinks(pages.slice(0, 8)),
      tags: ['repo', 'overview', plan?.repowiki?.template ?? 'architecture'],
    }

    // Group the written pages by their wiki section (the directory under
    // `content/<lang>/`), preserving the plan order.
    const sections = []
    const bySection = new Map()
    for (const page of pages) {
      const section = this.sectionOfPagePath(page.path)
      if (!bySection.has(section)) {
        bySection.set(section, [])
        sections.push(section)
      }
      bySection.get(section).push(page)
    }
    const sectionCards = sections
      .filter((section) => section !== '')
      .map((section) => {
        const list = bySection.get(section)
        const label = this.sectionLabel(section)
        const digest = list
          .map((page) => goalById.get(page.id) || page.title)
          .join('；')
        return {
          id: `card-${section}`,
          title: `${label}要点`,
          tag: label,
          summary: `本卡汇总「${label}」分区 ${list.length} 个页面的要点：${digest}`,
          links: pageLinks(list),
          tags: [label, '卡片'],
          parent: { id: parent.id, title: parent.title },
          children: [],
        }
      })
    parent.children = sectionCards.map((card) => ({ id: card.id, title: card.title }))
    return [parent, ...sectionCards]
  }

  /**
   * The wiki section a written page belongs to: the directory between
   * `content/<lang>/` and the file name.
   *
   * @param {string} repoRelativePath
   * @returns {string}
   */
  sectionOfPagePath(repoRelativePath) {
    const parts = toPosix(String(repoRelativePath ?? '')).split('/')
    const marker = parts.indexOf('content')
    const rest = marker >= 0 ? parts.slice(marker + 1) : parts
    const tail = rest[0] === this.config.defaultLanguage ? rest.slice(1) : rest
    return tail.length >= 2 ? tail[0] : ''
  }

  /**
   * A human label for a section id: the numeric prefix is dropped and the
   * rest kept as-is (`10-architecture` → `architecture`).
   */
  sectionLabel(section) {
    return String(section ?? '').replace(/^\d+-/, '') || String(section ?? 'overview')
  }

  /* ---------------------------------------------------------------- *
   * Retrieval
   * ---------------------------------------------------------------- */

  /**
   * Search the generated wiki.
   *
   * @param {string} root
   * @param {string} query
   * @param {{ limit?: number, language?: string }} [options]
   */
  async search(root, query, options = {}) {
    const repository = root || this.resolveRoot()
    const language = options.language || this.config.defaultLanguage
    const entries = await this.corpus(repository, language)
    if (!entries) return []
    const limit = Math.min(Math.max(Number(options.limit ?? 8), 1), this.config.maxSearchPages)
    return searchPages(entries, query, { limit })
  }

  /**
   * The retrieval corpus of a repository.
   *
   * Building the corpus reads every page file, so it is cached. The cache is
   * dropped by every write and guarded by the metadata stamp, which means a
   * page file that was edited outside the plugin is picked up as well.
   *
   * @param {string} repository
   * @param {string} language
   * @returns {Promise<object[]|null>}
   */
  async corpus(repository, language) {
    const key = `${repository}|${language}`
    const meta = await loadMetadata(this.fs, repository, this.config.outputDir)
    if (!meta) {
      this.cache.delete(key)
      return null
    }
    const stamp = `${meta.generatedAt ?? ''}|${(meta.pages ?? []).length}`
    const cached = this.cache.get(key)
    const ttl = Number(this.config.cacheTtlMs ?? 5000)
    if (cached && cached.stamp === stamp && Date.now() - cached.at <= ttl) return cached.entries
    const entries = await this.buildCorpus(repository, language, meta)
    this.cache.set(key, { stamp, at: Date.now(), entries })
    return entries
  }

  /**
   * Drop the cached corpus of a repository.
   *
   * @param {string} repository
   */
  invalidateCorpus(repository) {
    if (!repository) {
      this.cache.clear()
      return
    }
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(`${repository}|`)) this.cache.delete(key)
    }
  }

  /**
   * Read every page of the wiki plus the landing page, the plan file and the
   * knowledge cards into the shape the retriever expects.
   *
   * @param {string} repository
   * @param {string} language
   * @param {object} meta
   * @returns {Promise<object[]>}
   */
  async buildCorpus(repository, language, meta) {
    const entries = []
    for (const page of meta.pages ?? []) {
      if (!page?.path) continue
      if (!this.isLanguageOf(page.path, language)) continue
      const file = await this.readPageByPath(repository, page.path)
      if (!file) continue
      entries.push({
        id: page.id,
        title: page.title,
        goal: page.goal,
        path: page.path,
        status: page.status,
        confidence: page.confidence,
        sources: page.sources?.files ?? [],
        keywords: [...(page.sources?.symbols ?? []), ...(page.sources?.configKeys ?? [])],
        body: file.markdown,
      })
      if (entries.length >= this.config.maxSearchPages) break
    }
    // The landing page, the knowledge cards and the plan file belong to the wiki
    // as well, so they must be searchable too — otherwise a query such as
    // "wiki_plan" or "增量更新" would find nothing at all.
    const layout = layoutFor(repository, this.config.outputDir, language)
    const extra = [
      {
        id: 'index',
        title: '仓库 Wiki 导航',
        goal: '仓库 Wiki 的落地页，列出全部页面及其状态。',
        path: repoRelative(repository, join(layout.contentDir, 'index.md')),
        kind: 'index',
      },
      {
        id: 'plan',
        title: '页面规划（wiki_plan.yaml）',
        goal: '当前 Wiki 的页面规划：每页的标题、目标与提示，可手工编辑。',
        path: repoRelative(repository, layout.planPath),
        kind: 'plan',
      },
    ]
    for (const card of meta.cards ?? []) {
      if (!card?.path) continue
      extra.push({
        id: `card:${card.id}`,
        title: card.title ?? card.id,
        goal: '仓库速览知识卡：文件规模、页面清单与引用约定。',
        path: card.path,
        kind: 'card',
      })
    }
    for (const item of extra) {
      if (entries.length >= this.config.maxSearchPages) break
      const file = await this.readPageByPath(repository, item.path)
      if (!file) continue
      entries.push({
        id: item.id,
        title: item.title,
        goal: item.goal,
        path: item.path,
        status: 'fresh',
        confidence: 'medium',
        sources: [],
        keywords: [item.kind],
        body: file.markdown,
      })
    }
    return entries
  }

  /**
   * Read one page of the wiki.
   *
   * @param {string} root
   * @param {string} pageId
   * @param {{ language?: string }} [options]
   */
  async read(root, pageId, options = {}) {
    const repository = root || this.resolveRoot()
    const id = String(pageId ?? '').trim()
    if (!id) throw new Error('page_id 不能为空')
    const meta = await loadMetadata(this.fs, repository, this.config.outputDir)
    if (!meta) throw new Error('该仓库还没有生成 Wiki，请先运行 `/wiki generate`。')
    const language = options.language || this.config.defaultLanguage
    const pages = meta.pages ?? []
    const page = pages.find((candidate) => candidate.id === id)
      // Accept the "10-architecture/overview" form as well as the flat id.
      ?? (id.includes('/')
        ? pages.find((candidate) => candidate.id === id.slice(id.lastIndexOf('/') + 1))
        : undefined)
      ?? pages.find((candidate) => String(candidate.path ?? '').endsWith(`/${id}.md`))
      ?? pages.find((candidate) => String(candidate.path ?? '').endsWith(id))
    if (page) {
      const file = await this.readPageByPath(repository, page.path)
      if (!file) throw new Error(`Wiki 页面文件缺失：${page.path}`)
      const front = parseFrontmatterSafe(file.markdown)
      return {
        id: page.id,
        title: page.title ?? front.data.title ?? id,
        goal: page.goal ?? front.data.goal ?? '',
        path: page.path,
        status: page.status ?? front.data.status ?? 'draft',
        citations: page.citations ?? [],
        markdown: file.markdown,
      }
    }

    // The landing page, the plan file and the knowledge cards are part of the
    // wiki as well, so they are addressable by a stable id too.
    const layout = layoutFor(repository, this.config.outputDir, language)
    const artefacts = new Map([
      ['index', { title: '仓库 Wiki 导航', path: repoRelative(repository, join(layout.contentDir, 'index.md')) }],
      ['plan', { title: '页面规划（wiki_plan.yaml）', path: repoRelative(repository, layout.planPath) }],
    ])
    for (const card of meta.cards ?? []) {
      if (!card?.path) continue
      artefacts.set(`card:${card.id}`, { title: card.title ?? card.id, path: card.path })
    }
    const artefact = artefacts.get(id)
    if (!artefact) throw new Error(`未找到 Wiki 页面：${id}`)
    const file = await this.readPageByPath(repository, artefact.path)
    if (!file) throw new Error(`Wiki 文件缺失：${artefact.path}`)
    return {
      id,
      title: artefact.title,
      goal: '',
      path: artefact.path,
      status: 'fresh',
      citations: [],
      markdown: file.markdown,
    }
  }

  /**
   * Compute which pages are affected by a set of changed files.
   *
   * @param {string} root
   * @param {string[]|{files?: string[]}} changes
   */
  async impact(root, changes) {
    const repository = root || this.resolveRoot()
    const files = Array.isArray(changes)
      ? changes.map((entry) => toPosix(String(entry)))
      : Array.isArray(changes?.files)
        ? changes.files.map((entry) => toPosix(String(entry)))
        : []
    const meta = await loadMetadata(this.fs, repository, this.config.outputDir)
    if (!meta) return []
    const affected = []
    for (const page of meta.pages ?? []) {
      const sources = page.sources?.files ?? []
      const hit = files.filter((changed) => sources.some((source) => source === changed || changed.startsWith(`${source}/`) || source.startsWith(`${changed}/`)))
      if (hit.length === 0) continue
      affected.push({
        id: page.id,
        title: page.title,
        path: page.path,
        status: page.status,
        changedFiles: hit,
      })
    }
    return affected
  }

  /* ---------------------------------------------------------------- *
   * Interoperability
   * ---------------------------------------------------------------- */

  /**
   * Export the wiki.
   *
   * `qoder` writes a copy below `.qoder/repowiki` so the Qoder plugin can pick
   * it up; `dsh` writes a single JSON bundle.
   *
   * @param {string} root
   * @param {'dsh'|'qoder'} [target]
   */
  async exportWiki(root, target = 'qoder') {
    const repository = root || this.resolveRoot()
    const base = resolveOutputDir(repository, this.config.outputDir)
    if (target === 'qoder') {
      const destination = join(repository, '.qoder', 'repowiki')
      const files = await this.copyTree(base, destination, repository)
      // A write happened below the repository: drop the cached corpus so the
      // next search or panel payload reflects what is on disk now.
      this.invalidateCorpus(repository)
      return { target, path: destination, files }
    }
    const meta = await loadMetadata(this.fs, repository, this.config.outputDir)
    const pages = []
    for (const page of meta?.pages ?? []) {
      const file = await this.readPageByPath(repository, page.path)
      if (!file) continue
      pages.push({ id: page.id, path: page.path, markdown: file.markdown })
    }
    const bundle = { schemaVersion: SCHEMA_VERSION, generator: meta?.generator ?? null, meta, pages }
    const targetPath = join(base, 'export', 'repowiki.json')
    await this.fs.writeFile(targetPath, `${JSON.stringify(bundle, null, 2)}\n`, { workspaceRoot: repository })
    return { target: 'dsh', path: targetPath, files: 1, pages: pages.length }
  }

  /**
   * Import a wiki produced elsewhere.
   *
   * @param {string} root
   * @param {'dsh'|'qoder'} [source]
   */
  async importWiki(root, source = 'qoder') {
    const repository = root || this.resolveRoot()
    const base = resolveOutputDir(repository, this.config.outputDir)
    if (source === 'qoder') {
      const origin = join(repository, '.qoder', 'repowiki')
      const files = await this.copyTree(origin, base, repository)
      return { source, path: base, files, pages: files.filter((file) => file.endsWith('.md')).length }
    }
    const bundlePath = join(base, 'export', 'repowiki.json')
    const text = await this.fs.readFile(bundlePath)
    if (typeof text !== 'string') throw new Error(`未找到导出包：${bundlePath}`)
    let bundle
    try {
      bundle = JSON.parse(text)
    } catch (error) {
      throw new Error(`导出包无法解析：${error?.message ?? error}`)
    }
    let pages = 0
    for (const page of bundle.pages ?? []) {
      if (!page?.path || !page?.markdown) continue
      const absolute = join(repository, ...toPosix(page.path).split('/'))
      await this.fs.writeFile(absolute, page.markdown, { workspaceRoot: repository })
      pages += 1
    }
    if (bundle.meta) await saveMetadata(this.fs, repository, this.config.outputDir, bundle.meta)
    this.invalidateCorpus(repository)
    return { source, path: base, files: pages, pages }
  }

  /**
   * Copy a directory tree with the filesystem adapter.
   */
  async copyTree(from, to, workspaceRoot) {
    const copied = []
    const walk = async (relative) => {
      const entries = await this.fs.listDir(relative ? join(from, ...relative.split('/')) : from)
      for (const entry of entries ?? []) {
        const childRelative = relative ? `${relative}/${entry.name}` : entry.name
        const source = join(from, ...childRelative.split('/'))
        const destination = join(to, ...childRelative.split('/'))
        if (entry.type === 'directory') {
          await walk(childRelative)
          continue
        }
        const text = await this.fs.readFile(source)
        if (typeof text !== 'string') continue
        await this.fs.writeFile(destination, text, { workspaceRoot })
        copied.push(childRelative)
      }
    }
    await walk('')
    return copied
  }

  /* ---------------------------------------------------------------- *
   * Small helpers
   * ---------------------------------------------------------------- */

  /**
   * Read a page by its repository-relative path.
   */
  async readPageByPath(root, repoRelativePath) {
    if (!repoRelativePath) return null
    const absolute = join(root, ...toPosix(repoRelativePath).split('/'))
    const markdown = await this.fs.readFile(absolute)
    if (typeof markdown !== 'string') return null
    return { path: repoRelativePath, abs: absolute, markdown }
  }

  /**
   * The path of a page relative to its language content directory.
   */
  contentRelative(repoRelativePath, language) {
    if (!repoRelativePath) return ''
    const marker = `/content/${language}/`
    const index = repoRelativePath.indexOf(marker)
    if (index >= 0) return repoRelativePath.slice(index + marker.length)
    return toPosix(repoRelativePath)
  }

  /**
   * True when a page belongs to a language.
   */
  isLanguageOf(repoRelativePath, language) {
    if (!repoRelativePath) return false
    return toPosix(repoRelativePath).includes(`/content/${language}/`)
  }
}

/**
 * Read an optional host service without throwing.
 *
 * `ctx.get(name)` throws when the service is absent, and a plugin must keep
 * working in a composition that lacks it.
 *
 * @param {object} ctx
 * @param {string} name
 * @returns {unknown}
 */
function optionalService(ctx, name) {
  try {
    return ctx.get(name, false)
  } catch {
    return undefined
  }
}

/**
 * Parse the frontmatter of a page without throwing.
 */
function parseFrontmatterSafe(markdown) {
  try {
    return parseFrontmatter(markdown)
  } catch {
    return { data: {}, body: markdown }
  }
}
