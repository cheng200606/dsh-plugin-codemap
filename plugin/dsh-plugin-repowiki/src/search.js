/**
 * Deterministic retrieval over the generated wiki.
 *
 * The index is intentionally simple and explainable: a weighted token overlap
 * with an inverse-document-frequency correction. It works for latin scripts and
 * for CJK text (handled through character bigrams), and it never needs a model.
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'is', 'are', 'for', 'on', 'with',
  '如何', '什么', '的', '了', '和', '与', '是', '在', '有', '为', '对',
])

/** Split a text into searchable tokens (latin words + CJK bigrams). */
export function tokenize(text) {
  if (!text) return []
  const tokens = []
  const lowered = String(text).toLowerCase()
  const latin = lowered.match(/[a-z0-9_][a-z0-9_.-]*/g) ?? []
  for (const word of latin) {
    if (word.length < 2 && !/^\d+$/.test(word)) continue
    if (STOP_WORDS.has(word)) continue
    tokens.push(word)
  }
  const cjkRuns = lowered.match(/[\u3400-\u9fff\uf900-\ufaff]+/g) ?? []
  for (const run of cjkRuns) {
    if (run.length === 1) {
      tokens.push(run)
      continue
    }
    for (let i = 0; i < run.length - 1; i += 1) tokens.push(run.slice(i, i + 2))
  }
  return tokens
}

/** Build the searchable text of one page entry. */
export function buildDocument(entry) {
  const body = entry.body ?? ''
  return {
    id: entry.id,
    title: entry.title ?? '',
    goal: entry.goal ?? '',
    keywords: (entry.keywords ?? []).join(' '),
    sources: (entry.sources ?? []).join(' '),
    body,
  }
}

/**
 * Score one document against a query.
 * @returns {{ score: number, matched: string[] }}
 */
export function scoreDocument(document, queryTokens, idf) {
  const fields = {
    title: tokenize(document.title),
    goal: tokenize(document.goal),
    keywords: tokenize(document.keywords),
    sources: tokenize(document.sources),
    body: tokenize(document.body),
  }
  const weights = { title: 4, goal: 2.5, keywords: 2, sources: 1, body: 1 }
  let score = 0
  const matched = []
  for (const token of queryTokens) {
    let fieldScore = 0
    for (const [field, tokens] of Object.entries(fields)) {
      const hits = tokens.filter((candidate) => candidate === token || candidate.startsWith(token)).length
      if (!hits) continue
      fieldScore += weights[field] * Math.min(hits, 4)
      if (!matched.includes(token)) matched.push(token)
    }
    if (!fieldScore) continue
    score += fieldScore * (idf.get(token) ?? 1)
  }
  return { score, matched }
}

/** Inverse document frequency over the candidate set. */
export function buildIdf(documents) {
  const idf = new Map()
  const counts = new Map()
  for (const document of documents) {
    const tokens = new Set([
      ...tokenize(document.title),
      ...tokenize(document.goal),
      ...tokenize(document.keywords),
    ])
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1)
  }
  const total = Math.max(documents.length, 1)
  for (const [token, count] of counts) idf.set(token, Math.log((total + 1) / (count + 0.5)) + 1)
  return idf
}

/** Extract a short snippet around the first matching token of the body. */
export function makeSnippet(body, matched, length = 180) {
  if (!body) return ''
  const text = body.replace(/^#.*$/gm, '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (!matched.length) return text.slice(0, length)
  const lower = text.toLowerCase()
  let position = -1
  for (const token of matched) {
    const found = lower.indexOf(token.toLowerCase())
    if (found >= 0 && (position < 0 || found < position)) position = found
  }
  if (position < 0) return text.slice(0, length)
  const start = Math.max(0, position - Math.floor(length / 3))
  return `${start > 0 ? '…' : ''}${text.slice(start, start + length)}${start + length < text.length ? '…' : ''}`
}

/**
 * Rank page entries against a query.
 * @param {Array<object>} entries - page metadata (title/goal/keywords/sources/body)
 * @param {string} query
 * @param {{ limit?: number, minScore?: number }} [options]
 * @returns {Array<object>} hits sorted by descending score
 */
export function searchPages(entries, query, options = {}) {
  const limit = options.limit ?? 8
  const minScore = options.minScore ?? 0.05
  const queryTokens = [...new Set(tokenize(query))]
  if (!queryTokens.length) return []
  const documents = entries.map(buildDocument)
  const idf = buildIdf(documents)
  const hits = []
  for (let i = 0; i < documents.length; i += 1) {
    const document = documents[i]
    const { score, matched } = scoreDocument(document, queryTokens, idf)
    if (score <= minScore) continue
    const entry = entries[i]
    hits.push({
      id: entry.id,
      title: entry.title ?? '',
      goal: entry.goal ?? '',
      path: entry.path ?? '',
      status: entry.status ?? 'draft',
      confidence: entry.confidence ?? 'medium',
      sources: entry.sources ?? [],
      score: Number(score.toFixed(3)),
      matched,
      snippet: makeSnippet(document.body, matched),
    })
  }
  hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  return hits.slice(0, limit)
}
