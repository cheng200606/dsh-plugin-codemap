/**
 * Planning module for the Repo Wiki plugin.
 *
 * The plan is the deterministic contract between the scanner/indexer and the
 * page writer: it decides *which* pages exist, *what* each page must answer,
 * and *which* repository files back it up. Nothing here touches the file
 * system, so the same scan + index always produce byte-identical plans.
 *
 * The plan has two representations:
 *   - the in-memory shape used by the pipeline
 *   - `wiki_plan.yaml`, the human-editable interchange format
 */
import { clamp, slugify, toPosix, uniq } from './util.js'
import { parseYaml, stringifyYaml } from './yaml.js'

/** Current plan schema version. */
export const PLAN_VERSION = 1

/** Hard ceiling on the number of pages in one plan. */
export const MAX_DOCUMENTS = 24

/** Output folder (POSIX, relative to the language content root) per page id. */
const PAGE_DIRECTORIES = {
  overview: '00-overview',
  concepts: '10-architecture',
  architecture: '10-architecture',
  modules: '10-architecture',
  apis: '10-architecture',
  data: '10-architecture',
  config: '10-architecture',
  build: '20-operations',
  flows: '20-flows',
  'open-questions': '30-notes',
}

/** A directory that counts as "data-ish" for the conditional data page. */
const DATA_PATH_PATTERN = /(^|\/)(migrations?|models?|schema|prisma|db|database|entities?)(\/|$)/i

/**
 * The fixed page catalogue. Order matters: it is the document order of the
 * generated plan and the tie-break order when the page budget is exhausted.
 */
const CATALOGUE = [
  {
    id: 'overview',
    title: '项目概览',
    goal: '说明这个仓库解决什么问题、主要由哪些技术组成。',
    parent: undefined,
    hints: ['说明仓库解决的问题与面向的使用场景', '概括主要技术组成与运行入口'],
  },
  {
    id: 'concepts',
    title: '核心概念与领域模型',
    goal: '梳理仓库中的核心概念、实体与它们的关系。',
    parent: 'overview',
    hints: ['列出核心实体与关键术语', '说明概念之间的依赖与包含关系'],
  },
  {
    id: 'architecture',
    title: '技术架构总览',
    goal: '解释仓库的分层结构、模块依赖与关键技术选型。',
    parent: 'overview',
    hints: ['说明分层结构与依赖方向', '解释关键技术选型及其取舍'],
  },
  {
    id: 'modules',
    title: '目录结构与模块地图',
    goal: '逐个说明顶层目录与核心模块的职责边界。',
    parent: 'architecture',
    hints: ['逐个说明顶层目录的职责', '标注核心模块的入口文件'],
  },
  {
    id: 'apis',
    title: '关键接口与调用链',
    goal: '列出对外暴露的接口/路由及其调用路径。',
    parent: 'architecture',
    hints: ['列出对外暴露的接口或路由', '标注请求入口与处理函数的位置'],
    conditional: 'routes',
  },
  {
    id: 'data',
    title: '数据与持久化',
    goal: '说明数据模型、存储位置与读写路径。',
    parent: 'architecture',
    hints: ['说明数据模型与存储位置', '标注读写路径与迁移脚本'],
    conditional: 'data',
  },
  {
    id: 'config',
    title: '配置与环境变量',
    goal: '列出配置项、环境变量及其默认值与影响范围。',
    parent: 'architecture',
    hints: ['列出配置项与环境变量', '说明默认值与影响范围'],
    conditional: 'config',
  },
  {
    id: 'build',
    title: '构建、运行与测试',
    goal: '说明依赖安装、构建命令、运行方式与测试入口。',
    parent: 'overview',
    hints: ['说明依赖安装与构建命令', '标注运行方式与测试入口'],
  },
  {
    id: 'flows',
    title: '端到端核心链路',
    goal: '串起从入口到主要输出的端到端流程。',
    parent: 'architecture',
    hints: ['串起从入口到主要输出的链路', '标注链路上的关键模块与调用点'],
  },
  {
    id: 'open-questions',
    title: '当前边界与待补充事项',
    goal: '记录实现边界、已知缺口与需要人工确认的问题。',
    parent: 'overview',
    hints: ['记录实现边界与已知缺口', '列出需要人工确认的问题'],
  },
]

