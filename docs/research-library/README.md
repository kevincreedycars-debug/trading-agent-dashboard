# Research Library — design, storage and operations

The Research Library is the research-management surface of the dashboard: it shows which asset and factor is
under research, in what state, against which task, with which documents, and it prepares the manual ChatGPT
task. It is an addition for research management only. It changes no live call, no trading feed, no n8n
workflow, no dispatcher state and no production scoring path.

## Factor chains, topic labels and the gated final analysis

The primary workflow is one factor at a time. Each factor owns a chain of three numbered stages; the six topic
labels group those chains and carry shared context, but a label owns no stage and no document. The chain board
sits above the factor register; the register, the legacy task list and the schemas are in a clearly labelled
secondary section because a pass through the three stages needs none of them.

- **A factor chain** is the unit of work and of evidence. It carries `chain_id`, `factor_id`, `topic_id`, a
  `slug` and exactly three stages. `data/research-library/catalog.json` holds twenty-five chains for the
  twenty-five USD factors, covering all six topic labels.
- **A topic label** is one grouping label, not a research owner. It names the factor entries it groups
  (`factor_ids`), the topics it interacts with (`overlaps`), the files it rests on (`companions` and the
  published briefs in `packs`), and the questions it wants answered (`probes`). A factor belongs to one chain;
  one returned document is evidence for that chain and is not counted again under a sibling factor.
- **Stage 1, research** returns one Markdown report (`report`). **Stage 2, red-team** returns one Markdown
  issue register (`review`) and must name the exact research version it judged. **Stage 3, adjudication**
  returns one Markdown adjudication (`synthesis`) and must name the exact review it judged.
- **Every stage card** shows the published prompt with its hash and a Copy prompt button, what to attach
  (stage 2 and 3 name the parent document id, version and sha256 and offer Download to attach), the registered
  document with View and Download, and a single-file upload that records the chain, the stage, the document
  type and the parent version for the reader. Nothing else has to be authored by hand: no JSON, no split
  reports, no reconstructed task context.
- **Stage state is read from the registry, not asserted**: `not_started`, `awaiting_upload` (the parent stage
  is delivered), `delivered`, or `reassessment_required` when the return judged a version the parent has since
  replaced. A factor chain is complete only when all three stages are delivered against the current versions.
  Complete says nothing about an edge: research accepted for synthesis is not a validated trading rule.
- **The prompts live in `docs/research/factors/usd/<factor-slug>/`** (three per chain) and the final prompts in
  `docs/research/final/usd/final-asset-analysis/`. All seventy-eight are rendered from one versioned module,
  `lib/research_prompt_templates.js` at `research-prompt-v3.1.0`, so a prompt cannot drift from the catalogue and
  a workflow instruction cannot survive in one chain after being removed from another. The questions are
  authored per factor: each of the twenty-five entries carries its own probes, the label keeps only the
  questions that span its factors, a gate is asked what it changes about the call rather than which way the
  dollar moves, and stages 2 and 3 re-ask the factor's own questions so a question cannot stop at stage 1.
  The builder owns the facts
  (chain ids, factor entries, deliverable hashes, the gate); the template owns every word. Rendering is audited
  before a file is written: a prompt missing one of its ten sections, carrying a phrase from the older workflow
  (a four-step brief, a stage card, a research card, a dashboard navigation or a JSON paste), leaving a
  placeholder, or naming a second deliverable is refused. The VIX chain's stage 1 prompt names the dispatched
  brief, hashes it and refuses it rather than reproducing it, so the one assignment a worker answers is the one
  in the prompt. The catalogue carries each prompt's sha256 and template version, the page verifies the file
  against that hash before it copies it, and `verify` fails if a prompt file is edited on disk.
- **The asset-level final chain** `usd-final-asset-analysis` has three stages: `final_analysis` (`synthesis`), `final_red_team` (`review`) and `final_adjudication` (`synthesis`). Its gate is the registry rather than a parent link: it stays locked until
  every one of the twenty-five factor chains has delivered all three stages against current versions. The
  panel shows the gate as a count (today `0/25`, twenty-five pending) and renders no stage until it opens. The red-team receives the final analysis and the factor adjudications behind it. The adjudication receives the analysis, the red-team findings and that evidence package, then ends with the complete candidate Layer 1 logic for an isolated backtest. The catalogue also carries an explicit `synthesis_topic` entry (`usd-topic-asset-synthesis`) naming the same chain, its three stage prompts and their hashes, and repeating the gate condition. It is a catalogue record, not a seventh grouping label: it opens nothing, and the library's gate alone decides when those three stages become available.
