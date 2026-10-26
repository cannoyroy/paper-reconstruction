import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import type { CollectionAnalysisBundle } from "../../core/collection-schema";
const original: CollectionAnalysisBundle = JSON.parse(
  readFileSync("examples/residual-programme.json", "utf8"),
);
async function upload(page: Page, value: unknown) {
  await page.getByLabel("导入分析 JSON").setInputFiles({
    name: "collection.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(value)),
  });
}
async function open(page: Page) {
  await page.goto("./");
  await upload(page, original);
  await expect(page.locator(".collection-heading")).toContainText(
    original.collection.title,
  );
}
async function relation(page: Page) {
  await page.getByRole("button", { name: "论文关系图", exact: true }).click();
  await page.locator(".collection-relation-list button").first().click();
  await expect(
    page.getByRole("complementary", { name: "联合分析详情" }),
  ).toContainText("有依据推断");
}
test("imports a collection, follows cards and evidence, preserves the complete report when filtered", async ({
  page,
}) => {
  await open(page);
  const blocks = await page.locator(".collection-block").count();
  await page.getByLabel("筛选论文", { exact: true }).selectOption("R");
  await expect(page.locator(".collection-block")).toHaveCount(blocks);
  await expect(
    page.locator(".collection-block.filter-match").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "单篇证据卡", exact: true }).click();
  await page.locator(".paper-card summary").first().click();
  await page.getByRole("button", { name: "核查 R 的证据" }).click();
  await expect(
    page.getByRole("complementary", { name: "联合分析详情" }),
  ).toContainText("PDF 第");
  await page.getByRole("button", { name: "关闭联合详情面板" }).click();
  await page.getByRole("button", { name: "比较表", exact: true }).click();
  await expect(page.locator(".comparison-scroll table")).toHaveCount(
    original.comparisons.length,
  );
  await page.getByRole("button", { name: "论文关系图", exact: true }).click();
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await page.getByLabel("筛选关系类型").selectOption("competing");
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  await expect(page.locator(".collection-relation-list")).toContainText(
    "没有可支持",
  );
});
test("copies a bounded relation discussion and downloads JSON with manual fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw Error("denied");
        },
      },
    });
  });
  await open(page);
  await relation(page);
  await page
    .getByLabel("联合分析讨论问题")
    .fill("这个跨论文推断能否推广到更浅网络？");
  await page.getByRole("button", { name: "准备联合讨论上下文" }).click();
  await expect(page.getByLabel("联合讨论上下文", { exact: true })).toHaveValue(
    /collection_discussion_context/,
  );
  await page.getByRole("button", { name: "复制联合上下文" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "无法自动复制" }),
  ).toBeVisible();
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载联合讨论包" }).click();
  expect((await d).suggestedFilename()).toContain("R1-discussion.json");
});
test("switches decision paths, persists filters and returns to related prose", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("联合分析路径").selectOption("P2");
  await page.getByRole("button", { name: "决策地图", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.locator(".collection-relation-list button").first().click();
  await expect(
    page.getByRole("complementary", { name: "联合分析详情" }),
  ).toContainText(original.nodes[0].path_contexts[1].known_information[0].text);
  await page.getByRole("button", { name: "准备联合讨论上下文" }).click();
  const context = await page
    .getByLabel("联合讨论上下文", { exact: true })
    .inputValue();
  const json = JSON.parse(context.split("```json\n")[1].split("\n```")[0]);
  expect(
    json.node.path_contexts.map((c: { path_id: string }) => c.path_id),
  ).toEqual(["P2"]);
  await page.getByRole("button", { name: "定位相关正文" }).click();
  await expect(page.locator(".collection-block").first()).toBeVisible();
  await page.getByRole("button", { name: "关闭联合详情面板" }).click();
  await page.getByLabel("筛选研究簇").selectOption("K1");
  await page.waitForTimeout(350);
  await page.reload();
  await expect(page.getByLabel("联合分析路径")).toHaveValue("P2");
  await expect(page.getByLabel("筛选研究簇")).toHaveValue("K1");
});
test("retains collection revisions alongside old single-paper records and blocks changed corpus", async ({
  page,
}) => {
  await page.goto("./");
  await upload(
    page,
    JSON.parse(readFileSync("examples/resnet-2015.json", "utf8")),
  );
  await upload(page, original);
  const next = structuredClone(original);
  next.analysis_version = 2;
  next.revision = {
    previous_version: 1,
    change_reason: "限定跨论文结论的深度与预算条件",
    node_mappings: original.nodes.map((n) => ({
      old_node_id: n.node_id,
      new_node_ids: [n.node_id],
      change: "retained",
    })),
    relation_mappings: original.relations.map((r) => ({
      old_relation_id: r.relation_id,
      new_relation_ids: [r.relation_id],
      change: "retained",
    })),
  };
  await upload(page, next);
  await expect(page.locator(".revision-note")).toContainText("限定跨论文");
  await page.getByRole("button", { name: /本地记录/ }).click();
  await expect(page.locator(".saved-row")).toHaveCount(3);
  await page.getByRole("button", { name: "关闭对话框" }).click();
  const conflict = structuredClone(next);
  conflict.collection.title = "changed";
  await upload(page, conflict);
  await expect(page.getByRole("alert")).toContainText("新版本");
  const corpus = structuredClone(next);
  corpus.analysis_version = 3;
  corpus.revision!.previous_version = 2;
  corpus.papers[0].version = "another";
  await upload(page, corpus);
  await expect(page.getByRole("alert")).toContainText("新的分析 ID");
});
test("mobile cards, comparison scroll, research maps and discussion drawer fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  mkdirSync("test-results/screenshots", { recursive: true });
  await page.screenshot({
    path: "test-results/screenshots/collection-mobile.png",
    fullPage: true,
  });
  for (const view of ["比较表", "单篇证据卡", "论文关系图"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.locator(".collection-relation-list button").first().click();
  await expect(
    page.getByRole("complementary", { name: "联合分析详情" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/screenshots/collection-drawer-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "关闭联合详情面板" }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/screenshots/collection-map-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /本地记录/ }).click();
  await page
    .getByRole("button", { name: `删除 ${original.analysis_id}@1` })
    .click();
  await expect(page.getByRole("dialog")).toContainText("还没有保存的复盘");
  await page.getByRole("button", { name: "关闭对话框" }).click();
  await expect(page.locator(".collection-shell")).toHaveCount(0);
});
test("collection reading survives storage failure and ignores malicious Markdown", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw Error("disabled");
      },
    }),
  );
  await page.goto("./");
  const b = structuredClone(original);
  b.sections[0].blocks[0].markdown =
    "<script>window.pwned=true</script>\n![track](https://example.invalid/track)\n[bad](javascript:alert(1))";
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await upload(page, b);
  await expect(page.locator(".collection-heading")).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "浏览器存储不可用" }),
  ).toBeVisible();
  expect(requests.some((u) => u.includes("example.invalid"))).toBe(false);
  expect(await page.evaluate(() => (window as any).pwned)).toBeUndefined();
  await expect(page.locator(".collection-block img")).toHaveCount(0);
});