/** Pages that are always generated, in catalogue order. */
const ALWAYS_PRESENT = CATALOGUE.filter((entry) => !entry.conditional).map((entry) => entry.id)

/** Maximum number of symbol names attached to one page. */
const MAX_PAGE_SYMBOLS = 12

/**
 * Symbol kinds that carry the most meaning, per page id.
 *
 * The page specific group comes first, the generic group second; kinds that
 * are in neither group are ranked last.
 */
const PAGE_SYMBOL_FOCUS = {
  apis: ['route', 'function', 'method'],
  config: ['const', 'variable', 'function'],
  data: ['class', 'type', 'interface'],
}

/** Default symbol kinds that carry the most meaning for a page. */
const DEFAULT_SYMBOL_FOCUS = ['function', 'class', 'method']

/**
 * Per-page rotation of the module file window.
 *
 * Every page takes a different slice of every module, so the wiki as a whole
 * covers much more of the repository instead of citing the same head files
 * on every page.
 */
const PAGE_FILE_ROTATION = {
  overview: 0,
  concepts: 2,
  architecture: 5,
  modules: 8,
  apis: 1,
  data: 2,
  config: 15,
  build: 11,
  flows: 3,
  'open-questions': 13,
}

/* ------------------------------------------------------------------ *
 * Normalization helpers (tolerate the loose shapes of scan / index)
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

/** Normalize the `index.modules` entries into `{ path, files, firstFile, size }`. */
function moduleList(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const files = pathList(item.files)
    const path = typeof item.path === 'string' ? toPosix(item.path) : (typeof item.name === 'string' ? toPosix(item.name) : '')
    const directFile = typeof item.file === 'string' ? toPosix(item.file) : ''
    const firstFile = files[0] ?? directFile
    const size = firstFinite(item.loc, item.size, item.bytes, item.lines, files.length)
    out.push({ path, files, firstFile, size })
  }
  return out
}

/** First finite number among the candidates (0 when none is usable). */
function firstFinite(...values) {
  for (const value of values) {
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return 0
}

/** Normalize `index.symbols` into `{ name, path, line, endLine, kind }`. */
function symbolList(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const name = typeof item.name === 'string' ? item.name : (typeof item.symbol === 'string' ? item.symbol : '')
    const path = typeof item.path === 'string' ? toPosix(item.path) : (typeof item.file === 'string' ? toPosix(item.file) : '')
    if (!name || !path) continue
    const line = Number(item.line ?? item.startLine ?? item.start)
    const endLine = Number(item.endLine ?? item.end ?? line)
    out.push({
      name,
      path,
      line: Number.isInteger(line) ? line : 0,
      endLine: Number.isInteger(endLine) ? endLine : 0,
      kind: typeof item.kind === 'string' ? item.kind : (typeof item.type === 'string' ? item.type : ''),
    })
  }
  return out
}

/** Normalize `index.routes` into `{ method, route, file, line, endLine }`. */
function routeList(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const file = typeof item.file === 'string' ? toPosix(item.file) : (typeof item.path === 'string' ? toPosix(item.path) : '')
    if (!file) continue
    const route = firstString(item.route, item.url, item.endpoint, item.pattern)
    const method = firstString(item.method, item.verb, item.httpMethod).toUpperCase()
    const line = Number(item.line ?? item.startLine ?? item.lineNumber)
    const endLine = Number(item.endLine ?? item.end ?? line)
    out.push({
      method,
      route,
      file,
      line: Number.isInteger(line) ? line : 0,
      endLine: Number.isInteger(endLine) ? endLine : 0,
    })
  }
  return out
}

