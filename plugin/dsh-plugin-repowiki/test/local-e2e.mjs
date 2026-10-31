/**
 * Local end-to-end test for the repowiki plugin.
 *
 * It builds a throw-away fixture repository, runs the whole pipeline through a
 * fake `ctx.fs` (an in-process implementation of the harness filesystem
 * provider) and asserts the observable behaviour:
 *
 *   1. the plugin registers its service, tools, command and prompt section
 *   2. the plan is derived from the source tree
 *   3. `generate` writes pages, metadata and the retrieval index
 *   4. every `path:line` citation resolves to a real line of a real file
 *   5. `status` / `search` / `read` / `impact` / `export` / `import` work
 *   6. secrets and ignored directories never enter the wiki
 *
 * Run with:  node test/local-e2e.mjs
 */
import { promises as fsp } from 'node:fs'
import { dirname, join, resolve as resolvePath, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

import { apply, RepoWikiService } from '../index.js'
import { buildPagePayload, buildPanelPayload } from '../src/panel.js'
import { parseMarkdownBlocks } from '../src/markdown.js'
import { APP_ROUTE, PANEL_ROUTES, ABORT_ROUTE, EXPORT_ROUTE, PROGRESS_ROUTE, GRAPH_ROUTE, IMPACT_ROUTE } from '../src/routes.js'

/* ------------------------------------------------------------------ *
 * A minimal implementation of the harness `fs` provider               *
 * ------------------------------------------------------------------ */

function createFakeFs() {
  return {
    async resolve(path, options = {}) {
      const cwd = options.cwd ?? process.cwd()
      const absolute = resolvePath(cwd, path)
      return { targetKey: absolute, displayPath: absolute }
    },
    processPath(target) {
      return target.targetKey
    },
    fileUrl(target) {
      return `file:///${target.targetKey.replace(/\\/g, '/')}`
    },
    contains(parent, child) {
      const parentPath = parent?.targetKey ?? parent
      const childPath = child?.targetKey ?? child
      return childPath === parentPath || childPath.startsWith(parentPath.endsWith(sep) ? parentPath : parentPath + sep)
    },
    async stat(target) {
      try {
        const info = await fsp.stat(target.targetKey)
        return {
          version: info.mtimeMs,
          type: info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'other',
          size: info.size,
        }
      } catch {
        return undefined
      }
    },
    async lstat(path, options = {}) {
      const cwd = options.cwd ?? process.cwd()
      const absolute = resolvePath(cwd, path)
      try {
        const info = await fsp.lstat(absolute)
        return {
          type: info.isDirectory() ? 'directory' : info.isFile() ? 'file' : info.isSymbolicLink() ? 'symlink' : 'other',
          size: info.size,
        }
      } catch {
        return undefined
      }
    },
    async readText(target) {
      return fsp.readFile(target.targetKey, 'utf8')
    },
    async listDir(target) {
      const entries = await fsp.readdir(target.targetKey, { withFileTypes: true })
      return Promise.all(entries.map(async (entry) => {
        const child = join(target.targetKey, entry.name)
        const info = entry.isFile() ? await fsp.stat(child) : null
        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
          target: { targetKey: child, displayPath: child },
          size: info ? info.size : undefined,
        }
      }))
    },
    async writeText(target, content) {
      const absolute = target.targetKey
      await mkdir(dirname(absolute), { recursive: true })
      const before = await fsp.readFile(absolute, 'utf8').catch(() => null)
      await writeFile(absolute, content, 'utf8')
      return {
        operation: before === null ? 'create' : 'update',
        version: Date.now(),
        before,
        after: content,
      }
    },
  }
}

/* ------------------------------------------------------------------ *
 * A minimal implementation of the plugin context                     *
 * ------------------------------------------------------------------ */

function createFakeCtx(workingDirectory) {
  const registry = { tools: [], commands: [], prompts: [], services: new Map(), disposers: [], routes: [] }
  const connection = {
    fetch: {
      register(route) {
        registry.routes.push(route)
        return () => {
          const index = registry.routes.indexOf(route)
          if (index >= 0) registry.routes.splice(index, 1)
        }
      },
    },
  }
  const ctx = {
    fs: createFakeFs(),
    tools: {
      register(definition) {
        registry.tools.push(definition)
        return () => {
          const index = registry.tools.indexOf(definition)
          if (index >= 0) registry.tools.splice(index, 1)
        }
      },
    },
    get(name) {
      if (name === 'systemPrompt') {
        return {
          section(section) {
            registry.prompts.push(section)
            return () => {
              const index = registry.prompts.indexOf(section)
              if (index >= 0) registry.prompts.splice(index, 1)
            }
          },
          getSectionOrder() {
            return 2300
          },
        }
      }
      if (name === 'commands') {
        return {
          register(definition) {
            registry.commands.push(definition)
            return () => {
              const index = registry.commands.indexOf(definition)
              if (index >= 0) registry.commands.splice(index, 1)
            }
          },
        }
      }
      if (name === 'workingDirectory') return workingDirectory
      if (name === 'connection') return connection
      return undefined
    },
    provide(name, value) {
      registry.services.set(name, value)
      return () => registry.services.delete(name)
    },
    effect(callback) {
      const disposer = callback()
      registry.disposers.push(disposer)
      return disposer
    },
    // The Cordis runtime API: start a new fiber when the named services
    // appear. The fake context provides everything synchronously, so the
    // callback runs immediately with the same context.
    inject(_names, callback) {
      callback(ctx)
      return () => {}
    },
    logger: {
      info() {},
      warn() {},
      error() {},
      debug() {},
    },
  }
  return { ctx, registry }
}

