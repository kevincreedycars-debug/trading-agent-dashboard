# Research Library — design, storage and operations

The Research Library is the research-management surface of the dashboard: it shows which asset and factor is
under research, in what state, against which task, with which documents, and it prepares the manual ChatGPT
task. It is an addition for research management only. It changes no live call, no trading feed, no n8n
workflow, no dispatcher state and no production scoring path.

## Topics and the three numbered stages

The primary workflow is one topic at a time, and each topic runs three stages in order. The topic page sits
above the factor register; the register, the legacy task list and the schemas are in a clearly labelled
secondary section because a pass through the three stages needs none of them.

- **A topic** is one research question. It names the factor entries its answer is evidence for (`factor_ids`),
  the topics it interacts with (`overlaps`), the files it rests on (`companions` and the published briefs in
  `packs`), and the questions it wants answered (`probes`). A factor may appear in one topic and be mapped
  from another topic's answer; that mapping is recorded once, on the topic, rather than counted as a second
  independent result.
- **Stage 1, research** returns one Markdown report (`report`). **Stage 2, red-team** returns one Markdown
  issue register (`review`) and must name the exact research version it judged. **Stage 3, adjudication**
  returns one Markdown adjudication (`synthesis`) and must name the exact review it judged.
- **Every stage card** shows the published prompt with its hash and a Copy prompt button, what to attach
  (stage 2 and 3 name the parent document id, version and sha256 and offer Download to attach), the registered
  document with View and Download, and a single-file upload that records the topic, the stage, the document
  type and the parent version for the reader. Nothing else has to be authored by hand: no JSON, no split
  reports, no reconstructed task context.
- **Stage state is read from the registry, not asserted**: `not_started`, `awaiting_upload` (the parent stage
  is delivered), `delivered`, or `reassessment_required` when the return judged a version the parent has since
  replaced. A topic is ready for central synthesis only when all three stages are delivered and the chain
  judged the current versions. Ready for synthesis says nothing about an edge: research accepted for synthesis
  is not a validated trading rule.
- **The prompts live in `docs/research/topics/usd/<topic-slug>/`** and are generated with the topic map by
  `scripts/build_research_library.js`, so a prompt cannot drift from the catalogue: the catalogue carries each
  prompt's sha256, the page verifies the file against that hash before it copies it, and `verify` fails if a
  prompt file is edited on disk.
- **The prompt words come from one versioned template, `lib/research_prompt_templates.js`**
  (`research-prompt-v3.0.0`), and the builder supplies only the facts: which entries belong to the topic, the
  session and label instrument, the documents the stage is given, the deliverable name and the dispatch record.
  Every stage is rendered from the same ten sections in the same order, each prompt names the template version
  it came from, and the builder refuses to write one that keeps an older workflow's wording, leaves a
  `<placeholder>` for a value the reader may not have, drops a section or names a deliverable fewer than twice.
  The superseded VIX brief and the programme red-team brief are named and hashed in the catalogue and refused
  rather than reproduced, so the Copy prompt button pastes the topic's own stage 1 assignment and never the
  legacy `USD-SESSION-A3` reviewer prompt.
- **Six topics cover the twenty-five USD factor entries today.** The VIX topic
  (`usd-topic-vix-level-and-risk-regime`) is the dispatched one; all six now carry the template-rendered stage
  prompts and can be released as a batch. The other seven assets exist only as draft profiles that state their
  open decisions: no session, no label instrument and no factor mapping is inherited from USD.

Where the completed VIX red-team file goes: open the local page (`http://127.0.0.1:8791/index.html` when the
service is started with `npm run research-library`), choose **Research Library**, keep **USD**, select the VIX
topic, open **Upload Red-team Markdown** on stage 2, choose the single Markdown file the reviewer returned, put
the model or session label in the model field (required) and press **Register Red-team document**. The page
attaches it to research version 1 and refuses the upload if that version is not registered. The same route
works for every other stage and topic. Uploading records evidence: it is not an approval and it moves no factor
status, no weight, no threshold and no live call.

## What the panel gives the reader

