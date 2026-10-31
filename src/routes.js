/**
 * Exact Fetch routes for the Web sidebar panel.
 *
 * The panel is a browser module, so it needs a way to ask the host for the
 * wiki. The harness exposes that through the `connection` service: a plugin
 * registers an exact route (path + methods) and the host serves it on the
 * shared `/api` channel. The browser then calls the route with a same-origin
 * `fetch`, which carries the browser cookie automatically.
 *
 * Every route is optional: when the `connection` service is missing the plugin
 * keeps working with its tools and its slash command, only the panel is not
 * available.
 *
 * Failures are reported with the unified error body of `src/errors.js` and an
 * HTTP status that matches the semantics (400 invalid argument, 404 missing
 * page, 409 concurrent generation, 500 everything else). The standalone
 * `/api/codemap/app` route serves the self-contained fallback page for every
 * case where the client bundle is not available in the browser.
 */
import { buildPanelPayload, buildPagePayload, buildSearchPayload } from './panel.js'
import { renderFallbackPage } from './panel-page.js'
import { ERROR_CODES, toErrorPayload } from './errors.js'

/** The exact routes the panel uses. */
export const PANEL_ROUTES = {
  panel: '/api/codemap/panel',
  page: '/api/codemap/page',
  search: '/api/codemap/search',
  generate: '/api/codemap/generate',
}

/**
 * The standalone fallback page. It is not part of `PANEL_ROUTES` (the four
 * panel routes are a stable contract), but it is registered alongside them.
 */
export const APP_ROUTE = '/api/codemap/app'

/**
 * Live generation progress (`GET`): what phase the pipeline is in, how many
 * pages are done / pending / failed, and the page currently being written.
 */
export const PROGRESS_ROUTE = '/api/codemap/progress'

/** Cancel the active generation (`POST`). */
export const ABORT_ROUTE = '/api/codemap/abort'

/** Export the wiki of the resolved repository (`POST`, body `{target}`). */
export const EXPORT_ROUTE = '/api/codemap/export'

/** Import a wiki produced elsewhere (`POST`, body `{source}`). */
export const IMPORT_ROUTE = '/api/codemap/import'

/** Read one source snippet behind a `path:line` citation (`GET`). */
export const SOURCE_ROUTE = '/api/codemap/source'

/** The engineering knowledge graph (`GET`, params `level`, `module`, `root`). */
export const GRAPH_ROUTE = '/api/codemap/graph'

/** The upstream / downstream impact set of one module (`GET`, param `module`). */
export const IMPACT_ROUTE = '/api/codemap/impact'

/**
 * The `requestBody` mode for a read-only route.
 *
 * `'none'` looks like the right answer for a GET, but in DSH 0.2.1-rc.5 the
 * `/api` bridge maps every mode other than `'buffered'` to the streaming branch
 * and builds `new Request(url, { method: 'GET', body: Readable.toWeb(req) })`,
 * which the WHATWG `Request` constructor rejects with
 * `TypeError: Request with GET/HEAD method cannot have body`. The rejection
 * escapes before the route handler runs, so the browser only ever saw a bare
 * HTTP 400 with an empty body. `'buffered'` reads the (empty) request body and
 * constructs a bodyless `Request`, which is why every GET route uses it.
 */
const READ_ONLY_BODY = 'buffered'

/** Map an error code to the HTTP status the route answers with. */
const STATUS_BY_CODE = {
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.INVALID_ARGUMENT]: 400,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.CONFLICT]: 409,
  [ERROR_CODES.UNSUPPORTED]: 501,
  [ERROR_CODES.FAILED]: 500,
  [ERROR_CODES.INTERNAL]: 500,
}

/**
 * Register the panel routes.
 *
 * @param {object} ctx - the plugin context.
 * @param {object} service - the `CodeMapService` instance.
 * @returns {{ registered: string[], dispose: () => void }}
 */
