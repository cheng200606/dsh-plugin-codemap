/**
 * Markdown rendering for the Repo Wiki plugin.
 *
 * The renderer is pure and deterministic: given the same evidence pack and the
 * same page metadata it always produces byte-identical markdown. It never
 * touches the file system and never invents content that is not backed by an
 * evidence pack.
 *
 * Every citation is emitted as a backticked `path:startLine-endLine` token so
 * that `verify.js` can check it against the real repository content.
 */
import { stringifyYaml } from './yaml.js'
import { toPosix, uniq } from './util.js'

/* ------------------------------------------------------------------ *
 * Frontmatter
 * ------------------------------------------------------------------ */

/**
 * Render the YAML frontmatter block of a page.
 *
 * The key order is fixed: id, title, goal, status, parent, sources, symbols,
 * generated_at, source_hash, confidence.
 *
 * @param {object} meta - page metadata
 * @returns {string} the frontmatter block including the `---` fences
 */
export function renderFrontmatter(meta = {}) {
  const data = {
    id: stringOrEmpty(meta?.id),
    title: stringOrEmpty(meta?.title),
    goal: stringOrEmpty(meta?.goal),
    status: stringOrEmpty(meta?.status) || 'draft',
    parent: meta?.parent === undefined || meta?.parent === null || meta?.parent === '' ? null : String(meta.parent),
    sources: stringArray(meta?.sources),
    symbols: stringArray(meta?.symbols),
    generated_at: stringOrEmpty(meta?.generatedAt),
    source_hash: stringOrEmpty(meta?.sourceHash),
    confidence: stringOrEmpty(meta?.confidence) || 'medium',
  }
  return `---\n${stringifyYaml(data)}\n---\n`
}

/* ------------------------------------------------------------------ *
 * Page rendering
 * ------------------------------------------------------------------ */

/**
 * Render one wiki page: frontmatter plus the fixed body sections.
 *
 * @param {object} pack - an evidence pack
 * @param {object} meta - page metadata
 * @returns {string}
 */
export function renderPage(pack, meta = {}) {
  const front = renderFrontmatter(meta)
  const sections = [
    renderScope(pack, meta),
    renderClaims(pack),
    renderDiagram(pack, meta),
    renderDetails(pack),
    renderSourceIndex(pack),
    renderOpenQuestions(pack),
  ]
  const title = stringOrEmpty(meta?.title)
  const body = [`# ${title}`, '', ...sections].join('\n\n')
  return `${front}\n${body}`
}

/** `## 这一页回答什么` — scope and explicit non-scope. */
function renderScope(pack, meta) {
  const goal = stringOrEmpty(pack?.goal) || stringOrEmpty(meta?.goal) || '本页目标待补充。'
  const title = stringOrEmpty(meta?.title) || '本页'
  const scope = `本页回答：${goal}`
  const notCovered = `本页不覆盖：与「${title}」无关的实现细节、其他模块的内部逻辑，以及必须运行仓库才能确认的运行时行为。`
  return ['## 这一页回答什么', '', scope, '', notCovered].join('\n')
}

/** `## 关键结论` — one bullet per claim, each with its citations. */
function renderClaims(pack) {
  const claims = Array.isArray(pack?.claims) ? pack.claims : []
  const lines = ['## 关键结论', '']
  if (claims.length === 0) {
    lines.push('- 暂无。')
    return lines.join('\n')
  }
  for (const claim of claims) {
    const text = stringOrEmpty(claim?.claim)
    if (!text) continue
    const citations = formatCitations(claim?.citations)
    lines.push(citations ? `- ${text}（证据：${citations}）` : `- ${text}`)
  }
  if (lines.length === 2) lines.push('- 暂无。')
  return lines.join('\n')
}

/** Format the citations of one claim as backticked `path:start-end` tokens. */
function formatCitations(citations) {
  if (!Array.isArray(citations)) return ''
  const tokens = []
  for (const citation of citations) {
    if (!citation || typeof citation !== 'object') continue
    const path = toPosix(stringOrEmpty(citation.path))
    const start = toPositiveInt(citation.startLine)
    const end = toPositiveInt(citation.endLine ?? citation.startLine)
    if (!path || !start) continue
    const from = Math.min(start, end)
    const to = Math.max(start, end)
    const token = `\`${path}:${from}-${to}\``
    if (!tokens.includes(token)) tokens.push(token)
  }
  return tokens.join('、')
}

