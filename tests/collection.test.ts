import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type {
  CollectionAnalysisBundle as Bundle,
  CollectionIntake,
} from "../core/collection-schema";
import {
  validateCollection,
  validateIntake,
  createCollectionDiscussion,
  collectionDiscussionErrors,
  checkCollectionRevision,
  normalizeWork,
} from "../core/collection";
import {
  parseAnyBundle,
  exportAnyMarkdown,
  assertAnyConflict,
} from "../core/workbench";
const fixture = (): Bundle =>
  JSON.parse(readFileSync("examples/residual-programme.json", "utf8"));
const errors = (b: unknown) => {
  const r = validateCollection(b);
  return r.ok ? [] : r.errors;
};
function intake(count = 1): CollectionIntake {
  const b = fixture();
  return {
    kind: "collection_intake",
    schema_version: "0.2.0",
    stage: "awaiting_selection",
    goal: b.collection.goal,
    user_clue: b.collection.user_clue,
    provided_papers: b.papers,
    search: {
      status: "completed",
      queries: ["targeted gap query"],
      note: "Synthetic consent fixture, not a real recommendation",
      candidates: Array.from({ length: count }, (_, i) => ({
        candidate_id: `Q${i}`,
        work_id: `doi:10.0000/test${i}`,
        title: `测试候选${i}`,
        authors: ["Test"],
        year: 2020,
        version: "v1",
        url: `https://example.org/test${i}`,
        related_paper_refs: ["R"],
        gap: "测试缺口",
        expected_change: "测试判断",
        inspected_material: "模拟元数据",
        full_text_status: "unknown",
        decision: "pending",
        decision_record: null,
        decision_source: null,
      })),
    },
  };
}
function decide(i: CollectionIntake, decisions: ("accepted" | "rejected")[]) {
  i.stage = "frozen";
  i.search.candidates.forEach((c, n) => {
    c.decision = decisions[n];
    c.decision_source = "simulated_test";
    c.decision_record = `模拟用户明确${decisions[n]}`;
  });
  return i;
}
function withSelection(i: CollectionIntake) {
  const b = fixture();
  b.provenance.material_policy = "targeted_public";
  b.search = i.search;
  for (const c of i.search.candidates.filter(
    (c) => c.decision === "accepted",
  )) {
    const p = structuredClone(b.papers[0]);
    Object.assign(p, {
      paper_id: c.candidate_id,
      work_id: c.work_id,
      identifier: c.work_id,
      aliases: [],
      title: c.title,
      version: c.version,
      origin: "accepted_recommendation",
      candidate_id: c.candidate_id,
      read_status: "unavailable",
      material_note: "模拟材料不可得，不产生主张",
    });
    b.papers.push(p);
    b.paper_cards.push({
      paper_id: p.paper_id,
      question: { text: "材料不足", claim_refs: [] },
      conditions: [],
      assumptions: [],
      choices: [],
      discriminating_evidence: [],
      findings: [],
      limitations: ["模拟全文缺失"],
      open_questions: [],
      evidence_refs: [],
    });
  }
  return b;
}
describe("collection identity and consent", () => {
  it("distinguishes not-yet-searched from failed search and preserves failed queries", () => {
    const i = intake(0);
    i.stage = "registered";
    i.search = {
      status: "not_started",
      queries: [],
      candidates: [],
      note: "尚未执行",
    };
    expect(validateIntake(i)).toEqual([]);
    i.stage = "frozen";
    expect(validateIntake(i).join()).toContain("尚未执行");
    i.search = {
      status: "unavailable",
      queries: ["实际尝试的检索"],
      candidates: [],
      note: "工具连接失败",
    };
    expect(validateIntake(i)).toEqual([]);
  });
  it("round trips old and new formats and rejects unknown versions", () => {
    const b = fixture();
    expect(parseAnyBundle(JSON.stringify(b))).toMatchObject({
      ok: true,
      value: b,
    });
    expect(
      parseAnyBundle(readFileSync("examples/resnet-2015.json", "utf8")).ok,
    ).toBe(true);
    expect(
      parseAnyBundle(JSON.stringify({ ...b, schema_version: "0.3.0" })).ok,
    ).toBe(false);
    expect(parseAnyBundle("{").ok).toBe(false);
    expect(exportAnyMarkdown(b)).toContain("单篇证据卡");
  });
  it.each([0, 1, 3])(
    "allows %i recommendations but never silently accepts pending candidates",
    (count) => {
      const i = intake(count);
      if (!count) i.stage = "frozen";
      expect(validateIntake(i)).toEqual([]);
      if (count) {
        i.stage = "frozen";
        expect(validateIntake(i).join()).toContain("未答复");
      }
    },
  );
  it("rejects a fourth recommendation and repeated work versions", () => {
    expect(validateIntake(intake(4)).join()).toContain("3");
    const i = intake(2);
    i.search.candidates[1].work_id = i.search.candidates[0].work_id;
    expect(validateIntake(i).join()).toContain("重复");
    const b = fixture();
    b.papers[1].aliases = ["https://arxiv.org/pdf/1512.03385v3.pdf"];
    expect(errors(b).join()).toContain("身份重复");
    expect(normalizeWork("arxiv:1512.03385v1")).toBe("1512.03385");
  });
  it.each([
    ["accepted", "accepted", "accepted"],
    ["accepted", "rejected", "rejected"],
    ["rejected", "rejected", "rejected"],
  ] as const)("validates explicit decision pattern %j", (...choices) => {
    const i = decide(intake(3), [...choices]);
    expect(validateIntake(i)).toEqual([]);
    expect(errors(withSelection(i))).toEqual([]);
  });
  it("rejects unapproved inclusion and refused evidence even with another URL version", () => {
    const i = decide(intake(), ["accepted"]);
    const b = withSelection(i);
    b.search.candidates[0].decision = "rejected";
    expect(errors(b).join()).toContain("未获明确同意");
    const rejected = fixture();
    rejected.provenance.material_policy = "targeted_public";
    rejected.search = decide(intake(), ["rejected"]).search;
    rejected.search.candidates[0].url = "https://arxiv.org/abs/1234.56789v1";
    rejected.sources[0].url = "https://arxiv.org/pdf/1234.56789v2.pdf";
    expect(errors(rejected).join()).toContain("未采纳候选");
  });
  it("enforces provided-only and records retrieval failure without inventing a search", () => {
    const b = fixture();
    b.search = intake(0).search;
    expect(errors(b).join()).toContain("禁止外部检索");
    b.provenance.material_policy = "targeted_public";
    b.search = {
      status: "unavailable",
      queries: [],
      candidates: [],
      note: "检索工具失败，继续原材料",
    };
    expect(errors(b)).toEqual([]);
  });
});
describe("collection evidence, discussion and revisions", () => {
  it("allows a shared source while keeping claims and cards scoped to papers", () => {
    const b = fixture();
    b.sources[0].paper_refs = ["R", "I"];
    expect(errors(b)).toEqual([]);
    b.sources[0].paper_refs = ["I"];
    expect(errors(b).join()).toContain("evidence paper scope mismatch");
  });
  it("rejects broken paper and relation endpoints and card contamination", () => {
    const b = fixture();
    b.sources[0].paper_refs = ["absent"];
    b.relations[0].to_paper_id = "absent";
    b.paper_cards[0].evidence_refs.push("E4");
    expect(errors(b).join()).toMatch(/missing reference absent/);
    expect(errors(b).join()).toContain("混入");
  });
  it("does not turn symmetric similarity into an influence arrow or promote an inference", () => {
    const b = fixture();
    b.relations[0].kind = "surface_similarity";
    b.relations[0].directed = true;
    b.relations[0].epistemic_status = "explicit";
    expect(errors(b).join()).toContain("对称关系");
    expect(errors(b).join()).toContain("证据性质");
  });
  it("isolates future evidence from candidate-path known conditions", () => {
    const b = fixture();
    b.nodes[0].path_contexts.find(
      (c) => c.path_id === "P2",
    )!.known_information[0].claim_refs = ["C4"];
    expect(errors(b).join()).toContain("泄漏");
  });
  it("supports isolated papers and multiple clusters without forced relations", () => {
    const b = fixture();
    b.relations = [];
    b.sections.forEach((s) => s.blocks.forEach((x) => (x.relation_refs = [])));
    b.clusters = b.papers.map((p) => ({
      cluster_id: p.paper_id,
      title: p.title,
      rationale: "没有共同主线",
      paper_refs: [p.paper_id],
      claim_refs: [],
    }));
    expect(errors(b)).toEqual([]);
  });
  it("exports a local relation package and one-path node context", () => {
    const b = fixture();
    const d = createCollectionDiscussion(
      b,
      { kind: "relation", relation_id: "R1" },
      "为何？",
    );
    expect(collectionDiscussionErrors(d)).toEqual([]);
    expect(d.path).toBeNull();
    expect(d.node).toBeNull();
    expect(d.materials.note).toContain("不含完整论文");
    expect(d.claims.length).toBeLessThan(b.claims.length);
    const n = createCollectionDiscussion(
      b,
      { kind: "node", path_id: "P2", node_id: "N1" },
      "当时？",
    );
    expect(collectionDiscussionErrors(n)).toEqual([]);
    expect(n.node!.path_contexts.map((c) => c.path_id)).toEqual(["P2"]);
    n.path!.available_source_refs = [];
    expect(collectionDiscussionErrors(n).join()).toContain("泄漏");
  });
  it("checks missing discussion evidence and invalid targets", () => {
    const b = fixture();
    expect(() =>
      createCollectionDiscussion(
        b,
        { kind: "node", path_id: "P2", node_id: "N2" },
        "为何",
      ),
    ).toThrow();
    const d = createCollectionDiscussion(
      b,
      { kind: "relation", relation_id: "R1" },
      "问题",
    );
    d.evidence = [];
    expect(collectionDiscussionErrors(d).length).toBeGreaterThan(0);
  });
  it("preserves scope across revisions and refuses same-version conflicts", () => {
    const b = fixture(),
      n = fixture();
    n.analysis_version = 2;
    n.revision = {
      previous_version: 1,
      change_reason: "收窄解释",
      node_mappings: b.nodes.map((x) => ({
        old_node_id: x.node_id,
        new_node_ids: [x.node_id],
        change: "retained",
      })),
      relation_mappings: b.relations.map((x) => ({
        old_relation_id: x.relation_id,
        new_relation_ids: [x.relation_id],
        change: "retained",
      })),
    };
    expect(checkCollectionRevision(b, n)).toEqual([]);
    n.papers[0].version = "v9";
    expect(checkCollectionRevision(b, n).join()).toContain("新的分析 ID");
    n.papers[0].version = b.papers[0].version;
    n.revision.relation_mappings.pop();
    expect(checkCollectionRevision(b, n).join()).toContain("修订映射");
    const same = fixture();
    same.collection.title = "conflict";
    expect(() => assertAnyConflict(b, same)).toThrow("新版本");
  });
  it("can represent unreadable scans as partial results without fabricated nodes", () => {
    const b = fixture();
    b.status = "partial";
    b.papers.forEach((p) => (p.read_status = "unavailable"));
    b.sources.forEach((s) => (s.read_status = "unavailable"));
    b.claims = [];
    b.evidence = [];
    b.nodes = [];
    b.edges = [];
    b.relations = [];
    b.clusters = [];
    b.comparisons = [];
    b.paths = [
      {
        ...b.paths[0],
        node_refs: [],
        edge_refs: [],
        evidence_links: [],
        available_source_refs: [],
      },
    ];
    b.paper_cards = b.papers.map((p) => ({
      paper_id: p.paper_id,
      question: { text: "未读取", claim_refs: [] },
      conditions: [],
      assumptions: [],
      choices: [],
      discriminating_evidence: [],
      findings: [],
      limitations: ["扫描件未OCR"],
      open_questions: [],
      evidence_refs: [],
    }));
    b.sections = [
      {
        section_id: "gap",
        title: "材料不足",
        blocks: [
          {
            block_id: "gap",
            markdown: "扫描件不可读",
            paper_refs: [],
            relation_refs: [],
            node_refs: [],
            claim_refs: [],
            evidence_refs: [],
          },
        ],
      },
    ];
    b.limitations = ["扫描件不可读且全文缺失"];
    expect(errors(b)).toEqual([]);
    b.status = "complete";
    expect(errors(b).join()).toContain("不足两篇");
  });
});
