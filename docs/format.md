# 结果格式与兼容性

单篇格式保留 0.1.0，多篇使用独立的 0.2.0。core/schema.ts 与 core/collection-schema.ts 是类型与 Schema 的共同定义；schemas 中 JSON 是导出产物。CLI 与浏览器使用同一个 Ajv 校验和引用检查实现。修改契约后执行 pnpm schemas:export，并同步工作流版本和案例。

## AnalysisBundle

| 组         | 字段与含义                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| 标识与版本 | analysis_id、analysis_version、schema_version、workflow_version；论文版本另存 paper.version            |
| 论文与执行 | paper 保存明确身份、研究类型；provenance 保存实际材料策略、模型与可取得用量                            |
| 证据层     | sources 登记来源和读取状态；evidence 登记释义、短摘录、定位、类型和核查状态；claims 保存性质与证据关系 |
| 结构层     | paths 保存前提与成员；nodes 保存每条路径的条件、选项、检验、结果后的行动与迁移判断；edges 保存关系语义 |
| 报告层     | sections 有序保存正文块；每个块通过稳定 block_id 与 node_refs、claim_refs、evidence_refs 关联          |
| 完整性     | status、limitations、validation、manifest 分别表达完成程度、缺口、审查性质和包含范围                   |
| 修订       | revision 保存上一版本、修改原因与旧节点对应关系；初版为 null                                           |

完整结果有六部分与实际决策节点。部分结果允许只包含材料说明与空节点；必须写明缺口。未知信息使用 null，不得通过猜测补齐。

主张性质为 explicit、inferred、hypothetical。证据关系为 supports、conditional_support、compatible、contradicts、unclear。explicit 必须关联直接支持证据；inferred 必须给证据、前提和竞争解释。

路径与节点、连线之间必须双向一致；循环是允许的。明示时间关系必须具备 historical_account 类型的证据，校验不能替代对该证据是否真正支持顺序的语义检查。

## DiscussionContext

绑定分析版本、路径与节点，仅保留所选路径的 path_contexts。包含相关 claims、evidence、sources 和用户问题、讨论模式；materials 区分附带材料与仅引用的资源。path 的其他节点 ID 仅提供标识，不附带其正文。

## 修订与兼容

同分析 ID、同版本、不同内容被拒绝，JSON 字段顺序不同不算冲突。相邻版本在本地同时存在时检查论文身份和完整旧节点映射。单独导入新版可以阅读，但旧版需另行导入才能核查跨版本映射。

拒绝未知格式与未声明字段，不实施静默内容迁移。宿主生成的未知执行元数据保持 null。

Markdown 允许标准段落、列表、强调、表格、代码和 HTTP(S) 链接。任意 HTML 不执行，嵌入图片不加载；节点和证据映射来自结构字段，不从文字推测。

## CollectionAnalysisBundle 0.2.0

`kind: collection_analysis`，不使用单篇的 paper 字段。可执行契约见 [collection.schema.json](../schemas/collection.schema.json)，完整字段说明见 [Skill 多篇输出规范](../skills/paper-reconstruction/references/collection-output.md)。

| 字段                     | 含义                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| collection               | 标题、分析目标、用户关联线索、可选 derived_from                                                          |
| papers                   | 稳定 paper_id、work_id、身份别名、版本、读取范围、用户提供或确认补充的来源                               |
| paper_cards              | 每篇核心问题、条件、假设、选择、判别证据、结论及缺口；各项引用同篇主张                                   |
| comparisons              | 由问题决定的比较轴、可比性说明、逐篇单元格与主张引用                                                     |
| clusters / relations     | 允许多个研究簇及孤立论文；关系绑定两端论文、主张、证据与性质                                             |
| sources / claims / nodes | 原结构增加 paper_refs，检查归属和引用；共享来源不自动算独立支持                                          |
| paths                    | 增加 retrospective 或 candidate_formation 视角及 available_source_refs；已知条件不能引用允许范围外的来源 |
| sections                 | 六部分联合正文；块增加 paper_refs 和 relation_refs                                                       |
| search                   | 一轮查询、0–3个候选、实际读取范围、推荐理由与明确采纳记录                                                |
| revision                 | 增加 relation_mappings，与旧节点映射一起追踪变化                                                         |

collection_intake 是阶段文件，[Schema](../schemas/collection-intake.schema.json) 允许等待选择时 pending，冻结与最终分析不允许。拒绝的候选只保存在 search；已接受候选必须恰好纳入一次。decision_source 为 simulated_test 时明确标记验收模拟，不能冒充用户批准。结构检查不验证记录真实性，仍需行为审查。

不同版本或别名不构成独立工作。规范化 arXiv/DOI 和已登记别名用于去重；跨出版平台尚未登记的身份关系仍需核对，不能保证穷尽去重。

collection_discussion_context 目标为 node 或 relation。节点只携带所选路径的条件；关系携带两端论文和相关主张。其他 ID 仅供定位，完整原分析与论文仍需另行读取。CLI relation-discussion 导出关系包，旧 discussion 按结果类型分派。

同一范围的内容修订递增 analysis_version；增删论文或切换论文版本创建新 analysis_id，在 collection.derived_from 记录来源。同一分析链不能静默修改采纳记录。跨版本检查需要相邻版本同时可用。IndexedDB 保持原数据库；新增阅读状态字段可选且有默认值，不清空旧记录。
