/* ---- 45-graph.js ----
 * Deterministic layered layout and edge routing.
 * This file is concatenated into ../../client.js by scripts/build-client.mjs.
 */
    const GRAPH_NODE_W = 190
    const GRAPH_NODE_H = 60
    const GRAPH_GAP_X = 110
    const GRAPH_GAP_Y = 34

    /**
     * Deterministic layered architecture layout: nodes stacked by dependency
     * level (imports flow left → right), centered within each layer.
     *
     * @param {object[]} nodes
     * @param {object[]} edges
     * @param {Record<string, number>} levels
     * @returns {{ positions: Map<string, {x: number, y: number}>, width: number, height: number }}
     */
    function layeredGraphLayout(nodes, edges, levels) {
      const byLevel = new Map()
      for (const node of nodes) {
        const level = levels?.[node.id] ?? 0
        if (!byLevel.has(level)) byLevel.set(level, [])
        byLevel.get(level).push(node)
      }
      const layerKeys = [...byLevel.keys()].sort((a, b) => a - b)

      // Barycentric ordering: four sweeps that re-sort each layer by the
      // average row of its predecessors / successors. This is what keeps the
      // long edges parallel instead of criss-crossing the whole canvas.
      const rowOf = new Map()
      for (const level of layerKeys) {
        byLevel.get(level).forEach((node, index) => rowOf.set(node.id, index))
      }
      const barycenter = (node, side) => {
        const rows = []
        for (const edge of edges) {
          if (side === 'in' && edge.to === node.id && rowOf.has(edge.from)) rows.push(rowOf.get(edge.from))
          if (side === 'out' && edge.from === node.id && rowOf.has(edge.to)) rows.push(rowOf.get(edge.to))
        }
        return rows.length ? rows.reduce((sum, row) => sum + row, 0) / rows.length : Number.POSITIVE_INFINITY
      }
      const resort = (level, side) => {
        const column = byLevel.get(level)
        const withKey = column.map((node, index) => ({ node, index, key: barycenter(node, side) }))
        withKey.sort((a, b) => a.key - b.key || a.index - b.index)
        byLevel.set(level, withKey.map((entry) => entry.node))
        withKey.forEach((entry, index) => rowOf.set(entry.node.id, index))
      }
      for (let sweep = 0; sweep < 4; sweep += 1) {
        for (const level of layerKeys) resort(level, 'in')
        for (const level of [...layerKeys].reverse()) resort(level, 'out')
      }

      const positions = new Map()
      let maxRows = 1
      for (const level of layerKeys) {
        maxRows = Math.max(maxRows, byLevel.get(level).length)
      }
      const rowHeight = GRAPH_NODE_H + GRAPH_GAP_Y
      const height = maxRows * rowHeight
      for (const level of layerKeys) {
        const column = byLevel.get(level)
        const columnHeight = column.length * rowHeight
        const offsetY = (height - columnHeight) / 2
        column.forEach((node, index) => {
          positions.set(node.id, {
            x: level * (GRAPH_NODE_W + GRAPH_GAP_X),
            y: offsetY + index * rowHeight,
            col: level,
            row: index,
          })
        })
      }
      const width = layerKeys.length * (GRAPH_NODE_W + GRAPH_GAP_X)
      return { positions, width: Math.max(width, 320), height: Math.max(height, 160) }
    }

    /**
     * Route one graph edge through the empty gutters between columns so it
     * never crosses a node rectangle. Cross-column edges hug the gutter mid
     * (an S-curve through empty space), same-column edges use the right
     * gutter, backward edges the left one; parallel edges get per-edge
     * channel offsets so they never overlap.
     *
     * @param {{x: number, y: number, col: number, row: number}} aBox - source box.
     * @param {{x: number, y: number, col: number, row: number}} bBox - target box.
     * @param {number} offset - small horizontal channel shift for this edge.
     * @returns {string} the SVG path.
     */
    function graphEdgePath(aBox, bBox, offset) {
      const aRight = aBox.x + GRAPH_NODE_W
      const aMidY = aBox.y + GRAPH_NODE_H / 2
      const bMidY = bBox.y + GRAPH_NODE_H / 2
      if (bBox.col > aBox.col) {
        const span = (bBox.col - aBox.col) * (GRAPH_NODE_W + GRAPH_GAP_X) - GRAPH_NODE_W
        const mid = aRight + Math.max(18, span / 2) + offset
        return `M ${aRight} ${aMidY} C ${mid} ${aMidY}, ${mid} ${bMidY}, ${bBox.x} ${bMidY}`
      }
      if (bBox.col === aBox.col) {
        const xg = aRight + 16 + offset
        return `M ${aRight} ${aMidY} C ${xg} ${aMidY}, ${xg} ${bMidY}, ${bBox.x + GRAPH_NODE_W} ${bMidY}`
      }
      const xl = aBox.x - 16 - offset
      return `M ${aBox.x} ${aMidY} C ${xl} ${aMidY}, ${xl} ${bMidY}, ${bBox.x + GRAPH_NODE_W} ${bMidY}`
    }

    /** Per-gutter channel assignment so parallel edges spread apart. */
    function edgeChannels(edges, positions) {
      const counters = new Map()
      return edges.map((edge) => {
        const a = positions.get(edge.from)
        const b = positions.get(edge.to)
        if (!a || !b) return 0
        const key = a.col === b.col ? `col:${a.col}` : `${a.col}>${b.col}`
        const next = (counters.get(key) ?? 0) + 1
        counters.set(key, next)
        const spread = a.col === b.col ? 5 : 8
        return (next % 2 === 0 ? 1 : -1) * Math.ceil(next / 2) * spread * 0.5
      })
    }

    const CITATION_RE = /^[A-Za-z0-9_./\\-]+:\d+(?:-\d+)?$/

    /**
     * Render one run of text with `inline code` spans; a code span shaped like
     * `path:line` becomes a citation chip that copies itself on click.
     */
