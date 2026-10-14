# The research briefs for Astra, and where they should be clickable (2026-10-14)

Written by worker `strategy` in `docs/strategy/`, at the user's request in the same turn as the design-window build.

## What the user said

Verbatim: *"no astra is relating to the chatgpt fronteir analysis model we are going to use it for the research
tasks we have planned with the orchestartor but its being really slow I just need the resrach briefs to give it -
preferably we have these uploaded to the live dashboard area we have recently added that discuss the resarch task"*.

## What that settles

1. **Astra is the ChatGPT frontier analysis model**, the external model the user drives himself for the research
   tasks planned with the coordinator. It is not a worker in this project: the register has no such row, the mailbox
   has no such connection, and `git grep -in astra origin/main` still matches nothing. The earlier open question is
   closed by the user's own words, and the five USD session briefs are the set he means.
2. **It is not a build or a filing problem.** The briefs are already written, already status `READY_TO_SEND`, and
   already served live. Nothing was waiting on an upload.

## The five briefs, as served live on 2026-10-14

Fetched over plain HTTPS this turn; all five returned **HTTP 200**. Sizes are the served response sizes as measured,
not re-derived from the LF blobs:

| # | Live address | Served bytes | What it asks for |
| --- | --- | --- | --- |
| A1 | `https://kevincreedycars-debug.github.io/trading-agent-dashboard/docs/research/usd-session/v1/assignments/USD-SESSION-A1.price-and-risk.json` | 3,630 | field slot `field-model-1`, seven price and risk cards |
| A2 | `https://kevincreedycars-debug.github.io/trading-agent-dashboard/docs/research/usd-session/v1/assignments/USD-SESSION-A2.rates-releases-calendar.json` | 3,797 | second field slot: rates, releases and the calendar |
| A3 | `https://kevincreedycars-debug.github.io/trading-agent-dashboard/docs/research/usd-session/v1/assignments/USD-SESSION-A3.reviewer-a-mechanisms.json` | 2,823 | reviewer A: mechanisms |
| A4 | `https://kevincreedycars-debug.github.io/trading-agent-dashboard/docs/research/usd-session/v1/assignments/USD-SESSION-A4.reviewer-b-methodology.json` | 3,238 | reviewer B: methodology |
| A5 | `https://kevincreedycars-debug.github.io/trading-agent-dashboard/docs/research/usd-session/v1/assignments/USD-SESSION-A5.synthesis.json` | 3,364 | synthesis across the four |

Same files on `origin/main` at `docs/research/usd-session/v1/assignments/`, each carrying status exactly
`READY_TO_SEND`. Read with them, for the model's context: `docs/research/usd-session/v1/CHECKPOINT_3.md` (the
corrected session definition, 05:00 `Europe/London` to 05:00 `Europe/London` on the next local date), the research
card schema and its template in `docs/research/usd-session/v1/research-cards/`, and
`docs/research/handoff/usd/v1/USD_SYSTEM_CONTEXT.md`.

Honest limits, stated rather than glossed: these sizes are one fetch each, not a byte-for-byte comparison against
the stored blobs; no model output and no filled card exist anywhere yet; and two of the five files have uncommitted
edits in the coordinator's working copy, so the live copies quoted here are the ones `main` serves.

## "Uploaded to the live dashboard area" - what is already true and what is missing

- The live site is served from the repository root of `main`, so these briefs are **already reachable on the live
  site** at the addresses above. Nothing needs uploading, publishing or deploying for the user to hand them to Astra
  today.
- What is missing is a **clickable list on the page that discusses the research task**: the USD Logic Dossier,
  `usd-layer1-logic.html` (top bar label "USD Logic Dossier"). The site switches Jekyll off with a root `.nojekyll`
  file, so there is no directory listing to browse to; a small block of five links on that page is the way this
  becomes one click.
- That block is a page change, and this advisory lane publishes nothing. It is the first task recorded for the new
  `dashboard-design` window, which puts it to the user before changing anything and publishes only on his go-ahead in
  that window; the coordinator's `dashboard` workstream is the other lane that may carry it.

## Update the same day, later

The user's next turn resolved the last word and asked for three things at once: this briefs answer, the reply-style
instruction for the other windows (`REPLY_STYLE_PASTE_IN_20261014.md`), and the design window itself, with full
permission to build it without a coordinator cycle. The window exists as of this file's commit - see the notes entry
for the build record.
