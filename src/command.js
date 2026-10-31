/**
 * The `/codemap` command.
 *
 * The command is a thin shell around the service: every operation is
 * implemented once in `CodeMapService` and the command only formats the
 * result for the transcript.
 */

const SUBCOMMANDS = ['status', 'plan', 'generate', 'update', 'export', 'import', 'help']

/**
 * Register the `/codemap` command on the commands registry.
 *
 * @param {object} ctx - plugin context.
 * @param {object} service - the repository code-map service.
 * @returns {Array<() => void>} disposers.
 */
export function registerCommand(ctx, service) {
  const commands = ctx.get('commands')
  if (!commands || typeof commands.register !== 'function') return []

  const dispose = commands.register({
    name: 'codemap',
    description: 'Repository code map: status, plan, generate, update, export or import source-grounded pages.',
    input: { hint: '<status|plan|generate|update|export|import> [language]' },
    async handler(invocation) {
      const { agent, rawInput, signal } = invocation
      service.setActiveSession(agent?.id ?? null)
      const tokens = String(rawInput ?? '').trim().split(/\s+/).filter(Boolean)
      const subcommand = (tokens[0] ?? 'status').toLowerCase()
      const argument = tokens[1]

      try {
        if (!SUBCOMMANDS.includes(subcommand)) {
          return {
            kind: 'error',
            text: `未知子命令 "${subcommand}"。可用子命令：${SUBCOMMANDS.join(' / ')}`,
          }
        }
        const root = service.resolveRoot(agent)
        switch (subcommand) {
          case 'help':
            return { kind: 'success', text: helpText() }
          case 'status':
            return { kind: 'success', text: await statusText(service, root) }
          case 'plan':
            return { kind: 'success', text: await planText(service, root, { template: argument }) }
          case 'generate':
            return { kind: 'success', text: await generateText(service, root, argument, signal) }
          case 'update':
            return { kind: 'success', text: await updateText(service, root, argument, signal) }
          case 'export':
            return { kind: 'success', text: await exportText(service, root, argument) }
          case 'import':
            return { kind: 'success', text: await importText(service, root, argument) }
          default:
            return { kind: 'error', text: `未知子命令 "${subcommand}"` }
        }
      } catch (error) {
        return { kind: 'error', text: `命令执行失败：${error instanceof Error ? error.message : String(error)}` }
      }
    },
  })
  return [dispose]
}

function helpText() {
  return [
    '代码地图 命令：',
    '- `/codemap status` — 查看当前 Wiki 状态（页面数、更新时间、过期页）',
    '- `/codemap plan [template]` — 生成/查看页面规划（不写文件）',
    '- `/codemap generate [language]` — 扫描仓库并生成 Wiki 页面',
    '- `/codemap update [language]` — 增量刷新变化的页面',
    '- `/codemap export [dsh|qoder]` — 导出 Wiki（qoder 写入 .qoder/codemap）',
    '- `/codemap import [dsh|qoder]` — 从导出目录导入 Wiki',
  ].join('\n')
}

async function statusText(service, root) {
  const status = await service.status(root)
  const lines = [
    `仓库根目录：${status.root}`,
    `输出目录：${status.outputDir ?? '(默认)'}　分支：${status.branch ?? '(无 git)'}　HEAD：${(status.head ?? '').slice(0, 10) || '(无)'}`,
    `页面：${status.pages}（新鲜 ${status.fresh} / 过期 ${status.stale} / 待复核 ${status.failed}）　知识卡：${status.cards}`,
    `最近生成：${status.lastGeneratedAt ?? '(尚未生成)'}　生成器版本：${status.generatorVersion}`,
  ]
  const run = status.run
  if (run && run.status) {
    lines.push(
      `上次运行：${run.status === 'done' ? '完整结束' : run.status === 'failed' ? '失败' : run.status === 'running' ? '进行中' : run.status}（runId=${run.runId ?? '?'}${run.finishedAt ? `，结束于 ${run.finishedAt}` : ''}）`,
    )
  } else {
    lines.push('上次运行：无记录')
  }
  const client = await service.clientStatus()
  if (client.composed) {
    lines.push(
      `客户端入口：已进入启动图，${client.served ? `可取包（${client.bytes} bytes）` : '取包失败'}，rev=${client.rev ?? '-'}`,
    )
  } else if (client.error) {
    lines.push(`客户端入口：未就绪（${client.error}）`)
  } else {
    lines.push('客户端入口：未探测到')
  }
  if (client.webUrl) lines.push(`Web 地址：${client.webUrl}`)
  if (!status.exists) lines.push('提示：还没有生成过 Wiki，运行 `/codemap generate` 开始。')
  return lines.join('\n')
}

async function planText(service, root, options) {
  const result = await service.plan(root, options)
  const validation = result.validation ?? { ok: true, errors: [], warnings: [] }
  const lines = [`页面规划（来源：${result.source === 'file' ? '仓库内 codemap_plan.yaml' : '自动推导'}）`]
  for (const document of result.plan?.codemap?.documents ?? []) {
    lines.push(`- ${document.id}　${document.title}　→ ${document.path ?? '(未指定)'}`)
  }
  lines.push(`共 ${result.plan?.codemap?.documents?.length ?? 0} 页；校验：${validation.ok ? '通过' : '未通过'}`)
  for (const error of validation.errors ?? []) lines.push(`  ✗ ${error}`)
  for (const warning of validation.warnings ?? []) lines.push(`  ! ${warning}`)
  return lines.join('\n')
}

async function generateText(service, root, language, signal) {
  const result = await service.generate({ root, language, mode: 'full' }, signal)
  return [
    `生成完成：写入 ${result.pagesWritten} 页，跳过 ${result.pagesSkipped} 页，失败 ${result.pagesFailed} 页。`,
    `引用校验：${result.citations.valid}/${result.citations.total} 有效；耗时 ${result.durationMs} ms。`,
    ...(result.warnings ?? []).map((warning) => `  ! ${warning}`),
  ].join('\n')
}

async function updateText(service, root, language, signal) {
  const result = await service.update({ root, language, mode: 'update' }, signal)
  return [
    `增量更新完成：刷新 ${result.pagesWritten} 页，未变化 ${result.pagesSkipped} 页，失败 ${result.pagesFailed} 页。`,
    `引用校验：${result.citations.valid}/${result.citations.total} 有效；耗时 ${result.durationMs} ms。`,
    ...(result.warnings ?? []).map((warning) => `  ! ${warning}`),
  ].join('\n')
}

async function exportText(service, root, target) {
  const result = await service.exportWiki(root, target ?? 'qoder')
  const count = Array.isArray(result.files) ? result.files.length : Number(result.files ?? 0)
  return `已导出 ${count} 个文件到 ${result.path}`
}

async function importText(service, root, source) {
  const result = await service.importWiki(root, source ?? 'qoder')
  return `已导入 ${result.pages} 个页面`
}
