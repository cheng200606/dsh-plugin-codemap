/**
 * Model-facing tools.
 *
 * The tools are registered with raw definitions (the harness only compiles the
 * author DSL for first-party tools, and `@deepseek-ai/dsh-tools` is not a
 * dependency of this bundle), so the parameter and output schemas below are
 * already in the enforced raw JSON Schema subset.
 *
 * Arguments are snake_case, matching the shipped harness tools.
 */

const SEARCH_LIMIT_DEFAULT = 8
const SEARCH_LIMIT_MAX = 20
const READ_CHAR_LIMIT = 12000

/** The model tools this plugin registers, in registration order. */
export const TOOL_NAMES = ['wiki_search', 'wiki_read', 'wiki_generate', 'wiki_status']

/**
 * Register the wiki tools on the tool registry.
 *
 * @param {object} ctx - plugin context.
 * @param {object} service - the repository wiki service.
 * @returns {Array<() => void>} disposers.
 */
export function registerTools(ctx, service) {
  const tools = ctx.tools
  if (!tools || typeof tools.register !== 'function') return []

  const disposers = []
  disposers.push(tools.register(searchTool(service)))
  disposers.push(tools.register(readTool(service)))
  disposers.push(tools.register(generateTool(service)))
  disposers.push(tools.register(statusTool(service)))
  return disposers
}

function requireString(args, key) {
  const value = args?.[key]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`invalid arguments: "${key}" must be a non-empty string`)
  }
  return value.trim()
}

function optionalInteger(args, key, fallback, max) {
  const value = args?.[key]
  if (value === undefined || value === null) return fallback
  if (!Number.isFinite(value)) throw new Error(`invalid arguments: "${key}" must be a number`)
  return Math.min(Math.max(Math.floor(value), 1), max)
}

function searchTool(service) {
  return {
    name: 'wiki_search',
    description:
      'Search the generated repository wiki and return matching pages with a short excerpt. Use it before reading a page when the page id is unknown. The wiki is derived from the source tree and every key claim carries a path:line citation.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keywords. Chinese queries are supported (CJK bigrams are indexed).',
        },
        limit: {
          type: 'integer',
          description: `Maximum number of pages to return (default ${SEARCH_LIMIT_DEFAULT}, max ${SEARCH_LIMIT_MAX}).`,
        },
      },
      required: ['query'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          hits: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                page_id: { type: 'string' },
                title: { type: 'string' },
                path: { type: 'string' },
                status: { type: 'string' },
                score: { type: 'number' },
                snippet: { type: 'string' },
              },
              required: ['page_id', 'title', 'path', 'status', 'score', 'snippet'],
            },
          },
          total: { type: 'integer' },
        },
        required: ['hits', 'total'],
      },
      render: (_args, value) => [
        { type: 'text', text: withJson(formatSearchHits(value.hits, value.total), value) },
      ],
    },
    async execute(args, exec) {
      const query = requireString(args, 'query')
      const limit = optionalInteger(args, 'limit', SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX)
      service.setActiveSession(exec?.agent?.id ?? null)
      const root = service.resolveRoot(exec?.agent)
      const hits = await service.search(root, query, { limit })
      return {
        hits: hits.map((hit) => ({
          page_id: String(hit.id ?? ''),
          title: String(hit.title ?? ''),
          path: String(hit.path ?? ''),
          status: String(hit.status ?? 'draft'),
          score: Number(hit.score ?? 0),
          snippet: String(hit.snippet ?? ''),
        })),
        total: hits.length,
      }
    },
  }
}

function readTool(service) {
  return {
    name: 'wiki_read',
    description:
      'Read one page of the generated repository wiki. Returns the page markdown including its frontmatter and the path:line citations of its key claims. Use wiki_search to find a page id first.',
    parameters: {
      type: 'object',
      properties: {
        page_id: {
          type: 'string',
          description:
            'Page identifier as reported by wiki_search (for example "architecture", "overview" or "flows"). The section form "10-architecture/architecture" is accepted as well; "index", "plan" and "card:<id>" address the landing page, the plan file and the knowledge cards.',
        },
      },
      required: ['page_id'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          page_id: { type: 'string' },
          title: { type: 'string' },
          path: { type: 'string' },
          status: { type: 'string' },
          markdown: { type: 'string' },
          truncated: { type: 'boolean' },
        },
        required: ['page_id', 'title', 'path', 'status', 'markdown', 'truncated'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: withJson(
            `page ${value.page_id} — ${value.title}\npath: ${value.path}\nstatus: ${value.status}${value.truncated ? '\n(markdown truncated)' : ''}\n\n${value.markdown}`,
            { page_id: value.page_id, title: value.title, path: value.path, status: value.status, truncated: value.truncated },
          ),
        },
      ],
    },
    async execute(args, exec) {
      const pageId = requireString(args, 'page_id')
      service.setActiveSession(exec?.agent?.id ?? null)
      const root = service.resolveRoot(exec?.agent)
      const page = await service.read(root, pageId)
      const truncated = page.markdown.length > READ_CHAR_LIMIT
      return {
        page_id: String(page.id ?? pageId),
        title: String(page.title ?? ''),
        path: String(page.path ?? ''),
        status: String(page.status ?? 'draft'),
        markdown: truncated ? page.markdown.slice(0, READ_CHAR_LIMIT) : page.markdown,
        truncated,
      }
    },
  }
}

