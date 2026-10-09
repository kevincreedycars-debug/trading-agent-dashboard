# Gold Layer 1: the ten elements, the weights, and what the record shows

Shareable documentation pack, written 2026-10-09. Read-only work: no live system, collector, builder,
weight, register entry, dashboard file, credential or other worker's lane was touched to write it, and
the project's sealed test window was not read.

Written to be read outside the repository it describes. Nothing in it needs a file path, a code
reference or a login to follow, and every element is described the same way, in the same order.

**The rule this whole document obeys.** Every number here is one of two things, and the two are always
kept apart:

- **Declared design** - what the system says it does. Written by hand, not measured.
- **Measured record** - what the archive has actually returned, with the number of days behind it.

Where the two disagree, the disagreement is printed rather than smoothed over. That happens often
enough to matter.

---

## 1. What the system is, in five sentences

1. Once a day, the system takes a snapshot of markets: the gold price, the dollar, US government
   yields, US real yields, the VIX, and the latest US economic release.
2. Ten elements, called factors, each read something from that snapshot and return one of three
   votes: BULLISH, BEARISH or NEUTRAL.
3. A fixed weight table turns those ten votes into a weighted vote, and deterministic code - not the
   language model - produces the direction (BULLISH, BULLISH_LEAN, BEARISH, BEARISH_LEAN or
   NO_CLEAR_BIAS) plus a 0-100 conviction number, for five horizons, of which the traded one is gold's
   next 24 hours.
4. The call is stored together with the inputs that produced it and the full ten-element breakdown.
5. Later, the same day's gold price path grades it: was the direction right, did price reach the
   distance the call implied, and did it reach that distance and then turn back.

The one question it answers: **based on the factors confirmed and available at the moment of the call,
which way is gold likely to move over the next 24 hours?** It answers nothing else. It is not a trade,
not a level forecast, not a price target, not advice, and it says nothing about any other market.

---

## 2. How to read this document

**Plain-word glossary**, because the system's own vocabulary is otherwise a barrier:

- **Element / factor (F1 to F10).** One idea about what moves gold. Ten of them.
- **Reading / variable.** A single named number an element may read. Twenty-eight are declared.
- **Snapshot.** One day's set of readings, stored as one row.
- **Vote.** The element's own output: BULLISH, BEARISH or NEUTRAL. Elements never output a number.
- **Active weight.** The weight carried by elements that voted BULLISH or BEARISH rather than NEUTRAL.
  It is the share of the picture that actually spoke, out of 100.
- **Bull case / bear case.** The share of the active weight sitting on the bullish side, and on the
  bearish side. The two add to 100.
- **Net edge.** Bull case minus bear case.
- **Conviction.** The system's 0-100 number. It is the winning side's share multiplied by the active
  weight share (capped at 80), so a table where most elements are silent produces a low conviction
  even when the few speaking elements agree.
- **Lean.** A suffix the code adds when the active weight is under 50, or the two sides are within 15
  weight points, or the net edge is under 20 points. A lean is the system saying "that way, weakly".
- **Drift / base rate.** What "always call up" scores on the same days. Any element or call has to be
  judged against this, not against 50 percent, because gold rose more often than it fell in the window
  measured.
- **Hit rate, and edge.** The percentage of days a reading pointed the right way, and that percentage
  minus the drift on exactly those days. A reading that is merely on the winning side of the drift has
  an edge of roughly zero.
- **No information.** The project's own verdict label for a measurement that sits inside the noise
  band. Most of what is measured here carries this label.
- **Availability lag / vintage.** Using only what had actually been published before the call, rather
  than the value the economy later turned out to have had. Measurements without this lag can read the
  future by accident, and one element here does exactly that.
- **Designated session.** The project's defined gold trading day, with its own open and close, used to
  grade calls. "Full session" is the day's full reach; "half session" is half of it.
- **Reach.** Whether price got as far as the call implied, regardless of where it finished.
- **Dark element.** A declared element that cannot fire at all, because a reading is missing or a rule
  can never match. Four of the ten are dark in the historical record.
- **Sealed window.** A period of data the project has frozen for a later one-shot test. It is not read
  here and must not be.

**One prohibition, which applies to every reader of this document.** Nothing in it may move a live
weight, and nothing in it is a recommendation to trade. It describes a system and its record. It does
not qualify the system to be traded.

---

## 3. The chain, in one picture

Ten steps, in the order they happen:

1. The collector stores one snapshot row per day, with the readings it could get.
2. A workflow step assembles an input pack from the newest snapshot. It supplies **25 named fields**
   and names 11 of them as "may be missing, score NEUTRAL".
3. A language model (gpt-4.1-mini, chosen by configuration) is given the logic document and the input
   pack, and is instructed to follow the document exactly, to analyse gold only, to read nothing from
   any other market's agent, and to return raw JSON with one direction per horizon and every
   conviction left empty. It is also given an explicit list of things it must not produce: calls for
   other markets, pair rankings, entries, exits, trade recommendations or Layer 2 output.
4. The parse step keeps the model's directions, discards its other fields, and passes the market
   inputs on unchanged.
5. The conviction step then **recalculates everything from the input pack alone**: ten elements, five
   weight tables (one per horizon), five direction-and-conviction pairs, with the full per-element
   breakdown and a reason string for each element.
6. The recalculated values overwrite the model's. **So the direction and the conviction in the stored
   row are the code's, not the model's.** The model's role in the stored number is a compliance check:
   it is asked to follow the document, and its answer is not allowed to set the value. Reproducing a
   stored call does not require calling the model at all.
7. The row is stored with the inputs, the breakdown, the reason strings and the weighted totals.
8. Hours later, the day's gold price path is attached and the call is graded.
9. Both arms of the record are kept: the stored call row, and an independently replayed row from the
   same inputs. The two agree on every row of the archives on disk - which is a parity check on the
   arithmetic, not a validation of the logic, because both arms run the same rules.
10. The results feed a research surface: per-call outcomes, per-element measurements, and a
    qualification gate that no call has passed.

Two consequences worth stating plainly, because they are the most common misunderstandings:

- The model is in the chain but is not the author of the number, so "the AI's opinion" is the wrong
  description of a stored call.
- The snapshot is one row under its own date label, while the grading record defines the trading day
  as a session with its own open and close. Whether those two boundaries coincide is not settled in
  any document I can find, and it is listed as an open question in section 11.

---

## 4. The ten elements

Each element is described in the same eleven fields, in the same order, so the ten can be read side by
side. The fields are:

1. **What it is** - one plain sentence.
2. **What it reads** - the named readings, with units and how often they update.
3. **The rule as implemented** - the exact test the code runs, with the thresholds.
4. **The rule as documented** - the same from the written logic document, and any difference.
5. **Which way it pushes** - the direction, and which horizons use it.
6. **The weight it carries** - declared weight, the code's weight for the traded horizon, and where the
   number came from.
7. **Why the design believes it matters** - the mechanism, not a result.
8. **What would falsify it** - the one measurement that would retire the element.
9. **How to validate it** - the concrete instruction for an independent check.
10. **Status today** - live, dark, stubbed or dead, with what shows it.
11. **The honest unknown** - what nobody can currently answer.

