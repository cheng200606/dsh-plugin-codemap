/**
 * Evidence collection for the Repo Wiki plugin.
 *
 * The writer stage may only state claims that this module has grounded in
 * real repository content. Every claim therefore carries at least one
 * citation, and every citation is guaranteed to be verifiable:
 *
 *   - `path` is a repo-relative POSIX path that exists in `scan.files`
 *   - `1 <= startLine <= endLine <= <real line count of that file>`
 *
 * The module is deterministic: the same scan + index + plan always produce the
 * same packs, and no model is involved.
 *
 * Input shapes (see `scan.js` / `indexer.js`):
 *   - `scan.files`      `Array<{ path, abs, size, ext, language }>`
 *   - `scan.buildFiles` `string[]`
 *   - `scan.entryPoints` `string[]`
 *   - `index.modules`   `Array<{ path, files, loc, topLevel, symbols }>`
 *   - `index.symbols`   `Array<{ name, kind, path, line, endLine }>`
 *   - `index.routes`    `Array<{ method, path, file, line }>`
 *   - `index.configKeys` `Array<{ key, file, line }>`
 *   - `index.dependencies` `Array<{ name, version, scope, source }>`
 *   - `index.scripts`   `Array<{ name, command, file }>`
 */
import { join } from 'node:path'
import { toLines, toPosix, uniq } from './util.js'

/** Default read budget for one `collectEvidence` call. */
const DEFAULT_READ_BUDGET = 6 * 1024 * 1024

/** Maximum number of claims kept in one pack. */
const MAX_CLAIMS = 16

/** Preferred number of claims in one pack. */
const MIN_CLAIMS = 4

/** Maximum number of key files tracked per pack. */
const MAX_KEY_FILES = 12

/** Per-category claim budgets: every category keeps room in the pack. */
const CLAIM_BUDGET = {
  symbol: 8,
  route: 4,
  config: 5,
  manifest: 5,
  doc: 4,
  file: 12,
}

/**
 * The order in which the remaining claims are added after every key file has
 * been cited once: the strongest category first.
 */
const DEPTH_ORDER = [
  { rank: 0, budget: CLAIM_BUDGET.route },
  { rank: 1, budget: CLAIM_BUDGET.config },
  { rank: 2, budget: CLAIM_BUDGET.manifest },
  { rank: 3, budget: CLAIM_BUDGET.symbol },
  { rank: 4, budget: CLAIM_BUDGET.doc },
  { rank: 5, budget: CLAIM_BUDGET.file },
]

/** Maximum number of symbols cited per file. */
const MAX_SYMBOLS_PER_FILE = 2

/** Manifest-ish files that describe dependencies, scripts and build steps. */
const MANIFEST_NAMES = new Set([
  'package.json',
  'pyproject.toml',
  'cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'composer.json',
  'gemfile',
  'makefile',
  'dockerfile',
  'requirements.txt',
  'setup.py',
  'pnpm-workspace.yaml',
  'nx.json',
  'turbo.json',
])

/* ------------------------------------------------------------------ *
 * Normalization helpers
 * ------------------------------------------------------------------ */

/** Extract repo-relative POSIX paths from a list of strings or path objects. */
function pathList(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    if (typeof item === 'string') {
      if (item) out.push(toPosix(item))
      continue
    }
    if (item && typeof item === 'object') {
      const candidate = item.path ?? item.file ?? item.name
      if (typeof candidate === 'string' && candidate) out.push(toPosix(candidate))
    }
  }
  return out
}

/** Normalize `index.symbols`. */
function symbolList(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const name = typeof item.name === 'string' ? item.name : (typeof item.symbol === 'string' ? item.symbol : '')
    const path = typeof item.path === 'string' ? toPosix(item.path) : (typeof item.file === 'string' ? toPosix(item.file) : '')
    if (!name || !path) continue
    const line = toInteger(item.line ?? item.startLine ?? item.start)
    const endLine = toInteger(item.endLine ?? item.end ?? line)
    out.push({ name, path, line, endLine, kind: typeof item.kind === 'string' ? item.kind : '' })
  }
  return out.sort((a, b) => {
    if (a.path !== b.path) return a.path < b.path ? -1 : 1
    return a.line - b.line
  })
}

