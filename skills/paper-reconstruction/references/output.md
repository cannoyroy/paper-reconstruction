# 结果契约 0.1.0

具体字段以 schemas/analysis.schema.json 与 schemas/discussion.schema.json 为准。所有对象拒绝未声明字段；无法获得的可空信息使用 null，数组使用 []，不省略必需字段。

AnalysisBundle 保存 schema_version、workflow_version、analysis_id、analysis_version、paper、provenance、sources、evidence、claims、paths、nodes、edges、sections、limitations、validation、revision 和 manifest。example_kind 使用 user_analysis；仓库中的真实案例使用 real_paper。status=complete 表示六部分复盘已完成，仍可有具体材料限制；材料不足以完成主体时使用 partial 并列出 limitations。

每条来源的 read_status 是实际读取范围，未读取或访问失败的来源不能产生已核查证据。指纹必须由实际读取字节计算，无法获取填 null。每条证据的 quote 只允许真实短引用，paraphrase 是释义；不把两者互换。

sections 是有序章节数组。每个 block 对应一个短段落或一个紧密的列表，带稳定 block_id、markdown 与明确 node_refs、claim_refs、evidence_refs。多个节点的论述必须拆成独立 block，不能把整章与所有证据笼统绑定。段落有多个判断时分别引用 claims。允许 Markdown 段落、标题、强调、列表、表格、代码和安全链接；HTML 不执行，图片不加载。不要依赖自定义 HTML 展示论证。

paths.node_refs/edge_refs 与 nodes.path_contexts/edges.path_ids 必须双向一致。每个节点包含至少两个具体选项、至少一个具有两种结果与后续行动的判别检验、至少一条带边界的迁移判断。部分结果可以保留空节点和单个材料说明章节，不能编造内容满足完整状态。

analysis_version 从 1 开始。初版 revision=null；每次采纳修改递增一，保存 previous_version、change_reason、node_mappings。论文版本变化需显式建立新的分析，不能静默改写同一历史记录。manifest 只说明实际附带与外部材料，不能声称包中包含完整论文。

provenance.usage 的 elapsed_seconds、model_calls、tokens 无法由宿主获得时填 null 并说明。生成日期仅用可靠环境时间。semantic_review=self_reviewed 表示执行者做过证据语义自查，不是独立评审或正确率保证。
