/**
 * Coverage probe: generate the wiki for a real repository and report how many
 * distinct source files end up cited by the generated pages.
 *
 * Usage: node test/probe-coverage.mjs [root]
 */
import { promises as fsp } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { CodeMapService } from '../index.js'

function createFakeFs() {
  return {
    async resolve(path, options = {}) {
      const cwd = options.cwd ?? process.cwd()
      const absolute = resolvePath(cwd, path)
      return { targetKey: absolute, displayPath: absolute }
    },
    processPath: (t) => t.targetKey,
    fileUrl: (t) => `file:///${t.targetKey.replace(/\\/g, '/')}`,
    contains: () => true,
    async stat(target) {
      try {
        const info = await fsp.stat(target.targetKey)
        return { version: info.mtimeMs, type: info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'other', size: info.size }
      } catch { return undefined }
    },
    async readText(target) { return fsp.readFile(target.targetKey, 'utf8') },
    async listDir(target) {
      const entries = await fsp.readdir(target.targetKey, { withFileTypes: true })
      return Promise.all(entries.map(async (entry) => {
        const child = join(target.targetKey, entry.name)
        const info = entry.isFile() ? await fsp.stat(child) : null
        return { name: entry.name, type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other', target: { targetKey: child }, size: info?.size }
      }))
    },
    async writeText(target, content) {
      const absolute = target.targetKey
      await mkdir(dirname(absolute), { recursive: true })
      const before = await fsp.readFile(absolute, 'utf8').catch(() => null)
      await fsp.writeFile(absolute, content, 'utf8')
      return { operation: before === null ? 'create' : 'update', version: Date.now(), before, after: content }
    },
  }
}

const root = resolvePath(process.argv[2] ?? process.cwd())
const ctx = {
  fs: createFakeFs(),
  tools: { register: () => () => {} },
  get: (name) => (name === 'workingDirectory' ? { defaultDirectory: root, get: () => root } : undefined),
  provide: () => () => {},
  effect: (fn) => fn(),
  logger: { info() {}, warn() {}, error() {}, debug() {} },
}
const service = new CodeMapService(ctx, {})
const result = await service.generate({ root, mode: 'full', language: 'zh' })
const meta = JSON.parse(await fsp.readFile(join(root, '.dsh', 'codemap', 'meta', 'codemap.json'), 'utf8'))

const cited = new Set()
for (const page of meta.pages) for (const citation of page.citations ?? []) cited.add(citation.path)

console.log('run', result.runId, 'pages', result.pagesWritten, 'citations', result.citations)
console.log('warnings', result.warnings)
console.log('--- per page ---')
for (const page of meta.pages) {
  const files = new Set((page.citations ?? []).map((c) => c.path))
  console.log(
    String(page.id).padEnd(16),
    String(page.status).padEnd(13),
    String(page.confidence).padEnd(7),
    'citations=' + (page.citations ?? []).length,
    'files=' + files.size,
    'sources=' + (page.sources?.files?.length ?? 0),
  )
}
console.log('--- totals ---')
console.log('distinct cited files', cited.size)
console.log([...cited].sort().join('\n'))
const scanned = meta.repo.fileCount
console.log('scanned files', scanned, 'loc', meta.repo.loc)
