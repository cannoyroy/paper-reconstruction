import { build } from "esbuild";
import { mkdir, cp, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { zipSync } from "fflate";
import "./export-schemas";
import { writeNotices } from "./notices";
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const root = "release/paper-reconstruction";
await mkdir(root, { recursive: true });
await cp("skills/paper-reconstruction", root, { recursive: true });
await cp("schemas", `${root}/references/schemas`, { recursive: true });
await cp("LICENSE", `${root}/LICENSE`);
await writeFile(`${root}/THIRD_PARTY_NOTICES.md`, await writeNotices());
await build({
  entryPoints: ["cli/index.ts"],
  outfile: `${root}/scripts/paper-reconstruction.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  legalComments: "eof",
});
const files: Record<string, Uint8Array> = {};
async function collect(dir: string, prefix: string) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name),
      key = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) await collect(p, key);
    else files[key] = new Uint8Array(await readFile(p));
  }
}
await collect(root, "paper-reconstruction");
await writeFile(`release/paper-reconstruction-${version}.zip`, zipSync(files));
console.log(
  `Packaged self-contained Node.js CLI + skill: release/paper-reconstruction-${version}.zip`,
);
