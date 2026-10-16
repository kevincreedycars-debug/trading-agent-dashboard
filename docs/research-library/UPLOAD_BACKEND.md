# Research upload backend

This adds a private place for signed-in dashboard users to keep returned research documents. The browser uploads the original bytes, records their SHA-256 fingerprint, and later asks Supabase for a short-lived download link. Uploading research is still evidence, not approval.

## Provision it once

1. Create the place for files. In a PowerShell session that has the project's service key, run:

   ```powershell
   $env:SUPABASE_SERVICE_KEY = Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText
   node scripts/research-upload-provision.js
   Remove-Item Env:SUPABASE_SERVICE_KEY
   ```

   The helper creates `research-documents` when it is missing, refuses a public bucket, and never prints the key. If local PowerShell policy does not permit the secure prompt pipeline, set the environment variable by another non-logging method; never put it in a command file or repository file.

2. Open the Supabase SQL editor for project `eaolqbrlywczinfordvg`, paste the whole file printed by the helper (`supabase/research-uploads.sql`), and run it once. The transaction creates the table, view, policies, and metadata-only verification function. Its opening guard stops the entire transaction if it finds a conflicting table, view, function, policy, or public bucket.

3. Confirm the setup from this checkout:

   ```powershell
   node scripts/verify-research-upload.js
   ```

   All five lines must say `PASS`: bucket exists, bucket is private, table exists, anonymous insert is refused, and anonymous read is refused. This check reads the publishable key already present in `script.js`; it does not use a service key.

4. On the dashboard, enter the permitted user's email, open the confirmation/sign-in link in the same browser, and sign in once. Email confirmation is required, so uploads remain unavailable until that link has been opened.

## Two dashboard hooks for the UI session

These are the two integration points on `origin/main`; the UI session should apply them while it owns `index.html` and `script.js`.

First, load the upload helper next to the existing library helper. The current surrounding lines are:

```html
  <script src="lib/l2l_strategy.js?v=20261005-l2l-trade-level"></script>
  <script src="lib/research_library.js?v=20261013-research-library-v1"></script>
  <script src="lib/live_trading_close_request.js?v=20261016-live-trading-close-request"></script>
```

Add exactly this line immediately after `research_library.js`:

```html
  <script src="lib/research_upload_client.js?v=20261016-research-upload-v1"></script>
```

Second, route the existing upload button to the Supabase adapter. The current `origin/main:script.js` call site is:

```js
    const uploadSubmit = target.closest("[data-rl-upload-submit]");
    if (uploadSubmit) {
      researchLibraryUpload(uploadSubmit.dataset.rlUploadSubmit);
      return;
    }
```

After adding an adapter that converts the selected task into `topicId`, numbered `stage`, `title`, `kind`, `file`, and `parents`, replace the one call with:

```js
      researchLibraryUploadToSupabase(uploadSubmit.dataset.rlUploadSubmit);
```

The adapter should configure `window.ResearchUpload` with the existing `researchSupabaseUrl` (with `/rest/v1` removed) and existing `researchSupabaseKey`; it must not add another key. It should display each returned `message`, preserve the returned `retry` action when registration fails after storage succeeds, use `rowsToDocuments(rows)` before passing results to the existing library renderer, and use `signedUrl(row, seconds)` for both View and Download.

## Messages a user may see

- “Sign in with your email link…” means no authenticated session is available in this browser. Request a link and open it in the same browser.
- “The upload service could not be reached…” means the browser could not contact Supabase. Check the connection and retry.
- “These exact file contents are already stored…” means the SHA-256 uniqueness rule found the same bytes for that topic and stage. Open the existing version instead.
- “The file could not be stored…” means no object was committed. Retry the ordinary upload after checking the connection.
- “The file is stored, but its library record could not be saved…” means the bytes reached private storage but the table row did not. Use the offered retry; it reuses the same path and does not upload the object again.
- “A private download link could not be created…” means the session expired or access was refused. Sign in again; if it continues, ask the owner to inspect the policies.
- “This document has no file location…” means its database row is incomplete and needs owner attention.

## Security rules

The `research-documents` bucket is private. The page contains only the project's existing publishable key and never a service key. Only authenticated users may list or insert document rows, upload objects, read objects, or create expiring signed download links. Ordinary users have no update or delete policy, so committed versions are append-only. Unique constraints prevent a repeated version number and prevent the same bytes from being registered twice for one topic stage. Anonymous users cannot read or write documents or objects, and nothing in the bucket has a public URL. The anonymous metadata check reports only whether provisioning exists and is private; it exposes no rows, paths, identities, or contents.
