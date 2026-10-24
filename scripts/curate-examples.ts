// Maintained editorial cases, not an automated paper analyzer. All counterfactuals are labeled.
import { mkdir, writeFile } from "node:fs/promises";
import type {
  AnalysisBundle,
  ResearchNode,
  Claim,
  Evidence,
} from "../core/schema";
import { validateBundle } from "../core/validate";
import { exportMarkdown } from "../core/export";

const link = (
  id: string,
  relation: Claim["evidence_links"][number]["relation"] = "supports",
  scope = "只支持此处表述，不证明研究开发顺序",
) => ({ evidence_id: id, relation, scope_note: scope });
const explicit = (id: string, text: string, e: string): Claim => ({
  claim_id: id,
  text,
  epistemic_status: "explicit",
  evidence_links: [link(e)],
  assumptions: [],
  alternatives: [],
});
const inferred = (
  id: string,
  text: string,
  e: string,
  assumption: string,
  alternative: string,
): Claim => ({
  claim_id: id,
  text,
  epistemic_status: "inferred",
  evidence_links: [link(e, "compatible")],
  assumptions: [assumption],
  alternatives: [alternative],
});
const hypothesis = (id: string, text: string): Claim => ({
  claim_id: id,
  text,
  epistemic_status: "hypothetical",
  evidence_links: [],
  assumptions: ["用于学习的条件化方案，未核实为作者实际尝试"],
  alternatives: [],
});
function evidence(
  id: string,
  section: string,
  figure: string | null,
  paraphrase: string,
  scope: string,
  page: number | null = null,
  kind: Evidence["evidence_type"] = "reported_result",
): Evidence {
  return {
    evidence_id: id,
    source_id: "S01",
    locator: {
      section,
      figure_or_table: figure,
      pdf_page_index: page,
      printed_page: page === null ? null : String(page + 1),
      text_anchor: null,
    },
    paraphrase,
    quote: null,
    scope,
    evidence_type: kind,
    verification_status: "source_checked",
  };
}
function node(
  id: string,
  title: string,
  question: string,
  knownA: string,
  knownB: string,
  refs: string[],
  choices: [string, string][],
  testQuestion: string,
  method: string,
  outcomes: [string, string][],
  connection: string,
  lesson: [string, string, string, string],
): ResearchNode {
  return {
    node_id: id,
    title,
    question,
    path_contexts: [
      {
        path_id: "P01",
        known_information: [{ text: knownA, claim_refs: [] }],
        assumptions: ["这是候选路径的信息条件，不是已核实作者经历"],
      },
      {
        path_id: "P02",
        known_information: [{ text: knownB, claim_refs: [] }],
        assumptions: ["本路径独立设定信息条件，不与 P01 自动合并"],
      },
    ],
    uncertainties: ["真实开发次序与未公开尝试未知"],
    options: choices.map(([label, description], i) => ({
      option_id: `${id}-O${i + 1}`,
      label,
      description,
      claim_refs: refs.filter((r) => r.startsWith("H")),
    })),
    discriminating_tests: [
      {
        test_id: `${id}-T1`,
        question: testQuestion,
        method,
        claim_refs: refs.filter((r) => r.startsWith("H")),
        outcomes: outcomes.map(([observation, next_action]) => ({
          observation,
          next_action,
          claim_refs: refs.filter((r) => r.startsWith("H")),
        })),
      },
    ],
    claim_refs: refs,
    paper_connection: connection,
    transfer_lessons: [
      {
        lesson_id: `${id}-L1`,
        context: lesson[0],
        distinguish: lesson[1],
        action: lesson[2],
        boundary: lesson[3],
        claim_refs: refs,
      },
    ],
  };
}
const titles = [
  "核心问题与最终工作",
  "可能的研究起点",
  "关键决策节点",
  "失败与替代方向",
  "从探索收束为论文",
  "可以带走的研究判断",
];
function finish(
  b: Omit<AnalysisBundle, "sections">,
  prose: string[][],
  mapping: string[][],
): AnalysisBundle {
  const result: AnalysisBundle = {
    ...b,
    sections: titles.map((title, i) => ({
      section_id: `S${i + 1}`,
      title,
      blocks: prose[i].map((markdown, j) => ({
        block_id: `B${i + 1}-${j + 1}`,
        markdown,
        node_refs:
          i === 2
            ? [b.nodes[j].node_id]
            : i === 5
              ? b.nodes.map((n) => n.node_id)
              : [],
        claim_refs: mapping[i] ?? [],
        evidence_refs: [],
      })),
    })),
  };
  const check = validateBundle(result);
  if (!check.ok) throw new Error(check.errors.join("\n"));
  return result;
}
const common = {
  schema_version: "0.1.0",
  workflow_version: "0.1.0",
  analysis_version: 1,
  example_kind: "real_paper",
  status: "complete",
  provenance: {
    model: "gpt-6.1-sol",
    generated_at: new Date().toISOString(),
    host: "Codex desktop",
    material_policy: "targeted_public",
    tools: [
      "web search and source retrieval",
      "Node.js deterministic validation",
    ],
    usage: {
      elapsed_seconds: null,
      model_calls: null,
      tokens: null,
      note: "由 Codex 会话制作并自查的编辑案例；会话未提供可分离的逐篇调用数、耗时与 token 统计。不是独立评测。",
    },
  },
  validation: {
    semantic_review: "self_reviewed",
    notes: [
      "逐项核对关键来源文本、图注与支持范围；未复现实验；无人类评审记录。",
    ],
  },
  revision: null,
  manifest: {
    included: ["原创报告、节点、主张、来源定位和证据释义"],
    external: ["原始论文全文、补充材料与原宿主聊天记录"],
  },
} satisfies Partial<AnalysisBundle>;
const paths = (
  a: string,
  b: string,
  pa: string,
  pb: string,
): AnalysisBundle["paths"] => [
  {
    path_id: "P01",
    title: a,
    premise: pa,
    assumptions: ["逻辑重建，不主张这是作者实际研发日程"],
    node_refs: ["N01", "N02", "N03"],
    edge_refs: ["E01", "E02", "E03"],
    evidence_links: [link("EV01", "compatible")],
  },
  {
    path_id: "P02",
    title: b,
    premise: pb,
    assumptions: ["与 P01 并列的竞争解释，材料不能唯一确定起点"],
    node_refs: ["N01", "N02", "N03"],
    edge_refs: ["E01", "E02"],
    evidence_links: [link("EV02", "compatible")],
  },
];
const edges: AnalysisBundle["edges"] = [
  {
    edge_id: "E01",
    source_node_id: "N01",
    target_node_id: "N02",
    path_ids: ["P01", "P02"],
    relation_type: "logical_dependency",
    label: "先分清问题环节",
    epistemic_status: "hypothetical",
    evidence_refs: [],
  },
  {
    edge_id: "E02",
    source_node_id: "N02",
    target_node_id: "N03",
    path_ids: ["P01", "P02"],
    relation_type: "candidate_transition",
    label: "再检查简化是否保留作用",
    epistemic_status: "hypothetical",
    evidence_refs: [],
  },
  {
    edge_id: "E03",
    source_node_id: "N03",
    target_node_id: "N01",
    path_ids: ["P01"],
    relation_type: "return",
    label: "对照不支持时回查起点",
    epistemic_status: "hypothetical",
    evidence_refs: [],
  },
];

