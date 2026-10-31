/* ---- 50-markdown.js ----
 * Inline text and markdown block rendering.
 * This file is concatenated into ../../client.js by scripts/build-client.mjs.
 */
    function InlineText(props) {
      const text = String(props.text ?? '')
      const parts = []
      const pattern = /`([^`]+)`/g
      let match
      let last = 0
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > last) parts.push({ kind: 'text', value: text.slice(last, match.index) })
        parts.push({ kind: 'code', value: match[1] })
        last = match.index + match[0].length
      }
      if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })
      return h(
        'span',
        null,
        parts.map((part, index) => {
          if (part.kind === 'text') return h('span', { key: index }, part.value)
          const value = part.value
          // `card:<id>` spans are knowledge-card cross references: a green
          // chip that opens the referenced card.
          if (/^card:[A-Za-z0-9_-]+$/.test(value)) {
            return h(
              'code',
              {
                key: index,
                title: props.t ? props.t('cardOpen') : value,
                onClick: typeof props.onOpenCard === 'function' ? () => props.onOpenCard(value) : undefined,
                style: {
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '5px',
                  background: `${STATUS_TONE.fresh}1f`,
                  color: STATUS_TONE.fresh,
                  cursor: typeof props.onOpenCard === 'function' ? 'pointer' : 'inherit',
                  whiteSpace: 'nowrap',
                },
              },
              value,
            )
          }
          const isCitation = CITATION_RE.test(value)
          return h(
            'code',
            {
              key: index,
              title: isCitation ? props.t ? props.t('openSource') : value : undefined,
              onClick: isCitation
                ? () => {
                    if (typeof props.onOpenSource === 'function') {
                      props.onOpenSource(value)
                      return
                    }
                    // Without a source viewer (for example inside the graph
                    // inspector) the chip keeps its copy behaviour.
                    try {
                      if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(value)
                    } catch {
                      // A denied clipboard is not worth breaking the page.
                    }
                  }
                : undefined,
              style: {
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: isCitation ? '11px' : '12px',
                padding: isCitation ? '1px 6px' : '1px 4px',
                borderRadius: '5px',
                background: isCitation ? `${ACCENT()}1f` : token('--dsw-alias-fill-tsp-secondary', 'rgba(127,127,127,0.14)'),
                color: isCitation ? ACCENT() : token('--dsw-alias-label-primary', '#e6e6e6'),
                cursor: isCitation ? 'pointer' : 'inherit',
                whiteSpace: 'nowrap',
              },
            },
            value,
          )
        }),
      )
    }

    /** A labelled status chip. */
    function Chip(props) {
      return h('span', { className: 'repowiki-chip' }, props.children)
    }

    /** A small button that matches the shell's quiet chrome. */
    function Button(props) {
      const classes = ['repowiki-btn']
      if (props.primary) classes.push('is-primary')
      if (props.active) classes.push('is-active')
      if (props.icon) classes.push('is-icon')
      return h(
        'button',
        {
          type: 'button',
          className: classes.join(' '),
          disabled: props.disabled,
          title: props.title,
          'aria-label': props.title || props['aria-label'],
          onClick: props.onClick,
        },
        props.children,
      )
    }

    /** The sidebar glyph: a book with a spine. */
    function RepoWikiPanelIcon(props) {
      const size = props.size || 20
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a1.6 1.6 0 0 0-1.6-1.6H5.5A1.5 1.5 0 0 1 4 15.9z' }),
        h('path', { d: 'M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a1.6 1.6 0 0 1 1.6-1.6h4.9a1.5 1.5 0 0 0 1.5-1.5z' }),
      )
    }

    /** Small line icons used by the refreshed chrome. */
    const GLYPH_PATHS = {
      wiki: ['M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a1.6 1.6 0 0 0-1.6-1.6H5.5A1.5 1.5 0 0 1 4 15.9z', 'M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a1.6 1.6 0 0 1 1.6-1.6h4.9a1.5 1.5 0 0 0 1.5-1.5z'],
      graph: [
        'M5 4.2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5',
        'M12 7.2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5',
        'M19 15.2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5',
        'M7.5 6.7h2.2',
        'M14.5 9.7h2.2a2 2 0 0 1 2 2v3.5',
      ],
      projects: ['M4 4h6.5v6.5H4z', 'M13.5 4H20v6.5h-6.5z', 'M4 13.5h6.5V20H4z', 'M13.5 13.5H20V20h-6.5z'],
      cards: ['M6.5 4.5h11v15h-11z', 'M9.5 8.5h5', 'M9.5 12h5', 'M9.5 15.5h3'],
      refresh: ['M20 11a8 8 0 1 0-2.35 5.65', 'M20 5v6h-6'],
      download: ['M12 4v10', 'M8 10.5 12 14.5l4-4', 'M5 19.5h14'],
      search: ['M10.8 4.5a6.3 6.3 0 1 0 0 12.6 6.3 6.3 0 0 0 0-12.6z', 'M15.4 15.4 20 20'],
      fit: ['M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9', 'M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9', 'M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15', 'M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15'],
      plus: ['M12 5v14', 'M5 12h14'],
      minus: ['M5 12h14'],
      reset: ['M4 10a8 8 0 1 1 2.3 6', 'M4 5v5h5'],
      more: ['M6 12h.01', 'M12 12h.01', 'M18 12h.01'],
      link: ['M10.5 13.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.54 3.54 0 0 0-5-5l-1 1', 'M13.5 10.5a3.5 3.5 0 0 0-5 0L6 13a3.54 3.54 0 0 0 5 5l1-1'],
      menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
    }

    function Glyph(props) {
      const size = props.size || 14
      const paths = GLYPH_PATHS[props.name] || GLYPH_PATHS.wiki
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: props.weight || 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          style: props.style,
        },
        paths.map((d, index) => h('path', { key: index, d })),
      )
    }

    /** A quiet copy control used by code blocks and the source peek. */
    function CopyButton(props) {
      const [done, setDone] = useState(false)
      const copy = () => {
        try {
          if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(String(props.text ?? ''))
            setDone(true)
            setTimeout(() => setDone(false), 1400)
          }
        } catch {
          // A denied clipboard is not worth breaking the page.
        }
      }
      return h(
        'button',
        {
          type: 'button',
          className: 'repowiki-copy',
          title: props.title || (props.t ? props.t('codeCopy') : 'Copy'),
          'aria-label': props.title || (props.t ? props.t('codeCopy') : 'Copy'),
          onClick: copy,
        },
        done ? (props.t ? props.t('codeCopied') : 'Copied') : (props.label || (props.t ? props.t('codeCopy') : 'Copy')),
      )
    }

    /** Render one parsed markdown block. */
    function MarkdownBlock(props) {
      const block = props.block
      const t = props.t
      const onOpenCard = props.onOpenCard
      const onOpenSource = props.onOpenSource
      const mono = {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '12.5px',
      }
      if (block.type === 'heading') {
        const sizes = { 1: '22px', 2: '17px', 3: '15px', 4: '13.5px' }
        return h(
          'h' + Math.min(6, Math.max(1, block.level)),
          {
            'data-bidx': props.blockIndex,
            style: {
              margin: props.blockIndex === 0 ? '0 0 10px' : '22px 0 9px',
              paddingBottom: block.level <= 2 ? '7px' : undefined,
              borderBottom: block.level <= 2 ? `1px solid ${token('--dsw-alias-border-l2', 'rgba(127,127,127,0.22)')}` : undefined,
              fontSize: sizes[block.level] || '13.5px',
              fontWeight: 600,
              letterSpacing: '0.005em',
              color: token('--dsw-alias-label-primary', '#e6e6e6'),
            },
          },
          h(InlineText, { text: block.text, t, onOpenCard, onOpenSource }),
        )
      }
      if (block.type === 'paragraph') {
        return h(
          'p',
          {
            style: {
              margin: '0 0 11px',
              lineHeight: 1.78,
              fontSize: '13.5px',
              color: token('--dsw-alias-label-secondary', '#a8a8a8'),
            },
          },
          h(InlineText, { text: block.text, t, onOpenCard, onOpenSource }),
        )
      }
      if (block.type === 'list') {
        return h(
          block.ordered ? 'ol' : 'ul',
          {
            style: {
              margin: '0 0 11px',
              paddingLeft: '21px',
              lineHeight: 1.78,
              fontSize: '13.5px',
              color: token('--dsw-alias-label-secondary', '#a8a8a8'),
            },
          },
          block.items.map((item, index) =>
            h('li', { key: index, style: { marginBottom: '4px' } }, h(InlineText, { text: item, t, onOpenCard, onOpenSource })),
          ),
        )
      }
      if (block.type === 'code' || block.type === 'mermaid') {
        return h(
          'div',
          {
            style: {
              margin: '0 0 12px',
              borderRadius: token('--dsw-radius-sm', '8px'),
              border: `1px solid ${token('--dsw-alias-border-l2', 'rgba(127,127,127,0.25)')}`,
              overflow: 'hidden',
            },
          },
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: token('--dsw-alias-fill-tsp-primary', 'rgba(127,127,127,0.08)'),
                borderBottom: `1px solid ${token('--dsw-alias-border-l2', 'rgba(127,127,127,0.2)')}`,
              },
            },
            h(
              'span',
              {
                style: {
                  width: '8px',
                  height: '8px',
                  borderRadius: '2px',
                  background: block.type === 'mermaid' ? STATUS_TONE.fresh : ACCENT(),
                  opacity: 0.8,
                },
              },
            ),
            h(
              'span',
              { style: { fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: token('--dsw-alias-label-tertiary', '#7d7d7d') } },
              block.type === 'mermaid' ? 'mermaid · diagram' : block.language || 'code',
            ),
            h('div', { style: { flex: '1 1 auto' } }),
            h(CopyButton, { text: block.code, t }),
          ),
          h(
            'pre',
            {
              style: Object.assign(
                {
                  margin: 0,
                  padding: '10px 12px',
                  overflowX: 'auto',
                  background: token('--dsw-alias-fill-tsp-primary', 'rgba(127,127,127,0.05)'),
                  color: token('--dsw-alias-label-primary', '#e6e6e6'),
                  lineHeight: 1.55,
                },
                mono,
              ),
            },
            block.code,
          ),
        )
      }
      if (block.type === 'table') {
        return h(
          'div',
          {
            style: {
              margin: '0 0 12px',
              overflowX: 'auto',
              borderRadius: token('--dsw-radius-sm', '8px'),
              border: `1px solid ${token('--dsw-alias-border-l2', 'rgba(127,127,127,0.25)')}`,
            },
          },
          h(
            'table',
            {
              style: {
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px',
              },
            },
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                block.header.map((cell, index) =>
                  h(
                    'th',
                    {
                      key: index,
                      style: {
                        textAlign: 'left',
                        padding: '6px 10px',
                        background: token('--dsw-alias-fill-tsp-primary', 'rgba(127,127,127,0.08)'),
                        borderBottom: `1px solid ${token('--dsw-alias-border-l2', 'rgba(127,127,127,0.3)')}`,
                        color: token('--dsw-alias-label-primary', '#e6e6e6'),
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      },
                    },
                    cell,
                  ),
                ),
              ),
            ),
            h(
              'tbody',
              null,
              block.rows.map((row, rowIndex) =>
                h(
                  'tr',
                  { key: rowIndex },
                  row.map((cell, cellIndex) =>
                    h(
                      'td',
                      {
                        key: cellIndex,
                        style: {
                          padding: '6px 10px',
                          borderBottom: `1px solid ${token('--dsw-alias-border-l2', 'rgba(127,127,127,0.16)')}`,
                          color: token('--dsw-alias-label-secondary', '#a8a8a8'),
                          verticalAlign: 'top',
                        },
                      },
                      h(InlineText, { text: String(cell ?? ''), t, onOpenCard, onOpenSource }),
                    ),
                  ),
                ),
              ),
            ),
          ),
        )
      }
      if (block.type === 'quote') {
        return h(
          'blockquote',
          {
            style: {
              margin: '0 0 12px',
              padding: '8px 12px',
              borderRadius: '0 8px 8px 0',
              borderLeft: `3px solid ${ACCENT()}88`,
              background: `${ACCENT()}0f`,
              color: token('--dsw-alias-label-secondary', '#a8a8a8'),
              fontSize: '13px',
              lineHeight: 1.65,
            },
          },
          h(InlineText, { text: block.text, t, onOpenCard, onOpenSource }),
        )
      }
      if (block.type === 'hr') {
        return h('hr', {
          style: {
            margin: '16px 0',
            border: 'none',
            borderTop: `1px solid ${token('--dsw-alias-border-l2', 'rgba(127,127,127,0.3)')}`,
          },
        })
      }
      return null
    }

    /* ------------------------------------------------------------------ *
     * request helpers
     * ------------------------------------------------------------------ */

    /**
     * Normalise whatever the Host answered with into `{code, message, hint}`.
     *
     * The Host reports failures as `{ error: { code, message, hint } }`; older
     * builds answered with a plain string, and a network failure never reaches
     * the route at all. All three shapes collapse into the same structure so
     * the panel can always show code / message / hint.
     *
     * @param {unknown} payload the parsed response body
     * @param {number} status the HTTP status
     * @returns {{ code: string, message: string, hint: string }}
     */
