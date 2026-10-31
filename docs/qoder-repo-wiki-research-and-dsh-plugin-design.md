# Qoder Repo Wiki 深度调研与 DeepSeek Harness 插件设计方案

> **版本**：v0.1（设计草案）  
> **日期**：2026-10-31  
> **范围**：Qoder Repo Wiki 产品解剖、同类产品横向对比、面向 DeepSeek Harness 的插件架构、技术难点与分阶段实现路径  
> **证据基线**：Qoder 官方文档、官方博客、官方界面截图；DeepSeek Harness 官方架构文档与 npm `0.2.2-alpha.2` 类型声明；Code Wiki / DeepWiki 官方文档；第三方实测与论坛资料  
> **写作约定**：文中对 Qoder 内部实现的描述区分「官方明确」「官方间接」「合理推断」。推断项只用于指导设计，不作为事实引用。

**目录**：0 一页纸结论 · 1 调研方法 · 2 Qoder 产品解剖 · 3 场景与边界 · 4 能力对比 · 5 插件设计 · 6 技术难点 · 7 里程碑 · 8 度量 · 9 风险 · 10 决策 · 附录 A–E

---

## 0. 一页纸结论

| 问题 | 结论 |
|---|---|
| Qoder Repo Wiki 是什么 | 不是一个“文档生成器”，而是把代码库理解变成**可维护、可消费、可共享**的工程资产：结构化 Wiki 页面 + 知识卡片 + 代码索引，三者共同服务人与 Agent。 |
| 它真正的护城河 | **闭环**：本地生成 → 页面阅读 → 任务内引用 → Git 增量更新 → 人工修订 → 团队共享。单点“生成一篇架构文档”并不难，难的是持续保持一致。 |
| 最值得复用的设计 | ① `wiki_plan.yaml` 让结构可规划；② 产物以 Markdown + metadata 落在仓库内，天然可 diff、可共享；③ 页面与知识卡片双表示；④ 基于 commit diff 的增量更新；⑤ 生成结果直接进入 Agent 上下文。 |
| 最不该照搬的部分 | 不透明的一次性全量生成、封闭的云端知识库、不可验证的“大段散文”、以及把 UI 完整度当作 MVP 前提。 |
| DSH 插件应怎么定位 | **DSH 的项目知识层（repo knowledge layer）**：一个可被工具、命令、Agent 和 UI 共同消费的本地服务，而不是一个只会吐 Markdown 的脚本。 |
| MVP 边界 | Git 仓库、单语言（中文）、`architecture` 模板、8–12 页、`/wiki` 命令 + `wiki_search` / `wiki_read` 两个消费工具、引用可校验、产物可导出。**不做** UI 面板、不做多语言、不做团队云同步。 |
| 最大技术风险 | 不是“生成不出来”，而是**生成得看起来很好但不可验证、且很快过期**。因此“证据约束 + 引用校验 + 增量影响分析”必须进入 P0/P1，而不是后置优化。 |

**六条关键判断**

1. **文档是代码的投影，不是创作。** 任何无法回溯到 `path:line` 的结论都应被标记为“待确认”，而不是用流畅的文字掩盖不确定性。
2. **结构先于内容。** Qoder 用 `wiki_plan.yaml` 把“写什么、给谁写、分几层”变成可评审的输入；这是生成质量的第一杠杆。
3. **增量优于全量。** 全量生成是一次性事件，增量更新才是产品；没有 diff 影响分析，Wiki 在两周内必然过期。
4. **双表示是 Agent 时代的关键。** 长页面给人读，高密度知识卡片给 Agent 读；两者服务不同的 token 预算与阅读路径。
5. **本地生成 ≠ 代码不出机器。** Qoder 的“本地生成”指不上传全量仓库，但模型调用仍可能把选中的代码片段发送给模型提供方；企业场景必须把这一点写清楚。
6. **DSH 的优势在“可组合”。** 不需要复刻 Qoder 的 IDE，而应把能力拆成 `ctx.repoWiki` 服务、模型工具、人类命令、后台 Job、Workflow 编排与可选 UI，让每个接缝都可替换。

**关键数字（用于建立量级感）**

| 指标 | 数值 | 口径 |
|---|---:|---|
| 官方截图样本的 Wiki 页面数 | 14 页（14/14 Done） | Qoder 文档截图，`deploy-manager` 仓库，2026-10-23 |
| 同一仓库的知识卡片数 | 31 张 | 同上 |
| Qoder 公开宣称的累计生成量 | 400k+ codebase wikis | qoder.com 首页，2026-10-31 检索 |
| 4,000 文件仓库的典型生成耗时 | 约 120 分钟 | 阿里云 Lingma 文档（Qoder CN 同源），非 Qoder 国际版官方口径 |
| 支持语言 | English / 简体中文 | Qoder 官方文档 |
| DSH 当前版本 | `0.2.2-alpha.2`（Node ≥ 24.9.0） | npm `@deepseek-ai/dsh`，2026-10-31 |

---

## 1. 调研范围与方法

### 1.1 证据来源

