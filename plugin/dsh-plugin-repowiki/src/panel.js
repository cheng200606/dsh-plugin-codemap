/**
 * Panel payloads for the Web sidebar panel.
 *
 * The host side owns every read of the wiki; the browser half only renders
 * what these functions return. Keeping the assembly here means the panel and
 * the model tools can never disagree about what the wiki contains.
 */
import { GENERATOR_VERSION, loadMetadata, parseFrontmatter } from './store.js'
import { parseMarkdownBlocks } from './markdown.js'

/**
 * The section a page belongs to, derived from its path.
 *
 * A page lives at `<outputDir>/content/<language>/<section>/<file>.md`; the
 * section is the directory between the language and the file. A page directly
 * under the language directory (the landing page) has no section.
 *
 * @param {string} pagePath - the repository relative path of the page.
 * @param {string} language - the language directory, e.g. `zh`.
 * @returns {string} the section id, or an empty string.
 */
export function sectionOfPage(pagePath, language) {
  const parts = String(pagePath ?? '').split('/')
  const marker = parts.indexOf('content')
  if (marker < 0) return ''
  const rest = parts.slice(marker + 1)
  const tail = rest[0] === language ? rest.slice(1) : rest
  return tail.length >= 2 ? tail[0] : ''
}

/**
 * Build the payload of the panel overview: the page tree, the statistics and
 * the knowledge cards.
 *
 * @param {object} service - the `RepoWikiService` instance.
 * @param {string} root - the repository root.
 * @param {{ language?: string }} [options]
 * @returns {Promise<object>}
 */
export async function buildPanelPayload(service, root, options = {}) {
  const repository = root || service.resolveRoot()
  const language = options.language || service.config.defaultLanguage
  const meta = await loadMetadata(service.fs, repository, service.config.outputDir)
  const status = await service.status(repository)

  if (!meta) {
    const client = await service.clientStatus()
    return {
      root: repository,
      outputDir: service.config.outputDir,
      language,
      // The version of the *running host*, not of the wiki on disk: the client
      // compares it with its own constant to detect a stale browser bundle.
      serverVersion: GENERATOR_VERSION,
      exists: false,
      generatedAt: null,
      generator: null,
      plan: null,
      stats: {
        pageCount: 0,
        cardCount: 0,
        fresh: 0,
        stale: 0,
        needsReview: 0,
        draft: 0,
        citationTotal: 0,
        citationFiles: 0,
        modelCalls: 0,
        durationMs: 0,
        fileCount: 0,
        loc: 0,
      },
      pages: [],
      sections: [],
      cards: [],
      roots: rootChoices(service, repository),
      availableLanguages: [],
      run: await service.readRunJournal(repository, language),
      client,
      webUrl: client.webUrl ?? null,
    }
  }
  const pages = []
  const citationFiles = new Set()
  let citationTotal = 0
  for (const page of meta.pages ?? []) {
    const citations = Array.isArray(page.citations) ? page.citations : []
    citationTotal += citations.length
    for (const citation of citations) {
      if (citation?.path) citationFiles.add(citation.path)
    }
    pages.push({
      id: page.id,
      title: page.title ?? page.id,
      goal: page.goal ?? '',
      path: page.path ?? '',
      section: sectionOfPage(page.path, language),
      status: page.status ?? 'draft',
      confidence: page.confidence ?? 'medium',
      citationCount: citations.length,
      sourceCount: page.sources?.files?.length ?? 0,
      symbolCount: page.sources?.symbols?.length ?? 0,
      // First few source files: the graph uses them to jump from a module node
      // to the wiki page that documents it.
      files: (page.sources?.files ?? []).slice(0, 12),
      symbols: (page.sources?.symbols ?? []).slice(0, 12),
      generatedAt: page.generatedAt ?? null,
      hash: page.hashes?.output ?? null,
    })
  }

  const sectionMap = new Map()
  for (const page of pages) {
    const key = page.section || ''
    if (!sectionMap.has(key)) sectionMap.set(key, [])
    sectionMap.get(key).push(page.id)
  }
  const sections = [...sectionMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([id, pageIds]) => ({ id, label: id || '根目录', pages: pageIds }))

  const client = await service.clientStatus()
  return {
    root: repository,
    outputDir: service.config.outputDir,
    language,
    serverVersion: GENERATOR_VERSION,
    exists: true,
    generatedAt: meta.generatedAt ?? null,
    generator: meta.generator ?? null,
    repo: meta.repo ?? null,
    plan: meta.plan ?? null,
    stats: {
      pageCount: pages.length,
      cardCount: (meta.cards ?? []).length,
      fresh: status.fresh ?? 0,
      stale: status.stale ?? 0,
      needsReview: status.failed ?? 0,
      draft: status.draft ?? 0,
      citationTotal,
      citationFiles: citationFiles.size,
      modelCalls: meta.stats?.modelCalls ?? 0,
      durationMs: meta.stats?.durationMs ?? 0,
      fileCount: meta.repo?.fileCount ?? 0,
      loc: meta.repo?.loc ?? 0,
    },
    pages,
    sections,
    cards: (meta.cards ?? []).map((card) => ({
      id: card.id,
      title: card.title ?? card.id,
      path: card.path ?? null,
      tags: card.tags ?? [],
      tag: card.tag ?? (card.tags ?? [])[0] ?? '',
      summary: card.summary ?? '',
      parent: card.parent ?? null,
      scope: card.scope ?? null,
      confidence: card.confidence ?? 'medium',
      sources: card.sources ?? [],
    })),
    // The workspace selector entries, each annotated with the wiki state of
    // that repository — the data behind the "projects" overview.
    projects: await projectOverviews(service, repository, language),
    roots: rootChoices(service, repository),
    // Languages with pages on disk; the header uses it to explain a missing
    // translation instead of silently rendering an empty wiki.
    availableLanguages: await service.availableLanguages(repository),
    run: await service.readRunJournal(repository, language),
    client,
    webUrl: client.webUrl ?? null,
  }
}

