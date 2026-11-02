import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
test("defaults to English and persists a user-selected locale", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "How to use" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Read the full README and instructions" }),
  ).toHaveAttribute("href", /README\.en\.md/);
  mkdirSync("test-results/screenshots", { recursive: true });
  await page.screenshot({ path: "test-results/screenshots/bilingual-home-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.screenshot({ path: "test-results/screenshots/bilingual-home-mobile.png", fullPage: true });
  expect(await page.evaluate(() => Array.from(document.querySelectorAll('*')).filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => `${e.tagName}.${e.className}: ${e.getBoundingClientRect().right}`))).toEqual([]);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page
    .getByRole("button", { name: "Switch language to Chinese" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("heading", { name: "如何使用" })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.getByRole("button", { name: "切换语言为英文" }).click();
  await expect(page.getByRole("heading", { name: "How to use" })).toBeVisible();
});
test("switching remains usable when local storage is blocked", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("blocked");
      },
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page
    .getByRole("button", { name: "Switch language to Chinese" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page
    .getByRole("button", { name: "Switch language to Chinese" })
    .click();
  await page.getByRole("button", { name: "切换语言为英文" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("English example is display-only, preserves context on switching, and imported JSON stays original", async ({
  page,
}) => {
  const original = JSON.parse(
    readFileSync("examples/resnet-2015.json", "utf8"),
  );
  await page.goto("./");
  await page.getByRole("button", { name: /Computer vision.*ResNet/ }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "English display translation" }),
  ).toBeVisible();
  await expect(page.locator(".report-block").first()).toContainText(
    "deep model",
  );
  await page.getByLabel("Candidate path").selectOption("P02");
  await page
    .getByRole("complementary", { name: "Report contents" })
    .getByRole("button", { name: /N01/ })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Node details" }),
  ).toBeVisible();
  expect(
    await page.getByRole("complementary", { name: "Node details" }).innerText(),
  ).not.toMatch(/[\u3400-\u9fff]/);
  await page
    .getByLabel("Question for Codex")
    .fill("How robust is this inference?");
  await page.getByRole("button", { name: "Prepare node context" }).click();
  await expect(page.locator("#discussion-context")).toHaveValue(
    /先分清训练失败与泛化失败/,
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Switch language to Chinese" })
    .click();
  await expect(page.getByLabel("候选路径")).toHaveValue("P02");
  await expect(
    page.getByRole("complementary", { name: "节点详情" }),
  ).toBeVisible();
  await expect(page.getByLabel("带回 Codex 的问题")).toHaveValue(
    "How robust is this inference?",
  );
  await page.getByRole("button", { name: "切换语言为英文" }).click();
  await expect(page.getByLabel("Question for Codex")).toHaveValue(
    "How robust is this inference?",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "English display translation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close details panel" }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Analysis JSON", exact: true })
    .click();
  const download = await pending;
  const exported = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(exported).toEqual(original);
  await page.getByLabel("Import analysis JSON").setInputFiles({
    name: "analysis.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(original)),
  });
  await expect(page.locator(".report-block").first()).toContainText("深层模型");
  await expect(
    page.getByRole("status").filter({ hasText: "English display translation" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".report-block").first()).toContainText("深层模型");
});

test("a collection example keeps its view, filters and expanded cards across language changes", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: /Multi-paper analysis.*ResNet/ })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "English display translation" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Paper evidence cards", exact: true })
    .click();
  await page.getByLabel("Filter papers").selectOption("R");
  await page.locator(".paper-card summary").first().click();
  await expect(page.locator(".paper-card").first()).toHaveAttribute("open", "");
  await page.getByRole("button", { name: /Inspect R.*evidence/ }).click();
  await expect(
    page.getByRole("complementary", { name: "Collection details" }),
  ).toBeVisible();
  expect(
    await page
      .getByRole("complementary", { name: "Collection details" })
      .innerText(),
  ).not.toMatch(/[\u3400-\u9fff]/);
  mkdirSync("test-results/screenshots", { recursive: true });
  await page.screenshot({
    path: "test-results/screenshots/bilingual-collection-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/screenshots/bilingual-collection-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Switch language to Chinese" })
    .click();
  await expect(page.getByLabel("筛选论文")).toHaveValue("R");
  await expect(page.locator(".paper-card").first()).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "切换语言为英文" }).click();
  await expect(page.getByLabel("Filter papers")).toHaveValue("R");
  await expect(page.locator(".paper-card").first()).toHaveAttribute("open", "");
  await expect(
    page.getByRole("complementary", { name: "Collection details" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close collection details panel" })
    .click();
  await page
    .getByRole("button", { name: "Paper relationship graph", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Zoom In", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Switch language to Chinese" })
    .click();
  await expect(
    page.getByRole("button", { name: "放大", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "切换语言为英文" }).click();
  await expect(page.getByRole("button", { name: "Zoom In", exact: true })).toBeVisible();
  await page.locator(".collection-relation-list button").first().click();
  await page
    .getByRole("button", { name: "Prepare discussion context" })
    .click();
  await expect(page.getByLabel("Collection discussion context")).toHaveValue(
    /逻辑联系/,
  );
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download discussion package" })
    .click();
  const discussion = JSON.parse(
    readFileSync((await (await downloadPromise).path())!, "utf8"),
  );
  const original = JSON.parse(
    readFileSync("examples/residual-programme.json", "utf8"),
  );
  expect(discussion.relation).toEqual(
    original.relations.find(
      (r: any) => r.relation_id === discussion.target.relation_id,
    ),
  );
  await page
    .getByRole("button", { name: "Close collection details panel" })
    .click();
  const exportPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export collection JSON" }).click();
  expect(
    JSON.parse(readFileSync((await (await exportPromise).path())!, "utf8")),
  ).toEqual(original);
});

test("user-supplied English and Chinese content stays in its original language", async ({
  page,
}) => {
  const original = JSON.parse(
    readFileSync("examples/resnet-2015.json", "utf8"),
  );
  await page.goto("./");
  original.analysis_id = "user-language-test";
  original.sections[0].blocks[0].markdown =
    "A user's English report is kept as written.";
  await page.getByLabel("Import analysis JSON").setInputFiles({
    name: "english.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(original)),
  });
  await expect(page.locator(".report-block").first()).toContainText(
    "A user's English report is kept as written.",
  );
  await page
    .getByRole("button", { name: "Switch language to Chinese" })
    .click();
  await expect(page.locator(".report-block").first()).toContainText(
    "A user's English report is kept as written.",
  );
  original.analysis_id = "user-chinese-test";
  original.sections[0].blocks[0].markdown = "论文";
  await page.getByLabel("导入分析 JSON").setInputFiles({
    name: "chinese.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(original)),
  });
  await page.getByRole("button", { name: "切换语言为英文" }).click();
  await expect(page.locator(".report-block").first()).toHaveText(/论文/);
});

test("all four built-in examples have English display translations", async ({
  page,
}) => {
  await page.goto("./");
  for (const label of [
    /Multi-paper analysis.*ResNet/,
    /Computer vision.*ResNet/,
    /Molecular biology.*CRISPR/,
    /Gravitational-wave astronomy.*LIGO/,
  ]) {
    await page.getByRole("button", { name: label }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "English display translation" }),
    ).toBeVisible();
    const body = await page.locator("main, .reader-heading").allInnerTexts();
    expect(body.join(" ").replaceAll("中文", "")).not.toMatch(
      /[\u3400-\u9fff]/,
    );
    await page
      .getByRole("button", { name: "Return to workbench home" })
      .click();
  }
});

test("invalid JSON errors follow the selected interface language", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByLabel("Import analysis JSON").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(page.getByRole("alert")).toContainText("not valid JSON");
  await page
    .getByRole("button", { name: "Switch language to Chinese" })
    .click();
  await expect(page.getByRole("alert")).toContainText("有效的 JSON");
});
