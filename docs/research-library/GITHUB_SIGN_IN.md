# Sign in with GitHub

The owner signs in to the research library with GitHub. That choice does not move the documents, the
member list or the private storage: the same Supabase project (`eaolqbrlywczinfordvg`) keeps the rows,
the private `research-documents` bucket, the append-only rule, the version sequence and the parent
links. Only the way a session is obtained changes.

## What is already in the page

- The library header draws **Sign in with GitHub** first, and keeps the account email and password
  underneath as the fallback sign-in.
- The button sends the browser to the project's own OAuth endpoint
  (`{project}/auth/v1/authorize?provider=github&redirect_to=<this page>`). The page learns only the
  session Supabase issues when GitHub sends the reader back; it never sees a GitHub client secret, a
  Supabase service key or an access token for the GitHub API.
- A return that GitHub or Supabase refused is shown in plain words in the account block, and the
  address bar loses the error fragment, so a second try starts clean.
- The page carries only the publishable key it already carried. No secret is added to the repository,
  to `script.js` or to the bucket.

## The two one-time steps that need the owner

Both are on the owner's own accounts, so they cannot be done from this repository.

1. **Create the GitHub OAuth app** at <https://github.com/settings/applications/new> while signed in
   as `kevincreedycars-debug`:

   | Field | Value |
   | --- | --- |
   | Application name | `Trading Agent Dashboard research library` |
   | Homepage URL | `https://kevincreedycars-debug.github.io/trading-agent-dashboard/` |
   | Authorization callback URL | `https://eaolqbrlywczinfordvg.supabase.co/auth/v1/callback` |

   Register the application, then press **Generate a new client secret**. The client ID is public; the
   client secret is not, and it must never be pasted into the repository, the page or a chat message.

2. **Turn the provider on in Supabase** — Authentication → Providers → GitHub → enable it and paste
   the client ID and the client secret, then Save. Nothing else in the project changes: email sign-in,
   the member list, the policies, the bucket and the append-only rule all stay as they are.
   Alternatively, put a Supabase personal access token in the local credential store
   (`...\.trading-agent-dashboard\scripts\set-credential.ps1`) and the provider is switched on with the
   Management API instead of the dashboard.

Until step 2 is done, the page itself reports "GitHub sign-in is not turned on for this library yet" and
the email and password sign-in keeps working exactly as before. `signInWithGitHub()` asks the project's
public `/auth/v1/settings` first, so a reader is never parked on the raw error document the authorize
endpoint returns for a disabled provider. Pressed on the live page on 2026-10-25, the account block drew
**Sign in with GitHub** first and the press drew that sentence in the block, with no session invented and
no page error.

## The first GitHub sign-in and the ownership of record

The project already holds one account, `4c7abd3d-e6a0-4d9d-b6cb-4d289d8a0063`
(`research-library@example.com`), one member row for it, and one document: the VIX report
(`usd-factor-live-f1-vix-level`, stage 1, version 1, `VIX_USD_Research_Report.md`). Its email and
password are left exactly as they are.

A GitHub sign-in arrives as a new Supabase user, because a GitHub identity is not the same identity as
an email and password. After the first GitHub sign-in, the owner's GitHub user id is added to
`public.research_members` and the rows it owns are re-pointed at it, which keeps the single VIX
document, its version and its parent links in place:

```sql
-- The one account that signed in with GitHub joins the member list. No other account is added, and no
-- GitHub user is granted anything by default.
insert into public.research_members (user_id, note)
values ('<github-user-id>', 'GitHub sign-in, owner')
on conflict (user_id) do nothing;

-- Ownership of record moves to that account; the rows themselves, their versions and their parents
-- are not touched, and nothing is deleted.
update public.research_documents set uploaded_by = '<github-user-id>'
where uploaded_by = '4c7abd3d-e6a0-4d9d-b6cb-4d289d8a0063';
```

The placeholder account and its member row stay as a fallback; nothing is revoked from it, so the VIX
report stays readable even if GitHub sign-in is ever turned off again. `public.research_members` is the
whole access rule: an account that signs in with GitHub and is not on it is refused every row and every
object, which is what keeps other GitHub users out.

`node tmp/store-state.js` (service role, read-only, local and uncommitted) prints the member list, the
document rows and the sign-in identities, so the state before and after the transfer can be compared.

## Check it on a phone

1. Open `https://kevincreedycars-debug.github.io/trading-agent-dashboard/`, Research library tab.
2. **Sign in with GitHub**, approve once; the page comes back signed in.
3. Download the VIX report, upload a red-team return for the same chain, then refresh the page and open
   the new stage from the top of the chain. The stage pill stays `Uploaded` and the record id is the
   same after the refresh.

`npm run research-library:page-check:mobile -- --provision` drives the same path automatically with a
throwaway member created and removed by the run, which proves the hosted-only upload with the local
service stopped. It uses the email and password route, because a GitHub approval cannot be automated.
