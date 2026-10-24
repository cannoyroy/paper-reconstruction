import { Type, type Static, type TProperties } from "@sinclair/typebox";

const obj = <T extends TProperties>(p: T) =>
  Type.Object(p, { additionalProperties: false });
const choice = <const T extends string[]>(...values: T) =>
  Type.Union(values.map((v) => Type.Literal(v as T[number])));
const text = Type.String({ minLength: 1 });
const refs = Type.Array(text, { uniqueItems: true });
const nullableText = Type.Union([text, Type.Null()]);
const epistemic = Type.Union([
  Type.Literal("explicit"),
  Type.Literal("inferred"),
  Type.Literal("hypothetical"),
]);
const evidenceLink = obj({
  evidence_id: text,
  relation: choice(
    "supports",
    "conditional_support",
    "compatible",
    "contradicts",
    "unclear",
  ),
  scope_note: text,
});
export const sourceSchema = obj({
  source_id: text,
  title: text,
  kind: choice("paper", "supplement", "code", "author_account", "related_work"),
  url: nullableText,
  version: text,
  published_at: nullableText,
  read_status: choice("read", "partial", "unavailable"),
  fingerprint: nullableText,
  availability_note: text,
});
export const evidenceSchema = obj({
  evidence_id: text,
  source_id: text,
  locator: obj({
    section: nullableText,
    figure_or_table: nullableText,
    pdf_page_index: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    printed_page: nullableText,
    text_anchor: nullableText,
  }),
  paraphrase: text,
  quote: nullableText,
  scope: text,
  evidence_type: choice(
    "reported_result",
    "author_interpretation",
    "historical_account",
    "independent_check",
    "theoretical_argument",
  ),
  verification_status: choice(
    "source_checked",
    "locator_unverified",
    "not_checked",
  ),
});
export const claimSchema = obj({
  claim_id: text,
  text,
  epistemic_status: epistemic,
  evidence_links: Type.Array(evidenceLink),
  assumptions: Type.Array(text),
  alternatives: Type.Array(text),
});
const option = obj({
  option_id: text,
  label: text,
  description: text,
  claim_refs: refs,
});
const test = obj({
  test_id: text,
  question: text,
  method: text,
  claim_refs: refs,
  outcomes: Type.Array(
    obj({ observation: text, next_action: text, claim_refs: refs }),
    { minItems: 2 },
  ),
});
const lesson = obj({
  lesson_id: text,
  context: text,
  distinguish: text,
  action: text,
  boundary: text,
  claim_refs: refs,
});
export const nodeSchema = obj({
  node_id: text,
  title: text,
  question: text,
  path_contexts: Type.Array(
    obj({
      path_id: text,
      known_information: Type.Array(obj({ text, claim_refs: refs })),
      assumptions: Type.Array(text),
    }),
    { minItems: 1 },
  ),
  uncertainties: Type.Array(text),
  options: Type.Array(option, { minItems: 2 }),
  discriminating_tests: Type.Array(test, { minItems: 1 }),
  claim_refs: refs,
  paper_connection: text,
  transfer_lessons: Type.Array(lesson, { minItems: 1 }),
});
const edge = obj({
  edge_id: text,
  source_node_id: text,
  target_node_id: text,
  path_ids: refs,
  relation_type: choice(
    "logical_dependency",
    "candidate_transition",
    "alternative",
    "return",
    "explicit_chronology",
  ),
  label: text,
  epistemic_status: epistemic,
  evidence_refs: refs,
});
const path = obj({
  path_id: text,
  title: text,
  premise: text,
  assumptions: Type.Array(text),
  node_refs: refs,
  edge_refs: refs,
  evidence_links: Type.Array(evidenceLink),
});
const block = obj({
  block_id: text,
  markdown: text,
  node_refs: refs,
  claim_refs: refs,
  evidence_refs: refs,
});
const section = obj({
  section_id: text,
  title: text,
  blocks: Type.Array(block, { minItems: 1 }),
});
const paper = obj({
  title: text,
  authors: Type.Array(text, { minItems: 1 }),
  identifier: text,
  version: text,
  domain: text,
  research_type: choice(
    "computational",
    "experimental",
    "observational",
    "theoretical",
    "mixed",
  ),
  url: nullableText,
});

export const analysisSchema = obj({
  schema_version: Type.Literal("0.1.0"),
  workflow_version: text,
  analysis_id: Type.String({ pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]*$" }),
  analysis_version: Type.Integer({ minimum: 1 }),
  example_kind: choice("real_paper", "fictional", "user_analysis"),
  status: choice("complete", "partial"),
  paper,
  provenance: obj({
    model: nullableText,
    generated_at: nullableText,
    host: nullableText,
    material_policy: Type.Union([
      Type.Literal("provided_only"),
      Type.Literal("targeted_public"),
    ]),
    tools: Type.Array(text),
    usage: obj({
      elapsed_seconds: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
      model_calls: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
      tokens: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
      note: text,
    }),
  }),
  sources: Type.Array(sourceSchema, { minItems: 1 }),
  evidence: Type.Array(evidenceSchema),
  claims: Type.Array(claimSchema),
  paths: Type.Array(path, { minItems: 1 }),
  nodes: Type.Array(nodeSchema),
  edges: Type.Array(edge),
  sections: Type.Array(section, { minItems: 1 }),
  limitations: Type.Array(text),
  validation: obj({
    semantic_review: choice(
      "pending",
      "self_reviewed",
      "independently_reviewed",
    ),
    notes: Type.Array(text),
  }),
  revision: Type.Union([
    Type.Null(),
    obj({
      previous_version: Type.Integer({ minimum: 1 }),
      change_reason: text,
      node_mappings: Type.Array(
        obj({
          old_node_id: text,
          new_node_ids: refs,
          change: choice("retained", "split", "merged", "replaced", "removed"),
        }),
      ),
    }),
  ]),
  manifest: obj({ included: Type.Array(text), external: Type.Array(text) }),
});

export type AnalysisBundle = Static<typeof analysisSchema>;
export type Claim = AnalysisBundle["claims"][number];
export type Evidence = AnalysisBundle["evidence"][number];
export type ResearchNode = AnalysisBundle["nodes"][number];
export type ResearchPath = AnalysisBundle["paths"][number];

export const discussionSchema = obj({
  schema_version: Type.Literal("0.1.0"),
  kind: Type.Literal("discussion_context"),
  analysis_id: text,
  analysis_version: Type.Integer({ minimum: 1 }),
  workflow_version: text,
  paper,
  material_policy: Type.Union([
    Type.Literal("provided_only"),
    Type.Literal("targeted_public"),
  ]),
  path,
  node: nodeSchema,
  claims: Type.Array(claimSchema),
  evidence: Type.Array(evidenceSchema),
  sources: Type.Array(sourceSchema),
  question: text,
  mode: Type.Union([Type.Literal("direct"), Type.Literal("participatory")]),
  materials: obj({
    included: Type.Array(text),
    referenced_only: Type.Array(text),
    note: text,
  }),
});
export type DiscussionContext = Static<typeof discussionSchema>;
