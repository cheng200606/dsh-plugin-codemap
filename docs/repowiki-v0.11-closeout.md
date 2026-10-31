# RepoWiki v0.11：P0/P1/P2 问题修复与验收

> 日期：2026-10-31 ｜ 版本：0.10.0 → **0.11.0** ｜ 范围：`plugin/dsh-plugin-repowiki`
> 基线：Git `b1c3417`（改动前完整快照，可逐项回滚）
> 口径：每项均给出「问题 → 改动 → 验证」；未实施项单独列出并说明原因，不冒充已完成。

---

## 0. 一页纸结论

| 级别 | 总数 | 已修复 | 部分修复 | 未实施 |
|---|---:|---:|---:|---:|
| P0 | 4 | 4 | 0 | 0 |
| P1 | 12 | 11 | 1 | 0 |
| P2 | 9 | 7 | 1 | 1 |

**验证结果**

| 检查 | 结果 |
|---|---|
| `npm run check`（构建 + 版本 + 客户端自检 + 端到端） | 全绿 |
| `test/local-e2e.mjs` | **35 项通过** |
| `test/client-graph.mjs` | **12 项通过** |
| `test/ui-e2e.mjs`（真实 DSH Web + Playwright） | **18 项通过** |
| 控制台 / pageerror | 0 |
| 版本一致性 | `package.json` / `src/version.js` / `client.js` 均为 0.11.0 |

**一句话**：P0 的版本控制、root 信任边界与正文表达力已补齐；P1 的缓存、引用跳转、符号级影响、卡片分类、导入 UI、语言提示、大图裁剪、无障碍与 UI 回归全部落地；P2 完成阅读/响应式/联动 polish，仅“可选 minify”按取舍未采用。

---

## 1. P0：下一轮之前必须解决

| ID | 问题与影响 | 本次改动 | 验证 |
|---|---|---|---|
| **E1** | 项目不是 Git 仓库，3 600+ 行客户端无基线，改坏无法回滚 | `git init`；新增 `.gitignore`（忽略 `.dsh/`、`.qoder/`、`node_modules/`、日志、测试截图）；提交基线 `b1c3417` | `git log --oneline` 可见基线；`git status` 可逐项对照 |
| **S1** | `resolveRequestRoot()` 对显式 `?root=` 只校验“目录存在”，任意本机目录可被面板读写 | 新增 `trustedRoots()` / `isTrustedRoot()`：仅接受工作区、会话、`lastRoot`、默认目录及其子目录；越界显式 root 抛 `forbidden`（HTTP 403），不再静默切换到别的仓库；路由错误码新增 `forbidden` | e2e「an explicit root outside the trust boundary is rejected」；真实面板根目录仍正常解析 |
| **F1** | 确定性模板写不出设计意图；新功能词搜不到（`面板` 原 0 命中） | ① 计划阶段为显著模块生成 `module-*` 详情页（按符号数/入度/入口名排序取文件，非字母序）；② 证据层新增 **叙述层 v2**：从符号 JSDoc、导入/被引用、路由、配置键生成带 `path:line` 的句子；③ 路径词双语表（panel→面板、route→路由…）提升中文检索；④ 存储计划自动合并模块页，旧仓库无需删 `wiki_plan.yaml` | `wiki_search("面板")` 由 **0 → 2 命中**（architecture、modules）；模块页 2 个（`src`、`client`）；e2e「the narrative layer explains files from indexed facts」 |
| **U1** | 图谱没有“数据可能过期”提示，源码变了仍显示旧图 | `/graph` 返回 `signature` / `generatedAt` / `sourceHead`；客户端保存签名，每 20s 用 `?signatureOnly=1` 轻量比对，不一致显示「数据可能过期」徽标，点击即重建 | e2e「the graph signature changes when the source tree changes」；UI 回归覆盖图谱加载与拖拽 |

---

## 2. P1：高价值，1–2 个迭代内完成

