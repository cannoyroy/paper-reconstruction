# 多篇结果契约 0.2.0

以 references/schemas/collection.schema.json 为字段真值。与旧的单篇 0.1.0 分开：kind=collection_analysis，schema_version=0.2.0；不存在 paper 字段，使用 collection 和 papers。产出 analysis.json；用 CLI markdown 从同一 JSON 导出 report.md。

## 最小结构

- collection：title、goal、user_clue、derived_from（新分析源于旧结果时填其 ID 与版本，否则 null）。
- papers：每篇保存原论文元数据及 paper_id、work_id（稳定的 DOI/arXiv 标识）、aliases、origin、candidate_id、read_status、material_note。原始材料 origin=provided/candidate_id=null；补充篇 origin=accepted_recommendation 并引用已接受的 candidate_id。
- search：status=not_started/provided_only/completed/unavailable，queries、note、candidates。每个候选记录 related_paper_refs、gap、expected_change、inspected_material、full_text_status 和 decision/decision_record/decision_source；最多 3 篇。not_started仅用于检索前登记，不能冻结；unavailable可记录尝试失败的查询，但不能有候选。最终结果不得有 pending。拒绝的候选仅留在此处。
- paper_cards：每篇恰好一张卡。question 为 {text,claim_refs}；conditions、assumptions、choices、discriminating_evidence、findings 为同类数组；limitations/open_questions 为文字数组；evidence_refs 定位证据。每张卡引用本篇的主张与证据。
- comparisons：每个 axis_id、title、comparability 及 cells（paper_id、summary、claim_refs）。不得以不可比数字生成排名。
- clusters：cluster_id、title、rationale、paper_refs、claim_refs；允许孤立论文、多个簇、空簇清单。
- relations：relation_id、from_paper_id、to_paper_id、kind、directed、label、explanation、epistemic_status、claim_refs、evidence_refs。kind 的可用枚举见 schema；competing/complementary/surface_similarity/uncertain 必须 directed=false。没有可信联系就用 []。
- sources、claims、nodes 增加 paper_refs；来源包含的原始研究证据明确归属论文。evidence 通过 source_id 归属；sources 可表示论文自身、附录、代码等。未采纳独立论文不得伪装为附录。
- paths 增加 perspective 和 available_source_refs。每个节点仍有按路径独立的已知条件、选项、判别检验和迁移经验。节点 paper_connection 解释与相关论文的联系。
- sections 的 block 增加 paper_refs、relation_refs。一个短段落/紧密列表一个稳定 block_id；具体节点分析逐段对应，不能整章笼统绑定全部节点。

其余 evidence、edges、provenance、limitations、validation、manifest 等沿用单篇字段规则。未知执行数据用 null。status=complete 表示主体六部分和核心决策完成，不表示已证明作者历史；不足两篇可用材料或主体证据不足时用 partial，允许无节点/关系并写具体缺口。部分结果也必须覆盖所有已纳入论文的证据卡，可以注明无法读取，不能编造证据。

## 阶段记录、讨论与修订

intake.json 的 kind=collection_intake，使用 collection-intake.schema.json；stage=registered/awaiting_selection/frozen，provided_papers 仅列原始材料，search 存候选与决定。辅助 CLI validate 支持此阶段文件，但阅读器只导入最终分析。

collection-discussion.schema.json 保存局部讨论包。节点目标绑定 path_id/node_id，只含所选路径条件；关系目标绑定 relation_id，path/node=null。包内 papers 覆盖相关证据实际需要的身份，不附带无关证据卡、路径条件或完整论文。

初版 revision=null。同一集合内容修订 version+1，记录 node_mappings 以及 relation_mappings（old_relation_id/new_relation_ids/change），所有旧目标都需映射，移除用空数组。同一集合的检索采纳记录不可改写。增删论文或改变论文版本建立新 analysis_id，collection.derived_from 回指旧结果。保持旧文件，执行 validate 和 revision 后导出 Markdown。

```text
node scripts/paper-reconstruction.mjs validate intake.json
node scripts/paper-reconstruction.mjs validate analysis.json
node scripts/paper-reconstruction.mjs markdown analysis.json report.md
node scripts/paper-reconstruction.mjs discussion analysis.json P1 N1 "这个判断何时失效？" node-context
node scripts/paper-reconstruction.mjs relation-discussion analysis.json R1 "这条继承关系的证据够吗？" relation-context
node scripts/paper-reconstruction.mjs revision analysis.json analysis-v2.json
```