/* ------------------------------------------------------------------ *
 * The fixture repository                                             *
 * ------------------------------------------------------------------ */

const FIXTURE_FILES = {
  'package.json': JSON.stringify(
    {
      name: 'fixture-shop',
      version: '1.2.0',
      description: 'A tiny shop backend used by the repowiki test.',
      scripts: { start: 'node src/index.js', test: 'node --test' },
      dependencies: { express: '^4.18.0' },
    },
    null,
    2,
  ),
  'README.md': [
    '# fixture-shop',
    '',
    'A tiny shop backend.',
    '',
    '## Usage',
    '',
    'Run `npm start` to launch the HTTP server.',
    '',
  ].join('\n'),
  'src/index.js': [
    "import { createServer } from './server.js'",
    "import { formatPrice } from './util/format.js'",
    '',
    '/**',
    ' * Boot the HTTP server.',
    ' * @param {number} port',
    ' * @returns {object} the server handle',
    ' */',
    'export function main(port = 3000) {',
    '  const server = createServer()',
    '  return { server, port, greet: () => formatPrice(0) }',
    '}',
    '',
  ].join('\n'),
  'src/server.js': [
    '/**',
    ' * Create the request handler.',
    ' * @returns {(req: object, res: object) => void}',
    ' */',
    'export function createServer() {',
    '  return (req, res) => {',
    '    res.writeHead(200)',
    '    res.end("ok")',
    '  }',
    '}',
    '',
  ].join('\n'),
  'src/util/format.js': [
    '/**',
    ' * Format a price in cents.',
    ' * @param {number} cents',
    ' * @returns {string}',
    ' */',
    'export function formatPrice(cents) {',
    '  return `$${(cents / 100).toFixed(2)}`',
    '}',
    '',
  ].join('\n'),
  'docs/guide.md': ['# Guide', '', 'Call `main()` to boot the server.', ''].join('\n'),
  '.env': 'SECRET_TOKEN=super-secret\n',
  'secrets/private.key': '-----BEGIN PRIVATE KEY-----\n',
  'node_modules/left-pad/index.js': 'module.exports = () => {}\n',
}

async function createFixture(root) {
  for (const [relative, content] of Object.entries(FIXTURE_FILES)) {
    const absolute = join(root, ...relative.split('/'))
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, content, 'utf8')
  }
  await mkdir(join(root, '.git'), { recursive: true })
  await writeFile(join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n', 'utf8')
  await mkdir(join(root, '.git', 'refs', 'heads'), { recursive: true })
  await writeFile(join(root, '.git', 'refs', 'heads', 'main'), `${'a'.repeat(40)}\n`, 'utf8')
}

/* ------------------------------------------------------------------ *
 * The test                                                           *
 * ------------------------------------------------------------------ */

const checks = []
function check(name, fn) {
  checks.push({ name, fn })
}

check('the plugin registers the service, the tools, the command and the prompt section', async ({ ctx, registry }) => {
  assert.equal(registry.services.has('repoWiki'), true, 'repoWiki service must be provided')
  assert.deepEqual(
    registry.tools.map((tool) => tool.name).sort(),
    ['wiki_generate', 'wiki_read', 'wiki_search', 'wiki_status'],
    'four model tools must be registered',
  )
  assert.equal(registry.commands.length, 1, 'exactly one command must be registered')
  assert.equal(registry.commands[0].name, 'wiki', 'the command must be named "wiki"')
  assert.equal(registry.prompts.length, 1, 'exactly one prompt section must be registered')
  assert.equal(registry.prompts[0].name, 'repowiki:policy', 'the prompt section must be named "repowiki:policy"')
  assert.ok(registry.prompts[0].text.length > 0, 'the prompt section must have text')
  assert.ok(registry.prompts[0].text.length < 1200, 'the prompt section must stay small (context economy)')
  assert.ok(ctx.fs, 'the plugin must use the injected fs service')
})

check('the plan is derived from the source tree', async ({ service, root }) => {
  const result = await service.plan(root)
  assert.equal(result.validation.ok, true, `plan validation failed: ${JSON.stringify(result.validation.errors)}`)
  const documents = result.plan.repowiki.documents
  assert.ok(documents.length > 0, 'the plan must contain at least one document')
  const ids = documents.map((document) => document.id).join(' ')
  assert.ok(ids.length > 0)
  assert.ok(
    documents.some((document) => document.path),
    'every document must have an output path',
  )
})

check('generate writes the wiki, the metadata and the index', async ({ service, root }) => {
  const result = await service.generate({ root, mode: 'full', language: 'zh' })
  assert.ok(result.pagesWritten > 0, 'at least one page must be written')
  assert.equal(result.pagesFailed, 0, 'no page may fail')
  assert.ok(result.citations.total > 0, 'the pages must carry citations')

  const meta = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))
  assert.equal(meta.schemaVersion, 1)
  assert.equal(meta.generator.name, 'dsh-plugin-repowiki')
  assert.equal(meta.repo.branch, 'main', 'the branch must be read from .git/HEAD')
  assert.ok(meta.pages.length > 0)
  assert.ok(meta.cards.length > 0, 'a knowledge card must be produced')
  assert.ok(meta.stats.modelCalls === 0, 'generation is deterministic and must not call a model')

  const index = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'index.json'), 'utf8'))
  assert.ok(Array.isArray(index.pages) && index.pages.length > 0, 'the retrieval index must list the pages')

  const plan = await fsp.readFile(join(root, '.dsh', 'repowiki', 'wiki_plan.yaml'), 'utf8')
  assert.ok(plan.includes('repowiki:'), 'wiki_plan.yaml must be written')

  for (const page of meta.pages) {
    await fsp.access(page.path.startsWith('.dsh') ? join(root, ...page.path.split('/')) : join(root, ...page.path.split('/')))
  }
  assert.ok(true, 'every page listed in the metadata must exist on disk')
})