- **Twenty-five chains cover the twenty-five USD factor entries today.** The VIX chain
  (`usd-factor-live-f1-vix-level`) is the dispatched one; the other chains carry written and checked prompts
  and can be released as a batch. On the committed registry the VIX chain reads research delivered, red-team
  awaiting the file and adjudication not started, so the final chain is locked.

Where the completed VIX red-team file goes: open the local page (`http://127.0.0.1:8791/index.html` when the
service is started with `npm run research-library`), choose **Research Library**, keep **USD**, open the
`usd-factor-live-f1-vix-level` chain row, open **Upload Red-team Markdown** on stage 2, choose the single
Markdown file the reviewer returned, put the model or session label in the model field (required) and press
**Register Red-team document**. The page attaches it to research version 1 and refuses the upload if that
version is not registered. The same route works for every other stage and factor chain. Uploading records
evidence: it is not an approval and it moves no factor status, no weight, no threshold and no live call.

## What the panel gives the reader

- **A factor-chain board first**: the six topic labels, and under each label one row per factor chain with its
  completed stage count (for example `1/3`), whether it is complete, and an expandable body holding exactly
  that chain's three stage cards. Chains are isolated by factor: opening a sibling row shows that chain's own
  empty stages, never another factor's document.
- **The gated final chain** below the factor chains: `usd-final-asset-analysis`, its gate count, the pending
  factors, and its three stage cards only once every factor chain is complete. A locked final chain renders no
  stage and no prompt, because there is nothing yet to synthesise.
- **Eight asset categories**, USD first, then EUR, GBP, GOLD, SILVER, NQ, BTC, WTI. USD is populated; the
  other seven carry a standfirst, a next step and an explicit note that no USD sign, weight or threshold
  transfers to them. Each asset record also carries a `catalogue` block stating whether it is
  `dispatchable` or `profile_only`, with its factor-entry, chain, stage-prompt and brief counts, so a draft
  profile is never mistaken for a factor catalogue: the seven drafts read `profile_only` with zero of each
  and a `remaining` list of what would have to be generated before anything under them could be dispatched.
- **A secondary register** below the workflow, labelled as not the workflow: asset and factor filters (family,
  research status, review status, backtest status and free-text search over factor id, label, brief, blockers
  and dependencies, with a live "n of m factors shown" count), the factor table (family, role, the live weight
  in the code **and** in the rulebook, the three separate statuses, document version, updated date, blockers and
  dependencies), and four progress cards (factors, research, review, backtest) with the note that a brief is an
  assignment and not research progress.
- **A factor detail page** per factor: its brief, its current rules (or the statement that no rule is in force
  because the card is a hypothesis), blockers and dependencies, its sources, the self-contained brief
  published for it with Copy prompt and Download, the tasks that cover it, its reports and reviews, and its
  history.
- **The legacy research-task list** with, per task: the unique task id, its kind, its status, the context
  version, a prompt fingerprint, the factors it covers, the gaps it does not cover, its dependencies, and the
  actions Copy prompt, Download context package and Upload report.
- **A separate whole-engine section** for reviews, synthesis documents and experiment results, registered
  apart from the per-factor evidence.

## What "prepare a task" means, and what it does not

Copy prompt on a stage card copies that stage's exact generated prompt: the chain id, the factor it belongs to,
the stage number and label, the agreed 05:00 Europe/London session, the prohibitions, and the required return.
It is self-contained enough to paste into a fresh ChatGPT session. The page verifies the prompt file against
the sha256 in the catalogue before copying it, and `verify` fails if the file on disk drifts from the authored
text. Stage 2 and stage 3 also name the parent document id, version and sha256, with Download to attach that
exact version.

The legacy task prompts and the twenty-five per-factor briefs still work exactly as before, but they are in the
secondary register and are not the route. Copy prompt on a factor's own brief copies that brief's published
file: the twenty-five USD factors each carry one (ten baseline audits of the deployed factors and fifteen
session-research assignments), and the same file is what the Download button writes, what the handoff archive
ships, and what the registry hashed. A test walks all twenty-five factor rows in a real browser and fails if any
one of them has no brief, no Copy prompt or no Download.

The reader pastes the prompt into their own ChatGPT session. **Nothing on this page calls a frontier model API.**
The catalogue carries `manual_task_only: true` and `frontier_api_calls: false`, and a test asserts that no
model host appears anywhere in the catalogue or in the shared helper. An uploaded document is research
evidence; it does not become an approved trading rule, and no status moves on upload alone. Publishing the
twenty-five briefs moved no status either: coverage is an assignment, not a result.

