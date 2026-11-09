# ICE US Dollar Index - sample and fee request (draft, 2026-11-07)

Status: **approved by the owner on 2026-11-08 and assembled for sending; not yet sent, because no outbound mail
channel exists in the checkout** (no SMTP client, no mail credentials, and the standing rule is that no external
message is sent from here). The send-ready body is the short form below, unchanged; a copy is held outside the
repository at `.local/outbox/ice-dxy-sample-and-fee-request.txt` and as a mail file
`.local/outbox/ice-dxy-sample-and-fee-request.eml`, with the recipient address left for the sender because no
published licensing address has been verified in this checkout. The authorisation covers this enquiry only: no
purchase, no trial acceptance and no data use follows from a reply without the owner's separate decision, and
the next step when a sample arrives is to count how many saved calls it can actually score before any price is
discussed.
One letter to ICE Data Indices asking for a ten-date sample and a fee schedule for the official US Dollar Index
(USDX, ticker DXY) at two session endpoints per date. Nothing in the USD session study scores a DXY factor until
this answers, and no derived series is published either way.
Background and the sourcing decision live in `feasibility_audit_usd_vs_25factor_20261107.md` section 11; this
file is only the outbound ask.

## Why the official index and not a proxy

The factor briefs name *the dollar index*. A vendor that recomputes a dollar index is a different series with a
different weight set, a different rebalancing rule and a different history, so a study that used one could not
be re-derived by anyone holding the official number. The plan therefore asks ICE first. Twelve Data at $79 a
month was already ruled out on 2026-11-06 for exactly this reason: it is not the official series. A EUR/USD
proxy pilot may proceed in parallel, labelled as a proxy and not scored as the DXY factor.

## The series

- ICE U.S. Dollar Index (USDX), the **cash index level**, not the DX futures contract.
- Definition to be confirmed in the reply: geometric mean of six currencies against the dollar - EUR, JPY, GBP,
  CAD, SEK, CHF - with ICE's fixed weights, computed from the quotes ICE publishes.
- We ask for the index level rather than a basket of FX rates, so the weights and the rebalancing rule travel
  with the number.

## The two endpoints we need, stated exactly

Every session in this programme is **05:00 Europe/London on date D to 05:00 Europe/London on date D+1**
(`session_contract_v1.json`). Both ends are London wall-clock times one local day apart, so the feed has to
carry a value at each end:

- the level **as of 05:00 Europe/London on each session date**, and
- the level **as of 05:00 Europe/London on the following local date**;

and the conversion from London local time to UTC must be applied **separately to each endpoint**, because
London moves between GMT and BST inside a year:

| endpoint | London local | UTC in winter (GMT) | UTC in summer (BST) |
| --- | --- | --- | --- |
| session start | 05:00 on D | 05:00Z | 04:00Z |
| session end | 05:00 on D+1 | 05:00Z | 04:00Z |

Nothing is sampled at a fixed UTC hour and no session is assumed to be exactly 24 hours: the two Saturdays a
year that contain a London clock change are 23 and 25 hours long and are not sessions.

Note for ICE: 05:00 London is 00:00 New York year-round, so in ordinary weeks both endpoints fall inside one
DX week, which starts Sunday 18:00 ET and ends Friday 17:00 ET. We would like the reply to state what the DX
value is at 00:00 ET in the two mismatch windows below, when London and New York are not on their usual
offset relationship.

## The ten-date sample (our acceptance test)

Ten dates, both endpoints each, twenty values in total: ordinary weeks, both London/New York offset mismatch
windows, both London offsets, a US holiday week and a month end.

| # | date D | why this date | London offset at 05:00 | note for the sample |
| --- | --- | --- | --- | --- |
| 1 | 2026-01-20 | deep winter, ordinary week | GMT | baseline winter row |
| 2 | 2026-02-27 | month end | GMT | month-end fix behaviour |
| 3 | 2026-03-10 | US on EDT, London still GMT | GMT | mismatch week |
| 4 | 2026-03-24 | second mismatch week, before London's change | GMT | mismatch week |
| 5 | 2026-03-31 | first ordinary week after both changes | BST | baseline summer row |
| 6 | 2026-07-14 | high summer, ordinary week | BST | thin-summer liquidity |
| 7 | 2026-10-27 | London on GMT, US still EDT | GMT | mismatch week |
| 8 | 2026-11-03 | both changed, first ordinary week after | GMT | also a study date |
| 9 | 2026-11-05 | ordinary week inside the current M5 tape | GMT | compared with the tape we hold |
| 10 | 2026-11-25 | US Thanksgiving week | GMT | holiday-week behaviour |