/** Normalize `index.routes`. */
function routeList(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const rawFile = firstString(item.file, item.filePath)
    // `path` carries the route literal; it is only a file path when the entry
    // does not provide an explicit file.
    const rawRoute = firstString(item.route, item.url, item.endpoint, item.pattern, rawFile ? item.path : '')
    const file = rawFile ? toPosix(rawFile) : (typeof item.path === 'string' ? toPosix(item.path) : '')
    if (!file) continue
    out.push({
      method: firstString(item.method, item.verb, item.httpMethod).toUpperCase(),
      route: rawRoute,
      file,
      line: toInteger(item.line ?? item.startLine ?? item.lineNumber),
      endLine: toInteger(item.endLine ?? item.end ?? item.line ?? item.startLine),
    })
  }
  return out
}

/** Normalize `index.configKeys`. */
function configKeyList(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const key = firstString(item.key, item.name, item.env, item.id)
    const file = typeof item.file === 'string' ? toPosix(item.file) : (typeof item.path === 'string' ? toPosix(item.path) : '')
    if (!key || !file) continue
    out.push({
      key,
      file,
      line: toInteger(item.line ?? item.startLine ?? item.lineNumber),
      endLine: toInteger(item.endLine ?? item.end ?? item.line ?? item.startLine),
    })
  }
  return out
}

/** Normalize `index.dependencies` (no line numbers in the contract). */
function dependencyList(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const name = firstString(item.name, item.id)
    const source = firstString(item.source, item.file, item.manifest)
    if (!name || !source) continue
    out.push({
      name,
      version: firstString(item.version, item.spec),
      scope: firstString(item.scope, item.type) || 'runtime',
      file: toPosix(source),
    })
  }
  return out
}

/** Normalize `index.scripts` (no line numbers in the contract). */
function scriptList(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const name = firstString(item.name, item.script)
    const file = firstString(item.file, item.source)
    if (!name || !file) continue
    out.push({ name, command: firstString(item.command, item.run), file: toPosix(file) })
  }
  return out
}

/** First non-empty string among the candidates. */
function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value) return value
  }
  return ''
}

/** Coerce a value to an integer (0 when it is not a usable number). */
function toInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) ? number : 0
}

/** Chinese label for a symbol kind. */
function kindLabel(kind) {
  switch (String(kind).toLowerCase()) {
    case 'function':
    case 'func':
    case 'method':
      return '函数'
    case 'class':
      return '类'
    case 'interface':
      return '接口'
    case 'type':
    case 'typedef':
      return '类型'
    case 'const':
    case 'constant':
      return '常量'
    case 'enum':
      return '枚举'
    case 'struct':
      return '结构体'
    case 'component':
      return '组件'
    case 'hook':
      return 'Hook'
    case 'route':
      return '路由'
    default:
      return ''
  }
}

/* ------------------------------------------------------------------ *
 * Collection
 * ------------------------------------------------------------------ */

/**
 * Collect one evidence pack per planned document.
 *
 * @param {object} fs - the filesystem adapter (`readFile`, `listDir`, `stat`, `exists`)
 * @param {object} plan - the in-memory plan
 * @param {object} index - the repository index
 * @param {object} scan - the repository scan
 * @param {{ root?: string, signal?: AbortSignal, maxBytes?: number }} [options]
 * @returns {Promise<{ packs: object[], warnings: string[] }>}
 */
