/**
 * Unit test for the client bundle self-check.
 *
 * `src/client-graph.js` asks the host whether the browser half of this plugin
 * entered the web boot graph and whether the bundle is actually served. The
 * host may answer in very different ways, so the module must degrade into a
 * description of the problem instead of failing:
 *
 *   1. the boot graph does not contain this package -> `composed` is false
 *   2. the bundle request answers 404 -> `served` is false and `bytes` is 0
 *   3. the `clientModules` service is missing -> `available` is false and the
 *      error explains why
 *
 * The test drives the module with fake services only, so it never needs a
 * running host.
 *
 * Run with:  node test/client-graph.mjs
 */
import assert from 'node:assert/strict'

import { CLIENT_PACKAGE_NAME, resolveClientStatus } from '../src/client-graph.js'

/* ------------------------------------------------------------------ *
 * Fake host services                                                  *
 * ------------------------------------------------------------------ */

/**
 * Build a fake plugin context.
 *
 * @param {Record<string, unknown>} services - The services the host exposes.
 * @returns {{ probes: Array<{ name: string, required: unknown }>, get: (name: string, required?: unknown) => unknown }}
 */
function createCtx(services = {}) {
  const probes = []
  return {
    probes,
    get(name, required) {
      probes.push({ name, required })
      return Object.hasOwn(services, name) ? services[name] : undefined
    },
  }
}

/** The origin the fake web server reports. */
const ORIGIN = 'http://127.0.0.1:61083'

/** The fields the status object must always carry. */
const EXPECTED_FIELDS = ['available', 'bytes', 'composed', 'error', 'origin', 'rev', 'served', 'url', 'webUrl']

/* ------------------------------------------------------------------ *
 * Checks                                                              *
 * ------------------------------------------------------------------ */

const checks = []

/**
 * Register one check.
 *
 * @param {string} name - What the check proves.
 * @param {() => Promise<void> | void} fn - The check body.
 */
function check(name, fn) {
  checks.push({ name, fn })
}

check('the status object carries every documented field', async () => {
  const status = await resolveClientStatus(createCtx())
  assert.deepEqual(Object.keys(status).sort(), EXPECTED_FIELDS, 'the status carries exactly the documented fields')
  assert.equal(typeof status.available, 'boolean')
  assert.equal(typeof status.composed, 'boolean')
  assert.equal(typeof status.served, 'boolean')
  assert.equal(typeof status.bytes, 'number')
  assert.ok(status.rev === null || typeof status.rev === 'string')
  assert.ok(status.url === null || typeof status.url === 'string')
  assert.ok(status.error === null || typeof status.error === 'string')
  assert.ok(status.origin === null || typeof status.origin === 'string')
  assert.ok(status.webUrl === null || typeof status.webUrl === 'string')
})

check('a composed graph reports the served bundle', async () => {
  const bundle = '/* dsh-plugin-codemap client */'
  const requested = []
  const ctx = createCtx({
    clientModules: {
      graph: () => [{ id: CLIENT_PACKAGE_NAME, rev: 'rev-1' }],
      async fetchBundle(request) {
        requested.push(request.url)
        return new Response(bundle, { status: 200 })
      },
    },
    webServer: { getOrigin: () => ORIGIN },
    connection: { authenticatedUrl: (base) => `${base}/?token=secret` },
  })

  const status = await resolveClientStatus(ctx)
  assert.equal(status.available, true)
  assert.equal(status.composed, true)
  assert.equal(status.served, true)
  assert.equal(status.rev, 'rev-1')
  assert.equal(status.bytes, Buffer.byteLength(bundle))
  assert.equal(status.origin, ORIGIN)
  assert.equal(status.error, null)
  assert.equal(
    status.url,
    `${ORIGIN}/plugins/${CLIENT_PACKAGE_NAME}/client.js?rev=rev-1`,
    'the bundle url carries the revision of the composed artifact',
  )
  assert.equal(requested.length, 1, 'the bundle is fetched exactly once')
  assert.equal(requested[0], status.url)
  assert.deepEqual(status.urls, [status.url], 'the candidate list holds the reconstructed address')
  assert.equal(status.webUrl, `${ORIGIN}/?token=secret`, 'the web url carries the host token')
})