For each of the twenty values we ask for: `date_local`, `local_time`, `tz_abbrev` (GMT or BST),
`utc_timestamp`, `index_level`, whether the level is a last consolidated print or an ICE-computed fix, and any
flag for a thin or missing print. If no level exists as a print at 00:00 ET, say so and state the nearest
published level and its distance in minutes. An interpolated number is acceptable only if it is labelled as
interpolated.

Acceptance: all twenty rows carry a timestamp and a level, and the six mismatch-window rows carry the same
kind of value as the ordinary ones.

## History and coverage

- Twenty-four months of daily 05:00 London endpoints, both ends, back to the earliest date available: about 522
  sessions and 1,044 values for the study window, and we would take everything earlier as well.
- The earliest date the cash index is available at this sampling, and whether pre-1999 history uses the same
  construction.
- Revision policy: whether a published level ever changes, and whether a revision timestamp exists.
- Whether intraday history exists (1-minute or tick) around 00:00 ET, which is what would let us check a
  timestamp rather than accept an end-of-day fix.

## Rights we need and rights we do not

Need: internal research use; storage of the raw values and of derived features (daily change, session
direction, z-scores) in a private repository; use of derived values on a private dashboard; continued use of
derived features after the licence ends for work already done.

Do not need: redistribution of the index, public display of the level, a competing index, or any claim of ICE
endorsement.

Please state: whether derived features count as redistributable material, the required attribution string, and
whether an internal-only licence differs in price from a display licence.

## Fees to quote

- Annual fee for end-of-day history plus a daily 00:00 ET snapshot, internal use only.
- Whether 05:00 London sampling is an end-of-day entitlement or needs a real-time entitlement.
- Redistribution tiers and the delay that applies to each.
- Any trial or evaluation access, and the term of a sample agreement.
- Whether the fee is per index, per user or per firm, and whether a single-seat research licence exists.

## What we will not do without a licence

Nothing derived from the index is scored, plotted or quoted. The USD session study stays on its present inputs
and the DXY factor stays unbuilt rather than proxied silently.


## Send-ready body (short form, for the first email)

> Subject: Sample and pricing request - ICE U.S. Dollar Index (USDX) at a fixed 05:00 London observation
>
> Hello,
>
> We are building an internal research study that needs one thing from the US Dollar Index: the cash index
> level as of 05:00 Europe/London on each date, for a date and for the following local date, converted to UTC
> per endpoint (05:00Z in GMT weeks, 04:00Z in BST weeks).
>
> Before any licence discussion we would like a ten-date sample, twenty values in total, covering ordinary
> weeks, both London/New York offset mismatch windows (March and late October), a US holiday week and a month
> end, with the timestamp, the level, whether it is a last consolidated print or a computed fix, and the
> history depth at that sampling.
>
> We would also like a fee schedule for: end-of-day history plus a daily snapshot, internal-use only; the
> difference, if any, between an end-of-day and a real-time entitlement for a 00:00 ET observation; the
> redistribution tiers; and any trial terms.
>
> We do not need redistribution or public display. We do need to know whether derived features (daily change,
> session direction) may be stored and reused, and what attribution string you require.
>
> Thank you.

## Internal notes before sending

- Address it to ICE Data Indices' index licensing desk, not to a market-data reseller. The desk that licenses
  USDX is the one that can answer whether 00:00 ET is a published level.
- Do not send the study's factor list. The ask is one series at one clock time.
- The mismatch windows the sample must cover, for 2026 and 2027:
  - US on EDT before London changes: 2026-03-08 to 2026-03-28; 2027-03-14 to 2027-03-27.
  - London on GMT before the US changes: 2026-10-25 to 2026-10-31; 2027-10-31 to 2027-11-06.
- If ICE answers that no level exists at 00:00 ET because the DX day closes at 17:00 ET, the study's session
  endpoints cannot be served from this series as stated, and that answer is itself the finding: the DXY factor
  would then need a different, explicitly labelled source.
- If ICE quotes only a live-entitlement price, record the number and stop; do not buy inside the research
  programme without the owner's decision.
- The sample is evidence, not data: store it under `backtester/tmp/` and never in `data/`.

