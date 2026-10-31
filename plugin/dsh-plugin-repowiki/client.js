/**
 * GENERATED FILE — edit `client/*.js` and run `node scripts/build-client.mjs`.
 * Bundle: 10 parts, version 0.11.0.
 */
/* ---- 00-preamble.js ----
 * Module loader, factory header and shared constants.
 * This file is concatenated into ../../client.js by scripts/build-client.mjs.
 */
/**
 * Browser half of the Repo Wiki plugin.
 *
 * The Host owns the wiki (scan, index, generate, verify). This file only gives
 * the wiki a door in the Web shell: one icon in the left sidebar and one page
 * in the central panel. It talks to the Host over the shared `/api` channel
 * that `src/routes.js` registers.
 *
 * Rules this file follows:
 * - The browser module id equals the package name (`dsh-plugin-repowiki`).
 * - React comes from the browser module table; no Harness client package is
 *   imported as a module, so every glyph and control below is drawn locally.
 * - Visible text goes through the Client locale service.
 * - Theme colours are read from the `--dsw-alias-*` tokens with a fallback.
 * - The panel is a classic script: no top-level `import` / `export` statement.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-repowiki',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const useState = React.useState
    const useEffect = React.useEffect
    const useCallback = React.useCallback
    const useMemo = React.useMemo
    const useRef = React.useRef

    /** Dictionary namespace owned by this plugin. */
    const NS = 'repoWiki'
    /** The id shared by the sidebar entry and the central panel it opens. */
    const PANEL_ID = 'repowiki'
    /** Client services this module needs. */
    const inject = ['slots', 'locale']
    /** Delay between the last keystroke and the search request. */
    const SEARCH_DEBOUNCE_MS = 200
    /** Keywords offered when a search returns nothing. */
    const SEARCH_SUGGESTIONS = ['architecture', 'module', 'flow', 'config', 'overview', 'build']
    /** The client bundle version; compared with the host generator version. */
    const CLIENT_VERSION = '0.11.0'
    /** How long a graph payload may be reused before a silent refresh. */
    const GRAPH_TTL_MS = 30_000
    /** How often the open graph checks the source signature. */
    const GRAPH_CHECK_MS = 20_000
    /** sessionStorage prefix of the panel payload cache. */
    const PANEL_CACHE_PREFIX = 'repowiki:panel:'
    /** localStorage key of the recently opened pages. */
    const RECENT_KEY = 'repowiki:recent'
    /** Node count above which off-screen nodes are culled from the SVG. */
    const GRAPH_CULL_THRESHOLD = 120
    /** The locale key of every panel state (the dictionaries use flat keys). */
    const STATE_KEYS = {
      idle: 'stateIdle',
      loading: 'stateLoading',
      ready: 'stateReady',
      empty: 'stateEmpty',
      error: 'stateError',
    }

