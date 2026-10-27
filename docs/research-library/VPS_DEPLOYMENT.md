# Running the research pass on the always-on host

Written 2026-10-27, before anything of this lane exists on the host. It states what was verified from this PC,
what is still missing, and the build order for the day the host is reachable. Nothing here is a claim that a pass
has run on the host, that a stage has been delivered from it, or that the dashboard has served a new document.

## 1. What was verified from this PC on 2026-10-27

| Check | Result | How it was read |
| --- | --- | --- |
| host exists and answers | **yes** - `158.220.87.240`, ICMP echo replies | `Test-Connection`, `Test-NetConnection` |
| RDP reachable | **yes** - TCP 3389 open | plain TCP connect |
| SSH reachable | **no** - TCP 22, 8080, 445, 80, 443 all refused | plain TCP connect |
| WinRM | TCP 5986 answers TLS 1.3, 5985 closed | TLS handshake, no credential used |
| first-login password | **not held anywhere on this PC** | `validate-credentials.ps1 -Scope vps-host`: `VPS_HOST` and `VPS_RDP_USER` present, `VPS_RDP_PASSWORD` missing |
| key pair for the host | present: `.local\vps-access\id_ed25519(.pub)`, public half already written into the one-time block in [VPS_ACCESS_HANDOFF.md](../live-trading/VPS_ACCESS_HANDOFF.md) §3 | file read, `ssh` client 9.5 present |
| this PC's public address | `46.208.115.96`, which is the `$from` that block narrows both doors to | `api.ipify.org` |
| live trader | `ftmo-1` enabled, snapshot 694s of 900s, heartbeat 623s, armed - **running from this PC** | `node scripts/check-live-trading-publication.js` |
| hosted research store | **not configured**: `RESEARCH_WORKER_EMAIL`, `RESEARCH_WORKER_PASSWORD` missing | `lib/research_hosted_store.js` `config()` |
| hosted backend itself | bucket exists and is private, table exists, anonymous insert and read refused | `node scripts/verify-research-upload.js`, exit 0 |

Two consequences follow, and they are the whole reason nothing of this lane is on the host yet:

- **the host cannot be logged into from here.** OpenSSH is not installed there, so the keyed route in
  [VPS_ACCESS_HANDOFF.md](../live-trading/VPS_ACCESS_HANDOFF.md) §3 has not been run, and without the first-login
  password there is no second route. That block is one elevated PowerShell pasted over RDP, and it is the single
  owner action this deployment waits on.
- **a pass could not deliver even if it ran.** The worker refuses before it starts a carrier while the store is
  unconfigured, so the only difference between registering the task now and not registering it is a log full of
  the same refusal.

## 2. Isolation: what this lane may and may not touch

The research pass is a second, unrelated process on a host whose first job is the live trader. It is separated on
every axis that a shared machine can confuse:

