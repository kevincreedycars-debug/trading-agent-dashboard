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

It matters here because the published tree is 596 files and 80.4MB, of which 56.8MB is five
`data/backtester-checker-*` files that the research tabs pull on demand, and the whole of it is republished every
1200s. Left alone, the expectation is another red Pages run every few days. Two levers exist and neither was taken in
this change, because both touch production publishing and belong in their own cycle with the owner's decision: publish
less often, or replace the legacy Pages build with a workflow this repository owns (a slimmed artifact plus one retry
before the run goes red).
