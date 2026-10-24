// Public copies preserve the raw trial outputs; the reader case is an explicitly documented adaptation.
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import type { AnalysisBundle } from "../core/schema";
import { validateBundle } from "../core/validate";
import { exportMarkdown } from "../core/export";

await mkdir("evals/ligo/skill", { recursive: true });
await mkdir("evals/ligo/baseline", { recursive: true });
for (const name of [
  "analysis.json",
  "report.md",
  "frozen-skill-hashes.json",
  "node-discussion.json",
  "node-discussion.md",
  "node-answer.md",
  "analysis-v2.json",
  "report-v2.md",
  "revision-summary.md",
  "continuation-record.json",
])
  await cp(`work/evaluation-skill/${name}`, `evals/ligo/skill/${name}`);
await cp("work/evaluation-baseline/report.md", "evals/ligo/baseline/report.md");
const baselineRecord = JSON.parse(
  await readFile("work/evaluation-baseline/run-record.json", "utf8"),
);
await writeFile(
  "evals/ligo/baseline/run-record.json",
  JSON.stringify(baselineRecord, null, 2) + "\n",
);
const skillRecord = JSON.parse(
  await readFile("work/evaluation-skill/run-record.json", "utf8"),
);
skillRecord.skill_and_references_read =
  skillRecord.skill_and_references_read.map((s: string) =>
    /^[A-Z]:\//i.test(s) ? "bundled PDF skill (installation path redacted)" : s,
  );
skillRecord.publication_note =
  "仅规范化本机技能安装绝对路径；原始报告、计时和试用结果未改写。";
await writeFile(
  "evals/ligo/skill/run-record.json",
  JSON.stringify(skillRecord, null, 2) + "\n",
);

const b = JSON.parse(
  await readFile("work/evaluation-skill/analysis.json", "utf8"),
) as AnalysisBundle;
b.analysis_id = "ligo-2016";
b.example_kind = "real_paper";
b.paper.url = "https://arxiv.org/abs/1602.03837v1";
b.sources[0].title = "LIGO 2016 出版稿的逐页提取正文（未附带全文）";
b.sources[0].url = "https://arxiv.org/pdf/1602.03837v1";
b.sources[0].availability_note += " 此公开链接指向提取所用的原论文 PDF。";
b.sources[1].title = "LIGO 2016 出版稿 PDF";
b.sources[1].url = "https://arxiv.org/pdf/1602.03837v1";
b.limitations.push(
  "S1 与 S2 是同一论文的文本和 PDF 表示，不能当作两个独立证据来源。",
);
b.provenance.usage.note +=
  " 公开示例由原始留出试用补充来源链接、示例标识并细分段落映射；原始产物保留在 evals/ligo/skill。";
const mapping = [
  [["C1"], ["C1"]],
  [["I1"], ["I2", "C2"], ["I1", "I2"]],
  b.nodes.map((n) => n.claim_refs),
  [["H1"], ["C13"], ["C9"]],
  [["C3", "C5", "C8", "C10"], ["C11"], ["C12", "C13"]],
  [
    ["H2", "H3"],
    ["H4", "H5"],
    ["H6", "H7"],
  ],
];
b.sections.forEach((s, i) => {
  const paragraphs = s.blocks
    .flatMap((x) => x.markdown.split(/\n\s*\n/))
    .filter(Boolean);
  s.blocks = paragraphs.map((markdown, j) => ({
    block_id: `${s.section_id}-P${j + 1}`,
    markdown,
    node_refs:
      i === 2
        ? [b.nodes[j].node_id]
        : i === 5
          ? b.nodes.slice(j * 2, j * 2 + 2).map((n) => n.node_id)
          : [],
    claim_refs: mapping[i][j] ?? [],
    evidence_refs: [],
  }));
});
const check = validateBundle(b);
if (!check.ok) throw new Error(check.errors.join("\n"));
await writeFile("examples/ligo-2016.json", JSON.stringify(b, null, 2) + "\n");
await writeFile("examples/reports/ligo-2016.md", exportMarkdown(b));
console.log("Published raw trial records and documented reader adaptation.");
