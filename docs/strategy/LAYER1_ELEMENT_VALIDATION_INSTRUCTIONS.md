# Gold Layer 1: how to check each element

Instruction companion to `LAYER1_GOLD_LOGIC_PACK.md`, written 2026-10-09. Where the pack describes the
system and its record, this document says exactly what an independent analyst - or a model outside the
project - should do to test one element, and what makes a test inadmissible. One work order per element,
in the same order as the pack.

**Who this is for.** Anyone checking the logic without access to the live system: an outside model, a
new analyst, or the system's owner verifying a claim. The reading material is an archive of daily
snapshots with outcomes, an event calendar, and the element definitions. No live call, no credential and
no dashboard change is needed, and none is permitted.

**The three things every work order shares.**

1. **Vintage rule.** A reading may only be used if it was published *before* the moment the call is made.
   Using the value the reading later settled at is the one mistake that produces large, worthless numbers -
   it has already happened once in this project, on the dollar element, and section 7c of the pack records
   the result. Where a reading's publication time is unknown, the work order says so and treats the test
   as a reproduction, not as evidence.
2. **Comparator.** Every hit rate is reported beside the drift on exactly the same days - what "always
   call up" scored on those rows - never beside 50 percent. A reading that is merely on the winning side
   of gold's drift has no edge.
3. **Verdict vocabulary.** Five words only, and they are not interchangeable:
   - **holds** - the edge's 95 percent interval excludes zero, the sign is the same in each year with 20
     or more days, and the population is 100 days or more;
   - **no information** - the interval includes zero;
   - **unstable across years** - the sign flips between years with enough days in each;
   - **dead** - the element never fires, or its rule can literally never match its input;
   - **not scoreable** - the element's rule cannot be expressed as a state of a measured reading.
   "Not scoreable" is a statement about the wiring, not about the market, and it must never be reported as
   a negative result.

**The guards, which apply to all ten work orders.**

- **No fitting after the fact.** Split the days by date: choose anything you have to choose (thresholds,
  windows, signs) on the earlier two thirds, then look once at the last third and report that number.
  Re-cutting the holdout after seeing it invalidates the test, and so does reporting the best split.
- **State the population.** Every number travels with the number of days, the window it covers, and the
  reading's source. A hit rate without its population is not a result.
- **Say what you changed.** If the test required defining something the design never defined (a
  threshold, a sign, a regime label), say so in the first line, because that definition is a design
  decision, not a measurement.
- **No weight changes, no recommendations.** A work order produces a verdict and a sentence about whether
  the element can be measured at all. Nothing in this document may be used to move a live weight.
- **Never read the sealed window.** The frozen period exists for one later prospective test and is not
  part of any check here.

**Sample sizes, so nobody over-reads a number.** On this daily archive the detectable effect at 80
percent power is about 5.9 points. Proving a true 1-point edge needs roughly 19,600 days; 2 points about
4,900; 3 points about 2,178. Event days are the only place with more resolution: 905 distinct US release
days, 656 with both an actual and a consensus, 165 high-impact - about enough for a 10-point event-day
claim and not enough for a 5-point one. A result inside the noise band is a real result: it means the
element cannot be shown to help, and it should be reported that way rather than buried.

---

## The ten work orders

### Work order 1 - Real yield direction (F1, declared weight 22)

1. **Question.** Does the five-observation change in the 10-year real yield tell us anything about the
   next session's gold direction, once only values published before the call are used?
2. **Data needed.** The 10-year real yield series with its five- and twenty-observation changes, gold's
   designated-session direction for the same days, 2023-2026, minimum 100 days and 20 per year.
3. **The test.** Apply the declared rule exactly as written (falling 5 basis points or more is bullish,
   rising 5 or more is bearish, otherwise neutral). Score every day it speaks against the drift on the
   same days. Then repeat on the twenty-observation change for the weekly horizons, because the design
   uses it there and nobody has measured it.
4. **What to report.** Hit rate, days, interval, edge against the drift, the same three numbers per year,
   and the verdict word.