## Running a chain, step by step

1. **Start the service and open the panel**: `node scripts/research-library-server.js --serve-repo`, then the
   Research Library tab. The published GitHub Pages tab serves the same prompts and the same twenty-five briefs,
   but the upload flow needs the local service.
2. **Pick one factor chain**, not a topic. Expand its row under its topic label and read the three stage cards.
   The current stage is the first one that is not delivered; a stage cannot be uploaded before its parent version
   is registered.
3. **Copy the stage prompt and run it in the user's own ChatGPT session.** Keep the return as one Markdown
   document. Stage 1 returns a report, stage 2 a red-team issue register that names the research version it
   judged, and stage 3 an adjudication that names the review it judged.
4. **Upload that one Markdown file on the same stage card**, with the model or session label (required). The page
   assembles the chain, the stage, the document type and the parent version; the local service writes the bytes
   outside Git and updates the registry. The next stage then reads `awaiting_upload`.
5. **The final chain stays locked until all twenty-five factor chains are complete** against current versions.
   Only then do its three prompts appear, in order: final analysis, final red-team, final adjudication. Each stage has its own prompt, input-package manifest, download controls, upload and registered result.
6. **Nothing moves by itself.** An upload adds a registry version and the panel states in its own words that it is
   not an approval. The factor's `research_status` and `review_status` are set in the catalogue source
   (`scripts/build_research_library.js`) and re-generated; an upload, including an adjudication, changes neither,
   and `backtest_status` cannot be `tested` before a review is accepted.
7. **The prompts are generated.** The chain prompts come from the chain map in
   `scripts/build_research_library.js`; changing one means editing the source and running
   `node scripts/build_research_library.js catalog --write`, which writes the prompt files with the catalogue
   they are hashed into. `chains --check` (or `topics --check`, an alias) and `verify` fail on drift. Changing a
   brief means running `node scripts/build_research_handoff.js write` and then
   `node scripts/build_research_library.js registry --write`, because the registry hashes the same pack files.

## Storage design

Two layers, deliberately different:

| Layer | Path | Committed? | Who can read it |
| --- | --- | --- | --- |
| Metadata registry (versions, hashes, task, factor, model, dates) | `data/research-library/documents.json` | yes | anyone reading the site |
| Repo-backed document bytes | each file's own path under `docs/` or `data/` | yes | anyone reading the site |
| Uploaded document bytes | `.local/research-library/objects/<aa>/<sha256>` | **no, ignored** | only through the local service, with the token |

- Objects are written once, under their own SHA-256, and never rewritten. The same bytes uploaded twice are a
  no-op that returns the version that already exists.
- Every document version records `sha256`, `bytes`, `registered_at`, the original filename, the model label,
  the context version and the SHA-256 of the dispatched prompt that was in the catalogue at upload time. A final-chain version also records its `input_documents`: the exact document ids, versions and sha256 values it judged, including the factor adjudications that support it.
- A download is re-hashed on read, and the panel hashes what it received and compares it with the registry, so
  "the downloaded file matches the uploaded file" is checked rather than asserted.
- Repo-backed documents are registered by hash too, and `node scripts/build_research_library.js verify` fails
  if a registered hash no longer matches the file, so a silent edit shows up.
- Server writes are atomic (temp file then rename). The registry is written by the service, so it shows as a
  working-tree change for the coordinator to commit; a published page cannot see that write until it is
  committed, and the panel says so instead of pretending otherwise.

## Registered returns

One return is registered in the committed registry so far, and it is the worked example of the boundary above.

| Document | Factor chain | Brief id | Model | Registration |
| --- | --- | --- | --- | --- |
| `usd-baseline-audit-01-vix-usd-report` — "VIX and the subsequent direction of the US dollar: a critical research report for the 05:00 Europe/London forecast session" | `usd-factor-live-f1-vix-level` (`live.f1-vix-level`) | `USD-BASELINE-AUDIT-01` | Astra deep research | 2026-10-15, version 1, 84,056 bytes, sha256 `e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d` |

- The row reads **research delivered, review pending**, in the document's own note and in its version note. The audit
  task id is a brief id and no library catalogue task carries it, and the validator refuses a `task_id` that is not in
  the catalogue, so the id is named in the notes rather than recorded as a task that does not exist.
- The bytes are not published. The published page shows the metadata row and the note, while View and Download need
  the local service, and the factor's three statuses are exactly what they were (`ready` / `pending` / `not_tested`):
  an upload is evidence, not progress, and nothing about the deployed node changed.
