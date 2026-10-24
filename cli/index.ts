#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseBundle, checkRevision, discussionErrors } from "../core/validate";
import {
  createDiscussion,
  discussionMarkdown,
  exportMarkdown,
} from "../core/export";

export async function main(args: string[]) {
  const [command, file, ...rest] = args;
  if (
    !file ||
    !["validate", "markdown", "discussion", "revision"].includes(command)
  )
    throw new Error(
      "用法：paper-reconstruction validate <analysis.json> | markdown <analysis.json> <report.md> | discussion <analysis.json> <path_id> <node_id> <question> <output-prefix> [participatory] | revision <previous.json> <next.json>",
    );
  const raw = await readFile(resolve(file), "utf8");
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error("文件不是有效的 JSON");
  }
  if (
    command === "validate" &&
    decoded &&
    typeof decoded === "object" &&
    "kind" in decoded &&
    decoded.kind === "discussion_context"
  ) {
    const errors = discussionErrors(decoded);
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      JSON.stringify({ valid: true, kind: "discussion_context" }, null, 2),
    );
    return;
  }
  const result = parseBundle(raw);
  if (!result.ok) throw new Error(result.errors.join("\n"));
  const b = result.value;
  const save = async (path: string, value: string) => {
    await mkdir(dirname(resolve(path)), { recursive: true });
    await writeFile(resolve(path), value, { flag: "wx" });
    console.log(`已导出 ${path}`);
  };
  if (command === "validate")
    console.log(
      JSON.stringify(
        {
          valid: true,
          analysis_id: b.analysis_id,
          analysis_version: b.analysis_version,
          warnings: result.warnings,
        },
        null,
        2,
      ),
    );
  if (command === "markdown") {
    if (!rest[0]) throw new Error("缺少 Markdown 输出路径");
    await save(rest[0], exportMarkdown(b));
  }
  if (command === "discussion") {
    const [pathId, nodeId, question, prefix, mode] = rest;
    if (!prefix || (mode && mode !== "participatory"))
      throw new Error("缺少讨论参数或模式无效");
    const d = createDiscussion(
      b,
      pathId,
      nodeId,
      question,
      mode === "participatory" ? "participatory" : "direct",
    );
    await save(`${prefix}.json`, JSON.stringify(d, null, 2) + "\n");
    await save(`${prefix}.md`, discussionMarkdown(d));
  }
  if (command === "revision") {
    if (!rest[0]) throw new Error("缺少后续版本文件");
    const next = parseBundle(await readFile(resolve(rest[0]), "utf8"));
    if (!next.ok) throw new Error(next.errors.join("\n"));
    const errors = checkRevision(b, next.value);
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      JSON.stringify(
        {
          valid_revision: true,
          from: b.analysis_version,
          to: next.value.analysis_version,
          reason: next.value.revision!.change_reason,
        },
        null,
        2,
      ),
    );
  }
}
main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
