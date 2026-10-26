import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  parseAnyBundle,
  anyDiscussionErrors,
  checkAnyRevision,
} from "../core/workbench";
async function walk(dir: string): Promise<string[]> {
  const items = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      items.map((x) =>
        x.isDirectory()
          ? walk(join(dir, x.name))
          : Promise.resolve([join(dir, x.name)]),
      ),
    )
  ).flat();
}
let checked = 0;
for (const path of await walk("evals/collections")) {
  if (
    !/(?:^|[\\/])(analysis(?:-v2)?|intake|browser-discussion)\.json$/.test(path)
  )
    continue;
  const text = await readFile(path, "utf8"),
    input = JSON.parse(text);
  const result =
    input.kind === "collection_analysis" ? parseAnyBundle(text) : null;
  const errors = result
    ? result.ok
      ? []
      : result.errors
    : anyDiscussionErrors(input);
  if (errors.length) throw Error(`${path}: ${errors.join("; ")}`);
  if (path.endsWith("analysis-v2.json")) {
    const before = parseAnyBundle(
      await readFile(path.replace("analysis-v2.json", "analysis.json"), "utf8"),
    );
    if (before.ok && result?.ok) {
      const errors = checkAnyRevision(before.value, result.value);
      if (errors.length) throw Error(errors.join("; "));
    }
  }
  checked++;
}
console.log(
  `Validated ${checked} collection evaluation artifacts and adjacent revisions.`,
);