check('a map shaped boot graph is understood as well', async () => {
  const ctx = createCtx({
    clientModules: {
      graph: () => new Map([[CLIENT_PACKAGE_NAME, { rev: 'rev-2' }]]),
      async fetchBundle() {
        return new Response('ok', { status: 200 })
      },
    },
    webServer: { getOrigin: () => ORIGIN },
  })

  const status = await resolveClientStatus(ctx)
  assert.equal(status.composed, true)
  assert.equal(status.rev, 'rev-2')
  assert.equal(status.served, true)
})

check('the bundle address advertised by the boot graph is tried first', async () => {
  const advertised = `${ORIGIN}/plugins/${CLIENT_PACKAGE_NAME}/client.js?rev=graph-rev`
  const constructed = `${ORIGIN}/plugins/${CLIENT_PACKAGE_NAME}/client.js?rev=row-rev`
  const requested = []
  const ctx = createCtx({
    clientModules: {
      graph: () => ({
        batches: [{ url: advertised, packages: [CLIENT_PACKAGE_NAME] }],
        packages: [{ id: CLIENT_PACKAGE_NAME, rev: 'row-rev' }],
      }),
      async fetchBundle(request) {
        requested.push(request.url)
        return new Response('ok', { status: 200 })
      },
    },
    webServer: { getOrigin: () => ORIGIN },
  })

  const status = await resolveClientStatus(ctx)
  assert.equal(status.served, true)
  assert.equal(requested[0], advertised, 'the composed address is tried before a reconstructed one')
  assert.equal(status.url, advertised, 'the served address is reported')
  assert.deepEqual(status.urls, [advertised, constructed], 'both candidate addresses are reported')
  assert.equal(status.error, null)
})

check('an unreachable candidate falls through to the next address', async () => {
  const advertised = `${ORIGIN}/plugins/${CLIENT_PACKAGE_NAME}/client.js?rev=stale`
  const requested = []
  const ctx = createCtx({
    clientModules: {
      graph: () => ({ batches: [{ url: advertised }], packages: [{ id: CLIENT_PACKAGE_NAME, rev: 'row-rev' }] }),
      async fetchBundle(request) {
        requested.push(request.url)
        if (request.url === advertised) return new Response('missing', { status: 404 })
        return new Response('bundle-bytes', { status: 200 })
      },
    },
    webServer: { getOrigin: () => ORIGIN },
  })

  const status = await resolveClientStatus(ctx)
  assert.equal(requested.length, 2, 'every candidate is attempted')
  assert.equal(status.served, true, 'the second address serves the bundle')
  assert.equal(status.bytes, Buffer.byteLength('bundle-bytes'))
  assert.equal(status.url, requested[1])
  assert.equal(status.error, null, 'a successful fallback clears the error')
})

check('a graph without this package degrades to composed=false without throwing', async () => {
  const ctx = createCtx({
    clientModules: {
      graph: () => [{ id: 'other-plugin', rev: 'rev-x' }],
      async fetchBundle() {
        throw new Error('the bundle must not be requested when the package is not composed')
      },
    },
    webServer: { getOrigin: () => ORIGIN },
  })

  const status = await resolveClientStatus(ctx)
  assert.equal(status.available, true, 'the client modules service exists')
  assert.equal(status.composed, false, 'the package is not part of the boot graph')
  assert.equal(status.served, false)
  assert.equal(status.bytes, 0)
  assert.equal(status.rev, null)
  assert.ok(typeof status.error === 'string' && status.error.length > 0, 'the error explains the missing package')
  assert.ok(status.error.includes(CLIENT_PACKAGE_NAME), 'the error names the missing package')
})

