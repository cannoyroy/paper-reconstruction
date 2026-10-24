import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
const original = JSON.parse(readFileSync("examples/resnet-2015.json", "utf8"));
async function example(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: /计算机视觉.*ResNet/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Deep Residual",
  );
}
async function upload(page: Page, value: unknown, name = "analysis.json") {
  await page
    .getByLabel("导入分析 JSON")
    .setInputFiles({
      name,
      mimeType: "application/json",
      buffer: Buffer.from(
        typeof value === "string" ? value : JSON.stringify(value),
      ),
    });
}
test("reads a case, inspects an inference and takes a version-bound question back", async ({
  page,
}) => {
  mkdirSync("test-results/screenshots", { recursive: true });
  await page.goto("./");
  await page.screenshot({
    path: "test-results/screenshots/home-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /计算机视觉.*ResNet/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Deep Residual",
  );
  await page.getByRole("button", { name: "2 项主张与依据" }).nth(1).click();
  const panel = page.getByRole("complementary", { name: "证据详情" });
  await expect(panel).toContainText("有依据推断");
  await expect(panel).toContainText("仅相容");
  await page.screenshot({
    path: "test-results/screenshots/evidence-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "关闭详情面板" }).click();
  await page.getByLabel("候选路径").selectOption("P02");
  await page
    .getByRole("complementary", { name: "报告目录" })
    .getByRole("button", { name: /N01/ })
    .click();
  await expect(
    page.getByRole("complementary", { name: "节点详情" }),
  ).toContainText("假设已有表示重写直觉");
  await page.getByLabel("带回 Codex 的问题").fill("为什么不能从消融推出历史？");
  await page.getByRole("button", { name: "准备节点与提问上下文" }).click();
  await expect(page.locator("#discussion-context")).toHaveValue(
    /"path_id": "P02"/,
  );
  await expect(page.locator("#discussion-context")).not.toHaveValue(
    /假设已看到深层模型验证误差更高/,
  );
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载讨论包", exact: true }).click();
  expect((await d).suggestedFilename()).toContain("v1-P02-N01");
});
test("persists selection and supports labeled map edges and return cycles", async ({
  page,
}) => {
  await example(page);
  await page.getByLabel("候选路径").selectOption("P02");
  await page.waitForTimeout(350);
  await page.reload();
  await expect(page.getByLabel("候选路径")).toHaveValue("P02");
  await page.getByLabel("候选路径").selectOption("P01");
  await page.getByRole("button", { name: "决策地图", exact: true }).click();
  await expect(page.getByTestId("decision-map")).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(3);
  await page.getByRole("group", { name: /研究节点 N02/ }).click();
  await expect(
    page.getByRole("complementary", { name: "节点详情" }),
  ).toContainText("让新结构保留一个已有解");
});
test("rejects malformed, incompatible and conflicting results without losing the readable report", async ({
  page,
}) => {
  await example(page);
  await upload(page, "{");
  await expect(page.getByRole("alert")).toContainText("有效的 JSON");
  const incompatible = structuredClone(original);
  incompatible.schema_version = "2";
  await upload(page, incompatible);
  await expect(page.getByRole("alert")).toContainText("schema_version");
  const conflict = structuredClone(original);
  conflict.claims[0].text = "changed";
  await upload(page, conflict);
  await expect(page.getByRole("alert")).toContainText("新版本");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Deep Residual",
  );
});
test("imports a revision while keeping its predecessor and reports the change", async ({
  page,
}) => {
  await example(page);
  const revised = structuredClone(original);
  revised.analysis_version = 2;
  revised.revision = {
    previous_version: 1,
    change_reason: "限定证据只与路径相容",
    node_mappings: original.nodes.map((n: { node_id: string }) => ({
      old_node_id: n.node_id,
      new_node_ids: [n.node_id],
      change: "retained",
    })),
  };
  await upload(page, revised);
  await expect(page.locator(".revision-note")).toContainText(
    "限定证据只与路径相容",
  );
  await page.getByRole("button", { name: /本地记录/ }).click();
  await expect(page.locator(".saved-row")).toHaveCount(2);
  await page
    .locator(".saved-row")
    .filter({ hasText: "v1" })
    .getByRole("button")
    .first()
    .click();
  await expect(page.locator(".revision-note")).toContainText("已有 v2");
});
test("does not execute markup or fetch embedded images", async ({ page }) => {
  await page.goto("./");
  const b = structuredClone(original);
  b.analysis_id = "untrusted-markup";
  b.example_kind = "user_analysis";
  b.sections[0].blocks[0].markdown =
    '<script>window.pwned=true</script>\n<img src="https://example.invalid/track" onerror="window.pwned=true">\n[bad](javascript:alert(1))\n![track](https://example.invalid/track.png)';
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await upload(page, b);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Deep Residual",
  );
  expect(
    await page.evaluate(() => (window as unknown as { pwned: boolean }).pwned),
  ).toBeUndefined();
  expect(requests.some((x) => x.includes("example.invalid"))).toBe(false);
  await expect(page.locator(".report-block img")).toHaveCount(0);
  await expect(
    page.locator('.report-block a[href^="javascript:"]'),
  ).toHaveCount(0);
});
test("storage and clipboard failures preserve reading and manual export", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new Error("disabled");
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    });
  });
  await example(page);
  await expect(
    page.getByRole("status").filter({ hasText: "浏览器存储不可用" }),
  ).toBeVisible();
  await page
    .getByRole("complementary", { name: "报告目录" })
    .getByRole("button", { name: /N01/ })
    .click();
  await page.getByRole("button", { name: "准备节点与提问上下文" }).click();
  await page.getByRole("button", { name: "复制全部上下文" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "无法自动复制" }),
  ).toBeVisible();
  await expect(page.locator("#discussion-context")).toHaveValue(
    /discussion_context/,
  );
});
test("shows partial material gaps without constructing a fake graph", async ({
  page,
}) => {
  await page.goto("./");
  const b = structuredClone(original);
  b.analysis_id = "abstract-only";
  b.status = "partial";
  b.nodes = [];
  b.edges = [];
  b.claims = [];
  b.evidence = [];
  b.paths = [
    { ...b.paths[0], node_refs: [], edge_refs: [], evidence_links: [] },
  ];
  b.sections = [
    {
      section_id: "gap",
      title: "全文缺失",
      blocks: [
        {
          block_id: "gap-1",
          markdown: "目前只有摘要。",
          node_refs: [],
          claim_refs: [],
          evidence_refs: [],
        },
      ],
    },
  ];
  b.limitations = ["作者全文与附录访问失败"];
  b.sources[0].read_status = "unavailable";
  await upload(page, b);
  await expect(page.locator(".paper-labels")).toContainText("部分完成");
  await expect(page.locator("#limitations")).toContainText(
    "全文与附录访问失败",
  );
  await page.getByRole("button", { name: "决策地图", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
});
test("mobile reading, node drawer and local-record deletion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await example(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  mkdirSync("test-results/screenshots", { recursive: true });
  await page.screenshot({
    path: "test-results/screenshots/reader-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "目录", exact: true }).click();
  await page
    .getByRole("complementary", { name: "报告目录" })
    .getByRole("button", { name: /N01/ })
    .click();
  await expect(
    page.getByRole("complementary", { name: "节点详情" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭详情面板" }).click();
  await page.getByRole("button", { name: /本地记录/ }).click();
  await page.getByRole("button", { name: "删除 resnet-2015@1" }).click();
  await expect(page.getByRole("dialog")).toContainText("还没有保存的复盘");
  await page.getByRole("button", { name: "关闭对话框" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "研究如何一步步形成",
  );
});
test("replays the actual held-out Codex discussion and revision artifacts in the reader", async ({
  page,
}) => {
  await page.goto("./");
  const before = JSON.parse(
    readFileSync("evals/ligo/skill/analysis.json", "utf8"),
  );
  const after = JSON.parse(
    readFileSync("evals/ligo/skill/analysis-v2.json", "utf8"),
  );
  await upload(page, before);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Gravitational Waves",
  );
  await page.getByLabel("候选路径").selectOption("P2");
  await page
    .getByRole("complementary", { name: "报告目录" })
    .getByRole("button", { name: /N2/ })
    .click();
  await page
    .getByLabel("带回 Codex 的问题")
    .fill(
      "6%的环境扰动上限能排除所有共同误差吗？请特别说明传感器覆盖与耦合测量的限制。",
    );
  await page.getByRole("button", { name: "准备节点与提问上下文" }).click();
  await expect(page.locator("#discussion-context")).toHaveValue(
    /"path_id": "P2"/,
  );
  await page.getByRole("button", { name: "关闭对话框" }).click();
  await page.getByRole("button", { name: "关闭详情面板" }).click();
  await upload(page, after);
  await expect(page.locator(".revision-note")).toContainText("v1");
  await page.getByLabel("候选路径").selectOption("P2");
  await page
    .getByRole("complementary", { name: "报告目录" })
    .getByRole("button", { name: /N2/ })
    .click();
  await expect(
    page.getByRole("complementary", { name: "节点详情" }),
  ).toContainText("耦合");
  await expect(page.locator(".outcome")).toHaveCount(3);
  await page.getByRole("button", { name: "关闭详情面板" }).click();
  await page.getByRole("button", { name: /本地记录/ }).click();
  await expect(page.locator(".saved-row")).toHaveCount(2);
});
