# Changelog

本文件记录值得用户注意的变更。格式参考 [Keep a Changelog](https://keepachangelog.com/)，版本号遵循 [SemVer](https://semver.org/)。

## [0.12.1] — 2026-11-01

### Fixed

- **弹出菜单透出下层内容**：工作区切换菜单、导入菜单与帮助浮层此前直接沿用宿主的一个背景色，遇到宿主把背景画在容器上（`body` 完全透明）时会把"透明"当成实心色返回，菜单文字与页面文字叠在一起。现在改为解析每个祖先的实际透明度并逐层合成，最终一定落在一个不透明、且与面板明暗一致的底色上。
- **弹层被正文盖住**：头部带 `backdrop-filter` 但没有层级，正文列（`position: relative`）绘制在其上方，导致下拉菜单里混入页面文字。已把头部提升到正文之上。

## [0.12.0] — 2026-11-01

更名版本：`dsh-plugin-repowiki` → **`dsh-plugin-codemap`**（显示名「代码地图 / CodeMap」）。

### Changed

- **包与命令全部改名**：npm 包名、`/wiki` → `/codemap`、`wiki_*` → `codemap_*` 工具、`repowiki:policy` → `codemap:policy`、HTTP 路由 `/api/repowiki/*` → `/api/codemap/*`、产物目录 `.dsh/repowiki/` → `.dsh/codemap/`。
- **页面规划文件** 改为 `codemap_plan.yaml`；旧 `wiki_plan.yaml` 仍会被读取（兼容期保留）。
- **仓库结构**：插件包从 `plugin/dsh-plugin-repowiki/` 提升到仓库根，作为独立开源项目发布。
- **视觉**：新图标、新封面、README 重写为社区版本。

### Added

- `market/index.json`：符合 DSH 插件索引 **format 1** 的索引，可直接添加为市场源（git 源，无需 npm）。
- `docs/publishing.md`：四条安装路径、社区目录收录流程、npm 发布、验证记录与检查清单。
- `scripts/verify-package.mjs`：打包 → 干净目录安装 → 真实加载 → 断言服务/工具/命令/提示词注册。
- `scripts/check-version.mjs`、`client/` 分段源码 + `scripts/build-client.mjs`。

### Fixed

- 修复 v0.11 遗留的面板缓存、引用抽屉与图谱新鲜度问题（详见 [v0.11 验收](docs/v0.11-closeout.md)）。

## [0.11.0] — 2026-10-31

- 安全：工作区信任边界（越界 `403`）、源码预览路径约束、导出/导入前自动备份。
- 内容：模块详情页、叙述层 v2（JSDoc / 导入 / 被引用 / 路由 / 配置键）。
- 阅读：引用点击直达源码抽屉、代码块复制、sticky 目录。
- 性能：面板 `sessionStorage` 缓存、图谱视口裁剪、布局 memo。

## [0.10.0] — 2026-10-31

- 图谱支持拖拽平移、滚轮缩放与键盘操作；整体 UI 重构与明暗主题一致性。