/* ---- 10-locale.js ----
 * Chinese/English dictionaries and the translator.
 * This file is concatenated into ../../client.js by scripts/build-client.mjs.
 */
    const zh = {
      panel: '仓库 Wiki',
      loading: '正在加载仓库 Wiki…',
      idle: '准备中…',
      empty: '还没有生成 Wiki。点击「生成」为当前仓库建立知识层。',
      failed: '加载失败',
      errorTitle: '出错了',
      retry: '重试',
      refresh: '刷新',
      generate: '生成',
      update: '增量更新',
      generating: '生成中…',
      search: '搜索页面',
      searchPlaceholder: '输入关键词，例如 architecture',
      searching: '搜索中…',
      pages: '页面',
      cards: '知识卡片',
      noResults: '没有匹配的页面',
      noResultsHint: '试试这些关键词：',
      sections: '分区',
      sectionOverview: '概览',
      sectionArchitecture: '架构',
      sectionFlows: '流程',
      sectionOperations: '运维',
      sectionNotes: '备注',
      generated: '生成于',
      citations: '引用',
      status: '状态',
      confidence: '置信度',
      source: '来源',
      emptyRepo: '未找到仓库',
      runtime: '运行环境',
      back: '返回列表',
      language: '语言',
      repository: '仓库',
      overview: '总览',
      allPages: '全部页面',
      statPages: '页面',
      statCitations: '引用',
      statFiles: '被引文件',
      statFresh: '新鲜',
      lastRun: '上次生成',
      runDone: '完成',
      runFailed: '失败',
      runRunning: '进行中',
      toc: '本页目录',
      copyCitation: '引用（点击复制）',
      copied: '已复制',
      stale: '过期',
      needsReview: '待复核',
      draft: '草稿',
      progressTitle: '生成文档中',
      progressDoneLabel: '已完成',
      progressInFlight: '进行中',
      cancel: '取消',
      exporting: '导出中…',
      exportTip: '导出 Wiki（写入 .qoder/repowiki）',
      exported: '已导出',
      exportedFiles: '个文件到 .qoder/repowiki',
      exportFailed: '导出失败',
      helpTip: '关于仓库 Wiki',
      helpGenerator: '生成方式',
      helpGeneratorBody: '确定性流水线：不调用模型，逐页核对 path:line 引用后写盘。',
      helpCitations: '引用约定',
      helpCitationsBody: '正文里的路径:行号 chip 可点击复制，回到源码核对原文。',
      helpEntries: '其它入口',
      helpEntriesBody: '模型工具 wiki_search / wiki_read / wiki_generate / wiki_status；斜杠命令 /wiki。',
      newBadge: '本次生成',
      pagesCount: '页',
      wikiFiles: '页面文件',
      graph: '图谱',
      graphTitle: '工程知识图谱',
      graphEyebrow: 'ARCHITECTURE MAP',
      graphModuleLevel: '模块级',
      graphFileLevel: '文件级',
      graphDragHint: '按住左键拖动',
      graphWheelHint: '滚轮缩放',
      graphFit: '适配画布',
      graphZoomIn: '放大',
      graphZoomOut: '缩小',
      graphReset: '重置视图',
      graphLegendModule: '模块',
      graphLegendFile: '文件',
      graphLegendImpact: '影响范围',
      graphNodeCount: '节点',
      graphEdgeCount: '关系',
      graphStale: '数据可能已过期',
      graphStaleHint: '源码已变化，点击刷新重建图谱',
      graphFreshAt: '更新于',
      openSource: '打开源码',
      sourceTitle: '源码片段',
      sourceCopy: '复制引用',
      sourceError: '无法读取源码',
      sourceClose: '关闭',
      importMenu: '更多',
      importQoder: '从 .qoder/repowiki 导入',
      importDsh: '导入 DSH 导出包',
      importTitle: '确认导入',
      importHint: '导入会覆盖当前 Wiki 页面；系统会先自动备份到带时间戳的目录。',
      importConfirm: '导入并备份',
      importDone: '导入完成',
      importFailed: '导入失败',
      langMissing: '该语言的 Wiki 尚未生成',
      langMissingHint: '当前只有',
      generateLang: '生成该语言版本',
      restartHint: '界面版本与宿主不一致，请重载面板',
      filterAll: '全部',
      filterFresh: '新鲜',
      filterStale: '过期',
      regenerateAll: '重新生成全部',
      recent: '最近访问',
      codeCopy: '复制代码',
      codeCopied: '已复制',
      close: '关闭',
      wikiLink: '打开相关 Wiki',
      cardLink: '查看知识卡',
      sidebarOpen: '显示目录',
      sidebarClose: '隐藏目录',
      densityComfort: '舒适',
      densityCompact: '紧凑',
      impactUpstream: '上游',
      impactDownstream: '下游',
      graphLocate: '定位模块',
      graphEmptyLabel: '没有可展示的图谱数据（先生成 Wiki）',
      graphTruncatedLabel: '模块过多，仅展示最大的',
      graphDrill: '查看文件级图谱',
      backToModules: '返回模块级',
      filesUnit: '文件',
      locUnit: '行',
      graphLoadingLabel: '正在构建图谱…',
      graphZoom: '缩放',
      selectNodeTip: '点击节点查看详情与影响范围',
      tabsWiki: 'Wiki',
      tabsCards: '卡片',
      tabsProjects: '项目',
      emptyTitle: '还没有生成 Wiki',
      overviewEyebrow: 'REPOSITORY KNOWLEDGE',
      searchClear: '清空搜索',
      cardsOverview: '知识卡片概览',
      cardSearch: '搜索知识卡片',
      cardOpen: '打开卡片',
      parentKnowledge: '父级知识',
      includedKnowledge: '包含知识',
      lastUpdated: '最近更新',
      projects: '项目',
      projectsTitle: '项目 Wiki 概览',
      projectsHint: '点击任意工作区查看它的仓库 Wiki',
      generatedOk: '已生成',
      generatedMissing: '未生成',
      generatedRunning: '生成中',
      stateIdle: '空闲',
      stateLoading: '加载中',
      stateReady: '就绪',
      stateEmpty: '空',
      stateError: '错误',
    }

    const en = {
      panel: 'Repo Wiki',
      loading: 'Loading the repo wiki…',
      idle: 'Preparing…',
      empty: 'No wiki yet. Click Generate to build the knowledge layer for this repository.',
      failed: 'Failed to load',
      errorTitle: 'Something went wrong',
      retry: 'Retry',
      refresh: 'Refresh',
      generate: 'Generate',
      update: 'Update',
      generating: 'Working…',
      search: 'Search pages',
      searchPlaceholder: 'A keyword, for example architecture',
      searching: 'Searching…',
      pages: 'Pages',
      cards: 'Knowledge cards',
      noResults: 'No matching page',
      noResultsHint: 'Try these keywords:',
      sections: 'Sections',
      sectionOverview: 'Overview',
      sectionArchitecture: 'Architecture',
      sectionFlows: 'Flows',
      sectionOperations: 'Operations',
      sectionNotes: 'Notes',
      generated: 'Generated',
      citations: 'Citations',
      status: 'Status',
      confidence: 'Confidence',
      source: 'Source',
      emptyRepo: 'Repository not found',
      runtime: 'Runtime',
      back: 'Back to list',
      language: 'Language',
      repository: 'Repository',
      overview: 'Overview',
      allPages: 'All pages',
      statPages: 'Pages',
      statCitations: 'Citations',
      statFiles: 'Files cited',
      statFresh: 'Fresh',
      lastRun: 'Last run',
      runDone: 'done',
      runFailed: 'failed',
      runRunning: 'running',
      toc: 'On this page',
      copyCitation: 'citation (click to copy)',
      copied: 'Copied',
      stale: 'stale',
      needsReview: 'review',
      draft: 'draft',
      progressTitle: 'Generating pages',
      progressDoneLabel: 'done',
      progressInFlight: 'in flight',
      cancel: 'Cancel',
      exporting: 'Exporting…',
      exportTip: 'Export the wiki (writes .qoder/repowiki)',
      exported: 'Exported',
      exportedFiles: 'files to .qoder/repowiki',
      exportFailed: 'Export failed',
      helpTip: 'About Repo Wiki',
      helpGenerator: 'Generation',
      helpGeneratorBody: 'Deterministic pipeline: no model calls, every path:line citation verified before writing.',
      helpCitations: 'Citations',
      helpCitationsBody: 'Click a path:line chip in the text to copy it and check the original source.',
      helpEntries: 'Other entries',
      helpEntriesBody: 'Model tools wiki_search / wiki_read / wiki_generate / wiki_status; slash command /wiki.',
      newBadge: 'this run',
      pagesCount: 'pages',
      wikiFiles: 'Wiki files',
      graph: 'Graph',
      graphTitle: 'Engineering knowledge graph',
      graphEyebrow: 'ARCHITECTURE MAP',
      graphModuleLevel: 'Modules',
      graphFileLevel: 'Files',
      graphDragHint: 'Drag to pan',
      graphWheelHint: 'Scroll to zoom',
      graphFit: 'Fit to canvas',
      graphZoomIn: 'Zoom in',
      graphZoomOut: 'Zoom out',
      graphReset: 'Reset view',
      graphLegendModule: 'Module',
      graphLegendFile: 'File',
      graphLegendImpact: 'Impact',
      graphNodeCount: 'nodes',
      graphEdgeCount: 'links',
      graphStale: 'Data may be outdated',
      graphStaleHint: 'The source changed; refresh to rebuild the graph',
      graphFreshAt: 'Updated',
      openSource: 'Open source',
      sourceTitle: 'Source peek',
      sourceCopy: 'Copy citation',
      sourceError: 'Could not read the source',
      sourceClose: 'Close',
      importMenu: 'More',
      importQoder: 'Import from .qoder/repowiki',
      importDsh: 'Import a DSH bundle',
      importTitle: 'Confirm import',
      importHint: 'Importing overwrites the current wiki; a timestamped backup is written first.',
      importConfirm: 'Import with backup',
      importDone: 'Import finished',
      importFailed: 'Import failed',
      langMissing: 'This language has no wiki yet',
      langMissingHint: 'Available:',
      generateLang: 'Generate this language',
      restartHint: 'The panel bundle is older than the host; reload the panel',
      filterAll: 'All',
      filterFresh: 'Fresh',
      filterStale: 'Stale',
      regenerateAll: 'Regenerate everything',
      recent: 'Recent',
      codeCopy: 'Copy code',
      codeCopied: 'Copied',
      close: 'Close',
      wikiLink: 'Open the related wiki page',
      cardLink: 'Open the knowledge card',
      sidebarOpen: 'Show the page tree',
      sidebarClose: 'Hide the page tree',
      densityComfort: 'Comfortable',
      densityCompact: 'Compact',
      impactUpstream: 'upstream',
      impactDownstream: 'downstream',
      graphLocate: 'Find a module',
      graphEmptyLabel: 'No graph data yet (generate the wiki first)',
      graphTruncatedLabel: 'Too many modules, showing the largest',
      graphDrill: 'Open file-level graph',
      backToModules: 'Back to modules',
      filesUnit: 'files',
      locUnit: 'loc',
      graphLoadingLabel: 'Building the graph…',
      graphZoom: 'Zoom',
      selectNodeTip: 'Click a node for details and impact',
      tabsWiki: 'Wiki',
      tabsCards: 'Cards',
      tabsProjects: 'Projects',
      emptyTitle: 'No wiki yet',
      overviewEyebrow: 'REPOSITORY KNOWLEDGE',
      searchClear: 'Clear search',
      cardsOverview: 'Knowledge cards',
      cardSearch: 'Search knowledge cards',
      cardOpen: 'Open card',
      parentKnowledge: 'Parent knowledge',
      includedKnowledge: 'Included knowledge',
      lastUpdated: 'Last updated',
      projects: 'Projects',
      projectsTitle: 'Project Wiki overview',
      projectsHint: 'Click any workspace to open its repository wiki',
      generatedOk: 'Generated',
      generatedMissing: 'Not generated',
      generatedRunning: 'Generating',
      stateIdle: 'Idle',
      stateLoading: 'Loading',
      stateReady: 'Ready',
      stateEmpty: 'Empty',
      stateError: 'Error',
    }

    /** Read a theme token, falling back to a neutral value. */