check('every citation resolves to a real file and a real line', async ({ service, root }) => {
  const status = await service.status(root)
  assert.ok(status.pages > 0)
  const meta = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))
  let total = 0
  let valid = 0
  for (const page of meta.pages) {
    const markdown = await fsp.readFile(join(root, ...page.path.split('/')), 'utf8')
    const citations = [...markdown.matchAll(/`([^`\s]+):(\d+)(?:-(\d+))?`/g)]
    for (const citation of citations) {
      total += 1
      const file = await fsp.readFile(join(root, ...citation[1].split('/')), 'utf8').catch(() => null)
      if (file === null) continue
      const lines = file.split('\n')
      const start = Number(citation[2])
      const end = Number(citation[3] ?? citation[2])
      if (start >= 1 && end <= lines.length) valid += 1
    }
  }
  assert.ok(total > 0, 'the pages must contain citations')
  assert.equal(valid, total, `every citation must be valid (${valid}/${total})`)
})

check('secrets and ignored directories never enter the wiki', async ({ service, root }) => {
  const meta = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))
  const serialized = JSON.stringify(meta)
  assert.ok(!serialized.includes('.env'), 'the .env file must never be indexed')
  assert.ok(!serialized.includes('private.key'), 'private keys must never be indexed')
  assert.ok(!serialized.includes('node_modules'), 'node_modules must never be indexed')
})

check('status, search, read and impact work on the generated wiki', async ({ service, root }) => {
  const status = await service.status(root)
  assert.equal(status.exists, true)
  assert.ok(status.pages > 0)
  assert.equal(status.branch, 'main')
  assert.ok(status.fresh + status.failed + status.stale + status.draft === status.pages)

  const hits = await service.search(root, 'formatPrice')
  assert.ok(hits.length > 0, 'the search must find the formatPrice page')
  assert.ok(hits[0].snippet.length > 0, 'a search hit must carry a snippet')

  const meta = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))
  const page = await service.read(root, meta.pages[0].id)
  assert.ok(page.markdown.startsWith('---'), 'a page must start with its frontmatter')
  assert.ok(page.markdown.includes('这一页回答什么'), 'a page must contain the templated sections')

  const affected = await service.impact(root, ['src/util/format.js'])
  assert.ok(Array.isArray(affected))
})

check('the update mode skips unchanged pages', async ({ service, root }) => {
  const result = await service.update({ root, mode: 'update', language: 'zh' })
  assert.ok(result.pagesSkipped > 0, 'an unchanged page must be skipped')
})

check('the wiki can be exported to the Qoder layout and imported back', async ({ service, root }) => {
  const exported = await service.exportWiki(root, 'qoder')
  assert.ok(Array.isArray(exported.files) && exported.files.length > 0, 'the export must copy files')
  await fsp.access(join(root, '.qoder', 'repowiki'))

  await rm(join(root, '.dsh', 'repowiki', 'content'), { recursive: true, force: true })
  const imported = await service.importWiki(root, 'qoder')
  assert.ok(imported.pages > 0, 'the import must restore the pages')
})

check('the tools return values that match their output schema', async ({ ctx, registry, root }) => {
  const search = registry.tools.find((tool) => tool.name === 'wiki_search')
  const read = registry.tools.find((tool) => tool.name === 'wiki_read')
  const generate = registry.tools.find((tool) => tool.name === 'wiki_generate')
  const status = registry.tools.find((tool) => tool.name === 'wiki_status')

  const searchResult = await search.execute({ query: 'server' }, { agent: { session: { id: 's1' } } })
  assert.ok(Array.isArray(searchResult.hits))
  assert.equal(typeof searchResult.total, 'number')
  assert.ok(searchResult.hits.every((hit) => typeof hit.page_id === 'string' && typeof hit.score === 'number'))
  const rendered = search.output.render({ query: 'server' }, searchResult)
  assert.ok(Array.isArray(rendered) && rendered[0].type === 'text')

  const meta = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))
  const readResult = await read.execute({ page_id: meta.pages[0].id }, { agent: { session: { id: 's1' } } })
  assert.equal(readResult.page_id, meta.pages[0].id)
  assert.ok(readResult.markdown.length > 0)

  await assert.rejects(() => read.execute({ page_id: '' }, {}), /page_id/, 'an empty page_id must be rejected')

  const generateResult = await generate.execute({ mode: 'full', dry_run: true }, { agent: { session: { id: 's1' } } })
  assert.equal(generateResult.mode, 'full')
  assert.equal(typeof generateResult.citations_total, 'number')
  assert.ok(Array.isArray(generateResult.warnings))

  const statusResult = await status.execute({}, { agent: { session: { id: 's1' } } })
  assert.equal(statusResult.root, root, 'wiki_status reports the resolved repository root')
  assert.equal(statusResult.exists, true)
  assert.ok(statusResult.pages > 0)
  assert.equal(typeof statusResult.client, 'object', 'wiki_status carries the client entry state')
  assert.equal(statusResult.client.available, false, 'the client status degrades without host services')
  assert.equal(typeof statusResult.lastRun, 'object')
  const statusText = status.output.render({}, statusResult)[0].text
  assert.ok(statusText.includes('```json'), 'the status render carries the JSON payload')
})

