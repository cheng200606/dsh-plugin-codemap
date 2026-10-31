# client/ — 浏览器半体源码

`client.js` 是宿主实际加载的**生成产物**。不要直接改它；改这里的分段文件，然后运行：

```bash
node scripts/build-client.mjs          # 重新生成 client.js
node scripts/build-client.mjs --check  # 只检查 client.js 是否过期
```

## 为什么是拼接而不是打包

插件承诺“零第三方依赖、安装即用”。引入 Rollup/Vite 会让安装多一步构建，也会带来依赖树；这组文件由 `build-client.mjs` 按文件名排序直接拼接，保持同一个 `factory` 闭包，不需要模块加载器。

## 分段

| 文件 | 内容 |
|---|---|
| `00-preamble.js` | `window.__ModuleLoader__.load`、React 依赖、共享常量（搜索防抖、缓存前缀、版本 token） |
| `10-locale.js` | 中文/英文字典与 `t()` |
| `20-helpers.js` | 主题 token、引用解析、面板缓存（SWR）、最近访问、搜索高亮 |
| `30-styles.js` | 注入一次的样式表：token 层、布局、图谱、源码抽屉、响应式、模态框 |
| `40-components.js` | `StatusDot`/`StatusChip`/`StatCard`/`Skeleton`/`Button`/`Chip`/`Glyph`/`CopyButton` |
| `45-graph.js` | 确定性分层布局、连线路径、平行边通道分配 |
| `50-markdown.js` | `InlineText`（引用 chip / 卡片 chip）、`MarkdownBlock`（表格、代码、mermaid） |
| `60-request.js` | `requestJson`、错误归一化、abort 判定 |
| `70-panel.js` | `CodeMapPanel`：状态机、五种视图、图谱交互、源码抽屉、导入确认、响应式抽屉 |
| `90-apply.js` | 侧栏图标 + 主面板槽位注册与卸载 |

## 约束

- 不使用顶层 `import`/`export`；所有代码都在 `factory(require)` 内。
- 不新增第三方依赖；图标用内联 SVG。
- 颜色只通过 `--rw-*` / `--dsw-alias-*` token，明暗主题自动适配。
- 版本号写 `__CODEMAP_VERSION__`；构建脚本从 `package.json` 注入，`scripts/check-version.mjs` 校验三处一致。
