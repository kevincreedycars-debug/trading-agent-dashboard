# Publish request: "What moves the gold price" (user instruction, 2026-10-04)

Advisory note and handover by worker `strategy` (`strategy-advisory-001`), 2026-10-04, at the user's instruction this
turn, verbatim: *"yes please push it all live to the live dashboard so I can see everything clearly and from there we
can work on this."* That answers the standing publish question for the factor table this lane has been waiting on.

**This window cannot publish and the request has to be carried out by the coordinator.** This worker writes only
`docs/strategy/` in its own worktree, holds no credentials for this assignment and must not touch live systems
(`docs/orchestration/assignments/strategy.md`, "Authority and ownership"). Publishing a page is a coordinator
production action, exactly as the 2026-09-30 release of the draft factor page was (`a2b0e13` on production `main`),
and the automatic coordinator is **offline** at the time of writing - `.local/orchestration/controller/status.json`
reads `paused`, and `monitor-state.js snapshot` reports `"controller": "Auto coordinator offline",
"controller_state": "offline"` at `2026-10-04T11:31:04Z`. So nothing moves on its own: the page is built, checked and
sitting in this worktree, and it goes live when a coordinator run picks this up or when the user asks for the
coordinator to be restarted.

## 1. What is being published, and the whole of the work it needs

One new page, one copy step, one nav entry. The page is already written, self-contained and checked:

| | |
| --- | --- |
| Source (this worktree) | `docs/strategy/WHAT_MOVES_GOLD_CANDIDATE.html` |
| Publish as (site root) | `what-moves-gold.html` |
| Bytes on disk | 24,628 (CRLF, 250 line endings, 0 bare LF) |
| sha256 on disk (CRLF form) | `3037ca5199eba771fbcb4e083d63cc50527ed3d0f825c13cf36e38600e7e8531` |
| sha256 of the stored blob (LF form) | `19b98b78f16999b309212b7df3749e55a847054e8b69557aa426ffebad0c1139` |
| Nav entry | one line in the shared top bar, by default `<a class="topbar-link" href="what-moves-gold.html" target="_top">What moves gold</a>`, and the same entry in the rail if the rail carries per-page entries |

The blob hash is given because this repository runs `core.autocrlf=true` with no `.gitattributes`, so the commit stores
the LF form; the earlier published pages were stored the same way, and the worker's own CRLF file is the copy that
answers a live check. A reviewer reproduces the two hashes with the commands in section 8.

Optional, not required for the page to be useful: a new first tab on the Gold page (`gold.html`), named by default
**What moves gold**, framing `what-moves-gold.html`. The page stands alone at its own address, so the tab is a second
step the coordinator can take or leave; nothing in the candidate depends on it.

## 2. What the page says, in the user's terms

- **The ten factors**, one row each: what the factor is in one line, which way it pushes gold, why, and the share of
  the picture the system gives it out of 100. The ten declared weights add to 100, and the top four are the system's
  own primary drivers.
- **Where the number 28 comes from**: the 28 readings the gold agent is allowed to read, printed by their declared
  names and grouped under the factor each one belongs to, each with a plain-words meaning. This is the list the user
  has twice said he could not find on any live page.
- **What the archive has shown**, stated before any reader can mistake the directions for results: the directions are
  the system's declared expectations, the archive returned no usable direction (all 25 daily states `no information`,
  24 of 25 weekly with one `unstable across years`), and exactly one daily row reached the interest threshold against
  roughly two and a half expected by chance, which is the noise floor.
- **What the page is not**: not a forecast, a pick, a ranking, a score, a signal or a trading result.

Every number on it is already published elsewhere in the project, and the page re-measures nothing.

## 3. Where each figure comes from, so it can be checked rather than trusted

| Figure on the page | Source, read read-only this turn |
| --- | --- |
| The ten factor names and the weights 22/18/14/8/8/10/6/6/6/2 | `logic/agent_gold_direction.md`, section 4 weighted factor model (the table and `Total Weight = 100`); each factor's own `Weight: n` line re-read |
| The direction rules in the "which way" column | The same document's factor blocks |
| The 28 readings and their declared names | `backtester/lib/gold_source_readiness.js`, constant `GOLD_VARIABLES` (28 entries, read as text) |
| Which factor each reading belongs to | `backtester/registries/gold_variable_horizon_context.v1.json`, each entry's `factor` field (`F1`-`F10`), and its `declared_inventory_source.declared_count: 28` |
| The dollar caveat | `backtester/docs/historical_collector_handoff.md` and `usd_historical_data_acquisition_plan.md`, as recorded in `docs/strategy/FACTOR_INFLUENCE_TABLE_20261003.md` section 4 |
| The archive figures | The Direction tab's own published embedded summary, as recorded in `docs/strategy/FACTOR_INFLUENCE_TABLE_20261003.md` section 5 |

The plain-words column is this lane's wording of the registry's `label` and `definition` text; the declared name is
printed beside it in monospace so the two can be compared row by row.

## 4. How the candidate is built, so the reviewing lane can rebuild it

`tmp/make-what-moves-gold.js` (ignored scratch) writes the page and checks it in the same run:

