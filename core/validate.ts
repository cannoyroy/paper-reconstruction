import Ajv from "ajv";
import {
  analysisSchema,
  discussionSchema,
  type AnalysisBundle,
  type DiscussionContext,
} from "./schema";

const ajv = new Ajv({ allErrors: true, strict: true });
const checkAnalysis = ajv.compile<AnalysisBundle>(analysisSchema);
const checkDiscussion = ajv.compile<DiscussionContext>(discussionSchema);
export type ValidationResult =
  | { ok: true; value: AnalysisBundle; warnings: string[] }
  | { ok: false; errors: string[] };
export class AnalysisConflictError extends Error {}

export function validateBundle(input: unknown): ValidationResult {
  if (!checkAnalysis(input))
    return {
      ok: false,
      errors: (checkAnalysis.errors ?? []).map(
        (e) =>
          `${e.instancePath || "/"} ${e.message}${e.params.additionalProperty ? ` (${e.params.additionalProperty})` : ""}`,
      ),
    };
  return validateShared(input);
}

export function validateShared<
  T extends Omit<AnalysisBundle, "paper" | "schema_version" | "revision"> & {
    revision: AnalysisBundle["revision"];
  },
>(
  b: T,
):
  { ok: true; value: T; warnings: string[] } | { ok: false; errors: string[] } {
  const errors: string[] = [],
    warnings: string[] = [];
  const index = <T>(items: T[], key: keyof T, name: string) => {
    const map = new Map<string, T>();
    for (const item of items) {
      const id = String(item[key]);
      if (map.has(id)) errors.push(`${name}: duplicate ID ${id}`);
      map.set(id, item);
    }
    return map;
  };
  const sources = index(b.sources, "source_id", "sources"),
    evidence = index(b.evidence, "evidence_id", "evidence"),
    claims = index(b.claims, "claim_id", "claims");
  const paths = index(b.paths, "path_id", "paths"),
    nodes = index(b.nodes, "node_id", "nodes"),
    edges = index(b.edges, "edge_id", "edges");
  index(b.sections, "section_id", "sections");
  index(
    b.sections.flatMap((s) => s.blocks),
    "block_id",
    "blocks",
  );
  index(
    b.nodes.flatMap((n) => n.transfer_lessons),
    "lesson_id",
    "lessons",
  );
  const checkRefs = (ids: string[], map: Map<string, unknown>, where: string) =>
    ids.forEach((id) => {
      if (!map.has(id)) errors.push(`${where}: missing reference ${id}`);
    });
  const checkLinks = (
    links: AnalysisBundle["claims"][number]["evidence_links"],
    where: string,
  ) =>
    checkRefs(
      links.map((l) => l.evidence_id),
      evidence,
      where,
    );
  for (const e of b.evidence) {
    checkRefs([e.source_id], sources, e.evidence_id);
    if (sources.get(e.source_id)?.read_status === "unavailable")
      errors.push(
        `${e.evidence_id}: unavailable source cannot provide evidence`,
      );
    if (!Object.values(e.locator).some((x) => x !== null))
      warnings.push(`${e.evidence_id}: missing locator`);
  }
  for (const c of b.claims) {
    checkLinks(c.evidence_links, c.claim_id);
    if (
      c.epistemic_status === "explicit" &&
      !c.evidence_links.some((l) => l.relation === "supports")
    )
      errors.push(
        `${c.claim_id}: explicit claim needs direct supporting evidence`,
      );
    if (
      c.epistemic_status === "inferred" &&
      (!c.evidence_links.length ||
        !c.assumptions.length ||
        !c.alternatives.length)
    )
      errors.push(
        `${c.claim_id}: inference needs evidence, assumptions and alternatives`,
      );
  }
  for (const p of b.paths) {
    checkRefs(p.node_refs, nodes, p.path_id);
    checkRefs(p.edge_refs, edges, p.path_id);
    checkLinks(p.evidence_links, p.path_id);
    for (const id of p.node_refs)
      if (
        nodes.has(id) &&
        !nodes.get(id)!.path_contexts.some((c) => c.path_id === p.path_id)
      )
        errors.push(`${p.path_id}/${id}: missing path-specific context`);
    for (const id of p.edge_refs)
      if (edges.has(id) && !edges.get(id)!.path_ids.includes(p.path_id))
        errors.push(`${p.path_id}/${id}: inconsistent edge membership`);
  }
  for (const n of b.nodes) {
    index(n.options, "option_id", n.node_id);
    index(n.discriminating_tests, "test_id", n.node_id);
    const seen = new Set<string>();
    for (const c of n.path_contexts) {
      if (seen.has(c.path_id))
        errors.push(`${n.node_id}: duplicate path context ${c.path_id}`);
      seen.add(c.path_id);
      if (!paths.get(c.path_id)?.node_refs.includes(n.node_id))
        errors.push(`${n.node_id}: inconsistent path membership ${c.path_id}`);
      c.known_information.forEach((k) =>
        checkRefs(k.claim_refs, claims, `${n.node_id}/known_information`),
      );
    }
    checkRefs(n.claim_refs, claims, n.node_id);
    n.options.forEach((o) =>
      checkRefs(o.claim_refs, claims, `${n.node_id}/${o.option_id}`),
    );
    n.discriminating_tests.forEach((t) => {
      checkRefs(t.claim_refs, claims, t.test_id);
      t.outcomes.forEach((o) => checkRefs(o.claim_refs, claims, t.test_id));
    });
    n.transfer_lessons.forEach((l) =>
      checkRefs(l.claim_refs, claims, l.lesson_id),
    );
  }
  for (const e of b.edges) {
    checkRefs([e.source_node_id, e.target_node_id], nodes, e.edge_id);
    checkRefs(e.path_ids, paths, e.edge_id);
    checkRefs(e.evidence_refs, evidence, e.edge_id);
    if (!e.path_ids.length)
      errors.push(`${e.edge_id}: edge needs path membership`);
    for (const pid of e.path_ids) {
      const p = paths.get(pid);
      if (
        p &&
        (!p.edge_refs.includes(e.edge_id) ||
          !p.node_refs.includes(e.source_node_id) ||
          !p.node_refs.includes(e.target_node_id))
      )
        errors.push(`${e.edge_id}: endpoints or edge absent from path ${pid}`);
    }
    if (
      e.relation_type === "explicit_chronology" &&
      (e.epistemic_status !== "explicit" ||
        !e.evidence_refs.some(
          (id) => evidence.get(id)?.evidence_type === "historical_account",
        ))
    )
      errors.push(
        `${e.edge_id}: chronology needs explicit historical evidence`,
      );
  }
  for (const s of b.sections)
    for (const block of s.blocks) {
      checkRefs(block.node_refs, nodes, block.block_id);
      checkRefs(block.claim_refs, claims, block.block_id);
      checkRefs(block.evidence_refs, evidence, block.block_id);
    }
  if (b.status === "complete" && (b.sections.length !== 6 || !b.nodes.length))
    errors.push("complete result needs six sections and decision nodes");
  if (b.status === "partial" && !b.limitations.length)
    errors.push("partial result needs specific limitations");
  if (b.analysis_version === 1 && b.revision !== null)
    errors.push("first analysis version must not have a predecessor");
  if (
    b.analysis_version > 1 &&
    (!b.revision || b.revision.previous_version !== b.analysis_version - 1)
  )
    errors.push("revision must point to the immediately previous version");
  if (b.revision)
    for (const m of b.revision.node_mappings)
      checkRefs(m.new_node_ids, nodes, `revision/${m.old_node_id}`);
  if (b.validation.semantic_review === "pending")
    warnings.push("证据支持关系尚未完成语义审查");
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: b, warnings };
}

