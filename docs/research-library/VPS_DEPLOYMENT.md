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
  password there is no second route. That step is the **live-trader lane's**, and on `vps/cutover-20261027` it has
  become `scripts/bootstrap-live-trading-vps-access.ps1` (`-Status`, then `-ConfirmThumbprint <thumbprint read in
  the Contabo console>`); that lane's notes record the same state from its side - nothing typed, nothing run. This
  lane depends on that one route and deliberately installs no second one: the same key pair, `.local\vps-access\id_ed25519`,
  and the same narrowed doors. Duplicating it would mean two mechanisms fighting over one `sshd_config`.
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

Step 0 is not this lane's: the live-trader lane's `scripts/bootstrap-live-trading-vps-access.ps1` (branch
`vps/cutover-20261027`) turns one typed password into key-only access - `-Status` first, then
`-ConfirmThumbprint <thumbprint read in the Contabo console>`. This lane runs no access step of its own and installs
no second mechanism; it reuses that key pair, that pin and that sshd configuration. After that block has run,
everything below can be driven from this PC over SSH, and none of it needs a password in a command line.

1. **Read what the box is**, before changing it:
   `ssh -i .local\vps-access\id_ed25519 Administrator@158.220.87.240 "hostname; Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, WindowsInstallationType; Test-Path $env:SystemRoot\explorer.exe"`
   Desktop Experience is only needed for the trader's terminal. The research pass needs no desktop; it is
   recorded anyway because one box hosts both.
2. **Runtimes**: node 22 LTS and git for Windows. `node --version` has to answer from a bare `cmd.exe`, because
   that is what the generated wrapper calls.
3. **Carrier**: the Codex CLI build that answers `gpt-6-astra` - `npm i -g @openai/codex@0.164.0`, pinned, per
   [EXECUTION_ROUTE.md](../research/pipeline/EXECUTION_ROUTE.md) - then one sign-in **by the account the task will
   run as**: `codex login`. The carrier reads `%USERPROFILE%\.codex\auth.json` and nothing else. No
   `OPENAI_API_KEY` is set on the host, so the API-key route is absent - but that is not the same as "no paid
   spend": the ChatGPT sign-in itself carries a purchased-credit balance the account may draw on once the included
   allowance runs out (§5), which is what the credit baseline is for.
4. **Checkout**: `git clone https://github.com/kevincreedy-debug/trading-agent-dashboard.git C:\astra-research`,
   then `git checkout research/hosted-worker-20261027`. One checkout per process: a publish must not move code
   under a running pass.
5. **The suite, on the host** - the focused set that is green here:
   `node --test tests/research_worker.test.js tests/research_pipeline.test.js tests/research_library.test.js`.
   The browser suites need Playwright's Chromium and are not part of a host build.
6. **The two secrets**, for the account the task runs as, typed at a no-echo prompt and never in a command line:
   `%USERPROFILE%\.trading-agent-dashboard\scripts\set-credential.ps1 -Name RESEARCH_WORKER_EMAIL`, then the same
   for `RESEARCH_WORKER_PASSWORD`, into the DPAPI store that account owns. Both names are in
   `config/credential-manifest.json`; on the host, run `scripts\bootstrap-local-secrets.ps1` first, because the
   private store keeps its own copy of the manifest and will refuse a name that copy does not list. The wrapper
   then starts the pass through `load-credentials.ps1 -Name RESEARCH_WORKER_EMAIL,RESEARCH_WORKER_PASSWORD -Command
   node -Arguments ...`, so the values exist only in the pass's own process.

   **The account itself.** It is one Supabase auth user plus one row in `public.research_members`, created by the
   owner's existing administration route - the project's service-role key, held only on this PC in the DPAPI store,
   used for `POST /auth/v1/admin/users` and `POST /rest/v1/research_members` (the same two calls
   `scripts/research_library_page_check.js --provision` makes for a throwaway account). The service-role key never
   goes to the host, the dashboard, the repository or a log. Least privilege is structural, not a policy we wrote:
   `supabase/research-uploads.sql` revokes everything on `research_documents`, `research_members` and the bucket
   from `authenticated` and grants back only `select` and `insert` on documents, `select`/`insert` on the bucket's
   objects, and `execute` on `is_research_member()`. A member cannot update or delete a row, cannot manage objects
   it does not own, cannot add another member, and sees nothing at all until its row is in `research_members`. The
   account is proved after creation by signing in with the publishable key the page already carries and checking
   that a document read succeeds while a `research_members` insert and an admin call are both refused.
   **Still missing on 2026-10-27: the address.** No address has been designated for this account, and one is not
   invented here. The password half exists already: one was generated on this PC from
   `System.Security.Cryptography.RandomNumberGenerator` - 28 characters, lower case, upper case, a digit and one of
   `!@#%^*-_=+` all guaranteed - stored straight into the DPAPI store as `RESEARCH_WORKER_PASSWORD`, read back and
   compared in the same process, never printed and never in a file. So naming the address is the remaining step:
   create the user with that password, insert the membership row, store the address, and type the same password
   into the host's store at step 6.
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
   the gate on. That import also records the reading's credit balance as the baseline; a later reading with a
   lower balance answers `provider_credits_spent` and stops the pass until a person runs
   `node scripts/research-pipeline.js allowance --rebaseline-credits`.
   `node scripts/research-pipeline.js allowance` has to answer `provider_ok` with both windows and
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
   unreadable one, a stale one, a refusal, a fallen credit balance or a window at or above the ceiling pauses the
   queue instead of dispatching into a spent allowance. After a gap longer than 90 minutes the guard is right and
   the pass stops; the way back is the one-turn seed in §3 step 9, run by a person, never a probe turn the pass
   gives itself.
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
  unreadable, missing, stale (older than 90 minutes), refused, a credit balance that has fallen, or any window at
  or above the ceiling. **The ceiling is one number and it is applied to every window the reading carries** - the
  five-hour `primary` and the weekly `secondary` alike - so `--capacity-percent 75` means 75% of the five-hour
  window *and* 75% of the weekly one. There is no separate weekly threshold to set, and no window is excused.