/* ---- 20-helpers.js ----
 * Theme tokens, citation parsing, panel cache and recent pages.
 * This file is concatenated into ../../client.js by scripts/build-client.mjs.
 */
    function token(name, fallback) {
      try {
        const value = getComputedStyle(document.documentElement).getPropertyValue(name)
        if (value && value.trim()) return value.trim()
      } catch {
        // The document may not be ready yet; the fallback keeps the panel usable.
      }
      return fallback
    }

    /**
     * The first opaque background colour above the panel. Host tokens are
     * mostly translucent, so popovers need a real surface to sit on. Walking
     * up from <body> follows the active light/dark theme without hard-coding
     * either one.
     *
     * @param {string} fallback
     * @returns {string}
     */
    function hostSurface(fallback = 'rgba(30,30,30,0.98)') {
      try {
        let node = document.body
        while (node) {
          const colour = getComputedStyle(node).backgroundColor
          if (colour && colour !== 'transparent' && colour !== 'rgba(0, 0, 0, 0)') return colour
          node = node.parentElement
        }
      } catch {
        // No document: the fallback keeps the surface readable.
      }
      return fallback
    }

    /** The accent colour of the panel; the host token wins, the fallback is neutral blue. */
    const ACCENT = () => token('--dsw-alias-accent', '#4f8cc9')

    /** The display name of a repository root: the last path segment. */
    function rootDisplayNameOf(value) {
      const normalized = String(value ?? '').replace(/[\\/]+$/, '')
      return normalized.split(/[\\/]/).pop() || normalized
    }

    /** Parse `path:12` / `path:12-18` into a path and a line. */
    function parseCitation(value) {
      const text = String(value ?? '').trim()
      const match = /^(.*):(\d+)(?:-(\d+))?$/.exec(text)
      if (!match) return null
      const line = Number(match[2]) || 1
      const end = Number(match[3] ?? match[2]) || line
      return { path: match[1], line, endLine: Math.max(line, end) }
    }

    /** Read the recently opened pages (localStorage; never throws). */
    function readRecentPages() {
      try {
        const raw = localStorage.getItem(RECENT_KEY)
        const list = raw ? JSON.parse(raw) : []
        return Array.isArray(list) ? list.filter((entry) => entry && entry.id).slice(0, 6) : []
      } catch {
        return []
      }
    }

    /** Remember one page at the head of the recent list. */
    function rememberPage(entry) {
      if (!entry?.id) return []
      try {
        const next = [entry, ...readRecentPages().filter((item) => item.id !== entry.id)].slice(0, 6)
        localStorage.setItem(RECENT_KEY, JSON.stringify(next))
        return next
      } catch {
        return readRecentPages()
      }
    }

    /** A stable sessionStorage key for one panel payload. */
    function panelCacheKey(root, language) {
      return `${PANEL_CACHE_PREFIX}${root || 'auto'}:${language || 'zh'}`
    }

    /** Read a cached panel payload; stale entries are still usable. */
    function readPanelCache(key) {
      try {
        const raw = sessionStorage.getItem(key)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        return parsed && parsed.data ? parsed : null
      } catch {
        return null
      }
    }

    /** Write a panel payload into the current tab's cache. */
    function writePanelCache(key, data) {
      try {
        sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }))
      } catch {
        // A full/denied storage must not break the panel.
      }
    }

    /** Drop every cached panel payload (after a write that changed the wiki). */
    function clearPanelCache() {
      try {
        for (let index = sessionStorage.length - 1; index >= 0; index--) {
          const key = sessionStorage.key(index)
          if (key && key.startsWith(PANEL_CACHE_PREFIX)) sessionStorage.removeItem(key)
        }
      } catch {
        // Ignore a storage that refuses enumeration.
      }
    }

    /** Split text into matched/unmatched runs so a search term can be marked. */
    function highlightParts(text, query) {
      const source = String(text ?? '')
      const needle = String(query ?? '').trim()
      if (!needle) return [{ text: source, match: false }]
      const parts = []
      const lower = source.toLowerCase()
      const target = needle.toLowerCase()
      let from = 0
      while (from <= source.length) {
        const at = lower.indexOf(target, from)
        if (at < 0) break
        if (at > from) parts.push({ text: source.slice(from, at), match: false })
        parts.push({ text: source.slice(at, at + needle.length), match: true })
        from = at + needle.length
      }
      if (from < source.length) parts.push({ text: source.slice(from), match: false })
      return parts.length > 0 ? parts : [{ text: source, match: false }]
    }

    /**
     * A friendly section heading. The host payload carries ids such as
     * `10-architecture`; showing the raw id is technically correct but reads
     * like a filename, so known buckets get a product label.
     *
     * @param {{id?: string, label?: string}} section
     * @param {(key: string) => string} t
     * @returns {string}
     */
    function sectionDisplayLabel(section, t) {
      const id = String(section?.id ?? '').toLowerCase()
      const label = String(section?.label ?? '')
      const haystack = `${id} ${label.toLowerCase()}`
      if (haystack.includes('overview')) return t('sectionOverview')
      if (haystack.includes('architect')) return t('sectionArchitecture')
      if (haystack.includes('flow')) return t('sectionFlows')
      if (haystack.includes('operation') || haystack.includes('ops')) return t('sectionOperations')
      if (haystack.includes('note')) return t('sectionNotes')
      return label || section?.id || t('overview')
    }

