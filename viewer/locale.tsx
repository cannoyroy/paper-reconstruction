import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { english } from "./messages";

export type Locale = "en" | "zh";
let activeLocale: Locale = "en";
/** Translate interface labels only; never apply this to user-provided content. */
export function ui(value: string): string {
  const key = value.trim();
  const translated = english[key];
  return activeLocale === "en" && translated
    ? value.replace(key, translated)
    : value;
}
/** Translate validation messages without modifying the imported result itself. */
export function uiError(value: string): string {
  if (activeLocale !== "en") return value;
  return Object.keys(english)
    .sort((a, b) => b.length - a.length)
    .reduce(
      (text, key) =>
        text.includes(key) ? text.replaceAll(key, english[key]) : text,
      value,
    );
}
const statusLabels: Record<string, Record<string, [string, string]>> = {
  search: {
    not_started: ["未开始", "Not started"],
    provided_only: ["仅提供材料", "Provided materials only"],
    completed: ["已完成", "Completed"],
    unavailable: ["不可用", "Unavailable"],
  },
  fulltext: {
    available: ["可获取", "Available"],
    unknown: ["未知", "Unknown"],
    unavailable: ["不可获取", "Unavailable"],
  },
  verification: {
    source_checked: ["来源已核查", "Source checked"],
    locator_unverified: ["定位未核实", "Locator unverified"],
    not_checked: ["未核查", "Not checked"],
  },
  semantic: {
    pending: ["待语义审查", "Semantic review pending"],
    self_reviewed: ["执行者自查", "Analyst self-review"],
    independently_reviewed: ["独立审查", "Independent review"],
  },
};
export function uiStatus(kind: string, value: string): string {
  const pair = statusLabels[kind]?.[value];
  return pair ? pair[activeLocale === "en" ? 1 : 0] : value;
}
export function flowAria(locale: Locale) {
  return locale === "zh"
    ? {
        "controls.ariaLabel": "地图控件",
        "controls.zoomIn.ariaLabel": "放大",
        "controls.zoomOut.ariaLabel": "缩小",
        "controls.fitView.ariaLabel": "适应视图",
        "controls.interactive.ariaLabel": "切换交互",
      }
    : {};
}
export function uiLocator(e: {
  locator: {
    section: string | null;
    figure_or_table: string | null;
    pdf_page_index: number | null;
    printed_page: string | null;
    text_anchor: string | null;
  };
}): string {
  const l = e.locator;
  return [
    l.section,
    l.figure_or_table,
    l.pdf_page_index === null
      ? null
      : activeLocale === "en"
        ? `PDF page ${l.pdf_page_index + 1}`
        : `PDF 第 ${l.pdf_page_index + 1} 页`,
    l.printed_page === null
      ? null
      : activeLocale === "en"
        ? `printed page ${l.printed_page}`
        : `印刷页 ${l.printed_page}`,
    l.text_anchor,
  ]
    .filter(Boolean)
    .join(" · ");
}
const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: "en", setLocale: () => {} });
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      return localStorage.getItem("paper-reconstruction-locale") === "zh"
        ? "zh"
        : "en";
    } catch {
      return "en";
    }
  });
  activeLocale = locale;
  const setLocale = (value: Locale) => {
    setLocaleState(value);
    try {
      localStorage.setItem("paper-reconstruction-locale", value);
    } catch {
      /* Keep the current session usable. */
    }
  };
  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
    document.title =
      locale === "en" ? "Paper Reconstruction Workbench" : "论文研究复盘工作台";
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        "content",
        locale === "en"
          ? "Reconstruct research decisions from paper evidence and inspect the reasoning behind them."
          : "以证据为依据重建论文的候选研究决策。阅读完整复盘，比较路径，核查证据，并回到 Codex 深入讨论。",
      );
  }, [locale]);
  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}
export const useLocale = () => useContext(LocaleContext);
