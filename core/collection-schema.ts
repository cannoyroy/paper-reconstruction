import { Type, type Static } from "@sinclair/typebox";
import {
  analysisSchema,
  sourceSchema,
  claimSchema,
  nodeSchema,
  evidenceSchema,
} from "./schema";
const object = <T extends Record<string, any>>(properties: T) =>
  Type.Object(properties, { additionalProperties: false });
const text = Type.String({ minLength: 1 });
const refs = Type.Array(text, { uniqueItems: true });
const someRefs = Type.Array(text, { uniqueItems: true, minItems: 1 });
const nullable = Type.Union([text, Type.Null()]);
const pick = <const T extends string[]>(...values: T) =>
  Type.Union(values.map((v) => Type.Literal(v as T[number])));
const base = analysisSchema.properties;
const { paper: _paper, ...common } = base;
export const collectionPaperSchema = object({
  ...base.paper.properties,
  paper_id: text,
  work_id: text,
  aliases: refs,
  origin: pick("provided", "accepted_recommendation"),
  candidate_id: nullable,
  read_status: pick("read", "partial", "unavailable"),
  material_note: text,
});
const candidateSchema = object({
  candidate_id: text,
  work_id: text,
  title: text,
  authors: someRefs,
  year: Type.Union([
    Type.Integer({ minimum: 1500, maximum: 3000 }),
    Type.Null(),
  ]),
  version: text,
  url: text,
  related_paper_refs: someRefs,
  gap: text,
  expected_change: text,
  inspected_material: text,
  full_text_status: pick("available", "unknown", "unavailable"),
  decision: pick("pending", "accepted", "rejected"),
  decision_record: nullable,
  decision_source: Type.Union([pick("user", "simulated_test"), Type.Null()]),
});
export const searchSchema = object({
  status: pick("not_started", "provided_only", "completed", "unavailable"),
  queries: Type.Array(text),
  note: text,
  candidates: Type.Array(candidateSchema, { maxItems: 3 }),
});
export const intakeSchema = object({
  kind: Type.Literal("collection_intake"),
  schema_version: Type.Literal("0.2.0"),
  stage: pick("registered", "awaiting_selection", "frozen"),
  goal: text,
  user_clue: text,
  provided_papers: Type.Array(collectionPaperSchema, { minItems: 2 }),
  search: searchSchema,
});
const statement = object({ text, claim_refs: refs });
export const cardSchema = object({
  paper_id: text,
  question: statement,
  conditions: Type.Array(statement),
  assumptions: Type.Array(statement),
  choices: Type.Array(statement),
  discriminating_evidence: Type.Array(statement),
  findings: Type.Array(statement),
  limitations: Type.Array(text),
  open_questions: Type.Array(text),
  evidence_refs: refs,
});
const relationSchema = object({
  relation_id: text,
  from_paper_id: text,
  to_paper_id: text,
  kind: pick(
    "problem_continuation",
    "method_inheritance",
    "method_transfer",
    "complementary",
    "competing",
    "boundary_revision",
    "surface_similarity",
    "uncertain",
  ),
  directed: Type.Boolean(),
  label: text,
  explanation: text,
  epistemic_status: claimSchema.properties.epistemic_status,
  claim_refs: someRefs,
  evidence_refs: refs,
});
const collectionNode = object({
  ...nodeSchema.properties,
  paper_refs: someRefs,
});
const collectionPath = object({
  ...base.paths.items.properties,
  perspective: pick("retrospective", "candidate_formation"),
  available_source_refs: refs,
});
const collectionSource = object({
  ...sourceSchema.properties,
  paper_refs: someRefs,
});
const collectionClaim = object({
  ...claimSchema.properties,
  paper_refs: someRefs,
});
const collectionBlock = object({
  ...base.sections.items.properties.blocks.items.properties,
  paper_refs: refs,
  relation_refs: refs,
});
export const collectionSchema = object({
  ...common,
  schema_version: Type.Literal("0.2.0"),
  kind: Type.Literal("collection_analysis"),
  collection: object({
    title: text,
    goal: text,
    user_clue: text,
    derived_from: Type.Union([
      object({
        analysis_id: text,
        analysis_version: Type.Integer({ minimum: 1 }),
      }),
      Type.Null(),
    ]),
  }),
  papers: Type.Array(collectionPaperSchema, { minItems: 2 }),
  paper_cards: Type.Array(cardSchema, { minItems: 2 }),
  search: searchSchema,
  comparisons: Type.Array(
    object({
      axis_id: text,
      title: text,
      comparability: text,
      cells: Type.Array(
        object({ paper_id: text, summary: text, claim_refs: refs }),
        { minItems: 2 },
      ),
    }),
  ),
  clusters: Type.Array(
    object({
      cluster_id: text,
      title: text,
      rationale: text,
      paper_refs: someRefs,
      claim_refs: refs,
    }),
  ),
  relations: Type.Array(relationSchema),
  sources: Type.Array(collectionSource, { minItems: 1 }),
  claims: Type.Array(collectionClaim),
  nodes: Type.Array(collectionNode),
  paths: Type.Array(collectionPath, { minItems: 1 }),
  sections: Type.Array(
    object({
      section_id: text,
      title: text,
      blocks: Type.Array(collectionBlock, { minItems: 1 }),
    }),
    { minItems: 1 },
  ),
  revision: Type.Union([
    Type.Null(),
    object({
      previous_version: Type.Integer({ minimum: 1 }),
      change_reason: text,
      node_mappings: base.revision.anyOf[1].properties.node_mappings,
      relation_mappings: Type.Array(
        object({
          old_relation_id: text,
          new_relation_ids: refs,
          change: pick("retained", "split", "merged", "replaced", "removed"),
        }),
      ),
    }),
  ]),
});
export type CollectionAnalysisBundle = Static<typeof collectionSchema>;
export type CollectionIntake = Static<typeof intakeSchema>;
export const collectionDiscussionSchema = object({
  schema_version: Type.Literal("0.2.0"),
  kind: Type.Literal("collection_discussion_context"),
  analysis_id: text,
  analysis_version: Type.Integer({ minimum: 1 }),
  workflow_version: text,
  collection: collectionSchema.properties.collection,
  target: Type.Union([
    object({ kind: Type.Literal("node"), path_id: text, node_id: text }),
    object({ kind: Type.Literal("relation"), relation_id: text }),
  ]),
  papers: Type.Array(collectionPaperSchema, { minItems: 1 }),
  path: Type.Union([collectionPath, Type.Null()]),
  node: Type.Union([collectionNode, Type.Null()]),
  relation: Type.Union([relationSchema, Type.Null()]),
  claims: Type.Array(collectionClaim),
  evidence: Type.Array(evidenceSchema),
  sources: Type.Array(collectionSource),
  material_policy: base.provenance.properties.material_policy,
  question: text,
  mode: pick("direct", "participatory"),
  materials: object({
    included: Type.Array(text),
    referenced_only: Type.Array(text),
    note: text,
  }),
});
export type CollectionDiscussionContext = Static<
  typeof collectionDiscussionSchema
>;
export const relationshipLabels: Record<string, string> = {
  problem_continuation: "问题延续",
  method_inheritance: "方法继承",
  method_transfer: "方法迁移",
  complementary: "互补",
  competing: "竞争或替代",
  boundary_revision: "边界修正",
  surface_similarity: "表面相似",
  uncertain: "关系未定",
};
