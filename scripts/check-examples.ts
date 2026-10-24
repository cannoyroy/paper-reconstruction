import { readFile, readdir } from "node:fs/promises";
import { parseBundle } from "../core/validate";
for (const file of (await readdir("examples")).filter((f) =>
  f.endsWith(".json"),
)) {
  const result = parseBundle(await readFile(`examples/${file}`, "utf8"));
  if (!result.ok) throw new Error(`${file}: ${result.errors.join("\n")}`);
  console.log(
    `${file}: valid${result.warnings.length ? `; ${result.warnings.join("; ")}` : ""}`,
  );
}
