# Interfaces between the research, automation and integration lanes

These are the objects that cross a lane boundary. The integration lane owns the shapes; the two working lanes
may propose a change but do not change one unilaterally. Everything here is read from the code and the
catalogue on 2026-10-25 - nothing in this file is aspirational about what exists, and the last section says
plainly what does not.

## What each lane may edit

| Surface | Research lane | Automation lane | Integration lane |
| --- | --- | --- | --- |
| `docs/research/factors/**`, `docs/research/final/**`, `docs/research/handoff/**` | writes | reads | reviews |
| `scripts/build_research_library.js` authored chains and prompt text | writes | reads | reviews and publishes |
| `data/research-library/catalog.json` | never by hand - regenerated | reads | publishes the regenerated file |
| `data/research-library/documents.json` | never | never | writes, through the store only |
| `lib/research_library*.js`, `script.js`, `scripts/research-library-server.js` | never | never | writes |
| Automation adapter, queue, allowance handling | never | writes, outside the repository until reviewed | reviews and publishes |

The catalogue is generated, never hand-edited: `node scripts/build_research_library.js catalog --write` writes
the catalogue and the prompt files together, so a prompt and its recorded hash cannot disagree. `chains --check`
and `verify` fail on drift.

## Interface A - the prompt package

The unit of work is one stage of one chain. Its authoritative record is the catalogue entry:

```json
{
  "asset": "USD",
  "chain_id": "usd-factor-live-f1-vix-level",
  "factor_id": "live.f1-vix-level",
  "topic_id": "usd-topic-vix-level-and-risk-regime",
  "stage": "research",
  "stage_order": 1,
  "document_type": "report",
  "prompt_path": "docs/research/factors/usd/live-f1-vix-level/01-research-prompt.md",
  "prompt_sha256": "…64 hex…",
  "prompt_bytes": 23170,
  "session": "05:00 Europe/London to 05:00 Europe/London on the next local date",
  "parent": null
}
```

The automation lane reads this from `data/research-library/catalog.json` (`factor_chains[].stages[]`, and
`final_chain` for the asset-level stages) and never restates prompt text of its own. A run record quotes the
`prompt_sha256` it used; if the catalogue hash changes, the old run is stale rather than reusable. For stages 2
and 3 the parent is the registered document id and the exact version the stage must judge, taken from
`/manifest`, never from a folder listing.

## Interface B - the stage return

One Markdown file per stage, with `document_type` fixed by the stage: `report` for research, `review` for
red-team, `synthesis` for adjudication and for all three final stages. Stages after the first carry identifier
lines at the top of the file, filled from the stage card - `Reviewed document`, `Reviewed version`,
`Reviewed sha256` for a factor red-team; `Adjudication read: <factor id> - <document id> - version <version> -
sha256 <sha256>` for the final analysis. The dashboard records the chain, stage and parent; the return does not
assemble that metadata itself.

A return that cannot name the version it judged is refused by the store, not silently registered.

## Interface C - registration

`POST /documents` against the library service, `Authorization: Bearer <token>`, JSON body. The token is the
service's own, created on first run at `.local/research-library/service-token`, and it never leaves the local
machine; the published page carries only the project's publishable key for the hosted store.

| Field | Required | Notes |
| --- | --- | --- |
| `document_id` | yes | Slug; the store normalises it |
| `asset` | yes | `USD` today |
| `document_type` | yes | One of `report`, `review`, `synthesis`, `experiment`, `issue_register`, `context_package` |
| `title` | yes | Plain title shown in the panel |
| `chain_id` or `factor_id` | for a stage | A factor chain through `factor_id`, the asset chain through `chain_id` alone |
| `stage` | for a stage | `research`, `red_team`, `adjudication`, `final_analysis`, `final_red_team`, `final_adjudication` |
| `parent_document_id`, `parent_version` | stages 2 and 3 | Must be the previous stage in the same chain and a version that exists |
| `input_documents` | final stages | `[{document_id, version, sha256, role, role_stage}]`, matching the registry exactly |
| `content_base64` or `content_text` | yes | 8 MiB maximum |
| `task_id`, `context_version` | no | If given, both are checked against the catalogue task |
| `model` | no | Provenance only; the panel no longer asks for it |
| `open_findings` | no | List of strings |

Success is `201` (or `200` with `duplicate: true` when the bytes are already registered) carrying
`document_id`, `version`, `sha256`, `bytes` and `download_reference`. A refusal is `400`/`422` with
`{ ok: false, error, problems: [...] }`, and the `problems` list is what a person or a lane reads: unknown chain,
wrong stage, parent not registered, parent in another chain, parent version that does not exist, final chain
locked, input package missing or changed, oversize body. Identical bytes dedupe; a changed body creates the
next immutable version.

## Interface D - read-back

| Route | Auth | Returns |
| --- | --- | --- |
| `GET /health` | none | Service name, version, counts, task and topic ids. Publishes no report |
| `GET /manifest` | bearer | Every document with versions, hashes, bytes, chain, stage, parent links, `download_reference` |
| `GET /documents/<id>/versions/<v>` | bearer | The bytes, with `X-Content-SHA256`, `X-Document-Id`, `X-Document-Version` headers |
| `GET /export` | bearer | Manifest plus download references and task prompt fingerprints |
| `GET /tasks/<id>/context-package` | bearer | The task's context package, with a stable fingerprint |

The service binds `127.0.0.1` and is not reachable from a phone; the live site reaches the hosted store
instead. A hosted-only test therefore means: local service stopped, page served by the host, sign in with
GitHub, upload, reload, read the same document id back.

## Interface E - queue, allowance and recovery (automation lane)

This is the contract the automation lane must implement before any pilot is claimed. None of it exists yet.

- **Eligibility** is derived from `/manifest` and the catalogue, never from a local queue file: the lowest
  incomplete stage in chain order, skipping any chain whose parent is missing. Deterministic, so two runs
  cannot pick the same stage by accident.
- **Idempotency key** is `(chain_id, stage, prompt_sha256, parent_document_id, parent_version)`. A run that
  died before registration is re-dispatched under a new run id with the old one recorded as failed; a run whose
  document is already in the manifest is recorded as registered and never re-uploaded.
- **Allowance handling**: on a quota or rate-limit response the queue pauses, records `paused_allowance` with
  the provider's own words and a timestamp, and resumes only when a later probe succeeds. No retry loop, no
  parallel workaround, no alternate provider chosen silently.
- **Restart recovery**: after a restart the lane reads `/manifest`, re-derives eligibility and reconciles its
  own run log against it. An unreadable store is reported as unknown, never as an empty library, and a
  reconciliation that cannot read the store blocks dispatch.
- **Per-run record** (required for any run described as verified): run id, chain, stage, `prompt_sha256`,
  parent document and version, session or model identifier, start and end time, outcome, the registration
  response (`document_id`, `version`, `sha256`, `bytes`), and the manifest read-back that matched it.

## What does not exist

- No scheduler, queue, allowance handler or Astra adapter is in the repository. The only registration path
  that has been verified end to end is a person uploading through the page, most recently on a phone on
  2026-10-24 with the local service stopped.
- No run has been executed by a machine, and no sentence in any lane's report may say otherwise until one has.

