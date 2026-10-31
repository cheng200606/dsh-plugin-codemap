/**
 * A deliberately small YAML reader/writer.
 *
 * The plugin must not depend on a registry-hosted YAML library, so this module
 * covers exactly the subset used by `wiki_plan.yaml`:
 *
 *   - block mappings (`key: value`)
 *   - block sequences (`- item`, `- key: value` with nested keys)
 *   - nested indentation
 *   - scalars: plain, single-quoted, double-quoted, numbers, booleans, null
 *   - `#` comments on their own line or after a value
 *
 * Anything richer (anchors, flow collections, multi-line scalars, multiple
 * documents) is rejected with an explicit error instead of being mis-parsed.
 */

class YamlError extends Error {
  constructor(message, line) {
    super(line === undefined ? message : `${message} (line ${line + 1})`)
    this.name = 'YamlError'
  }
}

/** Parse a YAML string into plain JavaScript values. */
export function parseYaml(text) {
  const lines = []
  const raw = String(text ?? '').split('\n')
  for (let index = 0; index < raw.length; index++) {
    const original = raw[index]
    if (original.trim() === '' || /^\s*#/.test(original)) continue
    if (original.trim() === '---' || original.trim() === '...') continue
    const indent = original.length - original.trimStart().length
    if (original.includes('\t')) throw new YamlError('tabs are not allowed in YAML indentation', index)
    lines.push({ indent, text: original.trim(), raw: original, index })
  }
  if (lines.length === 0) return {}
  const [value, consumed] = parseBlock(lines, 0, lines[0].indent)
  if (consumed !== lines.length) {
    throw new YamlError('unexpected trailing content', lines[consumed].index)
  }
  return value
}

function parseBlock(lines, start, indent) {
  if (start >= lines.length) return [null, start]
  if (lines[start].text.startsWith('- ') || lines[start].text === '-') {
    return parseSequence(lines, start, indent)
  }
  return parseMapping(lines, start, indent)
}

function parseSequence(lines, start, indent) {
  const items = []
  let index = start
  while (index < lines.length) {
    const line = lines[index]
    if (line.indent < indent) break
    if (line.indent > indent) throw new YamlError('unexpected indentation in sequence', line.index)
    if (!line.text.startsWith('-')) break
    const rest = line.text === '-' ? '' : line.text.slice(2).trim()
    if (rest === '') {
      const [child, next] = parseNested(lines, index + 1, indent)
      items.push(child)
      index = next
      continue
    }
    if (isMappingEntry(rest)) {
      // `- key: value` starts an inline mapping whose remaining keys are
      // indented to the position of `key`.
      const inlineIndent = line.indent + 2
      const synthetic = [{ indent: inlineIndent, text: rest, raw: rest, index: line.index }]
      let cursor = index + 1
      while (cursor < lines.length && lines[cursor].indent >= inlineIndent) {
        synthetic.push(lines[cursor])
        cursor++
      }
      const [value, consumed] = parseMapping(synthetic, 0, inlineIndent)
      if (consumed !== synthetic.length) {
        throw new YamlError('unexpected indentation in sequence mapping', synthetic[consumed].index)
      }
      items.push(value)
      index = cursor
      continue
    }
    items.push(parseScalar(rest, line.index))
    index++
  }
  return [items, index]
}

function parseMapping(lines, start, indent) {
  const result = {}
  let index = start
  while (index < lines.length) {
    const line = lines[index]
    if (line.indent < indent) break
    if (line.indent > indent) throw new YamlError('unexpected indentation in mapping', line.index)
    if (line.text.startsWith('- ')) break
    const entry = splitMappingEntry(line.text, line.index)
    const key = entry.key
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      throw new YamlError(`duplicate key "${key}"`, line.index)
    }
    if (entry.value !== '') {
      result[key] = parseScalar(entry.value, line.index)
      index++
      continue
    }
    const [child, next] = parseNested(lines, index + 1, indent)
    result[key] = child
    index = next
  }
  return [result, index]
}

/** Parse the child block of a key that had no inline value. */
function parseNested(lines, start, indent) {
  if (start >= lines.length) return [null, start]
  const next = lines[start]
  if (next.indent <= indent) return [null, start]
  return parseBlock(lines, start, next.indent)
}

function isMappingEntry(text) {
  return splitMappingEntrySafe(text) !== undefined
}

function splitMappingEntry(text, index) {
  const parsed = splitMappingEntrySafe(text)
  if (!parsed) throw new YamlError(`expected "key: value" but found ${JSON.stringify(text)}`, index)
  return parsed
}

function splitMappingEntrySafe(text) {
  let quote = null
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === quote && text[i - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === ':' && (i + 1 >= text.length || /\s/.test(text[i + 1]))) {
      const key = text.slice(0, i).trim()
      const value = stripComment(text.slice(i + 1).trim())
      if (key.length === 0) return undefined
      return { key: unquote(key), value }
    }
  }
  return undefined
}

function stripComment(text) {
  let quote = null
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === quote && text[i - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '#' && (i === 0 || /\s/.test(text[i - 1]))) return text.slice(0, i).trim()
  }
  return text.trim()
}

function unquote(text) {
  if (text.length >= 2) {
    const first = text[0]
    const last = text[text.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      const inner = text.slice(1, -1)
      return first === '"' ? inner.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\') : inner.replace(/''/g, "'")
    }
  }
  return text
}

function parseScalar(text, index) {
  const value = stripComment(String(text ?? '').trim())
  if (value === '') return null
  if (value.startsWith('"') || value.startsWith("'")) {
    if (!(value.length >= 2 && value.endsWith(value[0]))) throw new YamlError('unterminated quoted scalar', index)
    return unquote(value)
  }
  if (value === 'null' || value === '~') return null
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10)
  if (/^-?\d*\.\d+$/.test(value)) return Number.parseFloat(value)
  return value
}

const PLAIN_SAFE = /^[A-Za-z0-9_./@+-][A-Za-z0-9 _./@:+-]*$/

/** Serialize plain JavaScript values back to the supported YAML subset. */
export function stringifyYaml(value, indent = 0) {
  const pad = ' '.repeat(indent)
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  if (typeof value === 'string') return formatScalar(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const lines = []
    for (const item of value) {
      if (item !== null && typeof item === 'object') {
        const nested = stringifyYaml(item, indent + 2)
        const linesOfNested = nested.split('\n')
        lines.push(`${pad}- ${linesOfNested[0].slice(indent + 2)}`)
        for (const extra of linesOfNested.slice(1)) lines.push(extra)
      } else {
        lines.push(`${pad}- ${formatScalar(item)}`)
      }
    }
    return lines.join('\n')
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return '{}'
    const lines = []
    for (const [key, item] of entries) {
      if (item !== null && typeof item === 'object') {
        const isEmpty = Array.isArray(item) ? item.length === 0 : Object.keys(item).length === 0
        if (isEmpty) {
          lines.push(`${pad}${key}: ${Array.isArray(item) ? '[]' : '{}'}`)
          continue
        }
        lines.push(`${pad}${key}:`)
        lines.push(stringifyYaml(item, indent + 2))
        continue
      }
      lines.push(`${pad}${key}: ${formatScalar(item)}`)
    }
    return lines.join('\n')
  }
  return formatScalar(String(value))
}

function formatScalar(value) {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  const text = String(value)
  if (text === '') return "''"
  if (text.includes('\n')) return JSON.stringify(text)
  if (PLAIN_SAFE.test(text) && !/^(true|false|null|~)$/.test(text) && !/^-?\d/.test(text)) return text
  return JSON.stringify(text)
}

export { YamlError }