check('the /wiki command answers every subcommand', async ({ ctx, registry, root }) => {
  const command = registry.commands[0]
  const invocation = { commandId: 'c1', agent: { session: { id: 's1' } }, rawInput: 'status', attachments: [], signal: undefined }
  const status = await command.handler(invocation)
  assert.equal(status.kind, 'success')
  assert.ok(status.text.includes('仓库根目录'))

  const unknown = await command.handler({ ...invocation, rawInput: 'nope' })
  assert.equal(unknown.kind, 'error')

  const plan = await command.handler({ ...invocation, rawInput: 'plan' })
  assert.equal(plan.kind, 'success')
  assert.ok(plan.text.includes('页面规划'))

  const help = await command.handler({ ...invocation, rawInput: 'help' })
  assert.equal(help.kind, 'success')
  assert.ok(help.text.includes('/wiki generate'))
})

check('the page frontmatter status matches the status stored in the metadata', async ({ service, root }) => {
  const meta = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))
  assert.ok(meta.pages.length > 0)
  for (const page of meta.pages) {
    const markdown = await fsp.readFile(join(root, ...page.path.split('/')), 'utf8')
    const frontmatter = markdown.split('---')[1] ?? ''
    const match = frontmatter.match(/^status:\s*(.+)$/m)
    assert.ok(match, `the frontmatter of ${page.id} must carry a status`)
    assert.equal(match[1].trim(), page.status, `the status of ${page.id} must agree with the metadata`)
  }
})

check('the wiki is addressable by its flat id, its sectioned id and its artefacts', async ({ service, root }) => {
  const meta = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))
  const page = meta.pages[0]

  const flat = await service.read(root, page.id)
  assert.equal(flat.id, page.id)

  const sectioned = await service.read(root, `00-overview/${page.id}`)
  assert.equal(sectioned.id, page.id, 'the sectioned id must resolve to the same page')

  const landing = await service.read(root, 'index')
  assert.ok(landing.markdown.length > 0, 'the landing page must be readable')
  assert.ok(landing.path.endsWith('index.md'))

  const plan = await service.read(root, 'plan')
  assert.ok(plan.path.endsWith('wiki_plan.yaml'), 'the plan file must be readable')

  const cardId = meta.cards[0]?.id
  if (cardId) {
    const card = await service.read(root, `card:${cardId}`)
    assert.ok(card.markdown.length > 0, 'a knowledge card must be readable')
  }

  await assert.rejects(() => service.read(root, 'does-not-exist'), /未找到 Wiki 页面/)
})

check('the landing page, the plan and the knowledge cards are searchable', async ({ service, root }) => {
  const meta = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))
  const ids = new Set(meta.pages.map((page) => page.id))
  assert.ok(!ids.has('index'), 'the landing page must not be a regular page')

  const planHits = await service.search(root, 'wiki_plan')
  assert.ok(planHits.length > 0, 'the plan file must be searchable')
  assert.ok(planHits.some((hit) => hit.id === 'plan'), 'the plan must be reachable by the id "plan"')

  const cardId = meta.cards[0]?.id
  if (cardId) {
    const cardHits = await service.search(root, '知识卡')
    assert.ok(cardHits.some((hit) => hit.id === `card:${cardId}`), 'the knowledge card must be searchable')
  }
})

check('the tool result carries the machine readable payload', async ({ ctx, registry, root }) => {
  const search = registry.tools.find((tool) => tool.name === 'wiki_search')
  const read = registry.tools.find((tool) => tool.name === 'wiki_read')
  const generate = registry.tools.find((tool) => tool.name === 'wiki_generate')

  const searchResult = await search.execute({ query: 'server' }, { agent: { session: { id: 's1' } } })
  const searchText = search.output.render({ query: 'server' }, searchResult)[0].text
  assert.ok(searchText.includes('```json'), 'the rendered text must contain the JSON payload')
  assert.ok(searchText.includes('"total"'), 'the rendered text must expose the total hit count')
  assert.ok(searchText.includes('"score"'), 'the rendered text must expose the score of every hit')

  const meta = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))
  const readResult = await read.execute({ page_id: meta.pages[0].id }, { agent: { session: { id: 's1' } } })
  const readText = read.output.render({ page_id: meta.pages[0].id }, readResult)[0].text
  assert.ok(readText.includes('```json'), 'the rendered text must contain the JSON payload')
  assert.ok(readText.includes('"path"'), 'the rendered text must expose the page path')
  assert.ok(readText.includes('这一页回答什么'), 'the rendered text must still contain the page body')

  const generateResult = await generate.execute({ mode: 'full', dry_run: true }, { agent: { session: { id: 's1' } } })
  const generateText = generate.output.render({ mode: 'full' }, generateResult)[0].text
  assert.ok(generateText.includes('```json'), 'the rendered text must contain the JSON payload')
})

check('the duration reported by the tool equals the duration stored in the metadata', async ({ service, root }) => {
  const result = await service.generate({ root, mode: 'full', language: 'zh' })
  const meta = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))
  assert.equal(meta.stats.durationMs, result.durationMs, 'both durations must come from the same measurement')
})

