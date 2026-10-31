/**
 * A minimal Schemastery-compatible schema builder.
 *
 * The DeepSeek Harness projects a plugin's `Config` export into JSON Schema so
 * the configuration editor can render it. The projector only understands the
 * native schema graph protocol, so the nodes built here follow it exactly:
 *
 *   - `node.type` — the schema type name (`object`, `string`, `number`, …),
 *   - `node.meta` — the annotation bag (`default`, `description`, `min`, `max`, …),
 *   - `node.dict` — the child nodes of an `object` node,
 *   - `node.list` — the branches of a `union` node,
 *   - `node.value` — the literal of a `const` node,
 *   - `node.inner` — the item schema of an `array` node,
 *   - `Symbol.for('schemastery')` — the marker the projector looks for.
 *
 * Every node also implements the standard-schema protocol (`~standard`), which
 * is how the Cordis loader validates the `config:` block of a patch row.
 *
 * The nodes are plain objects on purpose: the bundle keeps its zero-runtime-
 * dependency guarantee while its configuration becomes editable in the harness
 * configuration UI.
 */

/** The marker the harness projector uses to recognise a native schema node. */
const kSchema = Symbol.for('schemastery')

/**
 * Build one schema node.
 *
 * @param {string} type - Schema type name.
 * @param {object} [meta] - Annotation bag (default, description, min, max, …).
 * @param {object} [extra] - Type specific members (`dict`, `list`, `value`, …).
 * @returns {object} A native schema node.
 */
function createNode(type, meta = {}, extra = {}) {
  const node = { type, meta: { ...meta } }
  for (const [key, value] of Object.entries(extra)) node[key] = value
  Object.defineProperty(node, kSchema, { value: true, enumerable: false })
  Object.defineProperty(node, '~standard', {
    enumerable: false,
    get() {
      return {
        version: 1,
        vendor: 'dsh-plugin-repowiki',
        validate: (value) => validateNode(node, value),
      }
    },
  })
  return node
}

/**
 * An object node. Its children live in `dict`.
 *
 * @param {Record<string, object>} properties - Child nodes keyed by property name.
 * @param {object} [meta] - Annotation bag.
 * @returns {object} A native schema node.
 */
export function object(properties, meta = {}) {
  return createNode('object', meta, { dict: { ...properties } })
}

/**
 * A string node.
 *
 * @param {object} [meta] - Annotation bag (`default`, `description`, `min` = minimum length, `trim`, `normalize`).
 * @returns {object} A native schema node.
 */
export function string(meta = {}) {
  return createNode('string', meta)
}

/**
 * A number node. `min`/`max` clamp the value instead of rejecting it.
 *
 * @param {object} [meta] - Annotation bag (`default`, `description`, `min`, `max`, `integer`, `step`).
 * @returns {object} A native schema node.
 */
export function number(meta = {}) {
  return createNode('number', meta)
}

/**
 * A boolean node.
 *
 * @param {object} [meta] - Annotation bag (`default`, `description`).
 * @returns {object} A native schema node.
 */
export function boolean(meta = {}) {
  return createNode('boolean', meta)
}

/**
 * A constant node.
 *
 * @param {*} value - The only accepted value.
 * @param {object} [meta] - Annotation bag.
 * @returns {object} A native schema node.
 */
export function constant(value, meta = {}) {
  return createNode('const', meta, { value })
}

/**
 * A union node. The first branch that accepts the value wins.
 *
 * @param {object[]} branches - Branch nodes.
 * @param {object} [meta] - Annotation bag.
 * @returns {object} A native schema node.
 */
export function union(branches, meta = {}) {
  return createNode('union', meta, { list: [...branches] })
}

/**
 * An array node.
 *
 * @param {object} items - The item node.
 * @param {object} [meta] - Annotation bag.
 * @returns {object} A native schema node.
 */
export function array(items, meta = {}) {
  return createNode('array', meta, { inner: items })
}

/**
 * Validate one value against a schema node.
 *
 * @param {object} schema - A native schema node.
 * @param {*} value - The value to validate.
 * @returns {{ value?: *, issues?: Array<{ message: string, path: string[] }> }} The standard-schema result.
 */
export function validateNode(schema, value) {
  switch (schema.type) {
    case 'object': {
      if (value === undefined) {
        const fallback = schema.meta.default
        if (fallback === undefined) return { value: {} }
        return validateObject(schema, fallback)
      }
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return { issues: [{ message: `expected an object, got ${describeType(value)}`, path: [] }] }
      }
      return validateObject(schema, value)
    }
    case 'string': {
      if (typeof value !== 'string') {
        return { issues: [{ message: `expected a string, got ${describeType(value)}`, path: [] }] }
      }
      let result = value
      if (schema.meta.trim) result = result.trim()
      if (typeof schema.meta.normalize === 'function') result = schema.meta.normalize(result)
      if (schema.meta.min !== undefined && result.length < schema.meta.min) {
        return { issues: [{ message: `expected at least ${schema.meta.min} characters`, path: [] }] }
      }
      return { value: result }
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { issues: [{ message: `expected a finite number, got ${describeType(value)}`, path: [] }] }
      }
      let result = value
      if (schema.meta.integer) result = Math.floor(result)
      if (schema.meta.min !== undefined) result = Math.max(result, schema.meta.min)
      if (schema.meta.max !== undefined) result = Math.min(result, schema.meta.max)
      return { value: result }
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        return { issues: [{ message: `expected a boolean, got ${describeType(value)}`, path: [] }] }
      }
      return { value }
    }
    case 'const': {
      if (value !== schema.value) {
        return { issues: [{ message: `expected ${JSON.stringify(schema.value)}`, path: [] }] }
      }
      return { value }
    }
    case 'union': {
      for (const branch of schema.list ?? []) {
        const validated = validateNode(branch, value)
        if (!validated.issues) return { value: validated.value }
      }
      return { issues: [{ message: `expected one of ${(schema.list ?? []).length} allowed values`, path: [] }] }
    }
    case 'array': {
      if (!Array.isArray(value)) {
        return { issues: [{ message: `expected an array, got ${describeType(value)}`, path: [] }] }
      }
      const issues = []
      const result = []
      value.forEach((item, index) => {
        const validated = validateNode(schema.inner, item)
        if (validated.issues) {
          for (const issue of validated.issues) {
            issues.push({ message: issue.message, path: [String(index), ...(issue.path ?? [])] })
          }
          return
        }
        result.push(validated.value)
      })
      if (issues.length) return { issues }
      return { value: result }
    }
    default:
      return { value }
  }
}

/**
 * Validate the members of an object node.
 *
 * @param {object} schema - An object node.
 * @param {object} source - The source object.
 * @returns {{ value?: object, issues?: Array<{ message: string, path: string[] }> }} The standard-schema result.
 */
function validateObject(schema, source) {
  const issues = []
  const result = {}
  for (const [key, child] of Object.entries(schema.dict ?? {})) {
    const provided = Object.hasOwn(source, key) ? source[key] : undefined
    const candidate = provided === undefined ? child.meta.default : provided
    if (candidate === undefined) continue
    const validated = validateNode(child, candidate)
    if (validated.issues) {
      for (const issue of validated.issues) {
        issues.push({ message: issue.message, path: [key, ...(issue.path ?? [])] })
      }
      continue
    }
    result[key] = validated.value
  }
  if (issues.length) return { issues }
  return { value: result }
}

/**
 * Describe a value for an error message.
 *
 * @param {*} value
 * @returns {string}
 */
function describeType(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  return `a ${typeof value}`
}
