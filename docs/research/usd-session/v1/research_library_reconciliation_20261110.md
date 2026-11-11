# Research Library reconciliation: the 4 November package is registered

10 November 2026, branch `research/usd-session-20261013`. Research record only. Nothing here changes a live
rule, a workflow or a published call, and registering a document is not a finding about the market.

## 1. The gap this closes

On 2026-11-04 the programme returned twenty-five factor adjudications, a final analysis, a final red-team and a
final adjudication. None of the twenty-seven inputs ever entered
`data/research-library/documents.json`, so every registry-driven reader kept reporting "0 of 25" six days later.
The manifest at `data/research/usd-session/final-adjudication-manifest.json` was the join in the meantime; it is
still the join, and the registry now agrees with it.

## 2. What was verified, and against what

`scripts/register_final_adjudication_package.js` verifies before it writes, and refuses to write if any check
fails:

- **The 25 factor ids**: the manifest's factor set is compared with the catalogue's twenty-five factor chains in
  both directions. No factor is missing, none is invented.
- **The ids, versions and hashes**: each of the 25 has to appear identically in all three stage headers — the
  final analysis (stage 1), the final red-team (stage 2) and the final adjudication (stage 3). Three independent
  headers agreeing is a stronger check than one list agreeing with itself.
- **Parent links inside the package**: stage 2 must name the final analysis the manifest carries, and stage 3
  must name both the final analysis and the final red-team.
- **The two blobs this checkout can reach**: stage 1 (`1db5db6f`) and stage 2 (`0918f206`) are re-hashed from
  their git blobs, and both match the manifest byte for byte. That is how the package's hashes were shown to be
  plain content hashes of the Markdown, not internal ids.
- **The output, separately**: the final adjudication (`ce300a2c`) hashes to
  `7f71c76ff2f61db03be0b2ef2c4a13f4c4b1a03b496cc4a3fea73a266731ff76` (140,703 bytes, 780 lines). That hash is
  recorded in the manifest's `output` block and is never counted among the 27 inputs it judged.

The 25 adjudication documents themselves are not in this checkout. Their bytes stay in the hosted research
store, which is why three headers, rather than a re-hash, are the evidence for them — and the script says so in
its output rather than implying it re-hashed all 27.

| # | Role or factor | Document id | SHA-256 (first 16) |
| --- | --- | --- | --- |
| 1 | final_analysis | 00c72274-782f-4160-bd4e-19e83d028fae | 165a14c3d1d4118a... |
| 2 | final_red_team | db7c791b-dc25-4bfd-ae3f-e298d51ff078 | c58587b6377714f7... |
| 3 | live.f1-vix-level | 60494b47-b2e7-448c-86f4-7aeaae625d04 | b4834d9bfb97da6e... |
| 4 | risk.vix-level-and-change-at-cutoff | 75b03166-6e12-477b-904b-8850171d3612 | 271ad2db59739546... |
| 5 | live.f2-us-2y-delta | 39d975d2-fcde-4471-866c-9a92dab5225b | 53e70f78aa04d2fd... |
| 6 | live.f3-us-de-2y-spread-delta | d94ca3cc-0cc8-43f1-a219-0aa71984b35b | 0c3595fbc92b19e7... |
| 7 | live.f4-real-yield-delta | 7898218b-9e3a-4218-bfbb-2c07f2593047 | 5bcfec87f1e10431... |
| 8 | rates.us-front-end-delta | 3daaf1cf-7845-489d-b24e-5b58175c9fab | fcbde7f4fbd5128f... |
| 9 | rates.relative-front-end-delta | f3fd031e-039b-4565-b9f0-8a1a359daa31 | a477b22eb6ae02be... |
| 10 | rates.real-yield-delta | 93ba54ac-9284-43e5-9f5d-cc0aef150091 | 35d1b0e01a06b242... |
| 11 | rates.term-premium-and-curve | e04b0402-8edb-43d3-98c5-3a9101a08a2e | 2c4de1988f1fa2c9... |
| 12 | rates.credit-spread-delta | a3e7bdd6-51bb-4c7d-9316-0871acf38adb | e2fd5188d0026134... |
| 13 | live.f5-dxy-delta | b977d648-8974-4844-be1a-a3fc8aa1255f | f35733644aaea46d... |
| 14 | live.f6-gold-delta | 7cc9430b-1eed-4134-aa0c-df38e99328c8 | 4b06fc58c88f1780... |

