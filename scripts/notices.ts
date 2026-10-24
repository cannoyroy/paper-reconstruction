import {
  readFile,
  readdir,
  realpath,
  writeFile,
  mkdir,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export async function writeNotices() {
  const root = resolve("."),
    rootPackage = JSON.parse(await readFile("package.json", "utf8"));
  const seen = new Set<string>(),
    notices: string[] = [];
  async function collect(name: string, from: string) {
    let cursor = from,
      file = "";
    while (true) {
      const candidate = join(cursor, "node_modules", name, "package.json");
      if (existsSync(candidate)) {
        file = candidate;
        break;
      }
      const parent = dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
    if (!file) throw new Error(`Cannot resolve license metadata for ${name}`);
    file = await realpath(file);
    const folder = dirname(file),
      pkg = JSON.parse(await readFile(file, "utf8"));
    const id = `${pkg.name}@${pkg.version}`;
    if (seen.has(id)) return;
    seen.add(id);
    const licenseFiles = (
      await readdir(folder, { withFileTypes: true })
    ).filter((e) => e.isFile() && /^licen[sc]e($|[.-])/i.test(e.name));
    const licenseTexts = await Promise.all(
      licenseFiles.map((e) => readFile(join(folder, e.name), "utf8")),
    );
    notices.push(
      `## ${id}\n\nLicense: ${typeof pkg.license === "string" ? pkg.license : JSON.stringify(pkg.license ?? pkg.licenses ?? "see upstream")}\n\n${licenseTexts.join("\n\n") || `Upstream: ${pkg.homepage ?? pkg.repository?.url ?? "https://www.npmjs.com/package/" + pkg.name}`}\n`,
    );
    for (const dep of Object.keys(pkg.dependencies ?? {}).sort())
      await collect(dep, folder);
  }
  for (const dep of Object.keys(rootPackage.dependencies).sort())
    await collect(dep, root);
  const text =
    `# Third-party notices\n\nProduction dependency licenses. Original papers are not bundled. Generated from installed package metadata; project license does not replace these terms.\n\n${notices.join("\n")}`
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .join("\n")
      .trimEnd() + "\n";
  await writeFile("THIRD_PARTY_NOTICES.md", text);
  await mkdir("viewer/public", { recursive: true });
  await writeFile("viewer/public/THIRD_PARTY_NOTICES.md", text);
  return text;
}