export async function collectEvidence(fs, plan, index = {}, scan = {}, options = {}) {
  const warnings = []
  const packs = []
  const documents = Array.isArray(plan?.repowiki?.documents) ? plan.repowiki.documents : []
  if (documents.length === 0) warnings.push('plan: 没有可生成证据的文档。')

  const root = typeof options.root === 'string' && options.root ? options.root : process.cwd()
  const signal = options.signal
  const budget = {
    bytes: 0,
    limit: Number.isFinite(Number(options.maxBytes)) ? Number(options.maxBytes) : DEFAULT_READ_BUDGET,
    exhausted: false,
  }

  const fileSet = new Set(pathList(scan?.files))
  const entryPoints = new Set(pathList(scan?.entryPoints))
  const buildFiles = new Set(pathList(scan?.buildFiles))
  const symbols = symbolList(index?.symbols)
  const routes = routeList(index?.routes)
  const configKeys = configKeyList(index?.configKeys)
  const dependencies = dependencyList(index?.dependencies)
  const scripts = scriptList(index?.scripts)
  const symbolsByPath = new Map()
  for (const symbol of symbols) {
    if (!symbolsByPath.has(symbol.path)) symbolsByPath.set(symbol.path, [])
    symbolsByPath.get(symbol.path).push(symbol)
  }

  const reader = createReader(fs, root, signal, budget, warnings)
  const fallbackFiles = biggestSourceFiles(index, scan, fileSet)

  for (const document of documents) {
    const keyFiles = pickKeyFiles(document, fileSet, fallbackFiles, entryPoints, buildFiles)
    const keyFileSet = new Set(keyFiles.map((file) => file.path))
    const usedFiles = new Set()

    // 1. Symbol level claims — the strongest evidence we can get.
    const symbolClaims = []
    for (const file of keyFiles) {
      const record = await reader.get(file.path)
      if (!record) continue
      const fileSymbols = symbolsByPath.get(file.path) ?? []
      for (const symbol of fileSymbols.slice(0, MAX_SYMBOLS_PER_FILE)) {
        const range = clampRange(symbol.line, symbol.endLine || symbol.line, record.count)
        if (!range) continue
        usedFiles.add(file.path)
        const label = kindLabel(symbol.kind)
        symbolClaims.push({
          claim: `「${symbol.name}」${label}定义于 ${file.path}:${range[0]}-${range[1]}。`,
          citations: [{ path: file.path, startLine: range[0], endLine: range[1], symbol: symbol.name }],
          confidence: 'high',
        })
      }
    }
    // Symbol claims are kept untrimmed here; they are grouped per file and
    // selected breadth first further down.

    // 2. Route claims.
    const routeClaims = []
    for (const route of routes) {
      if (!keyFileSet.has(route.file)) continue
      const record = await reader.get(route.file)
      if (!record) continue
      const located = locate(record, route.line, route.route)
      if (!located) continue
      usedFiles.add(route.file)
      const label = route.method && route.route ? `${route.method} ${route.route}` : (route.route || route.method || '未命名路由')
      routeClaims.push({
        claim: `路由 ${label} 在 ${route.file}:${located[0]}-${located[1]} 中注册。`,
        citations: [{ path: route.file, startLine: located[0], endLine: located[1] }],
        confidence: 'high',
      })
    }
    // Route claims are selected further down, together with the other
    // categories, so that a single file cannot consume the whole pack.

    // 3. Configuration key claims.
    const configClaims = []
    for (const key of configKeys) {
      if (!keyFileSet.has(key.file)) continue
      const record = await reader.get(key.file)
      if (!record) continue
      const located = locate(record, key.line, key.key)
      if (!located) continue
      usedFiles.add(key.file)
      configClaims.push({
        claim: `配置项 ${key.key} 在 ${key.file}:${located[0]}-${located[1]} 中定义。`,
        citations: [{ path: key.file, startLine: located[0], endLine: located[1] }],
        confidence: 'high',
      })
    }
    // Configuration claims are selected further down.

    // 4. Dependency and script claims (the index has no line numbers for
    //    them, so the manifest content is searched for the entry).
    const manifestClaims = []
    for (const dependency of dependencies) {
      if (!keyFileSet.has(dependency.file)) continue
      const record = await reader.get(dependency.file)
      if (!record) continue
      const line = findLine(record.lines, `"${dependency.name}"`)
      if (!line) continue
      usedFiles.add(dependency.file)
      const version = dependency.version ? `（${dependency.version}）` : ''
      manifestClaims.push({
        claim: `依赖 ${dependency.name}${version} 在 ${dependency.file}:${line}-${line} 中声明。`,
        citations: [{ path: dependency.file, startLine: line, endLine: line }],
        confidence: 'high',
      })
    }
    for (const script of scripts) {
      if (!keyFileSet.has(script.file)) continue
      const record = await reader.get(script.file)
      if (!record) continue
      const line = findLine(record.lines, `"${script.name}"`)
      if (!line) continue
      usedFiles.add(script.file)
      const command = script.command ? `（${script.command}）` : ''
      manifestClaims.push({
        claim: `脚本 ${script.name}${command} 在 ${script.file}:${line}-${line} 中定义。`,
        citations: [{ path: script.file, startLine: line, endLine: line }],
        confidence: 'high',
      })
    }
    // Manifest claims are selected further down.

    // 5. Documentation claims (always low confidence).
    const docClaims = []
    for (const file of keyFiles) {
      if (!isDocFile(file.path)) continue
      const record = await reader.get(file.path)
      if (!record || record.count < 1) continue
      docClaims.push({
        claim: `「${file.path}」 中记录了与本页相关的说明。`,
        citations: [{ path: file.path, startLine: 1, endLine: record.count }],
        confidence: 'low',
      })
      usedFiles.add(file.path)
    }
    // Documentation claims are selected further down.

    // 6. File level fallback claims for every key file without a claim yet.
    const fileClaims = []
    for (const file of keyFiles) {
      if (usedFiles.has(file.path)) continue
      const record = await reader.get(file.path)
      if (!record || record.count < 1) continue
      fileClaims.push({
        claim: `「${file.path}」 是本页涉及的关键文件（角色：${file.role}）。`,
        citations: [{ path: file.path, startLine: 1, endLine: record.count }],
        confidence: isDocFile(file.path) ? 'low' : 'medium',
      })
    }
    // Claims are selected breadth first: every key file that can be cited
    // gets at least one citation before a single file is cited twice.
    //
    // Every candidate is grouped by the file it cites; inside a group the
    // strongest category comes first (route > config > manifest > symbol >
    // doc > whole file), so the pack always leads with the most precise
    // evidence it has.
    const groups = new Map()
    const addCandidate = (claim, rank) => {
      const path = claim?.citations?.[0]?.path
      if (!path) return
      if (!groups.has(path)) groups.set(path, [])
      groups.get(path).push({ claim, rank, taken: false })
    }
    for (const claim of routeClaims.slice(0, CLAIM_BUDGET.route)) addCandidate(claim, 0)
    for (const claim of configClaims.slice(0, CLAIM_BUDGET.config)) addCandidate(claim, 1)
    for (const claim of manifestClaims.slice(0, CLAIM_BUDGET.manifest)) addCandidate(claim, 2)
    for (const claim of symbolClaims) addCandidate(claim, 3)
    for (const claim of docClaims.slice(0, CLAIM_BUDGET.doc)) addCandidate(claim, 4)
    for (const claim of fileClaims) addCandidate(claim, 5)

    const selected = []
    const perPath = new Map()
    const take = (candidate) => {
      if (!candidate || candidate.taken) return
      if (selected.length >= MAX_CLAIMS) return
      const path = candidate.claim?.citations?.[0]?.path
      if (!path) return
      const used = perPath.get(path) ?? 0
      if (used >= 2) return
      perPath.set(path, used + 1)
      candidate.taken = true
      selected.push(candidate.claim)
    }

    // 1. Breadth: the strongest claim of every key file.
    for (const file of keyFiles) {
      const group = groups.get(file.path)
      if (!group) continue
      take(group.find((candidate) => !candidate.taken))
    }
    // 2. Depth: the remaining claims, strongest category first.
    for (const { rank, budget } of DEPTH_ORDER) {
      let used = 0
      for (const group of groups.values()) {
        if (used >= budget || selected.length >= MAX_CLAIMS) break
        const candidate = group.find((item) => item.rank === rank && !item.taken)
        if (!candidate) continue
        const before = selected.length
        take(candidate)
        if (selected.length > before) used++
      }
    }

    const limited = selected
    if (limited.length < MIN_CLAIMS) {
      warnings.push(`页面 ${document?.id ?? '?'}：可验证的证据不足（${limited.length} 条）。`)
    }

    const keyFileEntries = []
    for (const file of keyFiles) {
      const record = await reader.get(file.path)
      const symbol = (symbolsByPath.get(file.path) ?? [])[0]
      let lines
      if (symbol) {
        const range = record
          ? clampRange(symbol.line, symbol.endLine || symbol.line, record.count)
          : [symbol.line, symbol.endLine || symbol.line]
        if (range && range[0] > 0) lines = [range[0], range[1]]
      }
      keyFileEntries.push(lines ? { path: file.path, role: file.role, lines } : { path: file.path, role: file.role })
    }

    packs.push({
      pageId: document?.id ?? '',
      goal: document?.goal ?? '',
      claims: limited,
      keyFiles: keyFileEntries,
      callPaths: [],
      openQuestions: buildOpenQuestions(keyFiles, symbolsByPath, usedFiles),
    })
  }

  return { packs, warnings }
}

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