/** Normalize `index.configKeys` into `{ key, file, line, endLine }`. */
function configKeyList(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const key = firstString(item.key, item.name, item.env, item.id)
    const file = typeof item.file === 'string' ? toPosix(item.file) : (typeof item.path === 'string' ? toPosix(item.path) : '')
    if (!key || !file) continue
    const line = Number(item.line ?? item.startLine ?? item.lineNumber)
    const endLine = Number(item.endLine ?? item.end ?? line)
    out.push({
      key,
      file,
      line: Number.isInteger(line) ? line : 0,
      endLine: Number.isInteger(endLine) ? endLine : 0,
    })
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

/* ------------------------------------------------------------------ *
 * Plan building
 * ------------------------------------------------------------------ */

/**
 * Build the deterministic Wiki plan.
 *
 * @param {object} scan - repository inventory (`files`, `buildFiles`, `entryPoints`, `docs`)
 * @param {object} index - repository index (`modules`, `symbols`, `routes`, `configKeys`, `docs`)
 * @param {{ template?: string, audience?: string, maxPages?: number, language?: string }} [options]
 * @returns {object} the in-memory plan
 */
export function buildPlan(scan = {}, index = {}, options = {}) {
  const template = firstString(options.template) || 'architecture'
  const audience = firstString(options.audience) || 'engineering'
  const maxPages = clamp(Number(options.maxPages ?? MAX_DOCUMENTS), 1, MAX_DOCUMENTS)

  const scanFiles = pathList(scan?.files)
  const fileSet = new Set(scanFiles)
  const buildFiles = pathList(scan?.buildFiles)
  const entryPoints = pathList(scan?.entryPoints)
  const scanDocs = pathList(scan?.docs)
  const indexDocs = pathList(index?.docs)
  const docs = indexDocs.length > 0 ? indexDocs : scanDocs
  const modules = moduleList(index?.modules)
  const symbols = symbolList(index?.symbols)
  const routes = routeList(index?.routes)
  const configKeys = configKeyList(index?.configKeys)
  const dataFiles = scanFiles.filter(isDataFile)

  const context = {
    fileSet,
    buildFiles,
    entryPoints,
    scanDocs,
    docs,
    modules,
    symbols,
    routes,
    configKeys,
    dataFiles,
    fileImports: Array.isArray(index?.fileImports) ? index.fileImports : [],
  }

  // 1. Which catalogue entries apply at all?
  const applicable = CATALOGUE.filter((entry) => isApplicable(entry, context))
  // 2. Respect the page budget: always-present pages win, then conditional
  //    pages in catalogue order.
  const selected = selectWithinBudget(applicable, maxPages)
  // 3. Emit them in catalogue order so parents always precede their children.
  const ordered = CATALOGUE.filter((entry) => selected.has(entry.id))

  const documents = ordered.map((entry) => {
    const files = selectFiles(entry.id, context).filter((file) => fileSet.has(file))
    return {
      id: entry.id,
      title: entry.title,
      goal: entry.goal,
      parent: entry.parent,
      hints: [...entry.hints],
      sources: {
        files: uniq(files),
        symbols: selectSymbols(entry.id, files, symbols),
      },
    }
  })

  // Module detail pages: the catalogue above describes the repository as a
  // whole, which leaves a new or fast-moving module without a page of its own
  // (and therefore without searchable text). The largest non-trivial modules
  // get a dedicated page inside the remaining page budget, so features such as
  // the Web panel and its routes are represented in the wiki instead of being
  // folded into an unrelated "architecture" page.
  const budget = Math.max(0, maxPages - documents.length)
  const moduleDocs = buildModuleDocuments({ modules, symbols, fileSet, fileImports: context.fileImports, limit: Math.min(8, budget) })
  documents.push(...moduleDocs)

  return {
    version: PLAN_VERSION,
    repowiki: {
      template,
      audience,
      notes: buildNotes(template),
      documents,
    },
    knowledgecard: {
      notes: buildCardNotes(),
    },
  }
}

/**
 * Build one detail page per significant module, largest first.
 *
 * A module is "significant" when it has at least three source files and 120
 * lines; generated/vendor/test directories are skipped because they do not
 * describe the product. The id is stable (`module-<slug>`), so a regenerated
 * plan keeps addressing the same page.
 *
 * @param {{ modules: object[], symbols: object[], fileSet: Set<string>, limit: number }} context
 * @returns {object[]}
 */
function buildModuleDocuments({ modules, symbols, fileSet, fileImports = [], limit }) {
  if (!limit || limit <= 0) return []
  const usedIds = new Set()
  // Rank a module's files by how much structure they carry, not by their
  // alphabetical position: the entry/service/panel files of a module are the
  // ones a reader (and the search index) needs most, and alphabetical order
  // would otherwise bury them behind helpers such as `client-graph.js`.
  const symbolCount = new Map()
  for (const symbol of symbols) {
    if (!symbol?.path) continue
    symbolCount.set(symbol.path, (symbolCount.get(symbol.path) ?? 0) + 1)
  }
  const inbound = new Map()
  for (const pair of fileImports) {
    if (!pair?.to) continue
    inbound.set(pair.to, (inbound.get(pair.to) ?? 0) + 1)
  }
  const priorityName = /(^|\/)(index|main|server|app|service|panel|panel-page|routes?|store|client|graph|scan|plan|render|search|tools)\.(js|mjs|cjs|ts|tsx|py|go|rs)$/
  const fileScore = (file) => {
    const base = file.split('/').pop() ?? file
    const priority = priorityName.test(base) ? 40 : 0
    return priority + (symbolCount.get(file) ?? 0) * 3 + (inbound.get(file) ?? 0) * 12
  }
  const candidates = [...modules]
    .filter((module) => module.path && module.files.length >= 3 && module.size >= 120)
    .filter((module) => !isGeneratedModule(module.path))
    .sort((a, b) => (b.size ?? 0) - (a.size ?? 0) || (a.path < b.path ? -1 : 1))

  const documents = []
  for (const module of candidates) {
    if (documents.length >= limit) break
    const files = [...module.files]
      .filter((file) => fileSet.has(file))
      .sort((a, b) => fileScore(b) - fileScore(a) || (a < b ? -1 : 1))
      .slice(0, 10)
    if (files.length < 2) continue
    const id = `module-${slugify(module.path.replace(/\//g, '-'))}`
    if (!id || usedIds.has(id)) continue
    usedIds.add(id)
    const segments = module.path.split('/').filter(Boolean)
    const label = segments.slice(-2).join('/') || module.path
    documents.push({
      id,
      title: `模块：${label}`,
      goal: `说明 ${module.path} 模块的职责、关键文件、对外接口与依赖关系。`,
      parent: 'architecture',
      hints: ['说明这个模块负责什么、边界在哪里', '列出关键文件与对外符号'],
      sources: {
        files: uniq(files),
        symbols: selectSymbols('modules', files, symbols),
      },
    })
  }
  return documents
}

/** Directories that are generated, vendored or test-only. */
function isGeneratedModule(path) {
  return /(^|\/)(node_modules|vendor|dist|build|out|coverage|test|tests|__tests__|__mocks__|fixtures?|examples?)(\/|$)/i.test(path)
}

/** True when the conditional page has enough evidence to be generated. */
function isApplicable(entry, context) {
  switch (entry.conditional) {
    case 'routes':
      return context.routes.length > 0
    case 'config':
      return context.configKeys.length > 0
    case 'data':
      return context.dataFiles.length > 0
    default:
      return true
  }
}

/** Keep the always-present pages, then the conditional ones, up to `maxPages`. */
function selectWithinBudget(applicable, maxPages) {
  const selected = new Set()
  for (const id of ALWAYS_PRESENT) {
    if (applicable.some((entry) => entry.id === id) && selected.size < maxPages) selected.add(id)
  }
  for (const entry of applicable) {
    if (selected.has(entry.id)) continue
    if (selected.size >= maxPages) break
    selected.add(entry.id)
  }
  return selected
}

/** True when a repository path looks like a data / persistence artefact. */
function isDataFile(file) {
  if (typeof file !== 'string' || !file) return false
  if (DATA_PATH_PATTERN.test(file)) return true
  return file.toLowerCase().endsWith('.sql')
}

/** Pick the source files of one page according to the catalogue rule. */
function selectFiles(docId, context) {
  const { buildFiles, entryPoints, scanDocs, docs, modules, routes, configKeys, dataFiles } = context
  // 每一页从模块里取不同的切片，整本 wiki 才能覆盖到更多文件。
  const rotation = PAGE_FILE_ROTATION[docId] ?? 0
  switch (docId) {
    case 'overview':
      return [
        ...buildFiles.slice(0, 8),
        ...entryPoints.slice(0, 4),
        ...scanDocs.slice(0, 3),
        ...moduleFiles(modules, 3, 5, rotation),
      ]
    case 'concepts':
      return [
        ...docs.slice(0, 2),
        ...entryPoints.slice(0, 2),
        ...moduleFiles(modules, 3, 5, rotation),
      ]
    case 'architecture':
      return [
        ...entryPoints.slice(0, 2),
        ...moduleFiles(modules, 3, 6, rotation),
      ]
    case 'modules':
      return moduleFiles(modules, 3, 8, rotation)
    case 'apis':
      return routes.slice(0, 12).map((route) => route.file)
    case 'data':
      return dataFiles.slice(0, 10)
    case 'config':
      return [
        ...configKeys.slice(0, 8).map((key) => key.file),
        ...moduleFiles(modules, 2, 3, rotation),
      ]
    case 'build':
      return [
        ...buildFiles.slice(0, 8),
        ...entryPoints.slice(0, 3),
        ...moduleFiles(modules, 3, 4, rotation),
      ]
    case 'flows':
      return [
        ...entryPoints,
        ...moduleFiles(modules, 3, 6, rotation),
      ]
    case 'open-questions':
      return [
        ...scanDocs.slice(0, 2),
        ...buildFiles.slice(0, 2),
        ...moduleFiles(modules, 3, 5, rotation),
      ]
    default:
      return []
  }
}

/**
 * Sort modules by relevance: top-level modules first, then by size.
 * Ties are broken by path so the result is stable.
 *
 * The size of a module is its `loc` (non-empty lines) when the index provides
 * it, so that the biggest modules are the most substantial ones.
 */
function largestModules(modules, count) {
  return [...modules]
    .filter((module) => module.firstFile)
    .sort((a, b) => {
      const topA = a.path.split('/').length === 1 ? 0 : 1
      const topB = b.path.split('/').length === 1 ? 0 : 1
      if (topA !== topB) return topA - topB
      if (b.size !== a.size) return b.size - a.size
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
    })
    .slice(0, count)
}

/**
 * Expand the most relevant modules into the files they contain.
 *
 * Using only the first file of a module would leave almost every source file of
 * the repository uncited, so each module contributes several of its files. The
 * `offset` rotates the window inside every module, so two pages do not cite
 * exactly the same files.
 *
 * @param {Array<{path: string, files: string[]}>} modules
 * @param {number} moduleCount - how many modules to take.
 * @param {number} perModule - how many files to take from each module.
 * @param {number} [offset] - rotation of the window inside each module.
 * @returns {string[]}
 */
function moduleFiles(modules, moduleCount, perModule, offset = 0) {
  const files = []
  for (const module of largestModules(modules, moduleCount)) {
    const candidates = module.files?.length ? module.files : (module.firstFile ? [module.firstFile] : [])
    if (!candidates.length) continue
    const start = candidates.length > 0 ? ((offset % candidates.length) + candidates.length) % candidates.length : 0
    for (let index = 0; index < perModule; index++) {
      const file = candidates[(start + index) % candidates.length]
      if (file && !files.includes(file)) files.push(file)
    }
  }
  return files
}

/**
 * Names of the indexed symbols that back one page.
 *
 * The symbols are grouped by the file they live in, the groups follow the
 * order of the page's own source files, and the names are taken round-robin:
 * the first symbol of every file first, then the second symbol of every file,
 * and so on. That way every file of the page contributes its own symbol and two
 * pages with different sources never share the same list.
 *
 * @param {string} docId - the page id (decides which symbol kinds rank first).
 * @param {string[]} files - the source files of the page, in page order.
 * @param {Array<{name: string, path: string, line: number, kind: string}>} symbols
 * @returns {string[]}
 */
function selectSymbols(docId, files, symbols) {
  const focus = [...(PAGE_SYMBOL_FOCUS[docId] ?? []), ...DEFAULT_SYMBOL_FOCUS]
  const rank = new Map()
  focus.forEach((kind, index) => {
    if (!rank.has(kind)) rank.set(kind, index)
  })

  const groups = new Map()
  for (const file of files) {
    if (!file || groups.has(file)) continue
    groups.set(file, [])
  }
  for (const symbol of symbols) {
    const group = groups.get(symbol.path)
    if (!group) continue
    group.push(symbol)
  }
  for (const group of groups.values()) {
    group.sort((a, b) => {
      const rankA = rank.has(a.kind) ? rank.get(a.kind) : rank.size
      const rankB = rank.has(b.kind) ? rank.get(b.kind) : rank.size
      if (rankA !== rankB) return rankA - rankB
      if (a.line !== b.line) return a.line - b.line
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    })
  }

  const names = []
  const seen = new Set()
  const fileOrder = [...groups.keys()]
  const depth = fileOrder.reduce((max, file) => Math.max(max, groups.get(file).length), 0)
  for (let round = 0; round < depth && names.length < MAX_PAGE_SYMBOLS; round++) {
    for (const file of fileOrder) {
      const symbol = groups.get(file)[round]
      if (!symbol || !symbol.name || seen.has(symbol.name)) continue
      seen.add(symbol.name)
      names.push(symbol.name)
      if (names.length >= MAX_PAGE_SYMBOLS) break
    }
  }
  return names
}

/** The generation-context notes stored with the plan. */
function buildNotes(template) {
  return [
    { text: '文档由 dsh-plugin-repowiki 自动生成，请以源码为准。' },
    { text: '所有结论都带有 path:line 形式的源码引用，可据此核对原文。' },
    { text: `页面结构基于「${template}」模板规划，可直接编辑 wiki_plan.yaml 调整。` },
  ]
}

/** The notes stored with the knowledge card section. */
function buildCardNotes() {
  return [{ text: '知识卡片用于向 Agent 快速提供高密度的项目背景与约定。' }]
}

/* ------------------------------------------------------------------ *
 * YAML interchange
 * ------------------------------------------------------------------ */

/**
 * Serialize a plan into the `wiki_plan.yaml` shape.
 *
 * The emitted document is intentionally small: `sources` is *not* written, so a
 * hand-edited plan stays reviewable. Parsing reads `sources` back when it is
 * present.
 *
 * @param {object} plan
 * @returns {string}
 */
export function planToYaml(plan) {
  const repowiki = plan?.repowiki && typeof plan.repowiki === 'object' ? plan.repowiki : {}
  const documents = (Array.isArray(repowiki.documents) ? repowiki.documents : []).map((doc) => {
    const entry = {
      id: doc?.id ?? '',
      title: doc?.title ?? '',
      goal: doc?.goal ?? '',
    }
    if (doc?.parent !== undefined && doc?.parent !== null && doc?.parent !== '') {
      entry.parent = doc.parent
    }
    entry.hints = Array.isArray(doc?.hints) ? doc.hints.map((hint) => String(hint)) : []
    return entry
  })
  const data = {
    version: Number(plan?.version) === PLAN_VERSION ? PLAN_VERSION : PLAN_VERSION,
    repowiki: {
      template: repowiki.template ?? 'architecture',
      audience: repowiki.audience ?? 'engineering',
      notes: normalizeNotes(repowiki.notes),
      documents,
    },
    knowledgecard: {
      notes: normalizeNotes(plan?.knowledgecard?.notes),
    },
  }
  return stringifyYaml(data)
}

/**
 * Parse a `wiki_plan.yaml` document into the in-memory plan shape.
 *
 * @param {string} text
 * @returns {object}
 */
export function parsePlanYaml(text) {
  const raw = parseYaml(text) ?? {}
  const repowiki = raw.repowiki && typeof raw.repowiki === 'object' ? raw.repowiki : {}
  const knowledgecard = raw.knowledgecard && typeof raw.knowledgecard === 'object' ? raw.knowledgecard : {}
  const rawDocuments = Array.isArray(repowiki.documents) ? repowiki.documents : []
  const documents = rawDocuments.map((entry) => {
    const doc = entry && typeof entry === 'object' ? entry : {}
    const title = typeof doc.title === 'string' ? doc.title : ''
    const id = typeof doc.id === 'string' && doc.id ? doc.id : slugify(title, 'doc')
    const parsed = {
      id,
      title,
      goal: typeof doc.goal === 'string' ? doc.goal : '',
    }
    if (doc.parent !== undefined && doc.parent !== null && doc.parent !== '') {
      parsed.parent = String(doc.parent)
    }
    parsed.hints = Array.isArray(doc.hints) ? doc.hints.map((hint) => String(hint)) : []
    parsed.sources = normalizeSources(doc.sources)
    return parsed
  })
  return {
    version: Number(raw.version) === PLAN_VERSION ? PLAN_VERSION : (Number.isFinite(Number(raw.version)) ? Number(raw.version) : PLAN_VERSION),
    repowiki: {
      template: typeof repowiki.template === 'string' ? repowiki.template : 'architecture',
      audience: typeof repowiki.audience === 'string' ? repowiki.audience : 'engineering',
      notes: normalizeNotes(repowiki.notes),
      documents,
    },
    knowledgecard: {
      notes: normalizeNotes(knowledgecard.notes),
    },
  }
}

/** Normalize a notes list into `[{ text }]`. */
function normalizeNotes(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    if (typeof item === 'string') {
      if (item) out.push({ text: item })
      continue
    }
    if (item && typeof item === 'object') {
      const text = typeof item.text === 'string' ? item.text : ''
      if (text) out.push({ text })
    }
  }
  return out
}

