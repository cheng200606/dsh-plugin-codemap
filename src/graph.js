/**
 * The engineering knowledge graph data layer (plan v2 §四 P0'-1).
 *
 * The graph is derived — never persisted — from the scan + index pair the
 * service already caches: nodes are modules (source directories) and files,
 * edges are "belongs to" containment and cross-module `import` dependencies
 * collected by the indexer while it reads the sources.
 *
 * Layout is a deterministic layered architecture layout (dependency direction
 * top-down), not a force simulation: stable, cheap, and readable at the
 * module granularity the plan prescribes.
 */

/**
 * Build the module-level graph from a scan + index pair.
 *
 * @param {object} scan - the `RepoScan` profile.
 * @param {object} index - the `RepoIndex` built by `buildIndex` (must carry
 *   `modules` and `moduleImports`).
 * @param {{ limit?: number }} [options] - cap the node count for very large
 *   repositories; the largest modules by LOC are kept.
 * @returns {{ nodes: object[], edges: object[], levels: Record<string, number>, truncated: boolean }}
 */
export function buildModuleGraph(scan, index, options = {}) {
  const limit = Number(options.limit ?? 300) || 300
  const modules = Array.isArray(index?.modules) ? index.modules : []
  if (modules.length === 0) {
    return { nodes: [], edges: [], levels: {}, truncated: false }
  }

  const keep = modules.length > limit
    ? [...modules].sort((a, b) => (b.loc ?? 0) - (a.loc ?? 0)).slice(0, limit)
    : modules
  const keptIds = new Set(keep.map((module) => moduleId(module.path)))

  const nodes = keep.map((module) => ({
    id: moduleId(module.path),
    type: 'module',
    label: moduleLabel(module.path),
    dir: module.path ?? '',
    fileCount: (module.files ?? []).length,
    loc: module.loc ?? 0,
    doc: moduleSummary(module),
  }))

  const edges = []
  const seenEdges = new Set()
  for (const pair of index.moduleImports ?? []) {
    const from = moduleId(pair.from)
    const to = moduleId(pair.to)
    if (from === to || !keptIds.has(from) || !keptIds.has(to)) continue
    const key = `${from}->${to}`
    if (seenEdges.has(key)) continue
    seenEdges.add(key)
    edges.push({ from, to, kind: 'import' })
  }

  const levels = assignLevels(nodes, edges)
  return { nodes, edges, levels, truncated: modules.length > limit }
}

/**
 * Build the file-level graph of one module: its files plus the boundary
 * modules they import from / are imported by (as boundary nodes).
 *
 * @param {object} index
 * @param {string} moduleDir - the module directory (may be '' for root files).
 * @returns {{ nodes: object[], edges: object[], module: object|null }}
 */
export function buildFileGraph(index, moduleDir) {
  const modules = Array.isArray(index?.modules) ? index.modules : []
  const module = modules.find((entry) => moduleId(entry.path) === moduleId(moduleDir)) ?? null
  if (!module) {
    return { nodes: [], edges: [], module: null }
  }

  const nodes = []
  const edges = []
  const seenEdges = new Set()
  const boundary = new Map()

  nodes.push({
    id: moduleId(module.path),
    type: 'module',
    label: moduleLabel(module.path),
    dir: module.path ?? '',
    fileCount: (module.files ?? []).length,
    loc: module.loc ?? 0,
    doc: moduleSummary(module),
  })

  for (const pair of index.fileImports ?? []) {
    const fromFile = pair.from
    const toFile = pair.to
    const fromModule = pair.fromModule
    const toModule = pair.toModule
    if (fromModule !== moduleDir && toModule !== moduleDir) continue

    if (fromModule === moduleDir && toModule === moduleDir) {
      // intra-module file edge
      const from = `file:${fromFile}`
      const to = `file:${toFile}`
      const key = `${from}->${to}`
      if (!seenEdges.has(key)) {
        seenEdges.add(key)
        edges.push({ from, to, kind: 'import' })
        ensureFileNode(nodes, index, fromFile)
        ensureFileNode(nodes, index, toFile)
      }
      continue
    }
    // boundary edge: module node ↔ the outside file (collapsed to its module)
    const insideFile = fromModule === moduleDir ? fromFile : toFile
    const outsideModule = fromModule === moduleDir ? toModule : fromModule
    const from = fromModule === moduleDir ? `file:${insideFile}` : `mod:${outsideModule}`
    const to = fromModule === moduleDir ? `mod:${outsideModule}` : `file:${insideFile}`
    const key = `${from}->${to}`
    if (seenEdges.has(key)) continue
    seenEdges.add(key)
    edges.push({ from, to, kind: 'import' })
    ensureFileNode(nodes, index, insideFile)
    if (!boundary.has(outsideModule)) {
      const outside = (index.modules ?? []).find((entry) => entry.path === outsideModule)
      boundary.set(outsideModule, true)
      nodes.push({
        id: `mod:${outsideModule}`,
        type: 'boundary',
        label: moduleLabel(outsideModule),
        dir: outsideModule ?? '',
        fileCount: outside ? (outside.files ?? []).length : 0,
        loc: outside ? outside.loc ?? 0 : 0,
        doc: outside ? moduleSummary(outside) : '',
      })
    }
  }

  const levels = assignLevels(nodes, edges)
  return { nodes, edges, levels, module }
}

