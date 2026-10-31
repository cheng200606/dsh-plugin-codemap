/**
 * Persistence layer for the Repo Wiki plugin.
 *
 * Everything the plugin produces lives under `<repo>/<outputDir>`:
 *
 *   wiki_plan.yaml          the human-editable page plan
 *   meta/repowiki.json      the full metadata document (per design §5.9.2)
 *   meta/index.json         the lightweight index used by `wiki_search`
 *   meta/version.json       generator/runtime bookkeeping
 *   content/<lang>/**       the generated pages
 *   knowledge/<lang>/*.md   the generated knowledge cards
 */
import { isAbsolute, join, relative } from 'node:path'
import { hashEntries, nowIso, toPosix, uniq } from './util.js'
import { parseYaml } from './yaml.js'

export const SCHEMA_VERSION = 1
export const GENERATOR_NAME = 'dsh-plugin-repowiki'
export const GENERATOR_VERSION = '0.10.0'

/** Resolve the output directory of a repository (absolute native path). */
export function resolveOutputDir(root, outputDir = '.dsh/repowiki') {
  if (!outputDir) return root
  if (isAbsolute(outputDir)) return outputDir
  const parts = toPosix(outputDir).split('/').filter((part) => part && part !== '.')
  return join(root, ...parts)
}

/** Every path the plugin writes to, for one repository and one language. */
export function layoutFor(root, outputDir = '.dsh/repowiki', language = 'zh') {
  const base = resolveOutputDir(root, outputDir)
  return {
    base,
    contentDir: join(base, 'content', language),
    knowledgeDir: join(base, 'knowledge', language),
    planPath: join(base, 'wiki_plan.yaml'),
    metaPath: join(base, 'meta', 'repowiki.json'),
    indexPath: join(base, 'meta', 'index.json'),
    versionPath: join(base, 'meta', 'version.json'),
  }
}

/** Express an absolute path relative to the repository root, POSIX style. */
export function repoRelative(root, absPath) {
  const rel = relative(root, absPath)
  if (!rel) return '.'
  return toPosix(rel)
}

/** Read a JSON file, returning `null` when it is missing or unparsable. */
export async function readJsonFile(fs, absPath) {
  const text = await fs.readFile(absPath)
  if (text == null) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** Write a JSON file with stable formatting. */
export async function writeJsonFile(fs, absPath, value, options = {}) {
  await fs.writeFile(absPath, `${JSON.stringify(value, null, 2)}\n`, options)
}

/** Normalise one page entry of `meta/repowiki.json`. */
export function normalizePageMeta(page) {
  return {
    id: page.id,
    title: page.title,
    path: page.path,
    parent: page.parent ?? null,
    goal: page.goal ?? '',
    status: page.status ?? 'draft',
    sources: {
      globs: page.sources?.globs ?? [],
      files: page.sources?.files ?? [],
      symbols: page.sources?.symbols ?? [],
      routes: page.sources?.routes ?? [],
      configKeys: page.sources?.configKeys ?? [],
    },
    hashes: {
      inputs: page.hashes?.inputs ?? null,
      output: page.hashes?.output ?? null,
    },
    citations: page.citations ?? [],
    confidence: page.confidence ?? 'medium',
    generatedAt: page.generatedAt ?? nowIso(),
  }
}

/** Build the `meta/repowiki.json` document (design §5.9.2). */
export function buildMetadata({ generatedAt, repo = {}, plan = {}, pages = [], cards = [], stats = {} } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generator: { name: GENERATOR_NAME, version: GENERATOR_VERSION },
    repo: {
      head: repo.head ?? null,
      branch: repo.branch ?? null,
      dirty: Boolean(repo.dirty),
      fileCount: repo.fileCount ?? 0,
      loc: repo.loc ?? 0,
      languages: repo.languages ?? {},
    },
    plan: {
      template: plan.template ?? 'architecture',
      audience: plan.audience ?? 'engineering',
      pageCount: pages.length,
    },
    pages: pages.map(normalizePageMeta),
    cards: cards.map((card) => ({
      id: card.id,
      title: card.title,
      path: card.path ?? null,
      tags: card.tags ?? [],
      tag: card.tag ?? (card.tags ?? [])[0] ?? '',
      summary: card.summary ?? '',
      parent: card.parent ?? null,
    })),
    stats: {
      modelCalls: stats.modelCalls ?? 0,
      tokensIn: stats.tokensIn ?? 0,
      tokensOut: stats.tokensOut ?? 0,
      durationMs: stats.durationMs ?? 0,
    },
    generatedAt: generatedAt ?? nowIso(),
  }
}

