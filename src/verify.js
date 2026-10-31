/**
 * Citation verification for the CodeMap plugin.
 *
 * A generated page is only trustworthy when every `path:line` reference it
 * contains points at a real line of a real repository file. This module
 * re-reads the referenced files through the filesystem adapter and reports
 * which citations are valid and which are not.
 *
 * The module never throws for a missing or unreadable file: such a citation is
 * simply reported as invalid.
 */
import { join } from 'node:path'
import { toLines } from './util.js'

/** Matches a backticked `path:line` or `path:start-end` citation token. */
export const CITATION_PATTERN = /`([^`\s]+):(\d+)(?:-(\d+))?`/g

/** Default ratio of valid citations required for a page to count as fresh. */
const DEFAULT_THRESHOLD = 0.95

/** Maximum size of a file that is read for line counting (16 MB). */
const MAX_READ_BYTES = 16 * 1024 * 1024

/**
 * Extract every unique citation from a markdown document.
 *
 * @param {string} markdown
 * @returns {Array<{ path: string, startLine: number, endLine: number, raw: string }>}
 */
export function extractCitations(markdown) {
  const text = typeof markdown === 'string' ? markdown : ''
  if (!text) return []
  const pattern = new RegExp(CITATION_PATTERN.source, 'g')
  const found = []
  const seen = new Set()
  let match = pattern.exec(text)
  while (match) {
    const raw = match[0]
    const path = match[1]
    const startLine = Number.parseInt(match[2], 10)
    const endLine = match[3] === undefined ? startLine : Number.parseInt(match[3], 10)
    const key = `${path}:${startLine}-${endLine}`
    if (!seen.has(key)) {
      seen.add(key)
      found.push({ path, startLine, endLine, raw })
    }
    match = pattern.exec(text)
  }
  return found
}

/**
 * Verify every citation of a markdown document against the repository.
 *
 * @param {object} fs - the filesystem adapter
 * @param {string} root - the absolute native path of the repository root
 * @param {string} markdown - the document to check
 * @param {{ signal?: AbortSignal, maxBytes?: number }} [options]
 * @returns {Promise<{ total: number, valid: number, invalid: Array<{ citation: object, reason: string }> }>}
 */
export async function verifyCitations(fs, root, markdown, options = {}) {
  const citations = extractCitations(markdown)
  const invalid = []
  let valid = 0
  const signal = options?.signal
  const cache = new Map()

  for (const citation of citations) {
    const absolute = resolveCitationPath(root, citation.path)
    let lineCount = cache.get(absolute)
    if (lineCount === undefined) {
      const read = await readLineCount(fs, absolute, signal)
      if (read.missing) {
        cache.set(absolute, -1)
        lineCount = -1
      } else {
        cache.set(absolute, read.count)
        lineCount = read.count
      }
    }
    if (lineCount < 0) {
      invalid.push({ citation, reason: 'file-not-found' })
      continue
    }
    if (citation.startLine < 1 || citation.endLine < citation.startLine || citation.endLine > lineCount) {
      invalid.push({ citation, reason: 'line-out-of-range' })
      continue
    }
    valid++
  }

  return { total: citations.length, valid, invalid }
}

/**
 * Verify one page and decide whether it can be published as-is.
 *
 * @param {object} fs - the filesystem adapter
 * @param {string} root - the absolute native path of the repository root
 * @param {{ path?: string, markdown: string }|string} page - the page to check
 * @param {{ threshold?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<{ total: number, valid: number, invalid: Array<object>, status: string, note?: string }>}
 */
export async function verifyPage(fs, root, page, options = {}) {
  const markdown = typeof page === 'string' ? page : String(page?.markdown ?? '')
  const threshold = Number.isFinite(Number(options?.threshold)) ? Number(options.threshold) : DEFAULT_THRESHOLD
  const result = await verifyCitations(fs, root, markdown, options)
  const status = result.total > 0 && result.valid / result.total >= threshold ? 'fresh' : 'needs-review'
  const output = { total: result.total, valid: result.valid, invalid: result.invalid, status }
  if (result.total === 0) output.note = 'no-citations'
  return output
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * Resolve a repo-relative POSIX citation path against the native root.
 *
 * @param {string} root
 * @param {string} path
 * @returns {string}
 */
function resolveCitationPath(root, path) {
  const parts = String(path ?? '')
    .split('/')
    .filter((part) => part !== '' && part !== '.')
  const base = typeof root === 'string' && root ? root : process.cwd()
  return parts.length > 0 ? join(base, ...parts) : join(base)
}

/**
 * Read a file and count its lines.
 *
 * @param {object} fs - the filesystem adapter
 * @param {string} absolutePath
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ count: number, missing: boolean }>}
 */
async function readLineCount(fs, absolutePath, signal) {
  if (!fs || typeof fs.readFile !== 'function') return { count: 0, missing: true }
  try {
    if (typeof fs.stat === 'function') {
      const stat = await fs.stat(absolutePath, signal)
      if (!stat) return { count: 0, missing: true }
      if (Number.isFinite(Number(stat.size)) && Number(stat.size) > MAX_READ_BYTES) {
        // Too large to count precisely: treat it as a valid file so that the
        // citation is judged by its line numbers instead of by size.
        return { count: Number.MAX_SAFE_INTEGER, missing: false }
      }
    }
    const text = await fs.readFile(absolutePath, signal)
    if (typeof text !== 'string') return { count: 0, missing: true }
    return { count: countLines(text), missing: false }
  } catch {
    return { count: 0, missing: true }
  }
}

/**
 * Count the lines of a text.
 *
 * The semantics match `toLines()` from `util.js`: a trailing newline does not
 * create an extra empty line.
 *
 * @param {string} text
 * @returns {number}
 */
function countLines(text) {
  if (typeof text !== 'string' || text.length === 0) return 0
  let newlines = 0
  const chunkSize = 64 * 1024
  for (let offset = 0; offset < text.length; offset += chunkSize) {
    const chunk = text.slice(offset, offset + chunkSize)
    for (let index = 0; index < chunk.length; index++) {
      if (chunk.charCodeAt(index) === 10) newlines++
    }
  }
  return text.endsWith('\n') ? newlines : newlines + 1
}

/** Exported for tests: the reference line counting used by `toLines()`. */
export function referenceLineCount(text) {
  return toLines(text).length
}
