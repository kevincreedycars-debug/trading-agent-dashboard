# Label instrument options, 2026-10-25 - what could label the session, and what each one is

Status: **the label instrument is still unresolved.** Nothing here selects one, and no prompt may treat one as
chosen. This note exists so the decision can be made on stated facts rather than on the word "DXY", which the
programme uses as a placeholder and which no committed source in this repository can produce intraday.

The requirement is narrow and worth restating, because it rules out most of the obvious candidates: a value at
05:00 Europe/London and a value at 05:00 Europe/London on the next local date, for the same instrument, from a
source that can be fetched after the fact without hindsight, with enough history to cover a study sample. A daily
close is not that. A 09:30 New York value is not that.

## The candidates, and what each can honestly label

| Option | Series or instrument | 05:00 London stamp | History | Cost | What it can and cannot support |
| --- | --- | --- | --- | --- | --- |
| A. EUR/USD spot mid | OANDA v20 pricing stream / candles, `EUR_USD` (the `OANDA_*` credentials already in the local store) | Yes - intraday, any minute | Multi-year, minute and above | Included with the existing account | A single bilateral rate: the largest dollar weight but not a dollar index. Every claim has to say "EUR/USD", never "the dollar" |
| B. Synthetic basket | Equal-weighted geometric mean of EUR/USD, USD/JPY, GBP/USD, USD/CHF, USD/CAD, USD/SEK from the same OANDA feed | Yes | Same as A | Included | Reproducible and honest about construction, but it is our basket, not anyone's published index, and its weights are a choice that has to be frozen and declared |
| C. ICE US Dollar Index (DXY) futures, front month | Exchange data via a licensed vendor | Yes, if the vendor carries intraday | Vendor-dependent | Paid, licensed | The instrument the rulebook means, and the one claim it would license. Requires a paid licence and an exchange-fee decision; no free source is committed and none may be scraped |
| D. Published DXY cash index, intraday | Vendor redistribution of the ICE index | Vendor-dependent | Vendor-dependent | Paid | Same as C, with an extra redistribution question for anything published on the dashboard |
| E. Fed H.10 broad dollar index | FRED `DTWEXBGS` (and the narrow series) | No - published weekly, dated by day | Long | Free | Close-to-close daily at best, and revised. Usable as background, never as the session label |
| F. Fed H.10 daily noon-buying-rate series | FRED `DTWEXM`-family / H.10 averages | No - daily average, and several series discontinued | Varies | Free | A daily average is not a 05:00-to-05:00 value. Discontinued series make the study sample shorter than it looks |
| G. Broker USD index CFD | Broker's own index quote | Usually yes | Broker-dependent | Included with that account | The broker's construction is undocumented, so the label would not be reproducible from this repository |

## What the choice actually decides

1. **The study sample.** A, B and E can be built from what exists today; C and D need a purchase before a single
   session can be labelled. Any claim about how many sessions are measurable follows from this row, and no prompt
   may quote such a number until the source exists.
2. **The claim's instrument sentence.** Option A forces every finding to be written about EUR/USD. Option C
   licenses "the dollar". Options B and G force the construction to be declared every time. The programme's rule
   that "never present another instrument as DXY" is what makes this decision unavoidable rather than cosmetic.
3. **The missing-value rule.** An intraday source (A, B, C, D, G) can miss a 05:00 print; a daily series (E, F)
   has no 05:00 value at all. The open questions in the context pack - missing-quote policy, flat band, tie rule -
   are answerable only after this decision, and none of them is decided here.
4. **Revision exposure.** E and F are revised; the session rule forbids filling an endpoint from a later
   revision. That is an argument for a first-print-only policy and a recorded vintage, not against the option.

## The cheapest honest path, if the owner wants one

A (EUR/USD from the existing OANDA account) plus a declared sentence in every output, with B as a later
sensitivity check and C only if a licence is bought. That path needs no purchase and no new credential, and it
labels a real instrument at the real cutoff. It is a proposal, not a decision, and it has one visible cost: the
programme would be measuring the dollar through its largest leg, and would have to say so in every finding.

## What this note does not do

It does not change a prompt, a catalogue entry or a factor status, and it does not resolve the label. The prompts
keep saying that DXY is proposed and unverified, and that no chain has measured the session, until the owner
chooses and the choice is written into the session contract.
