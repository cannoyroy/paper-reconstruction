/** A display-only translation, keyed by a JSON pointer into an immutable example. */
export type ExampleTranslation = Record<
  string,
  { source: string; english: string }
>;
type Origin = "example" | "imported";
const chinese = /[\u3400-\u9fff]/;
const escapePointer = (key: string) =>
  key.replace(/~/g, "~0").replace(/\//g, "~1");
const stable = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(stable).join(",")}]`
    : value && typeof value === "object"
      ? `{${Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
          .join(",")}}`
      : JSON.stringify(value);

/**
 * Returns a translated copy only when the user opened an exact built-in example
 * and every Chinese string has a matching source-anchored translation.
 * A failed check falls back to the original instead of rendering mixed text.
 */
export function translateExample<T>(
  value: T,
  canonical: T,
  origin: Origin,
  translations: ExampleTranslation,
): T | null {
  if (origin !== "example" || stable(value) !== stable(canonical)) return null;
  const used = new Set<string>();
  let invalid = false;
  function walk(item: unknown, path: string): unknown {
    if (typeof item === "string" && chinese.test(item)) {
      const entry = translations[path];
      if (
        !entry ||
        entry.source !== item ||
        !entry.english.trim() ||
        chinese.test(entry.english)
      ) {
        invalid = true;
        return item;
      }
      // Preserve numeric facts and locators, including repeated occurrences.
      const numbers = (x: string) =>
        (x.match(/(?<![\w.])[-+]?\d+(?:\.\d+)?(?:万|亿)?%?/g) ?? [])
          .map((token) => {
            const unit = token.includes("万")
              ? 10000
              : token.includes("亿")
                ? 100000000
                : 1;
            return `${Number.parseFloat(token) * unit}${token.endsWith("%") ? "%" : ""}`;
          })
          .sort();
      if (
        JSON.stringify(numbers(item)) !== JSON.stringify(numbers(entry.english))
      ) {
        invalid = true;
        return item;
      }
      used.add(path);
      return entry.english;
    }
    if (Array.isArray(item)) return item.map((v, i) => walk(v, `${path}/${i}`));
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item).map(([k, v]) => [
          k,
          walk(v, `${path}/${escapePointer(k)}`),
        ]),
      );
    return item;
  }
  const result = walk(value, "") as T;
  if (invalid || Object.keys(translations).some((k) => !used.has(k)))
    return null;
  return result;
}
