/* ---- 40-components.js ----
 * Status atoms, buttons, chips, glyphs and copy control.
 * This file is concatenated into ../../client.js by scripts/build-client.mjs.
 */
    const STATUS_TONE = {
      fresh: '#3fbf7f',
      stale: '#e0a34a',
      'needs-review': '#e06c6c',
      draft: '#8a8a8a',
    }

    const STATUS_LABEL_KEYS = {
      fresh: 'stateReady',
      stale: 'stale',
      'needs-review': 'needsReview',
      draft: 'draft',
    }

    /** A small coloured status dot. */
    function StatusDot(props) {
      return h('span', {
        'aria-hidden': 'true',
        style: {
          display: 'inline-block',
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          flex: '0 0 auto',
          background: STATUS_TONE[props.status] || STATUS_TONE.draft,
          boxShadow: `0 0 0 3px ${(STATUS_TONE[props.status] || STATUS_TONE.draft)}22`,
        },
      })
    }

    /** A quiet chip that prefixes its text with a status dot. */
    function StatusChip(props) {
      return h(
        'span',
        { className: 'codemap-status' },
        h(StatusDot, { status: props.status }),
        props.children,
      )
    }

    /** One hero metric of the overview landing. */
    function StatCard(props) {
      return h(
        'div',
        { className: 'codemap-stat' },
        h('div', { className: 'codemap-stat-label' }, props.label),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'baseline', gap: '6px' } },
          h('span', { className: 'codemap-stat-value' }, String(props.value ?? 0)),
          props.sub ? h('span', { className: 'codemap-stat-sub' }, props.sub) : null,
        ),
      )
    }

    /** A shimmering skeleton block for the loading state. */
    function Skeleton(props) {
      return h('div', {
        'aria-hidden': 'true',
        className: 'codemap-skeleton',
        style: {
          height: props.height || '14px',
          width: props.width || '100%',
          marginBottom: props.gap == null ? '10px' : props.gap,
        },
      })
    }

    /* ------------------------------------------------------------------ *
     * knowledge-graph layout helpers (plan v2 §四 P0'-1)
     * ------------------------------------------------------------------ */