/** `## 结构与流程` — a mermaid diagram derived from the page id. */
function renderDiagram(pack, meta) {
  const id = stringOrEmpty(meta?.id) || stringOrEmpty(pack?.pageId)
  const body = buildMermaid(id, pack)
  return ['## 结构与流程', '', '```mermaid', 'graph TD', body, '```'].join('\n')
}

/** `## 实现细节` — one bullet per key file. */
function renderDetails(pack) {
  const keyFiles = Array.isArray(pack?.keyFiles) ? pack.keyFiles : []
  const lines = ['## 实现细节', '']
  if (keyFiles.length === 0) {
    lines.push('- 暂无。')
    return lines.join('\n')
  }
  for (const file of keyFiles) {
    const path = toPosix(stringOrEmpty(file?.path))
    if (!path) continue
    const role = stringOrEmpty(file?.role) || 'core'
    lines.push(`- \`${path}\`（${role}）：${describeRole(role)}`)
  }
  if (lines.length === 2) lines.push('- 暂无。')
  return lines.join('\n')
}

/** Chinese one-liner describing the role of a key file. */
function describeRole(role) {
  switch (role) {
    case 'entry':
      return '仓库或模块的入口文件，调用从这里进入。'
    case 'config':
      return '构建、依赖或配置相关文件，决定运行与打包方式。'
    case 'doc':
      return '说明性文档，用于补充背景信息。'
    case 'test':
      return '测试文件，用于验证行为与边界条件。'
    case 'core':
      return '核心实现文件，承载本页的主要逻辑。'
    default:
      return '本页涉及的关键文件。'
  }
}

/** `## 源码索引` — the markdown table of the key files. */
function renderSourceIndex(pack) {
  const keyFiles = Array.isArray(pack?.keyFiles) ? pack.keyFiles : []
  const claims = Array.isArray(pack?.claims) ? pack.claims : []
  const symbolsByPath = new Map()
  for (const claim of claims) {
    const citations = Array.isArray(claim?.citations) ? claim.citations : []
    for (const citation of citations) {
      if (!citation || typeof citation !== 'object') continue
      const path = toPosix(stringOrEmpty(citation.path))
      const symbol = stringOrEmpty(citation.symbol)
      if (!path || !symbol) continue
      if (!symbolsByPath.has(path)) symbolsByPath.set(path, [])
      const list = symbolsByPath.get(path)
      if (!list.includes(symbol)) list.push(symbol)
    }
  }
  const lines = ['## 源码索引', '', '| 文件 | 作用 | 关键符号 |', '| --- | --- | --- |']
  if (keyFiles.length === 0) {
    lines.push('| - | 暂无 | - |')
    return lines.join('\n')
  }
  for (const file of keyFiles) {
    const path = toPosix(stringOrEmpty(file?.path))
    if (!path) continue
    const role = stringOrEmpty(file?.role) || 'core'
    const symbols = symbolsByPath.get(path) ?? []
    const symbolCell = symbols.length > 0 ? symbols.map((symbol) => `\`${symbol}\``).join('、') : '-'
    lines.push(`| \`${path}\` | ${describeRole(role)} | ${symbolCell} |`)
  }
  return lines.join('\n')
}

/** `## 未决问题` — the open questions of the pack. */
function renderOpenQuestions(pack) {
  const questions = Array.isArray(pack?.openQuestions) ? pack.openQuestions : []
  const lines = ['## 未决问题', '']
  const usable = questions.map((question) => stringOrEmpty(question)).filter(Boolean)
  if (usable.length === 0) {
    lines.push('- 暂无。')
    return lines.join('\n')
  }
  for (const question of usable) lines.push(`- ${question}`)
  return lines.join('\n')
}

/* ------------------------------------------------------------------ *
 * Mermaid diagrams
 * ------------------------------------------------------------------ */

/**
 * Build the mermaid body of the `结构与流程` section.
 *
 * @param {string} id - the page id
 * @param {object} pack - the evidence pack
 * @returns {string}
 */
function buildMermaid(id, pack) {
  const keyFiles = Array.isArray(pack?.keyFiles) ? pack.keyFiles : []
  const claims = Array.isArray(pack?.claims) ? pack.claims : []
  switch (id) {
    case 'overview':
    case 'architecture':
      return moduleGraph(keyFiles, '仓库')
    case 'modules':
      return moduleTreeGraph(keyFiles)
    case 'apis':
      return routeGraph(claims, keyFiles)
    case 'config':
      return configGraph(claims, keyFiles)
    case 'data':
      return fileGraph(keyFiles, '数据与持久化')
    case 'flows':
      return flowGraph(keyFiles)
    case 'build':
      return buildGraph(keyFiles)
    default:
      return simpleGraph(keyFiles)
  }
}

