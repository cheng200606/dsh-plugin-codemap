# dsh-plugin-repowiki

面向 DeepSeek Harness 的**源码溯源型仓库知识层**：把一个代码仓库编译成结构化、可验证、可检索的 Wiki 页面，每条关键结论都带 `path:line` 引用。

- 插件形态：Cordis bundle（Host 半体 + Web 半体），零第三方依赖，仅使用 `node:*` 内置模块与相对导入。
- 运行形态：注册一个 `repoWiki` 服务 + 4 个模型工具 + 1 个斜杠命令 + 1 段系统提示词 + **左侧栏面板入口**（11 条数据 Fetch 路由 + 浏览器面板 + 自包含降级页）。
- 生成过程**完全确定性**：不调用模型，不执行仓库内脚本，引用由代码直接算出，因此离线可跑、结果可复现。

---

## 1. 功能范围

### 1.1 对外接口

| 接口 | 类型 | 说明 |
| --- | --- | --- |
| `ctx.repoWiki` | 服务 | 所有操作的唯一实现处；工具、命令、未来的 Web 面板都只是它的薄壳 |
| `wiki_generate` | 模型工具 | 扫描仓库 → 生成/刷新全部 Wiki 页面，并做引用校验 |
| `wiki_search` | 模型工具 | 在已生成的 Wiki 中做中英文混合检索，返回带片段的命中列表（语料含正文页 + 落地页 + 规划文件 + 知识卡） |
| `wiki_read` | 模型工具 | 读取某一页 Wiki 的完整 Markdown（含 frontmatter 与引用）；页 id 支持扁平形式（`architecture`）与分节形式（`10-architecture/architecture`），另有 `index` / `plan` / `card:<id>` 三个产物 id |
| `wiki_status` | 模型工具 | 报告 Wiki 状态：页面数、上次运行是否完整（`meta/run.json`）、客户端入口状态，不触发生成 |
| `/wiki` | 斜杠命令 | `status` / `plan` / `generate` / `update` / `export` / `import` / `help`；`status` 额外打印上次运行完整性与客户端入口（composed/served/rev + 可打开的鉴权 Web 地址） |
| `repowiki:policy` | 系统提示词段 | 一段前缀稳定（≤120 token）的文本，告诉模型**何时**用 Wiki 工具 |
| `GET/POST /api/repowiki/*` | 精确 Fetch 路由 | `panel` / `page?id=` / `search?q=` / `generate`，把服务方法暴露给浏览器面板；另有 `GET /api/repowiki/app` 返回**自包含降级页**（客户端半体不可用时的人工入口，也是脚本化验证的稳定靶点） |
| `GET /api/repowiki/progress` · `POST /api/repowiki/abort` · `POST /api/repowiki/export` | 精确 Fetch 路由 | 生成进度轮询（阶段/已完成/失败/当前页）、取消进行中的生成、导出到 `.qoder/repowiki`（导出前自动备份） |
| `POST /api/repowiki/import` | 精确 Fetch 路由 | 从 `.qoder/repowiki` 或 DSH JSON 包导入；导入前 `backupOutput()` 写时间戳备份 |
| `GET /api/repowiki/source` | 精确 Fetch 路由 | 读取 `path:line` 引用背后的源码片段：仅仓库相对路径、root 内、拒绝敏感文件、300 KB 上限 |
| `GET /api/repowiki/graph` · `GET /api/repowiki/impact` | 精确 Fetch 路由 | 模块/文件级知识图谱（带 `signature/generatedAt/sourceHead`，支持 `signatureOnly=1` 轻量新鲜度探测）与模块上下游影响集 |
| 侧栏图标 + 主面板 | 客户端槽位 | `sidebar.panellist`（id=`repowiki`，order=50）+ `main`（key=`repowiki`）；详见 [面板与竞品分析](../../docs/repowiki-panel-and-competitive-analysis.md) |

### 1.2 服务方法

```ts
class RepoWikiService {
  resolveRoot(agent?)            // 会话工作目录 → 默认目录 → process.cwd()
  status(root)                   // 页面数 / 新鲜 / 过期 / 待复核 / 分支 / HEAD
  plan(root, options?)           // 计算或读取 wiki_plan.yaml，并校验
  generate(request, signal)      // 全量生成
  update(request, signal)        // 增量刷新（只重写输入哈希变化的页面）
  search(root, query, options?)  // 检索
  read(root, pageId, options?)   // 读取单页
  impact(root, changes)          // 受影响页面；支持 path:line / 符号级
  buildGraph(root, options?)     // 模块/文件级图谱 + signature/generatedAt
  graphSignature(root)           // 轻量新鲜度指纹（不重建索引）
  impactGraph(root, moduleDir)   // 模块上下游（BFS）
  readSourceSnippet(root, path, options?) // 引用背后的源码片段（root 内、拒绝敏感文件）
  availableLanguages(root)       // 磁盘上已生成的语言
  backupOutput(root)             // 导出/导入前的时间戳备份
  exportWiki(root, target)       // 导出到 .qoder/repowiki 或 JSON 包
  importWiki(root, source)       // 从导出目录导入
}
```