/* ---- 30-styles.js ----
 * The stylesheet injected once into the panel.
 * This file is concatenated into ../../client.js by scripts/build-client.mjs.
 */
    /** One-off keyframes (shimmer, fade) the inline styles cannot express. */
    function injectPanelStyles() {
      try {
        if (document.getElementById('repowiki-panel-styles')) return
        const style = document.createElement('style')
        style.id = 'repowiki-panel-styles'
        style.textContent = `
@keyframes repowiki-shimmer { 0% { background-position: -220px 0; } 100% { background-position: 220px 0; } }
@keyframes repowiki-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes repowiki-pulse { 0%, 100% { opacity: .45; } 50% { opacity: 1; } }

.repowiki-shell {
  --rw-fg: var(--dsw-alias-label-primary, #e9eaee);
  --rw-fg-2: var(--dsw-alias-label-secondary, #b7bcc5);
  --rw-fg-3: var(--dsw-alias-label-tertiary, #8a909a);
  --rw-line: var(--dsw-alias-border-l2, rgba(127,127,127,.24));
  --rw-surface: var(--dsw-alias-fill-tsp-primary, rgba(127,127,127,.06));
  --rw-surface-2: var(--dsw-alias-fill-tsp-secondary, rgba(127,127,127,.12));
  --rw-accent: var(--dsw-alias-accent, #6ea8fe);
  --rw-accent-soft: color-mix(in srgb, var(--rw-accent) 13%, transparent);
  --rw-accent-line: color-mix(in srgb, var(--rw-accent) 42%, transparent);
  --rw-shadow: 0 18px 48px rgba(0,0,0,.14), 0 2px 8px rgba(0,0,0,.06);
  color: var(--rw-fg);
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  letter-spacing: .01em;
  background:
    radial-gradient(900px 420px at 100% -10%, color-mix(in srgb, var(--rw-accent) 8%, transparent), transparent 70%),
    radial-gradient(700px 380px at -10% 110%, color-mix(in srgb, var(--rw-accent) 5%, transparent), transparent 70%);
}
.repowiki-shell *, .repowiki-shell *::before, .repowiki-shell *::after { box-sizing: border-box; }
.repowiki-shell button, .repowiki-shell input { font: inherit; }
.repowiki-shell button { -webkit-tap-highlight-color: transparent; }
.repowiki-shell button:focus-visible, .repowiki-shell input:focus-visible, .repowiki-shell [tabindex]:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--rw-accent) 72%, transparent);
  outline-offset: 2px;
}
.repowiki-shell ::selection { background: color-mix(in srgb, var(--rw-accent) 28%, transparent); }
.repowiki-shell ::-webkit-scrollbar { width: 9px; height: 9px; }
.repowiki-shell ::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--rw-fg-3) 28%, transparent); border: 3px solid transparent; border-radius: 999px; background-clip: padding-box; }
.repowiki-shell ::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--rw-fg-3) 46%, transparent); border: 3px solid transparent; background-clip: padding-box; }
.repowiki-shell ::-webkit-scrollbar-track { background: transparent; }

.repowiki-header {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 58px;
  padding: 9px 18px;
  border-bottom: 1px solid var(--rw-line);
  background: color-mix(in srgb, var(--rw-surface) 52%, transparent);
  backdrop-filter: blur(14px) saturate(130%);
  flex-wrap: wrap;
  flex: 0 0 auto;
}
.repowiki-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.repowiki-brand-mark {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 11px;
  color: #fff;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--rw-accent) 72%, #fff 28%), color-mix(in srgb, var(--rw-accent) 82%, #000 18%));
  box-shadow: 0 8px 18px color-mix(in srgb, var(--rw-accent) 24%, transparent), inset 0 1px 0 rgba(255,255,255,.28);
}
.repowiki-brand-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.repowiki-brand-line { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.repowiki-brand-title { font-size: 13px; font-weight: 650; letter-spacing: -.01em; white-space: nowrap; }
.repowiki-brand-slash { color: var(--rw-fg-3); font-size: 11px; }
.repowiki-brand-repo { font-size: 13px; font-weight: 600; color: var(--rw-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
.repowiki-brand-sub { font-size: 10.5px; color: var(--rw-fg-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 360px; font-variant-numeric: tabular-nums; }
.repowiki-run-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 5px; vertical-align: 1px; }

.repowiki-tabs {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  border: 1px solid var(--rw-line);
  background: color-mix(in srgb, var(--rw-surface) 80%, transparent);
}
.repowiki-tab {
  height: 27px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--rw-fg-3);
  font-size: 11.5px;
  cursor: pointer;
  transition: background .15s ease, color .15s ease, box-shadow .15s ease;
}
.repowiki-tab:hover { color: var(--rw-fg); background: color-mix(in srgb, var(--rw-fg) 7%, transparent); }
.repowiki-tab.is-active {
  color: var(--rw-fg);
  background: color-mix(in srgb, var(--rw-fg) 10%, transparent);
  box-shadow: inset 0 0 0 1px var(--rw-line), 0 1px 2px rgba(0,0,0,.06);
}
.repowiki-tab svg { opacity: .8; }
.repowiki-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-wrap: wrap; }

.repowiki-btn {
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 11px;
  border: 1px solid var(--rw-line);
  border-radius: 9px;
  background: transparent;
  color: var(--rw-fg-2);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease;
}
.repowiki-btn:hover:not(:disabled) {
  color: var(--rw-fg);
  background: var(--rw-surface);
  border-color: color-mix(in srgb, var(--rw-fg) 18%, var(--rw-line));
}
.repowiki-btn:active:not(:disabled) { transform: translateY(1px); }
.repowiki-btn.is-primary {
  color: #fff;
  border-color: color-mix(in srgb, var(--rw-accent) 72%, #000 12%);
  background: linear-gradient(180deg, color-mix(in srgb, var(--rw-accent) 92%, #fff 8%), var(--rw-accent));
  box-shadow: 0 6px 16px color-mix(in srgb, var(--rw-accent) 22%, transparent), inset 0 1px 0 rgba(255,255,255,.22);
}
.repowiki-btn.is-primary:hover:not(:disabled) { color: #fff; filter: brightness(1.04); background: linear-gradient(180deg, color-mix(in srgb, var(--rw-accent) 92%, #fff 8%), var(--rw-accent)); }
.repowiki-btn.is-active { color: var(--rw-fg); background: var(--rw-accent-soft); border-color: var(--rw-accent-line); }
.repowiki-btn.is-icon { width: 30px; padding: 0; }
.repowiki-btn:disabled { opacity: .5; cursor: default; }

.repowiki-segment { display: inline-flex; align-items: center; gap: 2px; padding: 3px; border: 1px solid var(--rw-line); border-radius: 9px; background: color-mix(in srgb, var(--rw-surface) 80%, transparent); }
.repowiki-segment button { height: 23px; padding: 0 9px; border: 0; border-radius: 6px; background: transparent; color: var(--rw-fg-3); font-size: 11px; cursor: pointer; }
.repowiki-segment button:hover { color: var(--rw-fg); }
.repowiki-segment button.is-active { color: var(--rw-fg); background: color-mix(in srgb, var(--rw-fg) 10%, transparent); }
.repowiki-segment button:disabled { opacity: .38; cursor: default; }

.repowiki-chip, .repowiki-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--rw-line);
  background: color-mix(in srgb, var(--rw-surface) 70%, transparent);
  color: var(--rw-fg-2);
  font-size: 10.5px;
  line-height: 18px;
  white-space: nowrap;
}
.repowiki-status { background: transparent; }

.repowiki-sidebar {
  width: 272px;
  flex: 0 0 272px;
  padding: 14px 12px 20px;
  border-right: 1px solid var(--rw-line);
  overflow-y: auto;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--rw-surface) 48%, transparent));
}
.repowiki-search { position: relative; display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.repowiki-search-field { position: relative; flex: 1 1 auto; min-width: 0; }
.repowiki-search-field input {
  width: 100%;
  height: 34px;
  padding: 0 28px 0 30px;
  border: 1px solid var(--rw-line);
  border-radius: 10px;
  background: color-mix(in srgb, var(--rw-surface) 88%, transparent);
  color: var(--rw-fg);
  font-size: 12px;
  outline: none;
  transition: border-color .15s ease, background .15s ease, box-shadow .15s ease;
}
.repowiki-search-field input::placeholder { color: var(--rw-fg-3); }
.repowiki-search-field input:focus { border-color: var(--rw-accent-line); box-shadow: 0 0 0 3px var(--rw-accent-soft); background: color-mix(in srgb, var(--rw-surface) 65%, transparent); }
.repowiki-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--rw-fg-3); pointer-events: none; }
.repowiki-search-clear { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--rw-fg-3); cursor: pointer; }
.repowiki-search-clear:hover { color: var(--rw-fg); background: var(--rw-surface-2); }
.repowiki-sidebar-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 2px 2px 10px; }
.repowiki-eyebrow { font-size: 9.5px; font-weight: 650; letter-spacing: .14em; text-transform: uppercase; color: var(--rw-fg-3); }
.repowiki-section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin: 0 0 5px;
  padding: 4px 4px;
  border: 0;
  background: transparent;
  color: var(--rw-fg-3);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: .1em;
  text-transform: uppercase;
  cursor: pointer;
}
.repowiki-section-label:hover { color: var(--rw-fg-2); }
.repowiki-section-count { margin-left: auto; padding: 0 6px; border-radius: 999px; background: var(--rw-surface); color: var(--rw-fg-3); font-size: 9.5px; line-height: 15px; letter-spacing: 0; }
.repowiki-tree-row { transition: background .12s ease, color .12s ease, box-shadow .12s ease; }
.repowiki-tree-row:hover { background: color-mix(in srgb, var(--rw-fg) 7%, transparent) !important; }
.repowiki-tree-row.is-active { box-shadow: inset 2px 0 0 var(--rw-accent); }
.repowiki-tree-row.is-active:hover { background: var(--rw-accent-soft) !important; }

.repowiki-main { position: relative; flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.repowiki-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
.repowiki-page { width: 100%; max-width: 900px; margin: 0 auto; padding: 30px 34px 76px; }
.repowiki-overview { width: 100%; max-width: 1060px; margin: 0 auto; padding: 26px 30px 64px; }
.repowiki-cards, .repowiki-projects { width: 100%; max-width: 1020px; margin: 0 auto; padding: 26px 30px 64px; }
.repowiki-page-title { margin: 6px 0 10px; font-size: 27px; line-height: 1.25; font-weight: 650; letter-spacing: -.025em; color: var(--rw-fg); }
.repowiki-page-goal { max-width: 70ch; margin: 0 0 16px; color: var(--rw-fg-2); font-size: 13px; line-height: 1.75; }
.repowiki-page-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.repowiki-back { display: inline-flex; align-items: center; gap: 5px; padding: 0; border: 0; background: transparent; color: var(--rw-fg-3); font-size: 11px; cursor: pointer; }
.repowiki-back:hover { color: var(--rw-fg); }
.repowiki-path { max-width: 58%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 8px; border-radius: 999px; background: var(--rw-surface); color: var(--rw-fg-3); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; }
.repowiki-breadcrumb { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; font-size: 11px; color: var(--rw-fg-3); }
.repowiki-breadcrumb button { padding: 0; border: 0; background: transparent; color: var(--rw-accent); font-size: 11px; cursor: pointer; }
.repowiki-breadcrumb button:hover { text-decoration: underline; }
.repowiki-toc { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 0 0 20px; padding: 9px 12px; border: 1px solid var(--rw-line); border-radius: 11px; background: color-mix(in srgb, var(--rw-surface) 92%, #808080 8%); backdrop-filter: blur(12px); box-shadow: 0 6px 18px rgba(0,0,0,.06); }
.repowiki-toc button { padding: 1px 5px; border: 0; border-radius: 5px; background: transparent; color: var(--rw-fg-2); font-size: 11px; cursor: pointer; }
.repowiki-toc button:hover { color: var(--rw-fg); background: var(--rw-surface-2); }

.repowiki-stat {
  flex: 1 1 0;
  min-width: 128px;
  padding: 14px 16px;
  border: 1px solid var(--rw-line);
  border-radius: 14px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--rw-fg) 5%, transparent), transparent 72%),
    color-mix(in srgb, var(--rw-surface) 60%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--rw-fg) 5%, transparent);
}
.repowiki-stat-label { margin-bottom: 5px; color: var(--rw-fg-3); font-size: 10.5px; letter-spacing: .04em; }
.repowiki-stat-value { color: var(--rw-fg); font-size: 23px; font-weight: 650; line-height: 1.05; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.repowiki-stat-sub { color: var(--rw-fg-3); font-size: 10.5px; }

.repowiki-empty { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 40px 24px; text-align: center; }
.repowiki-empty-mark { width: 58px; height: 58px; display: grid; place-items: center; margin-bottom: 4px; border-radius: 18px; border: 1px solid var(--rw-line); background: linear-gradient(145deg, var(--rw-accent-soft), var(--rw-surface)); color: var(--rw-accent); box-shadow: var(--rw-shadow); }
.repowiki-empty-title { font-size: 17px; font-weight: 650; letter-spacing: -.02em; }
.repowiki-empty-copy { max-width: 420px; margin: 0 0 8px; color: var(--rw-fg-3); font-size: 12px; line-height: 1.7; }

.repowiki-loading { flex: 1 1 auto; width: 100%; max-width: 760px; margin: 0 auto; padding: 30px 34px; }
.repowiki-skeleton { border-radius: 7px; background: linear-gradient(90deg, var(--rw-surface) 25%, var(--rw-surface-2) 50%, var(--rw-surface) 75%); background-size: 440px 100%; animation: repowiki-shimmer 1.4s ease-in-out infinite; }

.repowiki-error { max-width: 620px; margin: 28px auto; padding: 20px; border: 1px solid color-mix(in srgb, #e06c6c 38%, transparent); border-radius: 14px; background: color-mix(in srgb, #e06c6c 7%, transparent); }
.repowiki-error-title { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; font-weight: 650; }
.repowiki-error-body { color: var(--rw-fg-2); font-size: 12px; line-height: 1.7; }
.repowiki-error-hint { margin-top: 8px; color: var(--rw-fg-3); font-size: 11.5px; line-height: 1.65; }

.repowiki-graph { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 12px; padding: 18px 20px 20px; }
.repowiki-graph-toolbar { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.repowiki-graph-heading { min-width: 0; }
.repowiki-graph-heading h2 { margin: 3px 0 2px; color: var(--rw-fg); font-size: 19px; font-weight: 650; letter-spacing: -.02em; }
.repowiki-graph-sub { color: var(--rw-fg-3); font-size: 10.5px; font-variant-numeric: tabular-nums; }
.repowiki-graph-tools { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-wrap: wrap; }
.repowiki-graph-search { position: relative; }
.repowiki-graph-search input { width: 172px; height: 30px; padding: 0 10px 0 28px; border: 1px solid var(--rw-line); border-radius: 9px; background: color-mix(in srgb, var(--rw-surface) 84%, transparent); color: var(--rw-fg); font-size: 11.5px; outline: none; }
.repowiki-graph-search input::placeholder { color: var(--rw-fg-3); }
.repowiki-graph-search input:focus { border-color: var(--rw-accent-line); box-shadow: 0 0 0 3px var(--rw-accent-soft); }
.repowiki-graph-search svg { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: var(--rw-fg-3); pointer-events: none; }
.repowiki-graph-canvas {
  position: relative;
  flex: 1 1 auto;
  min-height: 340px;
  border: 1px solid var(--rw-line);
  border-radius: 18px;
  overflow: hidden;
  background:
    radial-gradient(760px 380px at 50% 0%, color-mix(in srgb, var(--rw-accent) 7%, transparent), transparent 72%),
    color-mix(in srgb, var(--rw-surface) 42%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--rw-fg) 4%, transparent);
}
.repowiki-graph-canvas::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(circle, color-mix(in srgb, var(--rw-fg-3) 26%, transparent) 1px, transparent 1px);
  background-size: 22px 22px;
  opacity: .42;
  mask-image: linear-gradient(180deg, #000 0%, rgba(0,0,0,.35) 72%, transparent 100%);
}
.repowiki-graph-canvas > svg { position: absolute; inset: 0; z-index: 1; display: block; width: 100%; height: 100%; cursor: grab; touch-action: none; user-select: none; }
.repowiki-graph-canvas.is-dragging { border-color: var(--rw-accent-line); }
.repowiki-graph-canvas.is-dragging > svg { cursor: grabbing; }
.repowiki-graph-node .repowiki-node-box { fill: color-mix(in srgb, var(--rw-fg) 5%, transparent); stroke: color-mix(in srgb, var(--rw-fg) 16%, transparent); stroke-width: 1; transition: fill .16s ease, stroke .16s ease, filter .16s ease; }
.repowiki-graph-node:hover .repowiki-node-box { stroke: var(--rw-accent-line); filter: drop-shadow(0 8px 16px rgba(0,0,0,.16)); }
.repowiki-graph-node:focus-visible { outline: none; }
.repowiki-graph-node:focus-visible .repowiki-node-box { stroke: var(--rw-accent); stroke-width: 2; }
.repowiki-graph-node.is-selected .repowiki-node-box { fill: var(--rw-accent-soft); stroke: var(--rw-accent); stroke-width: 1.6; }
.repowiki-graph-node.is-dimmed { opacity: .17; }
.repowiki-node-title { fill: var(--rw-fg); font-size: 12px; font-weight: 600; letter-spacing: .005em; }
.repowiki-node-meta { fill: var(--rw-fg-3); font-size: 10px; }
.repowiki-graph-edge { fill: none; stroke: color-mix(in srgb, var(--rw-fg) 22%, transparent); stroke-width: 1.05; opacity: .9; transition: stroke .16s ease, opacity .16s ease; }
.repowiki-graph-edge.is-active { stroke: var(--rw-accent); stroke-width: 1.8; opacity: 1; }
.repowiki-graph-edge.is-dimmed { opacity: .1; }
.repowiki-graph-guide { stroke: var(--rw-line); stroke-width: 1; stroke-dasharray: 2 7; opacity: .55; }
.repowiki-graph-layer { fill: var(--rw-fg-3); font-size: 9px; letter-spacing: .14em; text-transform: uppercase; opacity: .62; }
.repowiki-graph-watermark { position: absolute; z-index: 0; left: 18px; bottom: 16px; color: var(--rw-fg); font-size: 36px; font-weight: 700; letter-spacing: .16em; opacity: .035; pointer-events: none; user-select: none; white-space: nowrap; }
.repowiki-graph-hint { position: absolute; z-index: 2; left: 14px; top: 13px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border: 1px solid var(--rw-line); border-radius: 999px; background: color-mix(in srgb, var(--rw-surface) 75%, transparent); backdrop-filter: blur(10px); color: var(--rw-fg-3); font-size: 10px; pointer-events: none; }
.repowiki-graph-legend { position: absolute; z-index: 2; right: 14px; bottom: 13px; display: flex; align-items: center; gap: 11px; padding: 6px 10px; border: 1px solid var(--rw-line); border-radius: 999px; background: color-mix(in srgb, var(--rw-surface) 75%, transparent); backdrop-filter: blur(10px); color: var(--rw-fg-3); font-size: 10px; pointer-events: none; }
.repowiki-graph-tip { position: absolute; z-index: 2; left: 14px; bottom: 15px; color: var(--rw-fg-3); font-size: 10px; pointer-events: none; }
.repowiki-legend-dot { display: inline-block; width: 6px; height: 6px; margin-right: 4px; border-radius: 2px; vertical-align: 1px; }
.repowiki-graph-inspector {
  position: absolute;
  z-index: 3;
  left: 14px;
  bottom: 14px;
  width: min(390px, calc(100% - 28px));
  padding: 14px 15px;
  border: 1px solid var(--rw-line);
  border-radius: 14px;
  background: color-mix(in srgb, var(--rw-surface) 70%, transparent);
  backdrop-filter: blur(18px) saturate(140%);
  box-shadow: var(--rw-shadow);
  animation: repowiki-fade-in .2s ease;
}
.repowiki-graph-inspector-head { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 8px; }
.repowiki-graph-inspector-title { font-size: 13px; font-weight: 650; color: var(--rw-fg); }
.repowiki-graph-inspector-path { margin-top: 7px; color: var(--rw-fg-3); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; }
.repowiki-graph-inspector-copy { margin-top: 7px; color: var(--rw-fg-3); font-size: 11px; line-height: 1.65; }
.repowiki-graph-empty { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 340px; color: var(--rw-fg-3); font-size: 12px; }

.repowiki-progress { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 36px 24px; }
.repowiki-progress-card { width: 440px; max-width: 88%; padding: 16px 17px; border: 1px solid var(--rw-line); border-radius: 15px; background: color-mix(in srgb, var(--rw-surface) 66%, transparent); box-shadow: var(--rw-shadow); }
.repowiki-progress-bar { height: 6px; border-radius: 999px; background: var(--rw-surface-2); overflow: hidden; }
.repowiki-progress-bar > div { height: 100%; border-radius: inherit; background: linear-gradient(90deg, color-mix(in srgb, var(--rw-accent) 70%, #fff 30%), var(--rw-accent)); transition: width .3s ease; }
.repowiki-progress-phase { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; color: var(--rw-fg-2); font-size: 12px; }
.repowiki-spinner { width: 10px; height: 10px; border: 2px solid color-mix(in srgb, var(--rw-accent) 30%, transparent); border-top-color: var(--rw-accent); border-radius: 50%; animation: repowiki-spin .7s linear infinite; }
@keyframes repowiki-spin { to { transform: rotate(360deg); } }

.repowiki-toast { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); padding: 8px 15px; border: 1px solid var(--rw-line); border-radius: 999px; box-shadow: var(--rw-shadow); color: var(--rw-fg); font-size: 12px; white-space: nowrap; z-index: 6; }
.repowiki-help { position: absolute; right: 14px; bottom: 50px; width: 348px; padding: 15px 16px; border: 1px solid var(--rw-line); border-radius: 14px; box-shadow: var(--rw-shadow); color: var(--rw-fg-2); font-size: 12px; line-height: 1.65; z-index: 6; }
.repowiki-help-row { margin-bottom: 8px; }
.repowiki-help-row strong { color: var(--rw-fg); font-weight: 650; }
.repowiki-help-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; color: var(--rw-fg); font-weight: 650; }
.repowiki-help-close { padding: 0; border: 0; background: transparent; color: var(--rw-fg-3); font-size: 13px; cursor: pointer; }
.repowiki-help-close:hover { color: var(--rw-fg); }

.repowiki-copy { height: 20px; padding: 0 7px; border: 1px solid var(--rw-line); border-radius: 5px; background: transparent; color: var(--rw-fg-3); font-size: 10px; cursor: pointer; }
.repowiki-copy:hover { color: var(--rw-fg); background: var(--rw-surface); }

.repowiki-banner { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 12px 22px 0; padding: 9px 12px; border: 1px solid color-mix(in srgb, var(--rw-accent) 34%, var(--rw-line)); border-radius: 11px; background: color-mix(in srgb, var(--rw-accent) 8%, transparent); color: var(--rw-fg-2); font-size: 11.5px; line-height: 1.55; }
.repowiki-banner.is-warn { border-color: color-mix(in srgb, #e0a34a 45%, var(--rw-line)); background: color-mix(in srgb, #e0a34a 10%, transparent); }
.repowiki-banner .repowiki-btn { height: 25px; margin-left: auto; }

.repowiki-badge-stale { display: inline-flex; align-items: center; gap: 5px; height: 25px; padding: 0 9px; border: 1px solid color-mix(in srgb, #e0a34a 48%, var(--rw-line)); border-radius: 999px; background: color-mix(in srgb, #e0a34a 10%, transparent); color: #d99a3c; font-size: 10.5px; cursor: pointer; }

.repowiki-modal-mask { position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 22px; background: rgba(0,0,0,.28); backdrop-filter: blur(2px); }
.repowiki-modal { width: min(430px, 100%); padding: 18px 18px 15px; border: 1px solid var(--rw-line); border-radius: 16px; background: var(--rw-surface); background-color: color-mix(in srgb, var(--rw-surface) 96%, #808080 4%); box-shadow: var(--rw-shadow); }
.repowiki-modal h3 { margin: 0 0 8px; font-size: 14px; color: var(--rw-fg); }
.repowiki-modal p { margin: 0 0 14px; color: var(--rw-fg-2); font-size: 11.5px; line-height: 1.65; }
.repowiki-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }

.repowiki-source { position: absolute; z-index: 30; top: 0; right: 0; bottom: 0; width: min(560px, 92%); display: flex; flex-direction: column; border-left: 1px solid var(--rw-line); background: color-mix(in srgb, var(--rw-surface) 94%, #808080 6%); box-shadow: -18px 0 42px rgba(0,0,0,.18); animation: repowiki-slide-in .18s ease; }
@keyframes repowiki-slide-in { from { transform: translateX(24px); opacity: .4; } to { transform: none; opacity: 1; } }
.repowiki-source-head { display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-bottom: 1px solid var(--rw-line); }
.repowiki-source-path { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; color: var(--rw-fg); }
.repowiki-source-body { flex: 1 1 auto; overflow: auto; padding: 8px 0 24px; }
.repowiki-source-line { display: flex; gap: 12px; padding: 0 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11.5px; line-height: 1.72; white-space: pre; }
.repowiki-source-line .ln { flex: 0 0 42px; text-align: right; color: var(--rw-fg-3); user-select: none; opacity: .7; }
.repowiki-source-line .tx { color: var(--rw-fg-2); }
.repowiki-source-line.is-hit { background: color-mix(in srgb, var(--rw-accent) 13%, transparent); }
.repowiki-source-line.is-hit .ln { color: var(--rw-accent); opacity: 1; }
.repowiki-source-line.is-hit .tx { color: var(--rw-fg); }

.repowiki-filter { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--rw-line); border-radius: 8px; background: var(--rw-surface); }
.repowiki-filter button { height: 22px; padding: 0 7px; border: 0; border-radius: 6px; background: transparent; color: var(--rw-fg-3); font-size: 10.5px; cursor: pointer; }
.repowiki-filter button.is-active { color: var(--rw-fg); background: color-mix(in srgb, var(--rw-fg) 10%, transparent); }
.repowiki-search mark { padding: 0 1px; border-radius: 2px; background: color-mix(in srgb, #e0a34a 38%, transparent); color: inherit; }
.repowiki-recent { margin-bottom: 12px; }
.repowiki-recent-list { display: flex; flex-wrap: wrap; gap: 4px; }
.repowiki-recent-list button { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 8px; border: 1px solid var(--rw-line); border-radius: 999px; background: transparent; color: var(--rw-fg-3); font-size: 10.5px; cursor: pointer; }
.repowiki-recent-list button:hover { color: var(--rw-fg); background: var(--rw-surface); }

.repowiki-row { transition: background .12s ease, border-color .12s ease; }
.repowiki-row:hover { background: color-mix(in srgb, var(--rw-fg) 7%, transparent) !important; }
.repowiki-fade { animation: repowiki-fade-in .25s ease; }
[data-bidx] { scroll-margin-top: 62px; }

@media (max-width: 980px) {
  .repowiki-sidebar { width: 236px; flex-basis: 236px; }
  .repowiki-page { padding: 24px 24px 64px; }
  .repowiki-overview, .repowiki-cards, .repowiki-projects { padding: 22px 24px 56px; }
  .repowiki-brand-sub { max-width: 240px; }
}
@media (max-width: 1120px) {
  .repowiki-header { gap: 8px; padding: 8px 12px; }
  .repowiki-brand-repo { max-width: 110px; }
  .repowiki-root-btn { max-width: 148px !important; }
  .repowiki-tab { padding: 0 8px; }
  .repowiki-tab-label { display: none; }
  .repowiki-tab { width: 30px; justify-content: center; }
  .repowiki-brand-sub { max-width: 210px; }
  .repowiki-generate { display: none; }
}
.repowiki-menu-btn { display: none; }
.repowiki-drawer-mask { display: none; }
@media (max-width: 760px) {
  .repowiki-sidebar { display: none; }
  .repowiki-menu-btn { display: inline-flex; }
  .repowiki-drawer-mask { display: block; position: absolute; inset: 0; z-index: 19; background: rgba(0,0,0,.26); }
  .repowiki-sidebar.is-open {
    display: block;
    position: absolute;
    z-index: 20;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(300px, 86%);
    background: color-mix(in srgb, var(--rw-surface) 96%, #808080 4%);
    box-shadow: 18px 0 40px rgba(0,0,0,.22);
  }
  .repowiki-header { padding: 8px 12px; }
  .repowiki-tabs { order: 3; width: 100%; justify-content: stretch; }
  .repowiki-tab { flex: 1 1 0; justify-content: center; }
  .repowiki-actions { width: 100%; justify-content: flex-end; }
  .repowiki-page-title { font-size: 23px; }
  .repowiki-source { width: 100%; }
  .repowiki-toc-rail { display: none; }
}
@media (min-width: 1180px) {
  .repowiki-toc-rail { display: block; position: sticky; top: 18px; flex: 0 0 176px; align-self: flex-start; max-height: calc(100vh - 120px); overflow: auto; padding-left: 14px; border-left: 1px solid var(--rw-line); }
  .repowiki-toc-rail button { display: block; width: 100%; text-align: left; padding: 3px 0; border: 0; background: transparent; color: var(--rw-fg-3); font-size: 11px; line-height: 1.5; cursor: pointer; }
  .repowiki-toc-rail button:hover { color: var(--rw-accent); }
  .repowiki-toc-rail .is-sub { padding-left: 10px; font-size: 10.5px; }
  .repowiki-toc-inline { display: none; }
}
        `
        document.head.appendChild(style)
      } catch {
        // No document? The panel still renders without the animations.
      }
    }

    /** Perceptual tone of a page status, shared by dots and chips. */

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
        { className: 'repowiki-status' },
        h(StatusDot, { status: props.status }),
        props.children,
      )
    }

    /** One hero metric of the overview landing. */
    function StatCard(props) {
      return h(
        'div',
        { className: 'repowiki-stat' },
        h('div', { className: 'repowiki-stat-label' }, props.label),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'baseline', gap: '6px' } },
          h('span', { className: 'repowiki-stat-value' }, String(props.value ?? 0)),
          props.sub ? h('span', { className: 'repowiki-stat-sub' }, props.sub) : null,
        ),
      )
    }

    /** A shimmering skeleton block for the loading state. */
    function Skeleton(props) {
      return h('div', {
        'aria-hidden': 'true',
        className: 'repowiki-skeleton',
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

/* ---- 60-request.js ----
 * JSON request, error normalisation and abort helpers.
 * This file is concatenated into ../../client.js by scripts/build-client.mjs.
 */
    function normalizeError(payload, status) {
      const fallbackCode = `HTTP_${status || 0}`
      const raw = payload && typeof payload === 'object' ? payload.error ?? payload : null
      if (raw && typeof raw === 'object') {
        return {
          code: String(raw.code ?? fallbackCode),
          message: String(raw.message ?? raw.error ?? ''),
          hint: String(raw.hint ?? ''),
        }
      }
      if (typeof raw === 'string' && raw.trim() !== '') {
        return { code: fallbackCode, message: raw, hint: '' }
      }
      if (payload && typeof payload === 'object' && typeof payload.message === 'string') {
        return { code: String(payload.code ?? fallbackCode), message: payload.message, hint: String(payload.hint ?? '') }
      }
      return { code: fallbackCode, message: `HTTP ${status || 0}`, hint: '' }
    }

    /** True when a failure is the abort of a superseded request. */
    function isAbortError(cause) {
      if (!cause) return false
      if (cause.name === 'AbortError') return true
      return String(cause.message ?? '').includes('aborted')
    }

    /**
     * Perform one JSON request against the shared `/api` channel.
     *
     * @param {string} url the request URL
     * @param {{ signal?: AbortSignal, method?: string, body?: object }} [options]
     */
    async function requestJson(url, options = {}) {
      const init = { method: options.method || 'GET', signal: options.signal }
      if (options.body !== undefined) {
        init.headers = { 'content-type': 'application/json' }
        init.body = JSON.stringify(options.body)
      }
      let response
      try {
        response = await fetch(url, init)
      } catch (cause) {
        if (isAbortError(cause)) throw cause
        const failure = new Error(String((cause && cause.message) || cause))
        failure.state = {
          code: 'NETWORK',
          message: String((cause && cause.message) || cause),
          hint: 'The host did not answer; check that the DSH host is running.',
        }
        throw failure
      }
      if (!response.ok) {
        let payload = null
        try {
          payload = await response.json()
        } catch {
          payload = null
        }
        const failure = new Error(`HTTP ${response.status}`)
        failure.state = normalizeError(payload, response.status)
        throw failure
      }
      try {
        return await response.json()
      } catch (cause) {
        const failure = new Error(String((cause && cause.message) || cause))
        failure.state = {
          code: 'BAD_RESPONSE',
          message: String((cause && cause.message) || cause),
          hint: 'The host answered with a payload the panel cannot read.',
        }
        throw failure
      }
    }

    /** Turn any failure into the `{code, message, hint}` triple. */
    function toErrorState(cause) {
      if (cause && cause.state && typeof cause.state === 'object') return cause.state
      return normalizeError(null, 0)
    }

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

/* ---- 90-apply.js ----
 * Slot registration and module teardown.
 * This file is concatenated into ../../client.js by scripts/build-client.mjs.
 */
    function apply(ctx) {
      injectPanelStyles()
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'repo-wiki: dictionaries')
      const t = ctx.locale.bind(NS)

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 50,
            label: () => t('panel'),
            locale: NS,
          },
          RepoWikiPanelIcon,
        ),
      )

      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: PANEL_ID,
            locale: NS,
          },
          (props) => h(RepoWikiPanel, Object.assign({}, props, { t })),
        ),
      )
    }

    return {
      NS,
      PANEL_ID,
      apply,
      inject,
    }
  },
})
