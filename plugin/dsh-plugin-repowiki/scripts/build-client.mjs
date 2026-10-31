/**
 * Concatenate `client/*.js` into the single `client.js` the host serves.
 *
 * The plugin keeps its "no build step to install" promise: the generated
 * bundle is committed, and this script is only needed while developing the
 * browser half. Splitting the source keeps the panel maintainable without
 * introducing a bundler, a module loader or a dependency.
 *
 * Usage:
 *   node scripts/build-client.mjs          # regenerate client.js
 *   node scripts/build-client.mjs --check  # fail when client.js is stale
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const partsDir = join(root, 'client')
const outputPath = join(root, 'client.js')
const checkOnly = process.argv.includes('--check')

const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const parts = (await readdir(partsDir))
  .filter((name) => name.endsWith('.js'))
  .sort()

const chunks = []
for (const name of parts) {
  chunks.push(await readFile(join(partsDir, name), 'utf8'))
}
const banner = [
  '/**',
  ' * GENERATED FILE — edit `client/*.js` and run `node scripts/build-client.mjs`.',
  ` * Bundle: ${parts.length} parts, version ${manifest.version}.`,
  ' */',
  '',
].join('\n')
const source = `${banner}${chunks.join('\n').replaceAll('__REPOWIKI_VERSION__', manifest.version)}`

// Compile without executing: a syntax error must fail the build, not the panel.
try {
  // eslint-disable-next-line no-new-func
  new Function(source)
} catch (error) {
  console.error(`client bundle has a syntax error: ${error.message}`)
  process.exit(1)
}

if (checkOnly) {
  const current = await readFile(outputPath, 'utf8')
  // Git may check the file out with CRLF on Windows; only content matters.
  const normalize = (text) => text.replace(/\r\n/g, '\n')
  if (normalize(current) !== normalize(source)) {
    console.error('client.js is stale; run `node scripts/build-client.mjs`')
    process.exit(1)
  }
  console.log(`client.js is up to date (${parts.length} parts)`)
  process.exit(0)
}

await writeFile(outputPath, source)
console.log(`client.js rebuilt from ${parts.length} parts (${source.length} bytes)`)
