# The daily failure email, 2026-11-07

Two different workflows were failing, and only one of them was the owner's pipeline. This records both, what was
changed for the first, and what is still open on the second.

## 1. `live-trading-monitor`: the alarm was set below the cadence it measures

The check itself worked. It asked the published URLs, got real ages, and failed the run — correctly, by its own
rule. The rule was wrong: it judged the served copy against the snapshot's own `stale_after_seconds` (900s, the
page's badge, which answers "is this bar still tradeable"), while the publisher writes a new copy on a 1200s cycle.
Any moment in the second half of a cycle was therefore a guaranteed red run from a pipeline that had never stopped.

The runs, read back out of their own logs, with the ages each one carried:

| run | at (UTC) | lanes doc age | snapshot age | heartbeat age | what failed |
| --- | --- | --- | --- | --- | --- |
| 42359560264 | 2026-11-07T09:23:55 | 780s | 815s | 1044s | heartbeat only |
| 42330755100 | 2026-11-07T02:45:08 | 853s | 888s | 1118s | heartbeat only |
| 42309646979 | 2026-11-06T23:07:04 | 968s | 1004s | 1233s | snapshot + heartbeat |
| 42268677358 | 2026-11-06T18:13:16 | 1340s | 1375s | 1604s | snapshot + heartbeat |
| 42210484940 | 2026-11-06T11:28:24 | 1049s | 1084s | 1312s | snapshot + heartbeat |

Every age in that table is a publish that happened. The lanes document age of 780s to 1340s says publication is
running; nothing here is a stopped publisher, a dead terminal or a wrong account. The worst age observed across the
five runs is 1604s.

**Where the 1200s cycle comes from.** The publish commits on `main` are 1200s apart at a fixed offset —
`09:30:57`, `09:50:57`, `10:10:57`, `10:30:57`, `10:50:57` — each carrying a snapshot stamped twenty seconds into a
`:10`/`:30`/`:50` minute. The repository's own registration defaults are a 600s repetition for the lanes publish task
and `--min-interval-seconds 600` for its gate, and a run that starts a few seconds after the mark records its publish
a few seconds after the mark, so the following tick lands inside its own gate and is refused: every second tick
carries the publish. That reading fits every commit in the list. It is a reading rather than a proof — nothing in
this checkout can see the host's registered task — but it is the reading that fits both numbers, and it is the one a
later lane should test against the VPS before changing either value.

Both numbers are in one file, so the arithmetic can be read here rather than on the host:
`register-live-trading-lanes-publish-task.ps1` registers the tick at `$IntervalMinutes = 10` and passes
`--min-interval-seconds $MinIntervalSeconds` with `$MinIntervalSeconds = 600`, which makes the gate exactly the
repetition — a tick that publishes leaves the next one standing on the gate's own edge. The unmerged
`fix/publish-cadence-stamp` branch from 2026-11-02 already built the instrument that records these refusals on the
host (`last_run_*` on every run, plus `last_refusal_*` and a `refusal_count` for `refuse`, `too_soon` and `locked`),
and its notes record 1,128s between commits and 1,412.6s of served age under the older 540s gate: the same shape,
with a larger number, which is why the allowance here is 1800s rather than the cycle plus a little. Two refusals in a
row would put the page past 1800s and still fail the run, which is the intent: the allowance covers one missed tick,
not a publisher that has stopped.

**The change:** `scripts/check-live-trading-publication.js` now judges the served copy against the allowance it is
given rather than against the snapshot's own badge, and both allowances default to 1800s — the 1200s cycle, one
300s bar, and a margin. A heartbeat is read at publish time and can already be a bar old before the publish, which is
why 1044s of heartbeat age is the ordinary shape of a healthy cycle and not a fault. The declared badge window is
still reported, as `declared_window_seconds` beside `window_seconds`, and a copy served past the badge but inside the
cycle gets a note saying so and stays green. What has not moved: exit 0/1/2 still mean fresh / stale-or-mismatched /
unreadable, an identity mismatch still fails, a declared heartbeat that is not published still fails, and a silence
longer than the allowance still fails at the allowance's scale. The difference is that the alarm is now set at the
cadence it is measuring, and the workflow says so in its own header rather than inheriting a number from the page.

