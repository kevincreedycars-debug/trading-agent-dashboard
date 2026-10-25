<#
.SYNOPSIS
  Plans the host build, then verifies the host actually carries it - without changing anything.

.DESCRIPTION
  The migration itself is written down (docs/live-trading/MIGRATION_CUTOVER.md), but a runbook is what a
  person reads; it is not what tells the operator, after the fact, that the second lane's lock file points at
  the first lane's, that the trader task is registered to run only when somebody is logged on, or that the
  heartbeat the publisher just carried to the page was copied from the old PC and never written on the host.

  -Mode Plan prints the ordered build steps, one line each, with the command and the fact it proves. It runs
  anywhere, needs no host and touches nothing.

  -Mode Verify reads the host and answers with a check per claim, each `blocking` or `advisory`. A blocking
  check that fails exits 1; that is the gate before arming. Nothing in this file registers a task, writes a
  wrapper, copies state or starts a process: it reads the registry, the scheduler, the two checkouts, the
  lanes file, the wrapper each lane already has, and - only with -ProbeTerminal - one terminal per lane
  through tools/mt5-bridge/live-trading-account-probe.py, which is itself read-only.

  What it refuses to take on trust:
    - Desktop Experience, because Server Core cannot run an MT5 terminal;
    - an execution checkout and a publisher checkout that are the same tree or nested in each other, because
      the point of two checkouts is that publishing cannot rewrite what is trading;
    - a checkout that is not exactly on the pinned commit, or that is dirty, because "no automatic code
      updates during my absence" is only true if the tree is pinned and nothing pulls;
    - two lanes sharing a state, log, lock, journal, terminal or published artifact path;
    - a heartbeat whose `host.computer` is not this computer - a copied heartbeat is history, not health;
    - lane account identity (login, server) that does not match the terminal's own reading;
    - lane 2 having no account identity at all, while it is enabled.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-live-trading-host.ps1 -Mode Plan

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-live-trading-host.ps1 -Mode Verify `
    -RuntimeRoot C:\live-trading\runtime -PublisherRoot C:\live-trading\publisher `
    -PinnedCommit 4a88076e -ProbeTerminal -Out .local\host-verify.json
