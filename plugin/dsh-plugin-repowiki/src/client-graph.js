/**
 * Client bundle self-check.
 *
 * The browser half of this plugin is a separate artifact: the harness composes
 * the web boot graph from every enabled package that declares `dsh.client`, and
 * serves each bundle from `/plugins/<package name>/client.js?rev=<hash>`.
 *
 * Two host services make that observable:
 *
 *   - `clientModules` — the web plugin table. `graph()` returns the composed
 *     boot graph, `fetchBundle(request)` resolves a bundle exactly like the
 *     browser does.
 *   - `webServer` / `connection` / `webApp` — the origin of the web UI and the
 *     authenticated URL a browser needs (the bare origin is rejected by the
 *     host token fence).
 *
 * Everything in this module is read-only and defensive: a missing service, an
 * unexpected graph shape or a failing fetch must degrade into a description of
 * the problem, never into a plugin that fails to load.
 */

/** The package name; the harness uses it as the id of the served bundle. */
export const CLIENT_PACKAGE_NAME = 'dsh-plugin-repowiki'

/** The route prefix the harness serves client bundles from. */
export const CLIENT_BUNDLE_PREFIX = '/plugins'

/**
 * Resolve the state of the browser half of this plugin.
 *
 * @param {object} ctx - the plugin context.
 * @returns {Promise<{available: boolean, composed: boolean, served: boolean, rev: string|null, bytes: number, url: string|null, error: string|null, origin: string|null, webUrl: string|null}>}
 */
export async function resolveClientStatus(ctx) {
  const status = {
    available: false,
    composed: false,
    served: false,
    rev: null,
    bytes: 0,
    url: null,
    error: null,
    origin: null,
    webUrl: null,
  }

  try {
    const clientModules = optionalService(ctx, 'clientModules')
    if (!clientModules) {
      status.error = '宿主未提供 clientModules 服务，无法确认客户端半体是否进入启动图。'
      return status
    }
    status.available = true

    const webServer = optionalService(ctx, 'webServer')
    const origin = typeof webServer?.getOrigin === 'function' ? webServer.getOrigin() : null
    status.origin = typeof origin === 'string' && origin ? origin : null

    const graph = typeof clientModules.graph === 'function' ? clientModules.graph() : null
    const entry = findGraphEntry(graph, CLIENT_PACKAGE_NAME)
    if (!entry) {
      status.error = `客户端启动图里没有 ${CLIENT_PACKAGE_NAME}：宿主在进程启动时缓存了包元数据，新增客户端半体需要重启宿主进程后才会进入启动图。`
      return status
    }
    status.composed = true
    status.rev = typeof entry.rev === 'string' && entry.rev ? entry.rev : null
    status.entry = entry

    // The graph row advertises the composed address itself, and that address is
    // not always of the shape `<prefix>/<name>/client.js?rev=`: a batch may
    // publish a combo address (relative, `??`-prefixed, `&rev=`-suffixed). Read
    // the advertised address first, then fall back to a reconstructed one.
    const candidates = []
    const advertised = normalizeBundleUrl(entry.url ?? entry.href, status.origin)
    if (advertised) candidates.push(advertised)
    for (const found of collectBundleUrls(graph, CLIENT_PACKAGE_NAME)) {
      const normalized = normalizeBundleUrl(found, status.origin)
      if (normalized && !candidates.includes(normalized)) candidates.push(normalized)
    }
    const url = buildBundleUrl(status.origin, CLIENT_PACKAGE_NAME, status.rev)
    if (url && !candidates.includes(url)) candidates.push(url)
    status.url = candidates[0] ?? url
    status.urls = candidates

    if (candidates.length && typeof clientModules.fetchBundle === 'function') {
      for (const candidate of candidates) {
        let response = null
        try {
          response = await clientModules.fetchBundle(new Request(candidate))
        } catch (error) {
          status.error = `取包失败：${error instanceof Error ? error.message : String(error)}`
          continue
        }
        if (response?.ok) {
          status.served = true
          status.url = candidate
          status.error = null
          const buffer = await response.arrayBuffer()
          status.bytes = buffer?.byteLength ?? 0
          break
        }
        status.error = `取包失败：HTTP ${response?.status ?? 'unknown'}（已尝试 ${candidates.length} 个地址）`
      }
    } else if (!url) {
      status.error = '宿主未提供 webServer.getOrigin()，无法构造客户端包的取包地址。'
    }

    status.webUrl = resolveWebUrl(ctx, status.origin)
    return status
  } catch (error) {
    status.error = error instanceof Error ? error.message : String(error)
    return status
  }
}