export function registerPanelRoutes(ctx, service) {
  const registered = []
  const disposers = []
  const connection = optionalService(ctx, 'connection')
  if (!connection?.fetch?.register) {
    // Reachable only when the fiber was started without the declared
    // dependency; say so instead of skipping silently.
    ctx.logger?.warn?.('codemap: connection 服务不可用，面板路由未注册（工具与命令入口不受影响）')
    return { registered, dispose() {} }
  }

  const add = (route) => {
    // A throwing handler makes the connection layer answer a bare 400 with an
    // empty body, which is impossible to diagnose from the browser. Wrap every
    // handler so a failure always comes back as the structured error payload.
    const guarded = {
      ...route,
      fetch: async (request) => {
        try {
          return await route.fetch(request)
        } catch (error) {
          return errorResponse(error, ERROR_CODES.INTERNAL)
        }
      },
    }
    try {
      const dispose = connection.fetch.register(guarded)
      if (typeof dispose === 'function') disposers.push(dispose)
      registered.push(route.path)
    } catch (error) {
      ctx.logger?.warn?.(`codemap: 无法注册面板路由 ${route.path}：${error?.message ?? error}`)
    }
  }

  add({
    path: PANEL_ROUTES.panel,
    methods: ['GET'],
    requestBody: READ_ONLY_BODY,
    fetch: async (request) => {
      const url = new URL(request.url)
      const root = await service.resolveRequestRoot(rootHint(url))
      try {
        return Response.json(await buildPanelPayload(service, root, {
          language: url.searchParams.get('language') ?? undefined,
        }))
      } catch (error) {
        return errorResponse(error, ERROR_CODES.FAILED)
      }
    },
  })

  add({
    path: PANEL_ROUTES.page,
    methods: ['GET'],
    requestBody: READ_ONLY_BODY,
    fetch: async (request) => {
      const url = new URL(request.url)
      const id = url.searchParams.get('id') ?? ''
      if (!id) {
        return errorResponse(
          argumentError('缺少 id 参数', '请携带要打开的页面 id，例如 /api/codemap/page?id=architecture。'),
          ERROR_CODES.INVALID_ARGUMENT,
        )
      }
      const language = url.searchParams.get('language') ?? undefined
      const root = await service.resolveRequestRoot(rootHint(url))
      try {
        return Response.json(await buildPagePayload(service, root, id, { language }))
      } catch (error) {
        return errorResponse(error, ERROR_CODES.NOT_FOUND)
      }
    },
  })

  add({
    path: PANEL_ROUTES.search,
    methods: ['GET'],
    requestBody: READ_ONLY_BODY,
    fetch: async (request) => {
      const url = new URL(request.url)
      const query = url.searchParams.get('q') ?? ''
      const limit = Number(url.searchParams.get('limit') ?? 8) || 8
      const language = url.searchParams.get('language') ?? undefined
      if (!query.trim()) return Response.json({ query, count: 0, hits: [] })
      const root = await service.resolveRequestRoot(rootHint(url))
      try {
        return Response.json(await buildSearchPayload(service, root, query, { limit, language }))
      } catch (error) {
        return errorResponse(error, ERROR_CODES.FAILED)
      }
    },
  })

  add({
    path: PANEL_ROUTES.generate,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const url = new URL(request.url)
      let body = {}
      try {
        body = await request.json()
      } catch {
        body = {}
      }
      const root = await service.resolveRequestRoot(rootHint(url) ?? body?.root)
      const mode = body?.mode === 'update' ? 'update' : 'full'
      // `?async=1` asks for a background run. The `jobs` service contract is
      // not confirmed yet, so until it is, the request falls back to a
      // synchronous run and says so in the response body.
      const wantsAsync = url.searchParams.get('async') === '1'
      const jobs = wantsAsync ? optionalService(ctx, 'jobs') : null
      const backgroundReady = Boolean(jobs && typeof jobs.submit === 'function')
      try {
        const result = mode === 'update'
          ? await service.update({ root, language: body?.language }, undefined)
          : await service.generate({ root, language: body?.language }, undefined)
        if (!wantsAsync) return Response.json(result)
        if (backgroundReady) {
          // Reserved for the real background runner; unreachable until the
          // `jobs` contract is confirmed and submitted to.
          return Response.json({ ...result, execution: 'async' })
        }
        return Response.json({
          ...result,
          mode: 'sync',
          requestedMode: result.mode,
          execution: 'sync',
          jobId: null,
        })
      } catch (error) {
        return errorResponse(error, ERROR_CODES.FAILED)
      }
    },
  })

  // Live generation progress: the panel polls it while a run is active so it
  // can render the progress card (done/total, in-flight, failed) like a
  // long-running generator would.
  add({
    path: PROGRESS_ROUTE,
    methods: ['GET'],
    requestBody: READ_ONLY_BODY,
    fetch: async (request) => {
      const url = new URL(request.url)
      try {
        const root = await service.resolveRequestRoot(rootHint(url))
        const language = url.searchParams.get('language') ?? undefined
        return Response.json({
          progress: service.progress(root, language),
          running: service.isRunning(root, language),
        })
      } catch (error) {
        return errorResponse(error, ERROR_CODES.FAILED)
      }
    },
  })

  // Cancel the active generation. Returns whether a run was aborted; a run
  // that already finished answers 200 with aborted:false.
  add({
    path: ABORT_ROUTE,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      let body = {}
      try {
        body = await request.json()
      } catch {
        body = {}
      }
      try {
        const root = await service.resolveRequestRoot(rootHint(new URL(request.url)) ?? body?.root)
        const language = typeof body?.language === 'string' ? body.language : undefined
        const aborted = service.abortRun(root, language)
        return Response.json({ aborted, root })
      } catch (error) {
        return errorResponse(error, ERROR_CODES.FAILED)
      }
    },
  })

  // Export the wiki of the resolved repository. `qoder` copies the tree to
  // `.qoder/codemap`; `dsh` writes a JSON bundle under the output directory.
  add({
    path: EXPORT_ROUTE,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      let body = {}
      try {
        body = await request.json()
      } catch {
        body = {}
      }
      try {
        const root = await service.resolveRequestRoot(rootHint(new URL(request.url)) ?? body?.root)
        const target = body?.target === 'dsh' ? 'dsh' : 'qoder'
        const result = await service.exportWiki(root, target)
        return Response.json(result)
      } catch (error) {
        return errorResponse(error, ERROR_CODES.FAILED)
      }
    },
  })

  // Import a wiki produced elsewhere. The previous wiki is backed up first so
  // a human-edited page cannot be lost to a one-click migration.
  add({
    path: IMPORT_ROUTE,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      let body = {}
      try {
        body = await request.json()
      } catch {
        body = {}
      }
      try {
        const root = await service.resolveRequestRoot(rootHint(new URL(request.url)) ?? body?.root)
        const source = body?.source === 'dsh' ? 'dsh' : 'qoder'
        const backup = body?.backup === false ? null : await service.backupOutput(root)
        const result = await service.importWiki(root, source)
        return Response.json({ ...result, backup })
      } catch (error) {
        return errorResponse(error, ERROR_CODES.FAILED)
      }
    },
  })

  // The source behind one citation. The path is validated by the service:
  // repository-relative only, inside the root, secret files refused.
  add({
    path: SOURCE_ROUTE,
    methods: ['GET'],
    requestBody: READ_ONLY_BODY,
    fetch: async (request) => {
      const url = new URL(request.url)
      const path = url.searchParams.get('path') ?? ''
      const line = Number(url.searchParams.get('line') ?? 1) || 1
      const context = Number(url.searchParams.get('context') ?? 14) || 14
      try {
        const root = await service.resolveRequestRoot(rootHint(url))
        return Response.json(await service.readSourceSnippet(root, path, { line, context }))
      } catch (error) {
        return errorResponse(error, ERROR_CODES.NOT_FOUND)
      }
    },
  })

  // The engineering knowledge graph: module-level by default, file-level for
  // a single module via `?level=file&module=<dir>`.
  add({
    path: GRAPH_ROUTE,
    methods: ['GET'],
    requestBody: READ_ONLY_BODY,
    fetch: async (request) => {
      const url = new URL(request.url)
      try {
        const root = await service.resolveRequestRoot(rootHint(url))
        if (url.searchParams.get('signatureOnly') === '1') {
          return Response.json({ root, signature: await service.graphSignature(root) })
        }
        return Response.json(await service.buildGraph(root, {
          level: url.searchParams.get('level') ?? undefined,
          module: url.searchParams.get('module') ?? undefined,
          limit: Number(url.searchParams.get('limit') ?? 300) || 300,
        }))
      } catch (error) {
        return errorResponse(error, ERROR_CODES.FAILED)
      }
    },
  })

  // The impact set of one module over the import graph.
  add({
    path: IMPACT_ROUTE,
    methods: ['GET'],
    requestBody: READ_ONLY_BODY,
    fetch: async (request) => {
      const url = new URL(request.url)
      const moduleDir = url.searchParams.get('module') ?? ''
      try {
        const root = await service.resolveRequestRoot(rootHint(url))
        const impact = await service.impactGraph(root, moduleDir)
        return Response.json({ module: moduleDir, ...impact })
      } catch (error) {
        return errorResponse(error, ERROR_CODES.FAILED)
      }
    },
  })

  // The standalone fallback page is registered unless the configuration turns
  // it off; it costs nothing when unused and is the stable target for
  // scripted verification of the panel's data contract.
  if (service.config.panelFallbackPage !== false) {
    add({
      path: APP_ROUTE,
      methods: ['GET'],
      requestBody: READ_ONLY_BODY,
      fetch: async () => {
        const html = renderFallbackPage({
          panel: PANEL_ROUTES.panel,
          page: PANEL_ROUTES.page,
          search: PANEL_ROUTES.search,
          generate: PANEL_ROUTES.generate,
        })
        return new Response(html, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      },
    })
  }

  return {
    registered,
    dispose() {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch {
          // The host may already have dropped the route.
        }
      }
    },
  }
}

