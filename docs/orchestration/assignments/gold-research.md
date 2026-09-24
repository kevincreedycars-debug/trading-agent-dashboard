# Gold prospective collector activation package

Assignment: gold-qualification-activation-package-017. Published 2026-09-24.
Worker: gold-research. Worktree: D:/trading-agent-dashboard-codex/.local/worktrees/gold-research
Branch: workers/gold-research-policy-20260920. Starting HEAD: 4eea9a8.

User authorization: on 2026-09-24, after being told that the next step requires
read-only provider/network access and scoped credentials, the user explicitly said
to push forward. Assignment 016 is accepted. This assignment may validate the two
required credential names and make bounded read-only provider calls, but it does
not capture a real 014 anchor, install a scheduler or read an outcome.

Accepted bindings:

- manifest 014 SHA-256 `15cd06067a1a9fee8c6498560f4e9ab191541ee5987abc1e8f0219cff3e26f05`;
- execution contract 015 SHA-256 `208c584427c7540b6f1e712d9feac577de8e95200af2d9ad6f868390abe5910d`;
- collector commit 016 `4eea9a8`, with the four declared source adapters and the
  130-anchor / 780-item capture plan.

1. Bind every activation artifact and command to the exact accepted 014/015/016
   paths, digests, source order, schedule and parser code. Refuse aliases, drift,
   alternate providers/instruments, changed anchors and paths outside the worker.
2. Add a real-provider acquisition client for exactly FRED `DFII10`, `DGS2`,
   `VIXCLS` and OANDA `XAU_USD` H1. Calls are read-only. Use the encrypted runner
   with only `FRED_API_KEY` and `OANDA_API_TOKEN`; do not load Supabase, RapidAPI,
   n8n or unrelated credentials, and never print or persist credential values.
3. Implement an activation gate that accepts only a capture identity already in
   the frozen 780-item plan, the current clock from the operating system, and a new
   output directory. Refuse clock overrides, manual anchor overrides, backfill,
   future capture, duplicate/retry overwrite, schedule changes and any capture whose
   allowed acquisition interval has not opened.
4. Define exact acquisition intervals for pre-anchor FRED feature evidence, the
   OANDA entry candle, exact 24-hour endpoint and delayed endpoint lane. Preserve
   strictly-before-anchor availability, complete-candle semantics, no rescheduling,
   and exact/delayed separation. An unavailable call becomes a sealed reason-coded
   blocked attempt; it is never filled, retried into the same identity or shifted.
5. Keep operator-visible output metadata-only. Provider bytes and parsed values may
   exist only inside the sealed 016 envelope. Logs, stdout, indexes, monitor state
   and summaries must expose only ids, hashes, timestamps, row counts and statuses.
6. Perform only bounded pre-window provider smokes in this assignment: one small
   FRED response per declared series and one small OANDA XAU_USD H1 response whose
   requested observation interval ends strictly before `2026-09-24T14:00:00Z`.
   Seal them under a new ignored evidence directory and verify hashes/parsers. Do
   not request, acquire or inspect any observation at or after the first real anchor.
7. Produce a reviewable activation package and runbook for a later one-time install:
   exact command, credential names, capture cadence, lock/deduplication, retry and
   missed-anchor behavior, health metadata, shutdown, recovery and uninstall. The
   package may include scheduler configuration as inert text, but must not install,
   enable or start a scheduler/daemon/background process.
8. Add adversarial tests for credential overbreadth, redaction, provider/source
   confusion, clock and anchor override, early/future/backfill calls, output reuse,
   metadata leakage, missed-anchor handling and scheduler activation attempts. Run
   focused tests and `npm.cmd test`, submit one unique 017 envelope, and pause.

Owned scope: read-only provider clients, activation gate, inert scheduler package,
focused tests, pre-window ignored smoke evidence and scoped documentation. Preserve
all accepted artifacts byte-for-byte. No real 014-window capture, no observation at
or after `2026-09-24T14:00:00Z`, no outcome/readiness aggregate, no qualification
evaluation, formula, holdout, warehouse write, live workflow, Layer 1, dashboard,
integration, deployment, purchase, weight or production change. Scheduler install
and real window activation require separate coordinator review of 017.