- **Eight asset categories**, USD first, then EUR, GBP, GOLD, SILVER, NQ, BTC, WTI. USD is populated; the
  other seven carry a standfirst, a next step and an explicit note that no USD sign, weight or threshold
  transfers to them.
- **Asset and factor filters**: family, research status, review status, backtest status and free-text search
  over factor id, label, brief, blockers and dependencies, with a live "n of m factors shown" count.
- **A factor table** showing, per factor: family, role (direction / regime / quality gate / abstention gate),
  the live weight in the code **and** in the rulebook, the three separate statuses, the document version and
  updated date, and the blockers and dependencies.
- **Progress counts** as four cards: factors, research, review, backtest, plus a line stating how many of the
  factors in view carry a self-contained brief (25 of 25 today), with the note that a brief is an assignment
  and not research progress.
- **A factor detail page** per factor: its brief, its current rules (or the statement that no rule is in force
  because the card is a hypothesis), blockers and dependencies, its sources, the self-contained brief
  published for it with Copy prompt and Download, the tasks that cover it, its reports and reviews, and its
  history.
- **A research-task list** with, per task: the unique task id, its kind, its status, the context version, a
  prompt fingerprint, the factors it covers, the gaps it does not cover, its dependencies, and the actions
  Copy prompt, Download context package and Upload report.
- **A separate whole-engine section** for reviews, synthesis documents and experiment results, registered
  apart from the per-factor evidence.

## What "prepare a task" means, and what it does not

Copy prompt copies the exact dispatched prompt for that task, which is self-contained: the task id, the agreed
session objective, the implementation excerpt, the rulebook excerpt, the data actually reachable, the prompt
itself and the required output schema. Download context package writes the same material as one JSON document
with a context fingerprint, and includes which factors the task covers and which are gaps.

Copy prompt on a factor's own brief copies that brief's published file: the twenty-five USD factors each carry
one (ten baseline audits of the deployed factors and fifteen session-research assignments), and the same file is
what the Download button writes, what the handoff archive ships, and what the registry hashed. A test walks all
twenty-five factor rows in a real browser and fails if any one of them has no brief, no Copy prompt or no
Download.

The reader pastes that into their own ChatGPT session. **Nothing on this page calls a frontier model API.**
The catalogue carries `manual_task_only: true` and `frontier_api_calls: false`, and a test asserts that no
model host appears anywhere in the catalogue or in the shared helper. An uploaded document is research
evidence; it does not become an approved trading rule, and no status moves on upload alone. Publishing the
twenty-five briefs moved no status either: coverage is an assignment, not a result.

## Running a task, step by step

1. **Start the service and open the panel**: `node scripts/research-library-server.js --serve-repo`, then the
   Research Library tab. The published GitHub Pages tab serves the same prompts and the same twenty-five briefs,
   but the upload flow needs the local service.
2. **Copy one brief per factor, or one package per task.** Each factor's detail page carries its own
   self-contained brief with Copy prompt and Download, and the brief is the unit a model is given: two halves
   exist, the ten deployed baseline audits (F1 to F10, task ids `USD-BASELINE-AUDIT-01` to `-10`) and the
   fifteen session-research assignments (7 in `USD-SESSION-A1`, 8 in `USD-SESSION-A2`). The two field packages
   remain the only prompts that build several cards at once, and each package lists every card id it covers.
3. **The briefs and the prompts are generated, not hand-written.** The briefs come from
   `scripts/build_research_handoff.js` (authored per factor in that file, published under
   `docs/research/handoff/usd/v1/packs/`); the task prompts come from the assignment packages
   (`docs/research/usd-session/v1/assignments/USD-SESSION-A1.price-and-risk.json`,
   `…A2.rates-releases-calendar.json`, `…A3…`, `…A4…`, `…A5.synthesis.json`) together with the shared headers and
   data bullets in `scripts/build_research_library.js`, and the stage prompts of the six topics come from
   `lib/research_prompt_templates.js` plus that builder's topic specs. The bytes the panel copies for a task are `tasks[].prompt`
   in `data/research-library/catalog.json`, so changing a prompt means editing the source and running
   `node scripts/build_research_library.js catalog --write`; changing a brief means running
   `node scripts/build_research_handoff.js write` and then `node scripts/build_research_library.js registry --write`,
   because the registry hashes the same pack files.
