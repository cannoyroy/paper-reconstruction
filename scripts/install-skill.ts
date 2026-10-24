import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const source = resolve("release/paper-reconstruction"),
  target = resolve(".agents/skills/paper-reconstruction");
if (!existsSync(`${source}/scripts/paper-reconstruction.mjs`))
  throw new Error("请先运行 pnpm package:skill");
if (existsSync(target))
  throw new Error("项目 Skill 已存在，未覆盖。保留旧目录后再安装新版。");
await mkdir(resolve(".agents/skills"), { recursive: true });
await cp(source, target, { recursive: true, force: false, errorOnExist: true });
console.log(`Skill installed in this project: ${target}`);
