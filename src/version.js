/**
 * The single version of this plugin.
 *
 * `package.json` is the release manifest, `src/store.js` writes the version into
 * every generated wiki, and the browser half compares its own constant with the
 * host version to detect a stale bundle. Keeping the number in one module (and
 * checking it in `scripts/check-version.mjs`) stops the three copies from
 * drifting apart.
 */
export const PLUGIN_VERSION = '0.12.0'
