# H1 evidence policy · historical reconstruction and sealed live replay

18 November 2026 · research only

The H1 candidate has two separate evidence lanes. They answer different questions and must never be
merged into one count.

## 1. Historical reconstruction

**Question.** Was the original observation that H1 requires available to the decision-maker by
05:00 London on the session date?

A historical record must retain:

- the exact declared source, instrument and transform;
- every original operand behind the feature, with its own vintage (six observations for a
  five-interval change, two eligible fixings for ICE, all five release families for the calendar);
- `observed_at_utc` and `published_at_utc`, with `observed <= published <= cutoff`;
- a nullable `received_at_utc`.

The receipt is nullable because the original observation may have been available through a public
source or archive before our collector existed. A receipt captured by our system years later cannot
be required where the agreed historical evidence policy permits reconstruction, and it must never
be invented or back-dated. The test is whether the source record proves availability by 05:00, not
whether our collector was running.

A reconstructed record is still blocked if the source identity is wrong, the lookback is
incomplete, the print is stale, the publication is after the cutoff, or the operands are derived
aliases rather than originals.

## 2. Sealed live replay

**Question.** Did the model make the decision on bytes it had not seen before publication, with a
genuine receipt by the cutoff?

A sealed record additionally requires `published <= received <= cutoff`, where `received_at_utc` is
a real receipt recorded by the collector at the time. A publication timestamp is not a receipt. A
timestamp collected during repair, backfill or analysis is not a historical receipt. Synthetic
fixtures prove dispatch only; they do not enter either lane's count.

## 3. What the dashboard shows

The H1 coverage audit publishes both counts separately:

- **Historical reconstruction** — `ready / scheduled`, with the receipt nullable.
- **Sealed live replay** — `eligible / scheduled`, with the receipt required.

A morning can be historically ready and sealed-blocked. That is a statement about evidence, not
about the model's accuracy. H1 remains unscored in both lanes.

## 4. What never happens

- A legacy value is relabelled as an H1 operand.
- A date-only legacy timestamp is called a 05:00 receipt.
- A publication time is called a recipient receipt.
- A newly collected timestamp is described as historical.
- A missing input is filled forward, interpolated or replaced by a proxy.
- A blocked morning contributes a direction, trade or scored outcome.
- A coverage count is presented as a performance result.

## 5. Accepted source amendments are not proxy substitutions

An amendment is the opposite of a substitution by the audit. It is a versioned, dated change to the
declared contract itself, accepted by the owner before any value is imported, and it publishes the supplied
declaration beside the amended one so the change is visible rather than absorbed:

- the frozen package is preserved byte for byte and its `verify.js` still passes;
- the amendment names the exact supplied row it replaces and the audit refuses to run if that row drifts;
- the amended instrument is named on every record, every input row and every document;
- the amendment is additive only: no freshness window, lookback cap, threshold, sign or weight may be
  relaxed to fit the new source, and a morning the source cannot cover is blocked, never bridged.

`H1-A01` (18 November 2026) is the first such amendment: the H1 `ice` input is supplied by the archived
`DXY.cash` hourly tape instead of a licensed ICE fixing. ICE is no longer required or requested for that
input. The instrument is not the official index and is never described as it.