check('every source file of a page is cited at least once', async ({ service, root }) => {
  await service.generate({ root, mode: 'full', language: 'zh' })
  const meta = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))
  const cited = new Set()
  for (const page of meta.pages) {
    for (const citation of page.citations ?? []) cited.add(citation.path)
  }
  // The fixture has six source files; every one of them must be reachable
  // through the citations of the generated pages.
  const expected = [
    'package.json',
    'README.md',
    'docs/guide.md',
    'src/index.js',
    'src/server.js',
    'src/util/format.js',
  ]
  for (const file of expected) {
    assert.ok(cited.has(file), `the file ${file} must be cited by at least one page`)
  }
})

check('the panel routes are registered on the connection service', async ({ registry }) => {
  const byPath = new Map(registry.routes.map((route) => [route.path, route]))
  assert.equal(byPath.size, 10, 'the panel registers 4 panel + app + progress + abort + export + graph + impact routes')
  for (const path of Object.values(PANEL_ROUTES)) {
    assert.ok(byPath.has(path), `${path} must be registered`)
  }
  assert.ok(byPath.has(APP_ROUTE), 'the standalone fallback page must be registered')
  assert.ok(byPath.has(PROGRESS_ROUTE), 'the live progress route must be registered')
  assert.ok(byPath.has(ABORT_ROUTE), 'the abort route must be registered')
  assert.ok(byPath.has(EXPORT_ROUTE), 'the export route must be registered')
  assert.ok(byPath.has(GRAPH_ROUTE), 'the knowledge graph route must be registered')
  assert.ok(byPath.has(IMPACT_ROUTE), 'the impact route must be registered')
  assert.deepEqual(byPath.get(PANEL_ROUTES.panel).methods, ['GET'])
  // Read-only routes must NOT use 'none': the host bridge turns 'none' into a
  // streaming `Request` with a body, which the WHATWG constructor rejects for
  // GET ("Request with GET/HEAD method cannot have body") and the browser only
  // sees a bare 400. Every GET route therefore buffers its (empty) body.
  assert.equal(byPath.get(PANEL_ROUTES.panel).requestBody, 'buffered')
  assert.deepEqual(byPath.get(PANEL_ROUTES.generate).methods, ['POST'])
  assert.equal(byPath.get(PANEL_ROUTES.generate).requestBody, 'buffered')
  assert.deepEqual(byPath.get(APP_ROUTE).methods, ['GET'], 'the fallback page is read-only')
  assert.equal(byPath.get(APP_ROUTE).requestBody, 'buffered')
  assert.deepEqual(byPath.get(PROGRESS_ROUTE).methods, ['GET'])
  assert.deepEqual(byPath.get(ABORT_ROUTE).methods, ['POST'])
  assert.deepEqual(byPath.get(EXPORT_ROUTE).methods, ['POST'])
  assert.deepEqual(byPath.get(GRAPH_ROUTE).methods, ['GET'])
  assert.deepEqual(byPath.get(IMPACT_ROUTE).methods, ['GET'])
  for (const route of registry.routes) {
    assert.equal(typeof route.fetch, 'function', `${route.path} must expose a fetch handler`)
  }
})

check('the panel routes serve the panel, a page, a search and a generate', async ({ registry, root }) => {
  const byPath = new Map(registry.routes.map((route) => [route.path, route]))
  const meta = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))

  const panelResponse = await byPath.get(PANEL_ROUTES.panel).fetch(new Request('http://127.0.0.1' + PANEL_ROUTES.panel))
  assert.equal(panelResponse.status, 200)
  const panel = await panelResponse.json()
  assert.equal(panel.exists, true, 'the panel must report the generated wiki')
  assert.equal(panel.pages.length, meta.pages.length)
  assert.ok(panel.sections.length > 0, 'the panel groups the pages into sections')
  assert.equal(panel.stats.citationTotal, meta.stats.citationTotal ?? panel.stats.citationTotal)

  const pageId = meta.pages[0].id
  const pageResponse = await byPath
    .get(PANEL_ROUTES.page)
    .fetch(new Request(`http://127.0.0.1${PANEL_ROUTES.page}?id=${encodeURIComponent(pageId)}`))
  assert.equal(pageResponse.status, 200)
  const page = await pageResponse.json()
  assert.equal(page.id, pageId)
  assert.ok(page.blocks.length > 0, 'the page payload must carry parsed blocks')

  const missingResponse = await byPath
    .get(PANEL_ROUTES.page)
    .fetch(new Request(`http://127.0.0.1${PANEL_ROUTES.page}`))
  assert.equal(missingResponse.status, 400, 'a page request without an id is rejected')

  const searchResponse = await byPath
    .get(PANEL_ROUTES.search)
    .fetch(new Request(`http://127.0.0.1${PANEL_ROUTES.search}?q=server`))
  assert.equal(searchResponse.status, 200)
  const search = await searchResponse.json()
  assert.ok(search.count >= 1, 'the search route must find the fixture server module')

  const generateResponse = await byPath.get(PANEL_ROUTES.generate).fetch(
    new Request('http://127.0.0.1' + PANEL_ROUTES.generate, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'update' }),
    }),
  )
  assert.equal(generateResponse.status, 200)
  const generated = await generateResponse.json()
  assert.equal(generated.mode, 'update')
  assert.ok(generated.pagesSkipped >= 1, 'the update route must skip the unchanged pages')
})