export function parseBundle(text: string): ValidationResult {
  try {
    return validateBundle(JSON.parse(text));
  } catch {
    return { ok: false, errors: ["文件不是有效的 JSON"] };
  }
}

export function discussionErrors(input: unknown): string[] {
  if (!checkDiscussion(input))
    return (checkDiscussion.errors ?? []).map(
      (e) => `${e.instancePath || "/"} ${e.message}`,
    );
  const d = input,
    errors: string[] = [];
  if (!d.path.node_refs.includes(d.node.node_id))
    errors.push("节点不属于讨论路径");
  if (
    d.node.path_contexts.length !== 1 ||
    d.node.path_contexts[0].path_id !== d.path.path_id
  )
    errors.push("讨论包只能包含所选路径的条件");
  for (const [name, ids] of [
    ["claims", d.claims.map((c) => c.claim_id)],
    ["evidence", d.evidence.map((e) => e.evidence_id)],
    ["sources", d.sources.map((s) => s.source_id)],
  ] as const)
    if (new Set(ids).size !== ids.length) errors.push(`${name}: duplicate ID`);
  const claimIds = new Set(d.claims.map((c) => c.claim_id)),
    evidenceIds = new Set(d.evidence.map((e) => e.evidence_id)),
    sourceIds = new Set(d.sources.map((s) => s.source_id));
  const neededClaims = [
    ...d.node.claim_refs,
    ...d.node.path_contexts.flatMap((c) =>
      c.known_information.flatMap((k) => k.claim_refs),
    ),
    ...d.node.options.flatMap((o) => o.claim_refs),
    ...d.node.discriminating_tests.flatMap((t) => [
      ...t.claim_refs,
      ...t.outcomes.flatMap((o) => o.claim_refs),
    ]),
    ...d.node.transfer_lessons.flatMap((l) => l.claim_refs),
  ];
  neededClaims.forEach((id) => {
    if (!claimIds.has(id)) errors.push(`missing claim ${id}`);
  });
  [
    ...d.path.evidence_links,
    ...d.claims.flatMap((c) => c.evidence_links),
  ].forEach((l) => {
    if (!evidenceIds.has(l.evidence_id))
      errors.push(`missing evidence ${l.evidence_id}`);
  });
  d.evidence.forEach((e) => {
    if (!sourceIds.has(e.source_id))
      errors.push(`missing source ${e.source_id}`);
  });
  if (!d.question.trim()) errors.push("讨论问题不能为空");
  return errors;
}
export function validateDiscussion(input: unknown): input is DiscussionContext {
  return discussionErrors(input).length === 0;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function assertNoVersionConflict(
  existing: AnalysisBundle,
  incoming: AnalysisBundle,
): void {
  if (
    existing.analysis_id === incoming.analysis_id &&
    existing.analysis_version === incoming.analysis_version &&
    stable(existing) !== stable(incoming)
  )
    throw new AnalysisConflictError(
      "同一分析版本已有不同内容。请在 Codex 中生成新版本后重新导入。",
    );
}
export function checkRevision(
  previous: AnalysisBundle,
  next: AnalysisBundle,
): string[] {
  const errors: string[] = [];
  if (
    previous.analysis_id !== next.analysis_id ||
    next.revision?.previous_version !== previous.analysis_version ||
    next.analysis_version !== previous.analysis_version + 1
  )
    errors.push("分析身份或相邻版本关系不匹配");
  if (
    previous.paper.identifier !== next.paper.identifier ||
    previous.paper.version !== next.paper.version
  )
    errors.push("修订不能静默替换论文身份或论文版本");
  const mappings = next.revision?.node_mappings ?? [];
  const mapped = new Set<string>();
  for (const m of mappings) {
    if (!previous.nodes.some((n) => n.node_id === m.old_node_id))
      errors.push(`修订引用不存在的旧节点 ${m.old_node_id}`);
    if (mapped.has(m.old_node_id))
      errors.push(`重复旧节点映射 ${m.old_node_id}`);
    mapped.add(m.old_node_id);
  }
  for (const n of previous.nodes)
    if (!mapped.has(n.node_id)) errors.push(`缺少节点对应关系 ${n.node_id}`);
  return errors;
}