- The gate stops a run **from starting** at or above 75. It cannot know what a run will consume, so a pass that
  starts at 74% can finish above 75. What bounds that is the shape of the pass rather than the gate: one stage per
  pass (`--max-stages 1`), one pass at a time (`IgnoreNew`), a 6/1 dispatch count, and a reading imported before
  every pass, so the next pass sees where the last one ended. The 25 points left to the owner are the point of
  choosing 75 over 85 here; that choice was the owner's, and it is a start gate, not a measurement.
- **Purchased credits are reachable on this route, and do not depend on `OPENAI_API_KEY`.** Verified from the
  rollout this PC wrote on 2026-10-25: `auth_mode` is `chatgpt` and `OPENAI_API_KEY` is null, and the same
  `rate_limits` event carries `credits { has_credits: true, unlimited: false, balance: "144.7441982500" }` with
  `spend_control_reached: null`. `has_credits: true` is the provider saying a funded balance exists for this
  account, and a balance that large is not the included allowance. So the fallback runs through the ChatGPT
  sign-in, not through an API key: removing the key from the host removes the *API-key* route and proves nothing
  about credits. It was not tested by exhausting the allowance, and it will not be.
- What the pipeline does instead of claiming prevention: the first imported reading that carries a balance is
  recorded as a **baseline**, and `evaluateGate` refuses with `provider_credits_spent` on any later reading whose
  balance is lower. A reading never lowers the baseline - otherwise the evidence would erase itself - so the stop
  survives until a person runs `allowance --rebaseline-credits` after looking at the number. The balance is also
  kept per reading in `usage.provider.history` and in each run's receipt. The honest limit: this detects the
  first spend, it does not prevent it, which is why the 25-point headroom matters and why the first host pass is
  run by hand and watched.
- **No fresh reading exists on this PC today.** The newest rollout here was written 2026-10-25T21:06:31Z and says
  79% of the five-hour window (reset 2026-10-26T00:11:46Z) and 15% of the weekly one (reset 2026-11-01T11:07:00Z),
  plan `plus`, with a purchased-credit balance of 144.7441982500 - and no later reading on this PC to compare that
  balance against, so the most that can be said is that nothing here has observed it move. It is far older
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

Those three switches are **deployment commands, not controls on a running thing**: no task has been registered on
the host, so `-Show`, `-Pause` and `-Resume` are what the install will use once the task exists. The task state to
report today is *absent* - there is no scheduled entry, no next run and no last run on that box.

From anywhere, without a credential: the dashboard's Research Library lists each delivered stage as it is
registered, with its version, size and hash, and that stage's download is the document itself.

**Gaps, stated rather than hidden:**

- **no pass has run on the host.** Not one stage has been dispatched there, so the carrier version, the sign-in,
  the scheduled task and the reboot behaviour are planned and locally tested, not proved on that box;
- **hosted delivery is unproved end to end.** The store's backend answers correctly and every anonymous path is
  refused, but no worker upload has been made with a member account, because no member account exists yet: the
  administration route is available and rehearsed in shape, and the one input it needs is an address the owner
  designates (§3 step 6);
- **the headroom rule is a setting, not a measurement** (§5);
- **nothing here observes the host.** There is no agent on it by design. A silent task shows up only as a Research
  Library that stops gaining documents; `.github/workflows/live-trading-monitor.yml` watches the trader, not this;
- **the label instrument and the quote source are still open decisions.** They are recorded on the research lane
  and no prompt in this chain silently chooses one.

