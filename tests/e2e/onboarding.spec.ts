import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { examplePrompt, projectLinks } from "../../viewer/UsageGuide";

test("offers downloads, source and a shared guide from home and reader", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          (window as any).__copiedPrompt = text;
        },
      },
    });
  });
  await page.goto("./");
  await expect(page.getByRole("link", { name: "GitHub 仓库" })).toHaveAttribute(
    "href",
    projectLinks.github,
  );
  for (const link of await page
    .getByRole("link", { name: "下载 Skill", exact: true })
    .all()) {
    await expect(link).toHaveAttribute("href", projectLinks.release);
    await expect(link).toHaveAttribute("target", "_blank");
  }
  await expect(
    page.getByRole("link", { name: "完整 README", exact: true }),
  ).toHaveAttribute("href", projectLinks.readme);
  await page.getByRole("button", { name: "复制调用示例" }).click();
  await expect(
    page.getByText("调用示例已复制。", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__copiedPrompt)).toBe(
    examplePrompt,
  );
  await page.getByRole("button", { name: "使用指南", exact: true }).click();
  const guide = page.getByRole("dialog", { name: "使用指南" });
  await expect(guide).toContainText(".agents/skills/");
  await expect(guide.getByLabel("Skill 调用示例")).toHaveText(examplePrompt);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /计算机视觉.*ResNet/ }).click();
  await page.getByRole("button", { name: "使用指南", exact: true }).click();
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("旧版继续保留");
  await page.getByRole("button", { name: "关闭对话框" }).click();
  await expect(page.getByRole("link", { name: "GitHub 仓库" })).toBeVisible();
});

test("keeps instructions and manual copy usable on narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("unavailable");
        },
      },
    });
  });
  await page.goto("./");
  await expect(
    page.getByRole("button", { name: "使用指南", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("banner")
      .getByRole("button", { name: "导入分析 JSON", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "GitHub 仓库" })).toBeVisible();
  await page.getByRole("button", { name: "复制调用示例" }).click();
  await expect(page.getByRole("status")).toContainText("手动复制");
  await expect(page.getByLabel("Skill 调用示例")).toHaveText(examplePrompt);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const steps = await page.locator(".usage-steps > li").all();
  expect((await steps[1].boundingBox())!.y).toBeGreaterThan(
    (await steps[0].boundingBox())!.y,
  );
  mkdirSync("test-results/screenshots", { recursive: true });
  await page.screenshot({
    path: "test-results/screenshots/onboarding-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "使用指南", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "使用指南" });
  await dialog.getByRole("button", { name: "复制调用示例" }).click();
  await expect(dialog.getByRole("status")).toContainText("手动复制");
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
});