| Axis | Research | Trader (for contrast) |
| --- | --- | --- |
| checkout | `C:\astra-research` | `C:\live-trading` |
| task | `AstraResearchPassUSD` | `LiveTradingTraderTick019`, `LiveTrading1FeedTick` |
| log | `<root>\tmp\research-worker.log` | `<root>\tmp\live-trading-*.log` |
| queue, allowance, receipts | `<root>\.local\research-pipeline\` | none |
| scheduled priority | `8` (below the default 7) | default |
| window | one pass per 30 minutes, `IgnoreNew` | one tick per 5 minutes, `IgnoreNew` |
| authority | nothing | orders through `tools/mt5-bridge/live-trading-order.py` |

Rules that make that table true rather than decorative:

- the pass writes only under its own checkout: `data/research-library/documents.json`, `.local/research-library/`
  and `.local/research-pipeline/`. It reads no `data/live-trading*.json` and no file it writes is read by the
  trader, the feed producer or the publisher;
- a research report is **evidence**, not an instruction. Nothing in the pass can change a trading configuration,
  an order, a weight or a production signal, and enabling this task is not a change to the live system;
- the 25 factor chains stay independent and the final asset synthesis stays locked until all 25 are complete. The
  supervisor enforces both, so a pass cannot walk past a parent it has not delivered;
- the trader wins any resource argument. The task priority is 8, the pass is bounded to one stage, and the carrier
  timeout is 40 minutes so a stuck provider call cannot hold a core indefinitely.


## 3. Build order on the host

After the §3 access block has run, everything below can be driven from this PC over SSH, and none of it needs a
password in a command line.

1. **Read what the box is**, before changing it:
   `ssh -i .local\vps-access\id_ed25519 Administrator@158.220.87.240 "hostname; Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, WindowsInstallationType; Test-Path $env:SystemRoot\explorer.exe"`
   Desktop Experience is only needed for the trader's terminal. The research pass needs no desktop; it is
   recorded anyway because one box hosts both.
2. **Runtimes**: node 22 LTS and git for Windows. `node --version` has to answer from a bare `cmd.exe`, because
   that is what the generated wrapper calls.
3. **Carrier**: the Codex CLI build that answers `gpt-6-astra` - `npm i -g @openai/codex@0.164.0`, pinned, per
   [EXECUTION_ROUTE.md](../research/pipeline/EXECUTION_ROUTE.md) - then one sign-in **by the account the task will
   run as**: `codex login`. The carrier reads `%USERPROFILE%\.codex\auth.json` and nothing else; no
   `OPENAI_API_KEY` is set on the host, which is also what keeps the paid API out of the route.
4. **Checkout**: `git clone https://github.com/kevincreedy-debug/trading-agent-dashboard.git C:\astra-research`,
   then `git checkout research/hosted-worker-20261027`. One checkout per process: a publish must not move code
   under a running pass.
5. **The suite, on the host** - the focused set that is green here:
   `node --test tests/research_worker.test.js tests/research_pipeline.test.js tests/research_library.test.js`.
   The browser suites need Playwright's Chromium and are not part of a host build.
6. **The two secrets**, for the account the task runs as, typed at a no-echo prompt and never in a command line:
   `%USERPROFILE%\.trading-agent-dashboard\scripts\set-credential.ps1 -Name RESEARCH_WORKER_EMAIL`, then the same
   for `RESEARCH_WORKER_PASSWORD`, into the DPAPI store that account owns. Both names are in
   `config/credential-manifest.json`. The wrapper then starts the pass through `load-credentials.ps1 -Name
   RESEARCH_WORKER_EMAIL,RESEARCH_WORKER_PASSWORD -Command node -Arguments ...`, so the values exist only in the
   pass's own process. The account named there must be a row in `public.research_members`, because the bucket and
   table policies in `supabase/research-uploads.sql` admit members only.
7. **Prove it read-only, before any task exists**: `node scripts/research-pipeline.js status` (queue and
   allowance), then `node scripts/research-worker.js --dry-run --max-stages 1 --asset USD` (plans the next stage,
   spends nothing, imports no reading).
