# 论文研究复盘工作台 v0.1.0

首个公开版本提供 Codex Skill、统一分析结果格式、静态阅读器与三个跨学科案例。

- 六部分研究复盘，明确区分原文明示、有依据推断与探索性假设。
- 候选路径、带回退的决策地图、节点检验及证据支持范围。
- 浏览器本地导入保存、JSON/Markdown 导出、节点上下文、版本与修订检查。
- 自足 Skill ZIP，内含规则、JSON Schema、Node.js CLI 和第三方许可声明。
- ResNet、CRISPR 与 LIGO 案例，独立 Skill/强基线试用及真实节点续聊修订记录。

安装：解压 Skill ZIP，将 paper-reconstruction 文件夹放入项目的 .agents/skills/。辅助 CLI 要求 Node.js 22。阅读器无需模型 API，分析与讨论在 Codex 中执行。

当前结果验证了软件流程与一次留出试用，没有测得作者真实历史还原准确率，也未证明跨所有学科的学习收益。评价详情与具体限制见仓库 evals/README.md。
