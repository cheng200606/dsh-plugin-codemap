import { promises as fsp } from 'node:fs'
import { dirname, join, resolve as resolvePath, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
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
      await writeFile(absolute, content, 'utf8')
      return { operation: before === null ? 'create' : 'update', version: Date.now(), before, after: content }
    },
  }
}

const root = await mkdtemp(join(tmpdir(), 'rw-debug-'))
await mkdir(join(root, 'src'), { recursive: true })
await writeFile(join(root, 'package.json'), '{"name":"x"}', 'utf8')
await writeFile(join(root, 'src', 'a.js'), 'export const a = 1\n', 'utf8')

const ctx = {
  fs: createFakeFs(),
  tools: { register: () => () => {} },
  get: (name) => (name === 'workingDirectory' ? { defaultDirectory: root, get: () => root } : undefined),
  provide: () => () => {},
  effect: (fn) => fn(),
  logger: { info() {}, warn() {}, error() {}, debug() {} },
}
const service = new CodeMapService(ctx, {})
console.log('config', service.config)
const generated = await service.generate({ root, mode: 'full', language: 'zh' })
console.log('generated', JSON.stringify({ pagesWritten: generated.pagesWritten, pagesFailed: generated.pagesFailed, citations: generated.citations }, null, 2))
console.log('warnings', generated.warnings)
const base = join(root, '.dsh', 'codemap')
console.log('base exists', await fsp.stat(base).then((s) => s.isDirectory(), () => false))
console.log('base listing', await fsp.readdir(base))
const listed = await service.fs.listDir(base)
console.log('adapter listing', listed)
const exported = await service.exportWiki(root, 'qoder')
console.log('exported', exported)
console.log('qoder listing', await fsp.readdir(join(root, '.qoder', 'codemap')).catch((e) => e.message))
await rm(root, { recursive: true, force: true })