### 1.3 流水线（S0–S6）

| 阶段 | 是否调用模型 | 产物 |
| --- | --- | --- |
| S0 Preflight | 否 | 仓库根目录、Git 分支/HEAD（直接读 `.git/`，**不执行 git 进程**） |
| S1 Index | 否 | 文件清单、语言分布、模块/符号/路由/配置键/依赖/脚本索引 |
| S2 Plan | 否 | `wiki_plan.yaml`（人可手改；手改版本优先，源码映射始终由推导结果回填；旧计划自动补齐模块详情页） |
| S3 Evidence | 否 | 每页一个 `EvidencePack`：`claims[{claim, citations, confidence}]` + `fileDigests` + **叙述层 v2**（符号 JSDoc / 导入 / 被引用 / 路由 / 配置键） |
| S4 Write | 否 | 按 EvidencePack 渲染页面（frontmatter + 七个固定小节，叙述段为空时省略） |
| S5 Verify | 否 | 逐条核对 `path:line`：文件存在且行号在范围内 |
| S6 Persist | 否 | 原子写入页面、`meta/*.json`、`wiki_plan.yaml`、知识卡 |

### 1.4 产物目录

```
<repo>/.dsh/repowiki/
├── wiki_plan.yaml            # 人可编辑的页面规划
├── meta/
│   ├── repowiki.json         # 全量元数据（设计文档 §5.9.2）
│   ├── index.json            # 检索用轻量索引
│   ├── version.json          # 生成器与运行时簿记
│   └── runtime.json          # 本次运行的能力回执（服务/工具/命令/提示词段 + 生效配置）
├── content/<lang>/
│   ├── index.md              # 落地页，链接全部页面
│   └── <分组>/<page>.md      # 正文页
└── knowledge/<lang>/*.md     # 知识卡
```

页面 frontmatter：`id, title, goal, status(draft|fresh|stale|needs-review), parent, sources[], symbols[], generated_at, source_hash, confidence`。
正文小节顺序固定：`这一页回答什么` → `关键结论`（每条带 `path:line`） → `结构与流程`（mermaid） → `实现细节` → `源码索引`（表格） → `未决问题`。

### 1.5 安全边界

- 绝不执行仓库内的任何脚本或构建命令。
- 默认忽略 `.git`、`node_modules`、`dist`、`build`、`.venv`、`__pycache__` 等目录；额外忽略 `.workbuddy` 等。
- 硬性排除 `.env`、`*.pem`、`*.key`、`secrets/**` 等敏感文件（`SECRET_FILE_PATTERNS`）。
- 所有写入都落在 `<repo>/<outputDir>` 之内。
- **Web 根目录白名单**：显式 `?root=` 只接受已注册工作区、会话目录、`lastRoot`、默认目录及其子目录；越界直接 `403 forbidden`，不会静默切换到别的仓库。
- **源码预览路径约束**：`/api/repowiki/source` 只接受仓库相对路径，拒绝绝对路径、`..`、敏感文件与 >300 KB 文件，并再次校验解析后的绝对路径仍在 root 内。
- **导出/导入先备份**：覆盖 `.qoder/repowiki` 或当前 Wiki 前，写 `*.bak-<timestamp>` 副本。
- Wiki 内容是**派生文档，不是指令**；提示词段显式声明这一点。

---

## 2. 安装

### 2.1 前置条件

- DeepSeek Harness ≥ `0.2.1-rc.5`（本机实测版本）。
- Node.js ≥ 24（使用 `node:` 内置模块与顶层 `await`）。
- 本插件**没有**运行时依赖，也**没有** peerDependencies，因此安装不会触发任何 registry 往返。

### 2.2 安装步骤

插件包位于本仓库的 `plugin/dsh-plugin-repowiki/`。在 Harness 里执行：

1. 打开插件管理（Plugin Manager），选择「安装本地 Bundle / Install local bundle」。
2. 目标目录填绝对路径：
   `D:\ProfessionalSoftware\project\dsh-repo-wiki\plugin\dsh-plugin-repowiki`