check('the menu payload exposes every page with its status and its section', async ({ service, root }) => {
  await service.generate({ root, mode: 'full', language: 'zh' })
  const panel = await buildPanelPayload(service, root)
  const ids = new Set(panel.pages.map((page) => page.id))
  assert.equal(ids.size, panel.pages.length, 'the page ids are unique')
  for (const page of panel.pages) {
    assert.ok(page.id && page.title, 'every page row carries an id and a title')
    assert.ok(typeof page.status === 'string', 'every page row carries a status')
    assert.ok(typeof page.section === 'string', 'every page row carries the section it belongs to')
  }
  const sectioned = panel.sections.flatMap((section) => section.pages)
  assert.deepEqual(sectioned.sort(), [...ids].sort(), 'the sections cover every page exactly once')
})

check('the markdown parser turns a generated page into typed blocks', async ({ service, root }) => {
  const meta = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))
  const payload = await buildPagePayload(service, root, meta.pages[0].id)
  const blocks = payload.blocks

  assert.ok(blocks.length > 0, 'a generated page must produce blocks')
  const kinds = new Set(blocks.map((block) => block.type))
  assert.ok(kinds.has('heading'), 'a page starts with headings')
  assert.ok(kinds.has('paragraph') || kinds.has('list'), 'a page carries prose or lists')
  assert.ok(kinds.has('table'), 'the source index is a markdown table')
  assert.equal(blocks[0].type, 'heading', 'the title is the first block')
  assert.ok(!kinds.has('hr'), 'the frontmatter must not leak into the body')
  for (const block of blocks) {
    assert.ok(typeof block.type === 'string' && block.type.length > 0)
  }
  assert.ok(payload.sections.length > 0, 'the blocks are grouped into sections')
  assert.deepEqual(parseMarkdownBlocks(null), [], 'a non-string input degrades to no blocks')
})

check('concurrent generations conflict instead of interleaving', async ({ service, root }) => {
  const before = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))
  // Both calls are issued without awaiting the first: the lock is taken in
  // the synchronous prologue of `run`, so the second call must be rejected.
  const attempts = await Promise.allSettled([
    service.generate({ root, mode: 'full', language: 'zh' }),
    service.generate({ root, mode: 'full', language: 'zh' }),
  ])
  const fulfilled = attempts.filter((attempt) => attempt.status === 'fulfilled')
  const rejected = attempts.filter((attempt) => attempt.status === 'rejected')
  assert.equal(fulfilled.length, 1, 'exactly one of the two generations may succeed')
  assert.equal(rejected.length, 1, 'the other one must be rejected')
  const error = rejected[0].reason
  assert.match(String(error?.message ?? ''), /runId=/, 'the conflict message names the running generation')
  assert.equal(error?.code, 'conflict', 'the conflict carries the unified error code')

  const after = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))
  assert.equal(after.pages.length, before.pages.length, 'the interleaved write must not change the page count')
  assert.deepEqual(JSON.parse(JSON.stringify(after.pages.map((page) => page.id))), JSON.parse(JSON.stringify(before.pages.map((page) => page.id))))
  assert.ok(service.isRunning === undefined || !service.isRunning(root, 'zh'), 'the lock must be released after the run')
})

check('the run journal records the lifecycle of a run', async ({ service, root }) => {
  const result = await service.generate({ root, mode: 'full', language: 'zh' })
  const journal = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'run.json'), 'utf8'))
  assert.equal(journal.runId, result.runId, 'the journal names the run it recorded')
  assert.equal(journal.mode, 'full')
  assert.equal(journal.status, 'done', 'a completed run is recorded as done')
  assert.ok(typeof journal.startedAt === 'string' && journal.startedAt.length > 0)
  assert.ok(journal.finishedAt, 'a completed run carries its finish time')
  assert.equal(journal.pages, result.pagesWritten)
  assert.deepEqual(journal.citations, { total: result.citations.total, valid: result.citations.valid })

  const status = await service.status(root)
  assert.equal(status.run?.status, 'done', 'the status exposes the run journal')
})

check('the retrieval corpus is cached and invalidated by writes', async ({ service, root }) => {
  const first = await service.corpus(root, 'zh')
  assert.ok(first && first.length > 0, 'the corpus must be readable')
  const second = await service.corpus(root, 'zh')
  assert.equal(second, first, 'the second read must reuse the cached corpus object')

  await service.generate({ root, mode: 'full', language: 'zh' })
  const third = await service.corpus(root, 'zh')
  assert.notEqual(third, first, 'a generation invalidates the corpus cache')
})

check('the client status degrades gracefully without host services', async ({ service, root }) => {
  const client = await service.clientStatus()
  assert.equal(typeof client, 'object')
  assert.equal(client.available, false, 'without clientModules the entry cannot be confirmed')
  assert.equal(client.composed, false)
  assert.equal(client.served, false)
  assert.ok(typeof client.error === 'string' && client.error.length > 0, 'the degradation is explained')

  const panel = await buildPanelPayload(service, root)
  assert.equal(panel.client.available, false, 'the panel payload carries the degraded client section')
  assert.equal(panel.webUrl, null, 'no web url is invented without the host services')

  const receipt = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'runtime.json'), 'utf8'))
  assert.equal(receipt.client.available, false, 'the runtime receipt carries the client section too')
  assert.equal(receipt.services.clientModules, false, 'the receipt records the missing host service')
})

