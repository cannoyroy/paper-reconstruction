import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { unzipSync } from "fflate";
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const root = mkdtempSync(join(tmpdir(), "paper-reconstruction-smoke-"));
const archive =
  process.argv[2] ?? `release/paper-reconstruction-${version}.zip`;
for (const [name, data] of Object.entries(unzipSync(readFileSync(archive)))) {
  const target = resolve(root, name);
  if (!target.startsWith(root + sep)) throw Error("Unexpected archive path");
  if (name.endsWith("/")) {
    mkdirSync(target, { recursive: true });
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
}
const cli = join(root, "paper-reconstruction/scripts/paper-reconstruction.mjs");
for (const [src, dst] of [
  ["examples/resnet-2015.json", "single.json"],
  ["examples/residual-programme.json", "collection.json"],
  ["evals/collections/consent/accepted/analysis.json", "before.json"],
  ["evals/collections/consent/accepted/analysis-v2.json", "after.json"],
  ["evals/collections/consent/intake.json", "intake.json"],
])
  copyFileSync(src, join(root, dst));
const run = (...args: string[]) =>
  execFileSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
  });
for (const f of [
  "single.json",
  "collection.json",
  "before.json",
  "after.json",
  "intake.json",
])
  run("validate", f);
run("markdown", "single.json", "single.md");
run("markdown", "collection.json", "collection.md");
run("discussion", "single.json", "P02", "N01", "为什么？", "single-discussion");
run(
  "discussion",
  "collection.json",
  "P2",
  "N1",
  "当时知道什么？",
  "node-discussion",
);
run(
  "relation-discussion",
  "collection.json",
  "R1",
  "这条推断的边界？",
  "relation-discussion",
);
for (const f of [
  "single-discussion.json",
  "node-discussion.json",
  "relation-discussion.json",
])
  run("validate", f);
run("revision", "before.json", "after.json");
const d = JSON.parse(readFileSync(join(root, "node-discussion.json"), "utf8"));
if (
  d.node.path_contexts.length !== 1 ||
  d.node.path_contexts[0].path_id !== "P2"
)
  throw Error("Path isolation failed");
const md = readFileSync(join(root, "collection.md"), "utf8");
if (!md.includes("判别与后续行动") || !md.includes("决策节点与条件行动"))
  throw Error("Decision detail missing from Markdown");
let refused = false;
try {
  run("markdown", "collection.json", "collection.md");
} catch {
  refused = true;
}
if (!refused) throw Error("CLI overwrote an existing export");
console.log(
  "Standalone ZIP smoke passed: old/new schemas, intake, Markdown, node/relation contexts, revision, path isolation and overwrite refusal. No repository dependencies used by extracted CLI.",
);
