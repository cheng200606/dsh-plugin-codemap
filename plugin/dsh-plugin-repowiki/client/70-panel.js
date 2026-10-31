/* ---- 70-panel.js ----
 * The RepoWiki panel: state machine, views and interactions.
 * This file is concatenated into ../../client.js by scripts/build-client.mjs.
 */
    /** The central panel: a page tree on the left, the selected page on the right. */
    function RepoWikiPanel(props) {
      const t = props.t
      const [panel, setPanel] = useState(null)
      const [page, setPage] = useState(null)
      const [currentId, setCurrentId] = useState('')
      const [query, setQuery] = useState('')
      const [hits, setHits] = useState(null)
      const [error, setError] = useState(null)
      const [loading, setLoading] = useState(false)
      const [opening, setOpening] = useState(false)
      const [searching, setSearching] = useState(false)
      const [busy, setBusy] = useState(false)
      const [language, setLanguage] = useState('')
      // The repository the panel is looking at. Empty means "let the host
      // decide"; a value comes from the workspace switcher.
      const [root, setRoot] = useState('')
      // Live progress of an active generation; non-null renders the progress
      // card and starts the polling loop.
      const [gen, setGen] = useState(null)
      // Which right-hand view is showing: the wiki itself, the knowledge-card
      // library, or the projects overview.
      const [mode, setMode] = useState('wiki')
      const [cardFilter, setCardFilter] = useState('')
      // Collapsed sidebar sections (ids); sections start expanded.
      const [collapsed, setCollapsed] = useState(() => new Set())
      // One-shot banner text (export result); auto-clears.
      const [toast, setToast] = useState(null)
      const [helpOpen, setHelpOpen] = useState(false)
      // The workspace switcher menu (a hand-drawn dropdown, not a `<select>`).
      const [rootMenuOpen, setRootMenuOpen] = useState(false)
      // Narrow windows hide the sidebar; this opens it as a drawer.
      const [sidebarOpen, setSidebarOpen] = useState(false)
      // The "more" menu (import entries) and the pending import confirmation.
      const [moreOpen, setMoreOpen] = useState(false)
      const [pendingImport, setPendingImport] = useState(null)
      // The citation source peek: `{ path, line }` while loading, then the
      // payload returned by `/api/repowiki/source`.
      const [sourcePeek, setSourcePeek] = useState(null)
      const [sourcePeekError, setSourcePeekError] = useState(null)
      // Search status filter and recently opened pages.
      const [searchFilter, setSearchFilter] = useState('all')
      const [recent, setRecent] = useState(() => readRecentPages())
      // The engineering knowledge graph view (mode 'graph').
      const [graphData, setGraphData] = useState(null)
      const [graphLevel, setGraphLevel] = useState('module')
      const [graphModule, setGraphModule] = useState('')
      const [graphLoading, setGraphLoading] = useState(false)
      const [graphStale, setGraphStale] = useState(false)
      const [graphHover, setGraphHover] = useState(null)
      const [graphSelected, setGraphSelected] = useState(null)
      const [graphImpact, setGraphImpact] = useState(null)
      const [graphQuery, setGraphQuery] = useState('')
      // Live viewBox of the graph SVG (null = fit to content); the wheel and
      // the zoom buttons mutate it around the cursor / center respectively.
      const [viewBoxState, setViewBoxState] = useState(null)
      const [graphDragging, setGraphDragging] = useState(false)
      const dragRef = useRef(null)
      const suppressClickRef = useRef(false)
      const panFrameRef = useRef(0)
      const pendingPanRef = useRef(null)
      const impactAbortRef = useRef(null)
      const graphFetchedAtRef = useRef(0)
      const graphSignatureRef = useRef(null)
      const graphCheckRef = useRef(0)
      const svgRef = useRef(null)
      const baseBoxRef = useRef(null)
      const searchTimer = useRef(null)
      const searchAbort = useRef(null)
      // The scroll container of the page view; the TOC scrolls inside it.
      const contentRef = useRef(null)
      const pollRef = useRef(null)
      const toastTimer = useRef(null)

      /** Toggle one sidebar section between expanded and collapsed. */
      const toggleSection = useCallback((id) => {
        setCollapsed((prev) => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
      }, [])

      /** Show a short-lived banner and clear it again. */
      const showToast = useCallback((text) => {
        setToast(text)
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(null), 4200)
      }, [])

      /** The language the wiki is written in; the panel language is separate. */
      const effectiveLanguage = language || (panel && panel.language) || 'zh'

      const languageQuery = useMemo(
        () => `language=${encodeURIComponent(effectiveLanguage)}`,
        [effectiveLanguage],
      )

      /** The explicit repository hint; empty until the user picks one. */
      const rootQuery = useMemo(
        () => (root ? `&root=${encodeURIComponent(root)}` : ''),
        [root],
      )

      /** Load the panel overview (stale-while-revalidate). */
      const load = useCallback(async () => {
        const key = panelCacheKey(root, effectiveLanguage)
        const cached = readPanelCache(key)
        // Render the previous answer immediately; the request below replaces
        // it when it lands. This removes the blank first paint on slow repos.
        if (cached) {
          setPanel(cached.data)
          setError(null)
          setLoading(false)
        } else {
          setLoading(true)
        }
        try {
          const data = await requestJson(`/api/repowiki/panel?${languageQuery}${rootQuery}`)
          setPanel(data)
          writePanelCache(key, data)
          setError(null)
          return data
        } catch (cause) {
          if (isAbortError(cause)) return null
          setError(toErrorState(cause))
          return null
        } finally {
          setLoading(false)
        }
      }, [effectiveLanguage, languageQuery, root, rootQuery])

      useEffect(() => {
        void load()
      }, [load])

      // Release the debounce timer and the in-flight request when the panel
      // goes away, so a late response cannot touch a unmounted component.
      useEffect(
        () => () => {
          if (searchTimer.current) clearTimeout(searchTimer.current)
          if (searchAbort.current) searchAbort.current.abort()
          if (pollRef.current) clearInterval(pollRef.current)
          if (toastTimer.current) clearTimeout(toastTimer.current)
          if (panFrameRef.current) cancelAnimationFrame(panFrameRef.current)
          if (impactAbortRef.current) impactAbortRef.current.abort()
        },
        [],
      )

      /** Open one page and show its parsed blocks. */
      const openPage = useCallback(
        async (id) => {
          if (!id) return null
          setMode('wiki')
          setSidebarOpen(false)
          setOpening(true)
          try {
            const data = await requestJson(
              `/api/repowiki/page?id=${encodeURIComponent(id)}&${languageQuery}${rootQuery}`,
            )
            setPage(data)
            setCurrentId(id)
            setError(null)
            setRecent(
              rememberPage({
                id,
                title: data?.meta?.title || data?.title || id,
                at: Date.now(),
              }),
            )
            return data
          } catch (cause) {
            if (isAbortError(cause)) return null
            setError(toErrorState(cause))
            return null
          } finally {
            setOpening(false)
          }
        },
        [languageQuery, rootQuery],
      )

      /** Run one search request; a newer request cancels this one. */
      const runSearch = useCallback(
        async (value) => {
          const trimmed = String(value ?? '').trim()
          if (!trimmed) {
            setHits(null)
            setSearching(false)
            return null
          }
          if (searchAbort.current) searchAbort.current.abort()
          const controller = new AbortController()
          searchAbort.current = controller
          setSearching(true)
          try {
            const data = await requestJson(
              `/api/repowiki/search?q=${encodeURIComponent(trimmed)}&${languageQuery}${rootQuery}`,
              { signal: controller.signal },
            )
            if (controller.signal.aborted) return null
            setHits(data)
            setError(null)
            return data
          } catch (cause) {
            if (isAbortError(cause)) return null
            setError(toErrorState(cause))
            return null
          } finally {
            if (searchAbort.current === controller) {
              searchAbort.current = null
              setSearching(false)
            }
          }
        },
        [languageQuery, rootQuery],
      )

      /** Debounced search input: 200 ms of quiet, then one request. */
      const onQueryChange = useCallback(
        (value) => {
          setQuery(value)
          if (searchTimer.current) {
            clearTimeout(searchTimer.current)
            searchTimer.current = null
          }
          if (searchAbort.current) {
            searchAbort.current.abort()
            searchAbort.current = null
          }
          if (!String(value ?? '').trim()) {
            setHits(null)
            setSearching(false)
            return
          }
          setSearching(true)
          searchTimer.current = setTimeout(() => {
            searchTimer.current = null
            void runSearch(value)
          }, SEARCH_DEBOUNCE_MS)
        },
        [runSearch],
      )

      /** Apply one of the suggested keywords right away. */
      const applySuggestion = useCallback(
        (value) => {
          setQuery(value)
          if (searchTimer.current) {
            clearTimeout(searchTimer.current)
            searchTimer.current = null
          }
          void runSearch(value)
        },
        [runSearch],
      )

      /**
       * Generate the wiki with a live progress card: an optimistic card shows
       * immediately, a 400 ms poll of `/api/repowiki/progress` keeps the
       * counts and the bar current, and when the POST settles the panel and
       * the open page refresh so the reader never presses refresh by hand.
       */
      const generate = useCallback(
        async (mode, languageOverride) => {
          if (busy) return
          const targetLanguage = languageOverride || effectiveLanguage
          setBusy(true)
          setGen({ status: 'running', phase: 'scan', done: 0, total: 0, failed: 0, current: null, mode, language: targetLanguage })
          const poll = setInterval(() => {
            void requestJson(`/api/repowiki/progress?${languageQuery}${rootQuery}`)
              .then((data) => {
                if (data && data.progress) setGen(data.progress)
              })
              .catch(() => {
                // A failed poll keeps the optimistic card; the POST result decides.
              })
          }, 400)
          pollRef.current = poll
          try {
            await requestJson('/api/repowiki/generate', {
              method: 'POST',
              body: { mode, language: targetLanguage, dry_run: false, root: root || undefined },
            })
            setError(null)
            if (targetLanguage !== effectiveLanguage) setLanguage(targetLanguage)
            clearPanelCache()
            await load()
            if (currentId) await openPage(currentId)
          } catch (cause) {
            if (isAbortError(cause)) return
            // A cancelled run surfaces as a normal (failed) generation: the
            // journal recorded it and the previous wiki stays intact.
            setError(toErrorState(cause))
          } finally {
            if (pollRef.current) {
              clearInterval(pollRef.current)
              pollRef.current = null
            }
            setGen(null)
            setBusy(false)
            // The wiki on disk changed: the graph is rebuilt on next view.
            setGraphData(null)
            graphFetchedAtRef.current = 0
            graphSignatureRef.current = null
            setGraphStale(false)
          }
        },
        [busy, currentId, effectiveLanguage, languageQuery, load, openPage, root, rootQuery],
      )
      /** Cancel the active generation through the host. */
      const cancelGenerate = useCallback(async () => {
        try {
          await requestJson('/api/repowiki/abort', {
            method: 'POST',
            body: { root: root || undefined, language: effectiveLanguage },
          })
        } catch {
          // The run may have finished between the click and the abort.
        }
      }, [effectiveLanguage, root])

      /** Export the wiki of the current repository and banner the result. */
      const exportWiki = useCallback(async () => {
        setBusy(true)
        try {
          const result = await requestJson('/api/repowiki/export', {
            method: 'POST',
            body: { target: 'qoder', root: root || undefined },
          })
          const count = Array.isArray(result?.files) ? result.files.length : Number(result?.files ?? 0)
          showToast(`${t('exported')} ${count} ${t('exportedFiles')}`)
        } catch (cause) {
          if (!isAbortError(cause)) showToast(`${t('exportFailed')}：${toErrorState(cause).message}`)
        } finally {
          setBusy(false)
        }
      }, [root, showToast, t])

      /** Fetch one level of the knowledge graph. */
      const fetchGraph = useCallback(
        async (level, moduleDir) => {
          setGraphLoading(true)
          try {
            const params = new URLSearchParams({ level })
            if (moduleDir) params.set('module', moduleDir)
            const data = await requestJson(`/api/repowiki/graph?${params.toString()}&${languageQuery}${rootQuery}`)
            setGraphData(data)
            setGraphLevel(level === 'file' ? 'file' : 'module')
            setGraphModule(moduleDir || '')
            setGraphSelected(null)
            setGraphImpact(null)
            setGraphQuery('')
            setViewBoxState(null)
            setGraphStale(false)
            graphFetchedAtRef.current = Date.now()
            graphSignatureRef.current = data?.signature ?? null
            return data
          } catch (cause) {
            if (!isAbortError(cause)) setError(toErrorState(cause))
            return null
          } finally {
            setGraphLoading(false)
          }
        },
        [languageQuery, rootQuery],
      )

      /** Select a graph node: modules also fetch their impact set. */
      const selectGraphNode = useCallback(
        async (node) => {
          const nextSelected = graphSelected === node.id ? null : node.id
          setGraphSelected(nextSelected)
          if (impactAbortRef.current) {
            impactAbortRef.current.abort()
            impactAbortRef.current = null
          }
          if (!nextSelected || graphLevel !== 'module' || node.type !== 'module') {
            setGraphImpact(null)
            return
          }
          const controller = new AbortController()
          impactAbortRef.current = controller
          try {
            const data = await requestJson(
              `/api/repowiki/impact?module=${encodeURIComponent(node.dir)}&${languageQuery}${rootQuery}`,
              { signal: controller.signal },
            )
            if (!controller.signal.aborted) setGraphImpact(data)
          } catch (cause) {
            if (!controller.signal.aborted && !isAbortError(cause)) setGraphImpact(null)
          } finally {
            if (impactAbortRef.current === controller) impactAbortRef.current = null
          }
        },
        [graphLevel, graphSelected, languageQuery, rootQuery],
      )

      /**
       * Open the source behind a `path:line` citation in the side drawer.
       *
       * The host validates the path (relative, inside the root, non-secret);
       * the browser never reads the filesystem directly.
       */
      const openSource = useCallback(
        async (token) => {
          const parsed = parseCitation(token)
          if (!parsed) return null
          setSourcePeek({ loading: true, path: parsed.path, line: parsed.line, endLine: parsed.endLine, token })
          setSourcePeekError(null)
          try {
            const data = await requestJson(
              `/api/repowiki/source?path=${encodeURIComponent(parsed.path)}&line=${parsed.line}&context=16${rootQuery}`,
            )
            setSourcePeek({ loading: false, ...data, token })
            return data
          } catch (cause) {
            if (isAbortError(cause)) return null
            setSourcePeekError(toErrorState(cause))
            setSourcePeek((current) => (current ? { ...current, loading: false } : current))
            return null
          }
        },
        [rootQuery],
      )

      /** Close the source peek drawer. */
      const closeSource = useCallback(() => {
        setSourcePeek(null)
        setSourcePeekError(null)
      }, [])

      // Escape closes the source drawer and the import dialog.
      useEffect(() => {
        if (!sourcePeek && !pendingImport && !helpOpen && !moreOpen) return
        const onKey = (event) => {
          if (event.key !== 'Escape') return
          if (sourcePeek) closeSource()
          else if (pendingImport) setPendingImport(null)
          else if (helpOpen) setHelpOpen(false)
          else if (moreOpen) setMoreOpen(false)
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [sourcePeek, pendingImport, helpOpen, moreOpen, closeSource])

      /** Import a wiki produced elsewhere, after an explicit confirmation. */
      const runImport = useCallback(
        async (source) => {
          setPendingImport(null)
          setBusy(true)
          try {
            const result = await requestJson('/api/repowiki/import', {
              method: 'POST',
              body: { source, root: root || undefined, backup: true },
            })
            clearPanelCache()
            await load()
            showToast(`${t('importDone')} · ${result?.pages ?? 0} ${t('pages')}`)
          } catch (cause) {
            if (!isAbortError(cause)) showToast(`${t('importFailed')}：${toErrorState(cause).message}`)
          } finally {
            setBusy(false)
          }
        },
        [load, root, showToast, t],
      )

      useEffect(() => {
        if (mode !== 'graph') return
        // A cached graph is reused for a short window; after that it is
        // refreshed silently so source edits show up without a manual click.
        if (!graphData || Date.now() - graphFetchedAtRef.current > GRAPH_TTL_MS) {
          void fetchGraph(graphLevel, graphModule)
        }
        // `graphLevel` / `graphModule` are intentionally not dependencies:
        // switching level calls `fetchGraph` itself.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [mode, graphData, fetchGraph])

      // Freshness check: the server rebuilds the index from the current source
      // tree, so comparing its scan signature with the one the graph was built
      // from tells us whether the picture on screen is still current.
      useEffect(() => {
        if (mode !== 'graph' || !graphData) return
        let cancelled = false
        const check = async () => {
          if (cancelled) return
          const started = Date.now()
          if (started - graphCheckRef.current < 4000) return
          graphCheckRef.current = started
          try {
            const data = await requestJson(`/api/repowiki/graph?signatureOnly=1&${rootQuery}`)
            if (cancelled) return
            if (data?.signature && graphSignatureRef.current && data.signature !== graphSignatureRef.current) {
              setGraphStale(true)
            }
          } catch {
            // A failed freshness probe keeps the last known state.
          }
        }
        void check()
        const timer = setInterval(() => void check(), GRAPH_CHECK_MS)
        return () => {
          cancelled = true
          clearInterval(timer)
        }
      }, [mode, graphData, rootQuery])

      // Wheel zoom anchored at the cursor. A native non-passive listener is
      // required: React registers wheel handlers passively, and a zooming
      // surface must not scroll the shell.
      useEffect(() => {
        const svg = svgRef.current
        if (mode !== 'graph' || !svg) return
        const handler = (event) => {
          event.preventDefault()
          const base = baseBoxRef.current
          if (!base) return
          const rect = svg.getBoundingClientRect()
          // `preserveAspectRatio="xMidYMid meet"` letterboxes the drawing;
          // map the cursor into the content rectangle, not the element rect.
          const scale = Math.min(rect.width / base.w, rect.height / base.h) || 1
          const contentW = base.w * scale
          const contentH = base.h * scale
          const offsetX = (rect.width - contentW) / 2
          const offsetY = (rect.height - contentH) / 2
          const px = Math.min(1, Math.max(0, (event.clientX - rect.left - offsetX) / contentW))
          const py = Math.min(1, Math.max(0, (event.clientY - rect.top - offsetY) / contentH))
          setViewBoxState((current) => {
            const box = current ?? base
            const factor = event.deltaY > 0 ? 1.15 : 1 / 1.15
            const w = Math.min(base.w * 6, Math.max(base.w * 0.15, box.w * factor))
            const h = Math.min(base.h * 6, Math.max(base.h * 0.15, box.h * factor))
            return { x: box.x + (box.w - w) * px, y: box.y + (box.h - h) * py, w, h }
          })
        }
        svg.addEventListener('wheel', handler, { passive: false })
        return () => svg.removeEventListener('wheel', handler)
      }, [mode, graphData])

      const stats = panel && panel.stats ? panel.stats : null
      const pageById = useMemo(() => {
        const map = new Map()
        for (const entry of (panel && panel.pages) || []) {
          if (entry && entry.id) map.set(entry.id, entry)
        }
        return map
      }, [panel])

      const tree = useMemo(() => {
        if (hits) return hits.hits || []
        if (!panel) return []
        return panel.pages || []
      }, [hits, panel])

      /**
       * The five panel states: idle, loading, ready, empty, error.
       * A failure always wins, an in-flight request comes next, then the
       * selected page, the overview and the "no wiki yet" case.
       */
      const status = error
        ? 'error'
        : opening || (loading && !panel)
          ? 'loading'
          : page
            ? 'ready'
            : !panel
              ? 'idle'
              : panel.exists
                ? 'ready'
                : 'empty'

      const run = panel && panel.run ? panel.run : null
      const runTone = run ? (run.status === 'done' ? STATUS_TONE.fresh : run.status === 'failed' ? STATUS_TONE['needs-review'] : STATUS_TONE.stale) : null
      const runLabel = run
        ? run.status === 'done'
          ? t('runDone')
          : run.status === 'failed'
            ? t('runFailed')
            : run.status === 'running'
              ? t('runRunning')
              : String(run.status)
        : null
      // Qoder-style breadcrumb: the wiki name plus the emphasised repo name.
      const repoName = panel && panel.root
        ? String(panel.root).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || String(panel.root)
        : null

      const cardCount = panel && Array.isArray(panel.cards) ? panel.cards.length : 0
      const hasWiki = Boolean(panel && panel.exists)
      // Languages that actually have pages: switching to a missing one must
      // explain itself instead of rendering an empty wiki.
      const availableLanguages = Array.isArray(panel?.availableLanguages) ? panel.availableLanguages : []
      const languageMissing = Boolean(
        panel && panel.exists && availableLanguages.length > 0 && !availableLanguages.includes(effectiveLanguage),
      )
      // The host and the browser half are versioned together; a mismatch means
      // the shell is still serving an older bundle and a reload is required.
      const clientStale = Boolean(panel?.serverVersion && panel.serverVersion !== CLIENT_VERSION)
      // Search results obey the status filter; the raw count stays available
      // in the header so an empty filtered list is explained.
      const filteredHits = hits
        ? (hits.hits ?? []).filter((hit) => {
            if (searchFilter === 'all') return true
            if (searchFilter === 'fresh') return hit.status === 'fresh'
            return hit.status !== 'fresh'
          })
        : null
      const modeTab = (id, icon, label) =>
        h(
          'button',
          {
            type: 'button',
            className: `repowiki-tab${mode === id ? ' is-active' : ''}`,
            'aria-pressed': mode === id ? 'true' : 'false',
            'aria-label': label,
            title: label,
            onClick: () => setMode(id),
          },
          h(Glyph, { name: icon, size: 13 }),
          h('span', { className: 'repowiki-tab-label' }, label),
        )

      const header = h(
        'header',
        { className: 'repowiki-header' },
        h(
          'button',
          {
            type: 'button',
            className: 'repowiki-menu-btn repowiki-btn is-icon',
            title: sidebarOpen ? t('sidebarClose') : t('sidebarOpen'),
            'aria-label': sidebarOpen ? t('sidebarClose') : t('sidebarOpen'),
            'aria-expanded': sidebarOpen ? 'true' : 'false',
            onClick: () => setSidebarOpen((open) => !open),
          },
          h(Glyph, { name: 'menu', size: 15 }),
        ),
        clientStale
          ? h(
              'span',
              {
                className: 'repowiki-badge-stale',
                title: t('restartHint'),
                role: 'status',
              },
              '!',
              t('restartHint'),
            )
          : null,
        h(
          'button',
          {
            type: 'button',
            className: 'repowiki-brand',
            onClick: () => setMode('wiki'),
            title: t('panel'),
          },
          h('span', { className: 'repowiki-brand-mark' }, h(RepoWikiPanelIcon, { size: 18 })),
          h(
            'span',
            { className: 'repowiki-brand-copy' },
            h(
              'span',
              { className: 'repowiki-brand-line' },
              h('span', { className: 'repowiki-brand-title' }, t('panel')),
              repoName ? h('span', { className: 'repowiki-brand-slash' }, '/') : null,
              repoName ? h('span', { className: 'repowiki-brand-repo' }, repoName) : null,
            ),
            h(
              'span',
              { className: 'repowiki-brand-sub', title: (panel && panel.root) || '' },
              run ? h('span', { className: 'repowiki-run-dot', style: { background: runTone } }) : null,
              run
                ? `${t('lastRun')} ${runLabel}${run.pages != null ? ` · ${run.pages} ${t('pages')}` : ''}`
                : (panel && panel.root) || t('emptyRepo'),
              stats ? ` · ${t('citations')} ${stats.citationTotal}` : '',
            ),
          ),
        ),
        h(
          'nav',
          { className: 'repowiki-tabs', 'aria-label': t('panel') },
          modeTab('wiki', 'wiki', t('tabsWiki')),
          modeTab('graph', 'graph', t('graph')),
          cardCount > 0 ? modeTab('cards', 'cards', t('tabsCards')) : null,
          modeTab('projects', 'projects', t('projects')),
        ),
        h('div', { style: { flex: '1 1 auto' } }),
        panel && Array.isArray(panel.roots) && panel.roots.length > 1
          ? (() => {
              // A hand-drawn workspace switcher: the native `<select>` popup is
              // styled by the OS (a white list on a dark shell), so the menu is
              // composed from the same tokens as the rest of the panel.
              const currentPath = root || (panel && panel.root) || ''
              const current = panel.roots.find((choice) => choice.path === currentPath)
              const currentName = current ? current.title : rootDisplayNameOf(currentPath)
              const pick = (path) => {
                setRoot(path)
                setPage(null)
                setCurrentId('')
                setHits(null)
                setGraphData(null)
                setRootMenuOpen(false)
              }
              return h(
                'div',
                { style: { position: 'relative', flex: '0 0 auto' } },
                rootMenuOpen
                  ? h('div', {
                      'aria-hidden': 'true',
                      onClick: () => setRootMenuOpen(false),
                      style: { position: 'fixed', inset: 0, zIndex: 29, background: 'transparent' },
                    })
                  : null,
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'repowiki-btn repowiki-root-btn',
                    'aria-label': t('repository'),
                    'aria-expanded': rootMenuOpen ? 'true' : 'false',
                    title: currentPath,
                    onClick: () => setRootMenuOpen((open) => !open),
                    style: {
                      maxWidth: '220px',
                      padding: '0 9px',
                      borderColor: rootMenuOpen ? 'var(--rw-accent-line)' : undefined,
                      background: rootMenuOpen ? 'var(--rw-accent-soft)' : undefined,
                    },
                  },
                  h(Glyph, { name: 'projects', size: 12 }),
                  h(
                    'span',
                    { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                    currentName,
                  ),
                  h('span', { 'aria-hidden': 'true', style: { fontSize: '9px', opacity: 0.7 } }, '▾'),
                ),
                rootMenuOpen
                  ? h(
                      'div',
                      {
                        role: 'listbox',
                        'aria-label': t('repository'),
                        style: {
                          position: 'absolute',
                          right: 0,
                          top: 'calc(100% + 6px)',
                          zIndex: 30,
                          minWidth: '220px',
                          maxHeight: '320px',
                          overflowY: 'auto',
                          padding: '5px',
                          borderRadius: '12px',
                          border: '1px solid var(--rw-line)',
                          background: hostSurface('rgba(28,28,28,0.98)'),
                          boxShadow: 'var(--rw-shadow)',
                        },
                      },
                      panel.roots.map((choice) =>
                        h(
                          'button',
                          {
                            key: choice.path,
                            type: 'button',
                            role: 'option',
                            'aria-selected': choice.active ? 'true' : 'false',
                            className: 'repowiki-row',
                            title: choice.path,
                            onClick: () => pick(choice.path),
                            style: {
                              display: 'flex',
                              alignItems: 'center',
                              gap: '7px',
                              width: '100%',
                              textAlign: 'left',
                              padding: '6px 8px',
                              marginBottom: '1px',
                              border: 'none',
                              borderRadius: token('--dsw-radius-sm', '7px'),
                              background: choice.active ? `${ACCENT()}1f` : 'transparent',
                              color: choice.active ? ACCENT() : token('--dsw-alias-label-primary', '#e6e6e6'),
                              fontSize: '12px',
                              cursor: 'pointer',
                            },
                          },
                          h(
                            'span',
                            { style: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                            choice.title || choice.path,
                          ),
                          choice.active ? h('span', { 'aria-hidden': 'true', style: { fontSize: '10px' } }, '✓') : null,
                        ),
                      ),
                    )
                  : null,
              )
            })()
          : null,
        h(
          'div',
          {
            role: 'group',
            className: 'repowiki-segment',
            'aria-label': t('language'),
          },
          ['zh', 'en'].map((code) =>
            h(
              'button',
              {
                key: code,
                type: 'button',
                className: effectiveLanguage === code ? 'is-active' : '',
                onClick: () => setLanguage(code),
                disabled: busy,
                'aria-pressed': effectiveLanguage === code ? 'true' : 'false',
              },
              code,
            ),
          ),
        ),
        h(
          Button,
          { icon: true, onClick: () => void load(), disabled: loading, title: t('refresh') },
          h(Glyph, { name: 'refresh', size: 14 }),
        ),
        h(
          Button,
          { onClick: () => void generate('update'), disabled: busy, primary: hasWiki },
          busy ? t('generating') : t('update'),
        ),
        h(
          'span',
          { className: 'repowiki-generate' },
          h(
            Button,
            { onClick: () => void generate('full'), disabled: busy, primary: !hasWiki },
            busy ? t('generating') : t('generate'),
          ),
        ),
      )

      const sidebar = h(
        'aside',
        { className: `repowiki-sidebar${sidebarOpen ? ' is-open' : ''}`, 'aria-label': t('allPages') },
        h(
          'div',
          { className: 'repowiki-search' },
          h(
            'div',
            { className: 'repowiki-search-field' },
            h(Glyph, { name: 'search', size: 13, style: { position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--rw-fg-3)', pointerEvents: 'none' } }),
            h('input', {
              type: 'search',
              value: query,
              placeholder: t('searchPlaceholder'),
              'aria-label': t('search'),
              onChange: (event) => onQueryChange(event.target.value),
            }),
            query
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'repowiki-search-clear',
                    title: t('searchClear'),
                    'aria-label': t('searchClear'),
                    onClick: () => onQueryChange(''),
                  },
                  '✕',
                )
              : null,
          ),
          h(
            Button,
            {
              icon: true,
              onClick: () => void exportWiki(),
              disabled: busy,
              title: t('exportTip'),
            },
            h(Glyph, { name: 'download', size: 14 }),
          ),
          h(
            'div',
            { style: { position: 'relative', flex: '0 0 auto' } },
            h(
              Button,
              {
                icon: true,
                onClick: () => setMoreOpen((open) => !open),
                disabled: busy,
                title: t('importMenu'),
                active: moreOpen,
              },
              h(Glyph, { name: 'more', size: 14 }),
            ),
            moreOpen
              ? h(
                  'div',
                  {
                    role: 'menu',
                    'aria-label': t('importMenu'),
                    style: {
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      zIndex: 30,
                      minWidth: '232px',
                      padding: '5px',
                      borderRadius: '12px',
                      border: '1px solid var(--rw-line)',
                      background: hostSurface('rgba(30,30,30,0.98)'),
                      boxShadow: 'var(--rw-shadow)',
                    },
                  },
                  h(
                    'button',
                    {
                      type: 'button',
                      role: 'menuitem',
                      className: 'repowiki-row',
                      onClick: () => {
                        setMoreOpen(false)
                        setPendingImport('qoder')
                      },
                      style: {
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '7px 9px',
                        border: 'none',
                        borderRadius: '8px',
                        background: 'transparent',
                        color: 'var(--rw-fg-2)',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                      },
                    },
                    t('importQoder'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      role: 'menuitem',
                      className: 'repowiki-row',
                      onClick: () => {
                        setMoreOpen(false)
                        setPendingImport('dsh')
                      },
                      style: {
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '7px 9px',
                        border: 'none',
                        borderRadius: '8px',
                        background: 'transparent',
                        color: 'var(--rw-fg-2)',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                      },
                    },
                    t('importDsh'),
                  ),
                  h('div', { 'aria-hidden': 'true', style: { height: '1px', margin: '5px 3px', background: 'var(--rw-line)' } }),
                  h(
                    'button',
                    {
                      type: 'button',
                      role: 'menuitem',
                      className: 'repowiki-row',
                      onClick: () => {
                        setMoreOpen(false)
                        void generate('full')
                      },
                      style: {
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '7px 9px',
                        border: 'none',
                        borderRadius: '8px',
                        background: 'transparent',
                        color: 'var(--rw-fg-2)',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                      },
                    },
                    t('regenerateAll'),
                  ),
                )
              : null,
          ),
        ),
        h(
          'div',
          { className: 'repowiki-sidebar-toolbar' },
          h('span', { className: 'repowiki-eyebrow' }, t('allPages')),
          h(
            'span',
            { className: 'repowiki-eyebrow', style: { letterSpacing: 0, textTransform: 'none' } },
            stats ? `${stats.pageCount} ${t('pages')} · ${stats.citationTotal} ${t('citations')}` : '',
          ),
        ),
        searching
          ? h(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  marginBottom: '8px',
                  color: token('--dsw-alias-label-tertiary', '#7d7d7d'),
                },
              },
              h('span', { 'aria-hidden': 'true', style: { width: '8px', height: '8px', borderRadius: '50%', border: `2px solid ${ACCENT()}55`, borderTopColor: ACCENT(), display: 'inline-block', animation: 'repowiki-fade-in 0.6s linear infinite' } }),
              t('searching'),
            )
          : null,
        hits
          ? h(
              'div',
              null,
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                    fontSize: '11px',
                    color: token('--dsw-alias-label-tertiary', '#7d7d7d'),
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  },
                },
                h('span', null, `${t('search')} · ${filteredHits.length}`),
                h(
                  'div',
                  { className: 'repowiki-filter', role: 'group', 'aria-label': t('status'), style: { marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 } },
                  [
                    ['all', t('filterAll')],
                    ['fresh', t('filterFresh')],
                    ['stale', t('filterStale')],
                  ].map(([id, label]) =>
                    h(
                      'button',
                      {
                        key: id,
                        type: 'button',
                        className: searchFilter === id ? 'is-active' : '',
                        'aria-pressed': searchFilter === id ? 'true' : 'false',
                        onClick: () => setSearchFilter(id),
                      },
                      label,
                    ),
                  ),
                ),
              ),
              filteredHits.length === 0
                ? h(
                    'div',
                    { style: { fontSize: '12px', color: token('--dsw-alias-label-tertiary', '#7d7d7d'), padding: '8px 4px' } },
                    h('div', { style: { marginBottom: '6px' } }, t('noResults')),
                    h('div', { style: { marginBottom: '4px' } }, t('noResultsHint')),
                    h(
                      'div',
                      { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' } },
                      SEARCH_SUGGESTIONS.map((word) =>
                        h(
                          'button',
                          {
                            key: word,
                            type: 'button',
                            className: 'repowiki-row',
                            onClick: () => applySuggestion(word),
                            style: {
                              padding: '2px 8px',
                              borderRadius: '999px',
                              border: `1px solid ${token('--dsw-alias-border-l2', 'rgba(127,127,127,0.35)')}`,
                              background: 'transparent',
                              color: token('--dsw-alias-label-secondary', '#a8a8a8'),
                              fontSize: '11px',
                              cursor: 'pointer',
                            },
                          },
                          word,
                        ),
                      ),
                    ),
                  )
                : null,
              (filteredHits || []).map((hit) =>
                h(
                  'button',
                  {
                    key: hit.id,
                    type: 'button',
                    className: 'repowiki-row',
                    onClick: () => void openPage(hit.id),
                    style: {
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 8px',
                      marginBottom: '2px',
                      border: 'none',
                      borderRadius: token('--dsw-radius-sm', '8px'),
                      background: currentId === hit.id ? `${ACCENT()}1a` : 'transparent',
                      color: token('--dsw-alias-label-primary', '#e6e6e6'),
                      fontSize: '12px',
                      cursor: 'pointer',
                    },
                  },
                                      h(
                      'div',
                      { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                      h(StatusDot, { status: hit.status }),
                      h(
                        'span',
                        { style: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                        highlightParts(hit.title || hit.id, query).map((part, index) =>
                          part.match ? h('mark', { key: index }, part.text) : h('span', { key: index }, part.text),
                        ),
                      ),
                    ),
                  h(
                    'div',
                    { style: { fontSize: '10px', marginTop: '2px', color: token('--dsw-alias-label-tertiary', '#7d7d7d') } },
                    hit.id,
                  ),
                        hit.snippet
                          ? h(
                              'div',
                              {
                                style: {
                                  fontSize: '11px',
                                  marginTop: '3px',
                                  lineHeight: 1.5,
                                  color: token('--dsw-alias-label-tertiary', '#7d7d7d'),
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                },
                              },
                              highlightParts(hit.snippet, query).map((part, index) =>
                                part.match ? h('mark', { key: index }, part.text) : h('span', { key: index }, part.text),
                              ),
                            )
                          : null,
                ),
              ),
            )
          : h(
              'div',
              null,
              recent.length > 0
                ? h(
                    'div',
                    { className: 'repowiki-recent' },
                    h('div', { className: 'repowiki-eyebrow', style: { marginBottom: '6px' } }, t('recent')),
                    h(
                      'div',
                      { className: 'repowiki-recent-list' },
                      recent.map((entry) =>
                        h(
                          'button',
                          {
                            key: entry.id,
                            type: 'button',
                            title: entry.title || entry.id,
                            onClick: () => void openPage(entry.id),
                          },
                          entry.title || entry.id,
                        ),
                      ),
                    ),
                  )
                : null,
              panel && panel.sections
                ? panel.sections.map((section) => {
                    // Update runs mark rewritten pages; a purple dot like the
                    // reference product's "recently changed" markers.
                    const latestAt = panel.generatedAt ?? null
                    const markNew = run && run.mode === 'update' && latestAt
                    const isCollapsed = collapsed.has(section.id || '')
                    const rows = (section.pages || []).filter(Boolean)
                    return h(
                      'div',
                      { key: section.id, style: { marginBottom: '14px' } },
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'repowiki-section-label',
                          onClick: () => toggleSection(section.id || ''),
                          'aria-expanded': isCollapsed ? 'false' : 'true',
                        },
                        h(
                          'span',
                          { 'aria-hidden': 'true', style: { display: 'inline-block', fontSize: '8px', transform: isCollapsed ? 'none' : 'rotate(90deg)', transition: 'transform 0.15s ease' } },
                          '▶',
                        ),
                        h('span', { style: { flex: '1 1 auto' } }, sectionDisplayLabel(section, t)),
                        h('span', { className: 'repowiki-section-count' }, String(rows.length)),
                      ),
                      isCollapsed
                        ? null
                        : rows.map((entry) => {
                        const id = typeof entry === 'string' ? entry : entry && entry.id
                        const meta = pageById.get(id) || (typeof entry === 'object' ? entry : null)
                        if (!id) return null
                        const active = currentId === id
                        const isNew = Boolean(markNew && meta && meta.generatedAt === latestAt)
                        return h(
                          'button',
                          {
                            key: id,
                            type: 'button',
                            className: `repowiki-row repowiki-tree-row${active ? ' is-active' : ''}`,
                            'data-active': active ? 'true' : 'false',
                            'data-page-id': id,
                            onClick: () => void openPage(id),
                            style: {
                              display: 'flex',
                              alignItems: 'center',
                              gap: '7px',
                              width: '100%',
                              textAlign: 'left',
                              padding: '6px 8px',
                              border: 'none',
                              borderRadius: token('--dsw-radius-sm', '8px'),
                              background: active ? `${ACCENT()}1a` : 'transparent',
                              color: active ? ACCENT() : token('--dsw-alias-label-primary', '#e6e6e6'),
                              fontSize: '12px',
                              cursor: 'pointer',
                            },
                          },
                          isNew
                            ? h('span', {
                                title: t('newBadge'),
                                'aria-hidden': 'true',
                                style: {
                                  width: '5px',
                                  height: '5px',
                                  borderRadius: '50%',
                                  background: '#b07ef2',
                                  boxShadow: '0 0 0 3px #b07ef22e',
                                  flex: '0 0 auto',
                                  marginLeft: '-2px',
                                },
                              })
                            : null,
                          h(StatusDot, { status: meta && meta.status }),
                          h(
                            'span',
                            { style: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: active ? 600 : 400 } },
                            (meta && meta.title) || id,
                          ),
                          meta && meta.citationCount > 0
                            ? h(
                                'span',
                                {
                                  title: t('citations'),
                                  style: {
                                    fontSize: '10px',
                                    color: token('--dsw-alias-label-tertiary', '#7d7d7d'),
                                    background: token('--dsw-alias-fill-tsp-secondary', 'rgba(127,127,127,0.12)'),
                                    borderRadius: '999px',
                                    padding: '0 6px',
                                    lineHeight: '16px',
                                  },
                                },
                                String(meta.citationCount),
                              )
                            : null,
                        )
                      }),
                    )
                  })
                : null,
              panel && panel.cards && panel.cards.length
                ? h(
                    'div',
                    { style: { marginTop: '6px', paddingTop: '10px', borderTop: `1px solid ${token('--dsw-alias-border-l2', 'rgba(127,127,127,0.2)')}` } },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'repowiki-section-label',
                        onClick: () => setMode((current) => (current === 'cards' ? 'wiki' : 'cards')),
                        'aria-expanded': mode === 'cards' ? 'true' : 'false',
                        style: { color: mode === 'cards' ? 'var(--rw-accent)' : undefined },
                      },
                      h(Glyph, { name: 'cards', size: 11 }),
                      h('span', { style: { flex: '1 1 auto' } }, t('cardsOverview')),
                      h('span', { className: 'repowiki-section-count' }, String(panel.cards.length)),
                    ),
                    mode === 'cards'
                      ? panel.cards.map((card) =>
                          h(
                            'button',
                            {
                              key: card.id,
                              type: 'button',
                              className: 'repowiki-row',
                              title: card.summary || card.title || card.id,
                              onClick: () => {
                                setMode('wiki')
                                void openPage(`card:${card.id}`)
                              },
                              style: {
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '6px 8px',
                                marginBottom: '2px',
                                border: 'none',
                                borderRadius: token('--dsw-radius-sm', '8px'),
                                background: 'transparent',
                                color: token('--dsw-alias-label-primary', '#e6e6e6'),
                                fontSize: '12px',
                                cursor: 'pointer',
                              },
                            },
                            h(
                              'div',
                              { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                              h('span', { 'aria-hidden': 'true', style: { fontSize: '10px' } }, '★'),
                              h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, card.title || card.id),
                            ),
                            card.tag
                              ? h(
                                  'span',
                                  {
                                    style: {
                                      display: 'inline-block',
                                      marginTop: '2px',
                                      fontSize: '10px',
                                      color: STATUS_TONE.fresh,
                                      border: `1px solid ${STATUS_TONE.fresh}44`,
                                      borderRadius: '999px',
                                      padding: '0 6px',
                                      lineHeight: '15px',
                                    },
                                  },
                                  card.tag,
                                )
                              : null,
                          ),
                        )
                      : h(
                          'div',
                          { style: { padding: '2px 4px', fontSize: '11px', color: token('--dsw-alias-label-tertiary', '#7d7d7d') } },
                          `${panel.cards.length} ${t('cards')}`,
                        ),
                  )
                : null,
            ),
      )

      /**
       * The error state: code, message and hint, plus a way out.
       *
       * Built lazily: `error` is null in every other state, so evaluating the
       * view eagerly would crash the whole slot (`Cannot read properties of
       * null (reading 'code')`) before the first render ever completes.
       */
      const errorView = () =>
        h(
        'div',
        { className: 'repowiki-error repowiki-fade' },
        h(
          'div',
          { className: 'repowiki-error-title' },
          h('span', { 'aria-hidden': 'true', style: { width: '8px', height: '8px', borderRadius: '50%', background: STATUS_TONE['needs-review'], display: 'inline-block' } }),
          `${t('errorTitle')} · ${error.code}`,
        ),
        h('div', { className: 'repowiki-error-body' }, error.message || t('failed')),
        error.hint ? h('div', { className: 'repowiki-error-hint' }, error.hint) : null,
        h(
          'div',
          { style: { marginTop: '14px' } },
          h(Button, { onClick: () => void load() }, `↻ ${t('retry')}`),
        ),
      )

      /** The empty state: no wiki yet — a calm call to action. */
      const emptyView = h(
        'div',
        { className: 'repowiki-empty repowiki-fade' },
        h('div', { className: 'repowiki-empty-mark' }, h(RepoWikiPanelIcon, { size: 28 })),
        h('div', { className: 'repowiki-empty-title' }, t('emptyTitle')),
        h('p', { className: 'repowiki-empty-copy' }, t('empty')),
        h(
          'div',
          { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' } },
          h(Button, { onClick: () => void generate('full'), disabled: busy, primary: true }, busy ? t('generating') : t('generate')),
          h(Button, { onClick: () => void load(), disabled: loading }, `↻ ${t('refresh')}`),
        ),
      )

      /** The loading state: shimmering skeleton instead of a bare sentence. */
      const loadingView = h(
        'div',
        { className: 'repowiki-loading' },
        h(Skeleton, { height: '26px', width: '38%', gap: '18px' }),
        h(Skeleton, { height: '12px', width: '90%' }),
        h(Skeleton, { height: '12px', width: '96%' }),
        h(Skeleton, { height: '12px', width: '72%', gap: '22px' }),
        h(Skeleton, { height: '96px', width: '100%', gap: '18px' }),
        h(Skeleton, { height: '12px', width: '88%' }),
        h(Skeleton, { height: '12px', width: '93%' }),
        h(Skeleton, { height: '12px', width: '64%' }),
      )

      /** The overview landing: hero metrics plus one card per page. */
      const overviewView = () => {
        const pages = (panel && panel.pages) || []
        const freshRatio = stats && stats.pageCount > 0 ? Math.round((stats.fresh / stats.pageCount) * 100) : 0
        // The generation status strip the reference product shows on top of
        // the overview: ✓ 已生成 · X/Y 页 · 0 失败 · 更新时间.
        const completed = run ? (run.pages ?? 0) + (run.skipped ?? 0) : 0
        const totalPlanned = completed + (run?.failed ?? 0)
        const stripTone = run ? (run.status === 'done' ? STATUS_TONE.fresh : run.status === 'failed' ? STATUS_TONE['needs-review'] : STATUS_TONE.stale) : null
        const stripText = run
          ? run.status === 'done'
            ? `${t('generatedOk')} · ${t('wikiFiles') || ''}${totalPlanned > 0 ? ` ${completed}/${totalPlanned}` : ` ${completed}`} · ${t('runFailed')} ${run.failed ?? 0}${panel && panel.generatedAt ? ` · ${t('lastUpdated')} ${String(panel.generatedAt).slice(0, 16).replace('T', ' ')}` : ''}`
            : run.status === 'failed'
              ? `${t('runFailed')}${run.error && run.error.message ? `：${run.error.message}` : ''}`
              : t('generatedRunning')
          : null
        return h(
          'div',
          {
            className: 'repowiki-fade repowiki-scroll repowiki-overview',
          },
          h(
            'div',
            { style: { marginBottom: '14px' } },
            h('div', { className: 'repowiki-eyebrow' }, t('overviewEyebrow')),
            h(
              'h2',
              { style: { margin: '5px 0 3px', fontSize: '23px', fontWeight: 650, letterSpacing: '-.03em', color: 'var(--rw-fg)' } },
              t('overview'),
            ),
            h(
              'div',
              { style: { fontSize: '11.5px', color: 'var(--rw-fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
              (panel && panel.root) || t('emptyRepo'),
            ),
          ),
          stripText
            ? h(
                'div',
                {
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '5px 12px',
                    marginBottom: '12px',
                    borderRadius: '999px',
                    border: `1px solid ${stripTone}44`,
                    background: `${stripTone}12`,
                    color: token('--dsw-alias-label-secondary', '#a8a8a8'),
                    fontSize: '11px',
                  },
                },
                h('span', { 'aria-hidden': 'true', style: { width: '7px', height: '7px', borderRadius: '50%', background: stripTone, display: 'inline-block' } }),
                stripText,
              )
            : null,
          h(
            'div',
            { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' } },
            h(StatCard, { label: t('statPages'), value: stats ? stats.pageCount : 0 }),
            h(StatCard, { label: t('statCitations'), value: stats ? stats.citationTotal : 0, sub: stats ? `${stats.citationFiles} ${t('statFiles')}` : null }),
            h(StatCard, { label: t('statFresh'), value: stats ? `${freshRatio}%` : '0%', sub: stats ? `${stats.fresh}/${stats.pageCount}` : null }),
            h(StatCard, {
              label: t('cards'),
              value: stats ? stats.cardCount : 0,
              sub: panel && panel.generatedAt ? `${t('generated')} ${String(panel.generatedAt).slice(0, 10)}` : null,
            }),
          ),
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '14px 0 10px',
                fontSize: '12px',
                fontWeight: 600,
                color: token('--dsw-alias-label-secondary', '#a8a8a8'),
              },
            },
            t('allPages'),
            h('span', { 'aria-hidden': 'true', style: { flex: '1 1 auto', height: '1px', background: token('--dsw-alias-border-l2', 'rgba(127,127,127,0.2)') } }),
          ),
          h(
            'div',
            { style: { display: 'flex', flexWrap: 'wrap', gap: '10px' } },
            pages.map((entry) =>
              h(
                'button',
                {
                  key: entry.id,
                  type: 'button',
                  className: 'repowiki-row',
                  onClick: () => void openPage(entry.id),
                  style: {
                    display: 'block',
                    width: 'calc(50% - 5px)',
                    minWidth: '240px',
                    flex: '1 1 240px',
                    textAlign: 'left',
                    padding: '12px 14px',
                    border: `1px solid ${token('--dsw-alias-border-l2', 'rgba(127,127,127,0.25)')}`,
                    borderRadius: token('--dsw-radius-md', '12px'),
                    background: token('--dsw-alias-fill-tsp-primary', 'rgba(127,127,127,0.05)'),
                    color: token('--dsw-alias-label-primary', '#e6e6e6'),
                    fontSize: '12px',
                    cursor: 'pointer',
                  },
                },
                h(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' } },
                  h(StatusDot, { status: entry.status }),
                  h(
                    'span',
                    { style: { fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                    entry.title || entry.id,
                  ),
                ),
                entry.goal
                  ? h(
                      'div',
                      {
                        style: {
                          fontSize: '11px',
                          color: token('--dsw-alias-label-tertiary', '#7d7d7d'),
                          marginBottom: '6px',
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        },
                      },
                      entry.goal,
                    )
                  : null,
                h(
                  'div',
                  { style: { display: 'flex', gap: '10px', fontSize: '10px', color: token('--dsw-alias-label-tertiary', '#7d7d7d') } },
                  h('span', null, entry.id),
                  entry.citationCount > 0 ? h('span', null, `${t('citations')} ${entry.citationCount}`) : null,
                  entry.generatedAt ? h('span', null, String(entry.generatedAt).slice(0, 10)) : null,
                ),
              ),
            ),
          ),
        )
      }

      /** One page: back row, meta chips, a TOC strip and the parsed blocks. */
      const pageView = () => {
        // The generated body repeats its title as an H1; the panel already
        // renders that title, so the duplicate heading is dropped (it also
        // keeps the TOC from listing the page name as its first entry).
        const visibleBlocks = (page.blocks || [])
          .map((block, index) => ({ block, index }))
          .filter((entry) => !(entry.index === 0 && entry.block?.type === 'heading' && entry.block.level === 1))
        const headings = []
        for (let index = 1; index < (page.blocks || []).length; index += 1) {
          const block = page.blocks[index]
          if (block && block.type === 'heading' && (block.level || 9) <= 3 && block.text) {
            headings.push({ index, text: block.text, level: block.level || 2 })
          }
        }
        const scrollTo = (bidx) => {
          try {
            const node = contentRef.current ? contentRef.current.querySelector(`[data-bidx="${bidx}"]`) : null
            if (node && typeof node.scrollIntoView === 'function') node.scrollIntoView({ behavior: 'smooth', block: 'start' })
          } catch {
            // Scrolling is an enhancement; a missing node is fine.
          }
        }
        return h(
          'div',
          {
            ref: contentRef,
            className: 'repowiki-fade repowiki-scroll repowiki-page',
          },
          h(
            'div',
            { className: 'repowiki-page-head' },
            h(
              'button',
              {
                type: 'button',
                className: 'repowiki-back',
                onClick: () => {
                  setPage(null)
                  setCurrentId('')
                },
              },
              `← ${t('allPages')}`,
            ),
            page.path ? h('code', { className: 'repowiki-path', title: page.path }, page.path) : null,
          ),
          // Hierarchical breadcrumb: the plan parent chain, nearest parent last.
          (page.parents || []).length > 0
            ? h(
                'div',
                { className: 'repowiki-breadcrumb' },
                (page.parents || []).map((parent) =>
                  h(
                    'button',
                    {
                      key: parent.id,
                      type: 'button',
                      onClick: () => void openPage(parent.id),
                    },
                    parent.title || parent.id,
                  ),
                ),
              )
            : null,
          h(
            'h1',
            { className: 'repowiki-page-title' },
            page.title || page.id,
          ),
          h(
            'div',
            { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' } },
            page.status ? h(StatusChip, null, t(STATUS_LABEL_KEYS[page.status] ?? 'stateReady')) : null,
            page.confidence ? h(Chip, null, `${t('confidence')} ${page.confidence}`) : null,
            page.citations && page.citations.length ? h(Chip, null, `${t('citations')} ${page.citations.length}`) : null,
            page.generatedAt ? h(Chip, null, `${t('lastUpdated')} ${String(page.generatedAt).slice(0, 16).replace('T', ' ')}`) : null,
          ),
          page.goal
            ? h(
                'p',
                { className: 'repowiki-page-goal' },
                page.goal,
              )
            : null,
          headings.length > 1
            ? h(
                'div',
                { className: 'repowiki-toc' },
                h('span', { className: 'repowiki-eyebrow' }, t('toc')),
                headings.map((heading, order) =>
                  h(
                    'button',
                    {
                      key: heading.index,
                      type: 'button',
                      onClick: () => scrollTo(heading.index),
                      style: { marginLeft: heading.level === 3 ? '8px' : 0 },
                    },
                    `${order + 1}. ${heading.text}`,
                  ),
                ),
              )
            : null,
          visibleBlocks.map((entry) => h(MarkdownBlock, { key: entry.index, block: entry.block, blockIndex: entry.index, t, onOpenCard: (cardRef) => void openPage(cardRef), onOpenSource: (token) => void openSource(token) })),
        )
      }

      /** The live generation card, in the reference product's style. */
      const progressView = () => {
        const total = Number(gen?.total ?? 0)
        const done = Number(gen?.done ?? 0)
        const failed = Number(gen?.failed ?? 0)
        const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
        const phase = gen?.phase === 'scan' ? t('stateLoading') : gen?.phase === 'plan' ? t('sections') : gen?.phase === 'persist' ? t('exportTip') : t('progressTitle')
        return h(
          'div',
          { className: 'repowiki-progress' },
          h('div', { className: 'repowiki-empty-mark' }, h(RepoWikiPanelIcon, { size: 26 })),
          h('div', { style: { fontSize: '16px', fontWeight: 650, letterSpacing: '-.02em' } }, t('progressTitle')),
          h(
            'div',
            { className: 'repowiki-progress-card', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'false' },
            h(
              'div',
              { className: 'repowiki-progress-phase' },
              h('span', { className: 'repowiki-spinner', 'aria-hidden': 'true' }),
              h('span', { style: { fontWeight: 600, color: 'var(--rw-fg)' } }, phase),
              h('span', null, `· ${gen?.mode === 'update' ? t('update') : t('generate')}`),
            ),
            h(
              'div',
              { style: { fontSize: '12px', color: token('--dsw-alias-label-secondary', '#a8a8a8'), marginBottom: '8px' } },
              total > 0
                ? `${t('progressDoneLabel')} ${done}/${total}（${pct}%）${failed > 0 ? ` · ${t('progressInFlight')} 0 · ${t('runFailed')} ${failed}` : ''}`
                : t('loading'),
            ),
            gen?.current
              ? h(
                  'div',
                  { style: { fontSize: '11px', color: token('--dsw-alias-label-tertiary', '#7d7d7d'), marginBottom: '8px', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' } },
                  String(gen.current),
                )
              : null,
            h(
              'div',
              { className: 'repowiki-progress-bar', 'aria-hidden': 'true' },
              h('div', {
                style: {
                  width: `${total > 0 ? Math.max(4, pct) : 6}%`,
                },
              }),
            ),
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', fontSize: '11px', color: token('--dsw-alias-label-tertiary', '#7d7d7d') } },
              h('span', null, `${t('language')}　${effectiveLanguage === 'zh' ? '简体中文' : 'English'}`),
              h('span', null, panel && panel.generator ? `v${panel.generator.version ?? ''}` : ''),
            ),
          ),
          h(
            'div',
            { style: { display: 'flex', gap: '10px' } },
            h(Button, { onClick: () => void cancelGenerate(), primary: true }, t('cancel')),
          ),
        )
      }

      /**
       * Layout and edge routing depend only on the graph payload, never on the
       * camera. Memoising them keeps a 300-node pan from re-running the
       * barycentric sweeps on every pointermove.
       */
      const graphScene = useMemo(() => {
        const nodes = (graphData && graphData.nodes) || []
        const edges = (graphData && graphData.edges) || []
        const levels = (graphData && graphData.levels) || {}
        const layout = layeredGraphLayout(nodes, edges, levels)
        const channels = edgeChannels(edges, layout.positions)
        return { nodes, edges, layout, channels }
      }, [graphData])

      /**
       * The engineering knowledge graph: a layered SVG view of the module
       * import structure. Clicking a module selects it and highlights its
       * upstream/downstream impact; a detail card offers the file-level drill.
       */
      const graphView = () => {
        const { nodes, edges, layout, channels } = graphScene

        const neighbors = new Map()
        for (const edge of edges) {
          if (!neighbors.has(edge.from)) neighbors.set(edge.from, new Set())
          if (!neighbors.has(edge.to)) neighbors.set(edge.to, new Set())
          neighbors.get(edge.from).add(edge.to)
          neighbors.get(edge.to).add(edge.from)
        }

        const impactNodes = new Set()
        if (graphImpact) {
          for (const dir of [...(graphImpact.upstream ?? []), ...(graphImpact.downstream ?? [])]) {
            impactNodes.add(`mod:${dir}`)
          }
        }
        const impactEdgeActive = (edge) =>
          (impactNodes.has(edge.from) && (graphSelected === edge.from || impactNodes.has(edge.to))) ||
          (impactNodes.has(edge.to) && (graphSelected === edge.to || impactNodes.has(edge.from)))

        const query = graphQuery.trim().toLowerCase()
        const dimmed = (node) => {
          if (query && !`${node.label} ${node.dir}`.toLowerCase().includes(query)) return true
          if (graphHover && graphHover !== node.id && !(neighbors.get(graphHover) ?? new Set()).has(node.id)) return true
          if (graphImpact && graphSelected && node.id !== graphSelected && !impactNodes.has(node.id)) return true
          return false
        }

        const compact = nodes.length > 0 && nodes.length <= 5
        const pad = compact ? 16 : 30
        const baseBox = { x: -pad, y: -pad, w: layout.width + pad * 2, h: layout.height + pad * 2 }
        // The live viewBox (null = fit-to-content). The wheel and the zoom
        // buttons mutate it; every rebuild of the graph resets it.
        baseBoxRef.current = baseBox
        const box = viewBoxState ?? baseBox
        const viewBox = `${box.x} ${box.y} ${box.w} ${box.h}`

        // Viewport culling: a 300-node graph does not need 300 <g> elements in
        // the DOM. Nodes outside the camera (plus a margin) are skipped, and an
        // edge is drawn when at least one of its endpoints is visible. When the
        // user zooms out far enough, the whole graph is rendered again.
        const margin = Math.max(box.w, box.h) * 0.2 + 60
        const culled = nodes.length > GRAPH_CULL_THRESHOLD
        const visibleIds = new Set()
        if (culled) {
          for (const node of nodes) {
            const p = layout.positions.get(node.id)
            if (!p) continue
            const withinX = p.x + GRAPH_NODE_W >= box.x - margin && p.x <= box.x + box.w + margin
            const withinY = p.y + GRAPH_NODE_H >= box.y - margin && p.y <= box.y + box.h + margin
            if (withinX && withinY) visibleIds.add(node.id)
          }
        }
        const isVisible = (id) => !culled || visibleIds.has(id)

        const selectedNode = nodes.find((node) => node.id === graphSelected) ?? null

        // A node is more than a box: link it to the wiki page that documents
        // the same files, and (for a file node) to the source peek.
        const relatedPage = (() => {
          if (!selectedNode) return null
          const pages = (panel && panel.pages) || []
          const filePath = selectedNode.id.startsWith('file:') ? selectedNode.id.slice(5) : selectedNode.path
          if (selectedNode.type === 'file' && filePath) {
            return pages.find((entry) => (entry.files ?? []).includes(filePath)) ?? null
          }
          const dir = selectedNode.dir ? `${selectedNode.dir}/` : ''
          if (!dir) return null
          return pages.find((entry) => (entry.files ?? []).some((file) => String(file).startsWith(dir))) ?? null
        })()
        const relatedCard = relatedPage
          ? ((panel && panel.cards) || []).find((card) => card.id === `card-${relatedPage.id}`) ?? null
          : null

        // Pointer panning: the SVG owns the gesture, the viewBox is the
        // camera. A drag on empty canvas or on a node pans; a press shorter
        // than the threshold stays a click so node selection still works.
        const beginPan = (event) => {
          if (event.button !== 0) return
          // A new press starts a new gesture: the click-suppression left by a
          // previous drag must not swallow this one.
          suppressClickRef.current = false
          const svg = event.currentTarget
          const startBox = viewBoxState ?? baseBox
          const rect = svg.getBoundingClientRect()
          const scale = Math.min(rect.width / startBox.w, rect.height / startBox.h) || 1
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            box: startBox,
            scale,
            moved: false,
            captured: false,
          }
          // Do not capture yet: a plain click must reach the node under the
          // cursor. Capture starts with the first real movement.
        }

        const movePan = (event) => {
          const drag = dragRef.current
          if (!drag || drag.pointerId !== event.pointerId) return
          const dx = event.clientX - drag.startX
          const dy = event.clientY - drag.startY
          if (!drag.moved && Math.hypot(dx, dy) < 3) return
          if (!drag.moved) {
            drag.moved = true
            try {
              event.currentTarget.setPointerCapture(event.pointerId)
              drag.captured = true
            } catch {
              // Without capture the pan still works while the pointer stays
              // inside the canvas.
            }
            setGraphDragging(true)
          }
          const next = {
            x: drag.box.x - dx / drag.scale,
            y: drag.box.y - dy / drag.scale,
            w: drag.box.w,
            h: drag.box.h,
          }
          pendingPanRef.current = next
          if (!panFrameRef.current) {
            panFrameRef.current = requestAnimationFrame(() => {
              panFrameRef.current = 0
              if (pendingPanRef.current) setViewBoxState(pendingPanRef.current)
            })
          }
          event.preventDefault()
        }

        const endPan = (event) => {
          const drag = dragRef.current
          if (!drag || drag.pointerId !== event.pointerId) return
          if (panFrameRef.current) {
            cancelAnimationFrame(panFrameRef.current)
            panFrameRef.current = 0
            if (pendingPanRef.current) setViewBoxState(pendingPanRef.current)
            pendingPanRef.current = null
          }
          suppressClickRef.current = drag.moved
          dragRef.current = null
          setGraphDragging(false)
          if (drag.captured) {
            try {
              event.currentTarget.releasePointerCapture(event.pointerId)
            } catch {
              // The capture may already have been released by the browser.
            }
          }
        }

        const takeClickSuppression = () => {
          if (!suppressClickRef.current) return false
          suppressClickRef.current = false
          return true
        }

        const zoomBy = (factor) =>
          setViewBoxState((current) => {
            const base = baseBoxRef.current ?? baseBox
            const currentBox = current ?? base
            const w = Math.min(base.w * 6, Math.max(base.w * 0.15, currentBox.w * factor))
            const h = Math.min(base.h * 6, Math.max(base.h * 0.15, currentBox.h * factor))
            return {
              x: currentBox.x + (currentBox.w - w) / 2,
              y: currentBox.y + (currentBox.h - h) / 2,
              w,
              h,
            }
          })

        const onGraphKeyDown = (event) => {
          const base = baseBoxRef.current ?? baseBox
          const step = base.w * 0.08
          const nudge = (dx, dy) => {
            setViewBoxState((current) => {
              const box = current ?? base
              return { ...box, x: box.x + dx, y: box.y + dy }
            })
            event.preventDefault()
          }
          if (event.key === 'ArrowLeft') return nudge(step, 0)
          if (event.key === 'ArrowRight') return nudge(-step, 0)
          if (event.key === 'ArrowUp') return nudge(0, step)
          if (event.key === 'ArrowDown') return nudge(0, -step)
          if (event.key === '+' || event.key === '=') {
            zoomBy(1 / 1.25)
            event.preventDefault()
          } else if (event.key === '-' || event.key === '_') {
            zoomBy(1.25)
            event.preventDefault()
          } else if (event.key === '0') {
            setViewBoxState(null)
            event.preventDefault()
          }
        }

        const graphSub = [
          `${nodes.length} ${t('graphNodeCount')}`,
          `${edges.length} ${t('graphEdgeCount')}`,
          graphLevel === 'file' && graphModule ? graphModule : '',
          graphData && graphData.truncated ? `${t('graphTruncatedLabel')} ${nodes.length}` : '',
        ].filter(Boolean).join(' · ')

        // One vertical guide per dependency layer turns the empty canvas into
        // a readable architecture map and gives the eye a column rhythm.
        const columns = new Map()
        for (const position of layout.positions.values()) {
          if (!columns.has(position.col)) columns.set(position.col, position.x)
        }
        const columnList = [...columns.entries()].sort((a, b) => a[0] - b[0])

        const zoomButton = (icon, title, factor) =>
          h(
            Button,
            { icon: true, title, onClick: () => zoomBy(factor) },
            h(Glyph, { name: icon, size: 14 }),
          )

        return h(
          'div',
          { className: 'repowiki-fade repowiki-graph' },
          h(
            'div',
            { className: 'repowiki-graph-toolbar' },
            h(
              'div',
              { className: 'repowiki-graph-heading' },
              h('div', { className: 'repowiki-eyebrow' }, t('graphEyebrow')),
              h('h2', null, t('graphTitle')),
              h('div', { className: 'repowiki-graph-sub' }, graphSub),
            ),
            h(
              'div',
              { className: 'repowiki-graph-tools' },
              graphLevel === 'file'
                ? h(
                    Button,
                    { onClick: () => void fetchGraph('module'), title: t('backToModules') },
                    `← ${t('backToModules')}`,
                  )
                : h(
                    'div',
                    { className: 'repowiki-segment', role: 'group', 'aria-label': t('graphModuleLevel') },
                    h('button', { type: 'button', className: 'is-active', onClick: () => void fetchGraph('module') }, t('graphModuleLevel')),
                    h('button', { type: 'button', disabled: true, title: t('graphDrill') }, t('graphFileLevel')),
                  ),
              h(
                'div',
                { className: 'repowiki-graph-search' },
                h(Glyph, { name: 'search', size: 12 }),
                h('input', {
                  type: 'search',
                  value: graphQuery,
                  placeholder: t('graphLocate'),
                  'aria-label': t('graphLocate'),
                  onChange: (event) => setGraphQuery(event.target.value),
                }),
              ),
              zoomButton('minus', t('graphZoomOut'), 1.25),
              zoomButton('plus', t('graphZoomIn'), 1 / 1.25),
              graphStale
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'repowiki-badge-stale',
                      title: t('graphStaleHint'),
                      onClick: () => void fetchGraph(graphLevel, graphModule),
                    },
                    '⟳',
                    t('graphStale'),
                  )
                : null,
              h(
                Button,
                { icon: true, title: t('refresh'), onClick: () => void fetchGraph(graphLevel, graphModule) },
                h(Glyph, { name: 'refresh', size: 14 }),
              ),
              h(
                Button,
                { icon: true, title: t('graphFit'), onClick: () => setViewBoxState(null) },
                h(Glyph, { name: 'fit', size: 14 }),
              ),
            ),
          ),
          graphLoading && !graphData
            ? h(
                'div',
                { className: 'repowiki-graph-empty' },
                h('div', { className: 'repowiki-spinner' }),
                t('graphLoadingLabel'),
              )
            : nodes.length === 0
              ? h(
                  'div',
                  { className: 'repowiki-graph-empty' },
                  h('div', { className: 'repowiki-empty-mark' }, h(RepoWikiPanelIcon, { size: 26 })),
                  h('div', { style: { color: 'var(--rw-fg-2)', fontSize: '13px' } }, t('graphEmptyLabel')),
                  h(
                    Button,
                    { onClick: () => void generate('full'), disabled: busy, primary: true },
                    busy ? t('generating') : t('generate'),
                  ),
                )
              : h(
                  'div',
                  { className: `repowiki-graph-canvas${graphDragging ? ' is-dragging' : ''}` },
                  h(
                    'div',
                    { className: 'repowiki-graph-hint' },
                    h(Glyph, { name: 'graph', size: 11 }),
                    `${t('graphDragHint')} · ${t('graphWheelHint')}`,
                  ),
                  h('div', { className: 'repowiki-graph-watermark' }, 'KNOWLEDGE GRAPH'),
                  h(
                    'svg',
                    {
                      ref: svgRef,
                      viewBox,
                      preserveAspectRatio: 'xMidYMid meet',
                      role: 'group',
                      'aria-label': `${t('graphTitle')}，${t('graphDragHint')}，${t('graphWheelHint')}`,
                      tabIndex: 0,
                      onPointerDown: beginPan,
                      onPointerMove: movePan,
                      onPointerUp: endPan,
                      onPointerCancel: endPan,
                      onLostPointerCapture: endPan,
                      onDoubleClick: () => setViewBoxState(null),
                      onKeyDown: onGraphKeyDown,
                      onClick: () => {
                        if (takeClickSuppression()) return
                        setGraphSelected(null)
                      },
                    },
                    h(
                      'defs',
                      null,
                      h(
                        'marker',
                        { id: 'repowiki-arrow', markerWidth: 7, markerHeight: 7, refX: 6, refY: 3, orient: 'auto' },
                        h('path', { d: 'M0,0 L0,6 L7,3 z', fill: token('--dsw-alias-label-tertiary', '#7d7d7d') }),
                      ),
                      h(
                        'marker',
                        { id: 'repowiki-arrow-accent', markerWidth: 7, markerHeight: 7, refX: 6, refY: 3, orient: 'auto' },
                        h('path', { d: 'M0,0 L0,6 L7,3 z', fill: ACCENT() }),
                      ),
                    ),
                    columnList.map(([col, x]) =>
                      h(
                        'g',
                        { key: `layer-${col}` },
                        h('line', {
                          className: 'repowiki-graph-guide',
                          x1: x + GRAPH_NODE_W / 2,
                          y1: -26,
                          x2: x + GRAPH_NODE_W / 2,
                          y2: layout.height + 26,
                        }),
                        h(
                          'text',
                          { className: 'repowiki-graph-layer', x: x + GRAPH_NODE_W / 2, y: -11, textAnchor: 'middle' },
                          `L${col}`,
                        ),
                      ),
                    ),
                    edges.map((edge, index) => {
                      const a = layout.positions.get(edge.from)
                      const b = layout.positions.get(edge.to)
                      if (!a || !b) return null
                      if (culled && !visibleIds.has(edge.from) && !visibleIds.has(edge.to)) return null
                      const active = graphImpact && impactEdgeActive(edge)
                      const dim = (graphHover && graphHover !== edge.from && graphHover !== edge.to) || (graphSelected && graphImpact && !active)
                      const classes = ['repowiki-graph-edge']
                      if (active) classes.push('is-active')
                      if (dim) classes.push('is-dimmed')
                      return h('path', {
                        key: index,
                        className: classes.join(' '),
                        d: graphEdgePath(a, b, channels[index] ?? 0),
                        markerEnd: active ? 'url(#repowiki-arrow-accent)' : 'url(#repowiki-arrow)',
                      })
                    }),
                    nodes.map((node) => {
                      const p = layout.positions.get(node.id)
                      if (!p) return null
                      const selected = graphSelected === node.id
                      if (culled && !selected && !isVisible(node.id)) return null
                      const classes = ['repowiki-graph-node']
                      if (selected) classes.push('is-selected')
                      if (dimmed(node)) classes.push('is-dimmed')
                      const accent = node.type === 'boundary' ? 'var(--rw-fg-3)' : 'var(--rw-accent)'
                      return h(
                        'g',
                        {
                          key: node.id,
                          transform: `translate(${p.x},${p.y})`,
                          className: classes.join(' '),
                          'data-graph-node': node.id,
                          role: 'button',
                          tabIndex: 0,
                          'aria-label': `${node.label} · ${node.fileCount} ${t('filesUnit')} · ${node.loc} ${t('locUnit')}`,
                          'aria-pressed': selected ? 'true' : 'false',
                          onClick: (event) => {
                            event.stopPropagation()
                            if (takeClickSuppression()) return
                            void selectGraphNode(node)
                          },
                          onKeyDown: (event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return
                            event.preventDefault()
                            event.stopPropagation()
                            void selectGraphNode(node)
                          },
                          onMouseEnter: () => setGraphHover(node.id),
                          onMouseLeave: () => setGraphHover(null),
                          style: { cursor: 'pointer' },
                        },
                        h('rect', {
                          className: 'repowiki-node-box',
                          width: GRAPH_NODE_W,
                          height: GRAPH_NODE_H,
                          rx: 12,
                        }),
                        h('rect', {
                          x: 0,
                          y: 10,
                          width: 3,
                          height: GRAPH_NODE_H - 20,
                          rx: 1.5,
                          fill: accent,
                          opacity: 0.9,
                        }),
                        h(
                          'text',
                          { className: 'repowiki-node-title', x: 14, y: 25 },
                          String(node.label).slice(0, 22),
                        ),
                        h(
                          'text',
                          { className: 'repowiki-node-meta', x: 14, y: 44 },
                          `${node.fileCount} ${t('filesUnit')} · ${node.loc} ${t('locUnit')}`,
                        ),
                        node.type === 'boundary'
                          ? h(
                              'text',
                              { x: GRAPH_NODE_W - 10, y: 25, textAnchor: 'end', className: 'repowiki-node-meta', opacity: 0.8 },
                              'EDGE',
                            )
                          : null,
                      )
                    }),
                  ),
                  h(
                    'div',
                    { className: 'repowiki-graph-legend' },
                    h('span', null, h('i', { className: 'repowiki-legend-dot', style: { background: 'var(--rw-accent)' } }), t('graphLegendModule')),
                    h('span', null, h('i', { className: 'repowiki-legend-dot', style: { background: 'var(--rw-fg-3)' } }), t('graphLegendFile')),
                    h('span', null, h('i', { className: 'repowiki-legend-dot', style: { background: 'var(--rw-accent-soft)', boxShadow: 'inset 0 0 0 1px var(--rw-accent)' } }), t('graphLegendImpact')),
                  ),
                  !selectedNode ? h('div', { className: 'repowiki-graph-tip' }, t('selectNodeTip')) : null,
                  selectedNode
                    ? h(
                        'div',
                        { className: 'repowiki-graph-inspector' },
                        h(
                          'div',
                          { className: 'repowiki-graph-inspector-head' },
                          h('span', { className: 'repowiki-graph-inspector-title' }, selectedNode.label),
                          h(Chip, null, `${selectedNode.fileCount} ${t('filesUnit')}`),
                          h(Chip, null, `${selectedNode.loc} ${t('locUnit')}`),
                          graphImpact ? h(Chip, null, `${t('impactUpstream')} ${(graphImpact.upstream ?? []).length}`) : null,
                          graphImpact ? h(Chip, null, `${t('impactDownstream')} ${(graphImpact.downstream ?? []).length}`) : null,
                        ),
                        h('div', { className: 'repowiki-graph-inspector-path' }, selectedNode.dir || '(root)'),
                        selectedNode.doc
                          ? h(
                              'div',
                              { className: 'repowiki-graph-inspector-copy' },
                              h(InlineText, { text: selectedNode.doc, t, onOpenCard: (cardRef) => void openPage(cardRef) }),
                            )
                          : null,
                        h(
                          'div',
                          { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' } },
                          graphLevel === 'module' && selectedNode.type === 'module'
                            ? h(Button, { onClick: () => void fetchGraph('file', selectedNode.dir), title: t('graphDrill') }, t('graphDrill'))
                            : null,
                          relatedPage
                            ? h(Button, { onClick: () => void openPage(relatedPage.id), title: t('wikiLink') }, t('wikiLink'))
                            : null,
                          relatedCard
                            ? h(Button, { onClick: () => void openPage(`card:${relatedCard.id}`), title: t('cardLink') }, t('cardLink'))
                            : null,
                          selectedNode.type === 'file'
                            ? h(
                                Button,
                                {
                                  onClick: () => void openSource(selectedNode.id.slice(5)),
                                  title: t('openSource'),
                                },
                                t('openSource'),
                              )
                            : null,
                        ),
                      )
                    : null,
                ),
        )

      }

      /** The knowledge-card library: one row per card, filterable. */
      const cardsView = () => {
        const cards = (panel && panel.cards) || []
        const filter = cardFilter.trim().toLowerCase()
        const visible = filter
          ? cards.filter((card) => `${card.title ?? ''}${card.summary ?? ''}${card.tag ?? ''}`.toLowerCase().includes(filter))
          : cards
        return h(
          'div',
          {
            className: 'repowiki-fade repowiki-scroll repowiki-cards',
          },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' } },
            h(
              'div',
              null,
              h('div', { className: 'repowiki-eyebrow' }, t('cards')),
              h(
                'h2',
                { style: { margin: '5px 0 0', fontSize: '23px', fontWeight: 650, letterSpacing: '-.03em', color: 'var(--rw-fg)' } },
                t('cardsOverview'),
              ),
            ),
            h(Chip, null, `${cards.length} ${t('cards')}`),
            h(
              'div',
              { className: 'repowiki-graph-search', style: { marginLeft: 'auto' } },
              h(Glyph, { name: 'search', size: 12 }),
              h('input', {
                type: 'search',
                value: cardFilter,
                placeholder: t('cardSearch'),
                'aria-label': t('cardSearch'),
                onChange: (event) => setCardFilter(event.target.value),
                style: { width: '224px' },
              }),
            ),
          ),
          visible.length === 0
            ? h('div', { style: { padding: '20px 4px', fontSize: '12px', color: token('--dsw-alias-label-tertiary', '#7d7d7d') } }, t('noResults'))
            : h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
                visible.map((card) =>
                  h(
                    'button',
                    {
                      key: card.id,
                      type: 'button',
                      className: 'repowiki-row',
                      onClick: () => void openPage(`card:${card.id}`),
                      style: {
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 14px',
                        border: `1px solid ${token('--dsw-alias-border-l2', 'rgba(127,127,127,0.25)')}`,
                        borderRadius: token('--dsw-radius-md', '12px'),
                        background: token('--dsw-alias-fill-tsp-primary', 'rgba(127,127,127,0.05)'),
                        color: token('--dsw-alias-label-primary', '#e6e6e6'),
                        fontSize: '12px',
                        cursor: 'pointer',
                      },
                    },
                    h(
                      'div',
                      { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' } },
                      h('span', { 'aria-hidden': 'true', style: { fontSize: '10px', color: STATUS_TONE.fresh } }, '★'),
                      h(
                        'span',
                        { style: { fontWeight: 600, fontSize: '13px' } },
                        card.title || card.id,
                      ),
                      card.tag
                        ? h(
                            'span',
                            {
                              style: {
                                fontSize: '10px',
                                color: STATUS_TONE.fresh,
                                border: `1px solid ${STATUS_TONE.fresh}44`,
                                borderRadius: '999px',
                                padding: '0 8px',
                                lineHeight: '16px',
                              },
                            },
                            card.tag,
                          )
                        : null,
                    ),
                    card.summary
                      ? h(
                          'div',
                          {
                            style: {
                              fontSize: '11px',
                              color: token('--dsw-alias-label-tertiary', '#7d7d7d'),
                              lineHeight: 1.6,
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            },
                          },
                          card.summary,
                        )
                      : null,
                  ),
                ),
              ),
        )
      }

      /** The projects overview: one grid row per known workspace. */
      const projectsView = () => {
        const rows = (panel && panel.projects) || []
        return h(
          'div',
          {
            className: 'repowiki-fade repowiki-scroll repowiki-projects',
          },
          h(
            'div',
            { style: { marginBottom: '18px' } },
            h('div', { className: 'repowiki-eyebrow' }, t('projects')),
            h(
              'h2',
              { style: { margin: '5px 0 4px', fontSize: '23px', fontWeight: 650, letterSpacing: '-.03em', color: 'var(--rw-fg)' } },
              t('projectsTitle'),
            ),
            h('div', { style: { fontSize: '11.5px', color: 'var(--rw-fg-3)' } }, t('projectsHint')),
          ),
          h(
            'div',
            { style: { display: 'flex', flexWrap: 'wrap', gap: '10px' } },
            rows.map((row) =>
              h(
                'button',
                {
                  key: row.path,
                  type: 'button',
                  className: 'repowiki-row',
                  onClick: () => {
                    setRoot(row.path)
                    setPage(null)
                    setCurrentId('')
                    setHits(null)
                    setGraphData(null)
                    setMode('wiki')
                    void load()
                  },
                  style: {
                    display: 'block',
                    width: 'calc(33% - 7px)',
                    minWidth: '230px',
                    flex: '1 1 230px',
                    textAlign: 'left',
                    padding: '12px 14px',
                    border: `1px solid ${row.active ? `${ACCENT()}66` : token('--dsw-alias-border-l2', 'rgba(127,127,127,0.25)')}`,
                    borderRadius: token('--dsw-radius-md', '12px'),
                    background: row.active ? `${ACCENT()}12` : token('--dsw-alias-fill-tsp-primary', 'rgba(127,127,127,0.05)'),
                    color: token('--dsw-alias-label-primary', '#e6e6e6'),
                    fontSize: '12px',
                    cursor: 'pointer',
                  },
                },
                h(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' } },
                  h(RepoWikiPanelIcon, { size: 14 }),
                  h(
                    'span',
                    { style: { fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                    row.title || row.path,
                  ),
                ),
                h(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
                  row.exists
                    ? h(
                        'span',
                        {
                          style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '10px',
                            color: STATUS_TONE.fresh,
                            border: `1px solid ${STATUS_TONE.fresh}44`,
                            borderRadius: '999px',
                            padding: '0 8px',
                            lineHeight: '18px',
                          },
                        },
                        `✓ ${t('generatedOk')}`,
                      )
                    : h(
                        'span',
                        {
                          style: {
                            fontSize: '10px',
                            color: token('--dsw-alias-label-tertiary', '#7d7d7d'),
                            border: `1px solid ${token('--dsw-alias-border-l2', 'rgba(127,127,127,0.3)')}`,
                            borderRadius: '999px',
                            padding: '0 8px',
                            lineHeight: '18px',
                          },
                        },
                        t('generatedMissing'),
                      ),
                  h(
                    'span',
                    { style: { fontSize: '10px', color: token('--dsw-alias-label-tertiary', '#7d7d7d') } },
                    row.exists
                      ? `${t('pages')} ${row.pages} · ${t('cards')} ${row.cards}${row.generatedAt ? ` · ${String(row.generatedAt).slice(0, 10)}` : ''}`
                      : '—',
                  ),
                ),
              ),
            ),
          ),
        )
      }

      let content
      if (gen && gen.status === 'running') {
        content = progressView()
      } else if (mode === 'graph') {
        content = graphView()
      } else if (mode === 'projects') {
        content = projectsView()
      } else if (mode === 'cards' && panel && (panel.cards ?? []).length > 0) {
        content = cardsView()
      } else if (status === 'error') {
        content = errorView()
      } else if (status === 'loading' || opening) {
        content = loadingView
      } else if (page) {
        content = pageView()
      } else if (status === 'idle') {
        content = h(
          'div',
          { style: { padding: '20px', fontSize: '12px', color: token('--dsw-alias-label-tertiary', '#7d7d7d') } },
          t('idle'),
        )
      } else if (status === 'empty') {
        content = emptyView
      } else {
        content = overviewView()
      }

      /** The citation source drawer: path, numbered lines, copy + close. */
      const sourceDrawer = sourcePeek
        ? h(
            'aside',
            {
              className: 'repowiki-source',
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': t('sourceTitle'),
            },
            h(
              'div',
              { className: 'repowiki-source-head' },
              h(
                'div',
                { style: { flex: '1 1 auto', minWidth: 0 } },
                h('div', { style: { fontSize: '11px', fontWeight: 600, color: 'var(--rw-fg-3)', marginBottom: '2px' } }, t('sourceTitle')),
                h('div', { className: 'repowiki-source-path', title: sourcePeek.path }, `${sourcePeek.path}:${sourcePeek.line ?? ''}`),
              ),
              h(CopyButton, { text: sourcePeek.token || `${sourcePeek.path}:${sourcePeek.line}`, t }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'repowiki-help-close',
                  title: t('sourceClose'),
                  'aria-label': t('sourceClose'),
                  onClick: closeSource,
                },
                '✕',
              ),
            ),
            h(
              'div',
              { className: 'repowiki-source-body' },
              sourcePeekError
                ? h(
                    'div',
                    { style: { padding: '18px', fontSize: '12px', color: STATUS_TONE['needs-review'] } },
                    `${t('sourceError')}：${sourcePeekError.message}`,
                  )
                : sourcePeek.loading
                  ? h('div', { style: { display: 'flex', justifyContent: 'center', padding: '28px' } }, h('span', { className: 'repowiki-spinner' }))
                  : (sourcePeek.lines ?? []).map((line) =>
                      h(
                        'div',
                        {
                          key: line.number,
                          className: `repowiki-source-line${line.highlighted ? ' is-hit' : ''}`,
                        },
                        h('span', { className: 'ln' }, String(line.number)),
                        h('span', { className: 'tx' }, line.content === '' ? ' ' : line.content),
                      ),
                    ),
            ),
          )
        : null

      /** The import confirmation dialog (backup is always on). */
      const importDialog = pendingImport
        ? h(
            'div',
            { className: 'repowiki-modal-mask', onClick: () => setPendingImport(null) },
            h(
              'div',
              {
                className: 'repowiki-modal',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': t('importTitle'),
                onClick: (event) => event.stopPropagation(),
              },
              h('h3', null, t('importTitle')),
              h('p', null, t('importHint')),
              h(
                'div',
                { className: 'repowiki-modal-actions' },
                h(Button, { onClick: () => setPendingImport(null) }, t('cancel')),
                h(
                  Button,
                  { primary: true, disabled: busy, onClick: () => void runImport(pendingImport) },
                  busy ? t('generating') : t('importConfirm'),
                ),
              ),
            ),
          )
        : null

      return h(
        'div',
        {
          className: 'repowiki-shell',
          style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            position: 'relative',
          },
        },
        header,
        h(
          'div',
          { style: { display: 'flex', flex: '1 1 auto', minHeight: 0, minWidth: 0, position: 'relative' } },
          sidebarOpen
            ? h('div', {
                className: 'repowiki-drawer-mask',
                'aria-hidden': 'true',
                onClick: () => setSidebarOpen(false),
              })
            : null,
          sidebar,
          h(
            'main',
            { className: 'repowiki-main' },
            languageMissing
              ? h(
                  'div',
                  { className: 'repowiki-banner', role: 'status' },
                  h('span', null, `${t('langMissing')}（${t('langMissingHint')} ${availableLanguages.join('、')}）`),
                  h(
                    Button,
                    {
                      onClick: () => void generate('full', effectiveLanguage),
                      disabled: busy,
                      primary: true,
                    },
                    busy ? t('generating') : t('generateLang'),
                  ),
                )
              : null,
            content,
            sourceDrawer,
          ),
        ),
        importDialog,
        toast
          ? h(
              'div',
              {
                role: 'status',
                className: 'repowiki-fade repowiki-toast',
                style: { borderColor: 'var(--rw-line)', background: hostSurface() },
              },
              toast,
            )
          : null,
        h(
          'button',
          {
            type: 'button',
            className: 'repowiki-btn is-icon',
            title: t('helpTip'),
            'aria-label': t('helpTip'),
            onClick: () => setHelpOpen((open) => !open),
            style: {
              position: 'absolute',
              right: '14px',
              bottom: '14px',
              borderRadius: '50%',
              background: hostSurface(),
              zIndex: 5,
            },
          },
          '?',
        ),
        helpOpen
          ? h(
              'div',
              {
                className: 'repowiki-fade repowiki-help',
                style: { background: hostSurface() },
              },
              h(
                'div',
                { className: 'repowiki-help-head' },
                h('span', null, t('helpTip')),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'repowiki-help-close',
                    onClick: () => setHelpOpen(false),
                  },
                  '✕',
                ),
              ),
              h('div', { className: 'repowiki-help-row' }, h('strong', null, `${t('helpGenerator')}：`), t('helpGeneratorBody')),
              h('div', { className: 'repowiki-help-row' }, h('strong', null, `${t('helpCitations')}：`), t('helpCitationsBody')),
              h('div', null, h('strong', null, `${t('helpEntries')}：`), t('helpEntriesBody')),
              panel && panel.generator
                ? h('div', { style: { marginTop: '8px', fontSize: '10px', color: 'var(--rw-fg-3)' } }, `dsh-plugin-repowiki v${panel.generator.version ?? '?'}`)
                : null,
            )
          : null,
      )
    }

    /**
     * Contribute the Repo Wiki entry to the left sidebar and the panel it opens.
     *
     * @param {object} ctx the browser plugin context
     */