const resnet = finish(
  {
    ...structuredClone(common),
    analysis_id: "resnet-2015",
    paper: {
      title: "Deep Residual Learning for Image Recognition",
      authors: ["Kaiming He", "Xiangyu Zhang", "Shaoqing Ren", "Jian Sun"],
      identifier: "arxiv:1512.03385",
      version: "arXiv v1 · 2015-12-10",
      domain: "计算机视觉",
      research_type: "computational",
      url: "https://arxiv.org/abs/1512.03385v1",
    },
    sources: [
      {
        source_id: "S01",
        title: "Deep Residual Learning for Image Recognition",
        kind: "paper",
        url: "https://arxiv.org/pdf/1512.03385v1",
        version: "arXiv v1",
        published_at: "2015-12-10",
        read_status: "partial",
        fingerprint: null,
        availability_note:
          "核对引言、§3、§4.1 与相关图注和表格；未覆盖所有附录、代码或作者历史讲解。未读取的部分不作证据。",
      },
    ],
    evidence: [
      evidence(
        "EV01",
        "§1 Introduction",
        "Figure 1",
        "论文报告更深的普通网络出现更高训练误差，并据此区分退化与过拟合。",
        "作者报告的训练现象与解释；不证明作者先做了哪些失败实验。",
        0,
      ),
      evidence(
        "EV02",
        "§3.1–3.2",
        "Figure 2 / Equation 1",
        "论文将目标映射改写为残差与恒等旁路之和，并提出这种表示可能更易优化。",
        "方法定义是明示；优化更容易的解释不能升级为一般数学定理。",
        2,
        "author_interpretation",
      ),
      evidence(
        "EV03",
        "§4.1 ImageNet Classification",
        "Figure 4 / Table 2",
        "普通与残差网络在所述比较中匹配深度等条件；34 层残差网络训练与验证表现更好。",
        "支持这些设置中的残差设计效果；不单独识别全部机制，也不记录开发顺序。",
        4,
      ),
      evidence(
        "EV04",
        "§4.1 Identity vs. Projection Shortcuts",
        "Table 3",
        "A、B、C 三种旁路方案均优于普通对照；文中认为全投影方案的有限收益不足以抵消额外复杂度。",
        "结果与作者取舍分别保留；不能声称投影在所有任务都无用。",
        5,
      ),
    ],
    claims: [
      explicit("C01", "普通网络深度增加时，训练误差也可能升高。", "EV01"),
      explicit(
        "C02",
        "论文把映射写为 F(x)+x，并以恒等映射提供优化动机。",
        "EV02",
      ),
      explicit(
        "C03",
        "匹配条件下的残差对照在论文设置中改善了训练与验证表现。",
        "EV03",
      ),
      explicit(
        "C04",
        "论文比较了恒等与投影旁路，并讨论收益与复杂度取舍。",
        "EV04",
      ),
      inferred(
        "I01",
        "一种可能起点是先追踪深度退化，再寻找能保留已有解的表示。",
        "EV01",
        "研究者可能将训练误差异常视为优先问题",
        "也可能先受到残差或捷径表示启发，再系统构造退化对照",
      ),
      inferred(
        "I02",
        "另一种起点是先研究表示重写，再用深度比较说明价值。",
        "EV02",
        "表示上的直觉可能早于系统性深度实验",
        "也可能是优化异常直接推动了表示重写",
      ),
      hypothesis(
        "H01",
        "下面的选项、判别检验与回退行动是学习用方案，不是作者实际尝试记录。",
      ),
    ],
    paths: paths(
      "从优化异常出发",
      "从表示重写出发",
      "假设先观察到深层普通网络训练误差升高。",
      "假设先有 F(x)+x 的表示直觉，再设计诊断实验。",
    ),
    edges,
    nodes: [
      node(
        "N01",
        "先分清训练失败与泛化失败",
        "深度增加后效果变差，下一步该检查训练过程还是加正则？",
        "假设已看到深层模型验证误差更高，训练误差尚待核对。",
        "假设已有表示重写直觉，准备寻找能区分机制的深度对照。",
        ["C01", "I01", "H01"],
        [
          [
            "先查训练曲线",
            "比较训练与验证误差，检查预算、初始化和实现是否一致。",
          ],
          [
            "先增强正则化",
            "只有训练拟合更好但验证变差时，这条路线才有针对性。",
          ],
        ],
        "主要瓶颈在拟合还是泛化？",
        "在相同数据与可比预算下并列训练和验证曲线；检查收敛速度与最终误差，而不是只看榜单分数。",
        [
          [
            "训练误差也升高",
            "优先追查优化、表示与实现，暂不把问题归为过拟合。",
          ],
          [
            "训练误差降低而验证变差",
            "转向数据、正则和模型选择；重新评估优化假说。",
          ],
        ],
        "Figure 1 与 Figure 4 支持区分训练和验证现象；此处检查顺序为教学构造。",
        [
          "更大模型反而更差",
          "拟合、泛化与实现错误",
          "先比较错误发生在哪个环节",
          "训练曲线本身不能唯一证明优化机制",
        ],
      ),
      node(
        "N02",
        "让新结构保留一个已有解",
        "值得改变表示，还是只需更长训练与调参？",
        "假设已排除明显实现差异，训练退化仍存在。",
        "假设已有恒等旁路直觉，但尚不知道是否改善训练。",
        ["C02", "C03", "I02", "H01"],
        [
          [
            "加入无参数恒等旁路",
            "让层学习相对输入的改变，以较小结构变化检验表示作用。",
          ],
          ["延长普通网络训练", "检验有限训练预算的解释，并记录额外时间成本。"],
        ],
        "改善来自表示还是额外资源？",
        "比较匹配深度和宽度的普通与残差网络，并给普通网络可报告的预算扩展；检查多次运行差异。",
        [
          [
            "匹配预算下仍稳定改善",
            "支持继续研究残差表示，同时保留梯度传播等机制竞争解释。",
          ],
          ["延长普通训练后差距消失", "将主张收窄为效率收益，重新检查必要性。"],
        ],
        "§3 给出表示动机，Table 2 提供具体对照；不据此断言作者实际先后。",
        [
          "增加模块前已有简单可行解",
          "表示难学与解不存在",
          "找能保留旧解的小改动并做匹配比较",
          "已有解可表示，不保证优化器一定能找到它",
        ],
      ),
      node(
        "N03",
        "为复杂度增量寻找必要证据",
        "既然旁路有效，是否应该让每条旁路都可学习？",
        "假设残差效果已经在局部对照中成立，正在分配计算预算。",
        "假设工程实现已含投影，需要判断哪些部分是必要的。",
        ["C04", "H01"],
        [
          [
            "只在维度变化时投影",
            "用较简单结构保留功能，再检验容量变化的收益。",
          ],
          ["所有旁路使用投影", "付出参数和资源增量，要求独立的收益证据。"],
        ],
        "额外投影是否值得资源增量？",
        "对 A/B/C 方案使用一致协议，报告精度、资源和不确定性；把机制对照与最佳系统成绩分开。",
        [
          ["小收益且资源明显增加", "优先简化，把复杂度留给更有收益的地方。"],
          ["收益稳健且符合应用约束", "保留投影，但把结论限制在已检验设置。"],
        ],
        "Table 3 与对应段落记录作者取舍；教学方案增加了明确的反向结果。",
        [
          "有效方案包含多个可选模块",
          "核心作用与可选容量收益",
          "用局部对照决定哪些复杂度值得保留",
          "不同任务或预算可能改变取舍",
        ],
      ),
    ],
    limitations: [
      "没有作者实验日志或同期开发记录；两条路径均不是已核实历史。",
      "依据论文已读取正文、表格与图注，未运行代码或复现实验；未逐图视觉量测。",
      "本案例用于计算研究流程示范，不证明其他学科的有效性。",
    ],
  },
  [
    [
      "一个深层模型能表示浅层模型的解，并不表示训练程序容易找到它。论文最值得复盘的矛盾，是增加深度后连训练误差也会变差。残差表示把“直接学一个新映射”改成“在已有输入上学习改变”，使这个矛盾有了可检验的结构方案。",
    ],
    [
      "路径 P01 从训练异常出发：先问错误出现在哪个环节，再寻找保留已有解的结构。路径 P02 从表示直觉出发：先尝试残差形式，再用深度对照寻找它解决的问题。论文给出了论证与结果，但不足以唯一确定实际想法的发生顺序。",
    ],
    [
      "N01 先把训练与验证误差分开。若二者都变差，先检查优化和实现；若只有验证变差，正则和数据才更有针对性。这个分叉避免看到更深模型变差就直接增加正则。",
      "N02 用尽量小的结构变化检验表示作用。比较匹配条件的普通与残差网络，同时问延长普通网络训练能否消除差距。若差距消失，仍可能有效率价值，但不能继续讲成不可替代的能力。",
      "N03 在有效结构内再次做减法。恒等与投影旁路的比较应承担“额外容量值不值得”的判断，不能让最佳分数自动替所有复杂模块辩护。",
    ],
    [
      "训练退化是明确报告的现象；“作者反复失败后突然想到捷径”没有来源。更长训练、初始化、其他结构和正则方案在不同条件下都可能合理。它们的价值取决于能否区分假说，而不只是最终有没有赢过 ResNet。",
    ],
    [
      "研究收束需要两类证据：匹配条件下的比较解释结构选择，更深系统的结果显示扩展价值。二者不能互相替代。恒等映射动机提供可理解的设计理由，实验提供局部支持；两者合起来也不是普遍优化定理。",
    ],
    [
      "可以带走的判断是：先找失败发生的环节，再选择能区分解释的小改动；当核心作用已经成立，再衡量每一份复杂度的增量价值。N01、N02、N03 分别给出适用条件和不能推出的结论。",
    ],
  ],
  [
    ["C01", "C02"],
    ["I01", "I02"],
    ["H01"],
    ["C01", "H01"],
    ["C03", "C04"],
    ["H01"],
  ],
);