/**
 * Build the URL the harness serves the client bundle from.
 *
 * The revision is part of the URL: the host only answers a request whose
 * `rev` matches the composed artifact, so a bundle URL without it is a 404.
 *
 * @param {string|null} origin
 * @param {string} packageName
 * @param {string|null} rev
 * @returns {string|null}
 */
export function buildBundleUrl(origin, packageName, rev) {
  if (!origin) return null
  const base = `${String(origin).replace(/\/+$/, '')}${CLIENT_BUNDLE_PREFIX}/${packageName}/client.js`
  return rev ? `${base}?rev=${encodeURIComponent(rev)}` : base
}

/**
 * Find the graph entry of one package.
 *
 * The shape of the boot graph is owned by the host, so the lookup accepts the
 * shapes seen in the wild: a map, an array of rows, or a plain object whose
 * values hold the rows.
 *
 * @param {unknown} graph
 * @param {string} packageName
 * @returns {object|null}
 */
export function findGraphEntry(graph, packageName) {
  if (!graph) return null
  const candidates = []
  collectCandidates(graph, candidates)
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const id = candidate.id ?? candidate.packageName ?? candidate.package ?? candidate.name
    if (id === packageName) return candidate
  }
  return null
}

/**
 * Collect the objects that may carry a graph row.
 *
 * @param {unknown} value
 * @param {object[]} out
 */
function collectCandidates(value, out) {
  if (!value) return
  if (Array.isArray(value)) {
    for (const item of value) collectCandidates(item, out)
    return
  }
  if (value instanceof Map) {
    for (const [key, item] of value.entries()) {
      if (typeof key === 'string' && key === CLIENT_PACKAGE_NAME) {
        out.push({ id: key, ...(item && typeof item === 'object' ? item : {}) })
        continue
      }
      collectCandidates(item, out)
    }
    return
  }
  if (typeof value !== 'object') return
  if ('id' in value || 'packageName' in value || 'package' in value) {
    out.push(value)
    return
  }
  for (const item of Object.values(value)) collectCandidates(item, out)
}

/**
 * Normalize a bundle address advertised by the boot graph.
 *
 * The composition may publish a root-relative address
 * (`plugins/??<name>/client.js&rev=<hash>`) instead of an absolute one, and a
 * `Request` needs an absolute URL, so the origin is prepended when it is
 * missing.
 *
 * @param {unknown} url
 * @param {string|null} origin
 * @returns {string|null}
 */
export function normalizeBundleUrl(url, origin) {
  if (typeof url !== 'string' || !url) return null
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) return url
  if (!origin) return null
  const base = String(origin).replace(/\/+$/, '')
  const path = String(url).replace(/^\/+/, '')
  return `${base}/${path}`
}

/**
 * Collect every bundle URL the boot graph advertises for one package.
 *
 * The composition owns the URL shape: a batch may advertise a revisioned
 * address of its own, so the self-check must read the addresses out of the
 * graph instead of guessing them.
 *
 * @param {unknown} graph
 * @param {string} packageName
 * @returns {string[]}
 */
export function collectBundleUrls(graph, packageName) {
  const needle = `${packageName}/client`
  const found = []
  const seen = new Set()
  const walk = (value) => {
    if (typeof value === 'string') {
      if (!value.includes(needle) || seen.has(value)) return
      seen.add(value)
      found.push(value)
      return
    }
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }
    if (value instanceof Map) {
      for (const item of value.values()) walk(item)
      return
    }
    if (value instanceof Set) {
      for (const item of value) walk(item)
      return
    }
    for (const item of Object.values(value)) walk(item)
  }
  walk(graph)
  return found
}

/**
 * Resolve the URL a browser needs to open the web UI.
 *
 * The host fences the shell with a token, so the plain origin answers 401.
 * `connection.authenticatedUrl()` returns the address that carries the token.
 *
 * @param {object} ctx
 * @param {string|null} origin
 * @returns {string|null}
 */
export function resolveWebUrl(ctx, origin) {
  const connection = optionalService(ctx, 'connection')
  if (origin && typeof connection?.authenticatedUrl === 'function') {
    try {
      const url = connection.authenticatedUrl(origin)
      if (typeof url === 'string' && url) return url
    } catch {
      // fall through to the advertised URL
    }
  }
  const webApp = optionalService(ctx, 'webApp')
  if (typeof webApp?.getAdvertisedUrl === 'function') {
    try {
      const url = webApp.getAdvertisedUrl()
      if (typeof url === 'string' && url) return url
    } catch {
      // no advertised URL either
    }
  }
  return null
}

/**
 * Read an optional service without throwing.
 *
 * @param {object} ctx
 * @param {string} name
 * @returns {unknown}
 */
function optionalService(ctx, name) {
  try {
    return ctx.get(name, false)
  } catch {
    return undefined
  }
}
