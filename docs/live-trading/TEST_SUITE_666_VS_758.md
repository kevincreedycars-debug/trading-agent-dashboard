# 666 against 758: what the two test counts actually compare

**Status 2026-10-25. The two numbers are two different checkouts, not two qualities of the same suite.** They were
quoted next to each other in [VPS_DEPLOYMENT_STATUS_20261024.md](VPS_DEPLOYMENT_STATUS_20261024.md) because one page
cannot say "758 pass" and "666 pass" without saying which tree each came from. This page is the answer to the
question that followed: *is anything on the bigger-count checkout missing from `main`?* For live trading, no - and
the one thing that was missing is now on `main`.

## 1. The two checkouts

| | `main` line | research line |
| --- | --- | --- |
| checkout | a worktree of `main` (`8faefc8b`, 2026-10-24) | `D:\trading-agent-dashboard-codex` on `research/usd-session-20261013` (`1e6ab197`) |
| merge base | - | `125d871e` |
| commits since the base | **1504** | **300** |
| test files discovered | 63 | 101 |
| test cases reported | 666 | 758 |
| live-trading paths tracked | 42 | 13, all inherited from the merge base |

Both numbers come from `scripts/test-local.js`, and the two copies of that file are the same program: same three
directories (`backtester/tests`, `tests`, `macro-engine/tests`), same `*.test.js` matcher, same two exclusions
(`evaluation_pipeline.test.js`, `replay_smoke.test.js`), same `--test-concurrency=4`. The `main` copy adds one
`fs.existsSync` guard around each directory, which changes nothing where all three exist. **The difference is the
file lists, not the discovery rules.**

## 2. What the difference is made of

78 test files exist only on the research line: the `gold_*` families (37 files), the `l2l_*` research and session-close
suites, `usd_24h_research` and `usd_live_replay_harness`, `macro-engine/tests` (3), and 17 `tests/*` files about
collector exports, workflow drafts, monitor state and the mailbox bridge. They are research and orchestration-export
suites; none of them imports live-trading code.

40 test files exist only on `main`, and 21 of them are the live-trading suites: `live_trading_close_request`,
`live_trading_feed`, `live_trading_feed_cadence`, `live_trading_feed_publish`, `live_trading_lanes_publish`,
`live_trading_trader`, `live_trading_order_tool`, `live_trading_publication_monitor`, `live_trade_logic_tab`, six
browser suites, `master_orchestrator_schedule`, the `pair-coverage/eur` and `silver` sets, and the research-library
export/upload suites. Arithmetic: 101 - 78 + 40 = 63.

## 3. Nothing live-trading is missing on `main`

`git diff --stat origin/main research/usd-session-20261013 -- lib/live_trading* scripts/publish-live-trading*
tests/live_trading* docs/live-trading` prints 27 files and **18,193 deletions, no insertions** - every one of them is
absent from the research line, so there is no live-trading change over there to bring across.
`git rev-list --count research/usd-session-20261013 -- <the same paths>` is **0**: no commit on that branch has ever
touched a live-trading file. The research line forked from a base that predates the whole live-trading line.

The five properties the deployment was asked about are all on `main`, in code rather than in a passing test:

| Property | Where, on `main` |
| --- | --- |
| Account-scoped close requests | `lib/live_trading_close_request.js` - schema `live-trading-close-request-v2`; `normaliseAccount` refuses a row without a lane id, `-v1` is recognised on read and never handed to a loop, ids are `close-<lane>-<ticket>-<stamp>-<token>`; the shipped `data/live-trading-close-request.json` is v2 with `request_count: 0` |
| Two-account dashboard | `script.js` (`liveTradingAccounts`; the page's lane is resolved from `data/live-trading-lanes.json` by feed path), `styles.css`, `data/live-trading-lanes.json` - `ftmo-1` enabled, `ftmo-2` `enabled: false` |
| Coordinated publisher | `scripts/publish-live-trading-lanes.js` -> `scripts/publish-live-trading-feed.js` `--artifacts`: one commit, one push, lanes document and heartbeats as `extras` in the same commit |
| Snapshot before trader | the trader reads this machine's own snapshot, and the task can run the producer first (`-ChainFeed`, `--align --settle-seconds 90`; the producer samples 20s after the bar close, the loop 90s); the close-request log is fetched from the published branch into `FETCH_HEAD` |
| Publisher checkout isolation | `publish-live-trading-feed.js` `git worktree add --detach` for a real publish, a separate worktree per dry run, `worktree remove --force` + `prune` on cleanup, and a lock for a real publish |

## 4. What was integrated, and what was not

**Integrated:** `config/live-trading-lanes.json`. It was named by the publisher's `--config` default, the registration
script's `-Config` default and the trader's `--lane` message, but it was not tracked on `main` - it existed only,
untracked, in the PC worktree - so a fresh clone on a host would have failed the lanes publish on its first read. It is
on `main` now with two tests that read the shipped file through the publisher's own `loadLanes`: the two lane ids, the
two published paths, the parked second lane, and the absence of any credential-shaped key.

**Not integrated:** the research branch itself. It is 300 commits of research-library, gold and L2L work sitting on a
base 1504 commits behind `main`; merging it to raise a count would carry code nobody asked for through the same review
this page is doing, and it would not add a line of live-trading behaviour. When that work lands it needs a rebase and
its own review, and its 78 extra test files are the review, not the score.

**Not proved by any of it:** a green suite and a successful Pages build say the code in the tree does what its tests
say. They do not say the process trading the account is running that tree. `data/live-trading-lanes.json` still carries
`trader_status: null` for `ftmo-1` with the reason *"no heartbeat published yet"*, so no heartbeat has ever been
published from the machine that trades; the loop's last run (2026-10-25T19:26:30Z, lane `ftmo-1`) was unarmed
(`status: planned`, `reason: not armed: --confirm-live was not passed`), and its close-request reader did load the
published v2 document (`source: FETCH_HEAD:data/live-trading-close-request.json`, `published: 0`).

## 5. Reproducing the comparison

```
git merge-base origin/main research/usd-session-20261013
git rev-list --count 125d871e..research/usd-session-20261013    # 300
git rev-list --count 125d871e..origin/main                      # 1504
git diff --stat origin/main research/usd-session-20261013 -- lib/live_trading* scripts/publish-live-trading* tests/live_trading* docs/live-trading
```

The file lists come from `scripts/test-local.js` (printed as `Running N local test files`); the case counts come from
the suite's own `# tests` line.