4. **Run the briefs, or both packages, in the user's own ChatGPT session** and keep the returns: the required
   shape is `docs/research/usd-session/v1/research-card.schema.json` (`usd-session-research-card-v2`), one JSON
   document per card id; every brief also names the same schema and field list, so a card from a brief and a card
   from a package are the same object.
5. **Register a return as evidence, two ways.** Either upload it in the panel against the same task id (Upload report,
   with a document id and the model label, the bytes going outside Git and the registry written by the service), or
   commit the card JSON under `docs/research/usd-session/v1/research-cards/`, where
   `backtester/tests/usd_session_research_card.test.js` validates every `.json` file in that folder against the schema.
6. **Nothing moves by itself.** An upload adds a registry version and the panel states in its own words that it is not
   an approval. The factor's `research_status` is set in the catalogue source (`scripts/build_research_library.js`) and
   re-generated, review stays `pending` until A3 or A4 records one, and `backtest_status` cannot be `tested` before a
   review is accepted.
7. **Then A3, A4 and A5**, which run against the returned cards rather than against the prompts above, cover all
   twenty-five entries and their overlaps, and carry Reviewer B's decision on the frozen evaluation design as the
   gate before any candidate is scored.

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
  the context version and the SHA-256 of the dispatched prompt that was in the catalogue at upload time.
- A download is re-hashed on read, and the panel hashes what it received and compares it with the registry, so
  "the downloaded file matches the uploaded file" is checked rather than asserted.
- Repo-backed documents are registered by hash too, and `node scripts/build_research_library.js verify` fails
  if a registered hash no longer matches the file, so a silent edit shows up.
- Server writes are atomic (temp file then rename). The registry is written by the service, so it shows as a
  working-tree change for the coordinator to commit; a published page cannot see that write until it is
  committed, and the panel says so instead of pretending otherwise.

## Registered returns

One return is registered in the committed registry so far, and it is the worked example of the boundary above.

| Document | Factor | Task | Model | Registration |
| --- | --- | --- | --- | --- |
| `usd-baseline-audit-01-vix-usd-report` — "VIX and the subsequent direction of the US dollar: a critical research report for the 05:00 Europe/London forecast session" | `live.f1-vix-level` | `USD-BASELINE-AUDIT-01` | Astra deep research | 2026-10-15, version 1, 84,056 bytes, sha256 `e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d` |

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
| `USD-SESSION-A3` | review (Reviewer A) | all 15 research cards | cannot start before both field returns |
| `USD-SESSION-A4` | review (Reviewer B) | all 15 research cards | cannot start before both field returns; also owns the frozen-evaluation-design decision |
| `USD-SESSION-A5` | synthesis | all 15 research cards | cannot start before both reviews are recorded |

Coverage is computed, not asserted: the panel prints how many of the asset's factors are covered by a task and
lists the ones that are not. The ten deployed engine factors are carried as the live baseline family and are
deliberately **not** covered by a research task; two of them (F7 economic surprise and F8 Fed bias) are blocked
on data access.

## Verification performed

- `node --test tests/research_library.test.js` — catalogue validation, status consequences, coverage, context
  package contents, staleness propagation, registry hashing, immutable versions, service authentication,
  upload/download round-trip with hash equality, path-traversal refusal and persistence across a restart.
- `node --test tests/research_library.browser.test.js` — the panel in a real browser at desktop and narrow
  widths: the menu entry, eight assets with USD first, the factor table and its three status columns, the
  filters, the factor detail page, copy prompt, download context package, the upload path against the real
  local service, and a check that the live feed request the dashboard already made is unchanged.
- `node scripts/build_research_library.js verify` — catalogue, registry and every repo-backed document hash.
- The panel was read in a served copy of this checkout and, after publication, on the live site.
