import { ui, uiLocator, uiError, flowAria } from "./locale";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Node as FlowNode,
  type Edge as FlowEdge,
} from "@xyflow/react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  FileJson,
  FileText,
  GitBranch,
  Github,
  Layers,
  Library,
  Link as LinkIcon,
  List,
  MessageSquare,
  PanelRightClose,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type {
  AnalysisBundle,
  Claim,
  Evidence,
  ResearchNode,
} from "../core/schema";
import { AnalysisConflictError } from "../core/validate";
import {
  createDiscussion,
  discussionMarkdown,
  edgeLabels,
  epistemicLabels,
  exportMarkdown,
  locatorText,
  relationLabels,
  safeUrl,
} from "../core/export";
import {
  bundleKey,
  deleteSaved,
  listSaved,
  loadLast,
  loadReading,
  saveAnalysis,
  saveLast,
  saveReading,
  type SavedAnalysis,
} from "./storage";
import "@xyflow/react/dist/style.css";
import "./style.css";
import {
  isCollection,
  analysisTitle,
  parseAnyBundle as parseBundle,
  assertAnyConflict as assertNoVersionConflict,
  type AnyAnalysis,
} from "../core/workbench";
import type { CollectionAnalysisBundle } from "../core/collection-schema";
import { UsageGuide, projectLinks } from "./UsageGuide";
import { LocaleProvider, useLocale } from "./locale";
import {
  translateExample,
  type ExampleTranslation,
} from "./exampleTranslation";