5. **Guards.** Do not sweep thresholds. If a second threshold is tested it must be declared before the
   holdout is opened, and both numbers reported, not the better one.
6. **Expected verdict basis.** The existing measurement reads 50.80 percent on 1,864 rows, +1.17 points,
   no information. An independent check should reproduce roughly that, or explain the difference.
7. **What retires the element.** A clean no information on the holdout with 100 or more days and a stable
   sign. That would not prove real yields do not matter to gold - it would prove this element, at this
   horizon, on this data, cannot show it.

### Work order 2 - The US dollar (F2, declared weight 18)

1. **Question.** Once the evidence is restricted to what was published before the call, does the dollar
   reading still carry information about the next session's gold direction?
2. **Data needed.** The dollar series the system actually reads, named explicitly - the local coverage
   record says the classic ICE index does not exist locally while the collector's mapping uses a broad
   trade-weighted index, so the work order must state which one it used. Plus gold's session outcome.
3. **The test.** Two runs, both reported, never merged. Run A reproduces the current artifact: the
   same-day dollar change, which is the reading the stored calls were scored with. Run B uses only the
   most recent dollar value published before the call. Then the threshold comparison: the design declares
   0.30 percent, the code applies 0.15 percent on the 24-hour call, so score both and say which fires.
4. **What to report.** Run A and run B side by side, with days spoken, hit rate, interval, edge per year,
   and the verdict for each. The size of the gap between A and B *is* the finding.
5. **Guards.** Run A may never be quoted as evidence for the element's value; it exists to show the size
   of the timing effect. Do not choose a threshold on the holdout.
6. **Expected verdict basis.** Run A reads about 72 percent on 288 days. Run B reads about 50.7 percent on
   2,892 rows, +0.35 points, no information.
7. **What retires the element.** Run B showing no information with the instrument named and the lag
   enforced. Note the consequence honestly: the dollar element carries the only large number in the
   record, so retiring it removes the number as well as the element.

### Work order 3 - Fed stance (F3, declared weight 14)

1. **Question.** Does a recorded Fed stance tell us anything about the next session's gold direction?
2. **Data needed.** The stance value reconstructing in history, which does not exist yet - so this work
   order has a prerequisite, stated first: rebuild the column for the archive with one declared
   derivation (the locally held 2-year and 10-year yields, the real yield, and the rate-decision rows in
   the event calendar), versioned, with the time each judgment became available recorded. The live column
   exists and can guide the derivation; it cannot be copied backwards without inventing the values, which
   the design forbids.
3. **The test.** Once the column exists: the declared rule (dovish bullish, hawkish bearish, neutral and
   unknown neutral), scored against the drift on the same days. Report the split of the column's values
   as well, because a stance that is neutral on nine days in ten has little to say by construction.
4. **What to report.** Hit rate, days spoken, interval, edge per year, the distribution of values, and the
   verdict. If the derivation is disputed, that dispute is the finding.
5. **Guards.** Do not measure before the column exists. Do not backfill a stance from what the Fed later
   did, or from the yield curve's own future path.
6. **Expected verdict basis.** None exists: 14 of the declared 100 points have never been scored on a
   single day.
7. **What retires the element.** A no information verdict on a properly derived, vintage-lagged column.
   Anything measured before the derivation exists is a measurement of a blank string.

### Work order 4 - Two-year US yield (F4, declared weight 8)

1. **Question.** Does the change in the 2-year yield add anything beyond the change in the real yield,
   which shares its mechanism?
2. **Data needed.** The 2-year yield and its five- and twenty-observation changes, the 10-year real yield
   and its changes, and gold's session outcome, all vintage-lagged.
3. **The test.** Two runs. Run A scores the element alone, by the declared rule. Run B scores it on the
   days where the real-yield element was neutral, which is the only place the two are not simply the same
   voice. Report both, and report the overlap: the two move together on 175 of the days measured, at a
   0.94 correlation.