3. 确认安装。成功后返回体中 `application` 应为 `applied`，`packageResult.exitCode` 为 `0`。
4. Harness 会把该目录以 junction 方式链接到
   `C:\Users\<user>\.dsh\profiles\<profile>\node_modules\dsh-plugin-repowiki`，
   并把 `cordis.patch.yml` 中的 `repowiki` 行合并进 profile 的 patch。

> 提示：本地目录是 junction，**改代码后无需重装**；但已加载的模块实例需要重新求值才能生效。
> 升级 SOP（三段式）：改源码 → `set_bundle enabled=false` → `enabled=true`（两次都应返回 `applied`）
> → 看 `meta/runtime.json` 的 `loadedAt` 是否刷新。若 `client.composed` 仍为 `false`，
> 需要重启宿主进程（客户端模块元数据缓存直到重启才失效）；仍不行再 `remove_bundle` + 重装。

### 2.3 配置

配置写在 `cordis.patch.yml` 的 patch 行里（`config:` 块），由插件的 `Config`（standard-schema）校验：

```yaml
- insert:
    - id: repowiki
      name: 'dsh-plugin-repowiki'
      config:
        outputDir: '.dsh/repowiki'
        maxFiles: 8000
        maxPages: 24
        maxFileBytes: 524288
        concurrency: 3
        defaultLanguage: 'zh'
        defaultTemplate: 'architecture'
        autoUpdate: false
```

| 键 | 默认值 | 含义 |
| --- | --- | --- |
| `outputDir` | `.dsh/repowiki` | 产物目录（相对仓库根） |
| `maxFiles` | `8000` | 单次扫描的文件上限 |
| `maxPages` | `24` | 页面数上限 |
| `maxFileBytes` | `524288` | 单文件读取上限（512 KiB） |
| `concurrency` | `3` | 预留：多 Agent 写入并发度（P1） |
| `defaultLanguage` | `zh` | 默认语言（`zh` / `en`） |
| `defaultTemplate` | `architecture` | 默认页面模板 |
| `autoUpdate` | `false` | 会话开始时自动刷新过期页（P1） |
| `citationThreshold` | `0.95` | 页面标记 fresh 所需的最低引用有效率 |
| `maxSearchPages` | `40` | 检索语料读取的页面上限 |
| `cacheTtlMs` | `5000` | 扫描/索引/语料缓存的复用时长（毫秒） |
| `maxConcurrentReads` | `3` | 建索引时并行读文件的池大小（上限 8） |
| `clientBundleCheck` | `true` | 是否在回执中探测客户端半体的入图与取包状态 |
| `panelFallbackPage` | `true` | 是否注册独立降级页 `/api/repowiki/app` |

未在 `config:` 中写出的键使用上表默认值；越界的数值会被夹取到合法区间而不是直接报错。

### 2.4 使用

```text
/wiki status          # 看当前 Wiki 状态
/wiki plan            # 看页面规划（不写文件）
/wiki generate        # 全量生成
/wiki update          # 增量刷新
/wiki export qoder    # 导出到 .qoder/repowiki（Qoder 互操作）
/wiki import qoder    # 从 .qoder/repowiki 导入
```

模型侧：让模型调用 `wiki_generate` / `wiki_search` / `wiki_read` 即可；
`repowiki:policy` 提示词段会自动告诉模型这些工具的存在与使用时机。

**图谱视图交互（v0.10）**：侧栏面板顶部「图谱」Tab 进入工程知识图谱。

| 操作 | 行为 |
|---|---|
| 鼠标左键拖动（空白处或节点上） | 平移画布；3px 内视为点击，不误取消选中 |
| 滚轮 | 以光标为锚点缩放 |
| 双击画布 | 适配内容（fit） |
| 方向键 | 平移；`+` / `-` 缩放；`0` 重置 |
| 点击节点 / `Enter` / `Space` | 选中节点并高亮上/下游影响，打开 inspector |
| 双击 / 「适配画布」按钮 | 重置视图 |
| 「刷新」按钮 | 重新拉取图谱（源码变化但未重生成时可用） |

---

## 3. 目录结构