function generateTool(service) {
  return {
    name: 'wiki_generate',
    description:
      'Build or refresh the repository wiki. "full" rescans the repository and regenerates every page; "update" only refreshes pages whose sources changed. The wiki is written under the repository (by default .dsh/repowiki) and every page is checked for valid path:line citations.',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['full', 'update'],
          description: 'Generation mode (default "full").',
        },
        language: {
          type: 'string',
          description: 'Language of the generated pages ("zh" or "en", default follows the plugin configuration).',
        },
        template: {
          type: 'string',
          description: 'Page template to use (default follows the plugin configuration).',
        },
        dry_run: {
          type: 'boolean',
          description: 'Only compute the page plan and report it, without writing any file.',
        },
      },
      required: [],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          run_id: { type: 'string' },
          mode: { type: 'string' },
          pages_written: { type: 'integer' },
          pages_skipped: { type: 'integer' },
          pages_failed: { type: 'integer' },
          citations_total: { type: 'integer' },
          citations_valid: { type: 'integer' },
          duration_ms: { type: 'integer' },
          warnings: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'run_id',
          'mode',
          'pages_written',
          'pages_skipped',
          'pages_failed',
          'citations_total',
          'citations_valid',
          'duration_ms',
          'warnings',
        ],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: withJson(
            [
              `run ${value.run_id} (${value.mode})`,
              `pages written=${value.pages_written} skipped=${value.pages_skipped} failed=${value.pages_failed}`,
              `citations valid=${value.citations_valid}/${value.citations_total}`,
              `duration ${value.duration_ms} ms`,
              ...value.warnings.map((warning) => `! ${warning}`),
            ].join('\n'),
            value,
          ),
        },
      ],
    },
    async execute(args, exec) {
      const mode = args?.mode === 'update' ? 'update' : 'full'
      service.setActiveSession(exec?.agent?.id ?? null)
      const root = service.resolveRoot(exec?.agent)
      const request = {
        root,
        mode,
        language: typeof args?.language === 'string' ? args.language : undefined,
        template: typeof args?.template === 'string' ? args.template : undefined,
        dryRun: args?.dry_run === true,
      }
      const result = mode === 'update'
        ? await service.update(request, exec?.signal)
        : await service.generate(request, exec?.signal)
      return {
        run_id: String(result.runId ?? ''),
        mode: String(result.mode ?? mode),
        pages_written: Number(result.pagesWritten ?? 0),
        pages_skipped: Number(result.pagesSkipped ?? 0),
        pages_failed: Number(result.pagesFailed ?? 0),
        citations_total: Number(result.citations?.total ?? 0),
        citations_valid: Number(result.citations?.valid ?? 0),
        duration_ms: Number(result.durationMs ?? 0),
        warnings: (result.warnings ?? []).map((warning) => String(warning)),
      }
    },
  }
}

function statusTool(service) {
  return {
    name: 'wiki_status',
    description:
      'Report the state of the repository wiki without generating anything: whether a wiki exists, how many pages it has, whether the last generation finished completely, and whether the browser sidebar entry is composed and served. Call it before wiki_generate to decide between full and update mode.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          root: { type: 'string' },
          exists: { type: 'boolean' },
          pages: { type: 'integer' },
          client: { type: 'object' },
          lastRun: { type: 'object' },
        },
        required: ['root', 'exists', 'pages', 'client', 'lastRun'],
      },
      render: (_args, value) => {
        const run = value.lastRun ?? {}
        const client = value.client ?? {}
        const lines = [
          `wiki root: ${value.root}`,
          `wiki exists: ${value.exists ? 'yes' : 'no'} · pages: ${value.pages}`,
          `last run: ${run.status ?? 'unknown'}${run.runId ? ` (runId=${run.runId})` : ''}`,
          `client entry: ${client.composed ? `composed, ${client.served ? `served ${client.bytes} B` : 'not served'}` : 'not observed'}${client.webUrl ? `\nweb: ${client.webUrl}` : ''}`,
        ]
        return [{ type: 'text', text: withJson(lines.join('\n'), value) }]
      },
    },
    async execute(args, exec) {
      service.setActiveSession(exec?.agent?.id ?? null)
      const root = service.resolveRoot(exec?.agent)
      const status = await service.status(root)
      const client = await service.clientStatus()
      return {
        root: String(status.root ?? root),
        exists: Boolean(status.exists),
        pages: Number(status.pages ?? 0),
        client,
        lastRun: status.run ?? {},
      }
    },
  }
}

function formatSearchHits(hits, total) {
  if (!hits || hits.length === 0) {
    return `No wiki page matched the query (total=${total ?? 0}).`
  }
  const header = `${hits.length} hit(s) (total=${total ?? hits.length}):`
  return [header, ...hits.map((hit) => `${hit.page_id} — ${hit.title} (${hit.path}, score=${hit.score})\n${hit.snippet}`)].join('\n\n')
}

/**
 * Append the machine readable payload to the rendered text.
 *
 * The harness only surfaces the rendered text of a tool result, so the JSON
 * block is what makes the declared output schema observable to the model.
 *
 * @param {string} summary - human readable summary.
 * @param {unknown} value - the tool output value.
 * @returns {string}
 */
function withJson(summary, value) {
  let payload
  try {
    payload = JSON.stringify(value, null, 2)
  } catch {
    payload = 'null'
  }
  return `${summary}\n\n\`\`\`json\n${payload}\n\`\`\``
}
