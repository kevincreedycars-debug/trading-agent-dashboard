# Always-on host spec: MT5 + the read-only producer on a VPS

**Status: parked, not chosen.** Written 2026-09-30 after the user asked how to keep the four-pair view
fresh without leaving their PC on, and considered against the PC route on the same day. The user then
decided to stay on the PC, so **none of this is in force and none of it has been bought, installed,
configured or connected**. It is kept because it is the only route that keeps the feed fresh with the PC
off, and because the work needed to reopen it is already written down. The companion decision record is
[STRATEGY_LIVE.md](STRATEGY_LIVE.md) section 11; the session record is
[CONVERSATION_NOTES.md](CONVERSATION_NOTES.md).

**Update 2026-10-24: the question is open again, and the build plan has moved.** The user asked how to keep the
live system trading through a week away with the PC off, so this route is being re-costed rather than
re-decided. Since this document was written the lane grew a second scheduled task that *sends* (the trader loop,
armed) and a publish step that pushes to `main`, so the moving parts and the tests are now inventoried in
[VPS_BUILD_RUNBOOK.md](VPS_BUILD_RUNBOOK.md), which is the current build plan. Nothing here has been bought,
installed, configured or connected, and this document's sizing, security and provider notes remain the reference
for it.

Every item marked *verify* is a fact to establish on the chosen host rather than an assumption carried
forward - none was established, and no price was verified, which is why no figure appears below.

## 1. What this has to achieve

| Goal | Test that proves it |
| --- | --- |
| The dashboard's live section stays fresh with the user's PC off | Snapshot age under 15 minutes while the PC is shut down |

## 1. What this has to achieve

| Goal | Test that proves it |
| --- | --- |
| The dashboard's live section stays fresh with the user's PC off | Snapshot age under 15 minutes while the PC is shut down |
| The MT5 terminal survives a reboot without a human logging in | Reboot the VPS, wait, confirm a fresh snapshot appears |
| Nothing can place an order | The deployed producer still passes the read-only allowlist test from `tests/live_trading_feed.test.js` |
| No credential leaves its machine | The published artifact contains a masked login and no token; the GitHub token never enters the repository |

## 2. Why a VPS is needed at all

MT5 is a Windows desktop application that must be running and logged in, and the `MetaTrader5` Python
package attaches to that running terminal through local IPC. Exposing the user's PC bridge port to the
internet was rejected, so the machine holding the terminal is also the machine that has to produce the
snapshot. A host that never sleeps is therefore the only way to satisfy the request. Nothing about this
is an FTMO rule; it is how the platform works.

## 3. Sizing

The workload is a desktop terminal plus a job that runs for a couple of seconds every five minutes, so
it is small:

| Resource | Minimum | Comfortable | Why |
| --- | --- | --- | --- |
| vCPU | 2 (shared is fine) | 2-4 | MT5 draws charts on one thread; candle copying is cheap |
| RAM | 2 GB | 4 GB | Windows plus MT5 plus a 24-candle-per-symbol read |
| Disk | 40 GB SSD | 60-80 GB SSD | History accumulates; MT5 keeps its own tick and bar cache |
| OS | Windows Server 2019/2022 with **Desktop Experience**, or Windows 10/11 Pro | as minimum | MT5 needs a real desktop session; Server *Core* has no desktop and will not do |
| Licence | Included by most providers | - | Confirm whether the provider prices the Windows licence separately (*verify*) |
| Location | Nearest DC to the broker's server | DC with a direct route to it | Our entry rule reads a 5-minute close, so latency is not critical, but a stable route avoids missed ticks (*verify* by ping) |

Providers seen while writing this: Contabo sells a Windows VPS line and a Forex VPS line
(`contabo.com/en/vps/`, page checked 2026-09-30), and the mainstream clouds (AWS Lightsail/EC2, Azure,
Vultr, IONOS) all offer Windows images. Anything in the class above works; the entry bundle of any of
them is the right starting point. **Prices change and none is quoted here** - read the live price and
the Windows licence line at purchase. Whether FTMO provides a VPS for this account type is *verify*: the
earlier setup session could not confirm an FTMO VPS page, so it belongs in the same support email as the
automation question.

## 4. Software to install

1. FTMO's own MT5 terminal, logged in to account `***614`. Same build family as the working local
   install (build 6231 locally) so the Python bindings behave identically.
2. Python 3.13 (the version the producer was written and tested against locally), added to `PATH`, then
   `python -m pip install MetaTrader5`. The local package version is `MetaTrader5 5.0.6231`; pin the
   same major version on the host.
3. The producer itself: `tools/mt5-bridge/live-trading-snapshot.py` from this repository. It needs no
   other project file to read the terminal; only the publish step needs Git tooling.
4. Git for Windows (only if the publish step pushes a checkout rather than using the GitHub API).
5. Task Scheduler for the 5-minute cadence.

## 5. Session and autostart constraints

MT5 requires an interactive desktop session, and the Python job must run **in the same user session** as
the terminal, because that is the IPC channel it attaches to. The practical arrangement, all of it to be
verified on the host rather than assumed:

- A dedicated local user with auto-logon enabled, and MT5 in that user's `Startup` folder so it opens on
  boot.