/**
 * Read the optional `root` hint of a request.
 *
 * The panel passes the workspace the user is looking at so the host does not
 * have to guess; the value is validated against the filesystem by the service
 * before it is used.
 *
 * @param {URL} url
 * @returns {string|undefined}
 */
function rootHint(url) {
  const value = url.searchParams.get('root')
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

/**
 * Build an invalid-argument error carrying the unified fields.
 *
 * @param {string} message
 * @param {string} hint
 * @returns {Error}
 */
function argumentError(message, hint) {
  const error = new Error(message)
  error.code = ERROR_CODES.INVALID_ARGUMENT
  error.hint = hint
  return error
}

/**
 * Turn an unknown error into a JSON response.
 *
 * The error body is always `{ error: { code, message, hint } }`. When the
 * error carries its own code (for example the `conflict` of a concurrent
 * generation) the status follows it; otherwise the route's fallback code
 * decides both the body code and the status, so the two never disagree.
 *
 * @param {unknown} error
 * @param {string} [fallbackCode] - the code (and with it the status) used
 *   when the error carries none; `failed` maps to 500, `not_found` to 404.
 * @returns {Response}
 */
function errorResponse(error, fallbackCode = ERROR_CODES.FAILED) {
  const payload = toErrorPayload(error, fallbackCode)
  const status = STATUS_BY_CODE[payload.code] ?? 500
  return Response.json({ error: payload }, { status })
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