Weight convention throughout: the **declared weight** is the number in the written logic document; the
**code weight** is the number the conviction code actually applies, quoted for the 24-hour horizon,
because that is the horizon the traded call uses. They are not the same numbers, and section 5 explains
why.

### F1 - Real yield direction

1. **What it is.** The direction of the US 10-year real yield: the return on a 10-year US government
   bond after subtracting expected inflation. It is the system's heaviest element.
2. **What it reads.** Three readings: the real yield level in percent, its change over five
   observations in basis points, and its change over twenty observations in basis points. The horizon
   decides which change is used - five observations for the 24-hour call, twenty for the next-week and
   current-month calls.
3. **The rule as implemented.** Take the change for the horizon: falling by 5 basis points or more =
   BULLISH; rising by 5 basis points or more = BEARISH; anything between = NEUTRAL; a missing reading =
   NEUTRAL with "Missing input" recorded.
4. **The rule as documented.** Identical: rising 5 basis points or more is bearish, falling 5 or more
   is bullish, otherwise neutral. This is one of the two elements where declaration and implementation
   agree exactly.
5. **Which way it pushes.** Rising real yields push gold down; falling real yields push gold up. Used by
   all five horizons, with the 24-hour call looking at the five-observation change.
6. **The weight it carries.** Declared 22 of 100. Code weight for the 24-hour call: 26 of 100. No
   derivation record: the document states the number and gives its reasoning for why the element
   matters, not for why it carries 22.
7. **Why the design believes it matters.** Gold pays no interest, so a higher real return elsewhere is
   a higher cost of holding it. The logic document calls this the strongest long-term driver of gold,
   and the mechanism is standard: real yields are the opportunity cost of a zero-coupon asset.
8. **What would falsify it.** If the five-observation change in the 10-year real yield, using only
   values published before the call, carries no information about the next session's gold direction,
   the element is decoration carrying a fifth of the model.
9. **How to validate it.** Score the element's own directional hit rate on its five-observation window
   against the drift on exactly the same days, over 2023-2026 anchors, with a publication-time lag
   enforced, minimum 100 days and 20 days per year. Report the hit rate, the interval, the days behind
   it, and the project's own verdict word (holds, no information, unstable across years, dead). Do not
   propose a weight change from it.
10. **Status today.** Live, and measured. It does not beat the drift: 50.80 percent on 1,864 session
    rows, +1.17 percentage points against a 55.81 percent base rate, labelled no information. In the
    older 608-call cut it scored 53.39 percent with a negative edge against the best constant answer
    and decayed year by year (59.1, 48.6, 41.7 percent).
11. **The honest unknown.** Whether a real edge exists but is simply below what daily data can detect -
    a true 1-point edge would need about 19,600 days to prove - and whether the five-observation window
    is the right one, since no alternative window has been tested.

### F2 - The US dollar

1. **What it is.** The direction of the US dollar against a basket of other currencies. It is the
   element that carries the archive's only large number, and section 7 explains why that number should
   not be believed.
