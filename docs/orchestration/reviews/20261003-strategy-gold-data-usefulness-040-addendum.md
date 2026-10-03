# Review: 20261003-strategy-gold-data-usefulness-040-addendum

- Worker / assignment: `strategy` / `strategy-advisory-001`
- Mailbox: `.local/orchestration/inbox/strategy/20261003-strategy-gold-data-usefulness-040-addendum.json` - 4,442 bytes, sha256 `2567d53fbdb3d10c664bf7cab8e936ded735a2eaa8f72d9d58a2e380409f5593` (reproduced from the immutable inbox file; equals the requested hash).
- Reply: `.local/orchestration/replies/strategy/20261003-strategy-gold-data-usefulness-040-addendum.json` - sha256 `63d6f9ef67974f2afcd41e6642546093f80119be99113296d0feafcf46cecd31`, decision **accepted**.
- Cycle: 2026-10-03, twelfth cycle, background dispatcher run, from the canonical checkout on branch `orchestration/control-plane-20260920`, under the controller lock that owns the run (`controller/status.json` state `reviewing`, detail this submission, pid 8184, `run.lock` owned by that pid; `controller/2567d53fbdb3d10c664bf7cab8e936ded735a2eaa8f72d9d58a2e380409f5593.jsonl` is this submission's own lock file).

## What was filed

A `status_report` and a same-turn, provenance-only correction to `20261003-strategy-gold-data-usefulness-040`, filed before any review. The lane branch tip moved from `34309cc` to `e17c260` with one docs-only commit; the read now attributes four of the ten base rates (day range 1.4472 percent of the session open, full L2L 0.7236 percent, half L2L 0.3618 percent, median close-to-close move 0.6701 percent) to the lane's own 2026-09-28 measurement of the same 570 sessions rather than to today's re-run, because the re-run scan prints the movement counts, the 1/2/3/5 ladder and its two internal assertions and does not print the size medians. No number, verdict, recommendation, blocker or question in `-040` changed. Deliverable: the two `docs/strategy/` files; nothing production-facing touched.

## Inspected evidence

- Branch state: `git rev-parse HEAD` = `e17c260edc61ebdadf432ef1cdbecdca12f3563f`; `git status --porcelain --untracked-files=all` empty.
- Ancestry and scope: `git merge-base --is-ancestor 34309cc HEAD` exits 0; `git log --parents` shows `e17c260`'s sole parent is `34309cc`; `git diff --name-only 34309cc e17c260` lists exactly `docs/strategy/CONVERSATION_NOTES.md` and `docs/strategy/GOLD_DATA_USEFULNESS_READ_20261003.md`; `git diff --numstat` gives 6/4 on the read and 8/0 on the notes (14 insertions, 4 deletions), matching the report exactly.
- Diff content: exactly the two described sentences of the read plus one notes paragraph; the four quoted figures are present in the read at lines 41-42 and 83-85.
- Document bytes: `GOLD_DATA_USEFULNESS_READ_20261003.md` 13,407 bytes, 166 lines, 0 bare LF, sha256 `25e058534fa772a98f01e4e34f38870e42327ecabdc4b2d3013600cac33e9b01`.
- Notes bytes: `CONVERSATION_NOTES.md` 258,038 bytes, 0 bare LF, sha256 `b35ddfc7d059b1e35ab20e37ab71eeccff5dbc7503fdb49b233bbf7eb857f52f`.
- CRLF/LF arithmetic: the read's LF blob at `e17c260` is 13,242 bytes (`6409a8c4994ee1054bbb1834658c04bf227648a7`) plus 165 line terminators = 13,407; the pre-correction read's LF blob at `34309cc` is 12,973 bytes (`e8f1a0f6`) plus 163 terminators = 13,136, the hash the `-040` artifact line names; the notes' LF blob moved 254,243 -> 255,057 bytes, plus 2,973 and 2,981 terminators = 257,216 and 258,038. Every reported byte figure is therefore the exact CRLF materialisation of the committed LF blob.

## Correction to the previous cycle's memory

The eleventh-cycle durable review and its reply `19c807d7ce972630ea5364fe17c7fd6ecc5db9302a893b25d7e7acd9ed3e8a28` record the new read's LF blob as `dc9256c4` at 13,242 bytes. The actual blob at `e17c260` is `6409a8c4994ee1054bbb1834658c04bf227648a7` (13,242 bytes); `git cat-file -t dc9256c4` fails with "Not a valid object name". The size was right and the short hash was a transcription error. Corrected here and in this cycle's reply; the eleventh-cycle decision is unaffected.

## Not re-derived

The four size medians remain the lane's 2026-09-28 measurement of the same 570 sessions, as the corrected read states. The re-run scan does not print them, and re-deriving them would need one added median print - a research change this filing does not authorise or make.

## Decision and rationale

**Accepted**, as an accurate, in-scope, docs-only provenance correction with every claim reproduced here. Acceptance is not adoption, execution, integration or deployment. No new bounded research assignment is published and the register is untouched: the addendum carries no new evidence, the Gold circuit is spent or sealed to `2027-03-25T15:00:00Z`, the movement lane `gold-declared-band-measurement-026` needs a register edit and the user's word, `gold-research` is already published at exactly `instructions_published_awaiting_worker` on `gold-coverage-025` for the 022 item A envelope, and R3 is a production change a background run carries no authority to raise.

## Unresolved limitations

- The read remains an exploratory diagnosis, not an accuracy qualification; the pilot's 54.88 percent on 82 scored calls is not an edge.
- The 2026-09-28 size medians are not independently re-measured in this cycle.
- The stored-call pilot's entry timing is next-minute, not authenticated publication timing.

## Unresolved decisions (the user's)

The two sequencing answers `-040` asks for (open the movement lane at all, and R1 versus R3 first); the four user answers `-040` names; the three nav choices in `-039`; whether the collector patch becomes the production priority; and, newly explicit here, whether the four size medians should be re-derived with one added median print rather than left as the marked 2026-09-28 measurement.

## Integration / deployment status

Nothing integrated, merged, published, deployed, refreshed or mutated. No assignment published, no worker status set to a publish state, no holdout or prospective observation read, no warehouse touched, no external message sent, no controller or bridge file changed, no subagent spawned. `strategy` stays `advisory_active` under `strategy-advisory-001`. Queue not reviewed this cycle (brief was the addendum alone): `20261003-backtester-harness-asset-store-and-tabs-r2` (12,820 bytes, sha256 `a727c850ca032436ce86888b9f38fc90977fa74abcd81c7c72b04dcd3f1f3d71`) and `20261003-live-trading-live-marking-and-ladder-r1` (16,209 bytes, sha256 `0896430dcf2aa7e8418f3fee7c77438195219422b37c63beac869afb85d46b0e`).