| ID | 问题与影响 | 本次改动 | 验证 |
|---|---|---|---|
| **F2** | 客户端 `graphData` 无 TTL，反复进出图谱不刷新 | 30s TTL；进入图谱超时自动刷新；生成成功重置 `graphFetchedAt/signature/stale` | UI 回归打开图谱、拖拽、节点选择均通过 |
| **F3** | 每次进面板都请求 `/panel`，慢仓库首屏空白 | `sessionStorage` 以 `root+language` 为键缓存；先渲染缓存再后台 revalidate；生成/导入后清空缓存 | UI 检查 `repowiki:panel:auto:zh` 存在；首屏不再等待网络 |
| **F4** | `path:line` 只能复制，不能看源码，文档到代码的闭环断了 | 新增 `GET /api/repowiki/source`：仅接受仓库相对路径、root 内、拒绝敏感文件、限制 300KB；客户端点击引用打开右侧源码抽屉（行号、高亮、复制、Esc 关闭） | e2e「source peek stays inside the repository」；UI「citation opens the source drawer / highlight / Escape」 |
| **F5** | `impact()` 只按文件前缀匹配，改一个函数会漏判页面 | 支持 `path:line` / `path:start-end` / `{path,startLine,endLine}`；用索引符号区间做交叠匹配；返回 `changedSymbols` 与 `reasons(file/symbol)` | e2e 改 `src/server.js:6-9` 命中 `createServer` |
| **F6** | 知识卡片只有“分区摘要”，Agent 消费价值低 | 新增模块架构卡、全局规约卡、技术栈卡；每张卡带 `scope/confidence/sources`；分区卡标签中文化（概览/架构/运维/流程/备注） | e2e 断言存在「规约」「技术栈」且所有卡都有 `scope`；真实仓库 10 张卡 |
| **F7** | 导入只有 `/wiki import`，面板无入口 | 侧栏「更多」菜单新增「从 .qoder/repowiki 导入」「导入 DSH 导出包」；确认弹窗明确“先备份”；服务端 `backupOutput()` 写时间戳备份 | UI「more menu / import dialog」；e2e 导出→导入仍通过 |
| **F8** | UI 可切 en，但仓库只有 zh，切换后空白像坏掉 | `/panel` 返回 `availableLanguages`；缺失语言显示横幅 + “生成该语言版本”按钮 | UI「a missing translation explains itself」 |
| **P1（性能）** | 300 节点整棵 SVG 重渲染，大图拖拽可能掉帧 | 节点 >120 时视口裁剪：只渲染相机范围内的节点；边只要一端可见才渲染；布局/走线仍 `useMemo`，拖拽仍 rAF 合帧 | 真实仓库图 5 节点，未触发裁剪；逻辑已就位（阈值可调），未做 300 节点压测（见 §5） |
| **A1** | 图谱 `role="img"` 内含可交互节点；图标按钮语义不稳 | SVG 改 `role="group"`；模式 Tab 增加 `aria-label/title`（窄屏仅图标）；进度卡 `role=status + aria-live=polite`；节点保留 `role=button/aria-pressed` | UI 无错误；键盘 `Enter/Space` 仍可选节点 |
| **E2** | 没有视觉/交互回归，UI 改动靠人眼 | 新增 `test/ui-e2e.mjs`：真实 DSH Web + Playwright，覆盖 18 项（渲染、引用抽屉、拖拽、节点联动、导入、语言、窄屏、控制台）；无 URL/无 Playwright 时跳过，不污染零依赖安装 | UI 18/18 |
| **E3** | 客户端半体更新后必须重启，UI 无提示 | `/panel` 增加 `serverVersion`（运行中宿主版本）；客户端与 `CLIENT_VERSION` 比对，不一致显示「界面版本与宿主不一致，请重载」 | 修复了旧元数据导致的误报；0.11.0 下不再显示 |
| **E4** | `client.js` 单文件 4 500+ 行，维护成本高 | 拆为 `client/00-preamble … 90-apply` 共 **10 个源文件**；`scripts/build-client.mjs` 零依赖拼接、注入版本、`new Function` 语法校验、`--check` 检测过期；`package.json` 增加 build/check 脚本 | 拆分前后内容逐行比对仅多分段注释；`client.js` 4 527 行、197 KB；`build-client --check` 通过 |

---

## 3. P2：polish / 规模化

| ID | 状态 | 改动 / 说明 | 验证 |
|---|---|---|---|
| **U2** | 部分修复 | 3–5 节点小图自动紧凑：padding 30→16，画布高度随内容收紧；未做“密度切换/力导向” | 真实图 5 节点，viewBox `-16 -16 932 314` |
| **U3** | 已修复 | 横向 TOC 改 `position: sticky` + 背景模糊 + 阴影；锚点 `scroll-margin-top:62px` 避免被吸顶条遮住 | UI 页面阅读无遮挡 |
| **U4** | 已修复 | 代码块 header 增加语言标签 + 复制按钮（复制后 1.4s 反馈） | UI 回归页面无错误 |
| **U5** | 已修复 | <760px 侧栏改为抽屉：顶栏菜单按钮 + 遮罩 + 选择页面自动关闭；宽度 <760 时源码抽屉全宽 | UI「drawer toggle / page-tree drawer」 |
| **F9** | 已修复 | 图谱节点 inspector 增加「打开相关 Wiki」「查看知识卡」；文件节点增加「打开源码」；面板页数据带 `files` 用于匹配 | UI「inspector links to the related wiki page」 |
| **F10** | 已修复 | 搜索结果按 fresh/stale 过滤；标题与摘要关键词高亮；侧栏「最近访问」（localStorage，最多 6 条） | UI 搜索过滤与最近访问渲染 |
| **S2** | 已修复 | 导出 `.qoder/repowiki` 前自动备份旧目录；导入前 `backupOutput()`；备份保留，不自动删除 | e2e 导出/导入；响应包含 `backup` |
| **E5** | 已修复 | 版本单一来源 `src/version.js`；`store.js` 引用；构建脚本把版本注入 `client.js`；`scripts/check-version.mjs` 校验三处一致；`npm run check` 串联 | `version ok: 0.11.0` |
| **P2（体积）** | 未实施 | 可选 minify：当前 197 KB 未压缩、零构建；引入 minifier 会破坏“无构建安装”并带来字符串/正则误伤风险，收益低于维护成本。保留 `build-client.mjs` 作为未来接入点 | — |

