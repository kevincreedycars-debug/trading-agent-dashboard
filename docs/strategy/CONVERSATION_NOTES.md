# Strategy conversation notes

Record dated user decisions, questions and recommendations here. No discussion has been recorded yet.

## 2026-09-20 - User request: dark purple VS Code window (environment change)

- User asked for this VS Code window to be dark purple.
- Action taken within assignment limits (no edits to the checkout): added a
  `workbench.colorCustomizations` block (90 keys covering title bar, activity bar/top activity bar,
  status bar, side bar, tabs, editor, minimap, panel, terminal, widgets/pickers, menus, lists,
  badges, scrollbars) plus `"window.titleBarStyle": "custom"` to the VS Code **user** settings file
  `C:\Users\A17\AppData\Roaming\Code\User\settings.json`. Active theme remains `Dark+`, so syntax
  colours are unchanged; only window chrome plus a subtle editor/terminal tint changed.
- Verification performed: settings file parses as JSONC, all 90 colour ids appear as literals in the
  bundles shipped with the running build (VS Code 1.136.1, commit a44adf7f53), every value is a
  valid hex colour, and the file still uses CRLF line endings only.
- Rollback: byte-identical pre-change copy kept at
  `C:\Users\A17\AppData\Roaming\Code\User\settings.json.strategy-backup-20260920`
  (copy it back over `settings.json` to revert; deleting the two added settings also works).
- Coordination note: user settings are machine-global, so every VS Code window (including other
  workers' windows) now shows the purple chrome. Assignment rules restrict this worker to
  `docs/strategy/`, so no `.vscode/settings.json` was created in the shared worktree - that file is
  the only way to scope the look to a single folder. Pre-existing duplicate keys
  (`terminal.integrated.defaultProfile.windows`, `terminal.integrated.enablePersistentSessions`,
  `claudeCode.preferredLocation`) were left untouched.
- No project/strategy decision was made in this turn, so no submission was filed.
