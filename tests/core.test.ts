import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { AnalysisBundle } from "../core/schema";
import {
  assertNoVersionConflict,
  checkRevision,
  parseBundle,
  validateBundle,
  validateDiscussion,
} from "../core/validate";
import {
  createDiscussion,
  discussionMarkdown,
  exportMarkdown,
  safeUrl,
} from "../core/export";
const fixture = () =>
  JSON.parse(
    readFileSync("examples/resnet-2015.json", "utf8"),
  ) as AnalysisBundle;
const errors = (b: unknown) => {
  const r = validateBundle(b);
  return r.ok ? [] : r.errors;
};
describe("result contract", () => {
  it("round-trips the complete result with stable identities", () => {
    const b = fixture();
    const r = parseBundle(JSON.stringify(b));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(b);
  });
  it("rejects bad JSON and incompatible schema versions", () => {
    expect(parseBundle("{")).toEqual({
      ok: false,
      errors: ["文件不是有效的 JSON"],
    });
    const b = fixture();
    (b as { schema_version: string }).schema_version = "9";
    expect(errors(b).length).toBeGreaterThan(0);
  });
  it("rejects missing references and duplicate IDs", () => {
    const b = fixture();
    b.claims[0].evidence_links[0].evidence_id = "missing";
    b.nodes.push(b.nodes[0]);
    expect(errors(b).join()).toMatch(/missing reference missing/);
    expect(errors(b).join()).toMatch(/duplicate ID N01/);
  });
  it("rejects missing or duplicated path contexts", () => {
    const b = fixture();
    b.nodes[0].path_contexts = [
      b.nodes[0].path_contexts[0],
      b.nodes[0].path_contexts[0],
    ];
    expect(errors(b).join()).toMatch(/missing path-specific context/);
    expect(errors(b).join()).toMatch(/duplicate path context/);
  });
  it("rejects inconsistent edge membership", () => {
    const b = fixture();
    b.paths[0].edge_refs = [];
    expect(errors(b).join()).toMatch(/endpoints or edge absent/);
  });
  it("retains cycles as meaningful returns rather than requiring a DAG", () => {
    const b = fixture();
    expect(b.edges.some((e) => e.relation_type === "return")).toBe(true);
    expect(validateBundle(b).ok).toBe(true);
  });
  it("requires historical evidence for chronological claims", () => {
    const b = fixture();
    b.edges[0].relation_type = "explicit_chronology";
    b.edges[0].epistemic_status = "explicit";
    b.edges[0].evidence_refs = ["EV01"];
    expect(errors(b).join()).toMatch(/historical evidence/);
  });
  it("does not let an unavailable source supply evidence", () => {
    const b = fixture();
    b.sources[0].read_status = "unavailable";
    expect(errors(b).join()).toMatch(/unavailable source/);
  });
  it("allows a partial result with honest missing-material notice", () => {
    const b = fixture();
    b.status = "partial";
    b.nodes = [];
    b.edges = [];
    b.claims = [];
    b.evidence = [];
    b.paths = [
      { ...b.paths[0], node_refs: [], edge_refs: [], evidence_links: [] },
    ];
    b.sections = [
      {
        section_id: "gap",
        title: "全文不可得",
        blocks: [
          {
            block_id: "gap-1",
            markdown: "仅有摘要，尚不能复盘方法选择。",
            node_refs: [],
            claim_refs: [],
            evidence_refs: [],
          },
        ],
      },
    ];
    b.limitations = ["全文访问失败"];
    expect(validateBundle(b).ok).toBe(true);
    b.limitations = [];
    expect(validateBundle(b).ok).toBe(false);
  });
  it("requires explicit evidence and qualified inferences", () => {
    const b = fixture();
    b.claims[0].evidence_links = [];
    b.claims.find((c) => c.epistemic_status === "inferred")!.alternatives = [];
    expect(errors(b).join()).toMatch(/direct supporting evidence/);
    expect(errors(b).join()).toMatch(/inference needs/);
  });
  it("does not execute or resolve user-supplied URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("data:text/html,x")).toBeUndefined();
    expect(safeUrl("file:///c:/secret")).toBeUndefined();
    expect(safeUrl("https://example.org/x")).toBe("https://example.org/x");
  });
});
describe("discussion and revisions", () => {
  it("exports exactly one path context and every referenced claim/evidence", () => {
    const b = fixture();
    const d = createDiscussion(b, "P02", "N01", "为什么？");
    expect(d.node.path_contexts.map((c) => c.path_id)).toEqual(["P02"]);
    expect(JSON.stringify(d.node.path_contexts)).not.toContain(
      b.nodes[0].path_contexts[0].known_information[0].text,
    );
    expect(validateDiscussion(d)).toBe(true);
    expect(
      d.claims
        .flatMap((c) => c.evidence_links)
        .every((l) => d.evidence.some((e) => e.evidence_id === l.evidence_id)),
    ).toBe(true);
    expect(d.materials.note).toContain("不含完整论文");
  });
  it("rejects an unrelated path or node and an empty question", () => {
    const b = fixture();
    expect(() => createDiscussion(b, "missing", "N01", "问题")).toThrow();
    expect(() => createDiscussion(b, "P01", "missing", "问题")).toThrow();
    expect(() => createDiscussion(b, "P01", "N01", " ")).toThrow();
  });
  it("rejects an incomplete or leaking imported discussion package", () => {
    const d = createDiscussion(fixture(), "P02", "N01", "问题");
    d.node.path_contexts.push(fixture().nodes[0].path_contexts[0]);
    expect(validateDiscussion(d)).toBe(false);
    d.node.path_contexts.pop();
    d.evidence = [];
    expect(validateDiscussion(d)).toBe(false);
  });
  it("preserves direct and participatory invocation and version", () => {
    const d = createDiscussion(
      fixture(),
      "P01",
      "N01",
      "问题",
      "participatory",
    );
    const md = discussionMarkdown(d);
    expect(md).toContain("$paper-reconstruction");
    expect(md).toContain("参与式判断");
    expect(md).toContain("v1");
    expect(md).toContain("完整报告不在本包");
  });
  it("exports a standalone report with claim natures and source locations", () => {
    const md = exportMarkdown(fixture());
    expect(md).toContain("原文明示");
    expect(md).toContain("有依据推断");
    expect(md).toContain("PDF 第 1 页");
    expect(md).toContain("研究起点");
  });
  it("ignores JSON property order but refuses a same-version content change", () => {
    const a = fixture();
    expect(() =>
      assertNoVersionConflict(a, JSON.parse(JSON.stringify(a))),
    ).not.toThrow();
    const reordered = Object.fromEntries(
      Object.entries(a).reverse(),
    ) as AnalysisBundle;
    expect(() => assertNoVersionConflict(a, reordered)).not.toThrow();
    a.claims[0].text = "changed";
    expect(() => assertNoVersionConflict(fixture(), a)).toThrow(/新版本/);
  });
  it("requires an adjacent version and complete old-node mapping", () => {
    const old = fixture(),
      next = fixture();
    next.analysis_version = 2;
    next.revision = {
      previous_version: 1,
      change_reason: "收窄支持范围",
      node_mappings: old.nodes.map((n) => ({
        old_node_id: n.node_id,
        new_node_ids: [n.node_id],
        change: "retained",
      })),
    };
    expect(validateBundle(next).ok).toBe(true);
    expect(checkRevision(old, next)).toEqual([]);
    next.revision.node_mappings.pop();
    expect(checkRevision(old, next).join()).toMatch(/缺少节点/);
    next.paper.version = "another";
    expect(checkRevision(old, next).join()).toMatch(/论文版本/);
  });
});