2. **What it reads.** Four readings: the dollar index level, and its change over one, five and twenty
   days, in percent. The horizon decides which change is used - one day for the 24-hour call, five days
   as the default, twenty days for the next-week and current-month calls.
   **A caveat that travels with this element:** the series the historical records line up with is a
   broad trade-weighted dollar index (the Federal Reserve's own published series), not the classic ICE
   dollar index the document names. The project's own coverage record marks the classic ICE index as
   absent locally and explicitly refuses to relabel the broad index as it, while the collector's own
   mapping sends that broad index into the dollar-level name. So the element runs, but which instrument
   it is reading is not settled.
3. **The rule as implemented.** Falling by 0.15 percent or more over one day, on the 24-hour call =
   BULLISH; rising by 0.15 percent or more = BEARISH; anything between = NEUTRAL. On every other
   horizon the threshold is 0.30 percent. A missing reading is NEUTRAL with "Missing input" recorded.
4. **The rule as documented.** The document says "dollar rising more than 0.30 percent = bearish,
   falling more than 0.30 percent = bullish, otherwise neutral". The direction matches; **the
   threshold does not**, and this is the first of the declaration-versus-implementation disagreements.
   For the traded 24-hour call the code applies half the declared threshold, so the element fires about
   twice as often as the document says it should, on moves the document calls neutral.
5. **Which way it pushes.** A stronger dollar pushes gold down and a weaker dollar pushes gold up. Used
   by all five horizons.
6. **The weight it carries.** Declared 18 of 100 (second heaviest). Code weight for the 24-hour call:
   22 of 100. No derivation record for either number.
7. **Why the design believes it matters.** Gold is priced in dollars, so a stronger dollar makes it
   dearer for every buyer holding another currency, and the pair usually moves inversely. The mechanism
   is sound and uncontroversial; the difficulty is entirely in the timing, described next.
8. **What would falsify it.** If the element still shows no edge once the dollar value used is one that
   was genuinely published before the call - rather than the same day's close - then the element adds
   nothing and its large apparent edge was an accounting artifact.
9. **How to validate it.** Two measurements, both required. First, the ordinary one: hit rate against
   the drift on the same days, with the publication-time lag enforced. Second, the timing test: repeat
   the measurement using only the previous published close, and print both numbers side by side.
   A check that reports only the first number is reporting the artifact, not the element.
10. **Status today.** Live, and it is the only element with a large measured number - and that number
    is a timing artifact. In the 608-call cut it scored 71.95 percent on its 288 speaking days, stable
    across years (67.7, 74.3, 85.7 percent). In the careful measurement using only values published
    before the call, the same element scores 50.69 percent on 2,892 rows, +0.35 points against the
    drift, labelled no information. The mechanism of the artifact is visible: the stored dollar reading
    is the exact negation of the same day's dollar change on 101 of 101 days where the change exceeded
    0.3 percent, the graded window's gold return correlates -0.514 with that same-day change (against
    -0.055 for the previous day's move), and the day's value is published roughly twenty hours into the
    window it is being scored against.
11. **The honest unknown.** Whether any dollar reading available before the call carries information at
    this horizon, and which instrument the live reading actually is - a licensed ICE index or the
    broad trade-weighted series - since the two have different histories and the local records do not
    settle it.

### F3 - Fed stance

1. **What it is.** Whether the Federal Reserve is leaning towards tightening or easing, as recorded in
   a single categorical value.
2. **What it reads.** One reading: the Fed bias, a word rather than a number, with the valid values
   hawkish, dovish, neutral and unknown, updated as the stance is assessed.
3. **The rule as implemented.** If the value contains "dovish" = BULLISH; if it contains "hawkish" =
   BEARISH; blank, neutral or unknown = NEUTRAL with "Missing input" recorded.
4. **The rule as documented.** Identical: more hawkish is bearish, more dovish is bullish, neutral is
   neutral. Agreement is exact.
5. **Which way it pushes.** A more dovish Fed pushes gold up; a more hawkish Fed pushes gold down. Used
   by all five horizons, where its weight rises as the horizon lengthens.
6. **The weight it carries.** Declared 14 of 100 (third heaviest). Code weight for the 24-hour call: 12
   of 100. On the current-week and next-week horizons the code raises it to 16 and 18, the largest
   single-horizon increase in the table. No derivation record.
7. **Why the design believes it matters.** Fed policy drives real yields and the amount of money in the
   system, which are the two channels the two heaviest elements read directly. The element is, in
   effect, the forward-looking version of F1 and F4.
8. **What would falsify it.** If a properly derived, historically reconstructed stance shows no
   relation to the next session's gold direction, the element is decoration - today it cannot even be
   scored, which is a weaker position than being wrong.
9. **How to validate it.** The measurement cannot be run until the value exists in history. First
   rebuild it for the archive from locally held material (the 2-year and 10-year nominal yields, the
   real yield, and the rate-decision rows already in the event archive), with one declared derivation,
   then score it as the other elements are scored. Anything measured before that reconstruction is
   measuring a blank string.
10. **Status today.** **Live in production, dark in the record.** The live collector does produce the
    value - 145 of 147 recent snapshots carry one, of which 132 neutral, 12 hawkish and 1 dovish - but
    the historical rebuild writes an empty value for it, so every backtest reads "Missing input" and
    14 of the 100 declared weight points have never been scored on a single day. This is not a missing
    reading; it is a reading that exists and is thrown away.
11. **The honest unknown.** Whether the live value's own construction can be re-derived and versioned
    at all, and whether a stance split that is neutral on nine days in ten leaves the element anything
    to say even once it is wired.

### F4 - The two-year US yield

1. **What it is.** The direction of the US 2-year government yield, which is the market's own bet on
   where the Fed's policy rate is heading over the next two years.
2. **What it reads.** Three readings: the 2-year yield in percent, its change over five observations in
   basis points, and its change over twenty observations in basis points.
3. **The rule as implemented.** Falling 5 basis points or more = BULLISH; rising 5 basis points or more
   = BEARISH; in between = NEUTRAL; missing = NEUTRAL with "Missing input". The same shape as F1, on a
   different series.
4. **The rule as documented.** Identical, including the 5-basis-point threshold. Agreement is exact.
5. **Which way it pushes.** Falling front-end yields push gold up; rising ones push gold down. Used by
   all five horizons, with the 24-hour call using the five-observation change.
6. **The weight it carries.** Declared 8 of 100. Code weight for the 24-hour call: 10 of 100. No
   derivation record.
7. **Why the design believes it matters.** The 2-year yield is the market's priced expectation of
   policy, and policy expectations move real yields. The document's own summary describes the element
   as representing policy expectations rather than information about gold directly.
8. **What would falsify it.** If the 2-year change adds nothing once the real-yield change is already
   known, then the two elements are one voice counted twice, and 18 of the declared 100 points (8 plus
   10) are a double count rather than two pieces of evidence. That is a falsifiable claim, and it has
   not been run.
9. **How to validate it.** Two steps. Score the element alone, as the others are scored. Then score it
   again with the real-yield element removed from the same days, and report the difference. The second
   number, not the first, is what a weighting decision would need.
10. **Status today.** Live, measured, no information: 52.54 percent on 1,873 session rows, +2.57 points
    against the drift, inside the noise band. It is the best-behaved of the yield elements on this cut
    and it moves with F1 on 175 days at a 0.94 correlation, so the archive cannot separate the two
    elements' shares at all.
11. **The honest unknown.** How much of the heaviest two elements - 30 of the declared 100 points
    between them - is one macro idea counted twice.

### F5 - Gold's own recent move

1. **What it is.** What gold itself has already done, from one day to twenty days back. The document is
   explicit that this is confirmation only and must never outrank the macro elements above it.
2. **What it reads.** Four readings: the gold price, and its percentage change over one, five and twenty
   days. The 24-hour call uses the one-day change; five days is the default; twenty days is used for the
   next-week and current-month calls.
3. **The rule as implemented.** On the 24-hour call, a rise of 0.3 percent or more = BULLISH and a fall
   of 0.3 percent or more = BEARISH; in between = NEUTRAL. On the other horizons the threshold is 0.5
   percent. Missing = NEUTRAL.
4. **The rule as documented.** The document says only "gold rising strongly = bullish, falling strongly
   = bearish, otherwise neutral". It contains **no number**. The 0.3 and 0.5 percent thresholds are
   invented by the implementation, and the document has never been amended to state them. This is the
   third declaration-versus-implementation disagreement, and the most consequential kind: not a
   contradiction, but a silent assumption the design never made in writing.
5. **Which way it pushes.** Strongly up pushes gold up, strongly down pushes gold down, on all five
   horizons. Read as momentum or confirmation.
6. **The weight it carries.** Declared 8 of 100, with the document's own instruction that it must not
   dominate the macro elements. Code weight for the 24-hour call: 10 of 100.
7. **Why the design believes it matters.** Price action is evidence that other participants are acting,
   and momentum can persist for a while. In this design it is deliberately a supporting voice rather
   than a driver.
8. **What would falsify it.** If gold's own prior move carries no relation to the next session's
   direction, the element is noise. That has essentially been measured: it agrees with the previous 24
   hours 98.5 percent of the time and with the next 24 hours no better than a coin.
9. **How to validate it.** Score the one-day change as the code uses it, then score it again using the
   drift as the comparator, and report the invented threshold explicitly as invented. A version of the
   check that silently keeps the 0.3 percent threshold is checking the code, not the idea.
10. **Status today.** Live, measured, and carrying nothing: 50.74 percent on 363 speaking days (270 with
    a non-flat outcome), -7.41 points against the best constant answer on the same days. It is the
    flattest of the six elements that speak, and its 8 to 10 points of weight sit on a reading with no
    daily autocorrelation to harvest.
11. **The honest unknown.** What threshold the design would defend, if any - because the document
    contains none, the element's own boundary is currently whatever the code happens to say.

### F6 - Risk regime, measured by the VIX

1. **What it is.** How much US share-price volatility the market is pricing, used as a proxy for whether
   investors are frightened.
2. **What it reads.** Three readings are declared: the VIX level, and its change over one and five
   observations. The implementation reads **only the level**. The two change readings are declared and
   never used by any rule, which is a small piece of the same declaration-versus-code drift.
3. **The rule as implemented.** VIX above 25 = BULLISH; below 16 = BEARISH; between 16 and 25 = NEUTRAL;
   missing = NEUTRAL with "Missing input". An absolute band, with no reference to where the VIX came
   from or how fast it moved.
4. **The rule as documented.** Identical, including both band edges. This is a case where the code
   faithfully implements the document and the document is what is wrong: the rule is calibrated to
   crisis-driven gold, and the measured window is mostly the other regime.
5. **Which way it pushes.** Fear pushes gold up, calm pushes gold down. Used by all five horizons.
6. **The weight it carries.** Declared 10 of 100. Code weight for the 24-hour call: 8 of 100. The
   document's reasoning is one line: gold benefits from risk aversion.
7. **Why the design believes it matters.** In a genuine risk event, capital moves towards assets that
   are not someone else's liability, and gold is one. The mechanism is real; the question is whether an
   absolute level threshold is the right way to detect it.
8. **What would falsify it.** If an absolute level band stays on the wrong side across years, the rule
   is mis-specified for the era rather than merely noisy. That has been observed: the element is wrong
   with three-quarters consistency.
9. **How to validate it.** Two measurements, both required, reported together. First, the declared band
   scored as it stands. Second, a version driven by the VIX's own change or by an interaction with the
   dollar, scored on the same days. The comparison, not either number alone, tells the reader whether
   the idea or the calibration is at fault.
10. **Status today.** Live, and reliably wrong on this sample: 39.71 percent on its 204 non-flat days,
    stable across years (39.1, 42.4, 30.0 percent), -21.57 points against the best constant answer.
    10 of the declared 100 points sit on it. It also cannot be scored at all in the project's careful
    vintage measurement, because that measurement scores the states of measured variables and this
    element's declared rule is an absolute band rather than a state. A rule that is wrong, and
    unmeasurable by the project's own instrument, is the clearest case in the model for re-derivation
    before any weighting discussion.
11. **The honest unknown.** Whether crisis-driven gold is the norm and the measured window is the
    exception, or whether absolute VIX bands stopped working across all of the measured period.

### F7 - US economic surprises

1. **What it is.** Whether the latest US economic release came in stronger or weaker than the market
   expected. The sign is deliberately contrarian: strong data is read as bad for gold, weak data as
   good for it.
2. **What it reads.** Six readings are declared: the event family, the released value, the pre-release
   consensus, the previous value as first released, the surprise itself, and the hours since the
   release. The local event archive holds 5,115 event rows; 905 distinct US release days, of which 656
   carry both an actual and a consensus and 165 are high-impact.
3. **The rule as implemented.** The code does **not** read the six readings. It takes one blob of "the
   latest US event", converts it to text, lowercases it, and looks for words: "negative", "miss" or
   "bearish" = BULLISH; "positive", "beat" or "bullish" = BEARISH; anything else = NEUTRAL. So the
   element's vote depends on which English words happen to sit inside a serialised event record.
4. **The rule as documented.** The document says a positive surprise is bearish, a negative surprise
   bullish, and no major surprise neutral. The intended sign matches the code; the intended instrument
   (an actual-versus-consensus surprise) is not what the code reads.
5. **Which way it pushes.** Weak or negative US data pushes gold up; strong or positive data pushes gold
   down, on the reasoning that strong data raises the odds of a more hawkish Fed. Used by all five
   horizons.
6. **The weight it carries.** Declared 6 of 100. Code weight for the 24-hour call: 8 of 100. The project's
   own older factor laboratory named this element as its biggest weight-versus-effect mismatch while
   noting it had only seven directional observations to judge from.
7. **Why the design believes it matters.** A surprise is genuine new information arriving during the
   day, and rate expectations repricing around it is a real mechanism. It is also the only element whose
   input is an event rather than a level, so it is the only one that could plausibly explain a
   particular day rather than a regime.
8. **What would falsify it.** If a properly measured surprise - the released value against the consensus
   that was available before the release, with the release time recorded - shows no relation to the
   next session's direction, the element adds nothing.
9. **How to validate it.** Use the surprise and the release age rather than a word match, declare the
   sign convention per event family before measuring, and measure release days separately from
   non-release days. On sample size: the local archive can support a 10-point event-day claim (905
   release days against a requirement of about 196 independent days) and cannot support a 5-point one
   (which would need about 784).
10. **Status today.** Live, effective in principle, and effectively dark in practice. In the 608-call
    record the element fired on 12 days (of which 7 had a usable outcome, 71.43 percent right, an
    interval running from 35.9 to 91.8 percent - that is, nothing). In the careful vintage measurement
    it is not scoreable at all, because no sign convention per event family is declared. The number that
    would matter most, the release-day effect, has never been measured properly.
11. **The honest unknown.** Whether a release-day gold effect exists at this horizon at all, and if so
    what the correct sign is per family - because the current implementation is a keyword search over a
    serialised record and cannot answer either question.

### F8 - Inflation signal

1. **What it is.** Whether inflation is running hot or cooling, read as a separate element from the
   event surprise next to it.
2. **What it reads.** The document declares one reading, the inflation signal, alongside the latest US
   event. **The reading does not exist anywhere in the system.** The project's coverage record marks it
   as having no local source and no derivation rule, and its own note is explicit that the field the
   live agent reads is not the same thing as an inflation event's actual-versus-consensus surprise.
3. **The rule as implemented.** There is no rule. The code returns NEUTRAL unconditionally, with the
   reason string: "Collector does not currently provide a top-level inflation_signal column". The
   element is present in the code and in every stored breakdown, always neutral.
4. **The rule as documented.** Hot inflation with dovish expectations = BULLISH; a disinflation trend =
   BEARISH; unclear = NEUTRAL. The document also says the element should never be guessed.
5. **Which way it pushes.** In design, hot inflation with easing expectations pushes gold up. In
   practice it pushes nothing, on every horizon, in every stored call ever made.
6. **The weight it carries.** Declared 6 of 100. Code weight for the 24-hour call: 2 of 100, the code's
   lowest-but-two. Both numbers are inert: no weight applied to a constant is a weight.
7. **Why the design believes it matters.** Gold is widely held as protection against the value of money
   falling, and in some regimes - particularly when real yields are suppressed - it behaves that way.
   The mechanism is real; the design never said how to detect the regime.
8. **What would falsify it.** If a declared inflation regime, computed only from data available at the
   call, shows no relation to the next session's direction, the element is decoration.
9. **How to validate it.** Nothing can be measured until the reading exists. Build it from the local
   event archive (179 usable CPI releases, plus PCE and PPI rows, each with an actual and a consensus),
   declare the derivation and the vintage rule once, and then score it as the other elements are scored.
   Any number reported before that reconstruction describes a stub.
10. **Status today.** **Stubbed: dead by construction.** The element has never fired once in 608 stored
    days or in any backtest. Six of the declared 100 weight points and two of the code's 100 sit on it.
    It is also impossible to score retrospectively from the archive as it stands, so no amount of
    re-weighting can touch it.
11. **The honest unknown.** Which of three plausible ideas the element was meant to be - a surprise
    against consensus, a trend in the inflation rate, or a level of realised inflation - since the
    document names the reading without defining it, and the system has never produced one.

### F9 - Safe-haven demand

1. **What it is.** Whether the world is in a stressed state that makes buyers reach for assets that are
   nobody else's liability. It is the element that can make gold and the dollar rise together.
2. **What it reads.** The document declares one reading, risk headline context. The implementation reads
   that name, or a true geopolitical-risk flag. Neither is delivered: the risk-headline reading is
   absent from every snapshot, the geopolitical flag is empty on 143 of 147 recent live snapshots and
   false on the other four, and the historical rebuild writes it empty too. The project separately
   holds 5,115 event rows with names and importance levels that could support a classifier.
3. **The rule as implemented.** If the text contains "safe_haven", "stress", "crisis" or "risk_active"
   = BULLISH; otherwise NEUTRAL. The element is **never allowed to say BEARISH**, exactly as the
   document instructs - a deliberate one-sided design, so a calm market reads as neutral rather than as
   a vote against gold.
4. **The rule as documented.** Geopolitical stress is bullish, financial stress is bullish, calm is
   neutral, and the element should never score bearish. Agreement is exact.
5. **Which way it pushes.** Stress pushes gold up; calm contributes nothing. Used by all five horizons.
6. **The weight it carries.** Declared 6 of 100. Code weight for the 24-hour call: 1 of 100, the code's
   lowest. The declared and implemented numbers differ by a factor of six, and the code's version is
   effectively a tie-breaker rather than a voice.
7. **Why the design believes it matters.** In a genuine crisis, gold is bought as a final-resort store
   of value, and it can rise with the dollar at the same time - which is why the document warns against
   treating gold and the dollar as mechanical opposites. This is the one element in the model whose
   whole purpose is to explain the exceptions to the other nine.
8. **What would falsify it.** If a declared classifier over the local event archive cannot separate
   stress days from calm days in gold's next-session direction or in gold's next-session range, the
   element is decoration. Note that the second half of that test is important: safe-haven demand may
   show up in how far gold travels rather than in which way it ends.
9. **How to validate it.** Build the classifier from the 5,115 local event rows, declare it before
   measuring, then score both direction and range. Report the two separately.
10. **Status today.** **No producer on any path.** The element has never fired, in live calls or in the
    archive, because no field it can read carries a usable value. One measured trace of the underlying
    idea exists: a median split of the risk-headline reading scores 60.51 percent on 471 session rows -
    the closest any single reading in the project's report comes to its own interest threshold - but the
    same row is labelled unstable across years, and at that threshold roughly two and a half rows would
    be expected to reach it by chance across the rows tested.
11. **The honest unknown.** Whether a keyword or event-based classifier can distinguish stress days at
    all, and whether the effect - if it exists - belongs in the direction or only in the expected range.

### F10 - Liquidity and growth

1. **What it is.** Whether money is being added to the system or withdrawn, read through a growth or
   liquidity regime label.
2. **What it reads.** Two readings are declared: an equities regime and a growth regime. Neither has a
   verified local source or a derivation rule in the project's own coverage record. The code also reads
   a third name, the global growth regime, which is supplied by the input pack - so in practice this
   element reads whichever of the three names happens to carry text.
3. **The rule as implemented.** Take the growth label as text. If it contains "weakening" or
   "contraction" = BULLISH. If it contains "supportive" or "expansion" = BEARISH. Otherwise NEUTRAL.
4. **The rule as documented.** Liquidity expansion = BULLISH; liquidity contraction = BEARISH. The
   direction is **inverted** against the document on both legs. This is the second
   declaration-versus-implementation disagreement, and the only one where the code says the opposite of
   what the document says rather than a different number of the same sign.
5. **Which way it pushes.** As designed: more money in the system pushes gold up. As implemented:
   weakening or contracting growth pushes gold up, and expansion pushes it down.
6. **The weight it carries.** Declared 2 of 100, the smallest declared weight. Code weight for the
   24-hour call: 1 of 100. Value: almost none either way, and inert while the element cannot fire.
7. **Why the design believes it matters.** More money in the system tends to lift hard assets, and
   easier liquidity lowers the real cost of holding them. The element is the model's only attempt to say
   something about the quantity of money rather than its price.
8. **What would falsify it.** If a single declared regime label, wired with one shared vocabulary and
   with the sign agreed in writing, shows no relation to the next session's direction, the element is
   decoration.
9. **How to validate it.** Nothing can be measured until the vocabulary is unified. One canonical set of
   labels has to be chosen and used by both producers, the sign has to be stated once in the document
   and matched in the code, and only then can the element be scored. Measuring it in its current state
   measures a string comparison, not a market idea.
10. **Status today.** **Dead on a word, and the proof is mechanical.** The historical rebuild writes
    "expanding" and "contracting", while the rule looks for "expansion" and "contraction". Neither
    string contains the other, so both legs fall through to NEUTRAL on every single backtest day. The
    live collector happens to write a different vocabulary ("growth_weakening", "liquidity_expansion"),
    which does match the rule, and it fired twice in 147 days. So the same element is wired twice, with
    two vocabularies, and the version every backtest uses can never speak.
11. **The honest unknown.** Which vocabulary the design intended, and which sign is right - the
    document's or the code's - because the two have never been reconciled in writing.

---

## 5. The weight story

There are two complete weight systems in the running system, and only one of them is written down.

**The declared vector.** The logic document publishes exactly one table: one number per element, adding
to 100, and its own line says so. It is the only weight statement a reader of the design would see.

**The code's vectors.** The conviction code carries five tables, one for each horizon, each adding to
100. For the traded 24-hour call the differences from the declared table are these:

| Element | Declared | Code, 24-hour call | Difference |
| --- | ---: | ---: | ---: |
| F1 Real yield direction | 22 | 26 | +4 |
| F2 US dollar | 18 | 22 | +4 |
| F3 Fed stance | 14 | 12 | -2 |
| F4 Two-year US yield | 8 | 10 | +2 |
| F5 Gold's own move | 8 | 10 | +2 |
| F6 Risk regime / VIX | 10 | 8 | -2 |
| F7 US economic surprise | 6 | 8 | +2 |
| F8 Inflation signal | 6 | 2 | -4 |
| F9 Safe-haven demand | 6 | 1 | -5 |
| F10 Liquidity and growth | 2 | 1 | -1 |

The other four columns, in the same element order, are: 3-day 24/20/14/10/8/10/6/4/3/1; current week
22/18/16/10/8/10/5/5/4/2; next week 20/16/18/10/6/8/4/8/6/4; current month 18/16/18/10/6/6/4/10/6/6.
All five add to 100, so none of them looks broken on inspection.

Five things follow, and they matter more than the numbers themselves:

1. **The published weights correspond to no run.** Comparing the declared table against each of the five
   columns by total absolute difference across the ten elements: current week 8 points, 3-day 12, next
   week 20, and the 24-hour column and current-month column 28 each. So the declared table is nearest the
   horizon it was never intended for, and furthest from the traded one.
2. **The stored calls and every measurement share one vector.** The rule engine used by the backtests,
   and by the replay arm that mirrors the stored calls, carries the 24-hour column as its single set:
   26/22/12/10/10/8/8/2/1/1. So whenever a measurement in this document says "the element carrying 22
   points", the number being measured is really 26. Everywhere in section 7, the declared weight is a
   label rather than the arithmetic that ran.
3. **No derivation record exists.** The document gives a reason for each element - why it matters - and
   never a reason for its number. Nothing in the repository states a sample, a test, a date or a decision
   that produced 22 for real yields rather than 20 or 25. The declared table arrived in a single file
   upload on 2026-06-07; the tools that measure weights were built a month later, on the code's vector,
   and no document announces the change. So neither table can currently be described as the measured
   one.
4. **The document's own conviction behaviour is not implemented.** It says that conflict between the
   primary elements must reduce conviction, that agreement must raise it, and that missing readings
   reduce it downstream. The stored breakdown carries fields for exactly those three adjustments and
   they are zero on every call. A missing reading therefore costs nothing - it simply carries no weight -
   which is a different behaviour from the document's, and the direction is the safer of the two, but the
   difference should be stated rather than assumed away.
5. **The declared table is older than the tools, and the tools never used it.** The project's own factor
   laboratory was generated on 2026-07-06 and its published re-weighting experiment on 2026-07-07, both
   built on the code's 24-hour vector. That is why the laboratory's outputs cannot be quoted as a verdict
   on today's declared weights: they were never the weights it ran.

**What a weight is not.** It is not a probability, not a confidence, not a share of variance, and not a
forecast contribution. It is a share of the vote. And on this data the weights cannot be verified even in
principle, for four separate reasons, each measured: the two heaviest elements move together (0.94
correlation on 175 days, so the archive cannot separate 22 and 8 from 15 and 15); two or more elements
speak on 349 of 414 days and disagree in sign on 224 of them; only 138 distinct vote patterns ever occur
out of 59,049 possible; and weight differences of the size under discussion sit far below what daily data
can detect, where proving a true 1-point edge would take about 19,600 days and the archive could detect
about 5.9 points at 80 percent power. Many different weight vectors produce identical daily answers, so
any "optimum" found this way is a flat ridge, not a point.

---

## 6. The twenty-eight readings, and where each one sits

The gold agent is allowed to read twenty-eight named readings, and the project holds the list as a
register with its own coverage status per reading. That list is what the number "28" means: it is not
twenty-eight independent ideas. The register's own derivation line says it plainly - twenty of the
twenty-eight are levels or transformations of five series (the 10-year real yield, the 10-year nominal
yield, the 2-year nominal yield, a dollar index and the VIX), so they are not twenty independent inputs.

Per element, with the coverage status the project itself records:

- **F1 Real yield direction (3 readings).** The 10-year real yield is a verified local series, and its
  five- and twenty-observation changes are derived from it and measured.
- **F2 The US dollar (4).** The dollar index level and its three changes are recorded as having no local
  source, with an explicit note that the broad trade-weighted index is *not* relabelled as the classic
  ICE dollar index. The collector's mapping, however, sends the broad index into the dollar-level name,
  and the stored dollar reading tracks that index's same-day change exactly. One name, two claims.
- **F3 Fed stance (1).** No verified local source: the live column exists, the history does not.
- **F4 Two-year US yield (3).** Verified local series plus two derived changes, all measured.
- **F5 Gold's own move (4).** The gold price is a verified local series (an hourly candle archive); the
  three percentage changes are derived and measured.
- **F6 Risk regime / VIX (3).** The VIX level is a verified local series; the two change readings are
  derived and measured - and neither is used by any rule.
- **F7 US economic surprises (6).** Five of the six are verified or derived from the local event
  calendar and measured; the sixth, the previously released prior value, is a proposed mapping.
- **F8 Inflation signal (1).** No local source, no derivation rule, no measurement possible.
- **F9 Safe-haven demand (1).** No local source, no derivation rule. The project's own note adds that a
  geopolitical flag is narrower than headline context and is not an equivalent substitute.
- **F10 Liquidity and growth (2).** Both readings have no local source and no derivation rule.

Three gaps then sit on top of the status list, and all three are about wiring rather than about markets:

1. **Nine declared readings have no verified local source at all:** the four dollar readings, the Fed
   stance, the inflation signal, the risk-headline context, and the two regime labels. The local archive
   holds exactly five macro series: the 10-year real yield, the 10-year and 2-year nominal yields, a
   broad dollar index and the VIX.
2. **What the chain actually supplies is smaller than what is declared.** The input pack hands the code
   25 named fields. Three of them - the 10-year nominal yield and its two changes - are never read by any
   element. Three declared names - the inflation signal, the risk-headline context and the growth regime
   - are absent from the pack altogether. So an element can be declared, dark and unfed at the same time.
3. **The six event readings are collapsed into one field.** The pack passes "the latest US event" as a
   single record, which is the field the surprise element then searches for English words in.

---

## 7. What the record shows

Two rules for this whole section: every number names the population it was measured on, and no number
here is a claim about the future.

### 7a. Two grading definitions, and they disagree by seven points

- **On the project's designated session** - its own defined gold trading day, open to close - 2,493
  Layer 1 calls were graded: 1,188 right, 47.65 percent, interval 45.70 to 49.62. Calling "up" every day
  on the same rows scores 53.19 percent, so the calls sit 5.5 points *below* the drift. Gold's own calls
  are 570 of those rows: 46.32 percent, against a 56.84 percent up-rate on the same rows.
- **On the following-24-hours panel**, which is the one users see: 3,920 calls, 54.39 percent.

So the honest answer is two numbers, about 47.7 percent on the designated session and about 54.4 percent
on the next 24 hours, with the base rates in between. The second is not evidence of skill: it is about
1.2 points above the relevant base rate, against a standard error of about 0.8 points, on a window where
gold rose more often than it fell.

One consequence to state plainly, because the low number invites over-reading: **"not demonstrably
reliable" is not "proven worthless"**, and "no gain shown" is not "a gain disproved". What the archive
supports is narrower than either camp would like - the calls carry no measured directional skill over the
base rate, they have never been tested with entries, targets or stops attached, and the archive's usable
evaluation sample is already spent.

### 7b. The three grades, measured on the same 2,493 calls

The project already grades every call three ways, which is what makes "did it work" a question with more
than one honest answer:

1. **Direction.** Right on 47.65 percent. Bearish calls are the weaker half in every cut: 42.96 percent
   across all markets, and gold's own bearish calls 40.00 percent (120 of 300) against 53.33 percent for
   its bullish calls. Gold's bearish interval (34.62 to 45.64) sits entirely below gold's own
   down-frequency on that window, so the down calls were not merely unskilled - they leaned against the
   drift.
2. **Reach.** The called direction reached half the day's range on 64.34 percent of calls, and the full
   range on 37.26 percent. This is the grade that produces the large numbers that circulate; it measures
   the size of gold's day far more than it measures the call.
3. **Reached, then reversed.** The called direction reached its level and then finished against the call
   on 20.86 percent of calls at half range and 5.98 percent at full range.

Two more measured properties of the call record, both relevant to whether confidence means anything:

- **Confidence does not order accuracy.** The project's own verdict file records that accuracy is not
  monotonically non-decreasing in confidence. Gold's bands illustrate it: 46.0 percent on the 63 calls
  in the 40-49 band, 40.0 percent on 35 calls in the 50-59 band, 55.7 percent on 88 calls in 60-69, then
  73.7 percent on 38 calls in 70-79 and 61.7 percent on 81 calls in 80-89. A set of bands that reads 40
  percent in one column and 74 percent in the next, on tens of calls, is a sample being read rather than
  a confidence level being confirmed.
- **The mean signed move is slightly against the calls** (-0.020 of the day's range), which is the same
  fact as the direction grade, expressed in distance instead of counts.

### 7c. Each element on its own

Measured on the 608 stored calls, 2024-01-02 to 2026-04-30. "Days it spoke" counts every day the element
was not neutral; each hit rate is measured on those days whose outcome was also outside the 0.3 percent
flat band, which is the denominator behind each interval. The edge is against the best constant answer on
exactly the same days, so a reading that merely sits on the winning side of the drift scores nothing.

| Element | Declared weight | Days it spoke | Hit rate | 95% interval | Edge vs best constant |
| --- | ---: | ---: | ---: | --- | ---: |
| F1 Real yield | 22 | 307 | 53.39% | 47.0 - 59.6 | -6.36pp |
| F2 US dollar | 18 | 288 | 71.95% | 65.7 - 77.5 | +13.57pp (timing artifact) |
| F4 Two-year yield | 8 | 323 | 56.67% | 50.3 - 62.8 | -4.17pp |
| F5 Gold's own move | 8 | 363 | 50.74% | 44.8 - 56.7 | -7.41pp |
| F6 Risk / VIX | 10 | 278 | 39.71% | 33.2 - 46.6 | -21.57pp |
| F7 Economic surprise | 6 | 12 | 71.43% | 35.9 - 91.8 | +14.29pp (7 usable outcomes) |
| F3, F8, F9, F10 | 28 | 0 | - | - | never fired |

Four readings of that table:

1. **The dollar element's big number is an accounting artifact, not a discovery.** Its reading is dated
   inside the interval it is scored against, and when the same element is measured using only values that
   were published before the call it scores 50.69 percent on 2,892 rows, +0.35 points, labelled no
   information. The same driver reads 71.95 percent in one cut and 50.69 percent in another, and the
   difference is entirely the timing rule.
2. **The VIX element is reliably wrong rather than noisy:** 39.71 percent on its 204 non-flat days, stable
   year by year (39.1, 42.4, 30.0). A rule that is wrong with that consistency is a candidate for
   re-derivation or for standing down to zero weight; no weighting can repair it.
3. **The heaviest element does worse than the drift**, and decays year by year (59.1, 48.6, 41.7
   percent), which is the pattern of a relationship that was real in an earlier rate regime and is not
   carrying information at this horizon now.
4. **Gold's own price carries nothing on a daily horizon** (50.74 percent), which is expected: it agrees
   with the previous 24 hours 98.5 percent of the time and with the next 24 hours no better than a coin.

The second, careful measurement of the same elements says the same thing in different words: 25 element
states scored on the session horizon, **all 25 labelled no information** (24 of 25 on the weekly horizon,
with the 25th labelled unstable across years); exactly one row reaches the project's 60 percent interest
threshold, where about two and a half rows would be expected to reach it by chance across the rows
tested. That cut also finds 82 of the declared 100 weight points testable and 18 not scoreable at all
(the VIX element, the surprise element and the liquidity element). The two cuts do not even agree on
which elements can be read - the VIX element speaks on 278 days in one cut and cannot be scored at all in
the other, because its declared rule is an absolute band rather than a state of a measured variable -
which is itself evidence that the readings, the archive and the rules are not yet one system.

### 7d. The drift is the loudest feature in the sample

On the same 608 calls: gold rose on 251 of the non-flat days, fell on 163, and stayed inside a 0.3 percent
band on 149. So **60.63 percent of non-flat days were up days**, and the average 24-hour move was +0.167
percent with a 1.099 percent standard deviation (t 3.61). The stored calls with an outcome were right
56.31 percent (396 outcomes) against 60.86 percent for saying "up" on the same days; bullish calls hit
67.35 percent (196) and bearish calls 45.50 percent (200). The model is a passenger of the drift, not a
source of edge - and that is the single most important sentence in this document for anyone reading the
call record.

### 7e. What size of edge this data could ever prove

Every honest element effect measured in this project is between 0 and 3 points wide. On daily data the
archive can detect about 5.9 points at 80 percent power. Proving a true 1-point edge would need roughly
19,600 days (some 75 years); 2 points about 4,900 days; 3 points about 2,178. So a reader should treat
any future claim of a small daily edge from this archive as unproven by construction, rather than as
evidence for or against. Release-day data is the one place with more resolution than that: 905 distinct US
release days, 656 carrying both an actual and a consensus, 165 of them high-impact - nearly enough to
prove a 10-point event-day effect (about 196 independent days needed) and nowhere near enough for a
5-point one (about 784).

### 7f. Why 60 percent is not the win it sounds like

The project's own threshold of interest is 60 percent. In the 608-call window, "always call up" already
scores 60.63 percent of non-flat days, so a system that reached 60 percent would have reached slightly
less than the drift. Any target expressed as a percentage has to be set against the drift on the same
days, not against 50 - which is the reason every hit rate in this document is printed beside its own base
rate and its own interval.

---

## 8. Element status, in one table

The single most useful page in this document for anyone deciding what to do next. Status is what the
system does today, not what the design says it should do.

| Element | Declared weight | Code weight, 24h | Status today | Measured | The one thing that would change it |
| --- | ---: | ---: | --- | --- | --- |
| F1 Real yield | 22 | 26 | Live | 50.80% on 1,864 rows, +1.17pp, no information | Decide whether the 5-day window is the right one |
| F2 US dollar | 18 | 22 | Live, and its evidence is dated inside the window | 71.95% artifact / 50.69% lagged | Re-measure with only pre-call values |
| F3 Fed stance | 14 | 12 | Live, but dark in the record | never scored | Rebuild the column for history |
| F4 Two-year yield | 8 | 10 | Live | 52.54% on 1,873 rows, +2.57pp, no information | Measure it with F1 removed |
| F5 Gold's own move | 8 | 10 | Live, on an invented threshold | 50.74%, -7.41pp | State a threshold in the document, or drop the element |
| F6 Risk / VIX | 10 | 8 | Live, and reliably wrong here | 39.71%, -21.57pp, stable by year | Re-derive as a change or interaction, or stand it down |
| F7 Economic surprise | 6 | 8 | Live, but reads words, not the surprise | 12 speaking days | Read the surprise field and declare signs per family |
| F8 Inflation signal | 6 | 2 | Stubbed: always neutral | never fired | Build the reading |
| F9 Safe haven | 6 | 1 | No producer on any path | never fired | Build a classifier, then score direction and range |
| F10 Liquidity / growth | 2 | 1 | Dead on a word, and sign-inverted | never fired in backtests | One vocabulary, one agreed sign |

The four dark elements (F3, F8, F9, F10) carry **28 of the declared 100 points** and 16 of the code's
100 for the traded call. That is the size of the gap between the design as written and the design as
measured - not a gap in the market, and mostly not even a gap in the data, because the local archive
already holds the material to rebuild three of the four.

## 9. What this document does not claim

- It does not forecast gold, or anything else.
- It does not recommend, rank or qualify any trade, entry, exit or level.
- It does not claim that any element works. Where an element has a measured number, the number is printed
  with its population, its base rate and its interval, and most of them are inside the noise band.
- It does not claim the reverse either - that the elements are worthless. Several are simply unmeasurable
  as wired, and unmeasurable is a different statement from wrong.
- It does not say which weight vector is correct, or that any vector can be chosen from the archive
  described here. Section 5 gives the reason the archive cannot answer that.
- It does not describe the live production system from the inside. It was written from exported
  configuration, published artifacts and stored records; where an export could have drifted from the live
  instance, that risk is stated rather than hidden. No credential was used and no live call was made.
- It does not read, quote or approach the project's sealed test window.

---

## 10. Where every fact came from

Names are given so an outside reader can ask for the same artifacts. Nothing here was taken on trust
from a summary of a summary; every figure in sections 5 to 7 was read from the files listed, and the
element-level numbers were recomputed in this lane on 2026-10-04 from the accepted report named below.

**The design side**

- The written logic document: "GOLD Layer 1 Direction Agent - Weighted Analysis Engine", version 2.0,
  marked "production baseline". It holds the only weight table in the system, the ten rule sets, the
  horizon notes, the missing-input rule and the key rules. It arrived in a single file upload on
  2026-06-07 and has not been revised since.
- The exported workflow configuration for the gold agent: 61,473 bytes, nine nodes, containing the model
  node, the input-pack builder, the parser and the conviction calculator. The pack describes the export,
  not the live instance - an export can drift from what is running, and this one has not been diffed
  against the live copy.
- The rule engine used by every backtest, and the historical snapshot builder that feeds it.
- The declared inventory of the 28 readings, held both as a constant list in the readiness checker and as
  a register created 2026-09-19 whose own status line reads "scope declaration, not results". The
  per-reading coverage statuses quoted in section 6 come from that register.

**The record side**

- The per-call outcome grading for the designated session: 2,493 Layer 1 rows, generated 2026-08-15,
  13.8 MB, and its verdict summary generated the same day. The Layer 1 block carries the figures used in
  section 7a and 7b - 1,188 correct of 2,493, the interval, the baseline, the reach and reversal rates,
  and the confidence-band tables. The verdict file also carries the explicit prohibition against
  describing the reach rates as directional accuracy, a win rate, or evidence that a call can be relied
  on for the trading day.
- The following-24-hours confidence panel: 330 rows over five markets, generated 2026-07-28.
- The accepted single-variable report: 95,842,994 bytes, sha256
  `ffcd9cbc3b16fc08449b7fa305188f9ad77358422a4fc1ea0f222e9d01e5c6b6`, re-run read-only on 2026-10-04
  against 2023-2026 anchors. It is the same report the live Direction tab and the published "what moves
  gold" page are built from.
- The 608 stored calls, 2024-01-02 to 2026-04-30, and the five parity archives that hold each stored call
  beside its independently replayed row: gold 608 rows (608 pass), and the four sibling assets 604, 602,
  604 and 850 rows. Every row carries its own evaluation inputs and outcome.
- The research control surface published to users: a 4,589-byte map, version
  "backtesting-development-v1", generated 2026-09-03, which carries the two reach figures (73.2 percent
  full, 99.1 percent half), the data-coverage figure, the not-qualified gate, and its own rule that reach
  is research context and not trade expectancy. Its stage list is also the source of the programme shape -
  reach, audit, individual elements, combinations, executable validation, gate - with the executable
  stage currently blocked because no intraday entry, target or adverse boundary has been defined.
- The two older factor tools built on the code's weight vector: the factor laboratory generated
  2026-07-06 and the re-weighting experiment generated 2026-07-07. The experiment reports +39.6 points
  for gold, measured against an original side that reads 18.4 percent ex-flat - a number that cannot be
  reconciled with any other measurement of the same calls, where the declared directions are right more
  often than not. Until that baseline is re-derived, the improvement is a number in a file rather than a
  demonstrated gain.
- This lane's own advisory notes, 2026-10-03 to 2026-10-08, which hold the working, the commands and the
  longer tables behind sections 5 to 7.

**How an outside reader can check the load-bearing claims.** Three checks carry most of this document,
and none needs this repository: read the weight table in the written design document; read the five
weight tables in the conviction code; compare the two. Then, for any element, score its own stated rule
against the drift on the same days, using only readings that were published before the call. Everything
else here follows from those three.

---

## 11. The open questions this pack waits on

Nothing below is a recommendation. Each is a question that only the system's owner can settle, and each
one changes what the pack should say. They are listed here so that a reader outside the project knows
which parts of this document are conclusions and which are waiting on a decision.

1. **Which weight table is the live one?** The written design and the running code disagree on eight of
   the ten elements for the traded call, and no document says which one governs. Until this is settled
   there is no single "current weighting" for anyone to judge, defend or leave alone.
2. **Which boundary defines a trading day?** The snapshot is stored under a daily date label; the grading
   record uses a session with its own open and close. If those are not the same boundary, part of every
   measured number is a calibration between two definitions of a day rather than a question about gold.
3. **Does the model step stay?** The stored number is the code's, so the model neither sets nor needs to
   set the value. Keeping it costs a model call per day and adds an instruction-compliance failure mode;
   removing it changes nothing about the arithmetic. The choice is about the chain's shape, not its
   accuracy.
4. **Who rebuilds the three rebuildable dark elements?** Fed stance, inflation signal and safe haven can
   all be reconstructed from material already held locally; liquidity and growth needs no new data at all,
   only one shared vocabulary and one agreed sign. Until that is assigned, 28 of the declared 100 points
   stay dark.
5. **Is the VIX element re-derived or stood down?** It is wrong with three-quarters consistency across
   three years on the days it speaks, and it cannot be scored by the project's own careful instrument
   because its rule is an absolute band. Both responses are defensible; leaving it as it is, is not.
6. **Is the dollar element's timing fixed?** Its apparent edge comes from a reading dated inside the
   window it is scored against. Fixing that reduces its speaking days - which is the cost of the fix and
   must be accepted knowingly.
7. **Which grading definition is the headline?** The designated session reads 47.65 percent and the
   following-24-hours panel reads 54.39 percent. Both are honest; quoting one without the other is not.

## 12. What follows this pack

The pack is the first of five pieces of work, and it is the only one that describes rather than measures:

1. **This document** - the elements, the weights, the readings, the record, the status.
2. **The instruction companion** (`LAYER1_ELEMENT_VALIDATION_INSTRUCTIONS.md`) - one work order per
   element, written so that an independent analyst or an outside model can check an element without
   touching the live system, including the split rules that stop a check from fitting itself to the data
   it is checking.
3. **An external review brief** - the same logic and numbers restated for a model outside the project, so
   the reasoning can be attacked from outside rather than re-confirmed from inside.
4. **A red-team charter** - the strongest attacks on this document, named in advance, with what each would
   have to show to be answered.
5. **A status table for the dashboard** - section 8, rendered as a page, so a reader sees which elements
   can and cannot speak before reading anything else.

Two things must not happen before the questions in section 11 are answered: no weight may be moved on the
strength of anything in this pack, and no accuracy claim may be published from it.

---

**Version.** First issue, 2026-10-09, written from the artifacts named in section 10. The element blocks
must be re-issued if the written logic document, the exported workflow, the rule engine or the declared
reading register changes, because each block quotes all four.

