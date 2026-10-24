# 结果格式与兼容性

格式版本为 0.1.0。core/schema.ts 是类型与 Schema 的共同定义；schemas 中 JSON 是导出产物。CLI 与浏览器使用同一个 Ajv 校验和引用检查实现。修改契约后执行 pnpm schemas:export，并同步工作流版本和案例。

## AnalysisBundle

| 组 | 字段与含义 |
| --- | --- |
| 标识与版本 | analysis_id、analysis_version、schema_version、workflow_version；论文版本另存 paper.version |
| 论文与执行 | paper 保存明确身份、研究类型；provenance 保存实际材料策略、模型与可取得用量 |
| 证据层 | sources 登记来源和读取状态；evidence 登记释义、短摘录、定位、类型和核查状态；claims 保存性质与证据关系 |
| 结构层 | paths 保存前提与成员；nodes 保存每条路径的条件、选项、检验、结果后的行动与迁移判断；edges 保存关系语义 |
| 报告层 | sections 有序保存正文块；每个块通过稳定 block_id 与 node_refs、claim_refs、evidence_refs 关联 |
| 完整性 | status、limitations、validation、manifest 分别表达完成程度、缺口、审查性质和包含范围 |
| 修订 | revision 保存上一版本、修改原因与旧节点对应关系；初版为 null |

完整结果有六部分与实际决策节点。部分结果允许只包含材料说明与空节点；必须写明缺口。未知信息使用 null，不得通过猜测补齐。

主张性质为 explicit、inferred、hypothetical。证据关系为 supports、conditional_support、compatible、contradicts、unclear。explicit 必须关联直接支持证据；inferred 必须给证据、前提和竞争解释。

路径与节点、连线之间必须双向一致；循环是允许的。明示时间关系必须具备 historical_account 类型的证据，校验不能替代对该证据是否真正支持顺序的语义检查。

## DiscussionContext

绑定分析版本、路径与节点，仅保留所选路径的 path_contexts。包含相关 claims、evidence、sources 和用户问题、讨论模式；materials 区分附带材料与仅引用的资源。path 的其他节点 ID 仅提供标识，不附带其正文。

## 修订与兼容

同分析 ID、同版本、不同内容被拒绝，JSON 字段顺序不同不算冲突。相邻版本在本地同时存在时检查论文身份和完整旧节点映射。单独导入新版可以阅读，但旧版需另行导入才能核查跨版本映射。

首版拒绝不兼容格式与未声明字段，不实施静默迁移。后续迁移需有明确版本转换及记录。宿主生成的未知执行元数据保持 null。

Markdown 允许标准段落、列表、强调、表格、代码和 HTTP(S) 链接。任意 HTML 不执行，嵌入图片不加载；节点和证据映射来自结构字段，不从文字推测。
