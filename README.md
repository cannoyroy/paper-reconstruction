# 论文研究复盘工作台

从论文证据重建可能的研究决策，学习在不确定条件下怎样选择下一步。

[English](README.en.md) · [在线阅读器](https://cannoyroy.github.io/paper-reconstruction/) · [使用指南](docs/usage.md) · [结果格式](docs/format.md) · [评价与边界](evals/README.md)

这个项目由 **Codex Skill、版本化分析 JSON 和静态阅读器**组成。Skill 支持单篇复盘与多篇联合分析；阅读器联动正文、论文关系、候选路径、决策节点与证据；读者可以把节点上下文带回 Codex 继续讨论，并导入修订版。

复盘允许有依据的推断，分别标记原文明示、有依据推断和探索性假设。它提供研究判断的学习材料，不能证明作者未公开的真实经历。

## 快速体验

打开在线阅读器，选择两篇 ResNet 工作的联合案例，或 ResNet、CRISPR-Cas9、LIGO 单篇案例。点击正文中的“主张与依据”查看支持范围；在决策地图中选择节点；填写问题后复制上下文，回到 Codex 继续。

导入分析在浏览器中处理与保存，不上传到分析服务器，不调用模型。IndexedDB 可能被浏览器清理；请导出 JSON 保存。GitHub Pages 的访问日志由托管平台管理。

## 在 Codex 中使用 Skill

1. 从 [Releases](https://github.com/cannoyroy/paper-reconstruction/releases) 下载 Skill ZIP 并解压。
2. 将解压后的 `paper-reconstruction` 文件夹放入当前项目的 `.agents/skills/`。也可放入用户的 `~/.agents/skills/`，供其他项目发现。
3. 在支持本地文件、全文读取和检索的 Codex 中使用：

```text
请使用 $paper-reconstruction 分析这篇论文，生成完整研究复盘、
analysis.json 和 report.md。默认允许针对关键疑点补充公开资料。
论文：https://arxiv.org/abs/1512.03385v1
```

可指定“仅使用提供的材料”或输出语言。Skill 沿用当前 Codex 模型与工具；不需要额外模型 API 密钥。确定性辅助 CLI 需要 Node.js 22。源码中的 Skill 必须先打包，安装发布包可直接使用。

克隆本仓库后也可执行 `pnpm skill:install`，将打包 Skill 安装到本项目的 `.agents/skills/`；已有目录不会被覆盖。

### 可以怎样提供论文

在 Codex 中调用 Skill 时，可以通过以下方式提供论文：

| 输入方式           | 提供什么                                                  | 如何处理                                                                      |
| ------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| PDF 附件或本地路径 | 可读取的论文 PDF，或 Codex 有权限访问的文件路径           | 通过宿主可用的 PDF、正文和图表读取工具获取内容，记录实际可读范围              |
| 论文链接           | arXiv 论文页、PDF 直链或其他可访问的论文全文链接          | 确认论文身份与版本，再获取实际内容；链接可打开不代表已经取得全文              |
| 论文正文           | 直接粘贴正文，或提供可读取的 TXT／Markdown 等本地正文文件 | 通过 Codex 的文件读取工具或对话内容取得材料，记录是否缺少图表、附录或其他章节 |
| 论文标题           | 论文名称，可附作者、年份等线索                            | 先检索并确认论文身份、版本与全文；重名或版本无法确定时再询问                  |

读取和检索能力由当前 Codex 环境提供，Skill 本身不附带通用文件解析或下载服务。扫描 PDF 暂未集成自动 OCR；全文无法获取、缺页或图表不可读时，会标明具体缺口并按已有材料分析，不会把摘要当成已读全文。以上是输入规则，不同形式尚未全部逐项实测。

**PDF 路径示例**（请将路径替换为实际可访问的文件；也可附上 PDF）：

```text
请使用 $paper-reconstruction 分析 D:/papers/paper.pdf，
生成完整研究复盘、analysis.json 和 report.md。
```

**链接示例**：

```text
请使用 $paper-reconstruction 分析这篇论文：
https://arxiv.org/abs/1512.03385v1
生成完整研究复盘、analysis.json 和 report.md。
```

**标题示例**：

```text
请使用 $paper-reconstruction 分析《Deep Residual Learning for Image Recognition》。
请先确认论文身份与版本并取得全文，再生成完整研究复盘、analysis.json 和 report.md。
```

### 多篇论文一起分析（v0.2）

可以混合提供 PDF、链接、正文和标题。论文可以来自同一研究者、同一课题组，或只是你觉得相似；不用先证明联系。默认输出**六部分联合报告、逐篇证据卡、比较表、论文关系图与跨论文决策地图**，保留单篇复盘入口。

```text
请使用 $paper-reconstruction 联合分析以下论文：
https://arxiv.org/abs/1512.03385v1
https://arxiv.org/abs/1603.05027v1
我想了解它们怎样处理更深网络的优化问题。
请先初读并检索缺失的关键工作；如有推荐，最多3篇，等我明确选择再纳入。
生成 analysis.json 和 report.md。
```

流程：登记与初读 → 定向检索 → 等待采纳决定 → 冻结清单 → 逐篇取证 → 联合分析 → 校验导出。推荐可以全部接受、部分接受或全部拒绝；未答复不视为同意，拒绝的论文不进入联合证据。指定“仅提供材料”会跳过补充检索；材料很多时分批取证并保存阶段文件。

比较先检查对象、条件、资源和证据是否可比。作者重合、发表顺序和相似术语不证明指导关系、共同研究纲领或真实开发顺序；可以得到多个研究簇、孤立论文或没有共同主线的结论。

### 怎样把结果带到网页

使用流程是：**把论文交给 Codex Skill → 生成 analysis.json → 在网页阅读器中导入结果**。

网页的“导入分析 JSON”接收分析 JSON，用于阅读正文、检查证据和选择研究节点。PDF、论文链接、正文与标题应在 Codex 对话中提供；当前网页没有提交论文或调用模型生成复盘的入口。

## 本地开发

要求 Node.js **22.13+**、pnpm **10.13.1**。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开终端显示的本地地址。正式构建和验证：

```sh
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
```

Windows 上也可以设置 `PLAYWRIGHT_CHANNEL=msedge` 使用已安装 Edge 的独立无头测试实例。详见 [开发与发布](docs/development.md)。

## 分析结果与讨论

```sh
pnpm validate examples/resnet-2015.json
pnpm cli markdown examples/resnet-2015.json work/resnet-report.md
pnpm cli discussion examples/resnet-2015.json P01 N01 "为什么先查训练曲线？" work/node-context
pnpm package:skill
```

CLI 拒绝覆盖已有输出。`analysis.json` 是权威内容，Markdown 从它生成。讨论包绑定分析版本、路径与节点，只包含相应局部材料；修订保存为新版本。

## 当前能力与边界

- 单篇 0.1.0 JSON 继续支持；多篇使用独立的 0.2.0 格式。
- 多篇联合报告、证据卡、条件比较、研究簇及两种地图；按论文、研究簇或关系定位，筛选不改变完整报告。
- 节点或论文关系的局部讨论包；同一范围的内容修订保留旧版及节点／关系映射。增删论文或换论文版本须建立新分析 ID，记录派生来源。
- 旧案例、IndexedDB 记录和单篇 CLI 保留；未知格式及同版本冲突明确拒绝。

```sh
pnpm validate examples/residual-programme.json
pnpm cli relation-discussion examples/residual-programme.json R1 "这条推断有什么边界？" work/relation-context
```

扫描 PDF 自动 OCR、实验复现、内嵌模型聊天、账号、后端论文库和自动同步不在本次范围内。结构校验不能证明采纳记录真实或证据支持正确，仍需核查来源与讨论。实际试用及尚未验证事项见 [v0.2 评价](evals/collections/README.md)；宿主能力见 [宿主支持](docs/host-support.md)。

## 研究纲领重建与后续方向

**从单篇论文的决策复盘，走向一个研究者或课题组的研究纲领重建。** v0.2 已实现多篇交叉对照与研究地图，但只有材料支持时才称为“研究纲领”。地图是分析的表达，并不证明作者实际经历。

- **回看自己的系列工作**：梳理持续问题、判断方式与跨项目方法，发现尚未连接的成果。
- **理解研究者或课题组**：比较问题意识、方法演进及研究转折，同时保留合作归属不明和竞争解释。

**尚未实现的概念展望**：持续维护的大规模研究档案、独立的问题演化图、证据关联网络和方法迁移专用视图。当前只交付论文关系图及决策地图，不承诺后续版本或日期。

## 项目结构

```text
core/                 契约、校验、导出与修订检查
viewer/               React 静态阅读器
skills/               Skill 源文件与参考规则
schemas/              从共享契约导出的 JSON Schema
examples/             原创案例 JSON 与生成的阅读版
evals/                强基线、试用记录与比较方法
tests/                核心测试与浏览器测试
docs/                 使用、开发、材料许可和发布说明
```

欢迎基于具体证据问题提交修订，见 [贡献指南](CONTRIBUTING.md)。项目原创代码、Skill 与文档采用 [MIT](LICENSE)。论文和其他第三方材料保留各自权利；公开案例不附原始论文文件，见 [第三方材料说明](docs/third-party.md)。
