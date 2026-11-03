# Research upload backend

This is the private place the published dashboard keeps returned research documents in. It is provisioned and in use: a signed-in reader uploads the original bytes from the live page, the store records the SHA-256 fingerprint and the file name, and View or Download later asks Supabase for a short-lived private link and re-checks the fingerprint before anything is shown or saved. Uploading research is still evidence, not approval.

## What exists

- Project `eaolqbrlywczinfordvg` (`Inputs Database`), the same project the dashboard already reads its research views from. The page carries only that project's publishable key; no service key is in the repository or the page.
- Private bucket `research-documents`. No object in it has a public URL.
- Table `public.research_documents`: `topic_id` (the chain id), `stage` (1, 2, 3), `version`, `title`, `kind`, `original_filename`, `sha256`, `bytes`, `storage_path`, `parent_research_id`/`parent_red_team_id` (hosted parents) or `parent_research_ref`/`parent_red_team_ref` (a parent already registered in the catalogue), `uploaded_by`, `uploaded_at`, `notes`.
- View `public.research_documents_current` (latest row per chain and stage).
- Membership table `public.research_members` and `public.is_research_member()`. This list is the access rule: an account that can sign in but is not on it is refused every row and every object. Only the service role can change the list, and no policy exposes it.
- Policies: members may select and insert rows and objects they own; nobody may update or delete, so committed versions are append-only. Anonymous users are refused rows and objects.
- `public.research_upload_backend_status()`: a metadata-only health check that reports whether the bucket exists, whether it is private and whether the table exists. It exposes no rows, paths, identities or contents.
- `scripts/research_library_export.js` (`npm run research-library:export`) reads the store and writes every document, plus a `manifest.json` carrying the recorded metadata and a per-file sha256 re-check, under `.local/research-library-export/`. Git ignores `.local/`, so a local copy never reaches the repository, and the script never writes to the store.
- GitHub holds the page, the provisioning script, the prompts and the registry metadata (`data/research-library/documents.json`: document id, version, sha256, bytes, note), never the returned bytes. A registry row whose `storage` is `library_object` and whose `public_download` is `false` is the pointer to the private bucket.

`supabase/research-uploads.sql` is the whole one-time script. It refuses to run if it finds a conflicting table, view, function, policy, membership table or public bucket. RLS on `storage.objects` is already enabled by the platform, so the script does not alter that table.

## Sign in

The library header carries an account block. A reader signs in once in the browser with the owner
account's email and password; the session token is kept in that browser only, and signing out drops
the hosted rows from the page without touching the committed registry or the local service's records.

GitHub is the owner's chosen sign-in, so **Sign in with GitHub** sits first in that block and the email
and password stay underneath as the fallback. The button only redirects to the project's own OAuth
endpoint: the GitHub client id and secret live in Supabase, and the page still carries no secret at
all. `docs/research-library/GITHUB_SIGN_IN.md` holds the two one-time steps that need the owner's own
GitHub account, the ownership transfer that follows the first GitHub sign-in, and the phone check.

The session outlives the tab: the page swaps the hour-long access token for a fresh one with its
stored refresh token before any request, so a page reopened the next day still uploads and downloads
without signing in again. Only when the refresh token itself is refused does the block ask for the
password again. No email-link sign-in is offered: the owner address has no inbox, so a link could
never arrive and the button only led readers into a dead end.

The owner account is `research-library@example.com`, created by the project administrator with a
confirmed email address so that no inbox is needed to sign in. Its password is held by the owner and
is not in this repository. To replace the address or the password, use the Supabase dashboard
(Authentication → Users) or create a new account and add it to `public.research_members`.

Only the project's email provider is enabled: there is no GitHub, Google or other external sign-in, and
nothing in the page offers one. A remembered session is the supported convenience — sign in once in that
browser, and reopening the page the next day needs no password until the refresh token itself is refused.

To add another permitted account, insert its user id:

```sql
insert into public.research_members (user_id, note) values ('<uuid>', 'who this is');
```

## What the page does