| 类型 | 来源 | 用途 | 证据等级 |
|---|---|---|---|
| 产品文档 | [Qoder Docs · Repo Wiki](https://docs.qoder.com/zh/qoder/repo-wiki)、[Qoder CN Docs](https://docs.qoder.cn/qoder/repo-wiki) | 功能、交互、产物路径、更新机制、安全说明 | A |
| 产品文档 | [Qoder Docs · 知识卡片](https://docs.qoder.com/zh/qoder/knowledge-cards) | 卡片类型、生成、共享、多语言 | A |
| 官方博客 | [Repo Wiki: Surfacing Implicit Knowledge](https://qoder.com/zh/blog/repo-wiki-surfacing-implicit-knowledge)（2025-09-11） | 多 Agent、索引、规划、共享的设计意图 | A |
| 官方界面 | Qoder 文档内嵌截图（Repo Wiki 概览、知识卡片、导入导出） | 真实目录结构、页面数量、状态字段 | A |
| 官方首页 | [qoder.com](https://qoder.com/) | 400k+ wikis、100k files 分析上限等公开数据 | A |
| 区域文档 | [Alibaba Cloud Lingma · Repo Wiki](https://www.alibabacloud.com/help/tc/lingma/repo-wiki) | 生成耗时、文件上限、增量行数限制 | B（Qoder CN 同源，版本可能滞后） |
| 社区 | [Qoder Forum](https://forum.qoder.com/t/you-have-reached-the-maximum-number-of-code-repositories-allowed-for-analysis/1327) | 历史上限、真实使用反馈 | C |
| 第三方实测 | [CIOAge 实测](https://www.cioage.com/article/845506.html)、[Qoder 用户博客](https://qoder.com/zh/blog/qoder-case-creditstips) | Mermaid 图、`path:line` 引用、页面目录 | B |
| Harness 文档 | [DSH Architecture](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)、[Extension Cookbook](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md)、[Adding a Tool](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-tool.md) | 插件模型、工具、命令、事件、Workflow | A |
| Harness 类型 | 本地安装 `@deepseek-ai/dsh@0.2.2-alpha.2`（330 个 `@deepseek-ai/*` 包） | 核对真实 API、包结构、`ctx` 键 | A |
| 竞品 | [Google Code Wiki 发布博客](https://developers.googleblog.com/introducing-code-wiki-accelerating-your-code-understanding/)、[Code Wiki FAQ](https://codewiki.google/faq)、[DeepWiki](https://deepwiki.com/) | 横向对比 | A/B |

### 1.2 证据分级

| 等级 | 定义 | 本文用法 |
|---|---|---|
| **A** | 官方文档、官方博客、官方截图、官方 npm 类型 | 直接作为事实 |
| **B** | 官方间接表述、同源区域文档、可靠第三方实测 | 作为“高可信描述”，标注来源 |
| **C** | 合理推断、社区反馈、单一第三方 | 仅用于设计假设，明确标注 |
| **D** | 无法核验的二手信息 | 不采用 |

### 1.3 调研限制

1. **Qoder 闭源。** 其索引结构、检索算法、页面规划提示词、校验流程、metadata schema 均未公开；本文只能依据官方描述与产物反推。
2. **未获得 Qoder 实测账号。** 生成耗时、文件上限等数据来自官方/区域文档与社区，存在版本差异；设计时不把这些数字当作硬约束。
3. **DSH 处于 developer preview。** `0.2.2-alpha.2` 的 API 可能变化；本文代码片段用于表达设计意图，不作为可编译实现。
4. **横向对比的公平性。** Qoder 是 IDE 内闭环产品，Code Wiki / DeepWiki 是托管式 SaaS；比较的是“能力形态”，不是绝对优劣。

---

## 2. Qoder Repo Wiki 产品解剖

### 2.1 定位：三层资产，而不是一堆文档

Qoder 官方对 Repo Wiki 的定义是“为代码仓库生成结构化文档，并随代码变更持续更新项目知识”。但如果只看“生成文档”，会低估它的设计。结合实际产物，它实际上生产三层资产：

| 层 | 产物 | 主要读者 | 作用 |
|---|---|---|---|
| **结构层** | 代码库索引（文件、模块、依赖、符号、路由） | 生成阶段的 Agent | 让 Agent 具备“工程感知”，不用每次从零 grep |
| **阅读层** | 结构化 Wiki 页面（Markdown、图表、`path:line` 引用） | 人 |  onboarding、架构理解、改动前评估 |
| **消费层** | 知识卡片（架构、规约、技术栈） | Agent / 人 | 高密度上下文，直接进入任务 |

这三层共享同一套“项目知识”，但服务不同的阅读路径与 token 预算。**这是 Repo Wiki 与普通“AI 写文档”工具最本质的区别。**

### 2.2 核心能力清单

| 能力 | 具体表现 | 证据 |
|---|---|---|
| **结构化生成** | 覆盖架构、模块关系、业务流程；不是 README 扩写 | A |
| **目录规划** | 自动规划页面树；也可用 `wiki_plan.yaml` 指定页面、层级、目标、提示 | A |
| **模板** | `architecture`（技术架构）/ `product_requirement`（产品需求） | A |
| **代码溯源** | 页面结论可定位到具体文件与行号；官方博客称“引用关系图谱” | A/B |
| **图表** | 依赖关系图、架构图、时序图/流程图（第三方实测确认 Mermaid 架构图） | B |
| **知识卡片** | 架构文档、代码规约（Spec）、技术栈三类；与 Wiki 一同生成 | A |
| **增量更新** | 基于 commit diff，只更新受影响的知识；仅 Git 仓库 | A |
| **任务内引用** | 开启“智能体引用”后，Agent 在任务中自动使用项目知识 | A |
| **人工干预** | 生成前改 `wiki_plan.yaml`；生成后用 `/knowledge-edit` skill 修改 | A |
| **导入导出** | 导出到 `.qoder/repowiki`；从该目录导入；可随 Git 共享 | A |
| **多语言** | English / 简体中文，分目录保存 | A |
| **本地生成** | 本地客户端运行，不上传全量代码，不在服务端留存 | A |
| **暂停/继续** | 生成或更新可暂停，从保存进度继续；可恢复错误可重试 | A |
| **重新生成** | 重新规划结构或整体重建，替换已有内容 | A |

### 2.3 工作原理

#### 2.3.1 官方明确的部分

Qoder 官方对生成机制只有三段关键描述：

1. **多 Agent 架构，分阶段生成。**
2. **自动为代码库建立索引**，通过工具为 Agent 提供“工程感知能力”。
3. 多 Agent 系统对代码库**分析建模、规划文档结构、平衡知识深度与阅读效率**，把工程知识刻画到不同类型文档中。

此外，官方明确增量更新**基于提交差异**，且仅支持 Git 仓库；首次生成会同时产出 Wiki 与知识卡片。

#### 2.3.2 参考实现（推断，用于指导设计）

> Qoder 未公开其 Agent 编排、检索策略与校验流程。下图是依据官方描述、产物结构和界面行为重建的**参考实现**，不代表 Qoder 的实际实现。

```mermaid
flowchart LR
  A["Git 工作区"] --> B["扫描与索引<br/>文件清单 / 忽略规则 / 语言 / 构建文件"]
  B --> C["代码建模<br/>模块 / 依赖 / 符号 / 路由 / 配置"]
  C --> D["文档规划<br/>模板 / 读者 / 页面树 / 深度"]
  D --> E["页面级证据检索<br/>按目标选取代码与文档"]
  E --> F["页面生成<br/>Markdown / 图表 / 代码引用"]
  F --> G["装配与校验<br/>目录 / 交叉链接 / 元数据"]
  G --> H["持久化<br/>content / meta / knowledge"]
  H --> I["消费<br/>IDE 阅读 / Agent 引用 / Git 共享"]
  I --> J["增量更新<br/>commit diff → 受影响知识"]
  J --> E
```

| 阶段 | 做什么 | 关键产出 | 证据等级 |
|---|---|---|---|
| **扫描** | 枚举文件、应用忽略规则、识别语言与构建系统 | 文件清单、仓库画像 | A（索引） |
| **索引** | 建立模块、依赖、符号、路由、配置索引 | 可供 Agent 查询的代码库索引 | A（官方明确“建立索引”） |
| **规划** | 选择模板、确定读者、规划页面树与每页目标 | 文档结构 / `wiki_plan.yaml` | A（官方明确“规划文档结构”） |
| **证据检索** | 按页面目标检索相关代码、文档、调用链 | 页面级证据包 | B（官方称 Agent 通过工具获得工程感知） |
| **生成** | 写页面正文、图表、代码引用 | Markdown 页面 | A（产物可见） |
| **装配** | 生成目录、交叉链接、元数据、知识卡片 | 完整 Wiki 产物 | B（产物结构可见） |
| **校验** | 检查引用、链接、一致性、覆盖率 | 质量报告 / 重试 | C（官方未公开，推断） |
| **持久化** | 写入 `content/`、`meta/`、`knowledge/` | `.qoder/repowiki` | A |
| **增量** | diff → 受影响页面 → 局部重建 | 更新后的知识 | A |

**关键洞察**：Qoder 把“索引”作为一等公民，而不是把整个仓库塞进上下文。这与 DSH 的“工具 + 接缝”哲学高度一致——**索引是能力，不是提示词**。

**公开信息的空白（设计时必须自行定义）**：

| 未知项 | 为什么重要 | 本设计的替代方案 |
|---|---|---|
| 页面与代码的映射结构 | 决定增量更新能否精确 | `source anchors`（glob/file/symbol/route/configKey） |
| 影响判定算法 | 决定漏更率 | `git diff -M` + 行区间 → 符号 → 页面 + 1 跳闭包 |
| 校验/重试策略 | 决定内容可信度 | 确定性校验 + LLM 复核 + 最多 2 次重写 |
| `repowiki-metadata.json` schema | 决定互操作与迁移 | 自定义 `meta/repowiki.json`；Qoder 仅做 Markdown/plan 兼容 |
| 索引是否含向量检索 | 决定语义召回上限 | MVP 用 BM25 + 别名 + 图扩展；P2 可选向量 |

### 2.4 交互方式

#### 2.4.1 端到端用户旅程

| 阶段 | 用户动作 | 系统反馈 | 设计要点 |
|---|---|---|---|
| **入口** | 侧栏「更多」→「Repo Wiki」 | 仓库列表，支持按生成状态筛选（全部/已生成/未生成）、卡片/列表视图、刷新 | 入口不抢主流程，但可 pin 到侧栏 |
| **选库** | 搜索目标仓库，打开 | 未生成则显示「前往生成」 | 以“仓库”而非“项目”为粒度 |
| **生成配置** | 选择语言；检查自动更新、自动导出、智能体引用 | 自动更新与自动导出默认关闭；引用开关默认值以当前版本为准 | 默认保守，避免意外写入/自动消耗 |
| **生成中** | 观察进度；可暂停/继续；可恢复错误重试 | 分阶段进度、页面级状态 | 长任务必须可中断、可恢复 |
| **阅读** | 左侧页面树 + 搜索；右侧正文 | 概览显示生成状态、文档数、更新时间 | 目录是导航，不是文件列表 |
| **知识卡片** | 切换到卡片视图 | 卡片列表，含标题、摘要、类型标签 | 与 Wiki 分开维护 |
| **任务内使用** | 开启引用；在任务中提问或改动 | Agent 自动查阅相关知识 | 知识进入“工作流”，而不是另开一个页面 |
| **人工修改** | `/knowledge-edit` skill；或直接改导出文件后导入 | 局部修改、补充章节、重写页面 | 人工修订要能回流 |
| **共享** | 导出 → Git push；或「从团队拉取」 | 团队成员 `git pull` 后导入 | 以 Git 为分发渠道，降低平台锁定 |

#### 2.4.2 真实界面结构（官方截图样本）

以下目录来自 Qoder 官方文档截图（`deploy-manager` 仓库，2026-10-23），是理解其“页面规划粒度”的最直接证据：

```text
Repo Wiki / deploy-manager
├── Search Wiki pages
├── Repo Wiki Overview                         [Generated]
├── 项目概览与业务场景
├── 核心概念与领域模型
├── 技术架构总览
│   ├── HTTP 入口与 API 契约
│   ├── 领域服务层职责划分
│   ├── 部署引擎与沙箱适配
│   └── 持久化与数据落地布局
├── 端到端发布与重新部署链路
│   ├── 部署规划与方案冻结
│   ├── 审批、权限与执行门禁
│   ├── 迁移执行与幂等账本
│   └── 沙箱发布、健康检查与灰度指针
├── 本地运行、演示数据与夹具
└── 当前实现边界与待补充事项
```

**可提炼的规划规律**：

1. **两层半结构**：概览 → 专题（技术架构 / 端到端链路）→ 子页；不是无限层级。
2. **每页一个“可回答的问题”**：如“HTTP 入口与 API 契约”“迁移执行与幂等账本”，而不是“模块 A”“文件 B”。
3. **业务链路与技术分层并列**：既有“技术架构总览”，也有“端到端发布链路”，兼顾静态结构与动态流程。
4. **显式的边界页**：“当前实现边界与待补充事项”——承认不知道的部分，比假装完整更可信。
5. **规模适中**：14 页覆盖一个中等仓库；不是“每个文件一页”的穷举。

**概览页字段（官方截图）**：

| 字段 | 截图示例 | 含义 |
|---|---|---|
| Language | English / 简体中文 | 当前查看/生成的语言 |
| Generation Status | Generated | 生成状态 |
| Wiki Files | 14/14 Done, 0 failed | 页面完成数/总数、失败数 |
| Update Time | Oct 23, 2026, 10:39 AM | 最近更新时间 |
| 操作 | Regenerate / More (…) | 重新生成、导入导出等 |

**知识卡片视图字段（官方截图）**：

| 字段/操作 | 截图示例 | 含义 |
|---|---|---|
| Knowledge Cards | 31 | 卡片总数 |
| 卡片项 | 标题 + 摘要 + `Architecture Design` 标签 | 高密度知识单元 |
| Auto Update | 开关 | 代码变更后自动增量更新 |
| Auto Export | 开关 | 生成后自动导出到 `.qoder/repowiki` |
| Citation | 开关 | 允许 Agent 在任务中引用 |
| Pull from team | 菜单项 | 拉取团队已发布知识 |
| Export to / Import from | `.qoder/repowiki` | 与仓库目录互导 |

#### 2.4.3 生成配置的三个开关

| 开关 | 默认 | 行为 | 设计含义 |
|---|---|---|---|
| **自动更新** | 关闭 | 代码变化后自动增量更新 | 把“维护”从人的记忆变成系统行为 |
| **自动导出** | 关闭 | 生成/更新后写入 `.qoder/repowiki` | 产物默认留在工具内，显式选择才落盘 |
| **智能体引用** | 未明确（文档仅说明可开启） | 任务中自动使用项目知识 | 知识消费是可选能力，不是强制注入 |

**默认值体现的克制**：生成有成本、写入有副作用、注入有上下文代价。官方只明确“自动更新、自动导出默认关闭”；引用开关是否默认开启，需以具体版本为准，不应在设计中假定。

### 2.5 产物与数据契约

#### 2.5.1 已知路径

Qoder 官方明确提到以下路径元素：

| 路径 | 含义 | 证据 |
|---|---|---|
| `.qoder/repowiki/wiki_plan.yaml` | 生成规划配置 | A |
| `.qoder/repowiki/content/` | Wiki 正文（Markdown） | A |
| `.qoder/repowiki/meta/repowiki-metadata.json` | Wiki 元数据 | A |
| `.qoder/repowiki/knowledge/<lang>/` | 知识卡片 | A |
| `.qoder/repowiki/<lang>/` | 按语言分的根目录（en / zh） | A |

> 官方未公开 `repowiki-metadata.json` 的内部 schema，也未给出完整的目录树。上面是“已知元素的集合”，不是精确布局。

#### 2.5.2 `wiki_plan.yaml`：最值得学习的接口

官方示例（原文）：

```yaml
version: 1

repowiki:
  template: architecture          # architecture | product_requirement
  notes:
    - text: "文档面向新入职工程师，重点解释业务流程和模块关系"
  documents:
    - title: "系统架构概览"
      goal: "说明核心模块、职责与依赖关系"
    - title: "订单流程"
      goal: "说明订单创建、支付与取消流程"
      parent: "系统架构概览"

knowledgecard:
  notes:
    - text: "重点整理订单模块的架构设计和代码规约"
```

**为什么这个设计重要**：

- 它把“文档结构”从模型的黑箱输出变成**人类可评审的输入**。
- 它支持 `parent`，天然表达页面树。
- 它支持 `goal` + `hints`，把“这一页要回答什么问题”显式化。
- 它支持 `template`，让不同页面类型（架构、流程、API）有不同章节骨架。
- 它可以随 Git 提交共享，团队可以像 review 代码一样 review 文档规划。

**对我们的启示**：DSH 插件必须把 `wiki_plan.yaml` 作为一等接口，而不是“高级配置”。

### 2.6 更新与一致性机制

| 场景 | 触发 | 行为 | 约束 |
|---|---|---|---|
| **首次生成** | 用户点击生成 | 同时生成 Wiki + 知识卡片 | 基于当前分支与工作区 |
| **手动增量更新** | 用户点击更新 | 根据 commit diff 更新受影响知识 | 仅 Git 仓库 |
| **自动增量更新** | 代码提交后 | 自动执行增量更新 | 默认关闭；可配置 |
| **暂停/继续** | 生成/更新中 | 保存进度，之后继续 | 可恢复错误可重试 |
| **重新生成** | 用户选择 | 重新规划结构或整体重建，替换已有内容 | 会覆盖已有生成内容 |
| **人工修改** | `/knowledge-edit` 或直接改文件 | 局部修改、补充、重写；导入后生效 | 后续代码更新可能重新生成受影响页面 |
| **团队拉取** | 「从团队拉取」 | 用团队版本替换当前分支/语言的本地知识 | 会覆盖本地修订 |

**一致性策略的关键点**：

1. **以 commit 为边界**，而不是以“文件保存”为边界；避免生成过程中的半成品污染。
2. **增量更新是“受影响知识”级别**，不是“整页重写”；这要求页面与代码之间有可维护的映射。
3. **人工修订与自动生成并存**，但官方明确提示“后续代码更新可能重新生成受影响页面”，即人工修订不是绝对保护。
4. **重新生成是逃生舱**：当结构本身不再适用时，允许推倒重来。

### 2.7 规模、性能与限制

Qoder 的公开口径随版本/区域变化，需谨慎对待：

| 指标 | 公开口径 | 来源 | 解读 |
|---|---:|---|---|
| 单项目文件上限 | 6,000 | Qoder Forum（2025-09） | 早期限制 |
| 单项目文件上限 | 10,000 | Alibaba Cloud Lingma 文档 | Qoder CN 同源口径 |
| 代码库分析文件上限 | 100,000 | qoder.com 首页（2026-10） | 可能指代码库索引，不等于 Repo Wiki 生成上限 |
| 4,000 文件生成耗时 | 约 120 分钟 | Alibaba Cloud Lingma 文档 | 全量生成，非增量 |
| 增量更新代码变更 | 建议 < 10,000 行 | Alibaba Cloud Lingma 文档 | 超过可能构建失败 |
| 单用户可生成仓库数 | 5 个 | Qoder Forum（2025-09） | 早期限制，可能已放宽 |
| 累计生成量 | 400k+ wikis | qoder.com 首页 | 产品规模指标 |

**结论**：这些数字不是同一个指标，也不在同一时间点。DSH 插件不应硬编码任何上限，而应做成**可配置 + 可降级 + 可观测**：超过阈值时提示用户缩小范围、排除路径或分模块生成，而不是直接失败。

### 2.8 安全与隐私

Qoder 官方明确：

- 知识生成流程在**本地客户端**运行。
- Agent 只根据任务需要读取仓库中的必要文件。
- **不会在生成时整体上传代码仓库**。
- 生成内容保存在本地，导出后写入 `.qoder/repowiki`。
- 团队共享时，同步的是**已发布的知识内容**。
- 不要把凭证、个人信息或受限数据写入仓库文档。

**需要补充的批判性解读**：

> “本地生成”不等于“代码永不离开本机”。官方措辞是“不会整体上传”，而不是“不上传任何代码片段”。生成过程仍需要调用模型；被选中的代码片段、文件内容、检索结果可能进入模型请求。企业落地时必须确认：模型路由在哪里、是否开启数据留存、是否允许代码片段出境/出内网。对于强合规场景，唯一可靠的方案是**本地模型 + 本地生成**。

---

## 3. 典型适用场景与边界

### 3.1 适用场景

| 场景 | 典型问题 | Repo Wiki 的价值 | 注意点 |
|---|---|---|---|
| **新人 onboarding** | “这个项目怎么跑？核心模块有哪些？” | 提供从概览到专题的阅读路径，减少“从 README 跳到源码”的断层 | 需要保持更新，否则会误导新人 |
| **架构与调用链查询** | “订单创建流程涉及哪些模块？” | 页面级知识 + 代码引用，快速定位实现与依赖 | 运行时行为仍需以代码/日志为准 |
| **改动前影响评估** | “改这个接口会影响谁？” | 模块关系、依赖图、业务流程页提供影响面假设 | 不能替代调用链分析工具/测试 |
| **遗留系统知识化** | “原作者走了，没人懂这套系统” | 把隐性知识显性化，形成可交接的资产 | 需要业务专家校验关键结论 |
| **代码审查/重构** | “新代码是否符合项目约定？” | 知识卡片中的 Spec/规约可直接作为审查上下文 | 规约需要人工维护，不能全靠模型推断 |
| **Agent 上下文供给** | “让 Agent 改代码但不跑偏” | 任务中自动引用项目知识，减少 grep 与试错 | 注入有 token 成本，需控制预算 |
| **团队知识共享** | “每个人脑子里的架构都不一样” | 导出到 Git，形成单一事实源（至少是单一“描述源”） | 需要明确“文档 vs 代码”的权威顺序 |

### 3.2 反模式（不适合的场景）

| 反模式 | 为什么不适合 | 更合适的做法 |
|---|---|---|
| **高频实验性仓库** | 文档永远追不上代码，增量更新变成噪音 | 只生成“稳定边界”文档，或关闭自动更新 |
| **把 Wiki 当运行时真相** | 文档描述的是静态结构，不是实时行为 | 排障用 traces / logs / metrics；Wiki 只做导航 |
| **超大 monorepo 一次性全量** | 页面泛化、关键模块被稀释、生成时间不可控 | 按业务模块分治，再生成总览 |
| **非 Git 仓库的增量** | 没有 diff 基线，无法做影响分析 | 全量生成 + 手动触发；或先接入 Git |
| **强合规且禁止代码出内网** | 模型调用仍可能发送代码片段 | 本地模型 + 本地生成 + 审计 |
| **期待“零维护”** | 代码变了，文档必然过期 | 把更新纳入 CI/提交钩子，设置 freshness 门禁 |
| **让 Wiki 代替测试** | 文档无法证明行为正确 | 测试、类型检查、运行输出仍是最终依据 |

---

## 4. 能力对比

### 4.1 横向对比

| 维度 | Qoder Repo Wiki | Google Code Wiki | DeepWiki | **DSH RepoWiki（目标）** |
|---|---|---|---|---|
| **形态** | IDE 内置功能 | Web 平台 | Web 平台 + MCP | DSH 插件（本地） |
| **代码位置** | 本地工作区 | 公开 GitHub | 公开 GitHub；私有经 Devin | 本地工作区 |
| **私有仓库** | 支持 | 暂不支持（Gemini CLI 扩展 waitlist） | 需 Devin 付费账号 | 支持 |
| **生成架构** | 多 Agent、分阶段、本地 | AI Agent、每次变更重生成 | Devin 索引、对话式 | 多 Agent、证据约束、本地 |
| **结构规划** | `wiki_plan.yaml` + 模板 | 自动，不接受人工编辑 | 自动 | plan-first + YAML |
| **产物** | Markdown + metadata + 知识卡片 | 托管页面 + 图表 | 托管页面 + 图表 | Markdown + metadata + 卡片 |
| **增量更新** | Git diff | 每次变更重新生成 | 公共仓库约周更；私有未公开 | Git diff + 影响分析 |
| **人工干预** | 计划、`/knowledge-edit`、手改导入 | 不支持编辑/PR | 有限 | 计划、frontmatter、手改保护 |
| **Agent 消费** | 智能体引用 | Gemini chat | chat + MCP | tools + prompt + 可选注入 |
| **共享** | Git / 团队拉取 | URL | URL | Git / CI |
| **多语言** | English / 简体中文 | 以英文为主 | 以英文为主 | en/zh（P2） |
| **成本** | Credits | 公开仓库免费 | 公开免费；私有付费 | 自付模型 token |
| **可扩展** | 产品封闭（产物可导出） | 封闭 | MCP 可集成，核心封闭 | 开源插件，可替换 |

> 注：DeepWiki 的私有仓库、刷新策略、导出限制来自第三方 2026-10 对比资料，官方未完整公开；Code Wiki 的私有仓库能力以其 FAQ 的 waitlist 为准。

### 4.2 Qoder 的差异化

1. **闭环而非单点。** 生成、阅读、任务引用、修改、共享在同一工作区完成；Code Wiki / DeepWiki 更偏“读”。
2. **本地 + 私有仓库友好。** 不要求把代码托管到第三方平台；对国内企业尤其重要。
3. **结构可规划。** `wiki_plan.yaml` 让文档结构成为可评审的工程输入。
4. **产物可带走。** Markdown + metadata 落在仓库内，可 diff、可 review、可迁移。
5. **双表示。** Wiki 页面 + 知识卡片，分别服务人与 Agent。
6. **增量更新。** 基于 commit diff 的维护闭环，而不是“重新生成一遍”。

### 4.3 对 DSH 插件的八条设计启示

| # | 启示 | 落到设计 |
|---|---|---|
| 1 | 三层资产 | `index` / `content` / `knowledge` 三层产物 |
| 2 | 结构先于内容 | `wiki_plan.yaml` 一等接口，可手写、可生成、可校验 |
| 3 | 产物即代码 | `.dsh/repowiki` 全部为文本，可 Git diff |
| 4 | 增量是产品 | `git diff -M` + source anchors + impact closure |
| 5 | 双表示 | 页面给人，卡片给 Agent，分别有长度预算 |
| 6 | 引用是一等公民 | 每条结论必须有 `path:line`，校验失败即降级 |
| 7 | 本地优先，但诚实 | 明确模型调用边界；支持本地模型路由 |
| 8 | 不复制 UI | MVP 用命令 + Markdown；UI 后置，避免范围爆炸 |

---

## 5. DSH 插件设计

### 5.1 定位与设计原则

**定位**：`dsh-plugin-repowiki` 是 DeepSeek Harness 的**项目知识层**。它不取代 `read` / `grep` / `glob`，而是在它们之上提供“已经理解过的结构”；它不取代测试，而是帮助 Agent 更快找到该读什么、该改哪里、可能影响谁。

**八条设计原则**：

| # | 原则 | 含义 | 反例 |
|---|---|---|---|
| 1 | **文档是投影** | 只描述代码中可验证的事实 | 用“最佳实践”口吻编造不存在的设计 |
| 2 | **证据先于写作** | 先产出带引用的 EvidencePack，再写正文 | 让模型边读边写，最后补引用 |
| 3 | **结构先于内容** | 先规划页面树，再生成页面 | 直接让模型“写一份架构文档” |
| 4 | **增量优于全量** | 默认更新受影响页面 | 每次 commit 全量重生成 |
| 5 | **人类可干预** | 计划、frontmatter、手动修改都可控 | 生成后覆盖用户修订 |
| 6 | **可验证** | 引用、链接、图表、覆盖率都可检查 | 只做“看起来像”的评审 |
| 7 | **上下文经济** | 稳定前缀 + 按需检索 + 严格预算 | 把整本 Wiki 注入 system prompt |
| 8 | **插件化** | 服务、工具、命令、UI 都可替换 | 把逻辑写进 agent loop 或 fork harness |

### 5.2 目标与非目标

| 类型 | 内容 |
|---|---|
| **目标** | 为本地 Git 仓库生成可验证、可增量维护、可被 Agent 消费的结构化项目知识；产物可读、可 diff、可共享。 |
| **目标** | 与 DSH 的 tools / commands / jobs / workflow / system prompt / UI 接缝原生集成，而不是外挂脚本。 |
| **目标** | 在 50k–200k LOC 的仓库上，以可接受的成本（时间/Token）产出 8–24 页高质量文档。 |
| **非目标** | 不做云端 SaaS、多租户、账号体系、计费。 |
| **非目标** | 不做运行时观测、日志分析、性能剖析。 |
| **非目标** | 不做代码生成、重构、自动修复。 |
| **非目标** | 不在 MVP 支持非 Git 仓库的增量更新。 |
| **非目标** | 不在 MVP 支持二进制/Office/图片内容的理解。 |
| **非目标** | 不做组织级多仓库知识图谱（后续可扩展）。 |

### 5.3 范围与优先级

| 优先级 | 能力 | 为什么是这个优先级 | 验收信号 |
|---|---|---|---|
| **P0** | 仓库扫描 + 忽略规则 + 语言/构建识别 | 没有可靠的输入，后面全是幻觉 | 能正确排除 `node_modules` / `dist` / 二进制；输出仓库画像 |
| **P0** | 模块/依赖/符号索引（轻量） | 让 Agent 有“工程感知”，而不是每次 grep | 能回答“谁依赖谁”“符号定义在哪” |
| **P0** | `wiki_plan.yaml` 规划 + 校验 | 结构决定质量上限 | 页面树合法、覆盖核心模块、可手改 |
| **P0** | 单 Agent 串行生成 8–12 页 | 先验证“能产出可信内容” | 每页有引用、有结构、无占位符 |
| **P0** | 产物持久化 `.dsh/repowiki` | 没有产物就没有产品 | Markdown + metadata 可读、可 diff |
| **P0** | `wiki_search` / `wiki_read` | 让 Agent 真正用起来 | 检索命中率 ≥ 80%，读取有预算 |
| **P0** | 引用校验（路径/行号/链接） | 防止“看起来对” | 引用有效率 ≥ 95% |
| **P1** | 增量更新（diff + 影响分析） | 决定长期可用性 | 10 文件 commit 只更新 ≤ 3 页 |
| **P1** | 后台 Job + 暂停/恢复 | 生成是长任务 | 可中断、可恢复、不丢进度 |
| **P1** | 多 Agent 并行 + 校验 Agent | 提升速度与质量 | 24 页在可控时间内完成 |
| **P1** | 知识卡片 | Agent 消费的高密度形态 | 每模块 1 张 + 全局 3 张 |
| **P1** | `/wiki` 命令 + 状态/新鲜度 | 人类入口 | 一条命令看到状态、触发、导出 |
| **P1** | 手动修改保护 | 人类修订不能被静默覆盖 | 检测 hash 变化，生成 `.suggested.md` |
| **P2** | Web 侧栏面板 | 体验对齐 Qoder | 页面树、搜索、Markdown 渲染 |
| **P2** | Qoder 产物互操作 | 降低迁移成本 | `wiki_plan.yaml` + Markdown 可导入导出 |
| **P2** | 多语言（en/zh） | 团队/开源场景 | 分目录、术语表一致 |
| **P2** | 混合检索（BM25 + 向量） | 提升语义召回 | hit@5 提升 ≥ 10% |
| **P2** | 团队共享 / CI 门禁 | 组织级落地 | PR 检查 freshness/引用 |
| **P2** | 影响分析 Bot | 改动前提示 | PR 评论列出受影响页面 |

### 5.4 总体架构

```mermaid
flowchart TB
  subgraph UI["交互层"]
    CMD["/wiki 命令"]
    TOOLS["wiki_search / wiki_read / wiki_generate"]
    PANEL["Web 侧栏面板（P2）"]
    CARDS["工具卡片 / 进度"]
  end

  subgraph CORE["RepoWikiService（ctx.repoWiki）"]
    SCAN["Scanner<br/>git / ignore / inventory"]
    INDEX["Indexer<br/>modules / symbols / routes / config"]
    PLAN["Planner<br/>wiki_plan.yaml"]
    ORCH["Orchestrator<br/>jobs + workflow"]
    WRITE["Writer / Verifier<br/>subagents"]
    STORE["Store<br/>atomic writes / metadata"]
    RETR["Retriever<br/>BM25 + graph"]
  end

  subgraph DSH["DSH 接缝"]
    FS["ctx.fs"]
    SHELL["ctx.shell"]
    JOBS["ctx.jobs"]
    WF["ctx.workflowEngine"]
    SUB["ctx.subagents"]
    PROMPT["ctx.systemPrompt"]
    EVENTS["session/event"]
  end

  CMD --> ORCH
  TOOLS --> RETR
  PANEL --> STORE
  CARDS --> ORCH

  SCAN --> FS
  SCAN --> SHELL
  INDEX --> FS
  PLAN --> ORCH
  ORCH --> JOBS
  ORCH --> WF
  WF --> SUB
  WRITE --> STORE
  STORE --> FS
  RETR --> STORE
  PLAN --> PROMPT
  STORE --> EVENTS
```

**架构要点**：

1. **Service 是唯一领域入口。** 工具、命令、UI 都调用 `ctx.repoWiki`，不各自实现一套逻辑。
2. **Scanner / Indexer 不调用模型。** 确定性工作用确定性代码做，成本低、可复现。
3. **Orchestrator 通过 DSH 原生 Job / Workflow 跑长任务。** 不自己造并发与取消机制。
4. **Store 只写文件，不写数据库。** 产物是 Git 资产，必须可 diff、可 review、可手改。
5. **Retriever 是只读服务。** 它可以被工具调用，也可以被可选的上下文注入使用。

### 5.5 包结构与插件清单

```text
dsh-plugin-repowiki/
├── package.json
├── cordis.patch.yml
├── tsconfig.json
├── src/
│   ├── index.ts                 # plugin: name / inject / apply
│   ├── config.ts                # schemastery Config
│   ├── service.ts               # RepoWikiService (ctx.repoWiki)
│   ├── scan/
│   │   ├── inventory.ts         # 文件枚举、ignore、语言识别
│   │   ├── git.ts               # root/head/branch/diff
│   │   └── profile.ts           # 仓库画像
│   ├── indexer/
│   │   ├── modules.ts           # 目录/模块/依赖
│   │   ├── symbols.ts           # 轻量符号提取
│   │   ├── routes.ts            # 路由/端点（可选）
│   │   └── configs.ts           # 环境变量/配置键
│   ├── pipeline/
│   │   ├── plan.ts              # 规划 + 校验
│   │   ├── evidence.ts          # 证据包
│   │   ├── write.ts             # 页面生成
│   │   ├── verify.ts            # 校验
│   │   └── persist.ts           # 原子写入
│   ├── workflow/
│   │   ├── script.ts            # 内置 Workflow 脚本
│   │   └── schemas.ts           # 结构化输出 schema
│   ├── store/
│   │   ├── layout.ts            # 目录布局
│   │   ├── metadata.ts          # repowiki.json
│   │   └── migrate.ts           # schema 迁移
│   ├── tools/
│   │   ├── search.ts
│   │   ├── read.ts
│   │   └── generate.ts
│   ├── command.ts               # /wiki
│   └── prompt.ts                # system prompt section
├── client/                      # 可选：Web 侧栏面板（P2）
│   ├── index.ts
│   └── panel.tsx
└── test/
    ├── fixtures/                # 小型仓库夹具
    ├── golden/                  # 黄金页面
    └── e2e/                     # 端到端
```

`package.json`（关键字段）：

```json
{
  "name": "dsh-plugin-repowiki",
  "version": "0.1.0",
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./package.json": "./package.json"
  },
  "files": ["lib/index.js", "lib/types/**/*.d.ts", "cordis.patch.yml"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" }
  },
  "peerDependencies": {
    "@deepseek-ai/cordis": "4.0.6-alpha.1",
    "@deepseek-ai/dsh-tools": "0.2.2-alpha.2",
    "@deepseek-ai/dsh-fs": "0.2.2-alpha.2",
    "@deepseek-ai/dsh-jobs": "0.2.2-alpha.2",
    "@deepseek-ai/dsh-commands": "0.2.2-alpha.2",
    "@deepseek-ai/dsh-system-prompt": "0.2.2-alpha.2",
    "@deepseek-ai/dsh-workflow": "0.2.2-alpha.2"
  },
  "peerDependenciesMeta": {
    "@deepseek-ai/dsh-workflow": { "optional": true }
  }
}
```

> Alpha 阶段建议**精确锁定** peer 版本，而不是使用 `^0.2.x`：prerelease 的 semver 范围容易产生意外匹配。升级 DSH 时统一改这一处，并跑契约测试。

`cordis.patch.yml`：

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

> DSH 的 bundle 通过 `package.json` 的 `dsh.bundle.patch` 声明 patch 文件，profile 按“bundle → profile patch → home patch → CLI overlay”的顺序叠加。第三方插件也可以不发布 bundle，直接由用户在 `cordis.patch.yml` 中插入一行；bundle 只是更易安装的分发形态。

### 5.6 服务接口

```ts
// src/service.ts
import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'

export interface Config {
  outputDir: string
  maxFiles: number
  maxPages: number
  maxFileBytes: number
  concurrency: number
  defaultLanguage: 'zh' | 'en'
  defaultTemplate: 'architecture' | 'product_requirement'
  autoUpdate: boolean
}

export interface WikiStatus {
  root: string
  head: string
  branch: string
  dirty: boolean
  pages: number
  cards: number
  fresh: number
  stale: number
  failed: number
  lastGeneratedAt?: string
  generatorVersion: string
}

export interface GenerateRequest {
  root: string
  mode: 'full' | 'update'
  language: 'zh' | 'en'
  template?: 'architecture' | 'product_requirement'
  pages?: string[]          // 限定页面 ID；为空则按 plan
  dryRun?: boolean
  force?: boolean           // 覆盖人工修改
}

export interface GenerateResult {
  runId: string
  mode: 'full' | 'update'
  pagesWritten: number
  pagesSkipped: number
  pagesFailed: number
  citations: { total: number; valid: number }
  tokens: { input: number; output: number }
  durationMs: number
  warnings: string[]
}

export declare class RepoWikiService extends Service {
  constructor(ctx: Context, config: Config)

  resolveRoot(agent?: Agent): Promise<string>
  status(root: string): Promise<WikiStatus>
  plan(root: string, opts?: PlanOptions): Promise<WikiPlan>
  generate(req: GenerateRequest, signal: AbortSignal): Promise<GenerateResult>
  update(req: Omit<GenerateRequest, 'mode'>, signal: AbortSignal): Promise<GenerateResult>
  search(root: string, query: string, opts?: SearchOptions): Promise<SearchHit[]>
  read(root: string, pageId: string, opts?: ReadOptions): Promise<PageContent>
  impact(root: string, changes: ChangeSet): Promise<ImpactReport>
  export(root: string, target: 'dsh' | 'qoder'): Promise<ExportReport>
  import(root: string, source: 'dsh' | 'qoder'): Promise<ImportReport>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    repoWiki: RepoWikiService
  }
}
```

**设计说明**：

- `status` 必须极轻量，供命令、工具、UI 高频调用。
- `generate` / `update` 接受 `AbortSignal`，与 Job / Workflow 的取消链路对齐。
- `impact` 是增量更新的核心；它也可以单独暴露给 Agent，用于“改动前评估”。
- `export` / `import` 是互操作边界，不污染核心管线。

### 5.7 模型侧接口

| 接口 | 类型 | 用途 | 调用时机 | 输出预算 |
|---|---|---|---|---|
| `wiki_search` | Tool | 按自然语言/符号检索 Wiki 页面与章节 | Agent 需要项目背景、定位模块、查找约定 | ≤ 2k tokens |
| `wiki_read` | Tool | 读取指定页面或章节的正文与引用 | 搜索命中后精读 | ≤ 6k tokens |
| `wiki_generate` | Tool | 生成/更新/导出/查看状态 | 用户明确要求，或 Agent 判断知识缺失 | 结果摘要 ≤ 1k tokens |
| `/wiki` | Command | 人类入口：status / generate / update / export / plan | 用户主动触发 | 文本摘要 |
| `repowiki:policy` | Prompt section | 告诉模型“何时查 Wiki、如何引用、不要编造” | 每次请求 | ≤ 120 tokens |

**为什么是三个工具而不是十个**：

- DSH 的工具 schema 会进入每次请求的 system prompt；工具越多，固定 token 成本越高。
- `wiki_search` / `wiki_read` 是高频只读操作，值得独立 schema。
- 生成/更新/导出是低频管理操作，合并为一个 `action` 枚举，降低认知负担。
- 人类操作用 `/wiki` 命令，避免模型为了“执行命令”而消耗一次 turn。

**工具注册示例**：

```ts
import { defineTool } from '@deepseek-ai/dsh-tools'

ctx.tools.register(defineTool({
  name: 'wiki_search',
  description:
    'Search the generated repository wiki. Use it before reading large parts of the codebase, ' +
    'when you need module responsibilities, call paths, conventions, or change impact. ' +
    'Returns page ids, headings, snippets, and freshness. Prefer wiki_read for full context.',
  parameters: {
    query: { type: 'string', required: true, description: 'Natural language or code identifier.' },
    limit: { type: 'number', description: 'Max results, default 5, max 10.' },
  },
  output: {
    schema: {
      type: 'object',
      properties: {
        hits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pageId: { type: 'string' },
              title: { type: 'string' },
              heading: { type: 'string' },
              snippet: { type: 'string' },
              score: { type: 'number' },
              stale: { type: 'boolean' },
            },
            required: ['pageId', 'title', 'snippet', 'score', 'stale'],
          },
        },
      },
      required: ['hits'],
    },
    render: (_args, value) => [{ type: 'text', text: renderHits(value.hits) }],
  },
  async execute(args, exec) {
    const root = await ctx.repoWiki.resolveRoot(exec.agent)
    return { hits: await ctx.repoWiki.search(root, args.query, { limit: args.limit }) }
  },
}))
```

`/wiki` 命令：

```ts
ctx.commands.register({
  name: 'wiki',
  description: 'Inspect, generate, update, or export the repository wiki.',
  input: { hint: 'status | generate | update | export | plan' },
  async handler({ agent, rawInput, signal }) {
    const [verb = 'status', ...rest] = rawInput.trim().split(/\s+/)
    switch (verb) {
      case 'status': return { kind: 'success', text: await renderStatus(agent) }
      case 'generate': return startGeneration(agent, rest, signal)
      case 'update': return startUpdate(agent, rest, signal)
      case 'export': return exportWiki(agent, rest)
      default: return { kind: 'error', text: `Unknown subcommand: ${verb}` }
    }
  },
})
```

**System prompt section**（保持短、稳定、KV cache 友好）：

```ts
ctx.systemPrompt.section({
  name: 'repowiki:policy',
  order: ctx.systemPrompt.getSectionOrder('TOOL_SESSION_QUERY') + 10,
  text: [
    'A repository wiki may exist under .dsh/repowiki.',
    'Use wiki_search before broad code exploration when the task involves architecture,',
    'module ownership, call paths, conventions, or change impact. Use wiki_read for detail.',
    'Wiki pages are generated context, not ground truth. Verify critical claims against code,',
    'and cite paths when you rely on them. Never invent a page or a citation.',
  ].join(' '),
})
```

### 5.8 生成流水线

#### 5.8.1 阶段总表

| 阶段 | 做什么 | 是否调用模型 | 产出 | 失败处理 |
|---|---|---|---|---|
| **S0 Preflight** | 解析 Git root/HEAD/branch/dirty；应用 ignore；枚举文件；识别语言/构建文件；检查上限 | 否 | `RepoProfile` | 直接失败并给出可操作提示（排除路径/缩小范围） |
| **S1 Index** | 模块/目录树、依赖边、轻量符号、路由、配置键、文档清单 | 否 | `RepoIndex` | 降级为“文件级索引”，继续生成 |
| **S2 Plan** | 选模板、定读者、规划页面树、每页 goal/hints/sources | 是（1 次） | `WikiPlan` + `wiki_plan.yaml` | 校验失败则回退到默认模板 + 规则化页面树 |
| **S3 Evidence** | 按页面检索候选文件、读片段、抽取 claims + citations | 是（每页 1 次） | `EvidencePack` | 证据不足则标记 `needs-review`，不写正文 |
| **S4 Write** | 按模板写正文、图表、交叉链接、源码索引 | 是（每页 1 次） | `PageDraft` | 单页失败不影响其他页；记录错误 |
| **S5 Verify** | 引用/链接/图表/结构/覆盖率校验；必要时 LLM 复核 | 是（可选） | `VerificationReport` | 低于阈值则重写，最多 2 次 |
| **S6 Persist** | 原子写入 Markdown/metadata/index/cards；更新状态 | 否 | `.dsh/repowiki` | 写入失败回滚单页；保留旧版本 |

#### 5.8.2 时序

```mermaid
sequenceDiagram
  participant U as User
  participant S as RepoWikiService
  participant J as JobRegistry
  participant W as Workflow
  participant A as Subagent
  participant F as RepoWikiFiles

  U->>S: generate(root, mode)
  S->>S: S0 Preflight + S1 Index
  S->>S: S2 Plan (1 agent)
  S->>J: start(job, owner)
  J-->>U: jobId + progress
  S->>W: start(script, args, parent)
  loop 每个叶子页面（并发 ≤ N）
    W->>A: evidence(page)
    A-->>W: EvidencePack
    W->>A: write(page, evidence)
    A-->>W: PageDraft
    W->>A: verify(page)
    A-->>W: VerificationReport
  end
  W-->>S: 结构化结果
  S->>F: 原子写入 content/meta/knowledge
  S->>J: settle(completed)
  J-->>U: 完成通知 + 统计
```

#### 5.8.3 每页的证据包（EvidencePack）

```ts
interface EvidencePack {
  pageId: string
  goal: string
  claims: Array<{
    claim: string
    citations: Array<{ path: string; startLine: number; endLine: number; symbol?: string }>
    confidence: 'high' | 'medium' | 'low'
  }>
  keyFiles: Array<{ path: string; role: string; lines?: [number, number] }>
  callPaths: Array<{ from: string; to: string; via: string[]; citations: Citation[] }>
  openQuestions: string[]
}
```

**写作阶段只允许使用 EvidencePack 中的 claims**；需要新增结论时，必须回到代码补充证据，而不是自由发挥。

#### 5.8.4 页面结构模板

````markdown
---
id: arch/http-entry
title: HTTP 入口与 API 契约
goal: 说明请求如何进入系统、路由如何组织、契约如何约束
status: fresh
parent: arch
sources:
  - src/http/server.ts
  - src/http/routes/**
symbols: [createServer, registerRoutes]
generated_at: 2026-10-31T05:00:00Z
source_hash: sha256:...
confidence: high
---

# HTTP 入口与 API 契约

## 这一页回答什么
一句话说明本页范围与不覆盖的内容。

## 关键结论
- 结论 1（引用 `src/http/server.ts:12-48`）
- 结论 2（引用 `src/http/routes/index.ts:8-31`）

## 结构与流程
```mermaid
flowchart LR
  Client --> Router --> Handler --> Service
```

## 实现细节
按“入口 → 路由 → 中间件 → 错误处理”的顺序展开，每段都带引用。

## 源码索引
| 文件 | 作用 | 关键符号 |
|---|---|---|
| `src/http/server.ts` | 创建服务器、注册中间件 | `createServer` |
| `src/http/routes/index.ts` | 路由表 | `registerRoutes` |

## 未决问题
- 需要运行时确认的行为（明确标注“待验证”）。
````

### 5.9 数据模型与目录布局

#### 5.9.1 目录

```text
<repo>/.dsh/repowiki/
├── wiki_plan.yaml                 # 人类可编辑的生成规划
├── meta/
│   ├── repowiki.json              # 页面图、锚点、哈希、状态、统计
│   ├── index.json                 # 模块/符号/路由/配置索引
│   └── version.json               # schemaVersion / generatorVersion
├── content/
│   └── zh/
│       ├── index.md
│       ├── 00-overview.md
│       ├── 10-architecture/
│       │   ├── http-entry.md
│       │   └── ...
│       └── 20-flows/
│           └── ...
└── knowledge/
    └── zh/
        ├── architecture.md
        ├── conventions.md
        └── stack.md
```

**为什么用 `.dsh/repowiki`**：

- DSH 已把 `<projectRoot>/.dsh/` 作为项目级目录（例如 `.dsh/skills`），命名一致。
- 不污染仓库根目录；可通过 `.gitignore` 选择“只本地”或提交共享。
- `outputDir` 可配置，便于 monorepo 或特殊布局。

#### 5.9.2 `meta/repowiki.json`

```json
{
  "schemaVersion": 1,
  "generator": { "name": "dsh-plugin-repowiki", "version": "0.1.0" },
  "repo": {
    "head": "8a35fc5...",
    "branch": "main",
    "dirty": false,
    "fileCount": 1284,
    "loc": 86420,
    "languages": { "ts": 0.71, "py": 0.18, "go": 0.11 }
  },
  "plan": {
    "template": "architecture",
    "audience": "新入职工程师",
    "pageCount": 14
  },
  "pages": [
    {
      "id": "arch/http-entry",
      "title": "HTTP 入口与 API 契约",
      "path": "content/zh/10-architecture/http-entry.md",
      "parent": "arch",
      "status": "fresh",
      "sources": {
        "globs": ["src/http/**"],
        "files": ["src/http/server.ts"],
        "symbols": ["createServer", "registerRoutes"],
        "routes": ["POST /api/orders"],
        "configKeys": ["HTTP_PORT"]
      },
      "hashes": {
        "inputs": "sha256:...",
        "output": "sha256:..."
      },
      "citations": [
        { "path": "src/http/server.ts", "startLine": 12, "endLine": 48 }
      ],
      "confidence": 0.86,
      "generatedAt": "2026-10-31T05:00:00Z"
    }
  ],
  "cards": [
    { "id": "arch", "kind": "architecture", "path": "knowledge/zh/architecture.md" }
  ],
  "stats": {
    "modelCalls": 42,
    "tokensIn": 312000,
    "tokensOut": 48000,
    "durationMs": 1260000
  }
}
```

**状态机**：

```text
absent → planning → generating → fresh
                         ├→ needs-review（证据不足/校验失败）
                         ├→ failed（生成错误）
                         └→ stale（代码变更，尚未更新）
fresh/stale/needs-review → generating（增量/重生成）
```

### 5.10 增量更新

#### 5.10.1 算法

```text
输入：lastHead, currentHead, workingTreeDirty
1. changes = git diff --name-status -M lastHead..currentHead
2. 合并 working tree 的未提交变更（可选，默认不处理脏工作区）
3. 对每个变更文件：
   a. 若为 rename：同时映射旧路径与新路径
   b. 解析变更行区间
   c. 通过 index 找到区间内的符号
4. impacted = pages where
     sourceGlob matches changedPath
     OR explicit file matches
     OR symbol in changedSymbols
     OR route/configKey matches
5. closure = impacted ∪ ancestors(impacted) ∪ 1-hop linked pages
6. 对 closure 中每页：
     inputsHash = hash(page.sources, relevant file hashes, plan, prompt version)
     if inputsHash == storedHash: skip
     else: 重新跑 S3–S5
7. 删除/归档：源文件全部消失的页面 → archived（不物理删除）
8. 更新 metadata：head、hashes、status、stats
9. 输出 ImpactReport：changed / impacted / updated / skipped / needs-review
```

#### 5.10.2 影响传播

```mermaid
flowchart LR
  A["commit diff"] --> B["变更文件 + 行区间"]
  B --> C["符号映射"]
  C --> D["页面 source anchors"]
  D --> E["直接受影响页面"]
  E --> F["父页面 + 1 跳链接页面"]
  F --> G["重生成闭包"]
  G --> H["校验 + 元数据更新"]
```

**关键规则**：

| 规则 | 原因 |
|---|---|
| **rename 检测**（`-M`） | 文件移动不应导致整页重建 |
| **符号级映射** | 改一个函数不应重写整个模块页 |
| **1 跳闭包** | 父页面/被引用页面的摘要可能变化 |
| **inputsHash 跳过** | 避免“改了无关文件也重写” |
| **人工修改保护** | 页面 `output` hash 与存储不一致时，不静默覆盖 |
| **归档而非删除** | 保留历史，避免链接断裂 |
| **脏工作区默认不处理** | 半成品代码不应进入知识库 |

#### 5.10.3 人工修改保护

```text
if page.hashes.output != hash(currentFile):
    if !force:
        write content/zh/.../<page>.suggested.md
        mark page.status = "needs-review"
        report "manual edits detected; suggested update written"
    else:
        overwrite + backup previous file to meta/backups/
```

这比 Qoder 的“重新生成会替换已有内容”更保守，适合 DSH 这种可深度定制的工具。

### 5.11 检索与上下文供给

#### 5.11.1 检索索引

| 索引 | 内容 | 用途 |
|---|---|---|
| **页面索引** | 标题、goal、headings、正文 | BM25 主检索 |
| **别名表** | 模块名、目录名、文件路径、符号名、路由 | 代码标识符直接命中 |
| **图索引** | parent/child、交叉链接 | 结果扩展与去重 |
| **新鲜度** | status、lastGeneratedAt、source hash | 过滤/降权过期页面 |

**检索流程**：

```text
query
  → 分词（中英文混合；代码标识符保留原样）
  → BM25 召回 top 20
  → 别名精确匹配加权
  → 图扩展（父页/子页/链接页）
  → 新鲜度降权（stale × 0.7，needs-review × 0.5）
  → 去重（同页多段合并）
  → 返回 top k（默认 5）
```

#### 5.11.2 上下文预算

| 入口 | 预算 | 说明 |
|---|---:|---|
| `repowiki:policy` section | ≤ 120 tokens | 固定文本，KV cache 友好 |
| `wiki_search` 结果 | ≤ 2k tokens | 每条 snippet ≤ 300 字符，最多 5 条 |
| `wiki_read` 单次 | ≤ 6k tokens | 默认只读一节；整页需显式 `full: true` |
| 自动注入摘要（可选） | ≤ 1.5k tokens | 仅高置信命中；每 turn 最多一次 |
| 整本 Wiki | 不注入 | 永远不把全部页面塞进 system prompt |

#### 5.11.3 自动引用策略（P1/P2）

| 策略 | 行为 | 风险 | 建议 |
|---|---|---|---|
| **纯工具** | 模型自己决定是否 `wiki_search` | 可能不知道 Wiki 存在 | MVP 用 prompt section 提示 |
| **提示式注入** | `agent/pre-step` 检查任务关键词，注入“相关页面标题 + 一句话” | 可能噪音 | P1 可选，严格限流 |
| **摘要注入** | 命中高置信页面时注入 ≤ 1.5k tokens 摘要 | 上下文污染、KV cache 失效 | P2，默认关闭 |
| **强制引用** | 每次请求都注入 | 成本高、易过时 | 不推荐 |

> DSH 的会话日志原则是“模型可见即已记录”。如果使用 `agent.inject()`，必须声明自定义 `MessageSourceMap` 的 source kind，并确保内容可从日志重建；否则应退回纯工具模式。

### 5.12 UI 方案

| 阶段 | 形态 | 能力 | 实现 |
|---|---|---|---|
| **M1** | 命令 + 文件 | `/wiki status/generate/update/export`；Markdown 可在编辑器/文件预览中打开 | `ctx.commands` + `ctx.fs` |
| **M2** | 工具结果卡片 | 生成进度、页面列表、引用统计 | `output.presentationMeta` 持久化结构化事实；Web 端先回退通用卡片 |
| **M4** | Web 侧栏面板 + 专用工具卡片 | 页面树、搜索、Markdown 渲染、状态徽标 | client 插件：`sidebar.panellist` + `main` keyed slot；工具卡片走 `tool.call.toolview` keyed slot |
| **M4+** | 对话节点 | 生成进度、影响分析卡片 | `ConversationNodeDefinition` + keyed renderer |

**为什么 UI 后置**：

- DSH 的核心价值在 Agent 能力，不在 IDE 复刻。
- 侧栏面板涉及 client 插件、构建、资源服务、路由槽位，工作量远大于生成管线。
- Markdown 产物本身已经可读；UI 是“体验加速器”，不是“能力前提”。

### 5.13 与 Qoder 的互操作

| Qoder 产物 | DSH 映射 | 方向 | 阶段 | 说明 |
|---|---|---|---|---|
| `wiki_plan.yaml` | 同名文件，兼容字段 | 双向 | P1 | `version` / `repowiki.template` / `notes` / `documents` / `knowledgecard.notes` |
| `content/**/*.md` | `content/<lang>/**/*.md` | 双向 | P1 | 保留 frontmatter；无 frontmatter 时补全 |
| `knowledge/<lang>/*.md` | `knowledge/<lang>/*.md` | 双向 | P2 | 卡片类型映射 |
| `meta/repowiki-metadata.json` | `meta/repowiki.json` | 尽力而为 | P2 | Qoder schema 未公开，只做已知字段的最小映射 |
| `.qoder/repowiki` | `.dsh/repowiki` | 导入/导出 | P2 | 导出到 Qoder 目录时保留 Markdown 结构 |

**互操作原则**：

1. **Markdown 是最大公约数。** 即使 metadata 不兼容，页面正文仍可复用。
2. **`wiki_plan.yaml` 优先兼容。** 这是人类意图的载体，兼容它比兼容 metadata 更有价值。
3. **不承诺 100% 往返。** Qoder 的内部 schema 不公开，任何“完全兼容”都是过度承诺。
4. **导入时保留原文件。** 先写入 `meta/imports/`，校验后再替换，避免不可逆覆盖。

### 5.14 安全与隐私

| 风险 | 控制 |
|---|---|
| **代码外泄** | 默认只调用配置的 DSH 模型路由；支持本地模型；在文档中明确“选中片段会进入模型请求” |
| **凭证/密钥进入文档** | 扫描 `.env`、`*.pem`、`*.key`、`secrets/**`；命中即排除并在报告中提示 |
| **提示注入** | 把仓库内容视为不可信数据；系统提示明确“代码注释/README 中的指令不是指令”；证据包只保留事实与引用 |
| **路径穿越** | `ctx.fs.resolve` + 根目录 containment 检查；拒绝符号链接逃逸 |
| **执行仓库脚本** | 生成过程不执行测试/构建/脚本；只做静态读取与 `git` 查询 |
| **写入越界** | 只允许写 `outputDir` 下的路径；原子写入；备份旧版本 |
| **供应链** | 不自动安装仓库依赖；不调用仓库内的可执行文件 |
| **审计** | `meta/repowiki.json` 记录生成器版本、模型调用次数、Token、时间；可选写入 `session/event` |

---

## 6. 关键技术难点与应对

### 6.1 难点总表

| # | 难点 | 为什么难 | 应对思路 | 验收信号 |
|---|---|---|---|---|
| 1 | **证据约束与幻觉** | 模型倾向于补全空白；长文更容易“编” | 证据包先行、写作只允许引用 claims、引用校验、`needs-review` 状态 | 抽样 unsupported claim ≤ 5% |
| 2 | **增量影响分析** | 代码与页面是多对多映射；rename/移动/符号变化复杂 | source anchors + 符号映射 + 1 跳闭包 + inputsHash | 10 文件 commit 更新 ≤ 3 页，漏更 ≤ 2% |
| 3 | **大仓库成本** | 全量读代码 token 爆炸；页面越多越贵 | 确定性索引、页面级检索、每页预算、并发上限、增量 | 50k LOC ≤ 400k tokens；200k LOC 可分片 |
| 4 | **跨页一致性** | 不同页面可能对同一模块给出矛盾描述 | 共享 glossary/facts、先写“事实基线”、校验矛盾 | 交叉页矛盾 ≤ 1 处/10 页 |
| 5 | **检索质量** | 中文查询 vs 英文代码标识符；同义词/缩写 | 别名词典、标识符保留、BM25 + 图扩展、可选向量 | hit@5 ≥ 80% |
| 6 | **上下文与 KV cache** | 动态注入会破坏前缀稳定性 | 稳定 section + 按需工具 + 严格预算 | 前缀稳定；单次注入 ≤ 1.5k |
| 7 | **长任务恢复** | 生成可能几十分钟；中断/失败常见 | Job + checkpoint + 页面级幂等 + 原子写 | 中断后恢复不重复已完页 |
| 8 | **多语言** | 术语/代码标识符/结构一致性 | 先写主语言，再翻译；术语表锁定；代码标识符不译 | 中英页面结构一致率 ≥ 95% |
| 9 | **插件 API 演进** | DSH alpha 期接口可能变 | 适配层、版本锁定、契约测试、CI 矩阵 | 升级 DSH 后 1 天内修复 |
| 10 | **安全与提示注入** | 仓库内容不可信；代码片段可能含指令 | 数据/指令分离、内容转义、无执行、密钥扫描 | 红队用例全部拦截 |

### 6.2 深潜一：证据约束生成

**问题**：如果让模型“读代码并写文档”，它会把“看起来合理”的设计也写进去。长文越流畅，越难发现幻觉。

**方案：两阶段 + 三闸门**

```text
阶段 A（Research）：只产出 claims + citations，不写散文
   ↓ 闸门 1：每条 claim 至少 1 个有效引用（路径存在、行号在范围内）
阶段 B（Write）：只使用 claims 写正文；新增结论必须回到 A
   ↓ 闸门 2：正文中的每个事实段落都能映射到 claim
阶段 C（Verify）：确定性校验 + LLM 复核
   ↓ 闸门 3：引用有效率、链接、图表、覆盖率达标；否则重写（≤ 2 次）
```

**关键设计**：

- **允许“不知道”。** `openQuestions` 是合法输出；`待确认` 比编造更有价值。
- **引用必须精确到行。** `src/http/server.ts:12-48`，而不是 `src/http/server.ts`。
- **代码优先。** 当文档与代码冲突时，以代码为准，校验器标记 `contradiction`。
- **抽样人工评审。** 自动指标无法完全替代人；每轮发布抽 20 条 claim 盲评。

### 6.3 深潜二：增量更新正确性

**问题**：增量更新最容易“看起来更新了，其实漏了”。漏更比不更更危险，因为读者会信任它。

**方案：三层映射 + 闭包 + 校验**

| 层 | 映射 | 解决什么 |
|---|---|---|
| **文件层** | `sources.globs` / `sources.files` | 目录/文件变更 |
| **符号层** | `symbols` + index | 函数/类/接口变更 |
| **语义层** | `routes` / `configKeys` | API/配置变更 |

**闭包规则**：

- 直接受影响页面；
- 其父页面（摘要可能变化）；
- 1 跳链接页面（交叉引用可能失效）；
- 不递归扩散，避免“改一行更新全库”。

**漏更防护**：

- 每次更新后，用 `git diff --stat` 与 `ImpactReport` 对比，人工抽检；
- 对“高频变更文件”设置强制重生成阈值；
- 对 `needs-review` 页面设置过期提醒；
- 在 CI 中检查“代码变更但 Wiki 未更新”的 PR。

### 6.4 深潜三：大规模仓库的 Token 与成本控制

**成本模型**（目标值，需实测校准）：

```text
总 Token ≈ 规划 + Σ(证据 + 写作 + 校验)
        ≈ 30k + N × (25k + 8k + 5k)
        ≈ 30k + N × 38k
```

- 10 页 ≈ 410k tokens；20 页 ≈ 790k tokens。
- 50k LOC 仓库，目标 ≤ 400k tokens（约 8k tokens / 1k LOC）。
- 200k LOC 仓库，建议按模块分片，每片 8–12 页。

**控制手段**：

| 手段 | 效果 | 代价 |
|---|---|---|
| 确定性索引替代“全库读” | 大幅降低输入 token | 需要语言/框架启发式 |
| 页面级检索（top-k 文件） | 只读相关代码 | 可能漏掉跨模块依赖 |
| 每页输入/输出硬上限 | 防止失控 | 复杂页面可能被截断 |
| 并发 ≤ 3 | 控制峰值与速率限制 | 总时长增加 |
| inputsHash 跳过 | 增量成本接近线性 | 需要可靠的哈希 |
| 缓存检索结果/摘要 | 重复查询便宜 | 缓存失效策略 |
| 分片生成 | 大仓库可行 | 需要总览页合并 |

### 6.5 深潜四：DSH 上下文与 KV Cache

DSH 明确强调“每个模型请求都必须能从会话日志重建”，并且系统提示是 KV cache 的关键前缀。插件必须遵守：

| 做法 | 原因 |
|---|---|
| **稳定的 `repowiki:policy` section** | 前缀稳定，避免每次请求破坏 cache |
| **不把 Wiki 正文放进 system prompt** | 体积大、变化频繁、污染前缀 |
| **检索结果走 tool result** | 天然属于会话日志，可重放 |
| **自动注入必须声明 source kind** | 满足“模型可见即已记录” |
| **注入限流 + 去重** | 避免重复内容膨胀上下文 |
| **使用 `getSectionOrder()` 取相邻槽位** | 避免硬编码 order 随 DSH 版本漂移 |

**建议的注入策略**：

- MVP：只注册 policy section，不自动注入；模型通过 `wiki_search` 主动查询。
- P1：在 `agent/pre-step` 中检测“架构/影响/约定”等关键词，注入**页面标题 + 一句话**（≤ 300 tokens），不注入正文。
- P2：高置信命中时注入 ≤ 1.5k tokens 摘要，默认关闭，配置开启。

### 6.6 深潜五：插件稳定性与 DSH API 演进

DSH 仍是 developer preview（`0.2.2-alpha.2`），插件需要“防震”：

| 措施 | 说明 |
|---|---|
| **锁定 peer 版本** | 精确锁定 `0.2.2-alpha.2`，不追 `latest` |
| **适配层** | 所有 DSH API 调用集中在 `src/dsh-adapter/`，升级只改一层 |
| **契约测试** | 用固定 DSH 版本跑 `tools.register` / `commands.register` / `jobs.start` / `workflow.start` 的 smoke test |
| **能力探测** | `ctx.get('workflowEngine')` 不存在时降级为串行 subagent；`ctx.get('jobs')` 不存在时前台执行 |
| **特性开关** | `enableWorkflow` / `enableAutoUpdate` / `enableUI` |
| **可观测** | 每个阶段写 `session/event` 或 job 输出，失败可定位 |
| **不 fork harness** | 只通过文档化接缝扩展，避免升级断裂 |

---

## 7. 分阶段实现路径

### 7.1 里程碑总表

| 阶段 | 周期 | 目标 | 核心交付 | 验收门槛 | 依赖 |
|---|---|---:|---|---|---|
| **M0 可行性验证** | 1 人周 | 证明“索引 + 单页生成 + 引用校验”可行 | Spike：3 个仓库、每仓 1 页；成本/时间基线 | 引用有效率 ≥ 90%；单页 ≤ 10 分钟 | 无 |
| **M1 MVP** | 4 人周 | 跑通“规划 → 生成 → 落盘 → 检索” | 8–12 页 Wiki、`/wiki`、`wiki_search`/`wiki_read`、metadata | 50k LOC 仓库 12 页；引用 ≥ 95%；无占位符 | M0 |
| **M2 多 Agent 与校验** | 4 人周 | 提升速度与质量 | Workflow 并行、Verifier、Job/恢复、知识卡片 | 24 页；unsupported ≤ 5%；中断可恢复 | M1 |
| **M3 增量更新** | 4 人周 | 让 Wiki 可持续 | diff 影响分析、自动更新、手改保护、CI 检查 | 10 文件 commit 更新 ≤ 3 页；≤ 3 分钟 | M2 |
| **M4 体验与生态** | 4–6 人周 | 对齐 Qoder 体验 | Web 侧栏面板、Qoder 互操作、en/zh、团队共享 | 面板可浏览/搜索；导入导出往返 | M3 |
| **M5 规模化** | 持续 | 组织级能力 | 混合检索、多仓库、策略与审计 | hit@5 +10%；多仓库隔离 | M4 |

**总量级**：M0–M4 约 17–19 人周；2 人并行约 9–10 周（不含评审/返工缓冲）。

### 7.2 WBS（按里程碑）

#### M0（1 人周）

| 任务 | 产出 |
|---|---|
| 仓库扫描 + ignore + 语言识别 | `RepoProfile` |
| 轻量索引（目录/模块/导入关系） | `RepoIndex` v0 |
| 单页生成（1 个 agent + 证据包） | 1 页 Markdown + 引用 |
| 引用校验（路径/行号） | `VerificationReport` |
| 成本/时间测量 | 基线报告 |

#### M1（4 人周）

| 任务 | 产出 |
|---|---|
| `wiki_plan.yaml` 解析/生成/校验 | Plan 模块 |
| 页面树 → 串行生成 | 8–12 页 |
| `.dsh/repowiki` 布局 + metadata | Store |
| `wiki_search` / `wiki_read` | 两个工具 |
| `/wiki status/generate/export` | 命令 |
| 引用/链接/结构校验 | Verify v0 |
| 3 个 fixture 仓库的黄金测试 | 测试套件 |

#### M2（4 人周）

| 任务 | 产出 |
|---|---|
| Workflow 脚本 + 结构化输出 | `workflow/script.ts` |
| 证据/写作/校验三角色 | 并行管线 |
| Job 化 + checkpoint + 恢复 | 长任务 |
| 知识卡片生成 | `knowledge/` |
| 成本/并发/超时控制 | Config + 预算 |
| 质量评估脚本 | 抽样报告 |

#### M3（4 人周）

| 任务 | 产出 |
|---|---|
| `git diff -M` + 行区间 + 符号映射 | Impact 引擎 |
| 页面 source anchors + inputsHash | 增量核心 |
| 手改检测 + 建议文件 | 保护机制 |
| 自动更新（git hook / 命令） | 触发器 |
| CI freshness 检查 | 脚本/示例 |
| 增量回归测试 | 测试套件 |

#### M4（4–6 人周）

| 任务 | 产出 |
|---|---|
| Client 插件骨架 + 侧栏注册 | `sidebar.panellist` |
| 页面树/搜索/Markdown 渲染 | 面板 |
| Qoder `wiki_plan.yaml` / Markdown 互操作 | Adapter |
| en/zh 生成 + 术语表 | 多语言 |
| 团队共享（Git/CI） | 文档 + 示例 |
| 端到端验收 | 演示仓库 |

### 7.3 关键路径

```text
M0 ──→ M1 ──→ M2 ──→ M3 ──→ M4
        │       │       │
        │       ├── UI 技术预研（可与 M2 并行）
        │       └── Qoder 互操作调研（可与 M3 并行）
        └── 基准集/评审机制（贯穿）
```

**关键风险点**：

- M1 的“证据包质量”决定后续所有阶段；如果 M1 的引用有效率不达标，不要进入 M2。
- M2 的 Workflow 并行如果受 DSH 版本限制，降级为串行 subagent，不阻塞 M3。
- M3 的增量正确性是产品分水岭；宁可少更新，不要漏更新。

### 7.4 团队配置

| 角色 | 人数 | 职责 |
|---|---:|---|
| 后端/Agent 工程师 | 1–2 | 扫描、索引、管线、Workflow、Jobs |
| 前端/体验工程师 | 0.5–1 | 命令、工具卡片、侧栏面板 |
| 质量/评测 | 0.5 | 基准集、盲评、回归 |
| 产品/设计 | 0.5 | 场景、验收、文档 |

> 单人开发可行，但 M4 的 UI 会显著拉长周期；建议 UI 后置或外包。

---

## 8. 度量与评测

### 8.1 指标树

| 类别 | 指标 | 目标 | 测量方法 |
|---|---|---:|---|
| **覆盖** | 顶层模块覆盖率 | ≥ 90% | 页面 `sources` 覆盖的模块 / 总模块 |
| **覆盖** | 公共 API 覆盖率 | ≥ 80% | 路由/导出符号被页面引用比例 |
| **可信** | 引用有效率 | ≥ 95% | 路径存在 + 行号在范围内 |
| **可信** | 无支撑 claim 率 | ≤ 5% | 每页抽 5 条 claim，人工盲评 |
| **可信** | 跨页矛盾 | ≤ 1 处/10 页 | 人工比对关键事实 |
| **新鲜** | stale 页面比例 | ≤ 10% | `status == stale` / 总页数 |
| **新鲜** | 更新延迟 | ≤ 5 分钟 | commit → 更新完成 |
| **有用** | 检索 hit@5 | ≥ 80% | 30 个黄金问题 |
| **有用** | 盲评可用性 | ≥ 4/5 | 3 名工程师按 rubric 打分 |
| **成本** | tokens / 1k LOC | ≤ 8k | 统计 `stats.tokensIn/Out` |
| **成本** | 50k LOC 生成时长 | ≤ 20 分钟 | 端到端计时 |
| **增量** | 受影响页 / 变更文件 | ≤ 0.5 | ImpactReport |
| **增量** | 漏更率 | ≤ 2% | 人工抽检 |

### 8.2 基准集设计

| 维度 | 设计 |
|---|---|
| **仓库** | 4 个：DSH 自身（TS monorepo）、Python 服务、Go 服务、Java/Spring 服务；规模 20k / 80k / 200k LOC |
| **问题** | 每仓 30 个：架构 8、调用链 8、影响分析 7、约定 7 |
| **基线** | ① 无 Wiki（grep/read）；② Qoder / Code Wiki / DeepWiki 可获得的产物；③ 本插件 |
| **评审** | 3 名工程师盲评，1–5 分；争议由第 4 人裁决 |
| **记录** | 时间、Token、引用有效率、遗漏点、错误类型 |

### 8.3 验收门槛（M1/M2/M3）

| 阶段 | 必须通过 | 否则 |
|---|---|---|
| **M1** | 引用 ≥ 95%；无占位符；12 页结构完整；`/wiki` 可用 | 不进入 M2，先修证据链 |
| **M2** | unsupported ≤ 5%；24 页；中断恢复；成本 ≤ 预算 120% | 缩减页面数/并发，先保质量 |
| **M3** | 10 文件 commit ≤ 3 页；漏更 ≤ 2%；手改不丢 | 不发布自动更新，仅手动 |

---

## 9. 风险说明

### 9.1 风险登记表

| # | 风险 | 概率 | 影响 | 触发信号 | 缓解 | 兜底 |
|---|---|---|---|---|---|---|
| 1 | **DSH API 变更** | 高 | 高 | 升级后类型/注册失败 | 适配层、版本锁定、契约测试 | 固定 DSH 版本，延迟升级 |
| 2 | **生成内容幻觉** | 高 | 高 | 引用无效、评审低分 | 证据包、引用校验、needs-review | 只发布通过校验的页面 |
| 3 | **增量漏更** | 中高 | 高 | 代码变了页面没变 | 三层映射、闭包、CI 检查 | 定期全量重建 |
| 4 | **成本/时间超预期** | 中高 | 中 | Token/时长 > 预算 | 页面预算、并发、缓存、分片 | 缩减页数/范围 |
| 5 | **大仓库不可用** | 中 | 高 | 扫描/索引超时 | 忽略规则、上限、分模块 | 只生成指定模块 |
| 6 | **代码/密钥外泄** | 低 | 极高 | 文档出现密钥 | 密钥扫描、排除、本地模型 | 阻断发布 + 清理 |
| 7 | **提示注入** | 中 | 中高 | 页面出现仓库内指令 | 数据/指令分离、无执行 | 人工复核 + 过滤 |
| 8 | **人工修改被覆盖** | 中 | 中 | 用户反馈修订丢失 | hash 检测、`.suggested.md` | 备份 + 手动合并 |
| 9 | **Qoder 互操作 schema 漂移** | 中 | 低 | 导入失败 | 只承诺 Markdown/plan | 放弃 metadata 兼容 |
| 10 | **UI 范围膨胀** | 中 | 中 | M4 延期 | UI 后置、MVP 文件化 | 只做工具卡片 |
| 11 | **采用率低** | 中 | 中 | 生成后无人用 | Git 共享、CI 门禁、命令入口 | 聚焦 onboarding 场景 |
| 12 | **文档过期导致误导** | 高 | 中高 | stale 比例上升 | 新鲜度徽标、自动更新、CI | 页面顶部过期警告 |

### 9.2 三个必须早期验证的假设

| # | 假设 | 验证方式 | 失败后的转向 |
|---|---|---|---|
| 1 | 结构化证据包能把 unsupported claim 降到 ≤ 5% | M0 生成 20 页，抽 100 条 claim 盲评 | 加强校验/缩小页面范围/改为“索引 + 短卡片” |
| 2 | `git diff` + anchors 能覆盖 ≥ 90% 受影响页面 | M3 用 50 个真实 commit 回放 | 提高闭包范围/引入符号级依赖图 |
| 3 | 用户愿意为“可验证的知识”等待 10–20 分钟 | M1 访谈 5 位目标用户 | 改为后台生成 + 增量推送；或先做搜索型知识库 |

---

## 10. 开放决策与下一步

### 10.1 待确认决策

| # | 决策 | 选项 | 建议 | 影响 |
|---|---|---|---|---|
| 1 | **发布形态** | 内部 profile / npm 插件 / 两者 | 先内部 profile，稳定后发 npm | 安装与升级路径 |
| 2 | **目标 DSH 版本** | 固定 `0.2.2-alpha.2` / 追最新 | 固定当前版本，季度评估升级 | API 稳定性 |
| 3 | **首批语言** | TS / Python / Go / Java | TS + Python 先做，Go/Java 用通用启发式 | 索引质量 |
| 4 | **Qoder 兼容** | 完全兼容 / Markdown + plan 兼容 / 不兼容 | Markdown + plan 兼容 | 迁移成本 |
| 5 | **UI 投入** | M1 就做 / M4 后置 / 不做 | M4 后置 | 周期与体验 |
| 6 | **自动更新触发** | 手动 / git hook / 定时 | 先手动 + 可选 git hook | 新鲜度与成本 |
| 7 | **默认语言** | 中文 / 英文 / 双语 | 中文优先，英文 P2 | 术语与页面结构 |
| 8 | **模型路由** | 云端 / 本地 / 可配置 | 可配置，默认跟随 DSH | 合规与成本 |

### 10.2 两周行动清单

1. **搭 M0 Spike**：选一个 20k–50k LOC 的仓库（DSH 自身作为大仓库回归，不作为首个目标），跑通“扫描 → 索引 → 1 页生成 → 引用校验”，记录 Token/时间。
2. **定 30 个黄金问题**：覆盖架构、调用链、影响、约定四类；用于后续所有评测。
3. **验证 Workflow 结构化输出**：用 `ctx.workflowEngine.start()` 跑 5 页并行，确认 `agent()` 的 schema/并发/取消行为。
4. **定 `.dsh/repowiki` schema v1**：先写 `meta/repowiki.json` 与页面 frontmatter，再做生成器。
5. **做一次人工基线**：让 2 名工程师在无 Wiki 情况下回答黄金问题，记录时间与错误；作为对照组。
6. **评审本设计**：重点确认“MVP 边界”“是否要 Qoder 兼容”“UI 是否后置”三个决策。

---

## 附录 A：参考资料

| # | 资料 | URL | 检索日期 |
|---|---|---|---|
| 1 | Qoder Docs · Repo Wiki | https://docs.qoder.com/zh/qoder/repo-wiki | 2026-10-31 |
| 2 | Qoder Docs · 知识卡片 | https://docs.qoder.com/zh/qoder/knowledge-cards | 2026-10-31 |
| 3 | Qoder Blog · Repo Wiki: Surfacing Implicit Knowledge | https://qoder.com/zh/blog/repo-wiki-surfacing-implicit-knowledge | 2026-10-31 |
| 4 | Qoder CN Docs · Repo Wiki | https://docs.qoder.cn/qoder/repo-wiki | 2026-10-31 |
| 5 | Alibaba Cloud Lingma · Repo Wiki | https://www.alibabacloud.com/help/tc/lingma/repo-wiki | 2026-10-31 |
| 6 | Qoder Forum · Repository limits | https://forum.qoder.com/t/you-have-reached-the-maximum-number-of-code-repositories-allowed-for-analysis/1327 | 2026-10-31 |
| 7 | Qoder 首页 | https://qoder.com/ | 2026-10-31 |
| 8 | CIOAge · Qoder Desktop 实测 | https://www.cioage.com/article/845506.html | 2026-10-31 |
| 9 | Qoder Blog · Credits 技巧（含 Repo Wiki 使用体验） | https://qoder.com/zh/blog/qoder-case-creditstips | 2026-10-31 |
| 10 | DSH Architecture | https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md | 2026-10-31 |
| 11 | DSH Extension Cookbook | https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md | 2026-10-31 |
| 12 | DSH Adding a Tool | https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-tool.md | 2026-10-31 |
| 13 | DSH Adding a Package | https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md | 2026-10-31 |
| 14 | DSH 官网 | https://deepseek.com/harness/en | 2026-10-31 |
| 15 | Google Code Wiki 发布博客 | https://developers.googleblog.com/introducing-code-wiki-accelerating-your-code-understanding/ | 2026-10-31 |
| 16 | Code Wiki FAQ | https://codewiki.google/faq | 2026-10-31 |
| 17 | DeepWiki | https://deepwiki.com/ | 2026-10-31 |
| 18 | DeepWiki Private Repos（第三方对比） | https://repowise.dev/blog/comparisons/deepwiki-private-repos | 2026-10-31 |

## 附录 B：术语表

| 术语 | 含义 |
|---|---|
| **Repo Wiki** | Qoder 的结构化仓库文档功能，含页面、知识卡片与索引 |
| **知识卡片** | 从代码中提炼的高密度知识单元（架构/规约/技术栈） |
| **wiki_plan.yaml** | Qoder 的生成规划配置，定义模板、读者、页面清单 |
| **DSH** | DeepSeek Harness，基于 Cordis 的“一切皆插件”Agent 运行时 |
| **Cordis** | DSH 的插件内核，管理插件挂载、卸载、依赖、服务与事件 |
| **Seam（接缝）** | 可替换能力的三件套：Service Definition / Provider / Consumer |
| **Bundle** | DSH 的可安装配置层，通过 `dsh.bundle.patch` 声明 patch |
| **Profile** | 命名的运行时组合（web / headless / sdk / acp） |
| **Job** | DSH 的后台任务抽象，带输出环、取消、结算 |
| **Workflow** | DSH 的 JS 编排脚本，可 `agent()` 扇出子智能体 |
| **EvidencePack** | 本插件设计的页面级证据包，含 claims + citations |
| **Source anchor** | 页面与代码的映射（glob / file / symbol / route / configKey） |
| **Impact closure** | 直接受影响页面 + 父页 + 1 跳链接页面的集合 |
| **Freshness** | 页面与当前代码的一致性状态（fresh / stale / needs-review） |

## 附录 C：`wiki_plan.yaml` 兼容示例

```yaml
version: 1

repowiki:
  template: architecture
  notes:
    - text: "面向新入职工程师，重点解释系统架构、核心链路与实现边界"
    - text: "所有结论必须能定位到具体文件与行号"
  documents:
    - title: "项目概览与业务场景"
      goal: "说明项目解决什么问题、核心用例、技术栈与运行方式"
    - title: "核心概念与领域模型"
      goal: "解释领域对象、关键术语、数据关系"
    - title: "技术架构总览"
      goal: "说明分层、模块职责、依赖方向与关键设计决策"
    - title: "HTTP 入口与 API 契约"
      parent: "技术架构总览"
      goal: "说明请求入口、路由组织、鉴权、错误处理与契约"
      hints:
        - "重点说明中间件顺序与异常映射"
    - title: "持久化与数据落地"
      parent: "技术架构总览"
      goal: "说明数据模型、存储选型、事务边界与迁移策略"
    - title: "端到端核心链路"
      goal: "选择一个最重要的业务链路，说明跨模块调用与状态变化"
    - title: "本地运行、测试与夹具"
      goal: "说明如何启动、如何造数据、如何跑测试"
    - title: "当前实现边界与待补充事项"
      goal: "明确未实现、临时方案、已知技术债与待确认问题"

knowledgecard:
  notes:
    - text: "按模块整理架构设计与代码规约；优先记录容易被违反的约束"
```

## 附录 D：插件骨架

```ts
// src/index.ts
import type { Context } from '@deepseek-ai/cordis'
import { RepoWikiService } from './service.ts'
import { registerTools } from './tools/index.ts'
import { registerCommand } from './command.ts'
import { registerPrompt } from './prompt.ts'
import type { Config } from './config.ts'

export const name = 'repowiki'
export const inject = ['tools', 'commands', 'systemPrompt', 'fs', 'shell']

export function apply(ctx: Context, config: Config) {
  // Service 构造函数内的 super(ctx, 'repoWiki') 完成注册。
  const service = new RepoWikiService(ctx, config)

  registerPrompt(ctx, config)
  registerTools(ctx, service, config)
  registerCommand(ctx, service, config)

  // Optional capabilities: degrade when absent.
  if (ctx.get('workflowEngine')) {
    // workflow-backed generation
  }
  if (ctx.get('jobs')) {
    // background generation
  }
}
```

```ts
// src/command.ts 的关键路径：长任务走 Job
ctx.commands.register({
  name: 'wiki',
  description: 'Inspect, generate, update, or export the repository wiki.',
  input: { hint: 'status | generate | update | export | plan' },
  async handler({ agent, rawInput }) {
    const verb = rawInput.trim().split(/\s+/)[0] || 'status'
    if (verb === 'status') {
      return { kind: 'success', text: await renderStatus(ctx.repoWiki, agent) }
    }
    if (verb === 'generate' || verb === 'update') {
      const job = ctx.jobs.start({
        kind: 'repowiki',
        label: `Repo Wiki ${verb}`,
        owner: agent.sessionId,
        run(h) {
          const ac = new AbortController()
          const done = ctx.repoWiki
            .generate({ root: rootOf(agent), mode: verb === 'update' ? 'update' : 'full', language: 'zh' }, ac.signal)
            .then((r) => ({ status: 'completed' as const, detail: `${r.pagesWritten} pages`, result: JSON.stringify(r) }))
            .catch((e) => ({ status: 'failed' as const, detail: String(e) }))
          return { cancel: () => ac.abort(), done }
        },
      })
      return { kind: 'success', text: `Repo Wiki started as job ${job}.` }
    }
    return { kind: 'error', text: `Unknown subcommand: ${verb}` }
  },
})
```

## 附录 E：页面模板

````markdown
---
id: <stable-id>
title: <页面标题>
goal: <这一页回答什么问题>
status: draft | fresh | stale | needs-review
parent: <parent-id>
sources:
  - <glob or file>
symbols: []
generated_at: <ISO-8601>
source_hash: <sha256>
confidence: high | medium | low
---

# <标题>

## 这一页回答什么
- 范围：
- 不覆盖：

## 关键结论
- <结论>（引用 `path:line`）

## 结构与流程
```mermaid
flowchart LR
  A --> B
```

## 实现细节
<按逻辑顺序展开，每段带引用>

## 源码索引
| 文件 | 作用 | 关键符号 |
|---|---|---|

## 未决问题
- <需要运行时/业务确认的问题>
````

---

> **文档结束**。本稿为设计草案，建议在 M0 验证后回填实测数据，并将“待确认决策”收敛为 v1.0 基线。
