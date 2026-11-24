# Approved reference implementation

2026-11-24: Approved-reference control-room correction. The presentation now uses three colour groups and ten compact visual nodes matching the user-approved reference, rather than twelve technical cards. Existing manifest components, all four readiness dimensions, source evidence and workflow/execution links remain in the inspector. Navigation is simplified only on this page, with all original destinations retained in a disclosure. No manifest, data, model, scoring, acquisition or n8n workflow changes. Data-agent work remains paused pending user design review. Five presentation tests passed; desktop and 390px iframe browser checks covered selection, workflow links, Escape/close, zoom reset and horizontal overflow. The browser regression suite was updated for the new presentation but not run through its standalone Playwright runner in this environment.

The renderer groups existing technical manifest nodes into visual stages. This is a conceptual explanation, not a one-to-one n8n execution graph. Group badges take the most restrictive member evidence state. Unknown evidence stays unknown. The public page performs no workflow execution.

Next action: user reviews visual fidelity before any new coordinator integration.

Correction (2026-11-24, later the same day): the user ruled that this page remains part of the live
dashboard, so the simplified navigation described above was removed and the shared bar and rail restored. The
drawing was left untouched. See `BACKTEST_ENGINE_V2_SHARED_NAV_20261124.md`.
