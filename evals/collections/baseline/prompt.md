# 强基线试用任务提示

以下为本会话最初收到的基线任务消息正文转存（仅将机器绝对路径归一为 <repo>/），仅包含任务提示，不包含系统或开发者指令。后续追加的文件哈希要求不混入初始提示。

```text
执行已授权计划中的强基线配对试用。你是基线组，不读取任何Skill方法指导或其他输出。完整任务：用户给 arXiv1512.03385v1 和 arXiv1505.00387v1，觉得都通过跨层通路帮助训练，希望对多篇进行有依据的综合分析。仅使用 <repo>/work/v02-input/resnet.txt 和 highway.txt 两份固定PDF逐页文本，不外部检索、不额外看图。你可以读取 release/paper-reconstruction/references/schemas/collection.schema.json 和 collection-discussion.schema.json、为实现输出而读取 references/collection-output.md（仅格式契约），以及执行 release/paper-reconstruction/scripts/paper-reconstruction.mjs CLI。禁止读取SKILL.md、method/collection-method、examples、evals、curate脚本、其他trial目录、agent输出或继承聊天中的样稿结论。按你自己的最佳分析方法写完整联合报告，并建立单篇证据卡、可比条件、关系、关键决策与证据；不要仅串联摘要。严格区分原文明示、有依据推断、探索假设，逐条核查来源位置和支持范围；相似术语/作者/时间不证明因果关系，不同设置指标不能直接比较。说明竞争解释、适用条件、具体可选行动、可区分结果及后续行动，允许弱关联/无共同主线。按共享Schema生成analysis.json，再由CLI导出report.md。实质正文+证据卡+比较表目标3500–5000中文字符，与Skill组相同；JSON索引元数据可额外。不读另一组产物。所有产物仅写 work/v02-trial-baseline，不编辑主源码。记录开始结束时间、原始文本sha256、实际可得模型使用量未知null、验证输出。若格式契约有问题报告我。完成返回文件路径、验证结果和限制。这是强基线模型试用，不冒充人工评审。
```

本文件为后补的提示归档，不改变已封存的 analysis.json、report.md 或当时运行记录。