/** Root node plus one node per top-level module. */
function moduleGraph(keyFiles, rootLabel) {
  const paths = keyFiles.map((file) => toPosix(stringOrEmpty(file?.path)))
  // Top-level *directories* describe the module layout; loose files such as
  // `README.md` are only used when the page has no directory at all.
  const directories = paths.filter((path) => path.includes('/')).map((path) => topSegment(path))
  const modules = uniq(directories.length > 0 ? directories : paths.map((path) => topSegment(path))).filter(Boolean)
  const lines = []
  let counter = 0
  const root = `n${counter++}`
  lines.push(`  ${root}["「${sanitizeLabel(rootLabel)}」"]`)
  if (modules.length === 0) {
    lines.push(`  ${root} --> ${`n${counter}`}["「暂无模块信息」"]`)
    return lines.join('\n')
  }
  for (const module of modules) {
    const node = `n${counter++}`
    lines.push(`  ${root} --> ${node}["「${sanitizeLabel(module)}」"]`)
  }
  return lines.join('\n')
}

/** Root node, top-level modules and the files they contain. */
function moduleTreeGraph(keyFiles) {
  const lines = []
  let counter = 0
  const root = `n${counter++}`
  lines.push(`  ${root}["「仓库」"]`)
  const groups = new Map()
  for (const file of keyFiles) {
    const path = toPosix(stringOrEmpty(file?.path))
    if (!path) continue
    const segment = topSegment(path)
    if (!segment) continue
    if (!groups.has(segment)) groups.set(segment, [])
    groups.get(segment).push(path)
  }
  for (const [segment, files] of groups) {
    const moduleNode = `n${counter++}`
    lines.push(`  ${root} --> ${moduleNode}["「${sanitizeLabel(segment)}」"]`)
    for (const file of files.slice(0, 4)) {
      const fileNode = `n${counter++}`
      lines.push(`  ${moduleNode} --> ${fileNode}["「${sanitizeLabel(file)}」"]`)
    }
  }
  if (lines.length === 1) {
    lines.push(`  ${root} --> n${counter}["「暂无模块信息」"]`)
  }
  return lines.join('\n')
}

/** The exposed routes as nodes. */
function routeGraph(claims, keyFiles) {
  const lines = []
  let counter = 0
  const root = `n${counter++}`
  lines.push(`  ${root}["「对外接口」"]`)
  let found = 0
  for (const claim of claims) {
    const text = stringOrEmpty(claim?.claim)
    const match = /^路由\s+(.+?)\s+在\s/.exec(text)
    if (!match) continue
    const citation = (Array.isArray(claim?.citations) ? claim.citations : [])[0]
    const path = toPosix(stringOrEmpty(citation?.path))
    const routeNode = `n${counter++}`
    lines.push(`  ${root} --> ${routeNode}["「${sanitizeLabel(match[1])}」"]`)
    if (path) {
      const fileNode = `n${counter++}`
      lines.push(`  ${routeNode} --> ${fileNode}["「${sanitizeLabel(path)}」"]`)
    }
    found++
  }
  if (found === 0) {
    for (const file of keyFiles) {
      const path = toPosix(stringOrEmpty(file?.path))
      if (!path) continue
      const node = `n${counter++}`
      lines.push(`  ${root} --> ${node}["「${sanitizeLabel(path)}」"]`)
    }
  }
  if (lines.length === 1) {
    lines.push(`  ${root} --> n${counter}["「暂无接口信息」"]`)
  }
  return lines.join('\n')
}

/** The configuration keys as nodes. */
function configGraph(claims, keyFiles) {
  const lines = []
  let counter = 0
  const root = `n${counter++}`
  lines.push(`  ${root}["「配置」"]`)
  let found = 0
  for (const claim of claims) {
    const text = stringOrEmpty(claim?.claim)
    const match = /^配置项\s+(.+?)\s+在\s/.exec(text)
    if (!match) continue
    const node = `n${counter++}`
    lines.push(`  ${root} --> ${node}["「${sanitizeLabel(match[1])}」"]`)
    found++
  }
  if (found === 0) {
    for (const file of keyFiles) {
      const path = toPosix(stringOrEmpty(file?.path))
      if (!path) continue
      const node = `n${counter++}`
      lines.push(`  ${root} --> ${node}["「${sanitizeLabel(path)}」"]`)
    }
  }
  if (lines.length === 1) {
    lines.push(`  ${root} --> n${counter}["「暂无配置信息」"]`)
  }
  return lines.join('\n')
}

