# dsh-repo-wiki

面向 DeepSeek Harness 的 Repo Wiki 插件设计与调研项目。

## 主文档

- [Qoder Repo Wiki 深度调研与 DeepSeek Harness 插件设计方案](docs/qoder-repo-wiki-research-and-dsh-plugin-design.md)
- [插件实现与交付报告（功能范围 / 安装步骤 / 测试结果 / 问题清单）](docs/dsh-plugin-repowiki-delivery.md)
- [侧栏面板：入口结构、交互方式、功能模块与竞品分析](docs/repowiki-panel-and-competitive-analysis.md)
- [v0.10 交互修复、UI 重构与潜在问题评估](docs/repowiki-improvement-review-v0.10.md)

## 插件实现

| 路径 | 内容 |
|---|---|
| [`plugin/dsh-plugin-repowiki/`](plugin/dsh-plugin-repowiki/README.md) | 可安装的 Cordis bundle：`dsh-plugin-repowiki` 0.10.0（零第三方依赖） |
| [`plugin/dsh-plugin-repowiki/src/`](plugin/dsh-plugin-repowiki/README.md) | 23 个源文件：扫描 / 索引 / 规划 / 证据 / 渲染 / 校验 / 检索 / 服务 / 工具 / 命令 / 提示词 / 配置投影 / Markdown 解析 / 面板 DTO / 降级页 / 客户端自检 / 统一错误 / Fetch 路由 |
| [`plugin/dsh-plugin-repowiki/client.js`](plugin/dsh-plugin-repowiki/README.md) | 浏览器半体：侧栏图标 + 主面板 + 左树/搜索/正文 + **交互式知识图谱（拖拽平移 / 滚轮缩放 / 键盘）** + 五态状态机 + 明暗主题 token 层 |
| [`plugin/dsh-plugin-repowiki/test/local-e2e.mjs`](plugin/dsh-plugin-repowiki/README.md) | 本地端到端测试（30 项断言） |
| [`plugin/dsh-plugin-repowiki/test/client-graph.mjs`](plugin/dsh-plugin-repowiki/README.md) | 客户端半体自检单测：10 项降级分支 |
| [`plugin/dsh-plugin-repowiki/test/probe-coverage.mjs`](plugin/dsh-plugin-repowiki/README.md) | 覆盖率探针：统计每页引用数与去重被引文件数 |
| `.dsh/repowiki/` | 本仓库自身的 Wiki（由插件在本机生成，可作为实跑产物查阅） |

## 文档包含

| 章节 | 内容 |
|---|---|
| 0 | 一页纸结论（可直接贴群） |
| 1–4 | Qoder Repo Wiki 产品解剖、工作原理、交互、场景边界、横向对比 |
| 5 | DSH 插件设计：定位、范围、架构、服务/工具/命令、生成流水线、数据模型、增量更新、检索、UI、互操作、安全 |
| 6 | 关键技术难点与应对 |
| 7–9 | M0–M4 里程碑、度量体系、风险登记 |
| 10 | 待确认决策与两周行动清单 |
| 附录 | 参考资料、术语表、`wiki_plan.yaml` 示例、插件骨架、页面模板 |

## 当前状态

- 版本：v0.10.0（图谱拖拽修复 + 整体 UI 重构 + 明暗主题一致性 + 性能/无障碍改进）
- 日期：2026-10-31
- 本地回归全绿：e2e 30/30、client-graph 10/10、探针 8 页全 fresh / 122 引用 122 有效 / 覆盖 28 文件
- 真机交互（Playwright，1440×900）：图谱左键拖拽 viewBox 变化、滚轮缩放、节点点击 inspector、从节点上拖拽平移、双击适配、方向键平移；明/暗双主题截图无 console error
- 待推进：P0 版本控制 / root 信任边界 / 正文表达力；P1 面板缓存 / 引用跳源码 / 大图性能（见 [v0.10 评估](docs/repowiki-improvement-review-v0.10.md)）
