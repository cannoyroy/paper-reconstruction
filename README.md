# 论文研究复盘工作台

从论文证据重建可能的研究决策，学习在不确定条件下怎样选择下一步。

[English](README.en.md) · [在线阅读器](https://cannoyroy.github.io/paper-reconstruction/) · [使用指南](docs/usage.md) · [结果格式](docs/format.md) · [评价与边界](evals/README.md)

这个项目由 **Codex Skill、版本化分析 JSON 和静态阅读器**组成。Skill 默认一次生成完整复盘；阅读器联动正文、候选路径、决策节点与证据；读者可以把节点上下文带回 Codex 继续讨论，并导入修订版。

复盘允许有依据的推断，分别标记原文明示、有依据推断和探索性假设。它提供研究判断的学习材料，不能证明作者未公开的真实经历。

## 快速体验

打开在线阅读器，选择 ResNet、CRISPR-Cas9 或 LIGO 案例。点击正文中的“主张与依据”查看支持范围；在决策地图中选择节点；填写问题后复制上下文，回到 Codex 继续。

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

## 首版范围

- 单篇论文的六部分完整复盘、条件化节点分析和证据关系。
- 多路径比较、含回退的决策地图、章节或图表级定位。
- JSON 导入导出、浏览器本地存储、版本冲突检查、讨论包。
- 计算实验、实验室机制研究和观测研究三个真实论文案例。

扫描 PDF 的自动 OCR、实验复现、内嵌模型聊天、账号服务与批量论文库不在 v0.1 中。来源或工具不足时保留部分结果，具体能力见 [宿主支持](docs/host-support.md)。

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