4. **What to report.** Run A and Run B with days, hit rate, interval, edge, and the verdict for each.
5. **Guards.** Run B's population will be small; if it is under 100 days, the honest report is that the
   question cannot be answered on this archive, not that the element was confirmed.
6. **Expected verdict basis.** Run A reads 52.54 percent on 1,873 rows, +2.57 points, no information.
7. **What retires the element.** If Run B shows nothing while Run A also shows nothing, then the two
   elements together are 18 declared points of one idea, and the report should say so.

### Work order 5 - Gold's own recent move (F5, declared weight 8)

1. **Question.** Does gold's own prior move carry any information about its next session, at any threshold
   the design would defend?
2. **Data needed.** Gold's price and its one-, five- and twenty-day percentage changes, and gold's session
   outcome, vintage-lagged (the price series is hourly, so the lag question is about which close the call
   could have seen).
3. **The test.** Three runs, all pre-declared before the holdout is opened. Run A: the code's thresholds
   (0.3 percent on the 24-hour call, 0.5 percent elsewhere). Run B: a single fixed threshold of 0.5
   percent on every horizon, which is the flattest defensible choice. Run C: the sign of the prior
   return, with no threshold at all. Report all three, because the design states no threshold and no
   threshold can be claimed as the design's.
4. **What to report.** For each run: days spoken, hit rate, interval, edge, per-year figures, verdict. Plus
   one extra line: how often gold's prior move agrees with the next session (the answer in the archive is
   no better than a coin, and agreeing with the previous session about 98.5 percent of the time is what
   makes a momentum element look busier than it is).
5. **Guards.** Do not report the best of the three as the element's result. A threshold chosen after
   seeing the holdout is a fitted number.
6. **Expected verdict basis.** 50.74 percent on 363 speaking days, -7.41 points against the best constant
   answer on the same days.
7. **What retires the element.** If none of the three runs shows information, the element cannot be
   rescued by choosing a threshold, and the report should say that the element has no daily
   autocorrelation to harvest rather than that a better threshold might exist.

### Work order 6 - Risk regime, measured by the VIX (F6, declared weight 10)

1. **Question.** Is the VIX element wrong because the idea is wrong, or because an absolute band is the
   wrong way to express it?
2. **Data needed.** The VIX level and its one- and five-observation changes - the two change readings are
   declared in the design and unused by any rule - plus gold's session outcome, vintage-lagged.
3. **The test.** Three runs, reported together. Run A: the declared band (above 25 bullish, below 16
   bearish). Run B: the declared-but-unused change readings, in the same direction as the level rule. Run
   C: an interaction, in which the VIX only speaks when the dollar is also moving, since the two are
   supposed to reinforce each other in a genuine risk event.
4. **What to report.** All three runs with days, hit rate, interval, edge, and the year-by-year split. The
   year split is essential here: the existing measurement is wrong in each of the three years separately
   (39.1, 42.4, 30.0 percent), which is what separates a mis-specified rule from noise.
5. **Guards.** Do not report Run A as a validation of the element - the code already implements it
   exactly, so Run A checks the code, not the idea. State that the element cannot be scored by the
   project's own careful instrument, because that instrument scores states of measured readings and this
   element's rule is an absolute band.
6. **Expected verdict basis.** 39.71 percent on 204 non-flat days, -21.57 points, stable by year.
7. **What retires the element.** If Run B and Run C also fail, the honest report is that the element
   should stand down to zero weight or be replaced, and that a rule which is wrong across three separate
   years is not a rule waiting for more data.

### Work order 7 - US economic surprises (F7, declared weight 6)

1. **Question.** On days when a US release lands, does the surprise - the released value against the
   consensus available beforehand - tell us anything about the next session's gold direction?
2. **Data needed.** The event calendar with the family, the released value, the pre-release consensus and
   the release time; 905 distinct release days, 656 with both an actual and a consensus, 165 high-impact.
   Plus gold's session outcome. The surprise field exists but is a proposed mapping, so the sign
   convention per family must be declared before measuring.
