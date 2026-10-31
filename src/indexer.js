/**
 * Lightweight repository indexing for the CodeMap plugin.
 *
 * The indexer turns the `RepoScan` profile into a `RepoIndex`: module tree,
 * symbol outlines, routes, environment keys, dependency manifests and the
 * documentation list. Everything is derived with cheap regular expressions so
 * the index can be rebuilt on every scan without a model in the loop.
 *
 * The module never throws on malformed sources: per-file parsing is wrapped in
 * try/catch and every problem is reported through `index.warnings`.
 */
import path from 'node:path'
import { Buffer } from 'node:buffer'
import { countLines, toLines, uniq } from './util.js'
import { detectLanguageByPath } from './scan.js'

export { detectLanguageByPath }

/** Languages whose sources are read and parsed for symbols. */
const SOURCE_LANGUAGES = new Set([
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'python',
  'go',
  'rust',
  'java',
  'ruby',
  'php',
  'csharp',
  'c',
  'cpp',
  'swift',
  'kotlin',
  'shell',
  'vue',
  'svelte',
])

/** Languages that can declare HTTP routes. */
const ROUTE_LANGUAGES = new Set(['typescript', 'javascript', 'tsx', 'jsx', 'python'])

/** Total number of source bytes read before the indexer gives up. */
const SOURCE_READ_BUDGET = 8 * 1024 * 1024

/** Total number of metadata bytes (manifests + docs) read. */
const META_READ_BUDGET = 4 * 1024 * 1024

/** Maximum directory depth that still becomes a module. */
const MAX_MODULE_DEPTH = 3

/** Maximum number of symbol names reported per module. */
const MAX_MODULE_SYMBOLS = 12

/* ------------------------------------------------------------------ */
/* symbol patterns                                                     */
/* ------------------------------------------------------------------ */

const JS_PATTERNS = [
  { re: /^\s*export\s+default\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/, kind: 'class', exported: true },
  { re: /^\s*export\s+default\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/, kind: 'function', exported: true },
  { re: /^\s*export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/, kind: 'function', exported: true },
  { re: /^\s*export\s+class\s+([A-Za-z_$][\w$]*)/, kind: 'class', exported: true },
  { re: /^\s*export\s+interface\s+([A-Za-z_$][\w$]*)/, kind: 'interface', exported: true },
  { re: /^\s*export\s+type\s+([A-Za-z_$][\w$]*)/, kind: 'type', exported: true },
  { re: /^\s*export\s+enum\s+([A-Za-z_$][\w$]*)/, kind: 'enum', exported: true },
  { re: /^\s*export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\(|async\b|function\b|<)/, kind: 'const', exported: true },
  { re: /^\s*(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/, kind: 'function', methodWhenIndented: true },
  { re: /^\s*class\s+([A-Za-z_$][\w$]*)/, kind: 'class', methodWhenIndented: true },
  { re: /^const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\(|async\b|function\b|<)/, kind: 'const' },
]

const PYTHON_PATTERNS = [
  { re: /^\s*async\s+def\s+([A-Za-z_][\w]*)\s*\(/, kind: 'function', methodWhenIndented: true },
  { re: /^\s*def\s+([A-Za-z_][\w]*)\s*\(/, kind: 'function', methodWhenIndented: true },
  { re: /^\s*class\s+([A-Za-z_][\w]*)/, kind: 'class' },
]

const GO_PATTERNS = [
  { re: /^\s*func\s*\(\s*\w+\s+\*?[\w.\[\]]+\s*\)\s*([A-Za-z_]\w*)/, kind: 'method' },
  { re: /^\s*func\s+([A-Za-z_]\w*)/, kind: 'function' },
  { re: /^\s*type\s+([A-Za-z_]\w*)\s+struct\b/, kind: 'type' },
]

const RUST_PATTERNS = [
  { re: /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)/, kind: 'function', methodWhenIndented: true },
  { re: /^\s*(?:pub(?:\([^)]*\))?\s+)?struct\s+([A-Za-z_]\w*)/, kind: 'type' },
  { re: /^\s*(?:pub(?:\([^)]*\))?\s+)?enum\s+([A-Za-z_]\w*)/, kind: 'enum' },
  { re: /^\s*(?:pub(?:\([^)]*\))?\s+)?trait\s+([A-Za-z_]\w*)/, kind: 'interface' },
]