```
plugin/dsh-plugin-repowiki/
├── index.js              # 插件入口：apply(ctx, config)、默认导出、Config
├── client.js             # 生成产物（勿直接改；改 client/ 后 npm run build）
├── client/               # 浏览器半体源码，共 10 段，按文件名排序拼接
│   ├── 00-preamble.js    # ModuleLoader / factory / 共享常量
│   ├── 10-locale.js      # zh/en 词典与翻译
│   ├── 20-helpers.js     # token、引用解析、面板缓存、最近访问、高亮
│   ├── 30-styles.js      # 注入式样式表（含响应式/抽屉/源码抽屉）
│   ├── 40-components.js  # 状态点、按钮、Chip、Glyph、CopyButton
│   ├── 45-graph.js       # 分层布局与连线走线
│   ├── 50-markdown.js    # InlineText / MarkdownBlock
│   ├── 60-request.js     # JSON 请求、错误归一化、abort
│   ├── 70-panel.js       # 面板状态机、视图、交互
│   └── 90-apply.js       # 槽位注册与卸载
├── scripts/
│   ├── build-client.mjs  # 零依赖拼接 + 版本注入 + 语法校验 + --check
│   └── check-version.mjs # package.json / version.js / client.js 三处一致
├── cordis.patch.yml      # patch 行 + 默认配置
├── package.json          # bundle 清单（零依赖；build/check 脚本）
├── locale/{en,zh}.json   # 插件管理器里显示的标题与描述
├── icon.svg              # 插件图标
├── src/
│   ├── util.js           # 哈希、路径、slug 等纯函数
│   ├── yaml.js           # 最小 YAML 读写（受限子集）
│   ├── fs-adapter.js     # ctx.fs 适配层（读/列/写/存在性 + 变更戳透传）
│   ├── config.js         # 默认配置、归一化、standard-schema
│   ├── version.js        # 版本单一来源
│   ├── store.js          # 目录布局与元数据读写
│   ├── scan.js           # S1 仓库扫描、忽略规则、敏感文件排除、变更签名
│   ├── indexer.js        # S1 轻量索引：模块/符号/路由/配置键/依赖/脚本（并发读）
│   ├── plan.js           # S2 规划推导、模块详情页、YAML 序列化与校验
│   ├── evidence.js       # S3 EvidencePack + 叙述层 v2
│   ├── render.js         # S4 页面/索引页/知识卡渲染
│   ├── verify.js         # S5 引用校验
│   ├── search.js         # 中英文混合检索与打分
│   ├── service.js        # RepoWikiService：业务逻辑、信任根、源码片段、备份、图谱签名
│   ├── tools.js          # 四个模型工具（search/read/generate/status）
│   ├── command.js        # /wiki 命令
│   ├── prompt.js         # repowiki:policy 提示词段
│   ├── schema.js         # 原生 Schemastery 协议节点
│   ├── markdown.js       # 受限 Markdown 解析
│   ├── panel.js          # 面板 DTO / 单页 DTO（含 serverVersion、语言列表、页面 files）
│   ├── panel-page.js     # 自包含降级页 HTML（/api/repowiki/app）
│   ├── client-graph.js   # 客户端半体自检：入图/取包/鉴权地址
│   ├── errors.js         # 统一错误体 {code, message, hint}
│   └── routes.js         # 11 条数据 Fetch 路由 + 降级页
└── test/
    ├── local-e2e.mjs     # 服务端端到端（35 项）
    ├── client-graph.mjs  # 客户端自检（12 项）
    ├── ui-e2e.mjs        # Playwright 浏览器回归（18 项；无 URL 跳过）
    ├── probe-coverage.mjs # 覆盖率探针
    └── debug-export.mjs  # 调试脚本
```

## 4. 自测

```bash
cd plugin/dsh-plugin-repowiki
npm run build                    # 重新生成 client.js（改 client/ 后必跑）
npm run check                    # 构建 + 版本一致 + client-graph 12 项 + e2e 35 项
node test/probe-coverage.mjs .   # 覆盖率探针（可选）

# 浏览器回归（可选，需 Playwright 与运行中的 DSH Web）
DSH_WEB_URL="http://127.0.0.1:3081/?token=..." node test/ui-e2e.mjs
```

`test/local-e2e.mjs` 额外断言：叙事段与 JSDoc 引用、`path:line` 符号级 impact、
图谱签名随源码变化、信任根越界拒绝、源码片段路径约束、卡片 scope、
面板缓存键、引用抽屉、图谱拖拽、节点→Wiki 联动、导入确认、缺失语言横幅、窄屏抽屉。

---

## 5. 与设计文档的差异

