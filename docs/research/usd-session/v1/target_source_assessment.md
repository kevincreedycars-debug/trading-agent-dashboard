# Intraday DXY sources: an assessment and a recommendation (2026-10-13)

Answering the brief's question 2. This is an assessment, not a purchase: nothing was bought, no key was used,
no data was licensed and no target was changed. Every claim below is labelled with how it was checked.

The target needs a price at **05:00 Europe/London** and at **17:00 America/New_York** on the same local date,
for the same instrument, with no revision between the two readings, and with a defensible answer to "what is
this number".

## 1. What was verified from the sources themselves

| Source | What it is | Verified facts | Usable at both ends of the session? |
| --- | --- | --- | --- |
| **ICE U.S. Dollar Index (DXY / USDX)** | the index itself, owned and published by ICE Data Indices, LLC | the ICE product page for the DX contract states that the U.S. Dollar Index, including its formulation, components, values, weightings and calculation method, "is the exclusive property of ICE Data Indices, LLC", that the designations are its trademarks, and that "any use whatsoever ... whether directly or indirectly, is strictly prohibited without the express written consent of ICE Data Indices, LLC". The contract is physically settled against six currencies (euro, yen, pound, Canadian dollar, Swedish krona, Swiss franc) in their index weights, trades 21 hours a day, and its **daily settlement is a volume-weighted average of trades from 14:59 to 15:00 Eastern** (verified on ice.com) | The instrument exists intraday, but the index values may not be reproduced or used without a licence, and the *official* daily settlement (15:00 ET) is two hours before our endpoint (17:00 ET) |
| **FRED `DTWEXBGS`** (the field the live collector stores as `dxy_level`) | Fed H.10 Nominal Broad U.S. Dollar Index | FRED's series page: Board of Governors, release H.10 Foreign Exchange Rates, daily, index Jan 2006 = 100, "Public Domain: Citation Requested", "All data are subject to revision"; the value for 2026-10-02 was published 2026-10-05 15:16 CT | **No.** Daily, not the ICE basket, and the H.10 release page states the Board "releases daily bilateral exchange rates and U.S. dollar indexes for the previous business week" **on Mondays at 4:15 p.m.**, so the newest value at a Monday 05:00 London cutoff predates the weekend |
| **Fed H.10 bilateral series** (e.g. FRED `DEXUSEU`) | noon buying rates in New York for cable transfers, H.10 | FRED series page: Board of Governors, H.10, daily, "Noon buying rates in New York City for cable transfers payable in foreign currencies", "Public Domain: Citation Requested", "All data are subject to revision" | **No.** Same weekly Monday 16:15 ET release as above, and a noon fix is neither 05:00 London nor 17:00 New York |
| **Free intraday dollar-index quotes** (Yahoo's `DX-Y.NYB`, Stooq's `dx.f`/`usdidx`, Investing.com, TradingView and similar mirrors) | vendor mirrors of the ICE index or of its futures | not verified. Stooq refused this session's fetch outright (HTTP 403), the Nasdaq Data Link page tried for the ICE-linked continuous contract returned 404, and no vendor terms page could be read | **Unknown by construction.** These mirrors republish a licensed index or its futures without a stated licence, and their delay, revision and redistribution terms are unstated, so the repository cannot cite one as a source it is entitled to use |
| **Broker or vendor spot for the six index legs** | EUR/USD, USD/JPY, GBP/USD, USD/CAD, USD/SEK, USD/CHF spot | the repository already caches hourly OANDA bars for EUR/USD, XAU/USD and NAS100 to 2026-04-30; the live collector reaches Coinbase spot for a different set that does not include EUR, CHF or SEK | **Partially, and only as a differently named target.** One of six legs exists in the checkout today |

Not assessed: Bloomberg `BBDXY`, Refinitiv, ICE Connect intraday entitlements, and the OANDA, IG and
Interactive Brokers API tiers. Each is a commercial question that needs a price and terms request rather than a
guess, so none is scored here.

## 2. The recommendation

**Do not purchase anything yet, and do not relabel anything as DXY.**

1. **Preferred, and the only route that preserves the name "DXY":** licence the intraday ICE U.S. Dollar Index
   from ICE Data Indices, either the index values or the DX futures feed on ICE Futures U.S. One line item, one
   vendor, and the rights question is settled by contract rather than by habit. Two things must be confirmed in
   writing before any dataset is built: (a) whether an intraday index or futures print can be read at exactly
   05:00 London and 17:00 New York, given that the official daily settlement is 15:00 ET; and (b) that the
   licence permits storing the values in this repository and deriving a label from them. If the answer to (a) is
   no, then even a licensed DXY cannot price the endpoint the brief asks for, and the target itself has to
   change.
2. **If that is refused or too expensive: change the target, and change its name.** The honest fallback is a
   pair-based session target, which measures the euro leg of the dollar rather than the dollar basket, named in
   section 3.

Attempting a free intraday DXY proxy is the one option that should be rejected outright: it would produce a
number called DXY whose instrument, licence and delay are unknown, which is exactly the failure the brief is
guarding against.

## 3. The named alternative targets, with their limitations

| Proposed id | Instrument | Source that actually exists today | Limitations that must be printed on every artefact |
| --- | --- | --- | --- |
| `alt.eurusd-session-h1` | **EUR/USD**, 05:00 London to 17:00 New York | `backtester/tmp/oanda_eur_usd_h1.csv` (hourly, to 2026-04-30); a live path would need that OANDA lineage extended, and the collector has no EUR/USD field today | It is the **euro**, not the dollar basket: the euro is the largest DXY leg, so the two often move together and can diverge exactly when the yen or the krona leads. It cannot be labelled DXY, and a DXY-labelled claim may not be scored against it. Reaching the present needs a documented acquisition path |
| `alt.usd6-venue-basket` | a **custom six-leg dollar basket** re-derived from venue quotes | not constructible today: Coinbase covers JPY, GBP, CAD and AUD spot but not EUR, CHF or SEK, and the OANDA cache holds only EUR/USD. Building it needs two new live collector paths plus a frozen weighting rule | It is a **new index with no history**, so it cannot be back-tested before it is built, and its weights would be a research choice rather than ICE's. Any comparison against published DXY studies then becomes an open question |

Note on what is *not* proposed: `DTWEXBGS` stays a **feature**, because it is what the live collector already
stores, but it cannot be the session label. Its weekly Monday 16:15 ET release makes a same-day 05:00 London
reading impossible, and it is a broad trade-weighted index rather than the ICE basket.

## 4. Acceptance checklist for whatever is chosen

Before any dataset is built, the chosen source must answer, in writing:

1. An exact print at 05:00 Europe/London and at 17:00 America/New_York on the same local date, including the
   two DST-mismatch weeks when the window is 16 hours rather than 17.
2. Whether the printed value is provisional and later revised, and if so when, so the label can be frozen at
   first print.
3. The non-trading calendar: weekends, ICE holidays, and any venue holiday the source observes.
4. Rights to store the values in this repository, publish a derived label, and keep an immutable copy.
5. A machine-readable history long enough for a development, validation and holdout split before any candidate
   is scored.

Until (1) to (5) are answered, the label instrument in `session_contract_v1.json` stays `UNVERIFIED`, and the
research packages continue to require every claim to name the instrument it is really about.