/** Normalize a `sources` block into `{ files: string[], symbols: string[] }`. */
function normalizeSources(value) {
  const sources = { files: [], symbols: [] }
  if (!value || typeof value !== 'object') return sources
  if (Array.isArray(value.files)) {
    for (const item of value.files) {
      if (typeof item === 'string' && item) sources.files.push(toPosix(item))
      else if (item && typeof item === 'object') {
        const candidate = item.path ?? item.file
        if (typeof candidate === 'string' && candidate) sources.files.push(toPosix(candidate))
      }
    }
  }
  if (Array.isArray(value.symbols)) {
    for (const item of value.symbols) {
      if (typeof item === 'string' && item) sources.symbols.push(item)
      else if (item && typeof item === 'object') {
        const candidate = item.name ?? item.symbol
        if (typeof candidate === 'string' && candidate) sources.symbols.push(candidate)
      }
    }
  }
  sources.files = uniq(sources.files)
  sources.symbols = uniq(sources.symbols)
  return sources
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

/**
 * Validate a plan.
 *
 * @param {object} plan
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validatePlan(plan) {
  const errors = []
  if (!plan || typeof plan !== 'object') {
    return { ok: false, errors: ['plan: 计划对象缺失或不是对象'] }
  }
  if (plan.version !== PLAN_VERSION) {
    errors.push(`version: 期望 ${PLAN_VERSION}，实际 ${String(plan.version)}`)
  }
  const repowiki = plan.repowiki
  if (!repowiki || typeof repowiki !== 'object') {
    errors.push('repowiki: 缺少 repowiki 配置段')
  }
  const documents = Array.isArray(repowiki?.documents) ? repowiki.documents : []
  if (documents.length === 0) {
    errors.push('repowiki.documents: 文档列表为空')
  }
  if (documents.length > MAX_DOCUMENTS) {
    errors.push(`repowiki.documents: 文档数量 ${documents.length} 超过上限 ${MAX_DOCUMENTS}`)
  }
  const ids = new Set()
  documents.forEach((doc, index) => {
    const label = `documents[${index}]`
    if (!doc || typeof doc !== 'object') {
      errors.push(`${label}: 文档必须是对象`)
      return
    }
    if (typeof doc.id !== 'string' || !doc.id) errors.push(`${label}: 缺少 id`)
    if (typeof doc.title !== 'string' || !doc.title) errors.push(`${label}: 缺少 title`)
    if (typeof doc.goal !== 'string' || !doc.goal) errors.push(`${label}: 缺少 goal`)
    if (typeof doc.id === 'string' && doc.id) {
      if (ids.has(doc.id)) errors.push(`${label}: 重复的 id「${doc.id}」`)
      ids.add(doc.id)
    }
  })
  documents.forEach((doc, index) => {
    const parent = doc?.parent
    if (parent === undefined || parent === null || parent === '') return
    if (!ids.has(parent)) {
      errors.push(`documents[${index}]: 父页面 id「${parent}」不存在`)
    }
  })
  return { ok: errors.length === 0, errors }
}

/* ------------------------------------------------------------------ *
 * Page layout
 * ------------------------------------------------------------------ */

/**
 * Output folder of a page, relative to the language content folder.
 *
 * @param {object|string} doc - a plan document or a bare document id
 * @returns {string}
 */
export function pageDirectory(doc) {
  const id = typeof doc === 'string' ? doc : (doc?.id ?? '')
  if (PAGE_DIRECTORIES[id]) return PAGE_DIRECTORIES[id]
  // Module detail pages live next to the module map they extend.
  if (id.startsWith('module-')) return '10-architecture'
  return '00-overview'
}

/**
 * Output file of a page, relative to the language content folder.
 *
 * @param {object|string} doc - a plan document or a bare document id
 * @returns {string}
 */
export function pageFileName(doc) {
  const id = typeof doc === 'string' ? doc : (doc?.id ?? '')
  return `${pageDirectory(doc)}/${id}.md`
}
