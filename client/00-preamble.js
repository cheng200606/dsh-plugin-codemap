/* ---- 00-preamble.js ----
 * Module loader, factory header and shared constants.
 * This file is concatenated into ../../client.js by scripts/build-client.mjs.
 */
/**
 * Browser half of the CodeMap plugin.
 *
 * The Host owns the wiki (scan, index, generate, verify). This file only gives
 * the wiki a door in the Web shell: one icon in the left sidebar and one page
 * in the central panel. It talks to the Host over the shared `/api` channel
 * that `src/routes.js` registers.
 *
 * Rules this file follows:
 * - The browser module id equals the package name (`dsh-plugin-codemap`).
 * - React comes from the browser module table; no Harness client package is
 *   imported as a module, so every glyph and control below is drawn locally.
 * - Visible text goes through the Client locale service.
 * - Theme colours are read from the `--dsw-alias-*` tokens with a fallback.
 * - The panel is a classic script: no top-level `import` / `export` statement.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-codemap',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const useState = React.useState
    const useEffect = React.useEffect
    const useCallback = React.useCallback
    const useMemo = React.useMemo
    const useRef = React.useRef

    /** Dictionary namespace owned by this plugin. */
    const NS = 'codeMap'
    /** The id shared by the sidebar entry and the central panel it opens. */
    const PANEL_ID = 'codemap'
    /** Client services this module needs. */
    const inject = ['slots', 'locale']
    /** Delay between the last keystroke and the search request. */
    const SEARCH_DEBOUNCE_MS = 200
    /** Keywords offered when a search returns nothing. */
    const SEARCH_SUGGESTIONS = ['architecture', 'module', 'flow', 'config', 'overview', 'build']
    /** The client bundle version; compared with the host generator version. */
    const CLIENT_VERSION = '__CODEMAP_VERSION__'
    /** How long a graph payload may be reused before a silent refresh. */
    const GRAPH_TTL_MS = 30_000
    /** How often the open graph checks the source signature. */
    const GRAPH_CHECK_MS = 20_000
    /** sessionStorage prefix of the panel payload cache. */
    const PANEL_CACHE_PREFIX = 'codemap:panel:'
    /** localStorage key of the recently opened pages. */
    const RECENT_KEY = 'codemap:recent'
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
