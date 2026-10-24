# Paper Reconstruction Workbench

Reconstruct plausible research decisions from paper evidence, and learn how to choose the next step under uncertainty.

[中文](README.md) · [Reader](https://cannoyroy.github.io/paper-reconstruction/) · [Usage](docs/usage.md) · [Evaluation](evals/README.md)

The project combines a **Codex Skill, a versioned JSON analysis format, and a static reader**. The Skill produces a complete reconstruction. The reader links narrative paragraphs, candidate paths, decision nodes, and evidence. Export a node context to continue discussing it in Codex, then import a revised analysis without replacing the original.

Statements are individually labeled **explicit**, **inferred**, or **hypothetical**. A plausible reconstruction is not proof of an author's undocumented history. Ablations and final paper order cannot establish development order.

## Try it

Open the reader and choose ResNet, the 2012 CRISPR-Cas9 paper, or the first LIGO detection paper. Inspect a paragraph's claims and evidence, compare paths, and prepare a node discussion context.

The interface and default reports are Chinese. The Skill accepts a requested output language. Imported analyses stay in the browser; the reader has no model API or upload endpoint. Export JSON for durable storage. Hosting access logs are managed by GitHub Pages.

## Use the Codex Skill

Download the Skill ZIP from [Releases](https://github.com/cannoyroy/paper-reconstruction/releases), extract it, and place its `paper-reconstruction` directory under your project's `.agents/skills/` or your user-level `~/.agents/skills/`.

```text
Use $paper-reconstruction to reconstruct the research decisions in this paper.
Produce a complete report, analysis.json, and report.md in English.
Use targeted public supplementary sources when necessary.
Paper: https://arxiv.org/abs/1512.03385v1
```

The Skill uses the current Codex session's model and available tools. No additional model API key is needed. Its bundled deterministic CLI requires Node.js 22. Source-checkout users must build the Skill package first.

### Ways to provide a paper

When invoking the Skill in Codex, you can provide a paper in the following forms:

| Input | What to provide | How it is handled |
| --- | --- | --- |
| PDF attachment or local path | A readable paper PDF, or a file path Codex is allowed to access | Uses the host's available PDF, text, and figure-reading tools, and records the material actually read |
| Paper link | An arXiv paper page, a direct PDF URL, or another accessible full-text paper link | Confirms the paper's identity and version before retrieving its content; opening a link does not establish that full text was obtained |
| Paper text | Pasted text, or a readable local text file such as TXT or Markdown | Uses the conversation content or Codex's file-reading tools, and records missing figures, appendices, or sections |
| Paper title | A title, optionally with authors or year to disambiguate it | Searches for and identifies the paper, version, and full text first; asks when the identity or version remains ambiguous |

Reading and search capabilities come from the current Codex environment. The Skill does not bundle a general-purpose file parser or download service. Automatic OCR for scanned PDFs is not integrated. Missing full text, pages, or readable figures are recorded as specific gaps; an abstract is never presented as a fully read paper. These are input rules; not every form has been individually tested.

**Local PDF example** (replace the path with a file Codex can access, or attach the PDF):

```text
Use $paper-reconstruction to analyze D:/papers/paper.pdf.
Produce a complete reconstruction, analysis.json, and report.md in English.
```

**Link example**:

```text
Use $paper-reconstruction to analyze this paper:
https://arxiv.org/abs/1512.03385v1
Produce a complete reconstruction, analysis.json, and report.md in English.
```

**Title example**:

```text
Use $paper-reconstruction to analyze "Deep Residual Learning for Image Recognition".
First confirm the paper's identity and version and obtain its full text.
Then produce a complete reconstruction, analysis.json, and report.md in English.
```

### Bring the result to the reader

The workflow is: **provide the paper to the Codex Skill → generate analysis.json → import the result into the web reader**.

The reader's import action accepts analysis JSON for reading the report, inspecting evidence, and selecting research nodes. Provide PDFs, paper links, text, and titles in the Codex conversation. The current web reader has no paper-submission or model-generation endpoint.

## Develop locally

Requirements: Node.js **22.13+**, pnpm **10.13.1**.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
```

```sh
pnpm validate examples/resnet-2015.json
pnpm cli markdown examples/resnet-2015.json work/report.md
pnpm cli discussion examples/resnet-2015.json P01 N01 "What would distinguish these explanations?" work/context
pnpm package:skill
```

Exports never overwrite existing files. JSON is the canonical analysis; Markdown is derived from it. Discussion contexts preserve the analysis version and selected path's information conditions. Revisions keep previous versions and explicit node mappings.

## Scope and evidence

Version 0.1 supports a six-part single-paper reconstruction, candidate-path comparison, cyclic decision maps, section/figure/page locators, local persistence, and portable node discussion packages. It does not include automatic OCR, experiment replication, embedded model chat, accounts, or batch libraries.

Three examples exercise computational, laboratory, and observational evidence. This is not validation across all disciplines or a measured historical-reconstruction accuracy. Evaluation records distinguish structural checks, semantic self-review, independent model trials, and human feedback.

Original project code, Skill, and documentation are [MIT-licensed](LICENSE). Third-party papers retain their own rights. We distribute original analyses and source links rather than paper files. See [third-party materials](docs/third-party.md) and [contributing](CONTRIBUTING.md).
