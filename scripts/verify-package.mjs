/**
 * Install the packed tarball into a clean directory and boot the plugin.
 *
 * This is the community-install rehearsal: it proves that the published
 * artifact (not the working tree) contains everything the host needs —
 * entry point, client bundle, locale files, patch row and icon — and that the
 * plugin registers its service, tools, command and prompt section from that
 * artifact alone.
 *
 * Usage: node scripts/verify-package.mjs
 */
import { exec } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

// Windows resolves `npm` through `npm.cmd`, which needs a shell.
const run = (command, args = [], options = {}) =>
  promisify(exec)([command, ...args.map((arg) => `"${arg}"`)].join(' '), options)
const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`)
  if (!ok) failures.push(name)
}

// 1. Pack.
const workspace = await mkdtemp(join(tmpdir(), 'codemap-pack-'))
const { stdout: packOut } = await run('npm', ['pack', '--pack-destination', workspace], { cwd: root })
const tarball = packOut.trim().split('\n').pop().trim()
const tarballPath = join(workspace, tarball)
check('npm pack produces a tarball', Boolean(tarball) && tarball.endsWith('.tgz'), tarball)

// 2. Install it into a clean consumer project.
const consumer = await mkdtemp(join(tmpdir(), 'codemap-consumer-'))
await writeFile(
  join(consumer, 'package.json'),
  `${JSON.stringify({ name: 'codemap-consumer', private: true, version: '0.0.0' }, null, 2)}\n`,
)
await run('npm', ['install', '--no-audit', '--no-fund', tarballPath], { cwd: consumer })
const installed = join(consumer, 'node_modules', 'dsh-plugin-codemap')
check('the package installs', await exists(join(installed, 'index.js')))

// 3. Every file the host needs is inside the artifact.
for (const file of ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'package.json', 'locale/zh.json', 'locale/en.json']) {
  check(`artifact contains ${file}`, await exists(join(installed, file)))
}
check('artifact contains src/', await exists(join(installed, 'src', 'service.js')))
check('artifact contains client sources', await exists(join(installed, 'client', '00-preamble.js')))

// 4. The manifest is still coherent after packing.
const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'))
check('manifest keeps the bundle patch row', manifest?.dsh?.bundle?.patch === './cordis.patch.yml')
check('manifest keeps the web client platform', manifest?.dsh?.client?.platform === 'web')
check('manifest declares the market keywords', (manifest?.keywords ?? []).includes('dsh-plugin'))
check('manifest is publishable', manifest?.private !== true)
check('patch row id matches the package name', (await readFile(join(installed, 'cordis.patch.yml'), 'utf8')).includes('name: \'dsh-plugin-codemap\''))

// 5. Boot the plugin from the installed artifact with a fake host context.
const { apply } = await import(pathToFileURL(join(installed, 'index.js')).href)
const registered = { tools: [], commands: [], prompts: [] }
const services = new Map()
const fsStub = {
  resolve: (path) => ({ targetKey: path, displayPath: path }),
  stat: async () => ({ type: 'directory', size: 0 }),
  readText: async () => '',
  listDir: async () => [],
  writeText: async () => {},
  processPath: (target) => target.targetKey,
}
const toolsStub = { register: (tool) => { registered.tools.push(tool.name); return () => {} } }
const commandsStub = { register: (command) => { registered.commands.push(command); return () => {} } }
const systemPromptStub = {
  section: (section) => { registered.prompts.push(section); return () => {} },
  getSectionOrder: () => 0,
}
const ctx = {
  fs: fsStub,
  tools: toolsStub,
  commands: commandsStub,
  systemPrompt: systemPromptStub,
  get: (name) => {
    if (name === 'fs') return fsStub
    if (name === 'tools') return toolsStub
    if (name === 'commands') return commandsStub
    if (name === 'systemPrompt') return systemPromptStub
    return undefined
  },
  provide: (key, value) => { services.set(key, value); return () => {} },
  inject: () => () => {},
  effect: (fn) => fn(),
  logger: { warn: () => {}, info: () => {} },
}
apply(ctx, { outputDir: '.dsh/codemap' })
check('the service is provided', services.has('codeMap'))
check('four model tools are registered', registered.tools.length === 4, registered.tools.join(','))
check('the slash command is registered', registered.commands[0]?.name === 'codemap')
check('the prompt section is registered', registered.prompts[0]?.name === 'codemap:policy')

// 6. The browser bundle in the artifact is syntactically valid.
const bundle = await readFile(join(installed, 'client.js'), 'utf8')
let bundleOk = true
try {
  // eslint-disable-next-line no-new-func
  new Function(bundle)
} catch {
  bundleOk = false
}
check('the client bundle compiles', bundleOk)
check('the client bundle carries the version', bundle.includes(manifest.version))

await rm(workspace, { recursive: true, force: true })
await rm(consumer, { recursive: true, force: true })

console.log(failures.length === 0 ? '\nPackage verification passed.' : `\n${failures.length} package check(s) failed.`)
process.exit(failures.length === 0 ? 0 : 1)

async function exists(path) {
  try {
    await readFile(path)
    return true
  } catch {
    try {
      const { stat } = await import('node:fs/promises')
      return Boolean(await stat(path))
    } catch {
      return false
    }
  }
}
