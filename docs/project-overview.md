# dsh-repo-wiki

面向 DeepSeek Harness 的 CodeMap 插件设计与调研项目。

## 主文档

- [Qoder CodeMap 深度调研与 DeepSeek Harness 插件设计方案](docs/research-qoder-repo-wiki.md)
- [插件实现与交付报告（功能范围 / 安装步骤 / 测试结果 / 问题清单）](docs/delivery-report.md)
- [侧栏面板：入口结构、交互方式、功能模块与竞品分析](docs/panel-and-competitive-analysis.md)
- [v0.10 交互修复、UI 重构与潜在问题评估](docs/review-v0.10.md)
- [v0.11 P0/P1/P2 修复与验收（逐项改动 + 验证 + 未完成项）](docs/v0.11-closeout.md)

## 插件实现

| 路径 | 内容 |
|---|---|
| [`./`](./README.md) | 可安装的 Cordis bundle：`dsh-plugin-codemap` 0.11.0（零第三方依赖） |
| [`./src/`](./README.md) | 24 个源文件：扫描 / 索引 / 规划 / 证据 / 叙述层 / 渲染 / 校验 / 检索 / 服务 / 工具 / 命令 / 提示词 / 配置投影 / Markdown 解析 / 面板 DTO / 降级页 / 客户端自检 / 统一错误 / 版本 / Fetch 路由 |
| [`./client/`](./client/README.md) | 浏览器半体源码：10 个分段（locale / helpers / styles / components / graph / markdown / request / panel / apply），由 `scripts/build-client.mjs` 拼接为 `client.js` |
| [`./client.js`](./README.md) | 生成产物：侧栏图标 + 主面板 + 左树/搜索/正文 + 图谱拖拽/缩放 + 源码抽屉 + 缓存 + 响应式 |
| [`./test/local-e2e.mjs`](./README.md) | 服务端端到端测试（35 项断言） |
| [`./test/client-graph.mjs`](./README.md) | 客户端半体自检单测：12 项降级分支 |
| [`./test/ui-e2e.mjs`](./README.md) | Playwright 浏览器回归：18 项交互/视觉断言（无 URL 时跳过） |
| [`./test/probe-coverage.mjs`](./README.md) | 覆盖率探针：统计每页引用数与去重被引文件数 |
| `.dsh/codemap/` | 本仓库自身的 Wiki（由插件在本机生成，可作为实跑产物查阅） |

## 文档包含

| 章节 | 内容 |
|---|---|
| 0 | 一页纸结论（可直接贴群） |
| 1–4 | Qoder CodeMap 产品解剖、工作原理、交互、场景边界、横向对比 |
| 5 | DSH 插件设计：定位、范围、架构、服务/工具/命令、生成流水线、数据模型、增量更新、检索、UI、互操作、安全 |
| 6 | 关键技术难点与应对 |
| 7–9 | M0–M4 里程碑、度量体系、风险登记 |
| 10 | 待确认决策与两周行动清单 |
| 附录 | 参考资料、术语表、`wiki_plan.yaml` 示例、插件骨架、页面模板 |

## 当前状态

- 版本：v0.11.0（P0/P1/P2 逐项修复：Git 基线、root 白名单、叙述层 v2、图谱新鲜度、面板 SWR、引用跳源码、符号级 impact、卡片分类、导入 UI、语言提示、视口裁剪、无障碍、浏览器回归、客户端拆分）
- 日期：2026-10-31
- 本地回归全绿：local-e2e 35/35、client-graph 12/12、UI e2e 18/18、版本三处一致
- 真机交互（Playwright，1440×900 / 1080 / 720）：引用抽屉、图谱拖拽、节点→Wiki 联动、导入确认、缺失语言横幅、窄屏抽屉，0 console error
- 构建：`npm run build` 重新生成 `client.js`；`npm run check` 执行构建 + 版本 + 自检 + e2e
- 待推进：300 节点性能压测、可选模型叙述层、密度切换（见 [v0.11 验收 §5](docs/v0.11-closeout.md)）
