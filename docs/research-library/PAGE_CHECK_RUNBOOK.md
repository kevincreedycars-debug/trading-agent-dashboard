# Research Library — where the documents live and how to check the page

This answers the questions a reader asks before relying on the private store: where the bytes are, what
signs in, what still needs a computer, how to keep a local copy, and how to re-run the published-page
check with test data that is removed again.

## Where a returned document actually goes

| What | Where | In Git |
| --- | --- | --- |
| Document bytes (Markdown) | Supabase project `eaolqbrlywczinfordvg`, **private** bucket `research-documents` | No |
| Row metadata: chain, stage, version, title, kind, file name, sha256, bytes, parents, uploader, time | Supabase table `public.research_documents` | No |
| Who may read: member list | Supabase `public.research_members` + `is_research_member()` | No |
| Catalogue: chains, prompts, published briefs, and the registry entry for a returned document | `data/research-library/catalog.json`, `data/research-library/documents.json`, `docs/research/...` | Yes, public |
| Page code, schema, this documentation | repository | Yes, public |

GitHub holds the page and the registry metadata (document id, version, sha256, bytes, note), never the
returned bytes. A registry row for a hosted document says `storage: library_object` and
`public_download: false`; that is the flag that says "the bytes are in the private store".

Nothing in the hosted path needs the owner's PC: the page talks to Supabase directly with the
publishable key it already ships, and the reader's own session. That covers the factor chains and the
final asset-level chain alike - a final stage carries the factor input package it judged in the row's
`notes`, so nothing has to be recorded by a local process. The local library service
(`http://127.0.0.1:8791`) is optional and remains for anyone working offline. A published page without
a stored service token makes no loopback request at all.

## Signing in

**Sign in with GitHub** is the owner's chosen route and sits first in the account block. The button sends
the browser to the project's own OAuth endpoint, so the GitHub client id and client secret live in
Supabase and never in this page or this repository. The account email and password stay underneath as
the fallback: the owner account `research-library@example.com` was created with a confirmed address so
no inbox is needed, its password is held by the owner and is not in this repository. The two one-time
steps that need the owner's own GitHub account are in `docs/research-library/GITHUB_SIGN_IN.md`.

Only accounts in `public.research_members` can read or write rows and objects; an account that can sign
in but is not on that list is refused everything, which is what keeps other GitHub users out.

- **Remembered sign-in is already the behaviour.** The session is kept in that browser's local storage
  and refreshed with the stored refresh token before every request, so a phone that signed in once opens
  the page the next day already signed in. Only a refused refresh token asks for a password again.
- **GitHub replaces the typing, not the membership rule.** A GitHub sign-in arrives as a new Supabase
  user, so that account is added to `research_members` once, by the owner, after the first sign-in; no
  GitHub user is granted anything by default. The page offers no email-link button because the owner
  address has no inbox.
- The page stores the last email address used, so a returning reader types only the password after a
  refused session.

## What works from a phone with the PC switched off

Verified on 2026-10-25 against the published page (code commit `564f6566`, cache-busters `20261025-research-programme-v1`) with the local service
stopped (nothing listening on `127.0.0.1:8791`, and no loopback request observed during the run): every
step below passed, and the final chain still read `0/25` with `unlocked=false` and no upload form
offered after the factor upload, so the real gate was left exactly where it was. The same run on
2026-10-24 first established the list:

- sign in, remembered across a reload;
- factor-chain stage 1, 2 and 3: choose one Markdown file, upload, read **Uploaded**, reload;
- View result, Download result, and the parent document named by the next stage (**Download inputs**);
- VIX chain: stage 1 shows the hosted row `d7b8eb40-…` v1, sha256 `e4151937…`, 84,056 bytes; stage 2
  names that row as its input and hands the same 84,056 bytes back.

The final asset-level chain (stages 1-3 of `usd-final-asset-analysis`) registers through the same private
store as every factor chain, with the exact factor input package it judged recorded behind
`research-input-package:v1`, so it does not need the local service. It is gated on all twenty-five factor
chains being complete against their current versions, so it cannot be reached yet: the live page reads
`unlocked=false`, `0/25`, twenty-five pending and no stage card rendered.

On 2026-10-25 the live page was re-read after the prompt regeneration: the VIX stage 1 **Copy prompt**
succeeded at 25,490 characters and sha256 `3c2db00e…`, matching the catalogue, and the copied text carried
the five evidence kinds; the final chain still read `unlocked=false`, `0/25`, `0/3` final stages and no page
error was raised.

## Keeping a local copy

Two routes, both read-only:

- **One document:** **Download result** on the stage card saves it under the uploaded file name.
- **Everything:** with the PC online and the service key in the environment,

  ```powershell
  $env:SUPABASE_URL = "https://eaolqbrlywczinfordvg.supabase.co"
  $env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"
  npm run research-library:export
  ```

  Files land under `.local/research-library-export/documents/<chain>/<stage>/v<version>-<sha256>.md`
  with a `manifest.json` beside them. Every file is re-hashed against the sha256 the row recorded, the
  script prints `verified N of N`, and it exits non-zero if any copy does not match. `.local/` is ignored
  by Git, so a local copy never reaches GitHub and nothing is deleted from the store.

