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
     * Resolve any CSS colour (rgb, rgba, `color(srgb …)`, named, `transparent`)
     * into channels. The browser normalises the syntax through an off-screen
     * element, so a theme token is never misread as opaque just because its
     * serialisation differs from the expected string.
     *
     * @param {string} value
     * @returns {{ r: number, g: number, b: number, a: number } | null}
     */
    function colorParts(value) {
      try {
        const probe = document.createElement('span')
        probe.style.display = 'none'
        probe.style.color = value
        document.body.appendChild(probe)
        const computed = getComputedStyle(probe).color
        probe.remove()
        const rgb = computed.match(/rgba?\(([^)]+)\)/i)
        if (rgb) {
          const parts = rgb[1].split(/[\s,/]+/u).filter(Boolean).map(Number)
          return {
            r: parts[0] || 0,
            g: parts[1] || 0,
            b: parts[2] || 0,
            a: parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1,
          }
        }
        // Wide-gamut themes serialise as `color(srgb 0.1 0.1 0.12 / 0.5)`.
        const srgb = computed.match(/color\(srgb\s+([^)]+)\)/i)
        if (srgb) {
          const parts = srgb[1].split(/[\s/]+/u).filter(Boolean).map(Number)
          return {
            r: Math.round((parts[0] || 0) * 255),
            g: Math.round((parts[1] || 0) * 255),
            b: Math.round((parts[2] || 0) * 255),
            a: parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1,
          }
        }
      } catch {
        // A probe failure is not worth breaking the panel for.
      }
      return null
    }

    /** Composite `src` over `dst` (both opaque-after-blend channel objects). */
    function blendOver(dst, src) {
      const alpha = Math.min(1, Math.max(0, src.a))
      return {
        r: Math.round(src.r * alpha + dst.r * (1 - alpha)),
        g: Math.round(src.g * alpha + dst.g * (1 - alpha)),
        b: Math.round(src.b * alpha + dst.b * (1 - alpha)),
        a: 1,
      }
    }

    /**
     * An **opaque** surface for popovers. Host tokens are mostly translucent,
     * and the app shell often paints its background on a container rather than
     * on <body>, so a popover that merely copies one ancestor colour ends up
     * letting the page show through. Every translucent ancestor above <body> is
     * therefore composited over a base chosen from the theme's text colour.
     *
     * @param {string} fallback used when there is no document (tests, SSR).
     * @returns {string}
     */
    function hostSurface(fallback = 'rgba(30,30,30,0.98)') {
      try {
        if (!document.body) return fallback
        // The panel may live in a shell whose theme differs from <body> (a host
        // that renders plugins in its own surface), so the shell decides both
        // the light/dark base and where the ancestor walk starts.
        const anchor = document.querySelector('.codemap-shell') || document.body
        const text = colorParts(getComputedStyle(anchor).color) || colorParts(getComputedStyle(document.body).color)
        // Light text means a dark shell; the base must match it, or a popover
        // over a transparent shell would flash the wrong theme.
        const dark = text ? text.r * 0.299 + text.g * 0.587 + text.b * 0.114 > 140 : true
        let surface = dark ? { r: 24, g: 24, b: 26, a: 1 } : { r: 255, g: 255, b: 255, a: 1 }
        const layers = []
        let node = anchor
        while (node) {
          const parts = colorParts(getComputedStyle(node).backgroundColor)
          if (parts && parts.a > 0.001) {
            layers.push(parts)
            if (parts.a >= 0.999) break
          }
          node = node.parentElement
        }
        // Collected nearest-first: paint from the farthest to the nearest.
        for (let index = layers.length - 1; index >= 0; index -= 1) {
          surface = blendOver(surface, layers[index])
        }
        return `rgb(${surface.r}, ${surface.g}, ${surface.b})`
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
