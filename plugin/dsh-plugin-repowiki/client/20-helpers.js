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
