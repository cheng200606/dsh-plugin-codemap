/**
 * Plugin configuration.
 *
 * The configuration is delivered by the Cordis patch row (`config:` in
 * `cordis.patch.yml`). It is described by a native schema graph, so the
 * harness configuration editor can render every option with its type, default
 * and description, while the Cordis loader still validates the row with the
 * standard-schema protocol before the plugin starts.
 */
import { boolean, constant, number, object, string, union, validateNode } from './schema.js'

/**
 * The configuration schema.
 *
 * Every option carries a default and a description; numeric bounds clamp the
 * value instead of rejecting it, so an out-of-range patch row still loads.
 */
export const Config = object(
  {
    outputDir: string({
      description: 'Where the code map is written, relative to the repository root.',
      default: '.dsh/codemap',
      min: 1,
      trim: true,
      normalize: (value) => value.replace(/\\/g, '/'),
    }),
    maxFiles: number({
      description: 'Upper bound of files inspected during a scan.',
      default: 8000,
      min: 1,
      max: 200000,
      integer: true,
      step: 1,
    }),
    maxPages: number({
      description: 'Upper bound of generated pages.',
      default: 24,
      min: 1,
      max: 200,
      integer: true,
      step: 1,
    }),
    maxFileBytes: number({
      description: 'Files larger than this are skipped during a scan.',
      default: 524288,
      min: 1024,
      max: 64 * 1024 * 1024,
      integer: true,
      step: 1,
    }),
    concurrency: number({
      description: 'Reserved for the multi-agent writer (P1).',
      default: 3,
      min: 1,
      max: 16,
      integer: true,
      step: 1,
    }),
    defaultLanguage: union([constant('zh'), constant('en')], {
      description: 'Default language of the generated pages.',
      default: 'zh',
    }),
    defaultTemplate: string({
      description: 'Default page template.',
      default: 'architecture',
      min: 1,
      trim: true,
    }),
    autoUpdate: boolean({
      description: 'Refresh stale pages automatically when the session starts.',
      default: false,
    }),
    citationThreshold: number({
      description: 'Minimum ratio of valid citations for a page to be marked fresh.',
      default: 0.95,
      min: 0,
      max: 1,
    }),
    maxSearchPages: number({
      description: 'Upper bound of pages read for a full-text search.',
      default: 40,
      min: 1,
      max: 500,
      integer: true,
      step: 1,
    }),
    cacheTtlMs: number({
      description: 'How long a scan or index result stays reusable, in milliseconds.',
      default: 5000,
      min: 0,
      max: 600000,
      integer: true,
      step: 1,
    }),
    maxConcurrentReads: number({
      description: 'Upper bound of files read in parallel while indexing.',
      default: 3,
      min: 1,
      max: 8,
      integer: true,
      step: 1,
    }),
    clientBundleCheck: boolean({
      description: 'Check whether the client bundle is composed and served.',
      default: true,
    }),
    panelFallbackPage: boolean({
      description: 'Fall back to the landing page when a panel page is missing.',
      default: true,
    }),
  },
  {
    description: 'dsh-plugin-codemap configuration.',
    default: {},
  },
)

/** The default value of every option, derived from the schema. */
export const DEFAULT_CONFIG = Object.fromEntries(
  Object.entries(Config.dict).map(([key, child]) => [key, child.meta.default]),
)

/**
 * Normalise a raw configuration object into the effective configuration.
 *
 * The loader already validates and normalises the patch row, so this is the
 * lenient safety net used by the local tests: an unusable value falls back to
 * its default instead of breaking the plugin.
 *
 * @param {object} raw - The raw configuration.
 * @returns {object} The effective configuration.
 */
export function normalizeConfig(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const config = { ...DEFAULT_CONFIG }
  for (const [key, child] of Object.entries(Config.dict)) {
    const provided = Object.hasOwn(source, key) ? source[key] : undefined
    const candidate = provided === undefined ? child.meta.default : provided
    if (candidate === undefined) continue
    const validated = validateNode(child, candidate)
    if (validated.issues) continue
    config[key] = validated.value
  }
  return config
}
