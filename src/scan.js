/**
 * Repository scanning for the CodeMap plugin.
 *
 * The scanner walks a repository through the host `fs` adapter (never
 * `node:fs`), applies ignore + secret rules, and produces a compact
 * `RepoScan` profile that the indexer and the planner build upon.
 *
 * Every path in the returned profile is repo-relative and POSIX formatted;
 * the native absolute path is only kept in the explicit `abs` field.
 */
import path from 'node:path'
import { toPosix, uniq } from './util.js'

/** Directory names skipped at any depth unless the caller overrides them. */
export const DEFAULT_IGNORE_DIRS = [
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  'coverage',
  '.next',
  '.nuxt',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.idea',
  '.vscode',
  '.cache',
  'vendor',
  'tmp',
  '.turbo',
  '.parcel-cache',
  'logs',
]

/** File paths that may contain credentials and are therefore never indexed. */
export const SECRET_FILE_PATTERNS = [
  /(^|\/)\.env(\..+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.crt$/i,
  /(^|\/)id_rsa(\.pub)?$/i,
  /(^|\/)secrets?\//i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.netrc$/i,
]

/** Extension -> language id. `tsx`/`jsx` are counted as typescript/javascript. */
const LANGUAGE_BY_EXTENSION = new Map(
  Object.entries({
    ts: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    jsx: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    rb: 'ruby',
    php: 'php',
    cs: 'csharp',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    hpp: 'cpp',
    swift: 'swift',
    kt: 'kotlin',
    sh: 'shell',
    bash: 'shell',
    md: 'markdown',
    mdx: 'markdown',
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'toml',
    html: 'html',
    css: 'css',
    scss: 'css',
    less: 'css',
    sql: 'sql',
    vue: 'vue',
    svelte: 'svelte',
    graphql: 'graphql',
    gql: 'graphql',
    proto: 'proto',
    ipynb: 'notebook',
    txt: 'text',
  }),
)

/** Recognised build / configuration files, matched by basename anywhere. */
const BUILD_FILE_NAMES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'package-lock.json',
  'bun.lockb',
  'tsconfig.json',
  'jsconfig.json',
  'pyproject.toml',
  'requirements.txt',
  'setup.py',
  'setup.cfg',
  'Pipfile',
  'Cargo.toml',
  'go.mod',
  'go.sum',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'Makefile',
  'CMakeLists.txt',
  'Dockerfile',
  'docker-compose.yml',
  'compose.yml',
  '.goreleaser.yaml',
  'deno.json',
  'biome.json',
  'eslint.config.js',
  '.prettierrc',
  'vitest.config.ts',
  'jest.config.js',
  'playwright.config.ts',
  'turbo.json',
  'nx.json',
  'pnpm-workspace.yaml',
])

/** Recognised entry points, matched by repo-relative path. */
const ENTRY_POINT_PATHS = [
  'index.ts',
  'index.js',
  'index.mjs',
  'main.ts',
  'main.js',
  'main.py',
  '__main__.py',
  'app.py',
  'server.py',
  'cli.ts',
  'cli.js',
  'src/main.rs',
  'src/index.ts',
  'src/index.js',
  'src/main.go',
  'index.html',
]

/** Recognised entry points, matched by repo-relative glob. */
const ENTRY_POINT_GLOBS = ['cmd/*/main.go']

/** Maximum number of documentation files reported by a scan. */
const MAX_DOCS = 30

/**
 * True when a repo-relative path looks like it holds credentials.
 * @param {string} relPath
 */
export function isSecretPath(relPath) {
  const normalized = normalizeRel(relPath)
  if (normalized === '') return false
  return SECRET_FILE_PATTERNS.some((pattern) => pattern.test(normalized))
}

/**
 * Build the ignore filter used by {@link scanRepository}.
 *
 * Three layers are applied, in this order:
 *   1. the plugin output directory (always ignored),
 *   2. gitignore-style patterns (`extraIgnores` + `gitignore`), where the last
 *      matching rule wins and a `!` rule re-includes a path — these take
 *      precedence over the default directory list,
 *   3. the default ignore directory names, matched at any depth.
 *
 * Supported gitignore-style syntax: exact names, `*.ext` globs, `path/`
 * directory prefixes and double-star path patterns (`**` followed by `/name`).
 *
 * @param {{ ignoreDirs?: string[], extraIgnores?: string[], gitignore?: string[], outputDir?: string }} [options]
 */