- The factor's brief is untouched, so the prompt a reader copies and the prompt this registry fingerprinted are still
  the same file, and a later report on the same factor would be registered as a new version rather than substituted.

## The local authenticated service

```
node scripts/research-library-server.js --serve-repo
Get-Content .local\research-library\service-token     # paste once into the panel's Token field
```

- Binds **127.0.0.1 only**, and every upload, download, manifest and export needs the bearer token, compared
  in constant time. The token is created on first run in `.local/research-library/service-token`, is never
  printed by the program, never committed and never rendered into the page (the reader's own browser keeps the
  copy they pasted).
- `GET /health` (unauthenticated, counts only), `GET /manifest`, `GET /export` (manifest plus per-document
  download references and the task prompt hashes), `POST /documents`, `GET /documents/<id>/versions/<n>`,
  `GET /tasks/<taskId>/context-package`.
- There is **no public upload and no public download**: a report uploaded here is not published, and the
  published page cannot read it. That is the intended boundary, not a limitation to work around.
- `--serve-repo` also serves this checkout on loopback, which is the supported way to run the upload flow
  (browser private-network rules block a public page from reaching a loopback service, and this repository
  already uses the same local-serve pattern for the L2L levels tool).

### Smallest backend addition, stated plainly

The dashboard is a static GitHub Pages site with no server. Durable authenticated uploads therefore need a
process; the smallest one that satisfies the brief without inventing persistence is the loopback service
above, writing an immutable object store beside a committed metadata registry. If uploads must later work from
the published page with no local process, the next step is Supabase, already the project's data layer: a
private storage bucket plus a table with row-level rules for an authenticated user. That needs an operator
decision, credentials and a schema, and it is **not** simulated here.

## Status vocabulary, kept honest

- **Research**: Not started / Ready / In progress / Uploaded / Blocked.
- **Review**: Pending / Changes requested / Accepted.
- **Backtest**: Not tested / Queued / Tested.

The catalogue validator enforces the consequences: a factor cannot be review-accepted without an uploaded
report, cannot be backtest-tested without an accepted review, and cannot record a blocker without being in the
blocked research state. When a factor's report changes after a review or a synthesis was written,
`deriveReviewFreshness` flags the dependent documents as needing reassessment.

## Tasks, coverage and gaps

| Task | Kind | Covers | Gaps recorded |
| --- | --- | --- | --- |
| `USD-SESSION-A1` | field research | 7 price-behaviour and risk cards | no rates, release or calendar card; label instrument unverified |
| `USD-SESSION-A2` | field research | 8 rates, release and calendar cards | no price or risk card; consensus and first-print vintages may be unreachable |
| `USD-SESSION-A3` | review (Reviewer A) | all 25 factor entries | cannot start before both field returns |
| `USD-SESSION-A4` | review (Reviewer B) | all 25 factor entries | cannot start before both field returns; also owns the frozen-evaluation-design decision |
| `USD-SESSION-A5` | synthesis | all 25 factor entries | cannot start before both reviews are recorded |

Coverage is computed, not asserted: the panel prints how many of the asset's factors are covered by a task and
lists the ones that are not. The ten deployed engine factors are carried as the live baseline family and are
deliberately **not** covered by the two field-research tasks; the reviews and synthesis cover all twenty-five
entries. Two of the deployed factors (F7 economic surprise and F8 Fed bias) are blocked on data access.

## Verification performed

- `node --test tests/research_library.test.js` — catalogue validation, status consequences, task coverage, context
  package contents, registry hashing, the twenty-five-chain and gated-final-chain shape, every prompt hash and
  self-containment check, the VIX chain's delivered research beside its untouched sibling, stage linkage refusal,
  staleness propagation, immutable versions, service authentication, upload/download round-trip with hash equality,
  path-traversal refusal and persistence across a restart.
- `node --test tests/research_library.browser.test.js` — the panel in a real browser at desktop and narrow widths:
  the menu entry, eight assets with USD first, the six topic labels and the chain rows under them, both VIX chains
  at `1/3` and `0/3` with sibling isolation, the locked final chain rendering no stage, prompt copy and headers,
  the upload path against the real local service with its judged parent version, full-content View and Download,
  persistence across a refresh and a service restart, a revision flagging its review, the published page refusing
  an upload, the secondary factor table and detail page, and a check that the dashboard's existing live feed
  request is unchanged.
- `node scripts/build_research_library.js verify` — catalogue, registry, every repo-backed document hash, the
  chain map and every generated factor or final prompt.
- The panel was read in a served copy of this checkout and, after publication, on the live site.