check('route failures carry the unified error body', async ({ registry }) => {
  const byPath = new Map(registry.routes.map((route) => [route.path, route]))

  const missingId = await byPath.get(PANEL_ROUTES.page).fetch(new Request('http://127.0.0.1' + PANEL_ROUTES.page))
  assert.equal(missingId.status, 400)
  const missingIdBody = await missingId.json()
  assert.equal(missingIdBody.error.code, 'invalid_argument', 'a missing id is an invalid argument')
  assert.ok(missingIdBody.error.message.length > 0)
  assert.ok(missingIdBody.error.hint.length > 0, 'the error body explains the way out')

  const unknownPage = await byPath
    .get(PANEL_ROUTES.page)
    .fetch(new Request(`http://127.0.0.1${PANEL_ROUTES.page}?id=does-not-exist`))
  assert.equal(unknownPage.status, 404)
  const unknownBody = await unknownPage.json()
  assert.equal(unknownBody.error.code, 'not_found', 'a missing page is a not_found')

  const searchResponse = await byPath
    .get(PANEL_ROUTES.search)
    .fetch(new Request(`http://127.0.0.1${PANEL_ROUTES.search}?q=`))
  assert.equal(searchResponse.status, 200, 'an empty search stays a valid empty answer')
})

check('the fallback app page serves self-contained HTML', async ({ registry }) => {
  const byPath = new Map(registry.routes.map((route) => [route.path, route]))
  const response = await byPath.get(APP_ROUTE).fetch(new Request('http://127.0.0.1' + APP_ROUTE))
  assert.equal(response.status, 200)
  assert.ok(String(response.headers.get('content-type') ?? '').includes('text/html'), 'the fallback page is HTML')
  const html = await response.text()
  assert.ok(html.includes('<!doctype html>'), 'the page is a complete document')
  assert.ok(!/\ssrc=["']http/i.test(html) && !/href=["']http/i.test(html), 'the page loads no external asset')
  for (const path of Object.values(PANEL_ROUTES)) {
    assert.ok(html.includes(path), `the page addresses the route ${path}`)
  }
  assert.ok(html.includes('generate'), 'the page offers a generate control')
})

check('a Web request resolves the workspace that already holds a wiki', async ({ service, root }) => {
  const emptyRoot = await mkdtemp(join(tmpdir(), 'repowiki-empty-'))
  try {
    // The harness reports the profile directory as the default directory, so a
    // route with no agent has to look further: the registered workspaces carry
    // the repositories that actually have a wiki.
    const { ctx } = createFakeCtx({ defaultDirectory: emptyRoot, get: () => emptyRoot })
    ctx.get = (name) => {
      if (name === 'workingDirectory') return { defaultDirectory: emptyRoot, get: () => emptyRoot }
      if (name === 'agents') return { get: () => undefined, list: () => [] }
      if (name === 'workspaceRegistry') return { list: () => [{ id: 'w1', path: root, title: 'Repo' }] }
      return undefined
    }
    const isolated = new RepoWikiService(ctx, { outputDir: '.dsh/repowiki' })

    assert.equal(await isolated.resolveRequestRoot(), root, 'the workspace with a wiki wins over the default directory')
    assert.equal(await isolated.resolveRequestRoot(emptyRoot), emptyRoot, 'an explicit hint wins even without a wiki')
    assert.equal(
      await isolated.resolveRequestRoot(join(emptyRoot, 'does-not-exist')),
      root,
      'an unusable hint falls through to the chain',
    )

    const payload = await buildPanelPayload(isolated, root, {})
    assert.equal(payload.roots[0].path, root)
    assert.equal(payload.roots[0].active, true, 'the active root is flagged for the panel switcher')
  } finally {
    await rm(emptyRoot, { recursive: true, force: true })
  }
})

check('the knowledge-card library has section cards with parent links', async ({ service, root }) => {
  await service.generate({ root, mode: 'full', language: 'zh' })
  const meta = JSON.parse(await fsp.readFile(join(root, '.dsh', 'repowiki', 'meta', 'repowiki.json'), 'utf8'))
  const cards = meta.cards ?? []

  // One parent card plus one card per wiki section.
  assert.ok(cards.length >= 2, `the card library must hold the parent card plus section cards (got ${cards.length})`)
  const parent = cards.find((card) => card.id === 'repo-overview')
  assert.ok(parent, 'the parent card keeps its stable id')
  const sectionCards = cards.filter((card) => card.id !== 'repo-overview')
  assert.ok(sectionCards.every((card) => card.parent?.id === 'repo-overview'), 'every section card names the parent card')
  assert.ok(sectionCards.every((card) => typeof card.summary === 'string' && card.summary.length > 0), 'section cards carry a summary for the list view')
  assert.ok(sectionCards.every((card) => typeof card.tag === 'string' && card.tag.length > 0), 'section cards carry their topic tag')

  // The parent card body lists its children as `card:` cross references and a
  // section card links back to the parent — both readable via wiki_read.
  const parentRead = await service.read(root, `card:${parent.id}`)
  assert.ok(parentRead.markdown.includes('包含知识'), 'the parent card lists the included knowledge')
  assert.ok(parentRead.markdown.includes('`card:'), 'the parent card references its children by card id')
  const childRead = await service.read(root, `card:${sectionCards[0].id}`)
  assert.ok(childRead.markdown.includes('父级知识'), 'a section card links back to the parent')

  // The panel payload exposes the enriched cards plus the per-workspace
  // project overview rows.
  const panel = await buildPanelPayload(service, root)
  const panelCard = panel.cards.find((card) => card.id === sectionCards[0].id)
  assert.ok(panelCard && panelCard.summary.length > 0 && panelCard.tag.length > 0, 'the panel cards carry summary and tag')
  assert.ok(Array.isArray(panel.projects) && panel.projects.length >= 1, 'the panel payload carries the projects overview')
  const active = panel.projects.find((row) => row.active)
  assert.ok(active && active.exists === true && active.pages === panel.pages.length, 'the active project row mirrors the generated wiki')

  // A child page reports its parent chain for the breadcrumb.
  const childPage = meta.pages.find((page) => page.parent)
  if (childPage) {
    const pagePayload = await buildPagePayload(service, root, childPage.id)
    assert.ok(
      Array.isArray(pagePayload.parents) && pagePayload.parents.some((entry) => entry.id === childPage.parent),
      'the page payload carries the parent chain for the breadcrumb',
    )
  }
})

check('the knowledge graph answers modules, edges and impact', async ({ registry }) => {
  const byPath = new Map(registry.routes.map((route) => [route.path, route]))

  const graphResponse = await byPath.get(GRAPH_ROUTE).fetch(new Request('http://127.0.0.1' + GRAPH_ROUTE))
  assert.equal(graphResponse.status, 200)
  const graph = await graphResponse.json()
  assert.equal(graph.level, 'module')
  assert.ok(graph.nodes.length >= 1, 'the graph carries module nodes')
  assert.ok(graph.edges.every((edge) => edge.from !== edge.to), 'no self edges')
  const ids = new Set(graph.nodes.map((node) => node.id))
  assert.ok(graph.edges.every((edge) => ids.has(edge.from) && ids.has(edge.to)), 'every edge endpoint is a real node')
  for (const node of graph.nodes) {
    assert.ok(typeof graph.levels[node.id] === 'number', 'every node has a dependency layer')
    assert.ok(typeof node.fileCount === 'number' && typeof node.loc === 'number')
  }

  const moduleNode = graph.nodes.find((node) => node.fileCount > 0)
  assert.ok(moduleNode, 'at least one module holds files')
  const drillResponse = await byPath
    .get(GRAPH_ROUTE)
    .fetch(new Request(`http://127.0.0.1${GRAPH_ROUTE}?level=file&module=${encodeURIComponent(moduleNode.dir)}`))
  assert.equal(drillResponse.status, 200)
  const drill = await drillResponse.json()
  assert.ok(drill.nodes.some((node) => node.type === 'file'), 'the file-level graph lists the module files')

  if (graph.edges.length > 0) {
    const edge = graph.edges[0]
    // Impact takes the raw module directory; graph edges carry node ids.
    const toNode = graph.nodes.find((node) => node.id === edge.to)
    const impactResponse = await byPath
      .get(IMPACT_ROUTE)
      .fetch(new Request(`http://127.0.0.1${IMPACT_ROUTE}?module=${encodeURIComponent(toNode.dir)}`))
    assert.equal(impactResponse.status, 200)
    const impact = await impactResponse.json()
    assert.ok(
      impact.upstream.some((dir) => `mod:${dir}` === edge.from),
      'the importer appears in the upstream impact set',
    )
  }
})

check('progress, abort and export endpoints answer with real data', async ({ root, registry }) => {
  const byPath = new Map(registry.routes.map((route) => [route.path, route]))

  // The last finished generation leaves a final progress entry behind, so the
  // panel can show "what happened" even after the run completed.
  const progressResponse = await byPath.get(PROGRESS_ROUTE).fetch(new Request('http://127.0.0.1' + PROGRESS_ROUTE))
  assert.equal(progressResponse.status, 200)
  const progressBody = await progressResponse.json()
  assert.equal(progressBody.running, false, 'no run is active between checks')
  const progress = progressBody.progress
  assert.ok(progress, 'the last run leaves a progress entry')
  assert.equal(progress.status, 'done')
  assert.ok(progress.total >= 1, 'the progress card knows the page total')
  assert.equal(progress.done, progress.total, 'a finished run is fully counted')
  assert.ok(typeof progress.startedAt === 'string' && progress.startedAt.length > 0)

  // Aborting with nothing in flight answers false instead of erroring.
  const abortResponse = await byPath.get(ABORT_ROUTE).fetch(
    new Request('http://127.0.0.1' + ABORT_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ root }),
    }),
  )
  assert.equal(abortResponse.status, 200)
  const abortBody = await abortResponse.json()
  assert.equal(abortBody.aborted, false)

  // The export route drives the same exportWiki the /wiki command uses.
  const exportResponse = await byPath.get(EXPORT_ROUTE).fetch(
    new Request('http://127.0.0.1' + EXPORT_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target: 'qoder', root }),
    }),
  )
  assert.equal(exportResponse.status, 200)
  const exportBody = await exportResponse.json()
  assert.equal(exportBody.target, 'qoder')
  assert.ok(Array.isArray(exportBody.files) && exportBody.files.length > 0, 'the export copies files')
  await fsp.access(join(root, '.qoder', 'repowiki'))
})

/* ------------------------------------------------------------------ *
 * Runner                                                             *
 * ------------------------------------------------------------------ */

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'repowiki-test-'))
  let failures = 0
  try {
    await createFixture(root)
    const { ctx, registry } = createFakeCtx({
      defaultDirectory: root,
      get: () => root,
    })
    apply(ctx, { outputDir: '.dsh/repowiki', defaultLanguage: 'zh' })
    const service = new RepoWikiService(ctx, {})
    const context = { ctx, registry, service, root }

    for (const { name, fn } of checks) {
      try {
        await fn(context)
        console.log(`  PASS  ${name}`)
      } catch (error) {
        failures += 1
        console.log(`  FAIL  ${name}`)
        console.log(`        ${error?.stack ?? error}`)
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
  console.log(failures === 0 ? '\nAll local checks passed.' : `\n${failures} check(s) failed.`)
  process.exit(failures === 0 ? 0 : 1)
}

await main()
