# Pilot 1 dispatch record - the exact package handed to the manual VIX pilot

Dispatched 2026-10-15 by the owner, to be run by hand in a field model session. The manual Astra pilot
starts from this record: it pins the version and the bytes that were handed over, so the returned card
can be registered against the package that produced it rather than against whatever the folder holds
later.

This note is written by hand. `node scripts/build_research_handoff.js write` neither rewrites nor
removes it, it is deliberately **not** a member of the archive it describes, and it is not registered
in the Research Library. Adding it therefore changed no dispatched byte: the archive still hashes to
the value below on disk and over both live delivery routes.

## The package

| field | value |
| --- | --- |
| Pilot | 1, the VIX baseline audit as one package |
| Package version | `1.0.0` (`PILOT_VERSION`), the first pilot package this bundle has produced |
| Factor | `live.f1-vix-level` (F1 VIX level and risk regime) |
| Task the return uploads against | `USD-BASELINE-AUDIT-01` |
| Brief | `docs/research/handoff/usd/v1/packs/f1-vix-level.md` |
| Output template | `docs/research/handoff/usd/v1/RESEARCH_OUTPUT_TEMPLATE.md` |
| Card schema | `docs/research/handoff/usd/v1/research_card.schema.json`, `$id` `usd-session-research-card-v3` (extends `docs/research/usd-session/v1/research-card.schema.json`, `usd-session-research-card-v2`) |
| Pack version | `2.0.0` |
| Context version | `usd-session-context-20261014.1` |
| Generated | 2026-10-15, branch `research/usd-session-20261013`, commit `d07af11166ea1d39e5f4184e85a993e03bcb7137` |
| Archive | `docs/research/handoff/usd/v1/pilot/usd-vix-pilot-v1.zip` |

## The dispatched archive, byte for byte

The archive is stored rather than compressed and has four flat members under the root
`usd-vix-pilot-v1/`. Every member is byte-identical to the file it was taken from, so a return can be
checked against either the file or the archive.

| member | bytes | sha256 |
| --- | --- | --- |
| `usd-vix-pilot-v1.zip` (the whole archive) | 46,619 | `1a4dfbeaa0a98987b074c376aade6a7d64c32a77292ecd788bd3d558b2e8451f` |
| `usd-vix-pilot-v1/f1-vix-level.md` | 14,724 | `808dc01ada48798e01561ef31fd19899dffc0eac9fee826bf9dacd067e499842` |
| `usd-vix-pilot-v1/RESEARCH_OUTPUT_TEMPLATE.md` | 8,582 | `cbea6e9efd5b9b3baacc34c675b6d6b183e5a0ac41ab24c530e45d1b8aa0bc0a` |
| `usd-vix-pilot-v1/research_card.schema.json` | 17,060 | `43b549d0279817b88c76863c7f5ba186d74e902cc6310e36711508cd17094746` |
| `usd-vix-pilot-v1/VIX_PILOT_START_HERE.md` | 5,611 | `408962f8fe86553404c5f57675765c9911fc7e6a709fea54ab8809acfe793942` |

The same values are emitted by the builder in `HANDOFF_MANIFEST.json` (`pilot` block, and the
`pilot/usd-vix-pilot-v1.zip` row of `files`), which is the machine-checkable half of this record: if a
later edit changes any of these bytes, the manifest disagrees with this note and the pilot dispatch has
been superseded rather than quietly re-pointed.

The bundle the pilot was cut from, as it stood at dispatch, for provenance: `usd-research-handoff-v1.zip`
596,029 bytes, sha256 `22a0bb454ec2592c67763178a498b447ca2196529b212aa9c0ae923e2c07e1a6`;
`HANDOFF_MANIFEST.json` 11,721 bytes, sha256
`b4bc3412df97dda2d08f3884af3829203f6ffb30331bccc8fb7450de2df35135`; `USD_SYSTEM_CONTEXT.md` 30,426
bytes, sha256 `37b510e621ef10965dcc9f01e6cacd438acc0169541e4a9e325810d2e476ed1f`; `START_HERE.md` 9,535
bytes, sha256 `2136378f61071a18ba7408a83f25cf158744a36c0d28bd135714ad04384ec89e`.

