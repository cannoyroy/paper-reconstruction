# v1 → v2 修改摘要

已按本轮明确采纳的要求修订。先仅依据P2/N2讨论包保存node-answer.md，之后才读取完整analysis.json生成相邻版本；旧讨论包仍绑定v1。

- N2保留ID；新增传感器覆盖、灵敏度、状态与耦合稳定性的未知条件。两条路径的N2上下文均保留待核查状态，不提前引入6%最终结果。
- N2-T1增加第三种结果：覆盖不足或耦合不稳定时，即使无报警也不能排除共同误差；补测、重复耦合测试，无法补齐时保留未决并收缩天体归因。
- 新增H8，明确标为hypothetical；它是条件行动建议，不是假造的仪器故障或作者历史。同步更新N2选项、迁移边界、第三及第六部分正文。
- C5与E6的原作者报告不变；paper、sources及全部原始证据不变。无新增外部材料或独立复验。
- analysis_version从1增至2，revision.previous_version=1；六个节点逐一映射为retained，未拆分合并。
- 旧analysis.json/report.md保留，v2另存；manifest与本轮provenance同步登记。CLI结构与修订关系检查结果另见continuation-record.json。