/**
 * Build the payload of a single page: frontmatter plus structured blocks.
 *
 * @param {object} service - the `RepoWikiService` instance.
 * @param {string} root - the repository root.
 * @param {string} pageId - the page id, e.g. `architecture`.
 * @param {{ language?: string }} [options]
 * @returns {Promise<object>}
 */
export async function buildPagePayload(service, root, pageId, options = {}) {
  const repository = root || service.resolveRoot()
  const language = options.language || service.config.defaultLanguage
  const page = await service.read(repository, pageId, { language })
  const { data, body } = parseFrontmatter(page.markdown ?? '')
  const blocks = parseMarkdownBlocks(body)

  // The ancestor chain of the page (plan `parent` fields), nearest parent
  // last — the data behind the hierarchical breadcrumb.
  let parents = []
  try {
    const meta = await loadMetadata(service.fs, repository, service.config.outputDir)
    if (meta) {
      const byId = new Map((meta.pages ?? []).map((entry) => [entry.id, entry]))
      const chain = []
      let cursor = byId.get(page.id) ?? null
      const seen = new Set()
      while (cursor?.parent && !seen.has(cursor.parent)) {
        seen.add(cursor.parent)
        const parentEntry = byId.get(cursor.parent)
        if (!parentEntry) break
        chain.unshift({ id: parentEntry.id, title: parentEntry.title ?? parentEntry.id })
        cursor = parentEntry
      }
      parents = chain
    }
  } catch {
    // A missing parent chain degrades to no breadcrumb, never an error.
  }

  const sections = []
  let current = { title: '', level: 0, blocks: [] }
  for (const block of blocks) {
    if (block.type === 'heading' && block.level <= 3) {
      if (current.blocks.length > 0) sections.push(current)
      current = { title: block.text ?? '', level: block.level ?? 0, blocks: [] }
      continue
    }
    current.blocks.push(block)
  }
  if (current.blocks.length > 0) sections.push(current)

  return {
    id: page.id,
    title: page.title ?? data.title ?? pageId,
    goal: page.goal ?? data.goal ?? '',
    path: page.path ?? '',
    status: page.status ?? data.status ?? 'draft',
    confidence: data.confidence ?? null,
    sourceHash: data.source_hash ?? null,
    generatedAt: data.generated_at ?? null,
    parents,
    citations: Array.isArray(page.citations) ? page.citations : [],
    frontmatter: data,
    blocks,
    sections,
  }
}

