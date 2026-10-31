/**
 * Shared, dependency-free helpers for the CodeMap plugin.
 *
 * The plugin intentionally ships zero third-party runtime dependencies: it must
 * install into a DSH profile without a registry round-trip and without a build
 * step. Everything here is therefore plain ESM over `node:*` built-ins only.
 */
import { createHash } from 'node:crypto'

/** Normalize a native path to forward slashes so output stays portable. */
export function toPosix(value) {
  return String(value).split('\\').join('/')
}

/** Stable content hash used for page freshness (`sha256:<hex>`). */
export function hashText(text) {
  return `sha256:${createHash('sha256').update(String(text), 'utf8').digest('hex')}`
}

/**
 * Hash a set of inputs (path + content) into one digest.
 * @param {Array<{ path: string, content: string }>} entries
 */
export function hashEntries(entries) {
  const hash = createHash('sha256')
  for (const entry of [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    hash.update(entry.path)
    hash.update('\u0000')
    hash.update(entry.content)
    hash.update('\u0000')
  }
  return `sha256:${hash.digest('hex')}`
}

/** Turn a human title into a stable lowercase slug. */
export function slugify(text, fallback = 'page') {
  const slug = String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.length > 0 ? slug : fallback
}

/** Number of lines in a text blob (an empty blob has zero lines). */
export function countLines(text) {
  if (!text) return 0
  return String(text).split('\n').length
}

/** Split a text blob into lines without keeping the trailing empty element. */
export function toLines(text) {
  if (!text) return []
  const lines = String(text).split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

export function clamp(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return min
  return Math.min(Math.max(number, min), max)
}

export function nowIso() {
  return new Date().toISOString()
}

export function uniq(values) {
  return [...new Set(values)]
}

/** Truncate a single-line snippet for search results. */
export function snippet(text, max = 160) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

/** Join path segments with forward slashes. */
export function joinPosix(...parts) {
  return parts
    .filter((part) => part !== undefined && part !== null && part !== '')
    .map((part) => toPosix(part).replace(/^\/+|\/+$/g, ''))
    .filter((part) => part.length > 0)
    .join('/')
}

/** Resolve a POSIX-ish relative path against a POSIX base. */
export function resolvePosix(base, relative) {
  const baseParts = toPosix(base).split('/').filter((part) => part.length > 0)
  const relParts = toPosix(relative).split('/').filter((part) => part.length > 0)
  const parts = [...baseParts]
  for (const part of relParts) {
    if (part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/')
}

/** True when `child` is inside `parent` (both POSIX paths). */
export function containsPath(parent, child) {
  const normalizedParent = toPosix(parent).replace(/\/+$/, '')
  const normalizedChild = toPosix(child)
  if (normalizedChild === normalizedParent) return true
  return normalizedChild.startsWith(`${normalizedParent}/`)
}