const JVM_PATTERNS = [
  {
    re: /^\s*(?:(?:public|private|protected|internal|static|final|abstract|sealed|partial|export|open)\s+)*class\s+([A-Za-z_]\w*)/,
    kind: 'class',
  },
  {
    re: /^\s*(?:(?:public|private|protected|internal|static|final|abstract|sealed|partial|export|open)\s+)*interface\s+([A-Za-z_]\w*)/,
    kind: 'interface',
  },
  {
    re: /^\s*public\s+(?:(?:static|final|synchronized|abstract|virtual|override|async)\s+)*[\w<>\[\],.\s]*?([A-Za-z_]\w*)\s*\(/,
    kind: 'method',
  },
]

const COMPONENT_PATTERNS = [
  { re: /^\s*export\s+default\s+(?:defineComponent\s*\(\s*)?\{/, kind: 'component', nameFromFile: true },
  { re: /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/, kind: 'function', methodWhenIndented: true },
]

/** Per-language symbol patterns. */
const PATTERNS_BY_LANGUAGE = new Map([
  ['typescript', JS_PATTERNS],
  ['javascript', JS_PATTERNS],
  ['tsx', JS_PATTERNS],
  ['jsx', JS_PATTERNS],
  ['python', PYTHON_PATTERNS],
  ['go', GO_PATTERNS],
  ['rust', RUST_PATTERNS],
  ['java', JVM_PATTERNS],
  ['csharp', JVM_PATTERNS],
  ['php', JVM_PATTERNS],
  ['ruby', JVM_PATTERNS],
  ['vue', COMPONENT_PATTERNS],
  ['svelte', COMPONENT_PATTERNS],
])

/** JavaScript / TypeScript route registrations. */
const JS_ROUTE_RE =
  /\b(?:app|router|fastify|express|server)\s*\.\s*(get|post|put|delete|patch|head|options|all)\s*\(\s*(['"`])([^'"`]*)\2/

/** Python route decorators. */
const PY_ROUTE_RE = /^\s*@(\w+)\s*\.\s*(get|post|put|delete|patch|head|options)\s*\(\s*(['"])([^'"]*)\3/
const PY_ROUTE_DECORATOR_RE = /^\s*@(\w+)\s*\.\s*route\s*\(\s*(['"])([^'"]*)\2\s*\)(.*)$/

/** Environment variable reads, per ecosystem. */
const CONFIG_KEY_PATTERNS = [
  /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
  /process\.env\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\]/g,
  /os\.environ\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\]/g,
  /os\.environ\.get\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g,
  /os\.getenv\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g,
  /Deno\.env\.get\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g,
  /env::var\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g,
]

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Build the repository index from a scan profile.
 *
 * @param {object} fs - the host fs adapter (`readFile`)
 * @param {object} scan - the `RepoScan` profile produced by `scanRepository`
 * @param {{ maxSymbols?: number, maxModules?: number, maxConcurrentReads?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>} the `RepoIndex`
 */
export async function buildIndex(fs, scan, options = {}) {
  const {
    maxSymbols = 6000,
    maxModules = 200,
    maxConcurrentReads = 3,
    signal,
  } = options ?? {}

  if (!fs || typeof fs.readFile !== 'function') {
    throw new Error('codemap: buildIndex requires the fs adapter')
  }

  const warnings = []
  const profile = scan ?? {}
  const root = profile.root ? path.resolve(String(profile.root)) : ''
  const allFiles = Array.isArray(profile.files) ? profile.files : []

  const sourceFiles = []
  for (const entry of allFiles) {
    if (!entry) continue
    const relPath = typeof entry === 'string' ? entry : String(entry.path ?? '')
    if (relPath === '') continue
    const language =
      (typeof entry === 'string' ? '' : String(entry.language ?? '')) || detectLanguageByPath(relPath)
    if (!SOURCE_LANGUAGES.has(language)) continue
    const abs =
      (typeof entry === 'string' ? '' : String(entry.abs ?? '')) || path.join(root, relPath)
    sourceFiles.push({
      path: relPath,
      abs,
      language,
      size: typeof entry === 'string' ? undefined : entry.size,
    })
  }
  sourceFiles.sort(byPath)

  let sourceBytes = 0
  let metaBytes = 0
  let sourceBudgetExhausted = false
  let metaBudgetExhausted = false

  const readSource = async (file) => {
    if (sourceBudgetExhausted) return null
    const estimate = typeof file.size === 'number' && Number.isFinite(file.size) ? file.size : 0
    if (estimate > 0 && sourceBytes + estimate > SOURCE_READ_BUDGET) {
      sourceBudgetExhausted = true
      warnings.push(
        `Source read budget of ${SOURCE_READ_BUDGET} bytes exceeded: "${file.path}" and the remaining source files were not indexed.`,
      )
      return null
    }
    // Reserve the estimated size before the read so concurrent reads cannot
    // collectively run past the budget; the reservation settles to the real
    // byte count when the read completes.
    sourceBytes += estimate
    let content = null
    try {
      content = await fs.readFile(file.abs, signal)
    } catch (error) {
      sourceBytes -= estimate
      warnings.push(`Could not read "${file.path}": ${errorMessage(error)}`)
      return null
    }
    if (content === null || content === undefined) {
      sourceBytes -= estimate
      return null
    }
    const text = String(content)
    const bytes = Buffer.byteLength(text, 'utf8')
    sourceBytes += bytes - estimate
    if (sourceBytes > SOURCE_READ_BUDGET) {
      sourceBudgetExhausted = true
      warnings.push(
        `Source read budget of ${SOURCE_READ_BUDGET} bytes exceeded while reading "${file.path}": the remaining source files were not indexed.`,
      )
      return null
    }
    return text
  }

  const readMeta = async (relPath) => {
    if (metaBudgetExhausted) return null
    const abs = path.join(root, relPath)
    let content = null
    try {
      content = await fs.readFile(abs, signal)
    } catch (error) {
      warnings.push(`Could not read "${relPath}": ${errorMessage(error)}`)
      return null
    }
    if (content === null || content === undefined) return null
    const text = String(content)
    metaBytes += Buffer.byteLength(text, 'utf8')
    if (metaBytes > META_READ_BUDGET) {
      metaBudgetExhausted = true
      warnings.push(`Metadata read budget of ${META_READ_BUDGET} bytes exceeded: some manifests and docs were skipped.`)
      return null
    }
    return text
  }

  // Read the sources with a bounded worker pool, then analyse them in the
  // original order. Reading concurrently hides the per-file latency of the
  // host provider; the analysis stays serial, so the index is byte-for-byte
  // the one the serial build produced.
  const poolSize = Math.max(1, Math.min(Number(maxConcurrentReads) || 3, 8))
  const contents = await readInPool(sourceFiles, readSource, poolSize)

  const symbols = []
  const symbolKeys = new Set()
  const routes = []
  const configKeys = []
  const configKeyNames = new Set()
  const moduleState = new Map()
  const stats = { files: 0, loc: 0, languages: {} }
  // Cross-file import graph for the knowledge layer: resolved file-level and
  // module-level pairs (plan v2 §四 P0'-1). Resolution is best effort — a
  // specifier that does not name a file inside the scan is dropped.
  const knownPaths = new Set(sourceFiles.map((file) => file.path))
  const fileImports = []

  for (let index = 0; index < sourceFiles.length; index += 1) {
    const file = sourceFiles[index]
    const content = contents[index]
    if (content === null) continue
    try {
      const loc = countNonEmptyLines(content)
      stats.files += 1
      stats.loc += loc
      stats.languages[file.language] = (stats.languages[file.language] ?? 0) + 1

      const modulePath = directoryOf(file.path)
      const module = ensureModule(moduleState, modulePath)
      if (module) {
        module.files.push(file.path)
        module.loc += loc
      }

      for (const target of resolveImportSpecs(content, file, knownPaths)) {
        fileImports.push({ from: file.path, to: target, fromModule: modulePath, toModule: directoryOf(target) })
      }

      for (const symbol of collectSymbols(content, file)) {
        if (symbols.length >= maxSymbols) break
        const key = `${symbol.name}\u0000${symbol.path}\u0000${symbol.kind}`
        if (symbolKeys.has(key)) continue
        symbolKeys.add(key)
        symbol.doc = firstDocLine(content, symbol.line - 1, file.language)
        symbols.push(symbol)
        if (module) module.names.add(symbol.name)
      }

      if (ROUTE_LANGUAGES.has(file.language)) {
        for (const route of collectRoutes(content, file)) routes.push(route)
      }

      for (const entry of collectConfigKeys(content, file)) {
        const key = `${entry.key}\u0000${entry.file}`
        if (configKeyNames.has(key)) continue
        configKeyNames.add(key)
        configKeys.push(entry)
      }
    } catch (error) {
      warnings.push(`Could not index "${file.path}": ${errorMessage(error)}`)
    }
  }

  if (symbols.length >= maxSymbols) {
    warnings.push(`Symbol limit of ${maxSymbols} reached: the symbol list was truncated.`)
  }

  const modules = []
  for (const modulePath of [...moduleState.keys()].sort()) {
    const module = moduleState.get(modulePath)
    modules.push({
      path: module.path,
      files: [...module.files].sort(),
      loc: module.loc,
      topLevel: module.topLevel,
      symbols: [...module.names].sort().slice(0, MAX_MODULE_SYMBOLS),
    })
  }
  if (modules.length > maxModules) {
    warnings.push(`Module limit of ${maxModules} reached: ${modules.length - maxModules} module(s) were dropped.`)
    modules.length = maxModules
  }

  const dependencies = await collectDependencies(allFiles, readMeta, warnings)
  const scripts = await collectScripts(allFiles, readMeta, warnings)
  const docs = await collectDocs(profile.docs, readMeta, warnings)

  // Collapse the file-level import pairs to module-level ones (deduped, both
  // endpoints inside the scan) — the edge list the knowledge graph builds on.
  const moduleImportPairs = new Set()
  const moduleImports = []
  for (const pair of fileImports) {
    if (pair.fromModule === pair.toModule) continue
    const key = `${pair.fromModule}\u0000${pair.toModule}`
    if (moduleImportPairs.has(key)) continue
    moduleImportPairs.add(key)
    moduleImports.push({ from: pair.fromModule, to: pair.toModule })
  }

  return {
    modules,
    symbols,
    dependencies,
    routes,
    configKeys,
    scripts,
    docs,
    fileImports,
    moduleImports,
    stats,
    warnings: uniq(warnings),
  }
}

/* ------------------------------------------------------------------ */
/* reads                                                              */
/* ------------------------------------------------------------------ */

/**
 * Run one reader over a list of items with a bounded worker pool.
 *
 * The results keep the input order regardless of completion order; a reader
 * that rejects would surface through `Promise.all`, but the readers used here
 * catch their own errors and return `null` instead.
 *
 * @template T
 * @param {T[]} items
 * @param {(item: T) => Promise<unknown>} reader
 * @param {number} poolSize
 * @returns {Promise<unknown[]>}
 */
async function readInPool(items, reader, poolSize) {
  const results = new Array(items.length).fill(null)
  let cursor = 0
  const workers = Array.from({ length: Math.min(Math.max(poolSize, 1), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await reader(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

/* ------------------------------------------------------------------ */
/* symbols                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* imports & docstrings                                               */
/* ------------------------------------------------------------------ */

/** Import specifier extraction, one regex per syntax family (zero-dep). */
const IMPORT_PATTERNS = [
  /import\s+[^'";]*?from\s*['"]([^'"]+)['"]/g,
  /export\s+[^'";]*?from\s*['"]([^'"]+)['"]/g,
  /import\s*['"]([^'"]+)['"]/g,
  /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  /from\s+([.][\w./-]+)\s+import\s/g,
]

/** Extension candidates tried, in order, when resolving a specifier to a scan file. */
const RESOLVE_EXTENSIONS = ['', '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs', '.py', '/index.js', '/index.ts', '/index.py']

/** Upper bound of specifiers inspected per file (keeps pathological files cheap). */
const MAX_SPECS_PER_FILE = 64

/**
 * Extract the import specifiers of one source file (best effort, regex level).
 *
 * @param {string} content
 * @returns {string[]}
 */
function collectImportSpecs(content) {
  const specs = []
  const seen = new Set()
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(content)) !== null) {
      const spec = match[1]
      if (typeof spec === 'string' && spec && !seen.has(spec)) {
        seen.add(spec)
        specs.push(spec)
        if (specs.length >= MAX_SPECS_PER_FILE) return specs
      }
    }
  }
  return specs
}

/**
 * Resolve one specifier to a scanned file path, or `null` when it points
 * outside the scan (a package) or cannot be matched (dynamic paths).
 *
 * @param {string} spec
 * @param {string} fromFile - repo-relative POSIX path of the importing file.
 * @param {Set<string>} knownPaths - every scanned source path.
 * @returns {string|null}
 */
function resolveImportSpec(spec, fromFile, knownPaths) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null
  const posixFrom = String(fromFile).split('\\').join('/')
  const base = path.posix.join(path.posix.dirname(posixFrom), spec)
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = `${base}${ext}`
    if (knownPaths.has(candidate)) return candidate
  }
  return null
}

/**
 * Resolve every import specifier of one file against the scan's path set.
 *
 * @param {string} content
 * @param {{ path: string, language: string }} file
 * @param {Set<string>} knownPaths
 * @returns {string[]} resolved repo-relative target paths.
 */
function resolveImportSpecs(content, file, knownPaths) {
  const resolved = []
  for (const spec of collectImportSpecs(content)) {
    const target = resolveImportSpec(spec, file.path, knownPaths)
    if (target) resolved.push(target)
  }
  return resolved
}

/**
 * The first human-readable line of the doc block above a symbol, or ''.
 *
 * JS/TS-family: the nearest `/** ... *\/` block within 12 lines above.
 * Python: the contiguous `#` comment block directly above.
 *
 * @param {string} content
 * @param {number} symbolLine - 0-based index of the symbol line.
 * @param {string} language
 * @returns {string}
 */
function firstDocLine(content, symbolLine, language) {
  const lines = toLines(content)
  const upper = language === 'python' ? docFromHashBlock(lines, symbolLine) : docFromJsBlock(lines, symbolLine)
  if (!upper) return ''
  return upper.length > 140 ? `${upper.slice(0, 137)}…` : upper
}

function docFromJsBlock(lines, symbolLine) {
  const ceiling = Math.max(0, symbolLine - 12)
  for (let i = symbolLine - 1; i >= ceiling; i -= 1) {
    if (!lines[i] || !lines[i].trimEnd().endsWith('*/')) continue
    const docLines = []
    for (let j = i; j >= ceiling; j -= 1) {
      const text = lines[j].trim().replace(/^\*+\s?/, '').replace(/\/\*\*?\s?/, '')
      if (text) docLines.unshift(text)
      if (lines[j].includes('/**')) break
    }
    return docLines[0] ?? ''
  }
  return ''
}

function docFromHashBlock(lines, symbolLine) {
  const docLines = []
  for (let i = symbolLine - 1; i >= 0; i -= 1) {
    const text = (lines[i] ?? '').trim()
    if (!text.startsWith('#')) break
    docLines.unshift(text.replace(/^#+\s?/, ''))
    if (docLines.length >= 6) break
  }
  return docLines.find((line) => line) ?? ''
}

function collectSymbols(content, file) {
  const patterns = PATTERNS_BY_LANGUAGE.get(file.language)
  if (!patterns) return []
  const lines = toLines(content)
  const isJsLike = ['typescript', 'javascript', 'tsx', 'jsx'].includes(file.language)
  const isComponentFile = /\.(tsx|jsx)$/i.test(file.path)
  const results = []

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (line.trim() === '') continue
    const indent = line.length - line.trimStart().length
    for (const pattern of patterns) {
      const match = pattern.re.exec(line)
      if (!match) continue
      let name = pattern.nameFromFile ? componentNameOf(file.path) : match[1]
      if (!name) break
      let kind = pattern.kind
      if (kind === 'function' && isJsLike && /^use[A-Z]/.test(name)) kind = 'hook'
      if (
        isComponentFile &&
        pattern.exported &&
        (kind === 'function' || kind === 'const') &&
        /^[A-Z]/.test(name)
      ) {
        kind = 'component'
      }
      if (kind === 'function' && pattern.methodWhenIndented && indent > 0) kind = 'method'
      results.push({
        name,
        kind,
        path: file.path,
        line: index + 1,
        endLine: endLineOf(lines, index, indent, file.language),
      })
      break
    }
  }
  return results
}

/**
 * Guess where a definition block ends: the matching closing brace at the same
 * indentation for brace languages, the first dedented line for Python.
 */
function endLineOf(lines, startIndex, indent, language) {
  if (language === 'python') {
    for (let index = startIndex + 1; index < lines.length; index++) {
      const line = lines[index]
      if (line.trim() === '') continue
      const lineIndent = line.length - line.trimStart().length
      if (lineIndent <= indent) return index
    }
    return startIndex + 1
  }
  for (let index = startIndex + 1; index < lines.length; index++) {
    const line = lines[index]
    const trimmed = line.trim()
    if (trimmed === '') continue
    const lineIndent = line.length - line.trimStart().length
    if (lineIndent === indent && (trimmed.startsWith('}') || trimmed.startsWith(')'))) {
      return index + 1
    }
  }
  return startIndex + 1
}

/* ------------------------------------------------------------------ */
/* routes                                                             */
/* ------------------------------------------------------------------ */

function collectRoutes(content, file) {
  const lines = toLines(content)
  const routes = []
  const isPython = file.language === 'python'
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (line.trim() === '') continue
    if (isPython) {
      const method = PY_ROUTE_RE.exec(line)
      if (method) {
        routes.push({
          method: method[2].toUpperCase(),
          path: method[4],
          file: file.path,
          line: index + 1,
        })
        continue
      }
      const decorator = PY_ROUTE_DECORATOR_RE.exec(line)
      if (decorator) {
        routes.push({
          method: pythonRouteMethod(lines, index, decorator[4]),
          path: decorator[3],
          file: file.path,
          line: index + 1,
        })
      }
      continue
    }
    const match = JS_ROUTE_RE.exec(line)
    if (!match) continue
    const verb = match[1].toUpperCase()
    routes.push({
      method: verb,
      path: match[3],
      file: file.path,
      line: index + 1,
    })
  }
  return routes
}

/** `@app.route('/x')` defaults to GET unless a `methods=` list is present. */
function pythonRouteMethod(lines, index, tail) {
  const window = [tail, lines[index + 1] ?? '', lines[index + 2] ?? ''].join(' ')
  const explicit = /methods\s*=\s*\[([^\]]*)\]/i.exec(window)
  if (!explicit) return 'GET'
  const first = /['"]([A-Za-z]+)['"]/.exec(explicit[1])
  return first ? first[1].toUpperCase() : 'GET'
}

/* ------------------------------------------------------------------ */
/* config keys                                                        */
/* ------------------------------------------------------------------ */

function collectConfigKeys(content, file) {
  const lines = toLines(content)
  const found = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (line.trim() === '') continue
    for (const pattern of CONFIG_KEY_PATTERNS) {
      pattern.lastIndex = 0
      let match = pattern.exec(line)
      while (match) {
        found.push({ key: match[1], file: file.path, line: index + 1 })
        match = pattern.exec(line)
      }
    }
  }
  return found
}

/* ------------------------------------------------------------------ */
/* manifests                                                          */
/* ------------------------------------------------------------------ */

async function collectDependencies(allFiles, readMeta, warnings) {
  const dependencies = []

  const packageJson = pickManifest(allFiles, ['package.json'])
  if (packageJson) {
    const text = await readMeta(packageJson.path)
    if (text !== null) {
      const parsed = parsePackageJson(text)
      if (parsed.error) {
        warnings.push(`Could not parse "${packageJson.path}": ${parsed.error}`)
      } else {
        for (const [name, version] of parsed.dependencies) {
          dependencies.push({ name, version: String(version), scope: 'runtime', source: packageJson.path })
        }
        for (const [name, version] of parsed.devDependencies) {
          dependencies.push({ name, version: String(version), scope: 'dev', source: packageJson.path })
        }
      }
    }
  }

  const requirements = pickManifest(allFiles, ['requirements.txt'])
  if (requirements) {
    const text = await readMeta(requirements.path)
    if (text !== null) {
      for (const entry of parseRequirements(text)) {
        dependencies.push({ ...entry, scope: 'runtime', source: requirements.path })
      }
    }
  }

  const pyproject = pickManifest(allFiles, ['pyproject.toml'])
  if (pyproject) {
    const text = await readMeta(pyproject.path)
    if (text !== null) {
      for (const entry of parsePyproject(text)) {
        dependencies.push({ ...entry, scope: 'runtime', source: pyproject.path })
      }
    }
  }

  const goMod = pickManifest(allFiles, ['go.mod'])
  if (goMod) {
    const text = await readMeta(goMod.path)
    if (text !== null) {
      for (const entry of parseGoMod(text)) {
        dependencies.push({ ...entry, scope: 'runtime', source: goMod.path })
      }
    }
  }

  const cargo = pickManifest(allFiles, ['Cargo.toml'])
  if (cargo) {
    const text = await readMeta(cargo.path)
    if (text !== null) {
      for (const entry of parseCargoToml(text)) {
        dependencies.push({ ...entry, source: cargo.path })
      }
    }
  }

  dependencies.sort((a, b) => {
    if (a.source !== b.source) return a.source < b.source ? -1 : 1
    if (a.name !== b.name) return a.name < b.name ? -1 : 1
    return a.scope < b.scope ? -1 : a.scope > b.scope ? 1 : 0
  })
  return dependencies
}

async function collectScripts(allFiles, readMeta, warnings) {
  const packageJson = pickManifest(allFiles, ['package.json'])
  if (!packageJson) return []
  const text = await readMeta(packageJson.path)
  if (text === null) return []
  const parsed = parsePackageJson(text)
  if (parsed.error) {
    warnings.push(`Could not parse "${packageJson.path}": ${parsed.error}`)
    return []
  }
  return parsed.scripts.map(([name, command]) => ({
    name,
    command: String(command),
    file: packageJson.path,
  }))
}

function parsePackageJson(text) {
  try {
    const data = JSON.parse(text)
    const asObject = (value) =>
      value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : []
    return {
      dependencies: asObject(data?.dependencies),
      devDependencies: asObject(data?.devDependencies),
      scripts: asObject(data?.scripts),
      error: '',
    }
  } catch (error) {
    return { dependencies: [], devDependencies: [], scripts: [], error: errorMessage(error) }
  }
}

/** `name>=1.0`, `name[extra]==1.0`, `name` -> name + raw version spec. */
function splitRequirement(entry) {
  const match = /^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(\[[^\]]*\])?\s*(.*)$/.exec(entry.trim())
  if (!match) return null
  const version = match[3].trim()
  return { name: match[1], version: version === '' ? '' : version }
}

function parseRequirements(text) {
  const entries = []
  for (const raw of toLines(text)) {
    const line = raw.replace(/#.*$/, '').trim()
    if (line === '' || line.startsWith('-')) continue
    const parsed = splitRequirement(line)
    if (parsed) entries.push(parsed)
  }
  return entries
}

function parsePyproject(text) {
  const entries = []
  const arrayRe = /dependencies\s*=\s*\[([^\]]*)\]/g
  let match = arrayRe.exec(text)
  while (match) {
    const items = /['"]([^'"]+)['"]/g
    let item = items.exec(match[1])
    while (item) {
      const parsed = splitRequirement(item[1])
      if (parsed) entries.push(parsed)
      item = items.exec(match[1])
    }
    match = arrayRe.exec(text)
  }
  return entries
}

function parseGoMod(text) {
  const entries = []
  const blockRe = /require\s*\(([^)]*)\)/g
  let block = blockRe.exec(text)
  while (block) {
    for (const raw of block[1].split('\n')) {
      const line = raw.replace(/\/\/.*$/, '').trim()
      if (line === '') continue
      const parts = line.split(/\s+/)
      if (parts.length >= 2) entries.push({ name: parts[0], version: parts[1] })
    }
    block = blockRe.exec(text)
  }
  const singleRe = /^[ \t]*require[ \t]+([^\s(][^\s]*)[ \t]+([^\s]+)[ \t]*(?:\/\/.*)?$/gm
  let single = singleRe.exec(text)
  while (single) {
    entries.push({ name: single[1], version: single[2] })
    single = singleRe.exec(text)
  }
  return entries
}

function parseCargoToml(text) {
  const entries = []
  let section = ''
  for (const raw of toLines(text)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1).trim()
      continue
    }
    const isDev = section === 'dev-dependencies' || section === 'dev_dependencies'
    const isRuntime = section === 'dependencies'
    if (!isDev && !isRuntime) continue
    const match = /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/.exec(line)
    if (!match) continue
    const inline = /version\s*=\s*['"]([^'"]*)['"]/.exec(match[2])
    const plain = /^['"]([^'"]*)['"]/.exec(match[2].trim())
    const version = inline ? inline[1] : plain ? plain[1] : ''
    entries.push({ name: match[1], version, scope: isDev ? 'dev' : 'runtime' })
  }
  return entries
}

/* ------------------------------------------------------------------ */
/* docs                                                               */
/* ------------------------------------------------------------------ */

async function collectDocs(docPaths, readMeta, warnings) {
  const docs = []
  const paths = (Array.isArray(docPaths) ? docPaths : [])
    .map((entry) => (typeof entry === 'string' ? entry : String(entry?.path ?? '')))
    .filter((entry) => entry !== '')
  for (const docPath of [...new Set(paths)].sort()) {
    const text = await readMeta(docPath)
    if (text === null) {
      docs.push({ path: docPath, title: baseNameOf(docPath), lines: 0 })
      continue
    }
    const titleMatch = /^#\s+(.+)$/m.exec(text)
    docs.push({
      path: docPath,
      title: titleMatch ? titleMatch[1].trim() : baseNameOf(docPath),
      lines: countLines(text),
    })
  }
  return docs
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

function ensureModule(state, modulePath) {
  if (directoryDepth(modulePath) > MAX_MODULE_DEPTH) return null
  let module = state.get(modulePath)
  if (!module) {
    module = {
      path: modulePath,
      files: [],
      loc: 0,
      topLevel: !modulePath.includes('/'),
      names: new Set(),
    }
    state.set(modulePath, module)
  }
  return module
}

/** Pick the most relevant manifest: root level first, then shallowest path. */
function pickManifest(files, names) {
  const candidates = []
  for (const entry of files) {
    if (!entry) continue
    const relPath = typeof entry === 'string' ? entry : String(entry.path ?? '')
    if (relPath === '') continue
    if (!names.includes(fileNameOf(relPath))) continue
    candidates.push(relPath)
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    const depth = directoryDepth(a) - directoryDepth(b)
    if (depth !== 0) return depth
    return byPath(a, b)
  })
  return { path: candidates[0] }
}

function countNonEmptyLines(content) {
  let count = 0
  for (const line of toLines(content)) {
    if (line.trim() !== '') count += 1
  }
  return count
}

function componentNameOf(relPath) {
  return baseNameOf(relPath)
}

function baseNameOf(relPath) {
  const normalized = String(relPath ?? '').split('\\').join('/')
  const base = normalized.split('/').pop() ?? ''
  const index = base.lastIndexOf('.')
  return index > 0 ? base.slice(0, index) : base
}

/** The file name of a path, extension included (`package.json`). */
function fileNameOf(relPath) {
  const normalized = String(relPath ?? '').split('\\').join('/')
  return normalized.split('/').pop() ?? ''
}

function directoryOf(relPath) {
  const normalized = String(relPath ?? '').split('\\').join('/')
  const index = normalized.lastIndexOf('/')
  return index <= 0 ? '' : normalized.slice(0, index)
}

function directoryDepth(relPath) {
  const normalized = String(relPath ?? '').split('\\').join('/').replace(/^\/+|\/+$/g, '')
  if (normalized === '') return 0
  return normalized.split('/').length
}

function byPath(a, b) {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
}

function errorMessage(error) {
  if (!error) return 'unknown error'
  return String(error.message ?? error)
}
