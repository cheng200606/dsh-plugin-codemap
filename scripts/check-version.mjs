/**
 * Check that the version number has one source of truth.
 *
 * The plugin version appears in three places that cannot share a module across
 * the host/browser boundary: `package.json` (the release manifest),
 * `src/version.js` (the host constant) and `client.js` (the browser constant,
 * which is compiled into the bundle). This script fails when they drift apart.
 *
 * Run with:  node scripts/check-version.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const versionSource = await readFile(join(root, 'src', 'version.js'), 'utf8')
const clientSource = await readFile(join(root, 'client.js'), 'utf8')

const hostVersion = /export const PLUGIN_VERSION = '([^']+)'/.exec(versionSource)?.[1]
const clientVersion = /const CLIENT_VERSION = '([^']+)'/.exec(clientSource)?.[1]

const versions = {
  'package.json': manifest.version,
  'src/version.js': hostVersion,
  'client.js': clientVersion,
}
const distinct = new Set(Object.values(versions))
console.log(versions)
if (!hostVersion || !clientVersion || distinct.size !== 1) {
  console.error('version mismatch:', versions)
  process.exit(1)
}
console.log(`version ok: ${manifest.version}`)