| 设计文档（§5.5） | 本实现 | 原因 |
| --- | --- | --- |
| TypeScript + `lib/` 产物 | 纯 ESM JavaScript，源码即产物 | profile 内无 `tsc`；零构建步骤才能做到「安装即用」 |
| peerDependencies 精确锁版本 | 无 peerDependencies，也不声明 `engines.dsh` | 实机校验规则：`engines.dsh` 一旦存在就是唯一校验项；`@deepseek-ai/cordis` 永不参与范围校验；未安装的 peer 不算错误。插件本身也不 import 它 |
| 调用模型生成正文 | 确定性生成 + 叙述层 v2（索引事实与 JSDoc） | 离线可跑、引用可复算；可选模型叙述层保留为后续路线 |
| 8–12 页 | 7 页起（按仓库结构增减；显著模块自动加详情页，上限 24） | 路由/配置/数据页是条件页，仓库没有对应文件时不生成 |
| `dsh` 版本 `0.2.2-alpha.2` | 实测 `0.2.1-rc.5` | 设计文档写于更早的版本假设，见交付报告的勘误项 |

---

## 6. 左侧栏入口与 Web 面板

| 层 | 载体 | 说明 |
| --- | --- | --- |
| 侧栏图标 | `sidebar.panellist`（list, root） | `{ id: 'repowiki', order: 50, label: () => t('panel') }`；折叠态提供 tooltip 与无障碍名 |
| 主面板 | `main`（keyed, root，key=`repowiki`） | 点图标后中央区域切换为仓库 Wiki 面板 |
| 数据桥 | 11 条数据 Fetch 路由 + 降级页 | `panel`、`page?id=`、`search?q=`、`generate`、`progress`、`abort`、`export`、`import`、`source`、`graph`、`impact`，以及 `GET /api/repowiki/app`（自包含降级页） |

交互：左树按目录分节列出页面（带状态徽标）→ 点击后右区渲染 Markdown；顶部搜索框走 search 路由（200 ms 防抖 + `AbortController`，支持 fresh/stale 过滤与关键词高亮）；右上按钮为「增量更新」与「生成」（窄屏收进「更多」菜单）；正文 `path:line` 引用可点击打开源码抽屉；面板使用 `sessionStorage` 做 stale-while-revalidate，先渲染缓存再后台刷新；非就绪态显示 idle/loading/empty/error 四态之一，错误态直接展示 `code/message/hint`。

> **仓库根解析**：Web 路由拿不到会话上下文，因此 `resolveRequestRoot(hint)` 按「显式 `?root=` → 上次解析过的 root → 活跃会话目录 → 其他会话目录 → 工作区注册表 → `workingDirectory.defaultDirectory` → `cwd`」挑**第一个已经含 wiki 的**候选；显式 `?root=` 还必须落在信任白名单（工作区/会话/lastRoot/默认目录及其子目录）内，越界返回 `403 forbidden`。面板把候选列表放在 `roots[]` 里，头部下拉可手动切换工作区（选项来自宿主 `workspaceRegistry`）。
> **只读路由必须声明 `requestBody: 'buffered'`**：宿主 `connection.bridge()` 对 `'none'` 会走流式分支并对 GET 构造带 body 的 `Request`，触发 `TypeError: Request with GET/HEAD method cannot have body`，最终表现为空 400。

> ⚠️ **已装插件新增或改动 Web 半体后需要「刷新 bundle + 必要时重启进程」**：先 `plugin_manager action=set_bundle target=dsh-plugin-repowiki enabled=false` 再 `enabled=true`（两次都应 `application:"applied"`）；若 `client.composed` 仍为 `false`，说明宿主启动时缓存了包元数据（`dsh-client-modules` 的 `pkgMeta` 无失效机制），必须重启 Harness 进程。
> 入口状态**可自证**：`meta/runtime.json` 的 `client` 段（`composed`/`served`/`rev`/`bytes`/`webUrl`）由 `src/client-graph.js` 经宿主 `clientModules.graph()` 与 `fetchBundle()` 实测得出；`/wiki status` 会打印同一结论与可打开的鉴权 Web 地址。客户端半体不可用时，打开鉴权地址下的 `/api/repowiki/app` 即可使用最小版面板。
> 根因修复（v0.5）：面板 404 的真因是插件 apply 时 connection 服务尚未就绪而旧代码静默跳过路由注册——现已改为 `ctx.inject(['connection'], …)` 声明式等待，宿主在 connection 出现的第一时间注册全部路由。
> 实机验证（2026-10-31，DSH 0.2.1-rc.5 / Web 61083）：`composed:true, served:true, bytes:42456`；Playwright 点开侧栏「仓库 Wiki」→ 面板渲染 `页面 8 / 引用 122/28 / fresh 8`，左树 5 分区 + 知识卡片，正文带 `path:line` 引用；截图见交付报告 §9.5。