/**
 * Compute the upstream and downstream impact set of one module by BFS over
 * the module import graph.
 *
 * @param {object} index
 * @param {string} moduleDir
 * @returns {{ upstream: string[], downstream: string[] }} module dirs, BFS order.
 */
export function impactFrom(index, moduleDir) {
  const imports = Array.isArray(index?.moduleImports) ? index.moduleImports : []
  const downstream = bfs(moduleDir, (node) => {
    const out = []
    for (const pair of imports) {
      if (pair.from === node) out.push(pair.to)
    }
    return out
  })
  const upstream = bfs(moduleDir, (node) => {
    const out = []
    for (const pair of imports) {
      if (pair.to === node) out.push(pair.from)
    }
    return out
  })
  return { upstream, downstream }
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

/** The graph node id of a module directory. */
function moduleId(dir) {
  return `mod:${dir ?? ''}`
}

/** The short label of a module directory. */
function moduleLabel(dir) {
  const normalized = String(dir ?? '').replace(/\/+$/, '')
  if (normalized === '') return '(root)'
  const segments = normalized.split('/')
  return segments[segments.length - 1]
}

/** One-line digest of a module: its first documented symbol or its file list head. */
function moduleSummary(module) {
  const files = module?.files ?? []
  if (module?.doc) return module.doc
  if (files.length > 0) return `包含 ${files.length} 个文件：${files.slice(0, 3).join('、')}${files.length > 3 ? ' …' : ''}`
  return ''
}

/** Ensure a file node exists in the node list (file-level graph). */
function ensureFileNode(nodes, index, filePath) {
  const id = `file:${filePath}`
  if (nodes.some((node) => node.id === id)) return
  const owner = (index.modules ?? []).find((module) => (module.files ?? []).includes(filePath))
  nodes.push({
    id,
    type: 'file',
    label: String(filePath ?? '').split('/').pop() || String(filePath ?? ''),
    dir: owner ? owner.path : String(filePath ?? '').split('/').slice(0, -1).join('/'),
    fileCount: 1,
    loc: 0,
    doc: '',
  })
}

/**
 * Breadth-first traversal with a visited guard (cycles in the import graph
 * are expected and must not loop forever).
 */
function bfs(start, neighborsOf) {
  const visited = new Set()
  const queue = [start]
  const order = []
  while (queue.length > 0) {
    const node = queue.shift()
    for (const next of neighborsOf(node)) {
      if (next === start || visited.has(next)) continue
      visited.add(next)
      order.push(next)
      queue.push(next)
    }
  }
  return order
}

/**
 * Assign a layer to every node: sources (no outgoing import edges) sit at
 * layer 0, importers above them. Cycles fall back to the visited depth.
 */
function assignLevels(nodes, edges) {
  const levels = {}
  const outgoing = new Map()
  for (const node of nodes) levels[node.id] = 0
  for (const edge of edges) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, [])
    outgoing.get(edge.from).push(edge.to)
  }
  // Relaxation: propagate depths along edges until stable (bounded pass count
  // keeps cyclic graphs and large graphs cheap).
  for (let pass = 0; pass < 32; pass += 1) {
    let changed = false
    for (const edge of edges) {
      const next = (levels[edge.from] ?? 0) + 1
      if (next > (levels[edge.to] ?? 0) && next < nodes.length) {
        levels[edge.to] = next
        changed = true
      }
    }
    if (!changed) break
  }
  return levels
}
