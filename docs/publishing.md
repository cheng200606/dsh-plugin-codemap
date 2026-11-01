# 发布与安装

> 适用版本：`dsh-plugin-codemap@0.12.0` ｜ 更新：2026-11-01 ｜ 相关：[发布检查清单](release-checklist.md)

本文说明三条**把插件交付到别人机器上**的路径，以及把插件收录进 DeepSeek Harness 插件社区（Discover / 市场）的完整流程。

---

## 1. 四条安装路径与当前状态

| 路径 | 入口 | 现在可用 | 依赖 |
|---|---|---|---|
| **插件市场 → Discover**（社区目录） | 市场里搜索 `codemap` → 安装 | ⏳ 待收录 | 社区目录 PR 合并 |
| **插件市场 → 自托管索引** | 添加源地址 → 搜索 → 安装 | ✅ 可用 | 仅 GitHub |
| **命令行（Git）** | `dsh plugin add git+https://github.com/cheng200606/dsh-plugin-codemap.git#<commit>` | ✅ 可用 | Git + 网络 |
| **命令行（npm）** | `dsh plugin add dsh-plugin-codemap@0.12.0` | ✅ 已发布 | 无 |

历史上 DSH 的市场**没有内置任何源**（`plugin-market` 的 `indexes` 默认为 `[]`），社区源由用户在设置里添加。因此「在市场里搜到」等价于两件事：**一个可读的 index.json**，加上**该条目指向的安装物真实存在**。

---

## 2. 社区目录（awesome-dsh-plugin）

DSH 生态实际使用的社区源：

```
https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json
```

