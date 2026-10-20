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

`supabase/research-uploads.sql` is the whole one-time script. It refuses to run if it finds a conflicting table, view, function, policy, membership table or public bucket. RLS on `storage.objects` is already enabled by the platform, so the script does not alter that table.

## Sign in

The library header carries an account block. A reader signs in once in the browser with the owner account's email and password, or asks for an email link; the session token is kept in that browser only, and signing out drops the hosted rows from the page without touching the committed registry or the local service's records.

The owner account is `research-library@example.com`, created by the project administrator with a confirmed email address so that no inbox is needed to sign in. Its password is held by the owner and is not in this repository. To replace the address or the password, use the Supabase dashboard (Authentication → Users) or create a new account and add it to `public.research_members`.

To add another permitted account, insert its user id:

```sql
insert into public.research_members (user_id, note) values ('<uuid>', 'who this is');
```

## What the page does

- Factor-chain stages 1 to 3 upload straight to the store when a session exists. The chain id owns the version sequence, so two chains under one display topic never share a version number.
- Stage 2 records the research row it follows and stage 3 records the research and red-team rows; a parent already registered in the catalogue is named by its catalogue document id, and a parent stored here is named by its row id.
- The card shows the registered file name, version, hash, size, date and the private-store note. View downloads the bytes, checks them against the recorded hash and opens them; Download saves them under the uploaded file name.
- The final chain still needs the local library service: its return records the exact factor input package, which the hosted table does not hold.
- Refusals appear inside the upload form, with the chosen file and typed details left in place. Nothing is called registered until the store has answered with the stored row, and no refusal writes anything.

## Messages a reader may see

- “Sign in with your email and password…” means no session exists in this browser.
- “The upload service could not be reached…” means the browser could not contact Supabase. Check the connection and retry.
- “These exact file contents are already stored…” means the SHA-256 rule found the same bytes for that chain and stage. Open the existing version instead.
- “The file could not be stored…” means no object was committed; nothing was recorded.
- “The file is stored, but its library record could not be saved…” means the bytes reached private storage but the row did not; retry registration reuses the same path and does not upload the object again.
- “A private download link could not be created…” means the session expired or access was refused. Sign in again.
- “That email address and password were not accepted…” means the credentials are wrong; nothing is stored.

## Verify the provisioning

```powershell
node scripts/verify-research-upload.js
```

All five lines must say `PASS`: bucket exists, bucket is private, table exists, anonymous insert is refused, anonymous read is refused. The check reads the publishable key already present in `script.js`; it never uses a service key.