- Factor-chain stages 1 to 3 upload straight to the store when a session exists. The chain id owns the version sequence, so two chains under one display topic never share a version number.
- The form asks for one Markdown file and nothing else. The reader used to be asked for a model or session label and the upload was refused without it; that field is gone, and the record no longer carries it. The page writes the rest itself: file name, SHA-256, bytes, upload time, asset, factor, chain, stage, document type and version, plus the parent row or catalogue document the stage follows.
- Stage 2 records the research row it follows and stage 3 records the research and red-team rows; a parent already registered in the catalogue is named by its catalogue document id, and a parent stored here is named by its row id.
- A stage whose file is stored reads **Uploaded** (the pill used to say "Delivered"), with the file name, hash, size, upload date and the private-store note. **View result** opens the bytes in a new tab and **Download result** saves them under the uploaded file name; both go through a short-lived private link and re-check the fingerprint first.
- Opening the factor chain again, or reloading the page, pulls that chain's hosted rows, so the stage still reads Uploaded with the same file name and version.
- The final chain stores here too, and its return records the exact factor input package it judged. The hosted table has no column for that package, so the page writes it into the row's `notes` behind the marker `research-input-package:v1` - every input document's id, version, sha256, role and role stage, plus the time the package was read - and reads it back against that version only, so a corrected version that recorded no package never inherits the earlier one. The local library service is no longer needed for the final chain; it remains for anyone working offline.
- The page reads the whole store once per signed-in session (one request, newest first, capped at 1000 rows) and merges each chain it finds, so a stage someone else registered shows as Uploaded without that chain being opened first. A failed read is reported as a failure and does not clear what was already shown.
- Final-stage rows are named in the `kind` column (`final_analysis`, `final_red_team`, `final_adjudication`) because stage numbers 1 to 3 are shared with the factor chains.
- Refusals appear inside the upload form, with the chosen file and typed details left in place. Nothing is called registered until the store has answered with the stored row, and no refusal writes anything.

## Download

**View result** opens the stored bytes in a new tab from an ephemeral blob, which is read once and dropped. **Download result**, **Download inputs** and the input-package buttons hand the browser the private link itself, which carries `download=<the name the reader uploaded>` and is answered with `Content-Disposition: attachment`, so the file streams into the reader's own download folder. The page reads the bytes once before that and re-checks the recorded sha256, so a download is still refused when the stored file and the record disagree. Nothing stays in page memory after the click, which is what makes the same button work on a phone and on a slow connection; a blob held by the page was the part that failed there.

A record whose bytes live in the store downloads through the store even when the record was registered before the store existed: a registry row and a stored row are the same file when their sha256 matches, and the stored row is the one that names the private object and the version the store understands. A page that is not served from this machine never asks `127.0.0.1:8791` for a stored document. The local service is a developer tool that runs on the reader's own machine, so the loopback path is kept for a page served from `localhost`, `127.0.0.1` or a file. On the published page a stored record is answered by the store and nothing else: a signed-in reader whose store read was slow or refused gets one fresh read before anything is reported, a reader who is not signed in is asked to sign in, and a store that still cannot be read says so. That rule is what a reported failure needed. The click for the committed VIX report fell through to the loopback service - a browser that had used the local service earlier keeps its endpoint and token in `localStorage` - so the published page asked `http://127.0.0.1:8791/health` and `http://127.0.0.1:8791/documents/usd-baseline-audit-01-vix-usd-report/versions/1`, both `net::ERR_CONNECTION_REFUSED`, and the reader was shown "... could not be downloaded: Failed to fetch". A record whose bytes are genuinely not in the store still says so plainly instead of asking a machine this page never contacted.

If the page's own read-back of an already-signed link fails (a blocked request, a proxy, a slow link), a **Download** still hands the browser that link, because the link carries the file itself, and the message says the fingerprint could not be re-checked in this browser. **View** keeps the strict path: nothing is shown that was not read and checked.

## Messages a reader may see