3. **The test.** Two populations, scored separately and never pooled: release days, and non-release days.
   On release days, the declared rule is contrarian (a positive surprise is bearish for gold, a negative
   one bullish). Also test the age of the release: if the effect exists it should decay with the hours
   since it landed, and a rule that only works in the first few hours is a different rule from one that
   works all day.
4. **What to report.** Both populations with days, hit rate, interval, edge, and the verdict. Then the
   sign table per family, since the sign is exactly what the current implementation cannot express: it
   searches a serialised record for English words instead of reading the surprise.
5. **Guards.** Do not use the previously released prior value as the consensus - the local record shows
   those are not authenticated pre-release vintages. Do not pool release and non-release days to increase
   the population, because they are different questions.
6. **Expected verdict basis.** The element has fired on 12 days in the stored record, with 7 usable
   outcomes - a population that can support no conclusion in either direction.
7. **What retires the element.** On 905 release days a 10-point effect would be visible; a null result at
   that size is a real finding, while a null result on 50 release days is not. State which one you have.

### Work order 8 - Inflation signal (F8, declared weight 6)

1. **Question.** Can an inflation regime be defined from data already held, and does that regime relate to
   gold's next session?
2. **Data needed.** The event calendar's inflation rows - about 179 usable CPI releases plus PCE and PPI -
   each with an actual and a consensus, and gold's session outcome. Nothing else is required, and no new
   data source should be bought for this work order.
3. **The test.** Three definitions, declared before the holdout is opened, each scored separately, because
   the design names the reading without defining it: (a) an inflation surprise, as the released value
   against consensus; (b) a trend in the rate, as the change over the last two or three releases; (c) a
   level of realised inflation, split at its own median over the window. The rules to apply are the
   design's: hot with easing expectations bullish, disinflation bearish, unclear neutral.
4. **What to report.** All three definitions with days, hit rate, interval, edge, verdict, and a sentence
   on which definition - if any - the design most plausibly meant.
5. **Guards.** Do not measure before a definition is declared. Do not borrow the surprise element's input
   and present it as a new reading: a definition that duplicates the surprise element adds nothing to the
   model even if it scores well.
6. **Expected verdict basis.** None: 6 of the declared 100 points have never fired, and the reading does
   not exist anywhere in the system.
7. **What retires the element.** If all three definitions come back with no information, the honest
   report is that the element should be removed from the design rather than left in place as decoration.

### Work order 9 - Safe-haven demand (F9, declared weight 6)

1. **Question.** Can stress days be distinguished from calm days at all, and if so, does the difference show
   up in gold's direction or only in how far gold travels?
2. **Data needed.** The event archive's 5,115 rows with names and importance levels, plus the VIX, plus
   gold's session outcome and gold's session range, vintage-lagged.
3. **The test.** Build and declare a classifier before measuring - a rule that names the event families and
   importance levels that count as stress. Then score two things separately: direction (the design's
   rule: stress bullish, calm neutral, never bearish) and range (whether stress days have a wider range
   than calm days, regardless of direction). Finally re-check the one existing trace of this element: a
   median split of the risk-headline reading scores 60.51 percent on 471 session rows, but the project's
   own report labels that row unstable across years, and at that threshold roughly two and a half rows
   would be expected to reach it by chance across the rows tested. A declared classifier replaces that
   median split; it does not inherit its number.
4. **What to report.** Direction and range results separately, each with days, hit rate or range
   difference, interval, edge, per-year figures, and a verdict. Plus one line stating whether the element
   is one-sided by design, since it can never vote bearish.
5. **Guards.** Do not score the element on a reading that does not exist: the current implementation reads
   a field that is empty on 143 of 147 live snapshots and empty in the rebuilt archive. Do not treat a
   range effect as a direction effect.
6. **Expected verdict basis.** None: the element has never fired on any path, live or historical.
7. **What retires the element.** A classifier that cannot separate stress from calm on either measure. If
   it separates range but not direction, the honest report is that the element belongs in a range or
   volatility decision, not in a direction call - which would be a change to the design, not to a weight.

### Work order 10 - Liquidity and growth (F10, declared weight 2)

