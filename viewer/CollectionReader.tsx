import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Node,
  type Edge,
  Handle,
  Position,
  useReactFlow,
} from "@xyflow/react";
import { X, Download, Copy, ArrowRight, BookOpen } from "lucide-react";
import type {
  CollectionAnalysisBundle as Bundle,
  CollectionDiscussionContext,
} from "../core/collection-schema";
import { relationshipLabels } from "../core/collection-schema";
import {
  createCollectionDiscussion,
  collectionDiscussionMarkdown,
  exportCollectionMarkdown,
} from "../core/collection";
import {
  safeUrl,
  epistemicLabels,
  relationLabels,
  locatorText,
  edgeLabels,
} from "../core/export";
import { bundleKey, loadReading, saveReading } from "./storage";
import "./collection.css";
type Target = { kind: "node" | "relation" | "block" | "paper"; id: string };
const views = [
  ["report", "联合正文"],
  ["cards", "单篇证据卡"],
  ["compare", "比较表"],
  ["relations", "论文关系图"],
  ["decisions", "决策地图"],
] as const;
function PaperMapNode({ data }: { data: { label: string } }) {
  return (
    <>
      <Handle id="top-in" type="target" position={Position.Top} />
      <Handle id="top-out" type="source" position={Position.Top} />
      <Handle id="bottom-in" type="target" position={Position.Bottom} />
      <Handle id="bottom-out" type="source" position={Position.Bottom} />
      <span>{data.label}</span>
    </>
  );
}
const nodeTypes = { paper: PaperMapNode };
function FitMap({ signature }: { signature: string }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const fit = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => void fitView({ padding: 0.3, maxZoom: 1.2 }),
        60,
      );
    };
    const element = document.querySelector(".collection-map");
    const observer = new ResizeObserver(fit);
    if (element) observer.observe(element);
    fit();
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [fitView, signature]);
  return null;
}
function Text({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      disallowedElements={["img"]}
      components={{
        a: ({ href, children }) =>
          safeUrl(href ?? null) ? (
            <a
              href={safeUrl(href ?? null)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ) : (
            <span>{children}</span>
          ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function CollectionReader({
  bundle: b,
  onStorageError,
}: {
  bundle: Bundle;
  onStorageError: () => void;
}) {
  const [view, setView] = useState<string>("report"),
    [paperFilter, setPaperFilter] = useState(""),
    [clusterFilter, setClusterFilter] = useState(""),
    [relationFilter, setRelationFilter] = useState("");
  const [pathId, setPathId] = useState(b.paths[0].path_id),
    [target, setTarget] = useState<Target | null>(null),
    [question, setQuestion] = useState(
      "这条跨论文推断的证据够吗？有哪些竞争解释？",
    ),
    [participatory, setParticipatory] = useState(false);
  const [discussion, setDiscussion] =
      useState<CollectionDiscussionContext | null>(null),
    [copyStatus, setCopyStatus] = useState(""),
    [localError, setLocalError] = useState("");
  const [restored, setRestored] = useState(false);
  const restoration = useRef(false);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const key = bundleKey(b),
    path = b.paths.find((p) => p.path_id === pathId) ?? b.paths[0];
  useEffect(() => {
    let alive = true;
    void loadReading(key)
      .then((s) => {
        if (!alive) return;
        if (s) {
          if (b.paths.some((p) => p.path_id === s.pathId)) setPathId(s.pathId);
          const c = s.collection;
          if (c) {
            if (views.some((v) => v[0] === c.view)) setView(c.view);
            setPaperFilter(
              b.papers.some((p) => p.paper_id === c.paperFilter)
                ? c.paperFilter
                : "",
            );
            setClusterFilter(
              b.clusters.some((k) => k.cluster_id === c.clusterFilter)
                ? c.clusterFilter
                : "",
            );
            setRelationFilter(c.relationFilter);
            setTarget(c.target ?? null);
          }
          restoration.current = true;
          setTimeout(() => {
            if (alive) {
              window.scrollTo(0, s.scrollY);
              restoration.current = false;
              setRestored(true);
            }
          }, 100);
        } else {
          window.scrollTo(0, 0);
        }
      })
      .catch(onStorageError)
      .finally(() => {
        if (alive && !restoration.current) setRestored(true);
      });
    return () => {
      alive = false;
    };
  }, [key]);
  useEffect(() => {
    if (!restored) return;
    let timer: ReturnType<typeof setTimeout>;
    const write = () => {
      if (restoration.current) return;
      void saveReading(key, {
        pathId,
        nodeId: target?.kind === "node" ? target.id : null,
        blockId: target?.kind === "block" ? target.id : null,
        scrollY: window.scrollY,
        collection: {
          view,
          paperFilter,
          clusterFilter,
          relationFilter,
          target,
        },
      }).catch(onStorageError);
    };
    const persist = () => {
      clearTimeout(timer);
      timer = setTimeout(write, 180);
    };
    // Persist explicit choices immediately; a long smooth scroll must not delay them.
    write();
    window.addEventListener("scroll", persist, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", persist);
    };
  }, [
    key,
    restored,
    view,
    paperFilter,
    clusterFilter,
    relationFilter,
    pathId,
    target,
  ]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTarget(null);
        setDiscussion(null);
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const cluster = b.clusters.find((c) => c.cluster_id === clusterFilter);
  const matches = (ids: string[]) =>
    ids.some(
      (id) =>
        (!paperFilter || id === paperFilter) &&
        (!cluster || cluster.paper_refs.includes(id)),
    );
  const relationMatches = (id: string) => {
    const r = b.relations.find((r) => r.relation_id === id);
    return (
      !!r &&
      (!relationFilter || r.kind === relationFilter) &&
      matches([r.from_paper_id, r.to_paper_id])
    );
  };
  const filters = !!(paperFilter || clusterFilter || relationFilter);
  const filteredRelations = b.relations.filter((r) =>
    relationMatches(r.relation_id),
  );
  const relationPaperIds = new Set(
    filteredRelations.flatMap((r) => [r.from_paper_id, r.to_paper_id]),
  );
  const mapPapers = b.papers.filter(
    (p) => matches([p.paper_id]) || relationPaperIds.has(p.paper_id),
  );
  const graphNodes: Node[] =
    view === "relations"
      ? mapPapers.map((p, i) => ({
          id: p.paper_id,
          position: { x: (i % 3) * 500, y: Math.floor(i / 3) * 260 },
          data: {
            label: `${p.paper_id} · ${p.title}\n${b.sources.find((s) => s.kind === "paper" && s.paper_refs.includes(p.paper_id))?.published_at?.match(/^\d{4}/)?.[0] ?? "年份未记录"} · ${p.version}\n${
              b.clusters
                .filter((c) => c.paper_refs.includes(p.paper_id))
                .map((c) => c.title)
                .join(" / ") || "未归簇"
            }`,
          },
          type: "paper",
          selected: target?.kind === "paper" && target.id === p.paper_id,
        }))
      : path.node_refs
          .filter((id) =>
            matches(b.nodes.find((n) => n.node_id === id)!.paper_refs),
          )
          .map((id, i) => ({
            id,
            position: { x: (i % 2) * 350, y: i * 145 },
            data: {
              label: `${id} · ${b.nodes.find((n) => n.node_id === id)!.title}`,
            },
            selected: target?.kind === "node" && target.id === id,
          }));
  const graphEdges: Edge[] =
    view === "relations"
      ? filteredRelations.map((r, i) => ({
          id: r.relation_id,
          source: r.from_paper_id,
          target: r.to_paper_id,
          label: r.label,
          type: "smoothstep",
          sourceHandle: i % 2 ? "bottom-out" : "top-out",
          targetHandle: i % 2 ? "bottom-in" : "top-in",
          pathOptions: { offset: 50 + Math.floor(i / 2) * 35 },
          markerEnd: r.directed ? { type: MarkerType.ArrowClosed } : undefined,
          style: {
            strokeDasharray:
              r.epistemic_status === "explicit" ? undefined : "6 4",
          },
        }))
      : b.edges
          .filter(
            (e) =>
              path.edge_refs.includes(e.edge_id) &&
              graphNodes.some((n) => n.id === e.source_node_id) &&
              graphNodes.some((n) => n.id === e.target_node_id),
          )
          .map((e) => ({
            id: e.edge_id,
            source: e.source_node_id,
            target: e.target_node_id,
            label: `${edgeLabels[e.relation_type]} · ${e.label}`,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: {
              strokeDasharray:
                e.epistemic_status === "explicit" ? undefined : "6 4",
            },
          }));
  const selectedNode =
    target?.kind === "node"
      ? b.nodes.find((n) => n.node_id === target.id)
      : null;
  const selectedRelation =
    target?.kind === "relation"
      ? b.relations.find((r) => r.relation_id === target.id)
      : null;
  const selectedBlock =
    target?.kind === "block"
      ? b.sections
          .flatMap((s) => s.blocks)
          .find((x) => x.block_id === target.id)
      : null;
  const selectedPaper =
    target?.kind === "paper"
      ? b.papers.find((p) => p.paper_id === target.id)
      : null;
  const selectedCard = selectedPaper
    ? b.paper_cards.find((c) => c.paper_id === selectedPaper.paper_id)
    : null;
  const claimIds = new Set(
    selectedNode?.claim_refs ??
      selectedRelation?.claim_refs ??
      selectedBlock?.claim_refs ??
      b.claims
        .filter(
          (c) => selectedPaper && c.paper_refs.includes(selectedPaper.paper_id),
        )
        .map((c) => c.claim_id),
  );
  const selectedClaims = b.claims.filter((c) => claimIds.has(c.claim_id));
  const evidenceIds = new Set([
    ...selectedClaims.flatMap((c) =>
      c.evidence_links.map((l) => l.evidence_id),
    ),
    ...(selectedRelation?.evidence_refs ??
      selectedBlock?.evidence_refs ??
      selectedCard?.evidence_refs ??
      []),
  ]);
  const show = (t: Target) => {
    setTarget(t);
    setDiscussion(null);
    setCopyStatus("");
    setLocalError("");
  };
  const jumpToTarget = () => {
    const block = b.sections
      .flatMap((s) => s.blocks)
      .find((x) =>
        selectedNode
          ? x.node_refs.includes(selectedNode.node_id)
          : selectedRelation
            ? x.relation_refs.includes(selectedRelation.relation_id)
            : x.block_id === selectedBlock?.block_id,
      );
    if (block) {
      setView("report");
      setTimeout(
        () =>
          document
            .getElementById(`collection-${block.block_id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
        80,
      );
    }
  };
  const prepare = () => {
    try {
      const t: CollectionDiscussionContext["target"] = selectedNode
        ? { kind: "node", path_id: pathId, node_id: selectedNode.node_id }
        : { kind: "relation", relation_id: selectedRelation!.relation_id };
      setDiscussion(
        createCollectionDiscussion(
          b,
          t,
          question,
          participatory ? "participatory" : "direct",
        ),
      );
      setCopyStatus("");
      setLocalError("");
    } catch (e) {
      setLocalError((e as Error).message);
    }
  };
  return (
    <main
      className={`collection-shell ${target ? "collection-with-panel" : ""}`}
    >
      <div className="collection-heading">
        <p className="eyebrow">
          多篇联合复盘 · {b.papers.length} 篇 · v{b.analysis_version} ·{" "}
          {b.status === "complete" ? "完整结果" : "部分结果"}
        </p>
        <h1>{b.collection.title}</h1>
        <p>{b.collection.goal}</p>
        <p className="muted-small">组织线索：{b.collection.user_clue}</p>
        {b.revision && (
          <p className="revision-note">
            由 v{b.revision.previous_version} 修订：{b.revision.change_reason}
          </p>
        )}
        {b.collection.derived_from && (
          <p>
            派生自 {b.collection.derived_from.analysis_id} v
            {b.collection.derived_from.analysis_version}，论文范围已重新登记。
          </p>
        )}
        <div className="collection-actions">
          <button
            className="button outline"
            onClick={() =>
              download(
                `${b.analysis_id}-v${b.analysis_version}.json`,
                JSON.stringify(b, null, 2),
              )
            }
          >
            <Download size={15} />
            导出联合 JSON
          </button>
          <button
            className="button outline"
            onClick={() =>
              download(
                `${b.analysis_id}-v${b.analysis_version}.md`,
                exportCollectionMarkdown(b),
                "text/markdown",
              )
            }
          >
            <BookOpen size={15} />
            导出阅读版
          </button>
        </div>
      </div>
      <nav className="collection-tabs" aria-label="联合分析视图">
        {views.map(([id, label]) => (
          <button
            key={id}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="collection-filters">
        <label>
          论文
          <select
            aria-label="筛选论文"
            value={paperFilter}
            onChange={(e) => setPaperFilter(e.target.value)}
          >
            <option value="">全部论文</option>
            {b.papers.map((p) => (
              <option key={p.paper_id} value={p.paper_id}>
                {p.paper_id} · {p.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          研究簇
          <select
            aria-label="筛选研究簇"
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
          >
            <option value="">全部研究簇</option>
            {b.clusters.map((c) => (
              <option key={c.cluster_id} value={c.cluster_id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          关系
          <select
            aria-label="筛选关系类型"
            value={relationFilter}
            onChange={(e) => setRelationFilter(e.target.value)}
          >
            <option value="">全部关系</option>
            {Object.entries(relationshipLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button subtle"
          onClick={() => {
            setPaperFilter("");
            setClusterFilter("");
            setRelationFilter("");
          }}
        >
          清除筛选
        </button>
      </div>
      <p className="collection-filter-note">
        筛选用于定位与高亮；联合正文始终保留全部内容和原结论。
      </p>
      {(view === "report" || view === "decisions") && (
        <label className="collection-path">
          候选路径
          <select
            aria-label="联合分析路径"
            value={pathId}
            onChange={(e) => {
              setPathId(e.target.value);
              setTarget(null);
              setDiscussion(null);
            }}
          >
            {b.paths.map((p) => (
              <option key={p.path_id} value={p.path_id}>
                {p.title}
              </option>
            ))}
          </select>
          <span>
            {path.perspective === "retrospective" ? "事后比较" : "候选形成路径"}
            ：{path.premise}
          </span>
        </label>
      )}
      <div className="collection-body">
        {view === "report" && (
          <>
            <nav className="collection-toc" aria-label="联合报告目录">
              {b.sections.map((s) => (
                <a
                  key={s.section_id}
                  href={`#collection-section-${s.section_id}`}
                >
                  {s.title}
                </a>
              ))}
            </nav>
            {b.sections.map((s) => (
              <section
                className="collection-section"
                key={s.section_id}
                id={`collection-section-${s.section_id}`}
              >
                <h2>{s.title}</h2>
                {s.blocks.map((block) => (
                  <article
                    id={`collection-${block.block_id}`}
                    key={block.block_id}
                    className={`collection-block ${filters && matches(block.paper_refs) && (!relationFilter || block.relation_refs.some(relationMatches)) ? "filter-match" : ""}`}
                  >
                    <Text text={block.markdown} />
                    <div className="collection-tags">
                      <span>{block.paper_refs.join(" · ")}</span>
                      <button
                        onClick={() =>
                          show({ kind: "block", id: block.block_id })
                        }
                      >
                        主张与依据（{block.claim_refs.length}）
                      </button>
                      {block.node_refs
                        .filter((id) => path.node_refs.includes(id))
                        .map((id) => (
                          <button
                            key={id}
                            onClick={() => show({ kind: "node", id })}
                          >
                            {b.nodes.find((n) => n.node_id === id)!.title}
                          </button>
                        ))}
                      {block.relation_refs.map((id) => (
                        <button
                          key={id}
                          onClick={() => show({ kind: "relation", id })}
                        >
                          关系 {id}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </section>
            ))}
          </>
        )}
        {view === "cards" && (
          <section className="collection-section">
            <h2>单篇证据卡</h2>
            {b.papers.map((p) => {
              const c = b.paper_cards.find((c) => c.paper_id === p.paper_id)!;
              return (
                <details
                  key={p.paper_id}
                  className={`paper-card ${filters && matches([p.paper_id]) ? "filter-match" : ""}`}
                >
                  <summary>
                    {p.paper_id} · {p.title}{" "}
                    <small>
                      {p.read_status === "read" ? "已读" : "材料不全"} ·{" "}
                      {p.origin === "provided" ? "用户提供" : "确认补充"}
                    </small>
                  </summary>
                  <p>
                    {p.authors.join(" · ")} · {p.version}
                  </p>
                  <p>{p.material_note}</p>
                  {(
                    [
                      ["核心问题", [c.question]],
                      ["条件", c.conditions],
                      ["假设", c.assumptions],
                      ["选择", c.choices],
                      ["判别证据", c.discriminating_evidence],
                      ["结论", c.findings],
                    ] as const
                  ).map(([label, items]) => (
                    <div key={label}>
                      <h3>{label}</h3>
                      {items.map((s, i) => (
                        <p key={i}>
                          {s.text} <small>{s.claim_refs.join(", ")}</small>
                        </p>
                      ))}
                    </div>
                  ))}
                  <h3>局限与未决</h3>
                  <ul>
                    {[...c.limitations, ...c.open_questions].map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                  <button
                    className="button outline"
                    onClick={() => show({ kind: "paper", id: p.paper_id })}
                  >
                    核查 {p.paper_id} 的证据
                  </button>
                </details>
              );
            })}
          </section>
        )}
        {view === "compare" && (
          <section className="collection-section">
            <h2>比较与可比条件</h2>
            {b.comparisons.length === 0 ? (
              <p>当前材料不足以建立可比维度。</p>
            ) : (
              b.comparisons.map((a) => (
                <div key={a.axis_id} className="collection-comparison">
                  <h3>{a.title}</h3>
                  <p>{a.comparability}</p>
                  <div
                    className="comparison-scroll"
                    tabIndex={0}
                    aria-label={`${a.title}比较表`}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>论文</th>
                          <th>观察与判断</th>
                          <th>依据</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.cells.map((c) => (
                          <tr
                            key={c.paper_id}
                            className={
                              filters && matches([c.paper_id])
                                ? "filter-match"
                                : ""
                            }
                          >
                            <th>
                              {c.paper_id}
                              <br />
                              {
                                b.papers.find((p) => p.paper_id === c.paper_id)!
                                  .title
                              }
                            </th>
                            <td>{c.summary}</td>
                            <td>
                              <button
                                onClick={() =>
                                  show({ kind: "paper", id: c.paper_id })
                                }
                              >
                                {c.claim_refs.join(", ") || "材料说明"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </section>
        )}
        {(view === "relations" || view === "decisions") && (
          <section className="collection-section">
            <h2>
              {view === "relations" ? "论文之间的关系" : "跨论文的决策路径"}
            </h2>
            <p>虚线表示推断或假设。年份不代表影响方向；孤立节点不强行连接。</p>
            {graphNodes.length ? (
              <div className="collection-map" aria-label="联合研究地图">
                <ReactFlow
                  nodeTypes={nodeTypes}
                  key={`${view}-${pathId}`}
                  nodes={graphNodes}
                  edges={graphEdges}
                  fitView
                  nodesDraggable={false}
                  nodesConnectable={false}
                  onNodeClick={(_, n) =>
                    show({
                      kind: view === "relations" ? "paper" : "node",
                      id: n.id,
                    })
                  }
                  onEdgeClick={(_, e) => {
                    if (view === "relations")
                      show({ kind: "relation", id: e.id });
                  }}
                >
                  <Background />
                  <Controls />
                  <FitMap
                    signature={`${view}-${pathId}-${paperFilter}-${clusterFilter}-${relationFilter}`}
                  />
                </ReactFlow>
              </div>
            ) : (
              <p>当前筛选下没有节点。</p>
            )}
            {view === "relations" ? (
              <div className="collection-relation-list">
                {filteredRelations.length === 0 && (
                  <p>当前范围没有可支持的论文关系；可阅读证据卡和分析边界。</p>
                )}
                {filteredRelations.map((r) => (
                  <button
                    key={r.relation_id}
                    onClick={() =>
                      show({ kind: "relation", id: r.relation_id })
                    }
                  >
                    <strong>
                      {r.from_paper_id} {r.directed ? "→" : "—"} {r.to_paper_id}{" "}
                      · {r.label}
                    </strong>
                    <span>
                      {relationshipLabels[r.kind]} ·{" "}
                      {epistemicLabels[r.epistemic_status]}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="collection-relation-list">
                {graphNodes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => show({ kind: "node", id: n.id })}
                  >
                    {n.id} · {b.nodes.find((x) => x.node_id === n.id)!.title}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
        <section className="collection-section">
          <details className="collection-search">
            <summary>材料清单、检索与采纳记录</summary>
            <p>{b.search.note}</p>
            <p>
              检索状态：{b.search.status}；查询：
              {b.search.queries.join("；") || "未执行"}
            </p>
            <ul>
              {b.papers.map((p) => (
                <li key={p.paper_id}>
                  {p.paper_id} · {p.title} · {p.version} · {p.material_note}
                </li>
              ))}
            </ul>
            {b.search.candidates.map((c) => (
              <div key={c.candidate_id}>
                <h3>
                  {c.title} · {c.decision === "accepted" ? "已纳入" : "已拒绝"}
                </h3>
                <p>
                  {c.gap} · {c.expected_change}
                </p>
                <p>
                  {c.inspected_material}；全文：{c.full_text_status}
                </p>
                <p>
                  {c.decision_source === "simulated_test"
                    ? "测试模拟选择："
                    : "用户选择："}
                  {c.decision_record}
                </p>
                {safeUrl(c.url) && (
                  <a
                    href={safeUrl(c.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    候选论文来源
                  </a>
                )}
              </div>
            ))}
          </details>
          <h2>材料与判断边界</h2>
          <ul>
            {b.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <details>
            <summary>执行与结构信息</summary>
            <p>
              {b.analysis_id} v{b.analysis_version} · 格式 {b.schema_version} ·
              流程 {b.workflow_version}
            </p>
            <p>
              {b.provenance.model ?? "模型未知"} · {b.provenance.usage.note}
            </p>
            <p>
              语义核查：{b.validation.semantic_review}；
              {b.validation.notes.join("；")}
            </p>
          </details>
        </section>
      </div>
      {target && (
        <>
          <button
            className="collection-backdrop"
            aria-label="关闭联合详情"
            onClick={() => setTarget(null)}
          />
          <aside className="collection-detail" aria-label="联合分析详情">
            <header>
              <strong>
                {selectedNode?.title ??
                  selectedRelation?.label ??
                  selectedPaper?.title ??
                  "主张与依据"}
              </strong>
              <button
                aria-label="关闭联合详情面板"
                onClick={() => setTarget(null)}
              >
                <X size={20} />
              </button>
            </header>
            <div className="collection-detail-body">
              {(selectedNode || selectedRelation || selectedBlock) && (
                <button className="text-button" onClick={jumpToTarget}>
                  定位相关正文 <ArrowRight size={14} />
                </button>
              )}
              {selectedRelation && (
                <>
                  <p>
                    {relationshipLabels[selectedRelation.kind]} ·{" "}
                    {epistemicLabels[selectedRelation.epistemic_status]}
                  </p>
                  <p>{selectedRelation.explanation}</p>
                </>
              )}
              {selectedNode && (
                <>
                  <h3>当前路径已知条件</h3>
                  {selectedNode.path_contexts
                    .filter((c) => c.path_id === pathId)
                    .map((c) => (
                      <div key={c.path_id}>
                        <ul>
                          {c.known_information.map((k, i) => (
                            <li key={i}>{k.text}</li>
                          ))}
                        </ul>
                        <p>{c.assumptions.join("；")}</p>
                      </div>
                    ))}
                  <h3>仍然未知</h3>
                  <ul>
                    {selectedNode.uncertainties.map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                  <h3>可选行动</h3>
                  {selectedNode.options.map((o) => (
                    <p key={o.option_id}>
                      <strong>{o.label}</strong>：{o.description}
                    </p>
                  ))}
                  <h3>怎样改变判断</h3>
                  {selectedNode.discriminating_tests.map((t) => (
                    <div className="test-card" key={t.test_id}>
                      <strong>{t.question}</strong>
                      <p>{t.method}</p>
                      {t.outcomes.map((o, i) => (
                        <p className="outcome" key={i}>
                          如果 {o.observation} → {o.next_action}
                        </p>
                      ))}
                    </div>
                  ))}
                  <h3>迁移条件</h3>
                  {selectedNode.transfer_lessons.map((l) => (
                    <p key={l.lesson_id}>
                      {l.context} → {l.distinguish} → {l.action}
                      <br />
                      边界：{l.boundary}
                    </p>
                  ))}
                </>
              )}
              <h3>主张与支持范围</h3>
              {selectedClaims.map((c) => (
                <div className="collection-claim" key={c.claim_id}>
                  <span className={`status-badge ${c.epistemic_status}`}>
                    {epistemicLabels[c.epistemic_status]}
                  </span>
                  <p>
                    {c.claim_id} · {c.text}
                  </p>
                  <p>涉及论文：{c.paper_refs.join(" · ")}</p>
                  {c.evidence_links.map((l) => (
                    <p key={l.evidence_id}>
                      {l.evidence_id} · {relationLabels[l.relation]}：
                      {l.scope_note}
                    </p>
                  ))}
                  {c.assumptions.length > 0 && (
                    <p>前提：{c.assumptions.join("；")}</p>
                  )}
                  {c.alternatives.length > 0 && (
                    <p>竞争解释：{c.alternatives.join("；")}</p>
                  )}
                </div>
              ))}
              {b.evidence
                .filter((e) => evidenceIds.has(e.evidence_id))
                .map((e) => {
                  const s = b.sources.find((s) => s.source_id === e.source_id)!;
                  return (
                    <div className="evidence-card" key={e.evidence_id}>
                      <strong>
                        {e.evidence_id} · {s.paper_refs.join(" · ")}
                      </strong>
                      <p>
                        {s.title} · {s.version}
                      </p>
                      <p className="locator">{locatorText(e)}</p>
                      <p>{e.paraphrase}</p>
                      <p>支持范围：{e.scope}</p>
                      <small>{e.verification_status}</small>
                      {safeUrl(s.url) && (
                        <a
                          href={safeUrl(s.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          打开原始来源
                        </a>
                      )}
                    </div>
                  );
                })}
              {(selectedNode || selectedRelation) && (
                <div className="collection-discuss">
                  <h3>带回 Codex 讨论</h3>
                  <label>
                    问题
                    <textarea
                      ref={questionRef}
                      aria-label="联合分析讨论问题"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      rows={3}
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={participatory}
                      onChange={(e) => setParticipatory(e.target.checked)}
                    />
                    参与式判断
                  </label>
                  <button className="button primary" onClick={prepare}>
                    准备联合讨论上下文
                  </button>
                  {localError && <p role="alert">{localError}</p>}
                  {discussion && (
                    <>
                      <textarea
                        aria-label="联合讨论上下文"
                        className="collection-discussion-text"
                        readOnly
                        value={collectionDiscussionMarkdown(discussion)}
                      />
                      <div className="collection-actions">
                        <button
                          className="button outline"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                collectionDiscussionMarkdown(discussion),
                              );
                              setCopyStatus("已复制联合讨论上下文。");
                            } catch {
                              setCopyStatus(
                                "无法自动复制，请选中上方全文手动复制，或下载讨论包。",
                              );
                            }
                          }}
                        >
                          <Copy size={14} />
                          复制联合上下文
                        </button>
                        <button
                          className="button outline"
                          onClick={() =>
                            download(
                              `${b.analysis_id}-v${b.analysis_version}-${target.id}-discussion.json`,
                              JSON.stringify(discussion, null, 2),
                            )
                          }
                        >
                          下载联合讨论包
                        </button>
                      </div>
                      <p role="status">{copyStatus}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </main>
  );
}