/**
 * Build the payload of a search request.
 *
 * @param {object} service - the `RepoWikiService` instance.
 * @param {string} root - the repository root.
 * @param {string} query - the search query.
 * @param {{ language?: string, limit?: number }} [options]
 * @returns {Promise<object>}
 */
export async function buildSearchPayload(service, root, query, options = {}) {
  const repository = root || service.resolveRoot()
  const language = options.language || service.config.defaultLanguage
  const limit = Math.min(Math.max(Number(options.limit ?? 8) || 8, 1), 50)
  const hits = await service.search(repository, query, { language, limit })
  return {
    query: String(query ?? ''),
    count: Array.isArray(hits) ? hits.length : 0,
    hits: Array.isArray(hits) ? hits : [],
  }
}

/**
 * The repository roots the panel may show, active one first.
 *
 * A Fetch route cannot see the session, so the host resolves a best-effort root
 * (see `resolveRequestRoot`). Listing the registered workspaces next to it lets
 * the panel offer a switch instead of silently showing the wrong repository.
 *
 * @param {object} service - the `RepoWikiService` instance.
 * @param {string} active - the root the payload was built for.
 * @returns {Array<{ path: string, title: string, active: boolean }>}
 */
/**
 * A short display name for a repository root: the last path segment only.
 * The UI shows names, never full paths — paths stay in the tooltip.
 */
function rootDisplayName(value) {
  const normalized = String(value ?? '').replace(/[\\/]+$/, '')
  const name = normalized.split(/[\\/]/).pop()
  return name || normalized
}

function rootChoices(service, active) {
  const choices = []
  const seen = new Set()
  const push = (path, title) => {
    if (typeof path !== 'string' || !path || seen.has(path)) return
    seen.add(path)
    // A raw path is never a good display name: collapse it to the project
    // name the way the workspace tree does.
    const display = title && !/[\\/]/.test(title) ? title : rootDisplayName(title || path)
    choices.push({ path, title: display || path, active: path === active })
  }
  push(active, active)
  for (const workspace of service.listWorkspaces()) push(workspace.path, workspace.title)
  return choices
}

/**
 * One overview row per known workspace: whether a wiki exists there, how many
 * pages and cards it has and when it was last generated — the data behind the
 * projects overview (the reference product's entry grid).
 *
 * A missing or unreadable wiki degrades to `exists:false` instead of failing
 * the whole panel payload.
 *
 * @param {object} service
 * @param {string} repository - the active root.
 * @param {string} language
 * @returns {Promise<Array<object>>}
 */
async function projectOverviews(service, repository, language) {
  const choices = rootChoices(service, repository)
  const rows = []
  for (const choice of choices) {
    const row = {
      path: choice.path,
      title: choice.title,
      active: choice.active === true,
      exists: false,
      pages: 0,
      cards: 0,
      fresh: 0,
      generatedAt: null,
    }
    try {
      const meta = await loadMetadata(service.fs, choice.path, service.config.outputDir)
      if (meta) {
        row.exists = true
        row.pages = (meta.pages ?? []).length
        row.cards = (meta.cards ?? []).length
        row.fresh = (meta.pages ?? []).filter((page) => page?.status === 'fresh').length
        row.generatedAt = meta.generatedAt ?? null
      }
    } catch {
      // Keep the degraded row.
    }
    rows.push(row)
  }
  return rows
}
