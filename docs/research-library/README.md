# Research Library — design, storage and operations

The Research Library is the research-management surface of the dashboard: it shows which asset and factor is
under research, in what state, against which task, with which documents, and it prepares the manual ChatGPT
task. It is an addition for research management only. It changes no live call, no trading feed, no n8n
workflow, no dispatcher state and no production scoring path.

## What the panel gives the reader

- **Eight asset categories**, USD first, then EUR, GBP, GOLD, SILVER, NQ, BTC, WTI. USD is populated; the
  other seven carry a standfirst, a next step and an explicit note that no USD sign, weight or threshold
  transfers to them.
- **Asset and factor filters**: family, research status, review status, backtest status and free-text search
  over factor id, label, brief, blockers and dependencies, with a live "n of m factors shown" count.
- **A factor table** showing, per factor: family, role (direction / regime / quality gate / abstention gate),
  the live weight in the code **and** in the rulebook, the three separate statuses, the document version and
  updated date, and the blockers and dependencies.
- **Progress counts** as four cards: factors, research, review, backtest.
- **A factor detail page** per factor: its brief, its current rules (or the statement that no rule is in force
  because the card is a hypothesis), blockers and dependencies, its sources, the tasks that cover it, its
  reports and reviews, and its history.
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

The reader pastes that into their own ChatGPT session. **Nothing on this page calls a frontier model API.**
The catalogue carries `manual_task_only: true` and `frontier_api_calls: false`, and a test asserts that no
model host appears anywhere in the catalogue or in the shared helper. An uploaded document is research
evidence; it does not become an approved trading rule, and no status moves on upload alone.

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