Uploads made while the PC is off are stored in Supabase immediately and need no local process, so a
later export collects them; nothing is queued on the PC or lost by it being shut down.

## Is a GitHub backup worth adding?

Not as a second live path, and not with the bytes committed. The value of GitHub here is the metadata it
already carries: the registry row holds the document id, version, sha256, byte count and note, so the
manifest of every return is public and reviewable while the bytes stay private. Committing the bytes
would publish the research and would also mean a second copy that has to be kept in step with the store.

If an off-site copy is wanted later, the cheap version is an encrypted archive (`age` or `gpg`) written
by the export script and committed to a **private** repository, or uploaded to a private bucket in the
same project. That is a separate decision, with its own key handling, and is deliberately not done here.

## The VIX document

`d7b8eb40-ce08-48c3-9d2c-5bf94b7618bc` is the **row identifier** of the hosted document (what the page
shows as the result id). `e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d` is the
**SHA-256 of its bytes**. Both name the same document, and the two values in the earlier handoff were a
row id and a content hash, not two documents.

Checked 2026-10-24 by reading the store and re-hashing the bytes:

- chain `usd-factor-live-f1-vix-level` (`live.f1-vix-level`), stage 1 research, version 1;
- file `VIX_USD_Research_Report.md`, 84,056 bytes, sha256 `e4151937…`, stored privately, uploaded
  2026-10-20 by the owner;
- contents begin "# VIX and the subsequent direction of the US dollar — A critical research report for
  the 05:00 Europe/London forecast session … Research date: 15 October 2026", which is the expected
  VIX red-team input, not a test file;
- the committed registry entry `usd-baseline-audit-01-vix-usd-report` carries the same sha256 and byte
  count, and it is the id the signed-out page shows; signing in switches the card to the hosted row id;
- stage 1 has no parent (correct); stage 2's **Download inputs** names `d7b8eb40…` v1
  sha256 `e4151937…` and returns the same 84,056 bytes; stage 3 stays locked until stage 2 is uploaded.

## Running the published-page check again

`scripts/research_library_page_check.js` drives the live page the way a reader does, at desktop width or
at phone width, and reports PASS or FAIL for each step:

1. the published page loads and the account block signs in;
2. on a phone-sized screen, no sideways overflow and the upload button is inside the viewport;
3. the stage 1 upload form holds exactly one file input and no model or session field;
4. the file uploads, the stage pill reads **Uploaded**, and the card shows the file name, version and
   hash;
5. the session survives a reload and the stage still reads **Uploaded** with the same document id;
6. stage 2 names that document as its input, and **Download inputs** returns byte-identical bytes;
7. View opens the stored bytes and Download saves the same bytes under the uploaded name;
8. the final chain still reads its factor count, a factor upload leaves it closed, and no final-chain
   upload form is offered while the gate reads closed;
9. nothing contacted a loopback host and the page raised no error.

It uploads the registered check document
`docs/research-library/test-uploads/TEST-RESEARCH-LIBRARY-UPLOAD-20261024.md` into stage 1 of
`live.f8-fed-bias`, then removes the row, its object and the check account again.

```powershell
# Creates and removes its own member; needs the service key in the environment.
$env:SUPABASE_URL = "https://eaolqbrlywczinfordvg.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"
npm run research-library:page-check            # desktop width
npm run research-library:page-check:mobile     # iPhone 13 emulation, 390 x 664, touch UA

# Or use an existing member instead of provisioning one:
$env:CHECK_EMAIL = "<address>"; $env:CHECK_PASSWORD = "<password>"
node scripts/research_library_page_check.js --mobile
```

Test data stays isolated: the script reads the rows for the chain before it starts and deletes, in a
`finally` block, only the rows that appeared during the run, their objects, and the member and account it
created. Rows that were already in the store are never touched. `--keep-rows` leaves the row behind for
inspection; `CHECK_CHAIN` / `CHECK_CHAIN_ID` point it at another chain, and `CHECK_URL` at another site.

A phone-sized browser is still a desktop engine pretending: file selection is scripted, the operating
system file picker is not exercised, and iOS Safari's own download handling is not tested. That is why
the last step below is done by hand on the real phone.

### The two-minute check on a real phone

On the phone, over mobile data with the PC off:

1. Open `https://kevincreedycars-debug.github.io/trading-agent-dashboard/`, open **Research Library**;
2. the account block should read **SIGNED IN**; if it does not, tap **Sign in with GitHub** and approve
   once (the email and password underneath still work as the fallback);
3. open the VIX chain (`F1 VIX level and risk regime`) and read stage 1: **Uploaded**, `d7b8eb40…` v1,
   sha256 `e4151937…`;
4. tap **Download inputs** on stage 2 and confirm the file saves as `VIX_USD_Research_Report.md`
   (84,056 bytes); tap **View result** on stage 1 and confirm the report text opens;
5. upload the stage 2 red-team file when it is ready and confirm the pill turns **Uploaded** without a
   reload.