- the head copies the census pages' own palette and layout rules verbatim from the published
  `gold-backtest-outcomes.html`, so the new page looks like the rest of the gold set without linking a stylesheet;
- the navigation block marked `SHARED-NAV:START`/`SHARED-NAV:END` is copied verbatim from that same published page, so
  the bar and rail keep exactly **one** owner - the coordinator's nav generator - and this page cannot drift from it;
- the page carries no script, no frame, no image and no external request;
- the checker fails the build on any drift: the declared inventory must be 28 entries, the page must print 28 readings
  in 10 groups, the registry's factor grouping must match the page's grouping entry by entry, the weights must add to
  100 and each must appear as a `Weight: n` line in the logic document, and no bare-LF line ending may be present.

Result of the build this turn: `problems: none`, 10 weighted factor rows, 28 readings in 10 groups, declared inventory
28, weight total 100, 250 line endings, 0 bare LF.

## 5. What this turn did not do

No page, stylesheet, script, template, builder, guard, generator, data artifact, number, register entry, assignment,
lock, controller or bridge file was touched. Nothing was published, refreshed, triggered, copied, merged or deployed.
No market data was read, no measurement was run, no outcome, holdout or prospective observation was read, and the
sealed window (reading prohibited until `2027-03-25T15:00:00Z`) was untouched. The only writes are this note, the
candidate page and its generator, one entry appended to `docs/strategy/CONVERSATION_NOTES.md`, the submission
envelope, and one commit on `workers/strategy-advisory-20260920` with its push.

## 6. What the request also asks for, beyond the page

1. **Publish the page** as section 1 describes, and record the publish the way the 2026-09-30 release was recorded
   (commit, pushed range, byte count, blob hash, live check).
2. **Confirm the live Gold page change** this lane reported as an observation under `-050`: `gold.html` moved from
   14,388 bytes and four tabs to 32,245 bytes and five tabs between `-049` and that read, and this lane cannot see the
   commit that did it from its own worktree.
3. **Re-issue the `-048` acceptance reply in parseable form.** It is still unparseable JSON, so
   `coordination.js check --worker strategy` exits nonzero with `Bad control character in string literal ... position
   318` on every read, including the read this filing rests on. The filed submission bytes themselves are valid and
   must not be altered.
4. **Restart or resume the coordinator** for one pass, since it is offline; without that, this request and `-049` and
   `-050` sit in the queue unreviewed.

## 7. What is still not built, and why that is a separate lane

The *measurement* table - whether gold travels more or less than usual while each accepted factor state is on, on the
1/2/3/5-session ladder - remains specified in `docs/strategy/FACTOR_TABLE_SPEC_20261003.md` and unbuilt. It needs the
`gold-declared-band-measurement-026` work to run, and that window's own activity record still shows a pause from
2026-09-25 with nothing filed since. That is a separate dependency from this publish and is not claimed here.

## 8. Checks a reviewer can run

```powershell
# 1. the candidate and its identity, as they are in this worktree
node D:/trading-agent-dashboard-codex/.local/worktrees/strategy/tmp/make-what-moves-gold.js
# expects: problems: none, 10 factor rows, 28 readings, 10 groups, weight total 100, 0 bare LF,
# and the two hashes recorded in section 1

# 2. the two hashes, independently of the generator
$f='D:/trading-agent-dashboard-codex/.local/worktrees/strategy/docs/strategy/WHAT_MOVES_GOLD_CANDIDATE.html'
(Get-Item $f).Length
(Get-FileHash $f -Algorithm SHA256).Hash.ToLower()

# 3. after the publish, the live page
$u='https://kevincreedycars-debug.github.io/trading-agent-dashboard/what-moves-gold.html'
$r=Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 25
$b=[System.Text.Encoding]::Latin1.GetString($r.Content)
"$($r.StatusCode) $($r.RawContentLength) $(([regex]::Match($b,'<title>[^<]*</title>')).Value)"
"readings printed: $(([regex]::Matches($b,'class=\"hash\"')).Count)  groups: $(([regex]::Matches($b,'class=\"group\"')).Count)"
```

The live check must reproduce the blob hash for the LF form, or the content, exactly as section 1 records it.

## 9. Provenance of this turn's reads

Read read-only this turn: `scripts/coordination.js check --worker strategy`; `monitor-state.js snapshot` at
`2026-10-04T11:31:04Z` (controller offline, 3 pending); `.local/orchestration/controller/status.json` (`paused`);
`.local/orchestration/replies/strategy/` (newest reply
`20261003-strategy-user-answers-stamp-field-and-factor-table-048.json`, unparseable JSON) and
`.local/orchestration/inbox/strategy/` (newest filing `-050`, no reply); `logic/agent_gold_direction.md` (the weights
table and each `Weight: n` line); `backtester/lib/gold_source_readiness.js` (the 28 declared names);
`backtester/registries/gold_variable_horizon_context.v1.json` (28 entries, their `factor` field and their labels);
the published census page `.local/worktrees/gold-view-tidy/gold-backtest-outcomes.html` (the palette rules and the
shared nav block, for copying only); this lane's own notes. Nothing outside this worktree and its ignored `tmp/` was
written, and none of the reads above changed any file.


