# Paper Reconstruction Workbench

Reconstruct plausible research decisions from paper evidence, and learn how to choose the next step under uncertainty.

[中文](README.md) · [Reader](https://cannoyroy.github.io/paper-reconstruction/) · [Usage](docs/usage.md) · [Evaluation](evals/README.md)

The project combines a **Codex Skill, a versioned JSON analysis format, and a static reader**. The Skill supports single-paper reconstruction and joint analysis of multiple papers. The reader links narrative paragraphs, candidate paths, decision nodes, and evidence. Export a node context to continue discussing it in Codex, then import a revised analysis without replacing the original.

Statements are individually labeled **explicit**, **inferred**, or **hypothetical**. A plausible reconstruction is not proof of an author's undocumented history. Ablations and final paper order cannot establish development order.

## Try it

Open the reader and choose the two-paper ResNet collection, or the single-paper ResNet, 2012 CRISPR-Cas9, and first LIGO detection cases. Inspect a paragraph's claims and evidence, compare paths, and prepare a node discussion context.

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

| Input                        | What to provide                                                                   | How it is handled                                                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| PDF attachment or local path | A readable paper PDF, or a file path Codex is allowed to access                   | Uses the host's available PDF, text, and figure-reading tools, and records the material actually read                                  |
| Paper link                   | An arXiv paper page, a direct PDF URL, or another accessible full-text paper link | Confirms the paper's identity and version before retrieving its content; opening a link does not establish that full text was obtained |
| Paper text                   | Pasted text, or a readable local text file such as TXT or Markdown                | Uses the conversation content or Codex's file-reading tools, and records missing figures, appendices, or sections                      |
| Paper title                  | A title, optionally with authors or year to disambiguate it                       | Searches for and identifies the paper, version, and full text first; asks when the identity or version remains ambiguous               |

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

### Analyze multiple papers (v0.2)

Mix PDFs, links, pasted text, and titles. Papers may share a researcher or group, or simply seem similar to you; a connection does not have to be established in advance. The default deliverable is a **six-part joint report, per-paper evidence cards, a comparison table, a paper relationship graph, and a cross-paper decision map**. Single-paper analysis remains available.

```text
Use $paper-reconstruction to analyze these papers together:
https://arxiv.org/abs/1512.03385v1
https://arxiv.org/abs/1603.05027v1
I want to understand their choices for optimizing deeper networks.
After initial reading, search for missing key works. Recommend at most three,
and wait for my explicit selection before including any of them.
Produce analysis.json and report.md in English.
```

Stages: identify and skim → targeted search → wait for selection → freeze the corpus → extract evidence → synthesize → validate and export. Accept all, some, or none of the recommendations. Silence is not consent; rejected works stay outside the analytical evidence. Request “provided materials only” to skip supplementary search. Larger inputs are read in batches with saved intermediate cards.

Compare objects, conditions, resources, and evidence before drawing relationships. Shared authorship, chronology, and similar terminology do not establish supervision, a common programme, or real development order. Multiple clusters, isolated papers, and no supported common thread are valid outcomes.

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

## Current scope and evidence

- Existing single-paper 0.1.0 files remain supported; collections use a separate 0.2.0 contract.
- Joint reports, evidence cards, conditional comparisons, clusters, and two map views. Filters locate and highlight material without rewriting the full report.
- Node and relationship discussion packages. Content revisions preserve earlier versions and node/relationship mappings. Adding/removing papers or switching a paper version requires a new analysis ID with its derivation recorded.
- Existing examples, IndexedDB records, and single-paper CLI commands remain available. Unknown formats and same-version conflicts are rejected.

```sh
pnpm validate examples/residual-programme.json
pnpm cli relation-discussion examples/residual-programme.json R1 "What limits this inference?" work/relation-context
```

Automatic OCR, experiment replication, embedded model chat, accounts, backend libraries, and automatic synchronization are outside this release. Structural checks cannot establish that consent records are authentic or that evidence supports a claim. See [v0.2 evaluation and limitations](evals/collections/README.md) and [host support](docs/host-support.md).

## Research programmes and future directions

**From reconstructing decisions within one paper to reconstructing the research programme of a researcher or group.** v0.2 implements cross-paper analysis and research maps; it uses “research programme” only when the evidence warrants it. Maps express the analysis and do not establish an author's actual history.

- **Review your own body of work**: identify recurring questions, ways of judging alternatives, reusable methods, and disconnected results.
- **Understand a researcher or group**: compare sustained questions, methodological change, and turning points while retaining uncertain collaboration roles and competing explanations.

**Conceptual outlook, not implemented:** continuously maintained large research archives, dedicated question-evolution diagrams, evidence networks, and method-transfer views. The current release provides paper relationship and decision maps; no future version or date is committed.

Original project code, Skill, and documentation are [MIT-licensed](LICENSE). Third-party papers retain their own rights. We distribute original analyses and source links rather than paper files. See [third-party materials](docs/third-party.md) and [contributing](CONTRIBUTING.md).
