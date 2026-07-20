# Credential Continuity

## Purpose

Credential continuity keeps the repository usable across future Codex sessions without committing private credentials to Git.

This repository now standardizes on the existing local CLIXML credential system under:

```text
%USERPROFILE%\.trading-agent-dashboard\
```

The checked-in repository files describe the inventory and bootstrap the local home. The live credential values remain local-only.

Bootstrap is non-destructive by default:

- existing local credential values are preserved
- existing local scripts and manifests are preserved unless an explicit force sync is requested
- an empty CLIXML store is created only when the store is missing

## Stored Variables

The local credential system manages only continuity-relevant variables:

- `N8N_BASE_URL`
- `N8N_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FRED_API_KEY`
- `RAPIDAPI_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `OANDA_API_TOKEN`
- `OANDA_ACCOUNT_ID`

Ordinary importer settings such as dates, filenames, symbols, presets, delimiters, and time zones must stay outside the credential store.

## Local Store Format

The active local store is:

```text
%USERPROFILE%\.trading-agent-dashboard\secrets\credentials.clixml
```

It is a PowerShell CLIXML document with this structure:

- root object: `version`, `updatedAt`, `variables`
- `variables` is a list of entries
- each entry stores:
  - `name`
  - `value` as a `SecureString`
  - `updatedAt`

Backups are timestamped CLIXML copies under:

```text
%USERPROFILE%\.trading-agent-dashboard\secrets\history-backups\
```

Migration notes remain in:

```text
%USERPROFILE%\.trading-agent-dashboard\secrets\migration-audit.json
```

## Scopes

The local validator and child runner support these scopes:

- `n8n`
- `backtester`
- `market-importers`
- `all`

Availability policy:

- `required` must be present for successful validation
- `optional` may be absent
- `conditional` may be absent until the specific feature path needs it

Current classifications:

- `N8N_BASE_URL`: required
- `N8N_API_KEY`: required
- `SUPABASE_URL`: required
- `SUPABASE_SERVICE_ROLE_KEY`: required
- `FRED_API_KEY`: required
- `RAPIDAPI_KEY`: required
- `ALPHA_VANTAGE_API_KEY`: optional
- `OANDA_API_TOKEN`: required
- `OANDA_ACCOUNT_ID`: conditional

## Local Scripts

Canonical local scripts live in `%USERPROFILE%\.trading-agent-dashboard\scripts\`:

- `credential-common.ps1`
- `set-credential.ps1`
- `validate-credentials.ps1`
- `load-credentials.ps1`
- `run-with-credentials.ps1`
- `backup-credentials.ps1`
- `restore-credentials.ps1`

Repository bootstrap syncs those files from `scripts/local-credentials/`.

If a deliberate template refresh is required later, use:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\create-local-secret-home.ps1 -ForceSync
```

## Repository Helpers

Use the repository-safe wrappers:

- `scripts/bootstrap-local-secrets.ps1`
- `scripts/check-required-secrets.ps1`
- `scripts/check-repo-for-secrets.ps1`

Typical workflow:

1. Sync the local credential home
2. Validate required names
3. Run child commands through the CLIXML runner

Examples:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\bootstrap-local-secrets.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check-required-secrets.ps1 -Scope all
```

```powershell
powershell -File $env:USERPROFILE\.trading-agent-dashboard\scripts\run-with-credentials.ps1 -Scope n8n -Command node -Arguments -e "console.log('ok')"
```

## Design Rules

- Never print credential values.
- Never persist credentials to machine-level or user-level environment variables.
- Load credentials only into the current process and restore previous values after child execution.
- Preserve `credentials.clixml`, `migration-audit.json`, `clean-child.stdout.log`, `clean-child.stderr.log`, and `history-backups\`.
- Do not assume any SecretStore vault is present or required.

## Deferred Security Debt

Legacy tracked workflow exports and documentation examples may still contain deferred secret-cleanup issues. Those are separate from continuity functionality and should not block the CLIXML continuity system from working.
