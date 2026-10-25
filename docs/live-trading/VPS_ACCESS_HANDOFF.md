# Reaching the host: access, the first hour, and what is still missing

This is the operator's page for the Contabo host. The migration itself is
[MIGRATION_CUTOVER.md](MIGRATION_CUTOVER.md); the record of what has and has not been proved is
[VPS_DEPLOYMENT_STATUS_20261024.md](VPS_DEPLOYMENT_STATUS_20261024.md) §12. This page answers three questions:
how access is supplied without a secret ever reaching chat or Git, what happens in the first hour after the
provisioning email, and exactly what account 2 is missing.

## 1. Status: bought, not yet delivered

| Fact | Value |
| --- | --- |
| provider and order | Contabo, order 15592634 |
| paid | EUR 17.46, one-month term, no setup fee |
| configuration | Cloud VPS Core 4: 4 vCPU, 8 GB RAM, 100 GB SSD, United Kingdom, Windows Server |
| provisioning | normally 30 minutes, potentially up to three hours |
| host assumed to exist | **no** - not until the provisioning email names it |

Do not start the build on the strength of the order page. The first login is what proves the host, and it also
proves two things the purchase summary does not: the Windows Server version and that the image is **Desktop
Experience** rather than Server Core. Server Core has no desktop, and an MT5 terminal is a desktop program.

## 2. The exact next step when the email arrives

Three moves, and only the third needs anything from you.

**2.1 Read the email, keep the secret in it.** Note the host name or IP address. Do not paste the password into
this conversation, a commit, a log, the migration bundle or a shell one-liner - all five are places it would
outlive the moment.

**2.2 Put the password in the store this repository already uses.** It is a per-user DPAPI-encrypted file
(`%USERPROFILE%\.trading-agent-dashboard\secrets\credentials.clixml`) written by a script that prompts without
echoing:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.trading-agent-dashboard\scripts\set-credential.ps1" -Name VPS_RDP_PASSWORD
```

Type the password at the prompt. Two non-secret values can go in the same store, or simply be told to me in
plain text because they are not secrets:

```powershell
# optional, and safe to say out loud: the address and the account name
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.trading-agent-dashboard\scripts\set-credential.ps1" -Name VPS_HOST
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.trading-agent-dashboard\scripts\set-credential.ps1" -Name VPS_RDP_USER
```

All three names are approved in `config/credential-manifest.json`, so the script will accept them and
`validate-credentials.ps1` will report them as present rather than failing on an unknown name. The three are new
in this session; the manifest is the list that decides which names the store may hold.

The store reads its manifest from the **local home**, which is a copy. If that copy predates this commit, the
prompt answers `Unknown credential name 'VPS_RDP_PASSWORD'` and nothing is stored; refresh it once, from the
repository, and the names arrive:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\create-local-secret-home.ps1 -ForceSync
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.trading-agent-dashboard\scripts\validate-credentials.ps1" -Scope vps-host
```

The validator then lists the three as `missing`, which is the correct state before the email arrives, and it
exits 0 because all three are `conditional` rather than `required`. Verified in this session: the sync copies 12
manifest entries and the updated scope list into the local home, and the scope is then accepted with three
missing.

**2.3 Log in once, and paste one block.** See §3. After that block, the password is not needed again: access is by
key. Say "the block ran" and nothing else - I read the result from the host, not from you.

## 3. The one-time block: run once, in an elevated PowerShell on the host

Open the host over RDP with the password from the email, start PowerShell **as Administrator**, and paste this
whole block. Each part says what it is for.

```powershell
# 1. OpenSSH server, so the build can run from this PC without a password in a command line.
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Set-Service sshd -StartupType Automatic
Start-Service sshd

# 2. The public half of the key pair that lives on the PC. Public keys are safe to paste; the private half never
#    leaves .local\vps-access\id_ed25519.
$key = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJr9y6QMdql8e5RQTAcYS1vfk18nG39Buht8tpHDWP0z trading-agent-vps-access 2026-10-25'
$authz = "$env:ProgramData\ssh\administrators_authorized_keys"
New-Item -ItemType File -Path $authz -Force | Out-Null
Set-Content -Path $authz -Value $key -Encoding ascii
icacls $authz /inheritance:r /grant "Administrators:F" /grant "SYSTEM:F"

# 3. Key-only login for administrators. sshd_config must stay ASCII: a BOM at the top makes sshd ignore the file.
$config = "$env:ProgramData\ssh\sshd_config"
$text = Get-Content $config -Raw
$text = $text -replace '(?m)^#?\s*PubkeyAuthentication.*', 'PubkeyAuthentication yes'
$text = $text -replace '(?m)^#?\s*PasswordAuthentication.*', 'PasswordAuthentication no'
$text = $text -replace '(?m)^#?\s*KbdInteractiveAuthentication.*', 'KbdInteractiveAuthentication no'
[System.IO.File]::WriteAllText($config, $text, (New-Object System.Text.ASCIIEncoding))
Restart-Service sshd

# 4. Narrow both doors to one source address. Replace the address with your current public IP: today it is
#    46.208.115.96, and a domestic address changes. The rule in the Contabo panel can hold the same restriction
#    and is the better place for it, because it cannot be lost with the image.
$from = '46.208.115.96'
New-NetFirewallRule -Name 'TradingAgent-SSH' -DisplayName 'Trading agent SSH (one source)' `
  -Direction Inbound -Protocol TCP -LocalPort 22 -RemoteAddress $from -Action Allow | Out-Null