Detection is not slower in any way that matters: GitHub runs this workflow roughly five times a day rather than every
fifteen minutes (the workflow's own header has recorded that since 2026-11-02), so a 900s threshold never gave
sub-hour detection in the first place.

## 2. `pages build and deployment`: GitHub's own deploy step times out

Separate workflow, separate fault, and not the pipeline. The build is green in about nine seconds; the deploy step
then polls `Current status: syncing_files` until GitHub's ten-minute cap and aborts:

```
Getting Pages deployment status...
Current status: syncing_files
...
##[error]Timeout reached, aborting!
Canceling Pages deployment...
Canceled deployment with ID d0d11a544d6232b829e92e91389be452318b2b51
```

(run 42369905329, 2026-11-07T11:51:01, deploying `d0d11a54`, the 11:50 publish. The build job in that same run took
nine seconds, from 11:51:04 to 11:51:13; the deploy job took ten minutes and eight seconds and then aborted.) The
neighbouring runs succeeded in the same minutes with the same kind of content, so nothing about what is being
deployed differs between a run that fails and a run that passes.

Over the last hundred Pages runs — 2026-11-06T07:11 to 2026-11-07T14:11 — GitHub recorded 83 successes, 13 failures
and 4 cancellations, and the failures are three shapes of one problem:

- nine timed out in `syncing_files` with `Timeout reached, aborting!` (42369905329, 42360059266, 42302704870,
  42246865314, 42203261311, 42318694012, 42312412686, 42274407549, 42231648503);
- three were refused before they started, `Failed to create deployment (status: 400) ... due to in progress
  deployment. Please cancel <deployment> first or wait for it to complete` (42320714667, 42314543637, 42305294834) —
  the tail of a previous stall: the deployment that timed out was not always cleared, so the following publish could
  not create one at all;
- one reached `deployment_queued` and was told `Deployment failed, try again later.` (42268356151).

The four cancellations were pushes superseding each other at 06:05 and 09:20 and are not failures. What is served is
unaffected throughout: the site is correct, and the next publish twenty minutes later deploys clean. On this side of
the fence the workflow is generated by GitHub, has no repository file to edit and cannot be retried from the
repository, so nothing in this checkout can stop these runs failing on GitHub's own deploy step.

It matters here because the published tree is 597 files and 80.4MB (84,316,485 bytes, measured on `origin/main` at
`d5aa8b16`), of which 56.7MB is five `data/backtester-checker-*` files read only by the Backtest Checker sub-tab, and
the whole of it is republished every 1200s. Left alone, the expectation is another red Pages run every few days.

**There is no per-file deploy to reach for.** Pages here is legacy branch publishing: `build_type: legacy`, source
`main` at `/`, and `.nojekyll` in the tree, so GitHub builds the branch and deploys a fresh snapshot of the whole tree
on every push. Git itself sends only the changed files - the publisher's 1200s commit carries one snapshot document -
but the deployment step then syncs all 80.4MB of the artifact, and a step that syncs 80.4MB every twenty minutes is
what stalls at the ten-minute cap. Switching to `actions/deploy-pages` does not change that arithmetic (the artifact
is still the whole site), so the lever that matters is the size of the tree, or the frequency of pushing it.

Three levers exist. The first was taken on 2026-11-07 and is section 3; the second and third touch the host's cadence
and a Pages setting that only the owner can change, and neither is done here:

1. **Make the published tree smaller.** Done, in section 3: the five checker files were 70.5% of the bytes GitHub had
   to sync on every publish, and they are now off the published tree and served from a frozen branch instead, leaving
   23.7MB a deploy. The rest of the tree is the dashboard's own documents and no single file is large enough to be
   worth the same treatment.
2. **Publish less often.** The cadence and its 600s gate are the subject of section 1; a slower cycle is cheaper here
   and slower to notice a stopped publisher, so the two cannot be decided apart.
3. **Own the deployment.** Set Settings → Pages → Build and deployment → Source to `GitHub Actions` and add a workflow
   that uploads the site as an artifact and calls `actions/deploy-pages`, with one retry before the run goes red. That
   setting is the owner's to change, and the workflow file is a change this repository has to make first; neither is
   done here.

## 3. The freeze: the published tree drops from 80.4MB to 23.7MB

Taken on 2026-11-07 on the owner's instruction - the checker is not in use, so it should be frozen until it is.

**What moved.** The five `data/backtester-checker-*` corpora - 59,453,494 bytes, 70.5% of the published tree - are off
`main` and on a branch of their own, `frozen/backtester-checker-20261107`: an orphan branch whose tree is exactly those
five files and nothing else, so it cannot be mistaken for a site and cannot be published by accident. `main`'s tree
goes from 597 files and 84,316,485 bytes to 592 files and 24,862,991 bytes. The blobs are the same objects in the same
repository: nothing was regenerated, re-encoded or re-versioned, and `git log --follow` on any of the five still reads
straight through the removal.

**Why the sub-tab still works.** The only reader is the Backtest Checker sub-tab (`index.html`,
`data-backtest-tab="checker"`, inside "Historical Research Accuracy and Backtest Checker"), and its five URLs are the
`checkerDataUrls` block at the head of `script.js`. Those five now point at `raw.githubusercontent.com` on the frozen
branch, which serves them with `Access-Control-Allow-Origin: *` and no redirect. Each was read back on 2026-11-07 and
answered `HTTP/1.1 200 OK` at exactly its committed byte count - 20,830,766 / 13,587,160 / 8,784,728 / 8,472,623 /
7,778,217 - before the URLs were committed. The read is the same `fetchLocalJson` call it always was, so the sub-tab
still loads them in one click, and a failed read degrades exactly as it already did:
`resolveResearchTask("checker.USD", fetchLocalJson(...), null)` yields an empty checker table rather than taking the
tab down.

**What it does to the email.** Nothing directly, and that is the point: the deploy step's cost is the size of the tree
it syncs, and every push now syncs 23.7MB instead of 80.4MB. This does not make the deploy free and does not make a
timeout impossible; it removes 70.5% of the work from a step that was being handed all of it every 1200s.

**What still asks for them on disk, and how.** Two kinds of local work read the corpora from a path rather than a
URL: the builders, `backtester/lib/factor_edge_lab.js` and `backtester/scripts/validate_adr_reach_research.js` (all of
which still name `data/backtester-checker-*`), and four cases in `backtester/tests/confidence_calibration.test.js`,
which re-verify the committed `data/confidence-calibration.json` against the corpus it was built from. Those four now
look in `.local/checker-corpus` first, fall back to `data/` when the corpora are in the tree, and otherwise skip with a
reason naming the one command that fills the cache: `npm run checker:corpus` (also `node
scripts/fetch-checker-corpus.js`, `--force` to re-fetch), which pulls the five from the frozen branch into
`.local/checker-corpus` - an ignored folder - and parses each before writing it, so a truncated download is not cached
as a corpus. Local work therefore stays possible with nothing published.

**To unfreeze** into the tree, when the checker is wanted again: `git checkout frozen/backtester-checker-20261107 --
data/backtester-checker-*.json`, then point the five `checkerDataUrls` lines back at `./data/`. That restores the
previous arrangement exactly, including its 80.4MB deploys.

**Guards run on 2026-11-07.** `npm test` over this tree: 779 tests, 776 pass, 3 fail. The three are
`tests/live_trading_levels_visibility.browser.test.js` ("every symbol the artifact marks draws at least two lines each
side of its own bars"), `tests/live_trading_rule_panel.browser.test.js` and `tests/research_library.browser.test.js`,
and all three fail identically in a second worktree held at `origin/main`'s `d5aa8b16` with the same `node_modules`,
so they are this machine's browser state and not this change. The four calibration cases pass 4/4 with the corpus in
`.local/checker-corpus` and skip with their reason without it - both states were run. Each of the five raw URLs was
read back before the change and answered `200` at its committed byte count.

**The first green deploy of the smaller tree, and the lock that hid it.** The smaller tree was not what failed first.
The last 80.4MB deploy - run `42385129621`, `fd691249`, 15:11Z - timed out in `syncing_files` at 15:21:49 after its ten
minutes and left its Pages deployment `in progress`, so the freeze push (run `42386460553`, `f5b0b8ae`, 15:27Z) and the
next publish (run `42386752291`, `a84aca49`, 15:31Z) were both refused in about twenty seconds with `400 ... due to in
progress deployment. Please cancel fd691249... first`. That is the second failure shape above, and it is why a smaller
tree did not turn the next run green by itself. The stalled deployment was cleared with `POST
/repos/kevincreedycars-debug/trading-agent-dashboard/pages/deployments/<build-version sha>/cancel` - the numeric
deployment id answers `404` at that path, the build-version sha answers `204` - and one empty commit (`7cde014a`,
"chore: retry the Pages deploy after the stuck deployment lock") was pushed to `main` to ask for a deploy straight away.
Run `42387854929` for that commit went green with no timeout, and the published `script.js` carries the
`frozen/backtester-checker-20261107` URLs. Read back live after that deploy: the five raw URLs answered `200`, and the
sub-tab drew 15 tables, 3,399 rows and a USD panel reading `ROWS CHECKED 604 PASS 604 ... 0 FAIL`. The retry commit is
the one thing here that can be repeated: a refused deploy is cleared by cancelling the stalled deployment, and if the
cancel is slow to take effect, an empty push to `main` is the cheapest way to ask again.

**What is left in the 23.7MB, if a timeout comes back.** The dashboard's own documents, and none of them large enough to
be worth freezing today: `data/factor-edge-lab.json` 4.6MB, `data/live-trading.json` 2.35MB (the feed itself, written
every 1200s), `data/adr-reach-research.json` 1.46MB, `script.js` 1.03MB, `data/confidence-calibration.json` 714KB and a
664KB research handoff zip under `docs/`. The first of those is the only next candidate - 19% of the tree, read by one
lab page - so it gets the same treatment if a `syncing_files` timeout returns at this size, and not before.

**Still open:** whether 23.7MB a deploy actually clears the `syncing_files` timeouts. One green deploy is not evidence;
the claim needs the next several publish cycles, so the count of red Pages runs over the coming hours is the number to
watch, not this one run.

