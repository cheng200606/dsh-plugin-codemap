/**
 * dsh-plugin-repowiki — a source-grounded repository knowledge layer for the
 * DeepSeek Harness.
 *
 * The host half of the bundle. It registers:
 *   - the `repoWiki` service (see `src/service.js`),
 *   - the `wiki_search` / `wiki_read` / `wiki_generate` model tools,
 *   - the `/wiki` slash command,
 *   - the `repowiki:policy` system-prompt section.
 *
 * Every registration happens inside `ctx.effect(...)`, so the whole plugin is
 * torn down with its fiber.
 */
import { Config, normalizeConfig } from './src/config.js'
import { RepoWikiService } from './src/service.js'
import { registerTools, TOOL_NAMES } from './src/tools.js'
import { registerCommand } from './src/command.js'
import { registerPrompt } from './src/prompt.js'
import { registerPanelRoutes } from './src/routes.js'
import { GENERATOR_VERSION } from './src/store.js'
import { nowIso } from './src/util.js'

/** Plugin id, also used as the Cordis patch row id. */
export const name = 'repowiki'

/** Services this plugin requires. Optional services are resolved with `ctx.get`. */
export const inject = ['fs', 'tools']

export { Config, RepoWikiService }

/**
 * Default export.
 *
 * The Cordis loader unwraps `default` when it exists, and then reads `name`,
 * `inject`, `Config` and `apply` from it. Exporting the same members twice
 * keeps the bundle loadable whether the loader prefers the default export or
 * the named exports.
 */
export default {
  name,
  inject,
  Config,
  apply,
}

/**
 * Plugin entry point.
 *
 * @param {object} ctx - the plugin context.
 * @param {object} config - the validated configuration of the patch row.
 */
export function apply(ctx, config) {
  const settings = normalizeConfig(config)
  const service = new RepoWikiService(ctx, settings)
  const profileContext = optionalService(ctx, 'profileContext')

  // The receipt records what this plugin build registered in the harness. It is
  // written next to every generated wiki (`meta/runtime.json`) so a reader can
  // tell which build produced the pages and which capabilities were live.
  const receipt = {
    plugin: 'dsh-plugin-repowiki',
    generator: { name: 'dsh-plugin-repowiki', version: GENERATOR_VERSION },
    loadedAt: nowIso(),
    node: process.version,
    platform: process.platform,
    harness: {
      // The session id is filled in per run: the harness does not export it
      // into the plugin environment, the calling tool or command carries it.
      sessionId: null,
      profile: profileContext?.name ?? process.env.DSH_PROFILE ?? null,
      profileDir: profileContext?.dir ?? null,
      home: profileContext?.home ?? process.env.DSH_HOME ?? null,
      cwd: profileContext?.cwd ?? process.cwd(),
    },
    config: settings,
    registered: {
      service: 'repoWiki',
      tools: [],
      command: null,
      promptSection: null,
      panel: false,
      routes: [],
    },
    services: {
      tools: hasService(ctx, 'tools'),
      commands: hasService(ctx, 'commands'),
      systemPrompt: hasService(ctx, 'systemPrompt'),
      workingDirectory: hasService(ctx, 'workingDirectory'),
      connection: hasService(ctx, 'connection'),
      profileContext: Boolean(profileContext),
      // The client-graph probes (D3): every host capability is optional and
      // the receipt records which ones answered, so a degraded environment is
      // visible in the artefact instead of guessed at.
      clientModules: hasService(ctx, 'clientModules'),
      webServer: hasService(ctx, 'webServer'),
      webApp: hasService(ctx, 'webApp'),
    },
  }
  service.setRuntimeReceipt(receipt)

  ctx.effect(() => {
    // The service is owned by this fiber: it disappears when the plugin unloads.
    const disposeService = ctx.provide('repoWiki', service)
    return () => {
      if (typeof disposeService === 'function') disposeService()
    }
  })

  ctx.effect(() => {
    const disposers = registerTools(ctx, service)
    receipt.registered.tools = TOOL_NAMES.filter((name) => {
      try {
        return Boolean(ctx.tools.get(name))
      } catch {
        return false
      }
    })
    return () => {
      for (const dispose of disposers) {
        if (typeof dispose === 'function') dispose()
      }
    }
  })

  ctx.effect(() => {
    const disposers = registerCommand(ctx, service)
    if (disposers.length > 0) receipt.registered.command = 'wiki'
    return () => {
      for (const dispose of disposers) {
        if (typeof dispose === 'function') dispose()
      }
    }
  })

  ctx.effect(() => {
    const disposers = registerPrompt(ctx, service)
    if (disposers.length > 0) receipt.registered.promptSection = 'repowiki:policy'
    return () => {
      for (const dispose of disposers) {
        if (typeof dispose === 'function') dispose()
      }
    }
  })

  // The Web panel. The routes live on the shared `/api` channel, so the browser
  // can read the wiki without the host opening a socket of its own.
  //
  // The `connection` service is NOT guaranteed to exist when this bundle
  // applies: the web carrier creates it asynchronously after the web server
  // resolves (measured: at apply time `connection=false, webServer=true`), and
  // a silent eager lookup used to skip route registration for good. Declaring
  // the dependency instead makes the host start this fiber exactly when the
  // service appears — immediately when it already exists.
  ctx.inject(['connection'], (connectionCtx) => {
    ctx.effect(() => {
      const { registered, dispose } = registerPanelRoutes(connectionCtx, service)
      receipt.registered.panel = registered.length > 0
      receipt.registered.routes = registered
      if (registered.length > 0) receipt.services.connection = true
      return () => {
        if (typeof dispose === 'function') dispose()
        // The fiber owns the routes: when it unwinds, the receipt must stop
        // claiming them until a re-registration brings them back.
        receipt.registered.panel = false
        receipt.registered.routes = []
      }
    })
  })
}

/**
 * True when an optional service is available in this context.
 *
 * @param {object} ctx
 * @param {string} name
 */
function hasService(ctx, name) {
  try {
    return Boolean(ctx.get(name, false))
  } catch {
    return false
  }
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