- The scheduled task configured to run in that same session at logon, repeating every 5 minutes.
- On Windows Server, the policy that keeps a disconnected session running rather than logging it off, so
  a closed RDP window does not kill the terminal. *Verify*: close RDP, wait 15 minutes, confirm the
  snapshot keeps updating.
- Display sleep or screen lock must not stop the process. *Verify* with the reboot test.

## 6. The producer schedule

```
python tools/mt5-bridge/live-trading-snapshot.py --path "C:\Program Files\FTMO Global Markets MT5 Terminal" --out <checkout>\data\live-trading.json
```

Run it every 5 minutes. The file is replaced whole; a failed run writes the failure snapshot with a
`note` and no instruments, which the dashboard renders as `SNAPSHOT UNAVAILABLE` rather than as old
prices. Two guardrails worth adding on the host:

- Run `node scripts/validate_live_trading_feed.js <checkout>\data\live-trading.json` before publishing,
  and skip the publish when it fails, so a malformed snapshot never reaches the site.
- Keep the previous published file so a bad run can be reverted.

## 7. Publishing to the dashboard, and the one open design point

The dashboard is static GitHub Pages, so "fresh" means the snapshot is committed and pushed on the
cadence. Two ways to do that, and the choice should be deliberate because the cadences differ:

| Option | How | Trade-off |
| --- | --- | --- |
| **A. Push `data/live-trading.json` to this repository's `main`** | The task pushes after each successful validate | Same-origin `fetch("./data/live-trading.json")` keeps working unchanged, but 288 commits a day land on the published repository and each triggers a Pages build |
| **B. Push to a small separate feed repository and fetch it cross-origin** | The task pushes to `trading-agent-dashboard-feed`; the section fetches `raw.githubusercontent.com/...` with a cache-buster and falls back to the committed copy | The main site stays quiet and the feed takes the churn, at the cost of a cross-origin fetch and a second credential scope |

Recommendation: **B**, with the in-repo snapshot kept as the labelled fallback, because 288 commits a
day on the published repository makes history unreadable and every Pages deploy noisy. It needs one
dashboard change (try the remote feed, fall back to the local file), which is deliberately not made yet,
because publishing is the step *after* the host exists.

Credential handling follows the repository's existing rule (`docs/CREDENTIAL_CONTINUITY.md`,
`config/credential-manifest.json`): secrets live in the encrypted local CLIXML credential store and are
never written into repository files or persistent environment variables. On the VPS that means a
fine-grained GitHub token scoped to the one feed repository only, exported with `Export-Clixml` **under
the service account that runs the task**, plus a manifest entry (`LIVE_FEED_GITHUB_TOKEN`, consumer
`tools/mt5-bridge/publish-live-trading-feed.ps1`) added when that script actually exists. The token must
not be able to write to any other repository.

## 8. Security requirements

- RDP: strong unique password plus either an IP allow-list or MFA, and preferably network-level filtering
  in front of it. No bare RDP on a public port.
- Firewall: inbound default deny. The producer opens **no** port; it reads the terminal locally.
- Windows Update on, with a maintenance window outside the traded session.
- The terminal's **Algo Trading** button stays off and no EA is installed until the gates in section 9
  are cleared. The Python side has no order functions in the first place.
- The snapshot carries a masked login by construction and the validator rejects a feed containing a raw
  login field, so a misconfiguration fails loudly instead of publishing the account number.
- Keep a rebuild path: image or snapshot backup of the box, plus this document.

## 9. Gates that stay closed

1. **FTMO in writing**: whether automated trading is permitted, and whether a Swing account may trade
   around news during evaluation. Nothing beyond reading runs on the VPS until that reply is stored.
2. **Rehearsals on a demo login**, in the same terminal, before any level marking happens on the Challenge
   login.
3. **The first order on the Challenge login is the strategy's own signal**, which is what ends the 14-day
   withdrawal right and satisfies the 30-day activation requirement. No test order on that login.
4. Nothing here is an edge claim, and the 5m close-beyond-level rule remains a marking and eye-checking
   rule rather than a complete order rule (section 10 of `STRATEGY_LIVE.md`).

## 10. Acceptance checklist for the build session

- [ ] Latency from the VPS to the broker's server measured and recorded.
- [ ] Reboot test: snapshot appears without human logon.
- [ ] Overnight test: 12 consecutive hours of 5-minute snapshots, no gap over 15 minutes.
- [ ] PC-off test: the dashboard reports `FRESH` while the user's PC is shut down.
- [ ] Publish test: only the feed file (or only the feed repository) is written by the task.
- [ ] Read-only test: the deployed producer passes `tests/live_trading_feed.test.js` on the host.
- [ ] Rollback test: restoring the previous published snapshot restores the earlier view.

## 11. Cost and effort, to be confirmed

- **Monthly**: one entry-class Windows VPS plus any Windows licence line item. Confirm the live price at
  purchase; no figure is quoted here because none was verified today.
- **One-off**: a build session of roughly one to two hours (install, autostart, schedule, publish,
  acceptance checklist), plus the dashboard change from option B if that route is taken.
- **Ongoing**: nothing beyond keeping the terminal logged in and the box patched.