8. **Register the task**: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-research-worker-task.ps1 -Test`,
   then the same command without `-Test`. The self test runs the launcher against a dry run in its own state root
   and checks that the production wrapper and task definition are unchanged by it.
9. **The first reading, then the first bounded real pass.** A fresh host has no Codex rollout, so the provider
   half of the allowance has nothing to read and a guarded pass would refuse before spending anything - correctly,
   because it cannot know the window. Produce one reading on the host first:
   `codex exec -m gpt-6-astra "reply with the single word ready"` (one short turn, its own rollout, no report),
   then `node scripts/research-pipeline.js allowance --latest-rollout` to import it and
   `node scripts/research-pipeline.js allowance --provider on --capacity-percent 75 --max-age-minutes 90` to turn
   the gate on. `node scripts/research-pipeline.js allowance` has to answer `provider_ok` with both windows and
   their reset times before a real pass is allowed to run. Then run one pass by hand, in front of the task, so the
   first carrier run is watched rather than scheduled:
   `node scripts/research-worker.js --max-stages 1 --stage red_team --asset USD`. Its receipt, its hosted row and
   its dashboard stage are the end-to-end proof; only then is the task left enabled.


## 4. Unattended: what it does on its own, and what stops it

One pass, in this order, stopping at the first refusal:

1. `recover()` releases claims left by a pass that died mid-stage. A reboot is therefore a normal event: the next
   pass re-derives the queue from `data/research-library/documents.json` and continues, so a stage that was claimed
   but never delivered is retried rather than duplicated.
2. the provider reading is imported from the newest rollout under the task account's Codex home. No rollout, an
   unreadable one, a stale one, a refusal or a window at or above the ceiling pauses the queue instead of
   dispatching into a spent allowance.
3. the hosted store is asked whether it is configured. Unconfigured means the pass stops **before** a carrier
   starts, so no allowance is spent on an answer the dashboard cannot serve.
4. the next runnable stage is dispatched, the carrier runs, and the answer is verified against the run's own
   record: the same thread in the event stream and the rollout, the model the runtime recorded, a completed
   `web_search` where the stage needs a source, and the exact bytes in the rollout's assistant messages.
5. delivery goes to the hosted store first and is read back, the local registry second, the receipt last.

Duplicate protection is structural rather than hopeful: `IgnoreNew` on the task, a live claim on the queue that a
second pass skips instead of fighting over, and `recover()` for the claim a killed process left behind.

## 5. Allowance, stated exactly

- The dispatch count (`limit 6`, `reserve 1`) is the operator's own budget. It is **not** the ChatGPT allowance
  and must never be read as one.
- The provider half is the plan's own numbers, imported from a rollout the carrier wrote. `evaluateGate` refuses on
  unreadable, missing, stale (older than 90 minutes), refused, or a window at or above the ceiling. The ceiling is
  85% and the remaining 15% is the owner's.
- The gate stops a run **from starting** at or above the ceiling. It cannot know what a run will consume, so a run
  that starts at 84% can finish above 85%. Until that is measured, the unattended ceiling on the host is set
  below 85 (`allowance --provider on --capacity-percent 75 --max-age-minutes 90`), which leaves roughly ten points
  of room for the run itself and still 25 for the owner. It is a placeholder with a reason, not a proof.
- Purchased-credit fallback is prevented by absence rather than by a switch: no `OPENAI_API_KEY` exists on the
  host, the carrier signs in with the ChatGPT plan account only, and the pipeline has no billing path at all. The
  rollout's `credits` block is recorded in the allowance state, so a balance that starts moving shows up in
  `status` rather than in an invoice.
- **No fresh reading exists on this PC today.** The newest rollout here was written 2026-10-25T21:06:31Z and says
  79% of the five-hour window (reset 2026-10-26T00:11:46Z) and 15% of the weekly one (reset 2026-11-01T11:07:00Z),
  plan `plus`, with a purchased-credit balance of 144.7441982500 that this route has never spent. It is far older
  than the 90-minute limit, so the gate refuses it rather than pretending it is current - which is why the first
  reading for the host has to be produced on the host (build order, step 9), and why "next reset" cannot be stated
  for the present window until that run exists.

## 6. Watching it, pausing it, and the honest gaps

```powershell
# on the host, or over ssh
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-research-worker-task.ps1 -Show    # state, next run, queue, allowance, last log line
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-research-worker-task.ps1 -Pause   # no new pass starts; delivered work is untouched
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-research-worker-task.ps1 -Resume  # re-reads the registry and the allowance
node scripts/research-pipeline.js status                                                               # the same numbers without the task
```

From anywhere, without a credential: the dashboard's Research Library lists each delivered stage as it is
registered, with its version, size and hash, and that stage's download is the document itself.

**Gaps, stated rather than hidden:**

- **no pass has run on the host.** Not one stage has been dispatched there, so the carrier version, the sign-in,
  the scheduled task and the reboot behaviour are planned and locally tested, not proved on that box;
- **hosted delivery is unproved end to end.** The store's backend answers correctly and every anonymous path is
  refused, but no worker upload has been made with a member account, because no member account exists yet;
- **the headroom rule is a setting, not a measurement** (§5);
- **nothing here observes the host.** There is no agent on it by design. A silent task shows up only as a Research
  Library that stops gaining documents; `.github/workflows/live-trading-monitor.yml` watches the trader, not this;
- **the label instrument and the quote source are still open decisions.** They are recorded on the research lane
  and no prompt in this chain silently chooses one.

