# 上线检查清单 · dsh-plugin-codemap

> 面向 DeepSeek Harness 插件社区发布。逐项打勾，全部通过再发布。
> 当前状态：**本地全部通过**，剩余项需要 GitHub 账号与 npm 登录（见 §5）。

---

## 1. 清单与打包配置

| # | 检查项 | 状态 | 证据 |
|---|---|---|---|
| 1.1 | `package.json` 的 `name` 为 `dsh-plugin-codemap`（npm 可用名，registry 返回 404） | ✅ | `npm view dsh-plugin-codemap` → not found |
| 1.2 | `version` 单调递增（0.12.1） | ✅ | `package.json` / `src/version.js` / `client.js` 三处一致 |
| 1.3 | 不含 `private: true`（否则无法发布） | ✅ | `npm pack --dry-run` 成功 |
| 1.4 | `dsh.bundle.patch` 指向 `./cordis.patch.yml` | ✅ | `verify-package.mjs` 断言 |
| 1.5 | `cordis.patch.yml` 的 patch 行 `id: codemap` / `name: 'dsh-plugin-codemap'` | ✅ | 同上 |
| 1.6 | `dsh.client.platform: "web"` | ✅ | 同上 |
| 1.7 | `engines.dsh` 给出区间 `>=0.2.1-rc.5 <0.3.0-0` | ✅ | 市场用它做兼容性判定 |
| 1.8 | `dsh.compatibility.dshReleases` 列出已实测版本 | ✅ | 0.2.1-rc.5 / 0.2.2-alpha.2 |
| 1.9 | `keywords` 含 `dsh-plugin` 与 `deepseek-harness`（市场检索依据） | ✅ | 同社区包（`dsh-meme` 等）一致 |
| 1.10 | `files` 白名单包含 index.js / client.js / client / src / scripts / locale / icon / LICENSE / README | ✅ | `npm pack --dry-run` 47 个文件、196.6 kB |
| 1.11 | `publishConfig.access: public` | ✅ | `package.json` |
| 1.12 | `icon` 字段指向包内图标 | ✅ | `icon.svg`（知识图谱图形） |
| 1.13 | `locale/{zh,en}.json` 提供市场展示的标题与描述 | ✅ | 标题「代码地图」/ CodeMap |
| 1.14 | 无 `peerDependencies`（插件不 import 宿主包） | ✅ | 市场兼容缓存显示 `peerDependencies: {}` |
| 1.15 | `prepublishOnly` 自动重建客户端并校验版本 | ✅ | `npm publish` 会先跑 |

## 2. 产物完整性（社区安装演练）

| # | 检查项 | 状态 | 证据 |
|---|---|---|---|
| 2.1 | `npm pack` 能产出 tarball | ✅ | `scripts/verify-package.mjs` |
| 2.2 | tarball 在**空目录**中 `npm install` 成功 | ✅ | 同上（干净 consumer 目录） |
| 2.3 | 安装后包含 index.js / client.js / cordis.patch.yml / icon.svg / locale | ✅ | 同上逐项断言 |
| 2.4 | 安装后 `src/`、`client/` 源码齐全 | ✅ | 同上 |
| 2.5 | 从安装产物加载插件：服务、4 个工具、`/codemap` 命令、`codemap:policy` 全部注册 | ✅ | 同上（假宿主上下文启动） |
| 2.6 | 安装产物中的 `client.js` 可编译且带正确版本号 | ✅ | `new Function(bundle)` |
| 2.7 | 零运行时依赖 | ✅ | `dependencies` 为空 |

## 3. 功能回归

| # | 检查项 | 状态 | 证据 |
|---|---|---|---|
| 3.1 | `npm run check`（构建 + 版本 + 客户端自检 + e2e） | ✅ | local-e2e 35 项、client-graph 12 项全绿 |
| 3.2 | 真实 DSH Web 实例加载插件并渲染面板 | ✅ | 面板 10 页 / 10 卡 / 155 引用 / 100% fresh |
| 3.3 | 浏览器回归（Playwright） | ✅ | `test/ui-e2e.mjs` 18/18，0 console error |
| 3.4 | 生成产物落在 `.dsh/codemap/`，路由为 `/api/codemap/*` | ✅ | 实机生成结果 |
| 3.5 | 模型工具名与命令名与清单一致 | ✅ | `codemap_search/read/generate/status`、`/codemap` |

## 4. 文档与素材

| # | 检查项 | 状态 |
|---|---|---|
| 4.1 | README 含定位、截图、安装、用法、安全边界、开发、兼容性、License | ✅ |
| 4.2 | README 中英文双版（社区搜索友好） | ✅ |
| 4.3 | 封面图 + 三张功能截图 | ✅ `docs/assets/cover.png` 等 |
| 4.4 | LICENSE（MIT） | ✅ |
| 4.5 | `.gitignore` 排除 `.dsh/`、`.qoder/`、`node_modules/`、日志、测试产物 | ✅ |
| 4.6 | 技术文档随包外发布（`docs/`） | ✅ |
| 4.7 | 文档内无旧标识（`repowiki`）残留 | ✅ 全仓扫描 0 命中 |

## 5. 发布动作（需要账号凭据）

| # | 动作 | 命令 | 状态 |
|---|---|---|---|
| 5.1 | 创建 GitHub 仓库（公开） | `gh repo create dsh-plugin-codemap --public --source . --remote origin --push` | ⏳ 待 GitHub 用户名 |
| 5.2 | 打 tag 并推送 | `git tag -a v0.12.0 -m "CodeMap 0.12.0"` → `git push origin v0.12.0` | ⏳ |
| 5.3 | 回填 `package.json` 的 owner（当前为 `OWNER` 占位） | `homepage` / `repository` / `bugs` | ⏳ |
| 5.4 | npm 登录 | `npm login`（registry 需切到 `https://registry.npmjs.org`） | ⏳ |
| 5.5 | 发布到 npm | `npm publish --access public` | ⏳ |
| 5.6 | 社区搜索验证 | 搜 `codemap` / `dsh-plugin-codemap` → 安装 → 面板出现「代码地图」 | ⏳ |
| 5.7 | 打 GitHub Release（附 CHANGELOG 摘要） | `gh release create v0.12.0` | ⏳ |

## 6. 发布后回滚

```bash
npm deprecate dsh-plugin-codemap@0.12.0 "存在严重问题，请升级到 0.12.1"
npm unpublish dsh-plugin-codemap@0.12.0     # 72 小时内可撤回
git tag -d v0.12.0 && git push --delete origin v0.12.0
```