/**
 * Create a lazy reader that caches file content and enforces the read budget.
 *
 * The filesystem adapter is asynchronous (`readFile` returns a promise), so
 * `get()` is asynchronous too. The cache stores the *promise*, so a file is
 * read at most once even when several claims need it.
 */
function createReader(fs, root, signal, budget, warnings) {
  const cache = new Map()
  return {
    get(relPath) {
      if (cache.has(relPath)) return cache.get(relPath)
      const pending = (async () => {
        if (budget.exhausted || !fs || typeof fs.readFile !== 'function') return null
        const absolute = join(root, ...toPosix(relPath).split('/'))
        try {
          const text = await fs.readFile(absolute, signal)
          if (typeof text !== 'string') {
            warnings.push(`无法读取文件：${relPath}`)
            return null
          }
          const size = Buffer.byteLength(text, 'utf8')
          if (budget.bytes + size > budget.limit) {
            budget.exhausted = true
            warnings.push(`读取预算（${budget.limit} 字节）已用尽，后续证据改用索引数据。`)
            return null
          }
          budget.bytes += size
          const lines = toLines(text)
          return { text, lines, count: lines.length }
        } catch (error) {
          warnings.push(`读取失败：${relPath}（${error?.message ?? String(error)}）`)
          return null
        }
      })()
      cache.set(relPath, pending)
      return pending
    },
  }
}