const crispr = finish(
  {
    ...structuredClone(common),
    analysis_id: "crispr-2012",
    paper: {
      title:
        "A programmable dual-RNA-guided DNA endonuclease in adaptive bacterial immunity",
      authors: [
        "Martin Jinek",
        "Krzysztof Chylinski",
        "Ines Fonfara",
        "Michael Hauer",
        "Jennifer A. Doudna",
        "Emmanuelle Charpentier",
      ],
      identifier: "doi:10.1126/science.1225829",
      version: "2012 article · PMC author manuscript",
      domain: "分子生物学",
      research_type: "experimental",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6286148/",
    },
    sources: [
      {
        source_id: "S01",
        title: "Jinek et al. 2012 — PMC author manuscript",
        kind: "paper",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6286148/",
        version: "PMC author manuscript of 2012 article",
        published_at: "2012-06-28",
        read_status: "read",
        fingerprint: null,
        availability_note:
          "读取 PMC 正文和图注；PMC 收录时间是 2018，不是研究发生时间；未读取补充 PDF 或复现实验。",
      },
    ],
    evidence: [
      evidence(
        "EV01",
        "Cas9 is a DNA endonuclease guided by two RNAs",
        "Figure 1A–B",
        "正文报告单独成熟 crRNA 不能引导所测切割；加入 tracrRNA 后出现切割，并报告互补序列等对照。",
        "支持所测体外体系的组分依赖；未证明作者完整探索顺序。",
      ),
      evidence(
        "EV02",
        "Dual-RNA requirements for target DNA binding and cleavage",
        null,
        "作者用催化失活 Cas9 的结合实验区分靶 DNA 识别与下游切割，并报告 tracrRNA 增强结合。",
        "读取的是正文对补充实验的报告，未单独核查 Figure S9 原始图。",
      ),
      evidence(
        "EV03",
        "Cas9 can be programmed with a single chimeric RNA",
        "Figure 5B–D",
        "正文报告较长嵌合 RNA 能引导切割，较短版本效率不足，并检验不同靶序列。",
        "支持文中体外引导设计，不等于已证实普遍的细胞内编辑。",
      ),
      evidence(
        "EV04",
        "Cas9 can be programmed with a single chimeric RNA",
        null,
        "正文明确将保留双 RNA 配对结构的想法与嵌合设计联系起来。",
        "作者公开设计理由；不是独立核实的完整研究史。",
        null,
        "author_interpretation",
      ),
    ],
    claims: [
      explicit("C01", "论文报告所测 Cas9 体外切割依赖双 RNA 结构。", "EV01"),
      explicit("C02", "论文通过结合读出区分识别与切割环节。", "EV02"),
      explicit("C03", "论文比较嵌合 RNA 设计并在体外检验不同靶点。", "EV03"),
      explicit("C04", "正文将嵌合设计与保留双 RNA 配对结构联系起来。", "EV04"),
      inferred(
        "I01",
        "一种候选路径是先分解天然机制，再寻求可保留功能的简化。",
        "EV01",
        "机制问题可能驱动组分与功能的分离",
        "也可能从可编程工具目标出发，反向寻找最小功能结构",
      ),
      inferred(
        "I02",
        "另一条候选路径以工具化为牵引，把机制检查作为设计约束。",
        "EV04",
        "可编程用途可能影响研究问题的优先级",
        "也可能先有机制发现，之后才形成工具用途",
      ),
      hypothesis(
        "H01",
        "以下比较、条件和行动分支是方法学习用推演，并非未公开实验记录。",
      ),
    ],
    paths: paths(
      "从机制分解出发",
      "从工具化目标出发",
      "假设先关心天然系统如何识别并切割 DNA。",
      "假设先有可编程引导的目标，再逐项检查必须保留的结构。",
    ),
    edges,
    nodes: [
      node(
        "N01",
        "先定位缺失的功能条件",
        "无切割信号时，缺的是引导组分还是体系本身失效？",
        "假设重构体系没有出现切割，尚不能归因于某个组分。",
        "假设正在简化引导体系，需要知道移除什么会丢失功能。",
        ["C01", "I01", "H01"],
        [
          [
            "比较组分增减",
            "把引导组分与体系活性对照分开，检查缺失组分是否解释结果。",
          ],
          [
            "直接修改蛋白",
            "可能改变多个环节，若没有活性与特异性读出会难以归因。",
          ],
        ],
        "阴性结果能否归因？",
        "使用与问题匹配的阳性、阴性和特异性对照；保证测量能够检测正常体系，再改变候选因素。",
        [
          [
            "恢复候选组分后功能出现",
            "继续检验其作用环节，避免只凭恢复现象定义全部机制。",
          ],
          ["正常对照也无读出", "先检查体系和测量，不把失败写成生物学结论。"],
        ],
        "Figure 1 提供组分与特异性证据；这里的故障诊断顺序是教学建议。",
        [
          "体系重构得到阴性结果",
          "缺失因素与测量或体系失效",
          "先让阴性结果具备可解释的对照",
          "对照恢复不等于唯一机制已被确定",
        ],
      ),
      node(
        "N02",
        "把识别与执行分开测",
        "组分影响切割，是因为不能结合，还是结合后不能执行？",
        "假设组分依赖已建立，但作用位置未知。",
        "假设简化设计失去功能，需要确定破坏了识别还是执行。",
        ["C02", "H01"],
        [
          ["增加独立结合读出", "让结合与切割两个环节不再被最终产物混在一起。"],
          ["继续只测最终切割", "可筛出有效方案，但不容易解释失效机制。"],
        ],
        "两种机制能否给出不同观察？",
        "选取不会把结合与执行混为一体的测量，先验证测量条件本身，再比较改变前后的两个环节。",
        [
          ["结合也改变", "优先检查识别或复合体形成，同时保留间接影响。"],
          [
            "结合保持而执行改变",
            "转向执行步骤，并检查测量灵敏度足以支持区分。",
          ],
        ],
        "正文报告催化失活蛋白的结合测量；补充图未独立复核，不假称已看原始图。",
        [
          "最终读出混合多个过程",
          "识别失败与执行失败",
          "增加能单独观察中间环节的读出",
          "分离测量可能扰动原体系，需要验证其可比性",
        ],
      ),
      node(
        "N03",
        "简化时保留功能结构",
        "把双 RNA 合并，应该保留什么，怎样判断简化成功？",
        "假设已知道部分配对结构与功能有关，准备测试简化。",
        "假设单一引导的用途已明确，但结构最小性未知。",
        ["C03", "C04", "I02", "H01"],
        [
          ["保留功能相互作用再合并", "先把候选结构约束写清，再比较设计。"],
          ["以最短结构为优先", "实现简洁，但可能同时破坏多个必要条件。"],
        ],
        "成功来自结构保留还是偶然的一个靶点？",
        "在保留双组分参考的条件下比较不同简化设计和不同靶序列；把体外可用与细胞内编辑分开评价。",
        [
          [
            "某些简化稳定保留功能",
            "扩展验证范围，并明确结论目前属于哪种体系。",
          ],
          [
            "简化失效或强依赖靶点",
            "回到结构与识别条件，不宣称通用工具已成立。",
          ],
        ],
        "Figure 5 的设计比较与多靶点测试支持局部可编程性；不证明后续细胞内能力。",
        [
          "把天然体系改造成工具",
          "最小长度与最小功能结构",
          "先写出必须保留的相互作用再简化",
          "体外活性不能直接外推到细胞内有效性",
        ],
      ),
    ],
    limitations: [
      "没有取得完整同期研发记录，不将逻辑顺序写成真实历史。",
      "正文与图注已核对；补充材料和原始数据未独立审查，未做实验复现。",
      "这是已发表基础机制工作的高层方法分析，不提供实验实施参数。",
    ],
  },
  [
    [
      "这项工作的关键研究判断，是把天然免疫过程拆成可以分辨作用环节的证据问题，再问哪些结构在简化后仍保留功能。仅看到“能切割”的最终结果，不足以知道引导、识别和执行分别由什么条件承担。",
    ],
    [
      "P01 从机制分解进入：先重构组分关系，再分离识别与切割，最后探索简化。P02 从工具目标进入：希望降低引导设计负担，因而需要反查哪些相互作用不能丢。作者明说了嵌合设计的结构理由；完整项目起点与全部试错仍未知。",
    ],
    [
      "N01 的问题是让阴性结果有解释力。若正常体系本身没有读出，缺组分与测量失败无法区分；若恢复候选组分后功能出现，还要继续检查它改变了哪个环节。",
      "N02 用独立读出拆开识别与切割。结合改变与结合不变但切割改变，会指向不同下一步。论文正文描述了这种区分，但本案例没有独立读取对应补充原始图。",
      "N03 把简化变成可证伪的设计问题：先明确保留哪些结构，再比较不同简化版本和不同目标。某个设计失效不必意味着方向无用，也可能说明删去了必要相互作用。",
    ],
    [
      "较短嵌合设计效率不足是正文报告的结果；作者曾经试过多少版本、是否先为应用而做机制，都不能从中推出。继续维持双组分、改变结构或延后工具化在不同证据条件下都可能合理。失败的价值在于区分功能条件，不能仅以成败排列故事。",
    ],
    [
      "核心证据链把组分依赖、中间环节与功能保留连起来。多靶点体外测试为可编程性增加支持；细胞内编辑、其他物种和更广条件需要各自的证据。收束时应把已实现能力与未来用途分开，不让后来的成功倒灌进早期论证。",
    ],
    [
      "可以迁移的是“让阴性结果可解释”“用中间读出定位作用环节”“按功能约束简化”。这些判断在其他体系也有启发，但前提是对照可靠、测量能区分过程，且简化没有同时改变无法追踪的因素。",
    ],
  ],
  [
    ["C01"],
    ["I01", "I02", "C04"],
    ["H01"],
    ["C03", "H01"],
    ["C02", "C03"],
    ["H01"],
  ],
);

await mkdir("examples", { recursive: true });
await mkdir("examples/reports", { recursive: true });
for (const b of [resnet, crispr]) {
  await writeFile(
    `examples/${b.analysis_id}.json`,
    JSON.stringify(b, null, 2) + "\n",
  );
  await writeFile(`examples/reports/${b.analysis_id}.md`, exportMarkdown(b));
}
console.log("Curated two development cases. LIGO remains held out.");
