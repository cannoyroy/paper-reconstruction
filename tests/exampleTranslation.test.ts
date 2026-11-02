import { describe, it, expect } from "vitest";
import { translateExample } from "../viewer/exampleTranslation";
import { readFileSync } from "node:fs";
describe("example translation isolation", () => {
  const original = {
    analysis_id: "example",
    analysis_version: 1,
    claims: [{ claim_id: "C1", text: "仅在 34 层支持。", status: "inferred" }],
    evidence: { page: 5 },
  };
  const overlay = {
    "/claims/0/text": {
      source: "仅在 34 层支持。",
      english: "Supported only for 34 layers.",
    },
  };
  it("returns a translated copy without changing IDs, status, numbers or the source", () => {
    const result = translateExample(original, original, "example", overlay);
    expect(result?.claims[0].text).toBe("Supported only for 34 layers.");
    expect(result?.claims[0].status).toBe("inferred");
    expect(result?.evidence.page).toBe(5);
    expect(original.claims[0].text).toBe("仅在 34 层支持。");
  });
  it("never translates imports, modified examples, incomplete or stale mappings", () => {
    expect(
      translateExample(original, original, "imported", overlay),
    ).toBeNull();
    expect(
      translateExample(
        { ...original, analysis_version: 2 },
        original,
        "example",
        overlay,
      ),
    ).toBeNull();
    expect(translateExample(original, original, "example", {})).toBeNull();
    expect(
      translateExample(original, original, "example", {
        "/claims/0/text": { source: "旧文本", english: "Old text" },
      }),
    ).toBeNull();
  });
  it("rejects changed numeric facts and leftover Chinese", () => {
    expect(
      translateExample(original, original, "example", {
        "/claims/0/text": {
          source: overlay["/claims/0/text"].source,
          english: "Supported only for 35 layers.",
        },
      }),
    ).toBeNull();
    expect(
      translateExample(original, original, "example", {
        "/claims/0/text": {
          source: overlay["/claims/0/text"].source,
          english: "支持 34 layers",
        },
      }),
    ).toBeNull();
  });
});

describe("built-in example translations", () => {
  it.each(["resnet-2015", "crispr-2012", "ligo-2016", "residual-programme"])(
    "covers all anchored Chinese text and preserves numeric facts for %s",
    (name) => {
      const raw = JSON.parse(readFileSync(`examples/${name}.json`, "utf8"));
      const translations = JSON.parse(
        readFileSync(`viewer/translations/${name}.en.json`, "utf8"),
      );
      const before = JSON.stringify(raw),
        display = translateExample(
          raw,
          structuredClone(raw),
          "example",
          translations,
        );
      expect(display).not.toBeNull();
      expect(JSON.stringify(display)).not.toMatch(/[\u3400-\u9fff]/);
      expect(JSON.stringify(raw)).toBe(before);
      expect(display.analysis_id).toBe(raw.analysis_id);
      expect(display.analysis_version).toBe(raw.analysis_version);
      const claimFacts = (b: any) =>
        b.claims.map((c: any) => ({
          id: c.claim_id,
          status: c.epistemic_status,
          links: c.evidence_links.map((e: any) => [e.evidence_id, e.relation]),
        }));
      const locations = (b: any) =>
        b.evidence.map((e: any) => ({
          id: e.evidence_id,
          source: e.source_id,
          page: e.locator.pdf_page_index,
          printed: e.locator.printed_page,
        }));
      expect(claimFacts(display)).toEqual(claimFacts(raw));
      expect(locations(display)).toEqual(locations(raw));
      expect(display.nodes.map((n: any) => n.node_id)).toEqual(
        raw.nodes.map((n: any) => n.node_id),
      );
      expect(translateExample(raw, raw, "imported", translations)).toBeNull();
    },
  );
});

it("retains key historical and causal qualifications", () => {
  const read = (name: string) =>
    JSON.parse(readFileSync(`viewer/translations/${name}.en.json`, "utf8"));
  const entries = Object.values(read("resnet-2015")) as {
    source: string;
    english: string;
  }[];
  expect(
    entries.find((e) => e.source.includes("不证明作者先做了哪些失败实验"))
      ?.english,
  ).toMatch(/does not establish/i);
  expect(
    entries.find((e) => e.source.includes("不是作者实际尝试记录"))?.english,
  ).toMatch(/not records/i);
  const ligo = Object.values(read("ligo-2016")) as {
    source: string;
    english: string;
  }[];
  expect(
    ligo.find((e) => e.source.includes("5.1σ不是天体来源的后验概率"))?.english,
  ).toMatch(/5\.1σ is not the posterior probability/i);
});