/* ------------------------------------------------------------------ *
 * Selection helpers
 * ------------------------------------------------------------------ */

/** True when the path looks like prose documentation. */
function isDocFile(file) {
  const lower = toPosix(file).toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.mdx') || lower.endsWith('.rst')
}

/** Directories that mark a file as a test artefact. */
const TEST_DIRECTORIES = new Set(['test', 'tests', 'spec', 'specs', '__tests__', '__test__', 'testing'])

/** True when the file is a manifest / build description. */
function isManifestFile(file) {
  const parts = toPosix(file).split('/')
  const base = parts[parts.length - 1] ?? ''
  return MANIFEST_NAMES.has(base.toLowerCase())
}

/**
 * True when the file belongs to the test suite: it lives in a test directory
 * or its name carries a test / spec marker.
 */
function isTestFile(file) {
  const parts = toPosix(file).split('/')
  const base = (parts[parts.length - 1] ?? '').toLowerCase()
  for (const directory of parts.slice(0, -1)) {
    if (TEST_DIRECTORIES.has(directory.toLowerCase())) return true
  }
  if (/\.(test|spec)\.[^.]+$/.test(base)) return true
  if (/(^|[._-])(test|spec)[._-]/.test(base)) return true
  return false
}

/** The role of a file inside a page. */
function roleOf(file, entryPoints, buildFiles) {
  if (entryPoints.has(file)) return 'entry'
  if (buildFiles.has(file)) return 'config'
  if (isDocFile(file)) return 'doc'
  if (isTestFile(file)) return 'test'
  return 'core'
}

/**
 * Choose the key files of one page: the planned sources first (manifests are
 * preferred because they carry the most facts), then the biggest indexed
 * source files as a fallback.
 */
function pickKeyFiles(document, fileSet, fallbackFiles, entryPoints, buildFiles) {
  const planned = pathList(document?.sources?.files).filter((file) => fileSet.has(file))
  const ordered = [...planned].sort((a, b) => {
    const manifestA = isManifestFile(a) ? 0 : 1
    const manifestB = isManifestFile(b) ? 0 : 1
    return manifestA - manifestB
  })
  const chosen = ordered.slice(0, MAX_KEY_FILES)
  if (chosen.length === 0) {
    for (const file of fallbackFiles) {
      if (chosen.length >= MAX_KEY_FILES) break
      if (!fileSet.has(file)) continue
      if (!chosen.includes(file)) chosen.push(file)
    }
  }
  return chosen.map((file) => ({ path: file, role: roleOf(file, entryPoints, buildFiles) }))
}

/**
 * The biggest source files of the repository (deterministic order).
 *
 * File sizes come from the scan; module sizes (`loc`) are used as a fallback.
 */
