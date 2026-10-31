/**
 * Markdown block parser for the CodeMap plugin.
 *
 * The plugin generates a small, predictable Markdown subset (headings,
 * paragraphs, bullet lists, tables, block quotes, thematic breaks and fenced
 * code / mermaid blocks). This module turns that subset into a flat list of
 * structured blocks that the Web panel can render without a Markdown runtime.
 *
 * The parser is purely structural: it never interprets the semantics of a
 * block and it never throws. Content that cannot be recognised degrades into a
 * paragraph so that no character is lost.
 *
 * The module has no side effects and no third-party dependency.
 */

/** Opening or closing code fence. */
const FENCE_RE = /^ {0,3}```(.*)$/

/** ATX heading: up to three leading spaces, one to six hashes, a space, text. */
const HEADING_RE = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/

/** Thematic break: three or more dashes or asterisks on their own line. */
const HR_RE = /^ {0,3}(?:-{3,}|\*{3,})\s*$/

/** Table separator row: only spaces, pipes, colons and dashes. */
const TABLE_SEPARATOR_RE = /^[\s|:-]+$/

/** Unordered list item. */
const UNORDERED_ITEM_RE = /^ {0,3}([-*+])\s+(.*)$/

/** Ordered list item: a number followed by a dot and a space. */
const ORDERED_ITEM_RE = /^ {0,3}(\d+)\.\s+(.*)$/

/** Block quote line. */
const QUOTE_RE = /^ {0,3}>\s?(.*)$/

/**
 * Parse a Markdown document into a flat list of blocks.
 *
 * @param {string} markdown - the Markdown source
 * @returns {Array<object>} the parsed blocks, in document order
 */
export function parseMarkdownBlocks(markdown) {
  if (typeof markdown !== 'string' || markdown === '') return []

  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks = []

  let paragraph = []
  let list = null
  let quote = null

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') })
    paragraph = []
  }

  const flushList = () => {
    if (!list) return
    blocks.push({ type: 'list', ordered: list.ordered, items: list.items })
    list = null
  }

  const flushQuote = () => {
    if (!quote) return
    blocks.push({ type: 'quote', text: quote.lines.join('\n') })
    quote = null
  }

  const flushAll = () => {
    flushParagraph()
    flushList()
    flushQuote()
  }

  let index = 0
  while (index < lines.length) {
    const line = lines[index]

    if (line.trim() === '') {
      flushAll()
      index += 1
      continue
    }

    const heading = HEADING_RE.exec(line)
    if (heading) {
      flushAll()
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() })
      index += 1
      continue
    }

    if (HR_RE.test(line)) {
      flushAll()
      blocks.push({ type: 'hr' })
      index += 1
      continue
    }

    const fence = FENCE_RE.exec(line)
    if (fence) {
      flushAll()
      const parsed = readFence(lines, index)
      if (parsed.closed) {
        const lang = parsed.lang
        if (lang.toLowerCase() === 'mermaid') {
          blocks.push({ type: 'mermaid', code: parsed.code })
        } else {
          blocks.push({ type: 'code', lang, code: parsed.code })
        }
        index = parsed.next
      } else {
        // Unterminated fence: keep every character as a paragraph.
        blocks.push({ type: 'paragraph', text: lines.slice(index).join('\n') })
        index = lines.length
      }
      continue
    }

    if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      flushAll()
      const table = readTable(lines, index)
      blocks.push(table.block)
      index = table.next
      continue
    }

    const unordered = UNORDERED_ITEM_RE.exec(line)
    const ordered = unordered ? null : ORDERED_ITEM_RE.exec(line)
    if (unordered || ordered) {
      flushParagraph()
      flushQuote()
      if (!list) {
        list = { ordered: Boolean(ordered), items: [] }
      }
      const item = (ordered ? ordered[2] : unordered[2]).trim()
      list.items.push(item)
      index += 1
      continue
    }

    const quoted = QUOTE_RE.exec(line)
    if (quoted) {
      flushParagraph()
      flushList()
      if (!quote) {
        quote = { lines: [] }
      }
      quote.lines.push(quoted[1].trim())
      index += 1
      continue
    }

    flushList()
    flushQuote()
    paragraph.push(line)
    index += 1
  }

  flushAll()
  return blocks
}

/**
 * Read a fenced block.
 *
 * @param {string[]} lines - every line of the document
 * @param {number} start - the index of the opening fence
 * @returns {{ lang: string, code: string, closed: boolean, next: number }}
 */
function readFence(lines, start) {
  const info = String(FENCE_RE.exec(lines[start])?.[1] ?? '').trim()
  const lang = info === '' ? '' : info.split(/\s+/)[0]
  const body = []
  let index = start + 1
  let closed = false
  while (index < lines.length) {
    if (FENCE_RE.test(lines[index])) {
      closed = true
      index += 1
      break
    }
    body.push(lines[index])
    index += 1
  }
  return { lang, code: body.join('\n'), closed, next: index }
}

/**
 * True when the line is a table separator row.
 *
 * @param {string} line - the candidate line
 * @returns {boolean}
 */
function isTableSeparator(line) {
  const text = String(line ?? '')
  if (text.trim() === '') return false
  if (!TABLE_SEPARATOR_RE.test(text)) return false
  return text.includes('-')
}

/**
 * Read a table: a header row, a separator row and every following table row.
 *
 * @param {string[]} lines - every line of the document
 * @param {number} start - the index of the header row
 * @returns {{ block: { type: string, header: string[], rows: string[][] }, next: number }}
 */
function readTable(lines, start) {
  const header = splitRow(lines[start])
  const rows = []
  let index = start + 2
  while (index < lines.length) {
    const line = lines[index]
    if (line.trim() === '' || !line.includes('|')) break
    rows.push(splitRow(line))
    index += 1
  }
  return { block: { type: 'table', header, rows }, next: index }
}

/**
 * Split one table row into its cells.
 *
 * @param {string} line - the raw row
 * @returns {string[]}
 */
function splitRow(line) {
  const text = String(line ?? '').trim()
  const cells = []
  let current = ''
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '\\' && text[index + 1] === '|') {
      current += '|'
      index += 1
      continue
    }
    if (char === '|') {
      cells.push(current)
      current = ''
      continue
    }
    current += char
  }
  cells.push(current)
  if (cells.length > 1 && cells[0].trim() === '') cells.shift()
  if (cells.length > 1 && cells[cells.length - 1].trim() === '') cells.pop()
  return cells.map((cell) => cleanCell(cell))
}

/**
 * Trim a cell and unwrap the backticks that surround it.
 *
 * @param {string} value - the raw cell
 * @returns {string}
 */
function cleanCell(value) {
  const text = String(value ?? '').trim()
  if (text.length >= 2 && text.startsWith('`') && text.endsWith('`')) {
    return text.slice(1, -1).trim()
  }
  return text
}