export function createIgnoreFilter(options = {}) {
  const {
    ignoreDirs = DEFAULT_IGNORE_DIRS,
    extraIgnores = [],
    gitignore = [],
    outputDir = '.dsh/codemap',
  } = options ?? {}

  const ignoreDirNames = new Set(
    toStringArray(ignoreDirs)
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
  const rules = []
  for (const pattern of [...toStringArray(extraIgnores), ...toStringArray(gitignore)]) {
    const rule = compileIgnoreRule(pattern)
    if (rule) rules.push(rule)
  }
  const outputPath = normalizeRel(outputDir)

  /** @param {string} relDir @param {boolean} isDir */
  const applyRules = (relPath, isDir) => {
    let decision = null
    for (const rule of rules) {
      if (rule.matches(relPath, isDir)) decision = !rule.negated
    }
    return decision
  }

  const isOutputPath = (relPath) =>
    outputPath !== '' && (relPath === outputPath || relPath.startsWith(`${outputPath}/`))

  /** @param {string} relDir repo-relative directory path */
  const ignoresDir = (relDir) => {
    const normalized = normalizeRel(relDir)
    if (normalized === '') return false
    if (isOutputPath(normalized)) return true
    const decision = applyRules(normalized, true)
    if (decision !== null) return decision
    return hasIgnoredSegment(normalized, ignoreDirNames, true)
  }

  /** @param {string} relPath repo-relative file path */
  const ignoresFile = (relPath) => {
    const normalized = normalizeRel(relPath)
    if (normalized === '') return false
    if (isOutputPath(normalized)) return true
    const decision = applyRules(normalized, false)
    if (decision !== null) return decision
    return hasIgnoredSegment(normalized, ignoreDirNames, false)
  }

  /** Alias of {@link ignoresFile}; secret detection stays a separate concern. */
  const isIgnored = (relPath) => ignoresFile(relPath)

  return { ignoresDir, ignoresFile, isIgnored }
}

/**
 * Detect the language of a repo-relative path by its extension.
 * Unknown extensions (and files without extension) map to `other`.
 * @param {string} relPath
 * @returns {string}
 */
export function detectLanguageByPath(relPath) {
  const ext = extensionOf(relPath)
  if (ext === '') return 'other'
  return LANGUAGE_BY_EXTENSION.get(ext) ?? 'other'
}

/**
 * Walk a repository and build the compact scan profile.
 *
 * @param {object} fs - the host fs adapter (`readFile`/`listDir`/`stat`/`exists`)
 * @param {string} root - repository root (absolute or relative to the cwd)
 * @param {{ maxFiles?: number, maxFileBytes?: number, ignoreDirs?: string[], extraIgnores?: string[], gitignore?: string[], outputDir?: string, signal?: AbortSignal }} [options]
 * @returns {Promise<object>} the `RepoScan` profile
 */
export async function scanRepository(fs, root, options = {}) {
  const {
    maxFiles = 8000,
    maxFileBytes = 524288,
    ignoreDirs = DEFAULT_IGNORE_DIRS,
    extraIgnores = [],
    gitignore = [],
    outputDir = '.dsh/codemap',
    signal,
  } = options ?? {}

  if (!fs || typeof fs.listDir !== 'function') {
    throw new Error('codemap: scanRepository requires the fs adapter')
  }

  const absoluteRoot = path.resolve(String(root ?? '.'))
  const filter = createIgnoreFilter({ ignoreDirs, extraIgnores, gitignore, outputDir })

  const warnings = []
  const files = []
  let skippedFiles = 0
  let skippedDirectories = 0
  let skippedIrregular = 0
  let secretFiles = 0
  let oversizedFiles = 0
  let truncated = false

  const walk = async (relDir, absDir) => {
    if (truncated) return
    let entries = []
    try {
      entries = await fs.listDir(absDir, signal)
    } catch (error) {
      warnings.push(`Could not read directory "${relDir || '.'}": ${errorMessage(error)}`)
      return
    }
    const sorted = (Array.isArray(entries) ? entries : [])
      .filter((entry) => entry && typeof entry.name === 'string' && entry.name !== '.' && entry.name !== '..')
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

    for (const entry of sorted) {
      if (truncated) return
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name
      const absPath = path.join(absDir, entry.name)

      if (entry.type === 'directory') {
        if (filter.ignoresDir(relPath)) {
          skippedDirectories += 1
          continue
        }
        await walk(relPath, absPath)
        continue
      }

      let size = typeof entry.size === 'number' && Number.isFinite(entry.size) ? entry.size : undefined
      if (entry.type !== 'file') {
        // Symlinks and other irregular entries are only kept when they stat as
        // a regular file; symlinked directories are never followed.
        const info = await safeStat(fs, absPath, signal)
        if (!info || info.type !== 'file') {
          skippedIrregular += 1
          continue
        }
        size = typeof info.size === 'number' ? info.size : 0
      }

      if (filter.ignoresFile(relPath)) {
        skippedFiles += 1
        continue
      }
      if (isSecretPath(relPath)) {
        skippedFiles += 1
        secretFiles += 1
        continue
      }
      if (files.length >= maxFiles) {
        truncated = true
        return
      }
      if (size === undefined) {
        const info = await safeStat(fs, absPath, signal)
        if (!info) {
          skippedFiles += 1
          continue
        }
        size = typeof info.size === 'number' ? info.size : 0
      }
      if (size > maxFileBytes) {
        skippedFiles += 1
        oversizedFiles += 1
        continue
      }

      const ext = extensionOf(relPath)
      files.push({
        path: relPath,
        abs: absPath,
        size,
        ext,
        language: detectLanguageByPath(relPath),
      })
    }
  }

  await walk('', absoluteRoot)
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

  const totalFiles = files.length
  const languages = {}
  for (const file of files) {
    languages[file.language] = (languages[file.language] ?? 0) + 1
  }
  const sortedLanguages = {}
  for (const language of Object.keys(languages).sort()) sortedLanguages[language] = languages[language]

  const languageShares = {}
  if (totalFiles > 0) {
    for (const language of Object.keys(sortedLanguages)) {
      languageShares[language] = Math.round((sortedLanguages[language] / totalFiles) * 1000) / 1000
    }
  }

  const buildFiles = files
    .filter((file) => BUILD_FILE_NAMES.has(basenameOf(file.path)))
    .map((file) => file.path)
    .sort()

  const entryPoints = files
    .filter((file) => isEntryPoint(file.path))
    .map((file) => file.path)
    .sort()

  const docs = files
    .filter((file) => file.language === 'markdown' && directoryDepth(file.path) <= 1)
    .map((file) => file.path)
    .sort()
    .slice(0, MAX_DOCS)

  if (skippedDirectories > 0) {
    warnings.push(`Skipped ${skippedDirectories} ignored ${skippedDirectories === 1 ? 'directory' : 'directories'}.`)
  }
  if (secretFiles > 0) {
    warnings.push(`Skipped ${secretFiles} secret-like ${secretFiles === 1 ? 'file' : 'files'} (for example .env, *.pem, private keys).`)
  }
  if (oversizedFiles > 0) {
    warnings.push(`Skipped ${oversizedFiles} ${oversizedFiles === 1 ? 'file' : 'files'} larger than ${maxFileBytes} bytes.`)
  }
  if (skippedIrregular > 0) {
    warnings.push(`Skipped ${skippedIrregular} symlinked or non-regular ${skippedIrregular === 1 ? 'entry' : 'entries'}.`)
  }
  if (truncated) {
    warnings.push(`File limit of ${maxFiles} reached: the repository scan was truncated.`)
  }
  if (totalFiles === 0) {
    warnings.push('No files were found in the repository.')
  }

  return {
    root: absoluteRoot,
    files,
    totalFiles,
    skippedFiles,
    truncated,
    languages: sortedLanguages,
    languageShares,
    buildFiles,
    entryPoints,
    docs,
    warnings: uniq(warnings),
  }
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Collect the cheap change signature of a repository.
 *
 * The signature summarises the candidate file set — count, total size and
 * total change token — with the same ignore and secret rules the full scan
 * applies. It never reads a file's content: sizes come from the directory
 * listing, and a file is only `stat`ed when the listing does not carry a
 * size, which is far cheaper than reading the text.
 *
 * The scanner compares this signature against the one stored with the last
 * scan; when they match, the previous scan (and the index built upon it) can
 * be reused as-is.
 *
 * @param {object} fs - the host fs adapter (`listDir`/`stat`)
 * @param {string} root - repository root
 * @param {{ maxFiles?: number, ignoreDirs?: string[], extraIgnores?: string[], gitignore?: string[], outputDir?: string, signal?: AbortSignal }} [options]
 * @returns {Promise<string|null>} the signature, or `null` when the
 *   environment cannot produce a meaningful one (no fs adapter).
 */
export async function collectScanSignature(fs, root, options = {}) {
  const {
    maxFiles = 8000,
    ignoreDirs = DEFAULT_IGNORE_DIRS,
    extraIgnores = [],
    gitignore = [],
    outputDir = '.dsh/codemap',
    signal,
  } = options ?? {}

  if (!fs || typeof fs.listDir !== 'function') return null

  const absoluteRoot = path.resolve(String(root ?? '.'))
  const filter = createIgnoreFilter({ ignoreDirs, extraIgnores, gitignore, outputDir })

  let count = 0
  let totalSize = 0
  let totalVersion = 0
  let truncated = false

  const walk = async (relDir, absDir) => {
    if (truncated) return
    let entries = []
    try {
      entries = await fs.listDir(absDir, signal)
    } catch {
      // An unreadable directory contributes nothing to the signature; the
      // full scan reports the warning when it really walks the tree.
      return
    }
    const sorted = (Array.isArray(entries) ? entries : [])
      .filter((entry) => entry && typeof entry.name === 'string' && entry.name !== '.' && entry.name !== '..')
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

    for (const entry of sorted) {
      if (truncated) return
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name
      const absPath = path.join(absDir, entry.name)

      if (entry.type === 'directory') {
        if (filter.ignoresDir(relPath)) continue
        await walk(relPath, absPath)
        continue
      }
      // The signature tracks regular files only: the rare irregular entries
      // that the full scan stats and keeps are not worth a stat here, and
      // treating them uniformly keeps the signature stable.
      if (entry.type !== 'file') continue
      if (filter.ignoresFile(relPath) || isSecretPath(relPath)) continue
      if (count >= maxFiles) {
        truncated = true
        return
      }

      let size = typeof entry.size === 'number' && Number.isFinite(entry.size) ? entry.size : null
      let version = typeof entry.version === 'number' && Number.isFinite(entry.version) ? entry.version : null
      if (size === null || version === null) {
        const info = await safeStat(fs, absPath, signal)
        if (!info) continue
        if (size === null) size = typeof info.size === 'number' ? info.size : 0
        if (version === null) version = typeof info.version === 'number' ? info.version : 0
      }
      count += 1
      totalSize += size
      totalVersion += version
    }
  }

  await walk('', absoluteRoot)
  return `v1:${count}:${totalSize}:${totalVersion}:${truncated ? 't' : 'f'}`
}

function toStringArray(value) {
  if (Array.isArray(value)) return value.filter((entry) => entry !== null && entry !== undefined)
  if (typeof value === 'string') return [value]
  return []
}

function normalizeRel(value) {
  return toPosix(String(value ?? ''))
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

function basenameOf(relPath) {
  const normalized = normalizeRel(relPath)
  if (normalized === '') return ''
  const index = normalized.lastIndexOf('/')
  return index === -1 ? normalized : normalized.slice(index + 1)
}

function directoryDepth(relPath) {
  const normalized = normalizeRel(relPath)
  if (normalized === '') return 0
  return normalized.split('/').length - 1
}

function extensionOf(relPath) {
  const base = basenameOf(relPath)
  const index = base.lastIndexOf('.')
  if (index <= 0) return ''
  return base.slice(index + 1).toLowerCase()
}

function isEntryPoint(relPath) {
  const normalized = normalizeRel(relPath)
  if (ENTRY_POINT_PATHS.includes(normalized)) return true
  return ENTRY_POINT_GLOBS.some((pattern) => globToRegExp(pattern).test(normalized))
}

function hasIgnoredSegment(relPath, ignoreDirNames, isDir) {
  if (ignoreDirNames.size === 0) return false
  const segments = normalizeRel(relPath).split('/')
  const limit = isDir ? segments.length : segments.length - 1
  for (let index = 0; index < limit; index++) {
    if (ignoreDirNames.has(segments[index])) return true
  }
  return false
}

function compileIgnoreRule(rawPattern) {
  const text = String(rawPattern ?? '').trim()
  if (text === '' || text.startsWith('#')) return null
  let body = text
  let negated = false
  if (body.startsWith('!')) {
    negated = true
    body = body.slice(1).trim()
  }
  if (body === '') return null
  const dirOnly = body.endsWith('/')
  if (dirOnly) body = body.replace(/\/+$/, '')
  if (body === '') return null
  const anchored = body.includes('/')
  const regex = globToRegExp(body)
  return {
    negated,
    dirOnly,
    anchored,
    regex,
    pattern: body,
    matches(relPath, isDir) {
      const segments = normalizeRel(relPath).split('/')
      if (this.anchored) {
        for (let index = 1; index <= segments.length; index++) {
          if (this.regex.test(segments.slice(0, index).join('/'))) return true
        }
        return false
      }
      const limit = this.dirOnly && !isDir ? segments.length - 1 : segments.length
      for (let index = 0; index < limit; index++) {
        if (this.regex.test(segments[index])) return true
      }
      return false
    },
  }
}

/** Convert a gitignore-style glob into a regular expression. */
function globToRegExp(pattern) {
  let source = ''
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index]
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        index += 1
        if (pattern[index + 1] === '/') {
          index += 1
          source += '(?:[^/]+/)*'
        } else {
          source += '.*'
        }
      } else {
        source += '[^/]*'
      }
      continue
    }
    if (char === '?') {
      source += '[^/]'
      continue
    }
    source += escapeRegExp(char)
  }
  return new RegExp(`^${source}$`)
}

function escapeRegExp(text) {
  return text.replace(/[.+()[\]{}^$|\\]/g, '\\$&')
}

async function safeStat(fs, absPath, signal) {
  try {
    if (typeof fs.stat !== 'function') return null
    return await fs.stat(absPath, signal)
  } catch {
    return null
  }
}

function errorMessage(error) {
  if (!error) return 'unknown error'
  return String(error.message ?? error)
}