function biggestSourceFiles(index, scan, fileSet) {
  const sizes = new Map()
  const bump = (file, size) => {
    if (typeof file !== 'string' || !file) return
    const path = toPosix(file)
    const value = Number(size)
    const current = sizes.get(path)
    if (current === undefined) sizes.set(path, Number.isFinite(value) ? value : 0)
    else if (Number.isFinite(value) && value > current) sizes.set(path, value)
  }
  for (const item of Array.isArray(scan?.files) ? scan.files : []) {
    if (typeof item === 'string') bump(item, 0)
    else if (item && typeof item === 'object') bump(item.path ?? item.file, item.size ?? item.bytes ?? item.lines)
  }
  for (const module of Array.isArray(index?.modules) ? index.modules : []) {
    if (!module || typeof module !== 'object') continue
    const loc = Number(module.loc)
    for (const file of Array.isArray(module.files) ? module.files : []) {
      if (typeof file === 'string') bump(file, loc)
      else if (file && typeof file === 'object') bump(file.path ?? file.file, file.size ?? file.loc ?? loc)
    }
  }
  const sorted = [...sizes.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
  })
  return sorted.map((entry) => entry[0]).filter((file) => fileSet.has(file))
}

/* ------------------------------------------------------------------ *
 * Citation helpers
 * ------------------------------------------------------------------ */

/**
 * Clamp a symbol range into the real line count of the file.
 * Returns `null` when the range cannot be verified.
 */
function clampRange(start, end, count) {
  if (!Number.isInteger(start) || start < 1) return null
  if (!Number.isInteger(count) || count < 1) return null
  const from = Math.min(start, count)
  const to = Math.min(Math.max(end, from), count)
  if (from < 1 || to < from) return null
  return [from, to]
}

/**
 * Locate the line of an entry: the indexed line when it is usable, otherwise
 * the first line that mentions the entry text.
 */
function locate(record, indexedLine, text) {
  if (Number.isInteger(indexedLine) && indexedLine >= 1 && indexedLine <= record.count) {
    return [indexedLine, indexedLine]
  }
  const found = findLine(record.lines, text)
  if (!found) return null
  return [found, found]
}

/** First 1-based line index that contains `needle` (0 when not found). */
function findLine(lines, needle) {
  if (!needle) return 0
  const target = String(needle)
  for (let index = 0; index < lines.length; index++) {
    if (lines[index].includes(target)) return index + 1
  }
  return 0
}

/* ------------------------------------------------------------------ *
 * Open questions
 * ------------------------------------------------------------------ */

/** Build the 1-3 open questions of one pack. */
function buildOpenQuestions(keyFiles, symbolsByPath, usedFiles) {
  const questions = []
  const first = keyFiles[0]
  if (!first) {
    questions.push('本页尚未找到可引用的源码证据，需要人工补充来源文件。')
    return questions
  }
  questions.push(`「${first.path}」 的运行时行为需要结合日志或实际执行确认。`)
  if (questions.length < 3 && !hasRelatedTest(first.path)) {
    questions.push(`「${first.path}」 缺少对应测试，边界行为需要人工确认。`)
  }
  const docFile = keyFiles.find((file) => isDocFile(file.path))
  if (questions.length < 3 && docFile && docFile.path !== first.path) {
    questions.push(`「${docFile.path}」 只提供概述，具体细节需要回到源码确认。`)
  }
  const usedSymbol = usedFiles.size > 0 ? [...symbolsByPath.keys()].find((path) => usedFiles.has(path)) : ''
  if (questions.length < 3 && usedSymbol) {
    questions.push(`「${usedSymbol}」 的调用方分布尚未完全确认。`)
  }
  return questions.slice(0, 3)
}

/**
 * Rough "is there a test for this file" probe based on the file name.
 */
function hasRelatedTest(file) {
  const parts = toPosix(file).split('/')
  const base = parts[parts.length - 1] ?? ''
  const stem = base.replace(/\.[^.]+$/, '')
  if (!stem) return false
  const markers = ['test', 'spec', '__tests__']
  for (const marker of markers) {
    if (base.includes(marker)) return true
  }
  return TEST_FILE_HINTS.some((hint) => hint(stem))
}

/** Cheap patterns that hint at a companion test file. */
const TEST_FILE_HINTS = [
  (stem) => stem.endsWith('.test'),
  (stem) => stem.endsWith('.spec'),
  (stem) => stem.endsWith('_test'),
  (stem) => stem.endsWith('Test'),
  (stem) => stem.endsWith('Spec'),
]
