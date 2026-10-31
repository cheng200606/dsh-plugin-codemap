/**
 * A tiny path-oriented facade over the DSH `fs` service.
 *
 * Every module of this plugin talks to the repository through this adapter
 * instead of `node:fs`, so that reads and writes stay inside the harness
 * filesystem provider (and therefore inside the active sandbox policy).
 *
 * The one unavoidable exception is directory creation: the `fs` service has no
 * `mkdir`, so `writeFile` retries once through `node:fs/promises.mkdir` when the
 * backend reports a missing parent directory.
 */
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { toPosix } from './util.js'

/**
 * @param {object} fs - the host `ctx.fs` service
 * @param {object} [options]
 */
export function createFsAdapter(fs, options = {}) {
  if (!fs || typeof fs.resolve !== 'function') {
    throw new Error('codemap: the fs service is required but unavailable')
  }
  const adapter = {
    /** Resolve an absolute path into a provider target. */
    async resolve(absPath) {
      return fs.resolve(toPosix(absPath), {})
    },
    /** Read a UTF-8 text file; `null` when it does not exist. */
    async readFile(absPath, signal) {
      const target = await adapter.resolve(absPath)
      const info = await fs.stat(target, signal)
      if (!info || info.type !== 'file') return null
      return fs.readText(target, signal)
    },
    /** List the direct children of a directory. */
    async listDir(absPath, signal) {
      const target = await adapter.resolve(absPath)
      const info = await fs.stat(target, signal)
      if (!info || info.type !== 'directory') return []
      const entries = await fs.listDir(target, signal)
      return entries.map((entry) => ({
        name: entry.name,
        type: entry.type,
        size: entry.size,
        // Additive: providers that carry a change token (mtime or version)
        // let the scanner build a reuse signature without a stat per file.
        version: entry.version ?? entry.mtimeMs ?? null,
      }))
    },
    /** Metadata for one path, or `null` when it is absent. */
    async stat(absPath, signal) {
      const target = await adapter.resolve(absPath)
      const info = await fs.stat(target, signal)
      if (!info) return null
      return {
        type: info.type,
        size: info.size,
        // Additive: see `listDir` above.
        version: info.version ?? info.mtimeMs ?? null,
      }
    },
    /** True when the path exists (file or directory). */
    async exists(absPath, signal) {
      const info = await adapter.stat(absPath, signal)
      return info !== null
    },
    /**
     * Atomically write a UTF-8 text file.
     * @param {string} absPath
     * @param {string} content
     * @param {{ workspaceRoot?: string, signal?: AbortSignal }} [writeOptions]
     */
    async writeFile(absPath, content, writeOptions = {}) {
      const target = await adapter.resolve(absPath)
      const policy = writeOptions.workspaceRoot
        ? { mode: 'workspace-write', workspaceRoot: writeOptions.workspaceRoot }
        : undefined
      try {
        await fs.writeText(target, content, undefined, writeOptions.signal, policy)
        return
      } catch (error) {
        if (!isMissingDirectory(error)) throw error
      }
      // The provider has no mkdir: create the parent directory once and retry.
      await mkdir(dirname(absPath), { recursive: true })
      await fs.writeText(target, content, undefined, writeOptions.signal, policy)
    },
    /** The provider's canonical absolute path for a resolved target. */
    processPath(target) {
      return fs.processPath(target)
    },
    /** The provider's file URL for a resolved target. */
    fileUrl(target) {
      return typeof fs.fileUrl === 'function' ? fs.fileUrl(target) : undefined
    },
    /** True when the child path is inside the parent path. */
    contains(parent, child) {
      return typeof fs.contains === 'function' ? fs.contains(parent, child) : false
    },
  }
  return adapter
}

function isMissingDirectory(error) {
  if (!error) return false
  const code = error.code ?? error.name ?? ''
  if (code === 'ENOENT') return true
  const message = String(error.message ?? '')
  return message.includes('ENOENT') || message.includes('no such file or directory')
}