#>
param(
  [ValidateSet("Plan", "Verify")]
  [string] $Mode = "Plan",
  [string] $RuntimeRoot = "C:\live-trading\runtime",
  [string] $PublisherRoot = "C:\live-trading\publisher",
  [string] $PinnedCommit = "",
  [switch] $ProbeTerminal,
  [string] $Python = "",
  [string[]] $IgnoreCheck = @(),
  [string] $Out
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $PSScriptRoot

function Resolve-Root([string] $path) {
  $candidate = $path
  if (-not [System.IO.Path]::IsPathRooted($candidate)) {
    $candidate = Join-Path $scriptRoot $candidate
  }
  return [System.IO.Path]::GetFullPath($candidate).TrimEnd('\\')
}

$runtimeRoot = Resolve-Root $RuntimeRoot
$publisherRoot = Resolve-Root $PublisherRoot

function Read-JsonFile($path) {
  if (-not $path -or -not (Test-Path -LiteralPath $path)) { return $null }
  try { return (Get-Content -LiteralPath $path -Raw | ConvertFrom-Json) } catch { return $null }
}

# One flag out of a command line, with quotes stripped. Absent stays absent: the wrapper is the only thing
# that says where a lane keeps its lock, so a default invented here would hide a lane with no lock flag.
function Get-FlagValue($text, $name) {
  $match = [regex]::Match([string]$text, "--$([regex]::Escape($name))\s+(?:`"([^`"]*)`"|(\S+))")
  if (-not $match.Success) { return $null }
  if ($match.Groups[1].Success) { return $match.Groups[1].Value }
  return $match.Groups[2].Value
}

function Test-NestedPath([string] $parent, [string] $child) {
  if (-not $parent -or -not $child) { return $false }
  $p = $parent.TrimEnd('\\') + '\\'
  $c = $child.TrimEnd('\\') + '\\'
  return $c.StartsWith($p, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-Git($root, [string[]] $arguments) {
  if (-not $root -or -not (Test-Path -LiteralPath $root)) { return $null }
  $output = & git -C $root @arguments 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  return ([string]($output -join "`n")).Trim()
}

$checks = New-Object System.Collections.ArrayList
function Add-Check([string] $id, [bool] $ok, [string] $severity, [string] $detail) {
  [void]$checks.Add([ordered]@{ id = $id; ok = $ok; severity = $severity; detail = $detail })
}

# The build order, as data, so the same list is printed here, quoted in the handoff doc and asserted in the
# test suite. Each step names the command and the check it turns green.
$steps = @(
  [ordered]@{ n = 1; action = "Confirm provisioning is finished; record the host name only"; command = "the provider's provisioning email (order 15592634)"; proves = "the host exists" },
  [ordered]@{ n = 2; action = "First RDP login, then run the one-time access block"; command = "docs/live-trading/VPS_ACCESS_HANDOFF.md section 3"; proves = "OpenSSH server, key-only login, RDP and SSH limited to one source address" },
  [ordered]@{ n = 3; action = "Prove key-only access from the PC; the password is never sent anywhere"; command = "ssh -i .local\vps-access\id_ed25519 Administrator@<host> hostname"; proves = "automation without a password in a command line" },
  [ordered]@{ n = 4; action = "Set the host clock to UTC and enable auto-logon for the trading account"; command = "Set-TimeZone -Id UTC; AutoAdminLogon=1 (password typed at the host's own console)"; proves = "the loop's UTC timestamps, and a terminal that starts after a reboot with nobody logged in" },
  [ordered]@{ n = 5; action = "Install Node 22, Git and Python 3.13, then MetaTrader5 5.0.6231"; command = "winget install --id OpenJS.NodeJS.LTS --exact; winget install --id Git.Git --exact; winget install --id Python.Python.3.13 --exact; python -m pip install MetaTrader5==5.0.6231"; proves = "the runtime the PC proved, at the package version the PC proved it with" },
  [ordered]@{ n = 6; action = "Clone two checkouts at one pinned commit: runtime for execution, publisher for publishing"; command = "git clone <repo> runtime; git -C runtime checkout <commit>; git clone <repo> publisher; git -C publisher checkout <commit>"; proves = "execution separate from publishing, and nothing that pulls on its own" },
  [ordered]@{ n = 7; action = "Install one MT5 terminal per lane, at the path the lanes file names, and log each in by hand"; command = "the FTMO installer, twice, into each lane's terminal path"; proves = "the terminal a lane's wrapper names is the account that lane is for" },
  [ordered]@{ n = 8; action = "Register the tasks unarmed, in this order: lane feed, trader without --confirm-live, publisher last"; command = "-File scripts/register-live-trading-*-task.ps1 -Test, then again without -Test"; proves = "nothing can place before the host has been read back and armed on purpose" },
  [ordered]@{ n = 9; action = "Run this script in Verify mode, with the terminal probe"; command = "-File scripts/prepare-live-trading-host.ps1 -Mode Verify -ProbeTerminal -PinnedCommit <commit>"; proves = "isolation, pinning, identity, freshness and reboot settings, one check at a time" },
  [ordered]@{ n = 10; action = "Cut the lane over: stop the PC, bundle, reconcile, restore, compare, then arm the host only"; command = "docs/live-trading/MIGRATION_CUTOVER.md steps 1-10"; proves = "one host owns the account, and publishing moves after arming" }
)

if ($Mode -eq "Plan") {
  Write-Output "mode           = plan (this run changes nothing)"
  Write-Output "runtime_root   = $runtimeRoot"
  Write-Output "publisher_root = $publisherRoot"
  Write-Output "pinned_commit  = $(if ($PinnedCommit) { $PinnedCommit } else { '<not set>' })"
  Write-Output ""
  foreach ($step in $steps) {
    Write-Output ("{0,2}. {1}" -f $step.n, $step.action)
    Write-Output ("    $ {0}" -f $step.command)
    Write-Output ("    proves: {0}" -f $step.proves)
  }
  $planDocument = [ordered]@{
    schema_version   = "live-trading-host-prepare-v1"
    generated_at_utc = (Get-Date).ToUniversalTime().ToString("o")
    mode             = "Plan"
    host             = [ordered]@{ computer = $env:COMPUTERNAME; user = $env:USERNAME; platform = "win32" }
    paths            = [ordered]@{ runtime_root = $runtimeRoot; publisher_root = $publisherRoot; pinned_commit = $PinnedCommit }
    steps            = $steps
    checks           = @()
    result           = "planned"
  }
  if ($Out) {
    $planOutPath = if ([System.IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $scriptRoot $Out }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $planOutPath) | Out-Null
    [System.IO.File]::WriteAllText($planOutPath, (($planDocument | ConvertTo-Json -Depth 8) + "`n"), (New-Object System.Text.UTF8Encoding($false)))
  }
  exit 0
}


# ---------------------------------------------------------------- the host's own facts

$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
$currentVersion = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion" -ErrorAction SilentlyContinue
$installationType = [string]$currentVersion.InstallationType
$explorerPresent = Test-Path -LiteralPath (Join-Path $env:SystemRoot "explorer.exe")
# Server Core ships no shell at all, and an MT5 terminal is a GUI program: the installation type is the
# vendor's own label and explorer.exe is the thing the label is about, so both are read and both must agree.
$desktopExperience = ($installationType -notmatch "Core") -and $explorerPresent
$buildNumber = if ($currentVersion.CurrentBuild) { [int]$currentVersion.CurrentBuild } elseif ($os) { [int]$os.BuildNumber } else { 0 }

$timeZone = try { (Get-TimeZone).Id } catch { $null }

$winlogon = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" -ErrorAction SilentlyContinue
$autoLogonOn = [string]$winlogon.AutoAdminLogon -eq "1"
$autoLogonUser = [string]$winlogon.DefaultUserName
# Never the value: whether a password is stored is the fact that matters, and printing it would put it in a
# document that gets committed.
$autoLogonPasswordStored = -not [string]::IsNullOrEmpty([string]$winlogon.DefaultPassword)

$rdp = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server" -ErrorAction SilentlyContinue
$rdpTcp = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" -ErrorAction SilentlyContinue
$rdpEnabled = $null -ne $rdp -and [int]$rdp.fDenyTSConnections -eq 0
$rdpNla = $rdpTcp -and [int]$rdpTcp.UserAuthentication -eq 1

$sshd = Get-Service -Name sshd -ErrorAction SilentlyContinue

$runtimeVersions = [ordered]@{ node = $null; node_path = $null; git = $null; python = $null; python_path = $null; metatrader5 = $null }
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
  $runtimeVersions.node = ([string](& node --version 2>$null)).Trim()
  $runtimeVersions.node_path = [string]$nodeCommand.Source
}
$gitCommand = Get-Command git -ErrorAction SilentlyContinue
if ($gitCommand) { $runtimeVersions.git = ([string](& git --version 2>$null)).Trim() }
$pythonPath = $Python
if (-not $pythonPath) {
  $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
  if ($pythonCommand) { $pythonPath = [string]$pythonCommand.Source }
}
if ($pythonPath -and (Test-Path -LiteralPath $pythonPath)) {
  $runtimeVersions.python = ([string](& $pythonPath -c "import sys; print('.'.join(str(part) for part in sys.version_info[:3]))" 2>$null)).Trim()
  $runtimeVersions.python_path = $pythonPath
  $runtimeVersions.metatrader5 = ([string](& $pythonPath -c "import MetaTrader5 as m; print(m.__version__)" 2>$null)).Trim()
  if (-not $runtimeVersions.python) { $runtimeVersions.python_path = $pythonPath }
}

$lanesPath = Join-Path $publisherRoot "config\live-trading-lanes.json"
$lanesDocument = Read-JsonFile $lanesPath
$laneRows = if ($lanesDocument -and $lanesDocument.lanes) { @($lanesDocument.lanes) } else { @() }

# The scheduled tasks this lane knows about, read from the scheduler rather than from the lanes file: a name
# in a file is an intention, a registered task is a fact.
$taskNames = New-Object System.Collections.ArrayList
foreach ($row in $laneRows) {
  if ($row.tasks) {
    foreach ($key in @("lane", "trader", "startup")) {
      $name = [string]$row.tasks.$key
      if ($name -and -not $taskNames.Contains($name)) { [void]$taskNames.Add($name) }
    }
  }
}
foreach ($globalName in @("LiveTradingFeedTick019", "LiveTradingPublishLanes019")) {
  if (-not $taskNames.Contains($globalName)) { [void]$taskNames.Add($globalName) }
}

$taskFacts = @()
foreach ($name in $taskNames) {
  $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  $info = if ($task) { Get-ScheduledTaskInfo -TaskName $name -ErrorAction SilentlyContinue } else { $null }
  $action = if ($task) { @($task.Actions)[0] } else { $null }
  $trigger = if ($task) { @($task.Triggers)[0] } else { $null }
  $principal = if ($task) { $task.Principal } else { $null }
  $taskFacts += [ordered]@{
    name                  = $name
    present               = [bool]$task
    state                 = if ($task) { [string]$task.State } else { $null }
    execute               = if ($action) { [string]$action.Execute } else { $null }
    arguments             = if ($action) { [string]$action.Arguments } else { $null }
    trigger               = if ($trigger) { $trigger.CimClass.CimClassName } else { $null }
    start_when_available  = if ($task) { [bool]$task.Settings.StartWhenAvailable } else { $null }
    multiple_instances    = if ($task) { [string]$task.Settings.MultipleInstances } else { $null }
    logon_type            = if ($principal) { [string]$principal.LogonType } else { $null }
    run_level             = if ($principal) { [string]$principal.RunLevel } else { $null }
    last_run              = if ($info -and $info.LastRunTime -gt [datetime]::MinValue) { $info.LastRunTime.ToUniversalTime().ToString("o") } else { $null }
    last_result           = if ($info) { $info.LastTaskResult } else { $null }
  }
}


# ---------------------------------------------------------------- per lane: paths, wrapper, heartbeat

$now = (Get-Date).ToUniversalTime()
$laneFacts = @()
foreach ($row in $laneRows) {
  $laneRoot = $row.root
  if (-not $laneRoot) { $laneRoot = "." }
  if (-not [System.IO.Path]::IsPathRooted([string]$laneRoot)) {
    $laneRoot = [System.IO.Path]::GetFullPath((Join-Path $publisherRoot ([string]$laneRoot)))
  }
  $laneRoot = ([string]$laneRoot).TrimEnd('\\')
  $enabled = -not ($row.enabled -eq $false)
  $wrapperPath = Join-Path $laneRoot "tmp\live-trading-trader-run.cmd"
  $wrapperText = if (Test-Path -LiteralPath $wrapperPath) { Get-Content -LiteralPath $wrapperPath -Raw } else { "" }
  # The checkout is the wrapper's `cd /d` line, exactly as the registration script writes it: the wrapper is
  # what the task runs, so it is what decides which tree trades.
  $checkoutMatch = [regex]::Match([string]$wrapperText, '(?m)^cd /d\s+"([^"]+)"')

  $feedPath = if ($row.feed) { Join-Path $laneRoot ([string]$row.feed) } else { $null }
  $heartbeatPath = if ($row.trader_status) { Join-Path $laneRoot ([string]$row.trader_status) } else { $null }
  $feed = Read-JsonFile $feedPath
  $heartbeat = Read-JsonFile $heartbeatPath

  $heartbeatExpected = 300
  if ($heartbeat -and $heartbeat.expected_interval_seconds) { $heartbeatExpected = [int]$heartbeat.expected_interval_seconds }
  $heartbeatWritten = $null
  if ($heartbeat -and $heartbeat.written_at_utc) {
    try { $heartbeatWritten = [datetime]::Parse([string]$heartbeat.written_at_utc, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AdjustToUniversal) } catch { $heartbeatWritten = $null }
  }
  $feedGenerated = $null
  if ($feed -and $feed.generated_at_utc) {
    try { $feedGenerated = [datetime]::Parse([string]$feed.generated_at_utc, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AdjustToUniversal) } catch { $feedGenerated = $null }
  }
  $heartbeatAge = if ($heartbeatWritten) { [int]($now - $heartbeatWritten.ToUniversalTime()).TotalSeconds } else { $null }
  $feedAge = if ($feedGenerated) { [int]($now - $feedGenerated.ToUniversalTime()).TotalSeconds } else { $null }

  $symbols = @()
  if ($feed -and $feed.instruments) { $symbols = @($feed.instruments | ForEach-Object { [string]$_.symbol } | Where-Object { $_ }) }

  $laneFacts += [ordered]@{
    id                        = [string]$row.id
    label                    = [string]$row.label
    enabled                  = $enabled
    root                     = $laneRoot
    root_exists              = (Test-Path -LiteralPath $laneRoot)
    terminal                 = [string]$row.terminal
    terminal_present         = [bool]($row.terminal -and (Test-Path -LiteralPath ([string]$row.terminal)))
    wrapper                  = [ordered]@{
      path        = $wrapperPath
      present     = (Test-Path -LiteralPath $wrapperPath)
      checkout    = if ($checkoutMatch.Success) { $checkoutMatch.Groups[1].Value } else { $null }
      state       = Get-FlagValue $wrapperText "state"
      log         = Get-FlagValue $wrapperText "log"
      lock        = Get-FlagValue $wrapperText "lock"
      journal     = Get-FlagValue $wrapperText "journal"
      python      = Get-FlagValue $wrapperText "python"
      terminal    = Get-FlagValue $wrapperText "terminal"
      armed       = [bool]([regex]::IsMatch([string]$wrapperText, "(?<![\w-])--confirm-live(?:\s|$)"))
    }
    published                 = if ($row.status_published) { Join-Path $publisherRoot ([string]$row.status_published) } else { $null }
    feed_path                 = $feedPath
    feed_generated_at_utc     = if ($feed) { [string]$feed.generated_at_utc } else { $null }
    feed_age_seconds          = $feedAge
    symbols                   = $symbols
    heartbeat_path            = $heartbeatPath
    heartbeat_host            = if ($heartbeat -and $heartbeat.host) { [string]$heartbeat.host.computer } else { $null }
    heartbeat_written_at_utc  = if ($heartbeat) { [string]$heartbeat.written_at_utc } else { $null }
    heartbeat_age_seconds     = $heartbeatAge
    heartbeat_expected_seconds = $heartbeatExpected
    heartbeat_armed           = if ($heartbeat) { [bool]$heartbeat.armed } else { $null }
    account_login_masked      = [string]$row.account_login_masked
    account_server            = [string]$row.account_server
    lane_task                 = if ($row.tasks) { [string]$row.tasks.lane } else { $null }
    trader_task               = if ($row.tasks) { [string]$row.tasks.trader } else { $null }
    startup_task              = if ($row.tasks) { [string]$row.tasks.startup } else { $null }
    probe                     = $null
  }
}


# ---------------------------------------------------------------- the terminal probe, one per lane

if ($ProbeTerminal) {
  $probeScript = Join-Path $runtimeRoot "tools\mt5-bridge\live-trading-account-probe.py"
  if (-not (Test-Path -LiteralPath $probeScript)) {
    $probeScript = Join-Path $scriptRoot "tools\mt5-bridge\live-trading-account-probe.py"
  }
  foreach ($lane in $laneFacts) {
    if (-not $lane.terminal -or -not $pythonPath -or -not (Test-Path -LiteralPath $pythonPath)) { continue }
    if (-not (Test-Path -LiteralPath $probeScript)) { continue }
    # `--path=<value>` is one argument with the spaces inside it: a separate token would be re-split by the
    # shell, and a terminal path is exactly the kind of value that contains a space.
    $symbolArgument = "--symbols=" + (@($lane.symbols) -join ",")
    $raw = & $pythonPath $probeScript ("--path=" + [string]$lane.terminal) $symbolArgument 2>$null
    $parsed = $null
    try { $parsed = (($raw -join "`n") | ConvertFrom-Json) } catch { $parsed = $null }
    $lane.probe = $parsed
  }
}

# ---------------------------------------------------------------- the checks

$desktopDetail = if ($desktopExperience) {
  "Windows build $buildNumber, installation type '$installationType', explorer.exe present"
} else {
  "Windows build $buildNumber, installation type '$installationType', explorer.exe present: $explorerPresent - Server Core cannot run an MT5 terminal"
}
Add-Check "windows_desktop_experience" $desktopExperience "blocking" $desktopDetail
Add-Check "windows_version_supported" ($buildNumber -ge 17763) "blocking" "build $buildNumber (Server 2019 / Windows 10 build 17763 is the floor)"
Add-Check "timezone_utc" ([string]$timeZone -eq "UTC") "advisory" "time zone '$timeZone': the artifacts are written in UTC regardless, so this only affects how a person reads a log"

$nodeMajor = 0
if ($runtimeVersions.node -match "v(\d+)") { $nodeMajor = [int]$Matches[1] }
Add-Check "node_version" ($nodeMajor -ge 20) "blocking" "node '$($runtimeVersions.node)' at '$($runtimeVersions.node_path)' (20 or newer is the floor)"
Add-Check "git_available" ([bool]$runtimeVersions.git) "blocking" "'$($runtimeVersions.git)'"
$pythonMajorMinor = if ($runtimeVersions.python) { ($runtimeVersions.python -split '\.')[0..1] -join '.' } else { "" }
Add-Check "python_313" ($pythonMajorMinor -eq "3.13") "blocking" "python '$($runtimeVersions.python)' at '$($runtimeVersions.python_path)' (3.13 is what the producer was proved on)"
$metaTraderPinned = [string]$runtimeVersions.metatrader5 -eq "5.0.6231"
Add-Check "metatrader5_package" ([bool]$runtimeVersions.metatrader5) "blocking" "MetaTrader5 '$($runtimeVersions.metatrader5)'$(if ($metaTraderPinned) { ' (the PC pinned version)' } else { ' - the PC proved 5.0.6231' })"

# Two checkouts: distinct, neither inside the other, both exactly on the pinned commit, nothing pulling.
$separated = -not ($runtimeRoot -eq $publisherRoot) -and -not (Test-NestedPath $runtimeRoot $publisherRoot) -and -not (Test-NestedPath $publisherRoot $runtimeRoot)
Add-Check "checkout_separation" $separated "blocking" "runtime '$runtimeRoot' against publisher '$publisherRoot'"

foreach ($checkout in @(
  [ordered]@{ name = "runtime"; root = $runtimeRoot },
  [ordered]@{ name = "publisher"; root = $publisherRoot }
)) {
  $head = Get-Git $checkout.root @("rev-parse", "HEAD")
  $dirty = Get-Git $checkout.root @("status", "--porcelain")
  $pinned = $false
  $commitDetail = "not a git checkout at '$($checkout.root)'"
  if ($head) {
    $pinned = $PinnedCommit -and ($head.StartsWith($PinnedCommit, [System.StringComparison]::OrdinalIgnoreCase))
    $commitDetail = "HEAD $head against pinned '$PinnedCommit'"
    if (-not $PinnedCommit) { $commitDetail = "HEAD $head, but no -PinnedCommit was given, so nothing is pinned" }
  }
  Add-Check "checkout_$($checkout.name)_commit_pinned" $pinned "blocking" $commitDetail
  $clean = $head -and -not $dirty
  # A publisher checkout is expected to be momentarily dirty: it commits the snapshot it just wrote. The
  # runtime checkout is not, and that is the one that must not move under a trading loop.
  $cleanSeverity = if ($checkout.name -eq "runtime") { "blocking" } else { "advisory" }
  $changedText = if ($dirty) {
    "changed files: " + ((($dirty -split "`n") | Where-Object { $_ } | Select-Object -First 5) -join "; ")
  } else {
    "no changed files"
  }
  Add-Check "checkout_$($checkout.name)_clean" $clean $cleanSeverity $changedText
}

$updaters = @($taskFacts | Where-Object { $_.arguments -match "(?i)git\s+(pull|fetch|reset)|npm\s+(ci|install)|yarn\s+install" })
Add-Check "no_automatic_code_update" ($updaters.Count -eq 0) "blocking" `
  ($(if ($updaters.Count -eq 0) { "no scheduled task pulls or reinstalls code" } else { "a scheduled task would update code: " + (($updaters | ForEach-Object { $_.name }) -join ", ") }))

Add-Check "autologon_enabled" ($autoLogonOn -and $autoLogonUser -and $autoLogonPasswordStored) "blocking" `
  "AutoAdminLogon '$([string]$winlogon.AutoAdminLogon)', user '$autoLogonUser', password stored: $autoLogonPasswordStored"
Add-Check "rdp_enabled" ([bool]$rdpEnabled) "blocking" "Terminal Server fDenyTSConnections = '$([string]$rdp.fDenyTSConnections)'"
Add-Check "rdp_nla" ([bool]$rdpNla) "advisory" "RDP-Tcp UserAuthentication = '$([string]$rdpTcp.UserAuthentication)' (1 is Network Level Authentication)"
Add-Check "ssh_service" ([bool]$sshd) "advisory" "sshd: $(if ($sshd) { $sshd.Status } else { 'not installed' })"


# ---------------------------------------------------------------- isolation across lanes

Add-Check "lanes_configured" ($laneFacts.Count -gt 0) "blocking" "$($laneFacts.Count) lane(s) read from '$lanesPath'"

$pathOwners = @{}
foreach ($lane in $laneFacts) {
  $lanePaths = @(
    [ordered]@{ kind = "terminal"; path = [string]$lane.terminal },
    [ordered]@{ kind = "state"; path = [string]$lane.wrapper.state },
    [ordered]@{ kind = "log"; path = [string]$lane.wrapper.log },
    [ordered]@{ kind = "lock"; path = [string]$lane.wrapper.lock },
    [ordered]@{ kind = "journal"; path = [string]$lane.wrapper.journal },
    [ordered]@{ kind = "heartbeat"; path = [string]$lane.heartbeat_path },
    [ordered]@{ kind = "published"; path = [string]$lane.published }
  )
  foreach ($entry in $lanePaths) {
    if (-not $entry.path) { continue }
    $key = $entry.kind + "|" + $entry.path.ToLowerInvariant()
    if (-not $pathOwners.ContainsKey($key)) { $pathOwners[$key] = @() }
    $pathOwners[$key] = @($pathOwners[$key]) + $lane.id
  }
}
$sharedPaths = @($pathOwners.GetEnumerator() | Where-Object { @($_.Value).Count -gt 1 })
$sharedPathDetail = if ($sharedPaths.Count -eq 0) {
  "no path is shared between lanes"
} else {
  (($sharedPaths | ForEach-Object { $_.Key + " <- " + (@($_.Value) -join ", ") }) -join "; ")
}
Add-Check "lane_paths_isolated" ($sharedPaths.Count -eq 0) "blocking" $sharedPathDetail

$taskOwners = @{}
foreach ($lane in $laneFacts) {
  foreach ($name in @($lane.lane_task, $lane.trader_task, $lane.startup_task)) {
    if (-not $name) { continue }
    if (-not $taskOwners.ContainsKey($name)) { $taskOwners[$name] = @() }
    $taskOwners[$name] = @($taskOwners[$name]) + $lane.id
  }
}
$sharedTasks = @($taskOwners.GetEnumerator() | Where-Object { @($_.Value).Count -gt 1 })
$sharedTaskDetail = if ($sharedTasks.Count -eq 0) {
  "every task name belongs to one lane"
} else {
  (($sharedTasks | ForEach-Object { $_.Key + " <- " + (@($_.Value) -join ", ") }) -join "; ")
}
Add-Check "lane_task_names_isolated" ($sharedTasks.Count -eq 0) "blocking" $sharedTaskDetail


# ---------------------------------------------------------------- per lane: identity, freshness, recovery

foreach ($lane in $laneFacts) {
  $severity = if ($lane.enabled) { "blocking" } else { "advisory" }
  $prefix = "lane_" + $lane.id
  $state = if ($lane.enabled) { "enabled" } else { "parked (enabled: false)" }

  Add-Check "${prefix}_root_present" ([bool]$lane.root_exists) $severity "root '$($lane.root)', $state"
  Add-Check "${prefix}_terminal_present" ([bool]$lane.terminal_present) $severity "terminal '$($lane.terminal)'"
  $wrapperDetail = if ($lane.wrapper.present) {
    "wrapper '$($lane.wrapper.path)', armed: $($lane.wrapper.armed)"
  } else {
    "no wrapper at '$($lane.wrapper.path)': the lane has not been registered on this host"
  }
  Add-Check "${prefix}_wrapper_present" ([bool]$lane.wrapper.present) $severity $wrapperDetail
  $declared = [bool]($lane.wrapper.state -and $lane.wrapper.log -and $lane.wrapper.lock -and $lane.wrapper.journal)
  Add-Check "${prefix}_paths_declared" $declared $severity `
    ("state '$($lane.wrapper.state)', log '$($lane.wrapper.log)', lock '$($lane.wrapper.lock)', journal '$($lane.wrapper.journal)'")

  $identity = [bool]($lane.account_login_masked -and $lane.account_server)
  $identityDetail = if ($identity) {
    "the lanes file holds $($lane.account_login_masked) on $($lane.account_server)"
  } else {
    "the lanes file holds no login and server for this lane: it needs its own account identity before it can be enabled"
  }
  Add-Check "${prefix}_account_identity_configured" $identity $severity $identityDetail

  $heartbeatOnThisHost = $lane.heartbeat_host -and ([string]$lane.heartbeat_host -eq $env:COMPUTERNAME)
  $hostDetail = if ($lane.heartbeat_host) {
    "heartbeat host '$($lane.heartbeat_host)', this computer '$env:COMPUTERNAME'$(if (-not $heartbeatOnThisHost) { ' - a copied heartbeat is history, not health' })"
  } else {
    "no heartbeat at '$($lane.heartbeat_path)'"
  }
  Add-Check "${prefix}_heartbeat_written_here" ([bool]$heartbeatOnThisHost) $severity $hostDetail

  $heartbeatLimit = [int](3 * [Math]::Max(60, [int]$lane.heartbeat_expected_seconds))
  $heartbeatFresh = $null -ne $lane.heartbeat_age_seconds -and [int]$lane.heartbeat_age_seconds -le $heartbeatLimit
  $heartbeatAgeText = if ($null -ne $lane.heartbeat_age_seconds) { "$($lane.heartbeat_age_seconds)s" } else { "unknown" }
  Add-Check "${prefix}_heartbeat_fresh" ([bool]$heartbeatFresh) $severity `
    ("age $heartbeatAgeText against a $heartbeatLimit s limit (3 x $($lane.heartbeat_expected_seconds)s expected interval)")

  $feedLimit = 900
  $feedFresh = $null -ne $lane.feed_age_seconds -and [int]$lane.feed_age_seconds -le $feedLimit
  $feedAgeText = if ($null -ne $lane.feed_age_seconds) { "$($lane.feed_age_seconds)s" } else { "unknown" }
  Add-Check "${prefix}_feed_fresh" ([bool]$feedFresh) $severity "age $feedAgeText against $feedLimit s"

  $traderTask = @($taskFacts | Where-Object { $_.name -eq $lane.trader_task })[0]
  Add-Check "${prefix}_trader_task_registered" ([bool]($traderTask -and $traderTask.present)) $severity "task '$($lane.trader_task)'"
  if ($traderTask -and $traderTask.present) {
    # "Recovers after a reboot with nobody logged on" is one field: a task that only runs for an interactive
    # logon never runs on a host whose session nobody opens.
    $unattended = $traderTask.logon_type -in @("Password", "S4U", "ServiceAccount")
    Add-Check "${prefix}_trader_runs_without_logon" $unattended $severity "logon type '$($traderTask.logon_type)'"
  }


  if ($lane.probe) {
    $probeOk = [bool]$lane.probe.ok
    $probeError = if ($lane.probe.error) { [string]$lane.probe.error.message } else { "" }
    $probeDetail = if ($probeOk) {
      "terminal build $($lane.probe.terminal.build), connected $($lane.probe.terminal.connected)"
    } else {
      "probe failed: $probeError"
    }
    Add-Check "${prefix}_probe_reachable" $probeOk $severity $probeDetail

    if ($probeOk -and $lane.probe.account) {
      $probeLogin = [string]$lane.probe.account.login_masked
      $probeServer = [string]$lane.probe.account.server
      $match = $identity -and ($probeLogin -eq $lane.account_login_masked) -and ($probeServer -eq $lane.account_server)
      Add-Check "${prefix}_account_matches_terminal" $match $severity `
        "the terminal says $probeLogin on $probeServer, the lanes file says $($lane.account_login_masked) on $($lane.account_server)"

      $mayTrade = ([bool]$lane.probe.account.trade_allowed) -and ([bool]$lane.probe.account.trade_expert) -and ([bool]$lane.probe.terminal.trade_allowed)
      Add-Check "${prefix}_permissions" $mayTrade $severity `
        "account trade_allowed $($lane.probe.account.trade_allowed), trade_expert $($lane.probe.account.trade_expert), terminal trade_allowed $($lane.probe.terminal.trade_allowed)"

      $probedSymbols = @($lane.probe.symbols)
      $notTradable = @($probedSymbols | Where-Object { -not $_.tradable })
      $covered = $probedSymbols.Count -gt 0 -and $probedSymbols.Count -eq @($lane.symbols).Count
      $symbolDetail = if ($probedSymbols.Count -eq 0) {
        "no instrument was probed: the lane's feed names the symbols to check"
      } elseif ($notTradable.Count -eq 0) {
        "$($probedSymbols.Count) symbol(s) carry full trading: " + (($probedSymbols | ForEach-Object { $_.symbol }) -join ", ")
      } else {
        (($notTradable | ForEach-Object { "$($_.symbol) $($_.trade_mode_name) $($_.error)" }) -join "; ")
      }
      Add-Check "${prefix}_symbols_tradable" ($covered -and $notTradable.Count -eq 0) $severity $symbolDetail
    }
  } elseif ($ProbeTerminal) {
    $probeSeverity = if ($lane.enabled) { "blocking" } else { "advisory" }
    Add-Check "${prefix}_probe_reachable" $false $probeSeverity "the probe did not run: python or the probe script was not found"
  } else {
    Add-Check "${prefix}_probe_reachable" $false "advisory" "not probed in this run (-ProbeTerminal reads the lane's terminal through MetaTrader5)"
  }
}

# ---------------------------------------------------------------- the answer

# -IgnoreCheck exists for the PC and for a check that cannot apply to the machine it runs on (a client Windows
# has no Server Core to rule out, the PC has no auto-logon to offer). It never turns a failure into a pass: the
# check keeps its `ok` and its reason, and the line is marked skipped so the document still says what was read.
# At cutover nothing is ignored. The list is split on commas because `-File` hands a whole list over as one
# string, which is how an operator will actually type it.
$ignoreIds = @($IgnoreCheck | ForEach-Object { [string]$_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
foreach ($check in $checks) {
  if ($ignoreIds -contains $check.id) {
    $check.severity = "advisory"
    $check.detail = "ignored by -IgnoreCheck: " + $check.detail
  }
}

$blockingFailures = @($checks | Where-Object { -not $_.ok -and $_.severity -eq "blocking" })
$advisories = @($checks | Where-Object { -not $_.ok -and $_.severity -eq "advisory" })

Write-Output "host              = $env:COMPUTERNAME ($($currentVersion.ProductName), build $buildNumber, '$installationType')"
Write-Output "runtime_root      = $runtimeRoot"
Write-Output "publisher_root    = $publisherRoot"
Write-Output "pinned_commit     = $(if ($PinnedCommit) { $PinnedCommit } else { '<not set>' })"
Write-Output "lanes             = $(@($laneFacts | ForEach-Object { $_.id + $(if ($_.enabled) { '' } else { ' (parked)' }) }) -join ', ')"
Write-Output ""
foreach ($check in $checks) {
  $mark = if ($check.ok) { "ok  " } elseif ($check.severity -eq "blocking") { "FAIL" } else { "warn" }
  if ($check.detail -like "ignored by -IgnoreCheck:*") { $mark = "skip" }
  Write-Output ("{0} {1,-46} {2}" -f $mark, $check.id, $check.detail)
}
Write-Output ""
Write-Output "blocking_failures = $($blockingFailures.Count)"
Write-Output "advisories        = $($advisories.Count)"
Write-Output "result            = $(if ($blockingFailures.Count -eq 0) { 'host_ready' } else { 'blocked' })"

$document = [ordered]@{
  schema_version   = "live-trading-host-prepare-v1"
  generated_at_utc = $now.ToString("o")
  mode             = "Verify"
  host             = [ordered]@{
    computer          = $env:COMPUTERNAME
    user              = $env:USERNAME
    platform          = "win32"
    product_name      = [string]$currentVersion.ProductName
    build             = $buildNumber
    installation_type = $installationType
    desktop_experience = $desktopExperience
    time_zone         = $timeZone
    autologon         = [ordered]@{ enabled = $autoLogonOn; user = $autoLogonUser; password_stored = $autoLogonPasswordStored }
    rdp               = [ordered]@{ enabled = [bool]$rdpEnabled; nla = [bool]$rdpNla }
    sshd              = if ($sshd) { [string]$sshd.Status } else { $null }
  }
  paths            = [ordered]@{ runtime_root = $runtimeRoot; publisher_root = $publisherRoot; pinned_commit = $PinnedCommit }
  runtime          = $runtimeVersions
  tasks            = $taskFacts
  lanes            = $laneFacts
  checks           = $checks
  blocking_failures = $blockingFailures.Count
  advisories       = $advisories.Count
  result           = if ($blockingFailures.Count -eq 0) { "host_ready" } else { "blocked" }
}

if ($Out) {
  $outPath = if ([System.IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $scriptRoot $Out }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outPath) | Out-Null
  [System.IO.File]::WriteAllText($outPath, (($document | ConvertTo-Json -Depth 12) + "`n"), (New-Object System.Text.UTF8Encoding($false)))
}

if ($blockingFailures.Count -gt 0) { exit 1 }
exit 0