Corrected later the same day, and recorded here rather than left implicit: the handoff gained a
deep-research tier (`docs/research/handoff/usd/v1/deep-research/`, tier version `1.0.0`) whose report is
now the primary deliverable, so the bundle around this package was regenerated. Nothing in the package
moved: the values in the two tables above still hash to what is on disk, the pack version is still
`2.0.0`, and every one of the twenty-five briefs, the template and the card schema is byte-identical.
The bundle and its note are new bytes: `usd-research-handoff-v1.zip` is now 680,193 bytes, sha256
`a49e4e0fabc29353cb0a39fc6eb17a136b85637f21f4940b9443a70db481b4a6`; `HANDOFF_MANIFEST.json` is 16,261
bytes, sha256 `78ff27e6400bd516b4deb3fe716c79eb53b7a3e2e534252b709aff8c11006048`; `START_HERE.md` is
10,631 bytes, sha256 `f56672cc868521901d5b12322e52ae19fa64d261d023a6e85c49bdb965f3ba42`.
`USD_SYSTEM_CONTEXT.md` is untouched at 30,426 bytes and sha256 `37b510e621ef1096…`. A later dispatch is
a new package with its own version, never this one re-pointed.

## The brief's own registered identity

The brief inside the package is the registered document `usd-brief-f1-vix-level` in
`data/research-library/documents.json`:

- version 2, sha256 `808dc01ada48798e01561ef31fd19899dffc0eac9fee826bf9dacd067e499842`, 14,724 bytes,
  registered 2026-10-13 - the corrected brief, and the version the package carries;
- version 1, sha256 `25f6207967d3c088a7bedd2cc9d474234dc1feaaa76b8b64f5b75c2768a64188`, 12,974 bytes,
  kept immutable.

## How a return registers

1. The return is the card the brief asks for, assembled against the schema above rather than from the
   brief's field list, plus the short note: every source actually fetched, with its link and the
   passage relied on, and the questions the session could not resolve.
2. It uploads against task `USD-BASELINE-AUDIT-01` for factor `live.f1-vix-level` in the Research
   Library, as the package note's step 4 states. Uploading records evidence; it is not an approval.
3. It registers against pilot package `1.0.0`, pack version `2.0.0`, card schema
   `usd-session-research-card-v3` and the hashes above. A card written against different bytes
   registers against the version it actually read; a return is never re-pointed to a later package,
   and a later package is versioned rather than substituted.

## What this record does not claim

- No live deployment, workflow, dashboard, feed, dispatcher, database, interface or configuration
  change was made for this package or is authorised by it.
- The pilot has not been run and no result exists for it. No accuracy, sample size or performance
  figure is asserted here or anywhere in the package.
- No factor's status moved: 22 ready, 3 blocked, before and after. A brief is an assignment, an upload
  is evidence, a passing schema check is not a review, and a reviewed hypothesis is not a tested one.
- The flat band, the study's own tie policy and the missing-quote policy are still unfrozen.

## Two decisions recorded with this dispatch, 2026-10-15

1. The proposed missing-quote policy stays **explicitly proposed**. It is not frozen by this cycle and
   not settled by the VIX card: the methodology reviewer assesses it, and it is frozen together with
   the flat band and the study's own tie policy before any candidate is scored. The VIX return is one
   input to that assessment rather than the decision.
2. The pilot package stays a **bundle-only download**. There is no per-factor action for it in the
   panel, no new library document, and no further interface work.

## Status

The manual Astra return has come back and is recorded as **preliminary, unreviewed and not backtested** in
`docs/research/handoff/usd/v1/pilot/PILOT_1_RETURN_STATUS.md`, which is the hand-written record beside this
one. That return does not complete task `USD-BASELINE-AUDIT-01`, it moved no factor's status and it was not
advanced towards implementation: it answered the per-factor baseline-audit question this package asked, and
the deep research the programme now wants is briefed in
`docs/research/handoff/usd/v1/deep-research/START_HERE.md`.

This is still a record, not a work item: nothing else in the repository depends on the pilot, no lane is
blocked by it, and no further build, deployment or publication follows from it.