const sampleFiles = import.meta.glob("../examples/*.json", {
  import: "default",
});
const CollectionReader = React.lazy(() =>
  import("./CollectionReader").then((m) => ({ default: m.CollectionReader })),
);
const sampleTranslations = import.meta.glob("./translations/*.en.json", {
  import: "default",
});
const samples = [
  {
    id: "residual-programme",
    domain: "多篇联合分析",
    year: "2015–2016",
    title: "ResNet 研究主线",
    subtitle: "从残差表示到直接传播，哪些判断发生了变化？",
    type: "联合复盘 · 2 篇",
    icon: GitBranch,
  },
  {
    id: "resnet-2015",
    domain: "计算机视觉",
    year: "2015",
    title: "ResNet",
    subtitle: "更深的网络，为什么反而更难训练？",
    type: "计算实验",
    icon: Layers,
  },
  {
    id: "crispr-2012",
    domain: "分子生物学",
    year: "2012",
    title: "CRISPR–Cas9",
    subtitle: "如何从天然机制走向可编程工具？",
    type: "实验室研究",
    icon: GitBranch,
  },
  {
    id: "ligo-2016",
    domain: "引力波天文学",
    year: "2016",
    title: "LIGO",
    subtitle: "怎样知道一个信号来自宇宙？",
    type: "观测研究",
    icon: Search,
  },
];
const sampleEnglish = [
  {
    domain: "Multi-paper analysis",
    title: "The ResNet research thread",
    subtitle:
      "From residual representations to direct propagation: which judgments changed?",
    type: "Joint review · 2 papers",
  },
  {
    domain: "Computer vision",
    title: "ResNet",
    subtitle: "Why can deeper networks become harder to train?",
    type: "Computational experiment",
  },
  {
    domain: "Molecular biology",
    title: "CRISPR–Cas9",
    subtitle: "How did a natural mechanism become a programmable tool?",
    type: "Laboratory research",
  },
  {
    domain: "Gravitational-wave astronomy",
    title: "LIGO",
    subtitle: "How can we tell that a signal came from the universe?",
    type: "Observational research",
  },
];
const emptyQuestion = "这条推断的证据够吗？还有哪些竞争解释？";
function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      disallowedElements={["img"]}
      components={{
        a: ({ href, children }) => {
          const safe = safeUrl(href ?? null);
          return safe ? (
            <a href={safe} target="_blank" rel="noopener noreferrer">
              {children}
              <LinkIcon size={11} />
            </a>
          ) : (
            <span>{children}</span>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
function StatusBadge({ claim }: { claim: Claim }) {
  return (
    <span className={`status-badge ${claim.epistemic_status}`}>
      <span />
      {ui(epistemicLabels[claim.epistemic_status])}
    </span>
  );
}

function SavedTitle({ record }: { record: SavedAnalysis }) {
  const { locale } = useLocale();
  const [title, setTitle] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setTitle(null);
    if (locale !== "en" || record.origin !== "example") return;
    const id = record.bundle.analysis_id,
      loadOriginal = sampleFiles[`../examples/${id}.json`],
      loadTranslation = sampleTranslations[`./translations/${id}.en.json`];
    if (!loadOriginal || !loadTranslation) return;
    void Promise.all([loadOriginal(), loadTranslation()])
      .then(([canonical, translation]) => {
        const view = translateExample(
          record.bundle,
          canonical as AnyAnalysis,
          record.origin,
          translation as ExampleTranslation,
        );
        if (!cancelled && view) setTitle(analysisTitle(view));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locale, record]);
  return <>{title ?? analysisTitle(record.bundle)}</>;
}

function App() {
  const { locale, setLocale } = useLocale();
  const tr = (zh: string, en: string) => (locale === "zh" ? zh : en);
  const [rawCollection, setCollection] =
    useState<CollectionAnalysisBundle | null>(null);
  const [rawBundle, setBundle] = useState<AnalysisBundle | null>(null),
    [saved, setSaved] = useState<SavedAnalysis[]>([]);
  const [currentOrigin, setCurrentOrigin] =
    useState<SavedAnalysis["origin"]>("imported");
  const [translated, setTranslated] = useState<{
    original: AnyAnalysis;
    display: AnyAnalysis | null;
  } | null>(null);
  const original = rawCollection ?? rawBundle;
  useEffect(() => {
    let cancelled = false;
    if (locale !== "en" || currentOrigin !== "example" || !original) {
      setTranslated(null);
      return;
    }
    const filename = original.analysis_id;
    const loadOriginal = sampleFiles[`../examples/${filename}.json`],
      loadTranslation =
        sampleTranslations[`./translations/${filename}.en.json`];
    if (!loadOriginal || !loadTranslation) {
      setTranslated({ original, display: null });
      return;
    }
    void Promise.all([loadOriginal(), loadTranslation()])
      .then(([canonical, translation]) => {
        if (!cancelled)
          setTranslated({
            original,
            display: translateExample(
              original,
              canonical as AnyAnalysis,
              currentOrigin,
              translation as ExampleTranslation,
            ),
          });
      })
      .catch(() => {
        if (!cancelled) setTranslated({ original, display: null });
      });
    return () => {
      cancelled = true;
    };
  }, [locale, currentOrigin, original]);
  const display =
    locale === "en" &&
    currentOrigin === "example" &&
    translated?.original === original
      ? (translated.display ?? original)
      : original;
  const collection = display && isCollection(display) ? display : null;
  const bundle = display && !isCollection(display) ? display : null;
  const [pathId, setPathId] = useState(""),
    [nodeId, setNodeId] = useState<string | null>(null),
    [blockId, setBlockId] = useState<string | null>(null),
    [claimId, setClaimId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"node" | "evidence" | null>(null),
    [view, setView] = useState<"report" | "map">("report");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [storageError, setStorageError] = useState(false);
  const [library, setLibrary] = useState(false),
    [guide, setGuide] = useState(false),
    [help, setHelp] = useState(false),
    [exportOpen, setExportOpen] = useState(false),
    [toc, setToc] = useState(false);
  const [question, setQuestion] = useState(() => ui(emptyQuestion)),
    [participatory, setParticipatory] = useState(false),
    [discussion, setDiscussion] = useState<string | null>(null),
    [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    restoration = useRef(false),
    stateRef = useRef({ pathId, nodeId, blockId });
  stateRef.current = { pathId, nodeId, blockId };
  useEffect(() => {
    setQuestion((q) =>
      q === emptyQuestion ||
      q ===
        "Is the evidence for this inference sufficient? What alternative explanations exist?"
        ? ui(emptyQuestion)
        : q,
    );
  }, [locale]);
  const currentRef = useRef<AnyAnalysis | null>(null);
  currentRef.current = original;
  const path = bundle?.paths.find((p) => p.path_id === pathId),
    node = bundle?.nodes.find((n) => n.node_id === nodeId);
  const block = bundle?.sections
    .flatMap((s) => s.blocks)
    .find((b) => b.block_id === blockId);
  const claim = bundle?.claims.find((c) => c.claim_id === claimId);
  const selectedClaims =
    bundle?.claims.filter((c) =>
      (block?.claim_refs ?? node?.claim_refs ?? []).includes(c.claim_id),
    ) ?? [];
  const noteStorage = () => {
    setStorageError(true);
  };
  const refreshSaved = async () => {
    try {
      setSaved(await listSaved());
    } catch {
      noteStorage();
    }
  };

  const openBundle = useCallback(
    async (b: AnyAnalysis, origin: SavedAnalysis["origin"], persist = true) => {
      // Reject a same-session collision even if browser storage is unavailable.
      if (currentRef.current) assertNoVersionConflict(currentRef.current, b);
      if (persist) {
        try {
          await saveAnalysis(b, origin);
          await saveLast(bundleKey(b));
          await refreshSaved();
        } catch (e) {
          if (e instanceof AnalysisConflictError) throw e;
          noteStorage();
        }
      }
      setCurrentOrigin(origin);
      if (isCollection(b)) {
        setCollection(b);
        setBundle(null);
        setLibrary(false);
        setPanel(null);
        setError("");
        setDiscussion(null);
        setExportOpen(false);
        return;
      }
      setCollection(null);
      let reading: Awaited<ReturnType<typeof loadReading>>;
      try {
        reading = await loadReading(bundleKey(b));
      } catch {
        noteStorage();
      }
      const p =
        b.paths.find((p) => p.path_id === reading?.pathId) ?? b.paths[0];
      setBundle(b);
      setPathId(p.path_id);
      setNodeId(
        reading?.nodeId && p.node_refs.includes(reading.nodeId)
          ? reading.nodeId
          : null,
      );
      setBlockId(reading?.blockId ?? null);
      setClaimId(null);
      setPanel(null);
      setView("report");
      setLibrary(false);
      setError("");
      setToc(false);
      setDiscussion(null);
      setExportOpen(false);
      restoration.current = true;
      setTimeout(() => {
        window.scrollTo(0, reading?.scrollY ?? 0);
        restoration.current = false;
      }, 100);
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      try {
        const list = await listSaved();
        setSaved(list);
        const last = await loadLast();
        const item = list.find((x) => x.key === last);
        if (item) await openBundle(item.bundle, item.origin, false);
      } catch {
        noteStorage();
      }
    })();
  }, [openBundle]);
  useEffect(() => {
    if (!bundle) return;
    const key = bundleKey(bundle);
    let timer: ReturnType<typeof setTimeout>;
    const persist = () => {
      if (restoration.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void saveReading(key, {
          ...stateRef.current,
          scrollY: window.scrollY,
        }).catch(noteStorage);
      }, 180);
    };
    persist();
    window.addEventListener("scroll", persist, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", persist);
    };
  }, [bundle, pathId, nodeId, blockId]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setHelp(false);
        setGuide(false);
        setLibrary(false);
        setPanel(null);
        setToc(false);
        setDiscussion(null);
        setExportOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function loadExample(id: string) {
    setBusy(true);
    setError("");
    try {
      const loader = sampleFiles[`../examples/${id}.json`];
      if (!loader) throw new Error("这个示例尚未包含在当前构建中。");
      const r = parseBundle(JSON.stringify(await loader()));
      if (!r.ok) throw new Error(r.errors.join("；"));
      await openBundle(r.value, "example");
    } catch (e) {
      setError(e instanceof Error ? e.message : "示例读取失败");
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("结果文件超过 20 MB，请导入不含原始论文的分析 JSON。");
      const r = parseBundle(await file.text());
      if (!r.ok)
        throw new Error(`无法导入：${r.errors.slice(0, 8).join("；")}`);
      await openBundle(r.value, "imported");
      setNotice(
        r.value.status === "partial"
          ? "已导入部分结果，请查看具体材料缺口。"
          : "结果已导入。",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  function selectNode(id: string, scroll = false) {
    setNodeId(id);
    setBlockId(null);
    setClaimId(null);
    setPanel("node");
    setQuestion(ui(emptyQuestion));
    setToc(false);
    if (scroll && bundle) {
      const b = bundle.sections
        .flatMap((s) => s.blocks)
        .find((b) => b.node_refs.includes(id));
      if (b) {
        setBlockId(b.block_id);
        setView("report");
        setTimeout(
          () =>
            document
              .getElementById(`block-${b.block_id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" }),
          60,
        );
      }
    }
  }
  function inspectBlock(id: string) {
    const b = bundle!.sections
      .flatMap((s) => s.blocks)
      .find((b) => b.block_id === id)!;
    setBlockId(id);
    if (b.node_refs.some((id) => path?.node_refs.includes(id)))
      setNodeId(b.node_refs.find((id) => path?.node_refs.includes(id))!);
    setClaimId(b.claim_refs[0] ?? null);
    setPanel("evidence");
  }
  function switchPath(id: string) {
    setPathId(id);
    setClaimId(null);
    setBlockId(null);
    if (
      !bundle!.paths
        .find((p) => p.path_id === id)
        ?.node_refs.includes(nodeId ?? "")
    ) {
      setNodeId(null);
      setPanel(null);
    }
  }
  function makeDiscussion() {
    try {
      if (!bundle || !node || !path) return;
      const d = createDiscussion(
        rawBundle!,
        path.path_id,
        node.node_id,
        question,
        participatory ? "participatory" : "direct",
      );
      setDiscussion(discussionMarkdown(d));
      setCopied(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function copyDiscussion() {
    try {
      await navigator.clipboard.writeText(discussion!);
      setCopied(true);
    } catch {
      setCopied(false);
      setNotice("无法自动复制。请选中下方全文手动复制，或下载讨论包。");
    }
  }
  const graphNodes: FlowNode[] = useMemo(
    () =>
      (path?.node_refs ?? []).map((id, i) => ({
        id,
        data: {
          label: (
            <>
              <span className="graph-node-id">{id}</span>
              <strong>
                {bundle?.nodes.find((n) => n.node_id === id)?.title}
              </strong>
              <span>{ui("查看决策与证据 →")}</span>
            </>
          ),
        },
        position: { x: i % 2 === 0 ? 70 : 420, y: i * 160 },
        selected: id === nodeId,
        ariaLabel: `${ui("研究节点")} ${id} ${bundle?.nodes.find((n) => n.node_id === id)?.title}`,
      })),
    [bundle, path, nodeId, locale],
  );
  const graphEdges: FlowEdge[] = useMemo(
    () =>
      (bundle?.edges ?? [])
        .filter((e) => path?.edge_refs.includes(e.edge_id))
        .map((e) => ({
          id: e.edge_id,
          source: e.source_node_id,
          target: e.target_node_id,
          label: `${ui(edgeLabels[e.relation_type])} · ${e.label}`,
          type: e.relation_type === "return" ? "smoothstep" : "default",
          style: {
            stroke: e.relation_type === "return" ? "#b68c55" : "#789087",
            strokeDasharray:
              e.epistemic_status === "explicit" ? undefined : "6 4",
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#789087" },
          labelStyle: { fontSize: 11, fill: "#56655e" },
          labelBgStyle: { fill: "#f9faf7" },
        })),
    [bundle, path, locale],
  );
  const newer = bundle
    ? saved
        .filter(
          (s) =>
            s.bundle.analysis_id === bundle.analysis_id &&
            s.bundle.analysis_version > bundle.analysis_version,
        )
        .sort(
          (a, b) => b.bundle.analysis_version - a.bundle.analysis_version,
        )[0]
    : null;

  return (
    <>
      <header className="app-header">
        <button
          className="brand"
          onClick={() => {
            setBundle(null);
            setCollection(null);
            setPanel(null);
          }}
          aria-label={tr("返回工作台首页", "Return to workbench home")}
        >
          <span className="brand-mark">
            <GitBranch size={21} />
          </span>
          <span>
            {tr("研究复盘", "Research Review")}
            <span className="brand-en">PAPER RECONSTRUCTION</span>
          </span>
        </button>
        <nav>
          <button
            className={!help && !guide ? "nav-active" : ""}
            onClick={() => {
              setHelp(false);
              setGuide(false);
            }}
          >
            {tr("工作台", "Workbench")}
          </button>
          <button
            onClick={() => {
              setGuide(true);
              setHelp(false);
            }}
          >
            {tr("使用指南", "Usage guide")}
          </button>
          <button
            onClick={() => {
              setHelp(true);
              setGuide(false);
            }}
          >
            {tr("方法与边界", "Method and limits")} <CircleHelp size={14} />
          </button>
        </nav>
        <div className="header-actions">
          <button
            className="button subtle language-switch"
            onClick={() => setLocale(locale === "en" ? "zh" : "en")}
            aria-label={
              locale === "en" ? "Switch language to Chinese" : "切换语言为英文"
            }
          >
            English / 中文
          </button>
          <a
            className="button subtle github-link"
            href={projectLinks.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={tr("GitHub 仓库", "GitHub repository")}
          >
            <Github size={18} />
            <span>GitHub</span>
          </a>
          <button
            className="button subtle library-button"
            onClick={() => {
              void refreshSaved();
              setLibrary(true);
            }}
          >
            <Library size={16} />
            {tr("本地记录", "Local records")}
            <span className="count">{saved.length}</span>
          </button>
          <button
            className="button primary"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            <Upload size={15} />
            {tr("导入分析 JSON", "Import analysis JSON")}
          </button>
        </div>
      </header>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        aria-label={tr("导入分析 JSON", "Import analysis JSON")}
        onChange={(e) => {
          void importFile(e.target.files?.[0]);
        }}
      />
      {storageError && (
        <div className="system-message warning" role="status">
          {tr(
            "浏览器存储不可用，本次仍可阅读和导出；关闭页面前请导出结果保存。",
            "Browser storage is unavailable. You can still read and export; save your result before closing this page.",
          )}
        </div>
      )}
      {error && (
        <div className="system-message error" role="alert">
          <span>{uiError(error)}</span>
          <button aria-label={ui("关闭错误")} onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {uiError(notice)}
        </div>
      )}
      {busy && (
        <div className="loading-bar" role="status">
          {tr("正在读取与校验结果…", "Reading and validating the result…")}
        </div>
      )}
      {original && currentOrigin === "example" && locale === "en" && (
        <div className="system-message" role="status">
          {translated?.original !== original
            ? "Preparing the English example translation…"
            : translated.display
              ? "English display translation. JSON exports and discussion packages retain the original Chinese analysis."
              : "The English translation could not be verified. The original example is shown instead."}
        </div>
      )}

      {collection ? (
        <React.Suspense
          fallback={
            <div role="status" className="loading-bar">
              {tr("正在读取联合分析…", "Loading collection…")}
            </div>
          }
        >
          <CollectionReader
            key={bundleKey(collection)}
            bundle={collection}
            sourceBundle={rawCollection!}
            onStorageError={noteStorage}
          />
        </React.Suspense>
      ) : !bundle ? (
        <main className="home">
          <div className="home-topline">
            <span className="eyebrow">
              <span className="small-dot" /> A WORKSPACE FOR RESEARCH JUDGMENT
            </span>
            <span className="version">
              {tr("研究复盘", "Research review")} · v0.2
            </span>
          </div>
          <section className="home-hero">
            <div>
              <p className="hero-kicker">
                {tr(
                  "从一篇论文，走进研究的选择。",
                  "Discover the choices behind research.",
                )}
              </p>
              <h1>
                {tr("结论之前，", "Before the conclusion,")}
                <br />
                {tr("研究如何一步步形成？", "how did the research take shape?")}
              </h1>
              <p className="hero-description">
                {tr(
                  "沿着证据，重建可能的研究起点、关键转折与替代方向。",
                  "Follow the evidence to reconstruct possible starting points, decisions, and alternatives.",
                )}
                <br className="desktop-break" />
                {tr(
                  "读懂每个选择的依据，也看见它仍然不确定的地方。",
                  "Understand the reasons behind each choice and where uncertainty remains.",
                )}
              </p>
              <div className="hero-actions">
                <a
                  className="button primary"
                  href={projectLinks.release}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ArrowDownToLine size={17} />
                  {tr("下载 Skill", "Download Skill")}
                </a>
                <button
                  className="text-button"
                  onClick={() =>
                    document
                      .getElementById("examples")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  {tr("先看一个案例", "Explore an example")}{" "}
                  <ArrowRight size={16} />
                </button>
              </div>
              <p className="local-note">
                <ShieldCheck size={14} />
                {tr(
                  "结果在你的浏览器内处理与保存",
                  "Results are processed and saved in your browser",
                )}
              </p>
            </div>
            <div
              className="hero-diagram"
              aria-label={tr(
                "研究路径示意：从问题到候选解释，经判别证据到下一步行动",
                "Research path illustration: a question, possible explanations, discriminating evidence and next steps",
              )}
            >
              <div className="diagram-label">
                {tr("一种研究路径 · 示意", "An illustrative research path")}
              </div>
              <div className="diagram-start">
                <span>01</span>
                {tr("一个值得解释的现象", "A phenomenon worth explaining")}
              </div>
              <div className="diagram-branches">
                <div>
                  {tr("解释 A", "Explanation A")}
                  <span>
                    {tr("可能的信息缺口", "A possible information gap")}
                  </span>
                </div>
                <div>
                  {tr("解释 B", "Explanation B")}
                  <span>
                    {tr("也可能是测量方式", "Or a measurement effect")}
                  </span>
                </div>
              </div>
              <div className="diagram-test">
                <Search size={17} />
                <span>
                  {tr(
                    "什么证据，能区分它们？",
                    "What evidence distinguishes them?",
                  )}
                </span>
              </div>
              <div className="diagram-end">
                <span className="small-dot" />
                {tr("让观察改变下一步", "Let observations guide the next step")}
              </div>
              <div className="diagram-caption">
                {tr(
                  "候选路径 ≠ 已核实的研发历史",
                  "Candidate path ≠ verified research history",
                )}
              </div>
            </div>
          </section>
          <section className="usage-section" aria-labelledby="usage-title">
            <div className="section-head">
              <div>
                <span className="eyebrow">GET STARTED</span>
                <h2 id="usage-title">{tr("如何使用", "How to use")}</h2>
              </div>
            </div>
            <UsageGuide />
          </section>
          <section className="examples-section" id="examples">
            <div className="section-head">
              <div>
                <span className="eyebrow">EXPLORE THE CASES</span>
                <h2>{tr("从研究现场开始", "Explore the research")}</h2>
              </div>
              <p>
                {tr(
                  "单篇读懂选择，多篇比较研究主线。",
                  "Understand individual choices and compare multiple research paths.",
                )}
              </p>
            </div>
            <div className="sample-grid">
              {samples.map((s, i) => (
                <button
                  className="sample-card"
                  key={s.id}
                  onClick={() => {
                    void loadExample(s.id);
                  }}
                  disabled={busy}
                >
                  <div className="sample-meta">
                    <span>
                      {locale === "en" ? sampleEnglish[i].domain : s.domain}
                    </span>
                    <span>{s.year}</span>
                  </div>
                  <div className={`sample-art art-${i}`}>
                    <s.icon size={44} strokeWidth={1.15} />
                    <span>{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <span className="sample-type">
                    {locale === "en" ? sampleEnglish[i].type : s.type} ·{" "}
                    {tr("真实论文示例", "Real-paper example")}
                  </span>
                  <h3>{locale === "en" ? sampleEnglish[i].title : s.title}</h3>
                  <p>
                    {locale === "en" ? sampleEnglish[i].subtitle : s.subtitle}
                  </p>
                  <div className="sample-footer">
                    <span>{tr("阅读研究复盘", "Read reconstruction")}</span>
                    <ArrowRight size={17} />
                  </div>
                </button>
              ))}
            </div>
          </section>
          <footer className="home-footer">
            <span>
              {tr("论文研究复盘工作台", "Paper Reconstruction Workbench")}
            </span>
            <span>
              {tr(
                "证据有出处，推断有前提，判断有边界。",
                "Evidence has sources, inferences have assumptions, and judgments have limits.",
              )}
            </span>
            <div className="footer-links">
              <a
                href={projectLinks.github}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              <a
                href={projectLinks.release}
                target="_blank"
                rel="noopener noreferrer"
              >
                {tr("Skill 发布页", "Skill releases")}
              </a>
              <a
                href={
                  locale === "en" ? projectLinks.readmeEn : projectLinks.readme
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                {tr("完整 README", "Full README")}
              </a>
            </div>
            <button onClick={() => setHelp(true)}>
              {tr("阅读方法说明", "Read about the method")}{" "}
              <ArrowRight size={13} />
            </button>
          </footer>
        </main>
      ) : (
        <>
          <div className="reader-heading">
            <div className="breadcrumb">
              <button
                onClick={() => {
                  setBundle(null);
                  setPanel(null);
                }}
              >
                <ArrowLeft size={13} />
                {tr("工作台", "Workbench")}
              </button>
              <span>/</span>
              <span>{bundle.paper.domain}</span>
              <span>/</span>
              <span>
                {bundle.status === "partial" ? ui("部分复盘") : ui("完整复盘")}
              </span>
            </div>
            <div className="paper-title-row">
              <div>
                <div className="paper-labels">
                  <span>
                    {currentOrigin === "example" ||
                    bundle.example_kind === "real_paper"
                      ? ui("真实论文示例")
                      : bundle.example_kind === "fictional"
                        ? ui("虚构演示")
                        : ui("用户分析")}
                  </span>
                  <span>
                    {bundle.status === "partial"
                      ? ui("部分完成")
                      : ui("六部分复盘")}
                  </span>
                  <span>
                    {ui("分析 v")}
                    {bundle.analysis_version}
                  </span>
                </div>
                <h1>{bundle.paper.title}</h1>
                <p className="paper-subtitle">
                  {bundle.paper.authors.slice(0, 2).join(" · ")}
                  {bundle.paper.authors.length > 2 ? ui(" 等") : ""}
                  <span>
                    {ui("论文版本：")}
                    {bundle.paper.version}
                  </span>
                </p>
              </div>
              <div className="export-wrap">
                <button
                  className="button outline"
                  onClick={() => setExportOpen(!exportOpen)}
                >
                  <ArrowDownToLine size={15} />
                  {ui(" 导出 ")}
                  <ChevronDown size={13} />
                </button>
                {exportOpen && (
                  <div className="dropdown">
                    <button
                      onClick={() => {
                        download(
                          `${bundle.analysis_id}-v${bundle.analysis_version}.json`,
                          JSON.stringify(rawBundle, null, 2),
                        );
                        setExportOpen(false);
                      }}
                    >
                      <FileJson size={15} />
                      {ui(" 分析 JSON ")}
                    </button>
                    <button
                      onClick={() => {
                        download(
                          `${bundle.analysis_id}-v${bundle.analysis_version}.md`,
                          exportMarkdown(rawBundle!),
                          "text/markdown",
                        );
                        setExportOpen(false);
                      }}
                    >
                      <FileText size={15} />
                      {ui(" Markdown 阅读版 ")}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="reader-context">
              <span>
                <BookOpen size={14} />
                {(() => {
                  const count = bundle.sources.filter(
                    (s) => s.read_status !== "unavailable",
                  ).length;
                  return locale === "en"
                    ? `${count} source${count === 1 ? "" : "s"} read`
                    : `${count} 份已读取材料`;
                })()}
              </span>
              <span>
                <GitBranch size={14} />
                {locale === "en"
                  ? `${bundle.paths.length} candidate path${bundle.paths.length === 1 ? "" : "s"}`
                  : `${bundle.paths.length} 条候选路径`}
              </span>
              <span>
                <ShieldCheck size={14} />
                {bundle.validation.semantic_review === "pending"
                  ? ui("待语义审查")
                  : bundle.validation.semantic_review === "self_reviewed"
                    ? ui("执行者自查")
                    : ui("独立审查")}
              </span>
              <button
                onClick={() =>
                  document
                    .getElementById("limitations")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                {ui(" 材料范围与限制 ")}
                <ArrowRight size={12} />
              </button>
            </div>
            {bundle.revision && (
              <div className="revision-note">
                {ui(" 本版修订自 v")}
                {bundle.revision.previous_version}：
                {bundle.revision.change_reason}
              </div>
            )}
            {newer && (
              <div className="revision-note">
                {ui(" 当前是旧版；已有 v")}
                {newer.bundle.analysis_version}
                {ui(" 。旧讨论仍绑定本版。 ")}
                <button
                  onClick={() => {
                    void openBundle(newer.bundle, newer.origin);
                  }}
                >
                  {ui(" 打开新版 ")}
                </button>
              </div>
            )}
          </div>
          <div className="reading-toolbar">
            <div className="view-switch">
              <button
                className={view === "report" ? "active" : ""}
                onClick={() => setView("report")}
              >
                <FileText size={15} />
                {ui(" 复盘正文 ")}
              </button>
              <button
                className={view === "map" ? "active" : ""}
                onClick={() => setView("map")}
              >
                <GitBranch size={15} />
                {ui(" 决策地图 ")}
              </button>
            </div>
            <div className="path-control">
              <span>{ui("候选路径")}</span>
              <select
                aria-label={ui("候选路径")}
                value={pathId}
                onChange={(e) => switchPath(e.target.value)}
              >
                {bundle.paths.map((p) => (
                  <option key={p.path_id} value={p.path_id}>
                    {p.path_id} · {p.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="mobile-toc button subtle"
              onClick={() => setToc(!toc)}
            >
              <List size={17} />
              {ui(" 目录 ")}
            </button>
          </div>
          <div className={`reader-layout ${panel ? "with-panel" : ""}`}>
            <aside
              className={`toc ${toc ? "open" : ""}`}
              aria-label={ui("报告目录")}
            >
              <div className="toc-title">
                {ui(" 本篇复盘 ")}
                <button
                  aria-label={ui("关闭目录")}
                  onClick={() => setToc(false)}
                >
                  <X size={16} />
                </button>
              </div>
              {bundle.sections.map((s, i) => (
                <button
                  key={s.section_id}
                  onClick={() => {
                    setView("report");
                    setToc(false);
                    setTimeout(
                      () =>
                        document
                          .getElementById(`section-${s.section_id}`)
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          }),
                      40,
                    );
                  }}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </button>
              ))}
              <div className="toc-divider" />
              <p className="toc-title">{ui("研究节点")}</p>
              {path?.node_refs.map((id) => (
                <button
                  key={id}
                  className={nodeId === id ? "node-selected" : ""}
                  onClick={() => selectNode(id, true)}
                >
                  <span>{id}</span>
                  {bundle.nodes.find((n) => n.node_id === id)?.title}
                </button>
              ))}
              <div className="toc-note">
                <ShieldCheck size={17} />
                <p>
                  {ui(" 地图呈现逻辑与候选转折。 ")}
                  <br />
                  {ui(" 虚线不代表真实时间顺序。 ")}
                </p>
              </div>
            </aside>
            <main className="report-main">
              <div className="path-premise">
                <GitBranch size={17} />
                <div>
                  <strong>{path?.title}</strong>
                  <p>{path?.premise}</p>
                  <small>{path?.assumptions.join("；")}</small>
                </div>
              </div>
              {view === "map" ? (
                <section className="map-section">
                  <div className="map-heading">
                    <h2>{ui("把研究选择展开来看")}</h2>
                    <p>{ui("点击节点联动正文与详情；关系类型写在连线上。")}</p>
                  </div>
                  <div className="decision-map" data-testid="decision-map">
                    <ReactFlow
                      ariaLabelConfig={flowAria(locale)}
                      key={`${bundleKey(bundle)}:${pathId}`}
                      nodes={graphNodes}
                      edges={graphEdges}
                      onNodeClick={(_, n) => selectNode(n.id)}
                      nodesDraggable={false}
                      nodesConnectable={false}
                      edgesFocusable
                      fitView
                      fitViewOptions={{ padding: 0.22 }}
                      minZoom={0.35}
                      maxZoom={1.7}
                    >
                      <Background color="#d9dfd8" gap={22} />
                      <Controls showInteractive={false} />
                    </ReactFlow>
                  </div>
                  <div className="map-legend">
                    <span className="legend-dash" />
                    {ui(" 虚线：推断或假设关系 ")}
                    <span className="legend-solid" />
                    {ui(" 实线：来源明示的关系 ")}
                  </div>
                  <div className="map-node-list">
                    {path?.node_refs.map((id) => (
                      <button key={id} onClick={() => selectNode(id, true)}>
                        {id} ·{" "}
                        {bundle.nodes.find((n) => n.node_id === id)?.title}
                        <ArrowRight size={14} />
                      </button>
                    ))}
                  </div>
                </section>
              ) : (
                <>
                  <div className="report-intro">
                    <span className="eyebrow">RECONSTRUCT, WITH EVIDENCE</span>
                    <p>
                      {ui(
                        " 这是一份有条件的研究复盘。原文明示、有依据的推断与学习用假设分别标记；点击段落下方的主张，查看具体支持范围。 ",
                      )}
                    </p>
                    <div className="status-legend">
                      <span className="status-badge explicit">
                        <span />
                        {ui(" 原文明示 ")}
                      </span>
                      <span className="status-badge inferred">
                        <span />
                        {ui(" 有依据推断 ")}
                      </span>
                      <span className="status-badge hypothetical">
                        <span />
                        {ui(" 探索性假设 ")}
                      </span>
                    </div>
                  </div>
                  {bundle.sections.map((s, i) => (
                    <section
                      className="report-section"
                      id={`section-${s.section_id}`}
                      key={s.section_id}
                    >
                      <div className="report-section-heading">
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <h2>{s.title}</h2>
                      </div>
                      {s.blocks.map((b) => (
                        <div
                          className={`report-block ${blockId === b.block_id ? "block-selected" : ""}`}
                          id={`block-${b.block_id}`}
                          key={b.block_id}
                        >
                          <Markdown text={b.markdown} />
                          <div className="block-actions">
                            {b.claim_refs.length > 0 && (
                              <button
                                className="evidence-trigger"
                                onClick={() => inspectBlock(b.block_id)}
                              >
                                <LinkIcon size={12} />
                                <span>
                                  {locale === "en"
                                    ? `${b.claim_refs.length} claim${b.claim_refs.length === 1 ? "" : "s"} and evidence`
                                    : `${b.claim_refs.length} 项主张与依据`}
                                </span>
                                <ArrowRight size={12} />
                              </button>
                            )}
                            {b.node_refs
                              .filter((id) => path?.node_refs.includes(id))
                              .map((id) => (
                                <button
                                  className="node-chip"
                                  key={id}
                                  onClick={() => selectNode(id)}
                                >
                                  <GitBranch size={12} />
                                  {id}
                                  <ArrowRight size={12} />
                                </button>
                              ))}
                          </div>
                        </div>
                      ))}
                    </section>
                  ))}
                </>
              )}
              <section className="limitations" id="limitations">
                <div className="eyebrow">SOURCES & LIMITATIONS</div>
                <h2>{ui("来源与未决之处")}</h2>
                <ul>
                  {bundle.limitations.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
                <div className="source-list">
                  {bundle.sources.map((s) => (
                    <div className="source-row" key={s.source_id}>
                      <span>{s.source_id}</span>
                      <div>
                        <strong>{s.title}</strong>
                        <small>
                          {s.version} ·{" "}
                          {s.read_status === "read"
                            ? ui("已读取")
                            : s.read_status === "partial"
                              ? ui("部分读取")
                              : ui("无法获取")}
                        </small>
                        <p>{s.availability_note}</p>
                      </div>
                      {safeUrl(s.url) && (
                        <a
                          aria-label={`${ui("打开来源")} ${s.source_id}`}
                          href={safeUrl(s.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ArrowRight size={17} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                <details className="execution-details">
                  <summary>{ui("执行与格式记录")}</summary>
                  <p>
                    {ui(" 分析 ")}
                    {bundle.analysis_id} v{bundle.analysis_version}{" "}
                    {ui(" · 格式")} {bundle.schema_version} {ui(" · 流程 ")}
                    {bundle.workflow_version}
                  </p>
                  <p>
                    {bundle.provenance.model ?? ui("模型未知")} ·{" "}
                    {bundle.provenance.generated_at ?? ui("生成时间未知")}
                  </p>
                  <p>{bundle.provenance.usage.note}</p>
                  <p>
                    {ui(" 附带：")}
                    {bundle.manifest.included.join("；")}
                    {ui("。外部： ")}
                    {bundle.manifest.external.join("；")}。
                  </p>
                </details>
              </section>
              <footer className="report-footer">
                <span>{ui("每个结论，都留一条回到证据的路。")}</span>
                <button
                  onClick={() => setView(view === "report" ? "map" : "report")}
                >
                  {view === "report" ? ui("查看决策地图") : ui("返回复盘正文")}
                  <ArrowRight size={15} />
                </button>
              </footer>
            </main>
            {panel && (
              <>
                <button
                  className="panel-backdrop"
                  aria-label={ui("关闭详情")}
                  onClick={() => setPanel(null)}
                />
                <aside
                  className="detail-panel"
                  aria-label={
                    panel === "node" ? ui("节点详情") : ui("证据详情")
                  }
                >
                  <div className="panel-top">
                    <span>
                      {panel === "node" ? (
                        <>
                          <GitBranch size={15} />
                          {ui(" 研究节点 ")}
                        </>
                      ) : (
                        <>
                          <LinkIcon size={15} />
                          {ui(" 主张与证据 ")}
                        </>
                      )}
                    </span>
                    <button
                      aria-label={ui("关闭详情面板")}
                      onClick={() => setPanel(null)}
                    >
                      <PanelRightClose size={17} />
                    </button>
                  </div>
                  {panel === "node" && node ? (
                    <>
                      <div className="node-title">
                        <span className="eyebrow">
                          {node.node_id} · {pathId} · v{bundle.analysis_version}
                        </span>
                        <h2>{node.title}</h2>
                        <p>{node.question}</p>
                      </div>
                      <div className="panel-tabs">
                        <button className="active">{ui("决策条件")}</button>
                        <button
                          onClick={() => {
                            setBlockId(null);
                            setClaimId(node.claim_refs[0] ?? null);
                            setPanel("evidence");
                          }}
                        >
                          {ui(" 相关证据 ")}
                          <ArrowRight size={12} />
                        </button>
                      </div>
                      <div className="panel-content">
                        <h3>{ui("这条路径中，可能已知")}</h3>
                        {node.path_contexts
                          .filter((c) => c.path_id === pathId)
                          .map((c) => (
                            <div key={c.path_id}>
                              <ul>
                                {c.known_information.map((k, i) => (
                                  <li key={i}>{k.text}</li>
                                ))}
                              </ul>
                              <p className="muted-small">
                                {c.assumptions.join("；")}
                              </p>
                            </div>
                          ))}
                        <h3>{ui("仍然未知")}</h3>
                        <ul>
                          {node.uncertainties.map((u, i) => (
                            <li key={i}>{u}</li>
                          ))}
                        </ul>
                        <h3>{ui("有哪些可选行动")}</h3>
                        <div className="options">
                          {node.options.map((o, i) => (
                            <div key={o.option_id}>
                              <span>{String.fromCharCode(65 + i)}</span>
                              <div>
                                <strong>{o.label}</strong>
                                <p>{o.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="muted-small">
                          {ui(
                            " 选项与检验的主张性质请查看“相关证据”；未报告的行动不能视为作者经历。 ",
                          )}
                        </p>
                        <h3>{ui("什么观察，会改变判断")}</h3>
                        {node.discriminating_tests.map((t) => (
                          <div className="test-card" key={t.test_id}>
                            <strong>{t.question}</strong>
                            <p>{t.method}</p>
                            {t.outcomes.map((o, i) => (
                              <div className="outcome" key={i}>
                                <span>{ui("如果")}</span>
                                <strong>{o.observation}</strong>
                                <p>
                                  <ArrowRight size={12} />
                                  {o.next_action}
                                </p>
                              </div>
                            ))}
                          </div>
                        ))}
                        <h3>{ui("与最终论文的联系")}</h3>
                        <p>{node.paper_connection}</p>
                        <h3>{ui("带走一个判断")}</h3>
                        {node.transfer_lessons.map((l) => (
                          <div className="lesson" key={l.lesson_id}>
                            <p>
                              <b>{ui("适用情境")}</b>
                              {l.context}
                            </p>
                            <p>
                              <b>{ui("先区分")}</b>
                              {l.distinguish}
                            </p>
                            <p>
                              <b>{ui("下一步")}</b>
                              {l.action}
                            </p>
                            <p>
                              <b>{ui("边界")}</b>
                              {l.boundary}
                            </p>
                          </div>
                        ))}
                        <div className="discuss-form">
                          <h3>
                            <MessageSquare size={15} />
                            {ui(" 继续讨论这个节点 ")}
                          </h3>
                          <label htmlFor="question">
                            {ui("带回 Codex 的问题")}
                          </label>
                          <textarea
                            id="question"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            rows={3}
                          />
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={participatory}
                              onChange={(e) =>
                                setParticipatory(e.target.checked)
                              }
                            />
                            {ui(" 我想先自己判断下一步 ")}
                          </label>
                          <button
                            className="button primary full"
                            onClick={makeDiscussion}
                          >
                            <Copy size={14} />
                            {ui(" 准备节点与提问上下文 ")}
                          </button>
                          <small>
                            {ui("复制后回到 Codex 提问；这里不调用模型。")}
                          </small>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="panel-content evidence-content">
                      <p className="muted-small">
                        {ui(
                          " 每项主张独立核查。存在引用，不代表引用支持所有解释。 ",
                        )}
                      </p>
                      <div className="claim-picker">
                        {selectedClaims.map((c) => (
                          <button
                            className={claimId === c.claim_id ? "active" : ""}
                            key={c.claim_id}
                            onClick={() => setClaimId(c.claim_id)}
                          >
                            <StatusBadge claim={c} />
                            <p>{c.text}</p>
                          </button>
                        ))}
                      </div>
                      {claim && (
                        <>
                          <div className="claim-detail">
                            <span className="eyebrow">{claim.claim_id}</span>
                            <StatusBadge claim={claim} />
                            <h3>{claim.text}</h3>
                          </div>
                          {claim.evidence_links.length ? (
                            claim.evidence_links.map((l, i) => {
                              const e = bundle.evidence.find(
                                (e) => e.evidence_id === l.evidence_id,
                              )!;
                              return (
                                <EvidenceCard
                                  key={`${e.evidence_id}-${i}`}
                                  evidence={e}
                                  bundle={bundle}
                                  relation={l.relation}
                                  scope={l.scope_note}
                                />
                              );
                            })
                          ) : (
                            <p className="no-evidence">
                              {ui(
                                " 这项内容是供讨论的条件化假设，没有来源证明它发生过。 ",
                              )}
                            </p>
                          )}
                          {claim.assumptions.length > 0 && (
                            <>
                              <h3>{ui("必要前提")}</h3>
                              <ul>
                                {claim.assumptions.map((a, i) => (
                                  <li key={i}>{a}</li>
                                ))}
                              </ul>
                            </>
                          )}
                          {claim.alternatives.length > 0 && (
                            <>
                              <h3>{ui("竞争解释")}</h3>
                              <ul>
                                {claim.alternatives.map((a, i) => (
                                  <li key={i}>{a}</li>
                                ))}
                              </ul>
                            </>
                          )}
                          {node && (
                            <button
                              className="button outline full"
                              onClick={() => setPanel("node")}
                            >
                              {ui(" 返回 ")}
                              {node.node_id} {ui(" 继续讨论 ")}
                              <ArrowRight size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </aside>
              </>
            )}
          </div>
        </>
      )}
      {guide && (
        <Modal
          title={tr("使用指南", "Usage guide")}
          onClose={() => setGuide(false)}
          wide
        >
          <UsageGuide />
        </Modal>
      )}
      {help && (
        <Modal
          title={ui("这份复盘，怎样阅读？")}
          onClose={() => setHelp(false)}
        >
          <p>
            {ui(
              " 从论文结论重建候选的研究选择，是为了学习下一步如何判断。没有公开记录的过程，始终保留为推断或学习用假设。 ",
            )}
          </p>
          <h3>{ui("先读完整解释，再核查关键判断")}</h3>
          <p>
            {ui(
              " 正文提供连贯复盘；决策地图负责定位。点击“主张与依据”查看事实、前提、竞争解释和支持范围。逻辑顺序不等于研发日程。 ",
            )}
          </p>
          <h3>{ui("把问题带回 Codex")}</h3>
          <p>
            {ui(
              " 在节点详情中填写问题，复制或下载上下文。使用 paper-reconstruction Skill 继续讨论；采纳修订后导入新版本，旧版继续保留。 ",
            )}
          </p>
          <h3>{ui("你的数据保存在这里")}</h3>
          <p>
            {ui(
              " 阅读器在浏览器内处理文件，不上传分析，不调用模型。浏览器数据清理会删除本地记录，请用 JSON 导出长期保存；在线站点的托管访问记录由 GitHub 管理。 ",
            )}
          </p>
          <h3>{ui("当前验证范围")}</h3>
          <p>
            {ui(
              " 三个跨学科案例用于验证流程；未验证所有学科，也未测得作者真实经历的还原准确率。来源明说不等于独立复现，执行者自查不等于人类审查。 ",
            )}
          </p>
        </Modal>
      )}
      {library && (
        <Modal
          title={ui("保存在此浏览器的记录")}
          onClose={() => setLibrary(false)}
        >
          <p className="muted-small">
            {ui(
              " 示例与导入结果按分析版本保存。删除只影响此浏览器；导出文件仍由你保留。 ",
            )}
          </p>
          {saved.length ? (
            saved.map((s) => (
              <div className="saved-row" key={s.key}>
                <button
                  onClick={() => {
                    void openBundle(s.bundle, s.origin).catch((e) =>
                      setError(e.message),
                    );
                  }}
                >
                  <span>
                    {s.origin === "example" ? ui("示例") : ui("导入")} · v
                    {s.bundle.analysis_version}
                  </span>
                  <strong>
                    <SavedTitle record={s} />
                  </strong>
                  <small>{s.bundle.analysis_id}</small>
                </button>
                <button
                  aria-label={`${ui("删除")} ${s.key}`}
                  onClick={async () => {
                    try {
                      await deleteSaved(s.key);
                      await refreshSaved();
                      if (
                        (collection ?? bundle) &&
                        bundleKey((collection ?? bundle)!) === s.key
                      ) {
                        setBundle(null);
                        setCollection(null);
                        setPanel(null);
                      }
                    } catch {
                      setError("删除失败，浏览器存储不可用。");
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <Library size={30} />
              <p>{ui("还没有保存的复盘。")}</p>
              <button
                className="button outline"
                onClick={() => input.current?.click()}
              >
                {tr("导入分析 JSON", "Import analysis JSON")}
              </button>
            </div>
          )}
        </Modal>
      )}
      {discussion && bundle && node && (
        <Modal
          title={ui("把这个节点带回 Codex")}
          wide
          onClose={() => setDiscussion(null)}
        >
          <p>
            {ui(" 包含 ")}
            {pathId} {ui(" 的条件、")}
            {node.node_id} {ui(" 的主张与证据，绑定分析 v ")}
            {bundle.analysis_version}
            {ui("。不包含完整论文。 ")}
          </p>
          <div className="discussion-actions">
            <button
              className="button primary"
              onClick={() => {
                void copyDiscussion();
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? ui("已复制") : ui("复制全部上下文")}
            </button>
            <button
              className="button outline"
              onClick={() =>
                download(
                  `${bundle.analysis_id}-v${bundle.analysis_version}-${pathId}-${node.node_id}.json`,
                  JSON.stringify(
                    createDiscussion(
                      rawBundle!,
                      pathId,
                      node.node_id,
                      question,
                      participatory ? "participatory" : "direct",
                    ),
                    null,
                    2,
                  ),
                )
              }
            >
              <ArrowDownToLine size={15} />
              {ui(" 下载讨论包 ")}
            </button>
            <button
              className="button subtle"
              onClick={() =>
                download(
                  `${bundle.analysis_id}-${node.node_id}-context.md`,
                  discussion,
                  "text/markdown",
                )
              }
            >
              {ui(" 下载可粘贴文本 ")}
            </button>
          </div>
          <label htmlFor="discussion-context" className="muted-small">
            {ui(" 自动复制不可用时，可手动选择并复制以下全文。 ")}
          </label>
          <textarea
            id="discussion-context"
            className="discussion-context"
            readOnly
            value={discussion}
            onFocus={(e) => e.currentTarget.select()}
          />
        </Modal>
      )}
    </>
  );
}

function EvidenceCard({
  evidence: e,
  bundle,
  relation,
  scope,
}: {
  evidence: Evidence;
  bundle: AnalysisBundle;
  relation: keyof typeof relationLabels;
  scope: string;
}) {
  const source = bundle.sources.find((s) => s.source_id === e.source_id)!;
  return (
    <div className="evidence-card">
      <div className="evidence-meta">
        <span>
          {e.evidence_id} · {source.source_id}
        </span>
        <b>{ui(relationLabels[relation])}</b>
      </div>
      <h4>{source.title}</h4>
      <p className="locator">{uiLocator(e)}</p>
      <div className="evidence-checks">
        <span>
          {ui(" 来源： ")}
          {source.read_status === "unavailable"
            ? ui("无法获取")
            : ui("已读取相应范围")}
        </span>
        <span>
          {ui(" 定位： ")}
          {e.verification_status === "source_checked"
            ? ui("已核查")
            : ui("未核实")}
        </span>
      </div>
      {e.quote && <blockquote>{e.quote}</blockquote>}
      <p>
        <span className="field-label">{ui("证据释义")}</span>
        {e.paraphrase}
      </p>
      <p>
        <span className="field-label">{ui("证据范围")}</span>
        {e.scope}
      </p>
      <p>
        <span className="field-label">{ui("当前关系")}</span>
        {scope}
      </p>
      <small>
        {ui(" 类型： ")}
        {
          {
            reported_result: ui("作者报告结果"),
            author_interpretation: ui("作者解释"),
            historical_account: ui("公开历史回顾"),
            independent_check: ui("独立核查"),
            theoretical_argument: ui("理论论证"),
          }[e.evidence_type]
        }
      </small>
      {safeUrl(source.url) && (
        <a
          className="source-link"
          href={safeUrl(source.url)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {ui(" 打开原始来源 ")}
          <ArrowRight size={13} />
        </a>
      )}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
      old?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const list = Array.from(
            ref.current?.querySelectorAll<HTMLElement>(
              'button, input, textarea, select, a[href], [tabindex="0"]',
            ) ?? [],
          ).filter((x) => !x.hasAttribute("disabled"));
          const first = list[0],
            last = list[list.length - 1];
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === ref.current)
          ) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button aria-label={ui("关闭对话框")} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <LocaleProvider>
    <App />
  </LocaleProvider>,
);