1. **Question.** With one shared vocabulary and one agreed sign, does a liquidity or growth regime carry
   anything about gold's next session?
2. **Data needed.** Nothing new: the regime label the producers already write, normalised to one
   vocabulary, plus gold's session outcome. The two readings the design names for this element have no
   local source or derivation rule, so whichever label is used has to be declared as the substitute.
3. **The test.** First, the repair, which is a prerequisite and not part of the measurement: agree one
   vocabulary with the owner, and record whether the design's sign or the code's sign governs. The two
   currently disagree on both legs - the design says expansion is bullish and contraction bearish, the code
   says the reverse. Then score the element once with the design's sign and once with the code's sign, and
   report both. Do not choose the sign after seeing the numbers; the point of reporting both is to show
   which is right, and the owner decides which one the system keeps.
4. **What to report.** Both signs with days, hit rate, interval, edge, and the verdict. Plus the count of
   days the label was available at all, because the historical rebuild currently produces labels that the
   rule can never match ("expanding" and "contracting" against a rule looking for "expansion" and
   "contraction"), which is why the element has never fired in any backtest.
5. **Guards.** Do not measure the element while the vocabulary mismatch stands: that measurement scores a
   string comparison, not a market idea, and it will return "dead" every time for a reason that says
   nothing about liquidity.
6. **Expected verdict basis.** None: zero speaking days in the rebuilt archive, and two speaking days in
   147 live days.
7. **What retires the element.** A no information verdict after the repair. Given its declared weight of 2
   points, that is a small loss; the larger finding would be which of the two signs was right, because the
   answer also settles what the element means.

---

## How to run the ten, and how to file the result

**Order of work.** Three groups, by what each needs before it can start.

- **Can start immediately, on material already held:** work order 5 (gold's own move), work order 6 (the
  VIX element), work order 1 (real yield), work order 4 (two-year yield), and the lagged half of work
  order 2 (the dollar). Work orders 5 and 6 are the two cheapest, and work order 2's run B is the one
  that most changes what the existing record means, because it decides whether the archive's only large
  number is a discovery or an artifact.
- **Need one prerequisite each before measuring:** work order 3 (a reconstructed Fed stance with a
  declared derivation), work order 8 (one declared definition of an inflation regime), work order 9 (a
  declared stress classifier). The data for all three is already local, so these are code and definition
  tasks rather than acquisition tasks.
- **Need a decision before measuring at all:** work order 10, because the two signs in the system
  contradict each other and the owner has to say which one governs. Work order 7 also sits here in part,
  because the sign per event family has to be declared before it can be scored.

**The output of every work order, in one fixed shape.** A row and a paragraph, no more:

- element, the run performed, and the definition sentence (what had to be defined to run it);
- days spoken, population, window, hit rate, 95 percent interval, edge against the drift on the same days;
- the year-by-year split;
- the verdict word, from the five in the shared rules;
- one sentence on whether the element can be measured at all as wired;
- the artifact the numbers came from, with its size or fingerprint, so the next reader can check the same
  bytes.

**What the ten results may be used for, and what they may not.** Together they fill in one table - the
element status table in the pack - and nothing beyond it. They may not be used to move a weight, to
qualify a call, to publish an accuracy claim, or to rank the elements against each other, because the
elements overlap (the two yield elements move together on 175 days at 0.94 correlation) and a rank across
overlapping readings is not a ranking of anything real.

**What an outside model should be given, if one is used.** The pack, this document, and one element's
data extract at a time - not the whole archive at once, and not the sealed window. Ask it to return the
fixed output shape above, and to state the definition sentence first. A check that returns a hit rate
without a population, or a verdict without a definition, is not a result and should be sent back.

**Non-claims for this document.** It is instructions, not measurements: every measured number quoted
here is a reproduction of one already in the pack, included so a checker knows what to expect. It
confers no authority to change the system, it does not decide any of the open questions listed in the
pack's section 11, and it must not be read as a sign that any element works or fails before its own work
order has been run and filed.