check('a 404 from the bundle fetch degrades to served=false and bytes=0', async () => {
  const ctx = createCtx({
    clientModules: {
      graph: () => [{ id: CLIENT_PACKAGE_NAME, rev: 'rev-1' }],
      async fetchBundle() {
        return new Response('not found', { status: 404 })
      },
    },
    webServer: { getOrigin: () => ORIGIN },
  })

  const status = await resolveClientStatus(ctx)
  assert.equal(status.available, true)
  assert.equal(status.composed, true)
  assert.equal(status.served, false, 'a 404 is not a served bundle')
  assert.equal(status.bytes, 0)
  assert.ok(typeof status.url === 'string' && status.url.length > 0, 'the bundle url is still reported')
  assert.ok(typeof status.error === 'string' && status.error.includes('404'), 'the error carries the status code')
})

check('a missing clientModules service degrades to available=false with an explanation', async () => {
  const ctx = createCtx({ webServer: { getOrigin: () => ORIGIN } })

  const status = await resolveClientStatus(ctx)
  assert.equal(status.available, false, 'without the service the client half cannot be checked')
  assert.equal(status.composed, false)
  assert.equal(status.served, false)
  assert.equal(status.bytes, 0)
  assert.equal(status.rev, null)
  assert.equal(status.url, null)
  assert.ok(typeof status.error === 'string' && status.error.length > 0, 'the error explains the missing service')
  assert.ok(status.error.includes('clientModules'), 'the error names the missing service')
})

check('the host services are probed without requiring them', async () => {
  const ctx = createCtx({ clientModules: { graph: () => [] } })
  await resolveClientStatus(ctx)
  assert.ok(ctx.probes.length > 0, 'the module probes the host')
  for (const probe of ctx.probes) {
    assert.equal(probe.required, false, `the probe of ${probe.name} must not be required`)
  }
  assert.ok(ctx.probes.some((probe) => probe.name === 'clientModules'))
})

check('a missing web server origin leaves the bundle url empty and explains why', async () => {
  const ctx = createCtx({
    clientModules: {
      graph: () => [{ id: CLIENT_PACKAGE_NAME, rev: 'rev-1' }],
      async fetchBundle() {
        throw new Error('the bundle must not be requested without an origin')
      },
    },
  })

  const status = await resolveClientStatus(ctx)
  assert.equal(status.composed, true)
  assert.equal(status.served, false)
  assert.equal(status.url, null)
  assert.equal(status.origin, null)
  assert.ok(typeof status.error === 'string' && status.error.includes('getOrigin'), 'the error names the missing origin')
})

check('a failing host is reported instead of thrown', async () => {
  const ctx = createCtx({
    clientModules: {
      graph() {
        throw new Error('the boot graph is unavailable')
      },
    },
  })

  const status = await resolveClientStatus(ctx)
  assert.equal(status.composed, false)
  assert.ok(typeof status.error === 'string' && status.error.includes('the boot graph is unavailable'))
})

check('the advertised url is used when the connection cannot authenticate one', async () => {
  const ctx = createCtx({
    clientModules: {
      graph: () => [{ id: CLIENT_PACKAGE_NAME, rev: 'rev-1' }],
      async fetchBundle() {
        return new Response('ok', { status: 200 })
      },
    },
    webServer: { getOrigin: () => ORIGIN },
    connection: {
      authenticatedUrl() {
        throw new Error('no connection')
      },
    },
    webApp: { getAdvertisedUrl: () => 'http://localhost:61083/web' },
  })

  const status = await resolveClientStatus(ctx)
  assert.equal(status.webUrl, 'http://localhost:61083/web')
})

/* ------------------------------------------------------------------ *
 * Runner                                                              *
 * ------------------------------------------------------------------ */

async function main() {
  let failures = 0
  for (const { name, fn } of checks) {
    try {
      await fn()
      console.log(`  PASS  ${name}`)
    } catch (error) {
      failures += 1
      console.log(`  FAIL  ${name}`)
      console.log(`        ${error?.stack ?? error}`)
    }
  }
  if (failures === 0) console.log('\nAll client-graph checks passed.')
  else console.log(`\n${failures} check(s) failed.`)
  process.exit(failures === 0 ? 0 : 1)
}

await main()