---

## 4. 验证矩阵

| 用例 | 结果 |
|---|---|
| 服务端 12 条路由注册（panel/page/search/generate/progress/abort/export/import/source/graph/impact/app） | 通过 |
| 越权 `?root=` 拒绝（403 `forbidden`） | 通过 |
| 源码片段：仓库内、行号、越界/不存在/`..` 拒绝 | 通过 |
| 叙述层：`## 设计意图与实现要点`、JSDoc 引用 | 通过 |
| `impact("src/server.js:6-9")` → `createServer` | 通过 |
| 图谱 `signature/generatedAt`；源码改动后签名变化 | 通过 |
| 卡片：模块架构卡 / 规约卡 / 技术栈卡 + `scope` | 通过 |
| 面板缓存键 `repowiki:panel:auto:zh` | 通过 |
| 引用抽屉：打开、高亮、Esc 关闭 | 通过 |
| 图谱左键拖拽 `viewBox -16 -16 932 314 → -170.23 -93.12 932 314` | 通过 |
| 节点 inspector + 相关 Wiki 链接 | 通过 |
| 导入菜单 / 确认弹窗 | 通过 |
| 缺失语言横幅 | 通过 |
| 720px 抽屉开合 | 通过 |
| 控制台 / pageerror | 0 |

---

## 5. 未完成与风险

| 项 | 原因 | 后续 |
|---|---|---|
| 300 节点性能基准 | 当前真实仓库图仅 5 节点，无法自然构造 300 节点；裁剪逻辑已实现但未压测 | 用合成图或 2 万文件仓库跑 pan 帧时间，再决定是否 canvas 渲染 |
| 可选模型写作（F1 路线②） | 会引入模型调用、成本与幻觉风险；本轮先交付零依赖叙述 v2 | 保留 EvidencePack 为唯一事实源，模型只写两节并逐条校验 |
| 密度切换 / 力导向（U2） | 小图紧凑已解决主要观感；布局切换是产品选择，不是缺陷 | 观察真实使用后再定 |
| 可选 minify（P2） | 与零构建安装冲突，收益低 | 需要时在 `build-client.mjs` 增加 `--minify` |
| `.qoder` 备份累积 | 备份不自动删除，避免误删用户唯一副本 | 后续可加“保留最近 3 份”的可配置策略 |

---

## 6. 变更文件

| 文件 | 变更 |
|---|---|
| `.gitignore` | Git 基线忽略规则 |
| `plugin/dsh-plugin-repowiki/src/service.js` | 信任根、源码片段、备份、图谱签名、impact 符号级、卡片分类、计划合并、语言列表 |
| `plugin/dsh-plugin-repowiki/src/plan.js` | 模块详情页、文件排序、模块目录映射 |
| `plugin/dsh-plugin-repowiki/src/evidence.js` | 叙述层 v2、文件摘要、双语路径词表 |
| `plugin/dsh-plugin-repowiki/src/render.js` | 设计意图段、增强实现细节 |
| `plugin/dsh-plugin-repowiki/src/routes.js` | `import` / `source` 路由、`forbidden` 403、`signatureOnly` |
| `plugin/dsh-plugin-repowiki/src/panel.js` | `serverVersion`、`availableLanguages`、页面 `files/symbols`、卡片 scope |
| `plugin/dsh-plugin-repowiki/src/store.js` | 卡片 scope 持久化、版本引用 |
| `plugin/dsh-plugin-repowiki/src/version.js` | 新增版本单一来源 |
| `plugin/dsh-plugin-repowiki/src/errors.js` | `forbidden` |
| `plugin/dsh-plugin-repowiki/client/*.js` | 新增 10 个客户端源文件（拆分自 `client.js`） |
| `plugin/dsh-plugin-repowiki/client.js` | 生成产物：拖拽/缓存/源码抽屉/导入/语言/裁剪/无障碍/P2 polish |
| `plugin/dsh-plugin-repowiki/scripts/*.mjs` | `build-client`、`check-version` |
| `plugin/dsh-plugin-repowiki/test/*.mjs` | e2e 扩展、浏览器回归、构建/版本校验 |
| `plugin/dsh-plugin-repowiki/package.json` | 0.11.0、build/check 脚本、files |
| `docs/assets/repowiki-*-v011.png` | 最终 UI 截图 |

---

## 7. 回滚

```bash
git log --oneline            # b1c3417 是改动前基线
git diff b1c3417 -- plugin/dsh-plugin-repowiki
git checkout b1c3417 -- plugin/dsh-plugin-repowiki
```

单点回滚：`client.js` 是生成物，改 `client/*.js` 后 `npm run build` 即可；服务端每项改动独立在 `service.js` / `routes.js` / `plan.js` / `evidence.js`，可按 hunk 回退。

---

> **结论**：本轮把“能演示”的插件推进到“有基线、有信任边界、有缓存、有源码闭环、有浏览器回归”的可维护状态。剩余风险集中在规模化性能与可选模型写作，已明确标注，不再混在“已修复”里。