Set-NetFirewallRule -DisplayName 'Remote Desktop - User Mode (TCP-In)' -RemoteAddress $from
Set-NetFirewallRule -DisplayName 'Remote Desktop - User Mode (UDP-In)' -RemoteAddress $from -ErrorAction SilentlyContinue

# 5. UTC, so a log line and an artifact timestamp need no conversion when they are compared.
Set-TimeZone -Id UTC

# 6. What the host is. This is the reading that proves Windows Server version and Desktop Experience.
Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, OsBuildNumber, WindowsInstallationType
Test-Path "$env:SystemRoot\explorer.exe"
```

Then, from this PC, prove it:

```powershell
ssh -i "D:\trading-agent-dashboard-codex\.local\vps-access\id_ed25519" Administrator@<host> "hostname; Get-Date -Format o"
```

A host name and a UTC timestamp coming back is the proof that the rest of the build can be driven without a
password. If it prompts for a password, the block did not take: the usual causes are a BOM in `sshd_config`, the
ACL on `administrators_authorized_keys`, or the firewall rule's source address.


## 4. Reconnecting from the phone, and keeping the doors narrow

- **Phone:** Microsoft's **Windows App** (formerly Remote Desktop) on iOS or Android, with a saved PC entry for
  the host. It uses the same account and password; it does not use the SSH key. Keep the address and account name
  in the app, and the password in the app's own keychain rather than in a note.
- **The firewall rule is the access control, and it is the thing that breaks when you travel.** A rule limited to
  one source address means a new network, a hotspot or a hotel needs the rule changed first - from the Contabo
  panel, because the host cannot be reached to change it. That is why the panel rule is the one to prefer.
- **Two-factor on the Contabo account** matters more than the host password: the panel can rebuild the machine.
- **Nothing is opened beyond 22 and 3389**, both narrowed to one source. No MT5 bridge port is exposed: the
  terminal and the probe run in the same session on the host, which is the reason the host exists at all.

## 5. Account 2: the checklist, and where each answer comes from

Nothing here is copied from account 1: the login, the server, the ticket history, the state file, the journal and
the heartbeat are account 2's own. What *is* shared on purpose is the strategy and its caps, because it is one
strategy with one set of rules.

| # | Needed | Where it comes from | What it unblocks |
| --- | --- | --- | --- |
| 1 | account 2's **login number** | the FTMO client area | `account_login_masked` in the lanes file |
| 2 | account 2's **server name, exactly as its terminal shows it** - `FTMO-Server` for account 1 is not evidence for account 2 | the FTMO email, or the terminal's login dialog | the probe's identity check |
| 3 | account 2's **type and stage** (Challenge / Verification / Funded) | the FTMO client area | `account_type` / `account_stage`, and which caps apply |
| 4 | confirmation that **automation is permitted** for that account, and any news-trading restriction | the FTMO terms for that account, or support | whether lane 2 may be armed at all |
| 5 | the instruments account 2 actually carries (the plan names EURUSD, XAUUSD, US100.cash, BTCUSD) | that terminal's Market Watch after login | the probe's symbol check |
| 6 | the terminal login, typed by hand on the host | the terminal's own login dialog - never here, never in the DPAPI store, never in the bundle | whether the terminal is signed in at all |
| 7 | confirmation that lane 2 keeps `--max-open 1 --max-per-day 4 --expire-minutes 30 --settle-seconds 90` | you, once; those are the wrapper's values for lane 1 | nothing, but a change is a strategy change and gets written down |

Items 1-3 are the ones only you can supply, and between them they are all that
`config/live-trading-lanes.json` needs: two values and the enable flag. Items 4-6 are answered by the host itself
once the terminal is installed, and the probe reads them back - `prepare-live-trading-host.ps1 -Mode Verify
-ProbeTerminal` fails `lane_ftmo-2_account_identity_configured` and `lane_ftmo-2_symbols_tradable` until each is
true. That is why lane 2 can stay `"enabled": false` until the day it passes, without anyone having to remember
why.

## 6. What I do once the key works, in order

`scripts/prepare-live-trading-host.ps1 -Mode Plan` prints exactly this list, with the command for each step; the
list is data in the script rather than prose, so the two cannot drift. In short:

1. prove the host: `Get-ComputerInfo`, `explorer.exe` present, UTC;
2. runtime: Node 22, Git, Python 3.13, `pip install MetaTrader5==5.0.6231` (the PC's versions);
3. two checkouts at **one pinned commit** - `C:\live-trading\runtime` for execution, `C:\live-trading\publisher`
   for publishing (`5a73c295` is the commit to pin as of 2026-10-25T22:08Z; re-read it at cutover rather than
   trusting this line) - and **no scheduled task that pulls or reinstalls** anything, so nothing updates itself
   while you are away;
4. one MT5 terminal per lane at the path the lanes file names, each logged in by hand;
5. tasks registered unarmed, in order: lane feed, trader without `--confirm-live`, publisher **last**;
6. `-Mode Verify -ProbeTerminal -PinnedCommit <commit>` until every blocking check is `ok`;
7. the cutover in [MIGRATION_CUTOVER.md](MIGRATION_CUTOVER.md), stopping the PC before starting the host and
   arming only the host.

Why two checkouts rather than one: the publisher commits and pushes `data/`, and a checkout that is also the
thing a trading loop is running out of is a tree where a publish can move the code under the loop. The verify
script fails if the two roots are the same tree or nested in each other.

## 7. Monitoring: what exists now, and what it watches

`node scripts/check-live-trading-publication.js` asks the **published URLs** - not the host - three questions per
enabled lane: is the served snapshot the account the lanes document says, is it fresh against the window it
declares, and is a trader beating behind it (how old, armed or not). Exit 0 fresh, 1 stale, 2 unreadable lanes
document.

That script is now also run by `.github/workflows/live-trading-monitor.yml`, every 15 minutes, in GitHub's cloud -
so a feed that stops, a trader that dies and a publisher that stalls are noticed even with the PC off and the host
unreachable. A failed run is visible in the Actions list, and GitHub's default notifications email the repository
owner for a failed scheduled workflow. What it cannot see: whether the *terminal* is still logged in on the host
when nothing is being published at all (that shows up as staleness, which is the point), and anything about the
VPS itself, which has no agent on it by design.


## 8. Stopping in a hurry, and getting back

**Pause new entries without taking the lane down.** Disabling the trader task stops new entries and leaves the
terminal, the feed and the publisher running, so the page keeps telling the truth while nothing new is placed:

```powershell
Disable-ScheduledTask -TaskName LiveTradingTraderTick019      # lane 1
Disable-ScheduledTask -TaskName LiveTradingTraderTick-ftmo2   # lane 2, when it exists
Get-ScheduledTaskInfo -TaskName LiveTradingTraderTick019 | Select-Object LastRunTime, LastTaskResult
```

That is a pause, not a close: open positions and working orders stay, which is the point - a stop that closed
them would be a trading decision taken by an outage. Closing is deliberate and separate, through
`tools/mt5-bridge/live-trading-order.py` with `--confirm-live` or in the terminal by hand. Re-enabling is the same
command with `Enable-ScheduledTask`, and nothing about it re-arms anything else.

**Emergency access.** In this order, because each step is wider than the one before: the FTMO client area (reset
the trading password, which does not touch the terminal's open positions); the MT5 terminal over RDP (close or
flatten by hand); the Contabo panel (power-cycle or reinstall the machine); and only then the local DPAPI store.
The broker is the authority on the account; a host that cannot be reached is a host problem, never an account
problem, and the FTMO client area does not need the host.

**Rollback to the PC.** [MIGRATION_CUTOVER.md](MIGRATION_CUTOVER.md) carries the reverse sequence, and the two
rules that make it safe rather than hopeful: the host's trader is disabled and its publisher unregistered *before*
the PC's trader is registered again, and the PC is armed only after its own `-Mode Verify` run is green on its own
paths. The bundle that would be restored verifies byte for byte; the full stop-restore-arm cycle has not been
rehearsed, because a rehearsal needs the second host it protects - so treat the first rollback as an unproven
procedure performed carefully, not as a tested one.