/** The data files as nodes. */
function fileGraph(keyFiles, rootLabel) {
  const lines = []
  let counter = 0
  const root = `n${counter++}`
  lines.push(`  ${root}["「${sanitizeLabel(rootLabel)}」"]`)
  for (const file of keyFiles) {
    const path = toPosix(stringOrEmpty(file?.path))
    if (!path) continue
    const node = `n${counter++}`
    lines.push(`  ${root} --> ${node}["「${sanitizeLabel(path)}」"]`)
  }
  if (lines.length === 1) {
    lines.push(`  ${root} --> n${counter}["「暂无数据文件」"]`)
  }
  return lines.join('\n')
}

/** Entry -> module -> file chain. */
function flowGraph(keyFiles) {
  const lines = []
  let counter = 0
  const root = `n${counter++}`
  lines.push(`  ${root}["「入口」"]`)
  const entries = keyFiles.filter((file) => file?.role === 'entry')
  const others = keyFiles.filter((file) => file?.role !== 'entry')
  const entryNodes = []
  for (const file of entries) {
    const path = toPosix(stringOrEmpty(file?.path))
    if (!path) continue
    const node = `n${counter++}`
    lines.push(`  ${root} --> ${node}["「${sanitizeLabel(path)}」"]`)
    entryNodes.push(node)
  }
  const moduleNodes = new Map()
  for (const file of others) {
    const path = toPosix(stringOrEmpty(file?.path))
    if (!path) continue
    const segment = topSegment(path)
    if (!segment) continue
    if (!moduleNodes.has(segment)) {
      const node = `n${counter++}`
      moduleNodes.set(segment, node)
      const parent = entryNodes.length > 0 ? entryNodes[0] : root
      lines.push(`  ${parent} --> ${node}["「${sanitizeLabel(segment)}」"]`)
    }
    const fileNode = `n${counter++}`
    lines.push(`  ${moduleNodes.get(segment)} --> ${fileNode}["「${sanitizeLabel(path)}」"]`)
  }
  if (lines.length === 1) {
    lines.push(`  ${root} --> n${counter}["「暂无链路信息」"]`)
  }
  return lines.join('\n')
}

/** The build files as nodes. */
function buildGraph(keyFiles) {
  const lines = []
  let counter = 0
  const root = `n${counter++}`
  lines.push(`  ${root}["「构建与运行」"]`)
  const buildFiles = keyFiles.filter((file) => file?.role === 'config')
  const list = buildFiles.length > 0 ? buildFiles : keyFiles
  for (const file of list) {
    const path = toPosix(stringOrEmpty(file?.path))
    if (!path) continue
    const node = `n${counter++}`
    lines.push(`  ${root} --> ${node}["「${sanitizeLabel(path)}」"]`)
  }
  if (lines.length === 1) {
    lines.push(`  ${root} --> n${counter}["「暂无构建文件」"]`)
  }
  return lines.join('\n')
}

/** A minimal two-node graph. */
function simpleGraph(keyFiles) {
  const lines = []
  let counter = 0
  const root = `n${counter++}`
  lines.push(`  ${root}["「本页」"]`)
  const files = keyFiles.filter((file) => toPosix(stringOrEmpty(file?.path)))
  if (files.length === 0) {
    lines.push(`  ${root} --> n${counter}["「暂无关键文件」"]`)
    return lines.join('\n')
  }
  const first = toPosix(stringOrEmpty(files[0].path))
  const firstNode = `n${counter++}`
  lines.push(`  ${root} --> ${firstNode}["「${sanitizeLabel(first)}」"]`)
  for (const file of files.slice(1, 5)) {
    const path = toPosix(stringOrEmpty(file?.path))
    if (!path) continue
    const node = `n${counter++}`
    lines.push(`  ${firstNode} --> ${node}["「${sanitizeLabel(path)}」"]`)
  }
  return lines.join('\n')
}

/* ------------------------------------------------------------------ *
 * Landing page and knowledge card
 * ------------------------------------------------------------------ */