| 15 | live.f9-dollar-smile | 76212f55-bfde-4784-a5fd-e3e8794dee00 | 4afd50b9c83a0cc5... |
| 16 | live.f10-equity-versus-usd | 34badeae-d90d-421e-bda2-3c4a1e45434d | de1f85b67d841d5f... |
| 17 | live.f7-economic-surprise | 8625b5dc-0937-4d2b-a275-892f8881cc80 | 5ad24eaf1e3e7ae3... |
| 18 | live.f8-fed-bias | e15d2fb7-9659-4d70-986b-886a35b2cbc6 | 9c5d127e6fe0a8df... |
| 19 | macro.release-surprise-at-first-print | f25c5c9e-2b5e-4f67-975d-d1f91cfc8d53 | 80e1f1ed4d636350... |
| 20 | fx.usd-session-momentum | 37e7b013-bfe4-43ec-ae15-8d81509faf6e | cefbbde583609132... |
| 21 | fx.usd-overnight-range-position | 0c65b608-842d-4817-9eca-69cb78061c4c | 847659c4fc59259b... |
| 22 | fx.usd-session-volatility-regime | ab69c64a-49c0-4d78-b312-307f8d7e06a9 | c3b124e01bf6aa59... |
| 23 | risk.usd-safe-haven-demand | 6d44fd4c-5c17-4889-a663-e9f692fb5652 | 2945f9bc1e88934e... |
| 24 | risk.risk-on-off-cross-asset-state | 22ea071c-fa6e-4dcc-80e1-db6ad564e3c0 | 6004b4b50cdd1f6e... |
| 25 | calendar.known-releases-between-cutoff-and-endpoint | f2f7bfc7-14ad-4a15-b260-8b553ac441ec | cd8fb852c7f37f9f... |
| 26 | calendar.days-since-and-until-high-impact-events | da2cab05-9b63-4f54-884b-e74c192da6ea | c17c423aabe1b084... |
| 27 | data.quality-gate-for-abstention | 07b2542c-6997-49ad-b382-21a470ebb9d7 | d7f7d1632680ab46... |

## 3. How they are registered, and why not as delivered stages

Each of the 27 is a `storage: "referenced"` record: the library's own word for a document whose id is real and
whose bytes live elsewhere. Three consequences are deliberate:

- **Private.** Every record is `public_download: false`. Nothing in this package becomes downloadable, and the
  storage contract's `public_upload`/`public_download` stay false.
- **No delivered stage is claimed.** A stage record has to name the exact parent version it judged, and each
  factor adjudication judged a red-team document this checkout does not hold. `stage` is therefore `null`, and
  the chain progress numbers do not move: 0 of 25 chains complete before this change and after it.
- **Still linked to its chain.** The record names its `factor_id`, `chain_id` and `topic_id`, and
  `provenance.stage_intent` says which stage it was written for. `lib/research_library.js` now accepts exactly
  that shape — a cited document on a chain, with no stage claimed — and still rejects a record that claims a
  stage without naming its parent. That is the difference between "the library knows this document exists" and
  "this document judged a current parent".

## 4. A second import adds nothing

`register_final_adjudication_package.js --write` reported **27 added, 0 already registered** the first time and
**0 added, 27 already registered** on the second run, with 0 duplicate ids and 0 public documents. A record is
keyed by `document_id`, and an existing record is only accepted if its version and hash match; a hash that moved
is reported as a conflict rather than overwritten. The committed registry keeps the ordering the library's own
seed uses, so `registry --check` stays green after the import.

## 5. Registered is not validated

The panel prints two counts, side by side and deliberately not merged:

- **25/25 factor adjudications registered** — 27 of 27 package inputs cited in the committed registry, 0
  duplicates, 0 public, output hash verified.
- **Directional rules awaiting validation: 25** — 0 validated. No sign, weight, lookback or threshold is
  validated by the adjudication, its own candidate stays `CONFIG_BLOCKED`, and `CONFIG_BLOCKED` is not a market
  abstention.

## 6. The catalogue and registry drift

`npm test` had been failing on two build checks that were not about this package at all: `catalog --check` and
`registry --check` compared the committed JSON with the freshly rendered text and saw a difference, which was
line endings (the working tree had CRLF, the writer emits LF), not content. Both files were regenerated with
`node scripts/build_research_library.js catalog --write` and `registry --write`; git reports no content change
to the catalogue, and `verify` now prints ok for the catalogue, the registry, the repo hashes, the chains and
the chain prompts.

## 7. How to reproduce

```
node scripts/register_final_adjudication_package.js --check    # verify the package, add nothing
node scripts/register_final_adjudication_package.js --write    # idempotent: a second run adds nothing
node scripts/build_research_library.js verify                  # catalogue, registry, hashes, chains
```

## 8. What this does not prove

- It does not make the 25 factor adjudications delivered stages, and it does not open the final chain's gate.
- It does not validate a rule, a weight or a sign; see §5.
- It does not verify the bytes of the 25 adjudications, which are not in this checkout. It verifies that three
  independent stage headers agree on their ids, versions and hashes, and that the two final-stage blobs re-hash
  to the manifest.
- It does not reach the live workflow, the warehouse or the published dashboard data.
