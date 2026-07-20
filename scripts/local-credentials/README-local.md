# Trading Agent Dashboard Local Credential Continuity

This folder is local-only and must stay outside the repository.

Primary store:
- `secrets\credentials.clixml`
- PowerShell CLIXML containing `SecureString` values
- protected by the current Windows user context

History:
- `secrets\history-backups\`
- timestamped backup copies of the active CLIXML store

Core commands:

1. Sync the local home from the repository
   - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\bootstrap-local-secrets.ps1`
   - preserves the active CLIXML store and existing local files by default
   - use `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\create-local-secret-home.ps1 -ForceSync` only for a deliberate template refresh
2. Store or update one credential
   - `powershell -File scripts\set-credential.ps1 -Name SUPABASE_SERVICE_ROLE_KEY`
3. Validate required entries
   - `powershell -File scripts\validate-credentials.ps1 -Scope all`
4. Run a child command with temporary process-level credentials
   - `powershell -File scripts\run-with-credentials.ps1 -Scope n8n -Command node -Arguments -e "console.log('ok')"`
5. Create a timestamped backup copy
   - `powershell -File scripts\backup-credentials.ps1`

Do not place plaintext credentials in this folder.
