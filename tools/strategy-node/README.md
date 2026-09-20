# DeepSeek strategy workspace

Open [Strategy.code-workspace](Strategy.code-workspace) in VS Code, select DeepSeek
in your existing agent extension, and start with this one-time message:

> You are the project strategy adviser. Read D:/trading-agent-dashboard-codex/docs/orchestration/assignments/strategy.md and follow it. Your writable checkout is D:/trading-agent-dashboard-codex/.local/worktrees/strategy. Read the canonical project and current mailbox, then discuss priorities with me and build your first strategy note. Publish recommendations through the shared mailbox and report activity to the monitor. Read STRATEGY_AGENT.md in your checkout first.

No new API key, provider configuration or background model runner is installed.
The central folder is included for reference; this is a cooperative write boundary,
not an OS-enforced read-only mount. Other worktrees and local evidence can be read
by their absolute paths in the central register. There is no shared chat memory;
the adviser saves relevant conversation outcomes in its own notes.

The Strategy row appears in the existing monitor automatically. Submissions alert
the user and enter the same coordinator queue as Gold. Active sessions check files
at turn/checkpoint boundaries; file notifications alone do not wake idle AI sessions.
The token footer includes DeepSeek only when supported local extension logs expose usage.