/**
 * Render the landing page that links every generated page.
 *
 * @param {Array<{id: string, title: string, path: string, status: string, goal: string}>} pages
 * @param {{ title?: string, generatedAt?: string }} [meta]
 * @returns {string}
 */
export function renderIndexPage(pages, meta = {}) {
  const title = stringOrEmpty(meta?.title) || '仓库 Wiki'
  const generatedAt = stringOrEmpty(meta?.generatedAt)
  const list = Array.isArray(pages) ? pages : []
  const lines = [`# ${title}`, '']
  lines.push(generatedAt
    ? `本页是仓库 Wiki 的导航入口，收录 ${list.length} 个页面；生成时间：${generatedAt}。`
    : `本页是仓库 Wiki 的导航入口，收录 ${list.length} 个页面。`)
  lines.push('')
  lines.push('| 页面 | 说明 | 状态 |')
  lines.push('| --- | --- | --- |')
  if (list.length === 0) {
    lines.push('| - | 暂无页面 | - |')
  }
  for (const page of list) {
    const pageTitle = stringOrEmpty(page?.title) || stringOrEmpty(page?.id) || '未命名页面'
    const link = page?.path ? `[${pageTitle}](./${toPosix(String(page.path))})` : pageTitle
    const goal = stringOrEmpty(page?.goal) || '-'
    const status = stringOrEmpty(page?.status) || 'draft'
    lines.push(`| ${link} | ${goal} | ${status} |`)
  }
  return lines.join('\n')
}

/**
 * Render a knowledge card.
 *
 * @param {{ id?: string, title?: string, summary?: string, links?: Array<{title: string, path: string}>, tags?: string[], parent?: {id: string, title?: string}, children?: Array<{id: string, title?: string}> }} card
 * @param {object} [meta]
 * @returns {string}
 */
export function renderCard(card, meta = {}) {
  const title = stringOrEmpty(card?.title) || stringOrEmpty(card?.id) || '知识卡片'
  const summary = stringOrEmpty(card?.summary)
  const links = Array.isArray(card?.links) ? card.links : []
  const tags = stringArray(card?.tags)
  const children = Array.isArray(card?.children) ? card.children.filter((child) => child && child.id) : []
  const parent = card?.parent && card.parent.id ? card.parent : null
  const lines = [`# ${title}`, '']
  lines.push(summary || '暂无摘要。')
  lines.push('')
  if (children.length > 0) {
    lines.push('## 包含知识')
    lines.push('')
    for (const child of children) {
      lines.push(`- ${stringOrEmpty(child.title) || child.id}：\`card:${child.id}\``)
    }
    lines.push('')
  }
  if (parent) {
    lines.push('## 父级知识')
    lines.push('')
    lines.push(`- ${stringOrEmpty(parent.title) || parent.id}：\`card:${parent.id}\``)
    lines.push('')
  }
  lines.push('## 相关页面')
  lines.push('')
  if (links.length === 0) {
    lines.push('- 暂无。')
  }
  for (const link of links) {
    const linkTitle = stringOrEmpty(link?.title) || stringOrEmpty(link?.path) || '未命名页面'
    const path = toPosix(stringOrEmpty(link?.path))
    lines.push(path ? `- [${linkTitle}](./${path})` : `- ${linkTitle}`)
  }
  lines.push('')
  lines.push('## 标签')
  lines.push('')
  lines.push(tags.length > 0 ? tags.map((tag) => `\`${tag}\``).join('、') : '暂无。')
  return lines.join('\n')
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

/** String value or an empty string. */
function stringOrEmpty(value) {
  return typeof value === 'string' ? value : (value === undefined || value === null ? '' : String(value))
}

/** Normalize a value into a list of non-empty strings. */
function stringArray(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    const text = stringOrEmpty(item)
    if (text) out.push(text)
  }
  return out
}

/** A positive integer or 0. */
function toPositiveInt(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : 0
}

/** The first path segment of a repo-relative path. */
function topSegment(path) {
  const normalized = toPosix(stringOrEmpty(path))
  if (!normalized) return ''
  const parts = normalized.split('/')
  return parts[0] ?? ''
}

/**
 * Make a label safe for mermaid: no quotes, brackets or other characters that
 * would break the diagram syntax.
 */
function sanitizeLabel(label) {
  return String(label ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/["'`]/g, '')
    .replace(/[[\]{}()<>|]/g, '')
    .replace(/[#&;]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