- “Sign in with your email and password…” means no session exists in this browser.
- “The upload service could not be reached…” means the browser could not contact Supabase. Check the connection and retry.
- “These exact file contents are already stored…” means the SHA-256 rule found the same bytes for that chain and stage. Open the existing version instead.
- “The file could not be stored…” means no object was committed; nothing was recorded.
- “The file is stored, but its library record could not be saved…” means the bytes reached private storage but the row did not; retry registration reuses the same path, and an object already in the bucket is finished off rather than refused.
- “A private download link could not be created…” means the session expired or access was refused. Sign in again.
- "... is kept in the private research store. Sign in with your research account ..." means the record's
  bytes are private and this browser has no session; the page asks the store for nothing else.
- “This record's file is not in the private store…” means the row describes a file whose bytes were never stored here,
  so the page cannot serve it; registering that return on the page stores the bytes and makes it downloadable.
- “That email address and password were not accepted…” means the credentials are wrong; nothing is stored.

## Verify the provisioning

```powershell
node scripts/verify-research-upload.js
```

All five lines must say `PASS`: bucket exists, bucket is private, table exists, anonymous insert is refused, anonymous read is refused. The check reads the publishable key already present in `script.js`; it never uses a service key.

## Check the published page

`npm run research-library:page-check` (desktop width) and `npm run research-library:page-check:mobile`
(iPhone 13 emulation) drive the published URL the way a reader does: sign in from the account block, open
one factor chain, choose one Markdown file, upload, read the stage card, reload, open View and Download,
then read the parent document the next stage names and download it. Every step prints `PASS` or `FAIL`,
the run exits non-zero if anything fails, and the script deletes only the rows that appeared during its
own run plus the member account it created. The whole flow, the isolation rules and the two-minute check
to repeat by hand on a real phone are in `docs/research-library/PAGE_CHECK_RUNBOOK.md`.

The run of 2026-11-02 (desktop and phone-sized emulation, published site, the local service stopped) read: every step
PASS from sign-in through the upload, the reload, the parent hand-back, View and Download, with no loopback request and
no page error, on top of `35023d8b`. The published page was read back against that commit: `script.js`,
`lib/research_upload_client.js` and `lib/research_upload_adapter.js` were byte-identical to it and the page served the
`20261102-research-download-v7`/`-v1` bundles. One isolated round trip on `usd-factor-live-f10-equity-versus-usd`
stage 1 uploaded `TEST-RESEARCH-LIBRARY-UPLOAD-20261024.md` (554 bytes, `e2308b55cafa`), which reached the private
store as row `7f8506e8-…`, read `UPLOADED` with that same record id after two separate refreshes, and downloaded twice
with the original sha256 both times while the browser stayed signed in. The existing VIX report (`d7b8eb40-…`, 84,056
bytes, `e4151937`) and the f5 DXY report (`1b64468d-…`, 47,576 bytes, `9048e897`) downloaded from their stage cards
with the recorded sha256, each served from the private signed link itself rather than from a blob held by the page. The
run removed its own rows, objects and member, and the store was read back afterwards at two documents, two objects and
one member, both objects matching their recorded hashes. In the same run an isolated red-team return was stored on
stage 2 of that chain, the adjudication card named it as the document it follows, and **Download inputs** there
returned those bytes exactly, so the parent a red-team or adjudication stage needs is reachable from the published
page without the local service.

The run of 2026-10-25 (phone-sized emulation, local service stopped, nothing listening on port 8791)
read: every step PASS, from sign-in through the reload, the parent download, View and Download; the
final chain still read `0/25` with the gate closed and no upload form offered, so a factor upload left
the real gate exactly where it was; and the hosts contacted were the published site, the Supabase
project and the two font hosts, so no loopback request was made and no page error was raised. The run
removed its own row, object and account, leaving the store at one member and one document, the VIX
report.

The run of 2026-10-24 (phone-sized emulation, local service stopped, nothing listening on port 8791) read:
signed in; the stage form held one `file` input and no model field; the pill went Not started → Uploaded
and stayed UPLOADED across a reload with the same record id; stage 2 named that record as its input and
returned the identical bytes; View opened the bytes; Download saved them under the uploaded name; the
hosts contacted were the published site, the Supabase project and the two font hosts, so no loopback
request was made and no page error was raised. The desktop run reported the same, and both runs removed
their row, object and account afterwards.

The earlier ad-hoc script `tmp/run-live-page-check.js` is superseded by the committed script and is kept
only as local history.

