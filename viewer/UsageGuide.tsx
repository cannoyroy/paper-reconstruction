import { useState } from "react";
import { ArrowDownToLine, Copy } from "lucide-react";

export const projectLinks = {
  github: "https://github.com/cannoyroy/paper-reconstruction",
  release: "https://github.com/cannoyroy/paper-reconstruction/releases/latest",
  readme:
    "https://github.com/cannoyroy/paper-reconstruction/blob/main/README.md",
};
export const examplePrompt = `请使用 $paper-reconstruction 分析这篇论文：
https://arxiv.org/abs/1512.03385v1
生成完整研究复盘、analysis.json 和 report.md。`;

export function UsageGuide() {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">(
    "idle",
  );
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(examplePrompt);
      setCopyState("copied");
    } catch {
      setCopyState("manual");
    }
  }
  return (
    <div className="usage-guide">
      <p className="usage-summary">
        论文交给 Codex → 生成 analysis.json → 在网页导入并阅读
      </p>
      <ol className="usage-steps">
        <li>
          <span className="step-number">01</span>
          <h3>安装 Codex Skill</h3>
          <p>
            从发布页的 Assets 下载 Skill
            ZIP（paper-reconstruction-版本号.zip），解压后将{" "}
            <code>paper-reconstruction</code> 文件夹放入项目的{" "}
            <code>.agents/skills/</code>。
          </p>
          <p>需要 Codex；辅助脚本需要 Node.js 22。</p>
          <a
            className="button outline"
            href={projectLinks.release}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ArrowDownToLine size={15} />
            下载 Skill
          </a>
        </li>
        <li>
          <span className="step-number">02</span>
          <h3>把论文交给 Codex</h3>
          <p>
            提供 PDF 附件或本地路径、论文链接、粘贴正文或 TXT／Markdown
            文件，也可给出标题，先确认身份与版本。让 Skill 生成{" "}
            <code>analysis.json</code>。
          </p>
          <p>
            也可同时提供多篇。Skill 初读后最多推荐 3
            篇补充论文，等待你明确选择再联合分析；“仅提供材料”会跳过检索。
          </p>
          <button className="button outline" onClick={() => void copyPrompt()}>
            <Copy size={14} />
            复制调用示例
          </button>
          <pre
            className="usage-prompt"
            tabIndex={0}
            aria-label="Skill 调用示例"
          >
            {examplePrompt}
          </pre>
          <p className="copy-status" role="status">
            {copyState === "copied"
              ? "调用示例已复制。"
              : copyState === "manual"
                ? "无法自动复制，请选中上方调用示例手动复制。"
                : "可将示例链接替换为你的论文。"}
          </p>
        </li>
        <li>
          <span className="step-number">03</span>
          <h3>导入结果，核查证据</h3>
          <p>
            点击网页顶部“导入分析 JSON”，选择 Codex
            生成的文件。阅读正文、切换候选路径，查看节点和“主张与依据”。
          </p>
          <p>网页接收分析 JSON；PDF、链接和标题在 Codex 对话中提交。</p>
          <p>
            多篇结果还可查看单篇证据卡、比较表、论文关系图与决策地图。筛选仅用于定位，不改变联合结论。
          </p>
        </li>
        <li>
          <span className="step-number">04</span>
          <h3>带着问题继续讨论</h3>
          <p>
            在节点或论文关系详情填写问题，复制或下载上下文，带回
            Codex。采纳修改后生成新分析版本，再导入网页，旧版继续保留。
          </p>
          <p>
            增删论文或切换论文版本会建立新分析身份；同一范围的修订递增版本，旧结果仍保留。
          </p>
        </li>
      </ol>
      <p className="usage-boundaries">
        扫描 PDF 暂未集成自动
        OCR；全文、图表或附录无法读取时，复盘会标明材料缺口。读取能力取决于当前
        Codex 工具，不同输入形式尚未全部逐项实测。
      </p>
      <a href={projectLinks.readme} target="_blank" rel="noopener noreferrer">
        查看完整 README 与使用说明 →
      </a>
    </div>
  );
}
