import { mkdir, writeFile } from "node:fs/promises";
import { analysisSchema, discussionSchema } from "../core/schema";
await mkdir("schemas", { recursive: true });
for (const [name, schema] of [
  ["analysis", analysisSchema],
  ["discussion", discussionSchema],
] as const) {
  await writeFile(
    `schemas/${name}.schema.json`,
    JSON.stringify(
      { $schema: "http://json-schema.org/draft-07/schema#", ...schema },
      null,
      2,
    ) + "\n",
  );
}
console.log("Exported analysis and discussion JSON Schemas.");