它由 [`awesome-dsh-plugin/awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 仓库生成：列表数据在 `data/plugins/`，**一个插件一个 YAML**，README 由脚本生成。

### 2.1 收录规则（摘自 contributing.md）

| 规则 | 本仓库现状 |
|---|---|
| 提交一个 `data/plugins/<owner>__<repo>.yml` | 已备好：[`market/community-entry.yml`](../market/community-entry.yml) |
| `package.json` 声明 `dsh.bundle` | ✅ `dsh.bundle.patch = ./cordis.patch.yml` |
| 仓库添加 `dsh-plugin` topic | ✅ 建仓时已设置 |
| 描述只陈述功能、必须属实 | ✅ 四个工具、一个命令、12 条路由均可在代码中核对 |
| `category` 贴合实际用途 | `docs`（生成代码文档）；备选 `dev` |
| npm 包**可选** | 未发布也能收录，只是没有下载量数字（但市场一键安装需要它，见 §3） |

### 2.2 提交步骤

```bash
# 1. fork 后克隆
git clone https://github.com/<你>/awesome-dsh-plugin.git && cd awesome-dsh-plugin

# 2. 放入条目（文件名必须是 owner__repo.yml）
cp <本仓库>/market/community-entry.yml data/plugins/cheng200606__dsh-plugin-codemap.yml

# 3. 校验 + 预览（可选）
npm ci && node scripts/generate-readme.mjs

# 4. 提交 PR
git checkout -b add-codemap && git add data/plugins/cheng200606__dsh-plugin-codemap.yml
git commit -m "Add cheng200606/dsh-plugin-codemap" && git push -u origin add-codemap
```

CI 会检查仓库年龄（过滤「PR 前几分钟才建好」的仓库）。若被这条拦下，把功能与文档补齐后重新提交即可，不影响后续收录。

---

## 3. npm 发布

社区目录的每一条 `versions[].source` 都是 `{"type":"npm"}`，市场安装时拼成 `name@version`。所以**要一键安装，就必须有可解析的 npm 包**。

```bash
# 1. 登录（本机 registry 默认是 npmmirror 镜像，不能发布）
npm config set registry https://registry.npmjs.org
npm login

# 2. 发布（prepublishOnly 会自动重建 client.js 并校验版本一致）
npm publish --access public

# 3. 校验
npm view dsh-plugin-codemap version dist.tarball repository.url
```

**当前状态**：`dsh-plugin-codemap@0.12.0` 已于 2026-11-01 发布到 npmjs（maintainer `chengxia`），`dist-tags.latest = 0.12.0`，tarball 199 kB / 48 个文件。

> 首次发布会留下一个 `0.0.0-stage` 占位版本（npm 的 staging 记录），`latest` 不受影响；清理它需要 `npm unpublish` 权限，当前 token 被拒（403）。忽略即可。

发布成功后的自动关联：

| 关联项 | 要求 | 本仓库 |
|---|---|---|
| 目录条目 ↔ npm 包 | `package.json` 的 `repository.url` 指回被收录的仓库 | ✅ `git+https://github.com/cheng200606/dsh-plugin-codemap.git` |
| 下载量展示 | 目录自动从 registry 采集，**条目里不要写 `npm:` 字段** | ✅ 未写 |

---

## 4. 自托管索引

不发布 npm 也能让别人装：本仓库自带一个符合 **format 1** 的索引。

```
https://cdn.jsdelivr.net/gh/cheng200606/dsh-plugin-codemap@main/market/index.json
```

| 字段 | 值 |
|---|---|
| `format` | `1` |
| `plugins[0].name` | `dsh-plugin-codemap` |
| `versions[0].source` | `{"type":"npm"}` |
| 安装 spec | `dsh-plugin-codemap@0.12.0` |
| `icon` | 相对路径 `icon.svg`，随索引源解析 |

用户侧操作：**插件市场 → 源（Sources）→ 添加地址**，粘贴上面的 jsdelivr URL，即可搜索并一键安装。

> 索引已用 DSH 内置校验器 `@deepseek-ai/dsh-plugin-market-index` 的 `parseMarketIndex` 验证通过；`marketInstallTarget()` 输出的 spec 与上表一致。
> 发新版本时同步改 `version` 与 `publishTimestamp`（Unix 秒）。若改用 git 源，`commit` 必须是 **40 位小写十六进制**的完整 SHA。

---

## 5. 本地开发调试

```bash
git clone https://github.com/cheng200606/dsh-plugin-codemap.git
cd dsh-plugin-codemap
npm run check          # 构建 + 版本一致性 + 客户端自检 + 端到端
```

挂到 Harness 的 profile（`~/.dsh/profiles/<profile>/package.json`）：

```jsonc
{
  "dependencies": { "dsh-plugin-codemap": "link:D:/path/to/dsh-plugin-codemap" },
  "dsh": { "profile": { "bundles": ["dsh-plugin-codemap"] } }
}
```

```bash
pnpm install           # 建立 link
```

要点：

| 事项 | 说明 |
|---|---|
| `dsh plugin add` 副作用 | 会把包写进 `dependencies`，并**自动追加到 `dsh.profile.bundles`**，不需要手工编辑 |
| 改浏览器半体 | 改 `client/*.js`，再 `npm run build` 生成 `client.js`；**不要直接改 `client.js`** |
| 生效方式 | 重启 Harness（或重载插件），面板与工具才会重新注册 |
| 目录结构要求 | 包根必须有 `index.js`、`package.json`（含 `dsh.bundle`）、`cordis.patch.yml` |
| 运行时依赖 | 零；只用 `node:*` 内置模块，不需要 `node_modules` 也能跑 |
| 浏览器回归 | `DSH_WEB_URL="http://127.0.0.1:3081/?token=…" node test/ui-e2e.mjs` |

---

## 6. 上线前检查清单

| # | 检查项 | 命令 / 证据 | 通过标准 |
|---|---|---|---|
| 1 | 构建产物与源码一致 | `npm run check` | 全部 PASS，无 stale |
| 2 | 版本三处一致 | `node scripts/check-version.mjs` | `package.json` = `src/version.js` = 客户端注入值 |
| 3 | 打包内容正确 | `npm pack --dry-run` | 只含声明文件，无 `.dsh/`、`test/artifacts/`、截图 |
| 4 | 安装包可加载 | `npm run verify:package` | 干净目录安装后服务/工具/命令/提示词全部注册 |
| 5 | 市场索引合法 | `parseMarketIndex(...)` | 无 `MarketIndexError`，spec 可拼出 |
| 6 | 仓库 topic | GitHub 仓库页 | 含 `dsh-plugin` |
| 7 | 清单 manifest | `package.json` | `dsh.bundle.patch` 存在且行 id 与包名一致 |
| 8 | 许可与文档 | 仓库根 | `LICENSE`、`README`、`docs/` 齐全 |
| 9 | 安装验证 | 干净环境 `dsh plugin add <spec>` | 插件出现在插件列表并可启用 |
| 10 | 版本标签 | `git tag` | `v0.12.0` 与 `package.json` 一致，Release 已发布 |

---

## 7. 验证记录（2026-11-01）

| 验证项 | 做法 | 结果 |
|---|---|---|
| 索引格式 | 用 DSH 自带 `parseMarketIndex` 解析 `market/index.json` | 通过，`marketInstallTarget()` 输出 `git+https://…git#7c0873…` |
| 索引公网可读 | `curl` jsdelivr 地址 | 200，2632 B |
| `dsh plugin add` | 隔离 profile `codemap-sandbox` 安装打好的 tgz | 成功，`dependencies` 与 `dsh.profile.bundles` 均自动写入 |
| 安装包可加载 | `npm run verify:package`（干净目录安装后真实调用 `apply`） | 服务 / 4 工具 / 1 命令 / 提示词段全部注册 |
| 市场端到端 | 真实 Harness：插件页 → 开启「自定义插件索引」→ 发现 → 添加索引源 | 卡片显示图标、标题、描述、标签、`0.12.0 · 程夏`，右侧标记**已安装**（截图 `docs/assets/market-discover.png`） |
| 从 GitHub 直装 | `pnpm add git+https://…#<sha>` | 本机到 `codeload.github.com` 超时（网络问题，非包问题），spec 解析正确 |
| npm 发布 | `npm publish --access public` | 成功，`0.12.0`，48 个文件 / 199 kB |
| npm 安装 | 干净目录 `pnpm add dsh-plugin-codemap` | 1.8 s 装好，版本 `0.12.0` |
| 索引指向 npm | `parseMarketIndex` + `marketInstallTarget` | 输出 `dsh-plugin-codemap@0.12.0` |

> 结论：插件侧、索引侧、npm 侧均已闭环；**唯一未完成项是社区总目录（awesome-dsh-plugin）的收录 PR**。

### 7.1 市场的前置条件（容易踩的坑）

| 现象 | 原因 | 处理 |
|---|---|---|
| 插件页没有「发现」标签 | 「自定义插件索引」实验开关默认关闭 | 插件页 → 实验性插件 → 打开「自定义插件索引」 |
| 加了索引仍显示「还没有插件索引」 | `dsh web` 用的是 **web** profile；改 desktop 的 patch 不生效 | 在界面里添加，或改 `~/.dsh/profiles/web/cordis.patch.yml` |
| 索引里的 `commit` 校验失败 | 不是 40 位小写十六进制 | 用 `git rev-parse HEAD` 的完整 SHA |
