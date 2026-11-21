# Credential exposure check — 2026-11-21

**Question.** The completion report said the webhook credential was briefly written under `scripts/` and then
deleted. Did that file enter git history or any shared artefact, and does the credential need rotating?

**Verdict: no exposure found, and no rotation is required on this evidence.** The file was never committed,
never pushed, and no object in the repository database contains the secret value. The check is reproducible
with the commands below; none of them print a secret.

## What was checked

| Check | Command (abbreviated) | Result |
| --- | --- | --- |
| Any ref that ever added a CLIXML file or `scripts/secrets/*` | `git log --all --diff-filter=A --name-only -- '*clixml*' 'scripts/secrets/*'` | no output |
| Any path in the object database matching `clixml` or `secrets/` | `git rev-list --all --objects \| Select-String 'clixml\|secrets/'` | no output |
| All 677 refs (local, remote, tags) after `git fetch --all --prune` | `git for-each-ref` + the two checks above | no ref carries the path |
| Unreachable objects that contain the credential literal | `git fsck --unreachable` then `git cat-file -p` each object | 0 of 245 commits, 158 blobs, 288 trees |
| Unreachable objects that are a CLIXML document | same scan for the `<Objs Version=` root element | 0 blobs |
| The credential literal in the working tree | targeted search of `scripts/`, `docs/`, `data/`, `tools/` | one hit: the credential **id** in the completion checklist, which is an n8n identifier, not the secret |
| A CLIXML file anywhere in the working tree | `Get-ChildItem -Recurse -Force -Filter '*clixml*'` | none |

The encrypted store lives outside the repository at `~/.trading-agent-dashboard/secrets/credentials.clixml`,
and `scripts/secrets/` plus `**/credentials-*.clixml` are ignored. The backup that was briefly written under
`scripts/` was deleted before any `git add` or commit, which is why it leaves no trace in the object database.

## Why deleting the file is not the whole answer

Deleting a file removes it from the working tree, not from history or from any copy that was pushed. That is
why the check above scans refs, the object database and unreachable objects rather than the directory listing.
The evidence says there is nothing to rotate: the secret value itself never reached a git object, so no clone,
fork or PR can carry it. The API key and the webhook token are still valid and were used for the controlled
runs recorded in this lane.

## Standing safeguards

- `scripts/secrets/` and `**/credentials-*.clixml` are in `.gitignore`; the credential id may be committed, the
  value may not.
- The sweep and the verification script read secrets through `scripts/local-credentials/get-secret.ps1`, which
  resolves the encrypted store outside the repository and never prints the value.
- The dashboard shows the credential id and the header name, never the value.
- `scripts/check-repo-for-secrets.ps1` remains the repository-wide scanner; the checks above are the
  history-specific companion to it.

## If the verdict were different

A positive finding would require, in order: revoke the token in n8n, mint a replacement, update the encrypted
store, re-run one authenticated execution, and only then rewrite history and force-push with the owner's
agreement. None of those steps were needed here, and none were taken.