/** Build the lightweight `meta/index.json` used by the retrieval tools. */
export function buildIndexMeta(meta) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generator: meta.generator,
    generatedAt: meta.generatedAt,
    pages: meta.pages.map((page) => ({
      id: page.id,
      title: page.title,
      path: page.path,
      parent: page.parent,
      goal: page.goal,
      status: page.status,
      keywords: uniq([...page.sources.symbols, ...page.sources.configKeys]),
      sources: page.sources.files,
      symbols: page.sources.symbols,
      confidence: page.confidence,
      generatedAt: page.generatedAt,
    })),
  }
}

/** Hash of the inputs a page was generated from. */
export function hashInputs(entries) {
  return hashEntries(entries ?? [])
}

/** Parse the YAML frontmatter of a generated page. */
export function parseFrontmatter(markdown) {
  if (typeof markdown !== 'string') return { data: {}, body: '' }
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown)
  if (!match) return { data: {}, body: markdown }
  let data = {}
  try {
    data = parseYaml(match[1]) ?? {}
  } catch {
    data = {}
  }
  return { data, body: markdown.slice(match[0].length) }
}

/* ------------------------------------------------------------------ *
 * Read / write helpers                                               *
 * ------------------------------------------------------------------ */

export async function loadMetadata(fs, root, outputDir) {
  return readJsonFile(fs, layoutFor(root, outputDir).metaPath)
}

export async function saveMetadata(fs, root, outputDir, meta) {
  const layout = layoutFor(root, outputDir)
  await writeJsonFile(fs, layout.metaPath, meta, { workspaceRoot: root })
}

export async function loadIndex(fs, root, outputDir) {
  return readJsonFile(fs, layoutFor(root, outputDir).indexPath)
}

export async function saveIndex(fs, root, outputDir, index) {
  const layout = layoutFor(root, outputDir)
  await writeJsonFile(fs, layout.indexPath, index, { workspaceRoot: root })
}

export async function loadVersion(fs, root, outputDir) {
  return readJsonFile(fs, layoutFor(root, outputDir).versionPath)
}

export async function saveVersion(fs, root, outputDir, value) {
  const layout = layoutFor(root, outputDir)
  await writeJsonFile(fs, layout.versionPath, value, { workspaceRoot: root })
}

export async function loadPlanText(fs, root, outputDir) {
  return fs.readFile(layoutFor(root, outputDir).planPath)
}

export async function savePlanText(fs, root, outputDir, text) {
  const layout = layoutFor(root, outputDir)
  await fs.writeFile(layout.planPath, text, { workspaceRoot: root })
}

/** Write one generated page below `content/<language>/`. */
export async function savePageFile(fs, { root, outputDir, language, relativePath, markdown }) {
  const layout = layoutFor(root, outputDir, language)
  const abs = join(layout.contentDir, ...toPosix(relativePath).split('/'))
  await fs.writeFile(abs, markdown, { workspaceRoot: root })
  return { path: repoRelative(root, abs), abs }
}

/** Read one generated page below `content/<language>/`. */
export async function readPageFile(fs, { root, outputDir, language, relativePath }) {
  const layout = layoutFor(root, outputDir, language)
  const abs = join(layout.contentDir, ...toPosix(relativePath).split('/'))
  const markdown = await fs.readFile(abs)
  if (markdown == null) return null
  return { path: repoRelative(root, abs), abs, markdown }
}

/** Write one knowledge card below `knowledge/<language>/`. */
export async function saveCardFile(fs, { root, outputDir, language, relativePath, markdown }) {
  const layout = layoutFor(root, outputDir, language)
  const abs = join(layout.knowledgeDir, ...toPosix(relativePath).split('/'))
  await fs.writeFile(abs, markdown, { workspaceRoot: root })
  return { path: repoRelative(root, abs), abs }
}

/** List every page recorded in `meta/repowiki.json` for one language. */
export function pagesOfLanguage(meta, language) {
  if (!meta || !Array.isArray(meta.pages)) return []
  const prefix = `.dsh/repowiki/content/${language}/`
  return meta.pages.filter((page) => {
    const path = page.path ?? ''
    return path.includes(`/content/${language}/`) || path.startsWith(`content/${language}/`)
  })
}
