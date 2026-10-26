import type { AnalysisBundle } from "./schema";
import type {
  CollectionAnalysisBundle,
  CollectionDiscussionContext,
} from "./collection-schema";
import {
  parseBundle,
  checkRevision,
  discussionErrors,
  AnalysisConflictError,
} from "./validate";
import { exportMarkdown, createDiscussion, discussionMarkdown } from "./export";
import {
  validateCollection,
  checkCollectionRevision,
  collectionDiscussionErrors,
  exportCollectionMarkdown,
  createCollectionDiscussion,
  collectionDiscussionMarkdown,
  validateIntake,
} from "./collection";
export type AnyAnalysis = AnalysisBundle | CollectionAnalysisBundle;
export const isCollection = (b: AnyAnalysis): b is CollectionAnalysisBundle =>
  b.schema_version === "0.2.0";
export const analysisTitle = (b: AnyAnalysis) =>
  isCollection(b) ? b.collection.title : b.paper.title;
export function parseAnyBundle(
  text: string,
):
  | { ok: true; value: AnyAnalysis; warnings: string[] }
  | { ok: false; errors: string[] } {
  try {
    const input = JSON.parse(text);
    return input?.schema_version === "0.2.0"
      ? validateCollection(input)
      : parseBundle(text);
  } catch {
    return { ok: false, errors: ["文件不是有效的 JSON"] };
  }
}
export const exportAnyMarkdown = (b: AnyAnalysis) =>
  isCollection(b) ? exportCollectionMarkdown(b) : exportMarkdown(b);
export const createAnyDiscussion = (
  b: AnyAnalysis,
  path: string,
  node: string,
  question: string,
  mode: "direct" | "participatory" = "direct",
) =>
  isCollection(b)
    ? createCollectionDiscussion(
        b,
        { kind: "node", path_id: path, node_id: node },
        question,
        mode,
      )
    : createDiscussion(b, path, node, question, mode);
export const anyDiscussionMarkdown = (
  d: ReturnType<typeof createAnyDiscussion>,
) =>
  d.kind === "collection_discussion_context"
    ? collectionDiscussionMarkdown(d)
    : discussionMarkdown(d);
export const anyDiscussionErrors = (d: any) =>
  d?.kind === "collection_intake"
    ? validateIntake(d)
    : d?.kind === "collection_discussion_context"
      ? collectionDiscussionErrors(d)
      : discussionErrors(d);
export function checkAnyRevision(a: AnyAnalysis, b: AnyAnalysis) {
  if (isCollection(a) && isCollection(b)) return checkCollectionRevision(a, b);
  if (!isCollection(a) && !isCollection(b)) return checkRevision(a, b);
  return ["单篇与多篇结果不能共用同一修订链"];
}
const stable = (v: any): string =>
  Array.isArray(v)
    ? `[${v.map(stable).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
          .join(",")}}`
      : JSON.stringify(v);
export function assertAnyConflict(a: AnyAnalysis, b: AnyAnalysis) {
  if (
    a.analysis_id === b.analysis_id &&
    a.analysis_version === b.analysis_version &&
    stable(a) !== stable(b)
  )
    throw new AnalysisConflictError("同一分析版本已有不同内容，请生成新版本。");
}