test("replays actual search consent, browser discussion, accepted revision and rejected corpus", async ({
  page,
}) => {
  const before = JSON.parse(
    readFileSync("evals/collections/consent/accepted/analysis.json", "utf8"),
  );
  const after = JSON.parse(
    readFileSync("evals/collections/consent/accepted/analysis-v2.json", "utf8"),
  );
  const rejected = JSON.parse(
    readFileSync("evals/collections/consent/rejected/analysis.json", "utf8"),
  );
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          (window as any).copiedContext = text;
        },
      },
    }),
  );
  await page.goto("./");
  await upload(page, before);
  await page.getByRole("button", { name: "论文关系图", exact: true }).click();
  await page
    .locator(".collection-relation-list button")
    .filter({
      hasText: before.relations.find((r: any) => r.relation_id === "REL_HI")
        .label,
    })
    .click();
  await page.getByRole("button", { name: "准备联合讨论上下文" }).click();
  await page.getByRole("button", { name: "复制联合上下文" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "已复制联合" }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).copiedContext)).toContain(
    '"relation_id": "REL_HI"',
  );
  await page.getByRole("button", { name: "关闭联合详情面板" }).click();
  await upload(page, after);
  await expect(page.locator(".revision-note")).toContainText("v1");
  await page.getByRole("button", { name: "论文关系图", exact: true }).click();
  await expect(page.locator(".collection-relation-list")).toContainText(
    "所测残差骨架中的门控边界",
  );
  await page.getByRole("button", { name: /本地记录/ }).click();
  await expect(page.locator(".saved-row")).toHaveCount(2);
  await page.getByRole("button", { name: "关闭对话框" }).click();
  await upload(page, rejected);
  await expect(page.locator(".collection-heading")).toContainText("2 篇");
  await page.getByRole("button", { name: "单篇证据卡", exact: true }).click();
  await expect(page.locator(".paper-card")).toHaveCount(2);
  await expect(
    page.locator(".paper-card").filter({ hasText: "Identity Mappings" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /本地记录/ }).click();
  await expect(page.locator(".saved-row")).toHaveCount(3);
});
