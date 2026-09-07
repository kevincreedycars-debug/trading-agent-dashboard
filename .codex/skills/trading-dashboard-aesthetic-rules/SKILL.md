---
name: trading-dashboard-aesthetic-rules
description: Trading-first visual rules for the Asset Directional Movement Dashboard. Use when creating or editing dashboard-facing HTML, CSS, visual JavaScript, design mockups, project brief pages, or any other interface artifact in this repository that should feel like a serious market terminal rather than a generic SaaS page.
---

# Trading Dashboard Aesthetic Rules

## Overview

Use this skill to keep dashboard visuals disciplined, trading-oriented, and honest about the boundary between live calls and frozen research. Favor clarity, signal hierarchy, and terminal-like focus over decorative polish.

## Workflow

1. Read `references/visual-language.md` before making any dashboard-facing visual change.
2. Read `../dashboard-layout-safety-rules/SKILL.md`, then `../dashboard-layout-safety-rules/references/card-layout-checklist.md`, before changing any bounded text surface such as cards, panels, pills, tables, badges, or compact summaries.
3. Identify whether the work affects live call presentation, research presentation, workflow telemetry, or project-orientation pages.
4. Apply the visual contract consistently: dark market-terminal canvas, strong hierarchy, compact information groupings, and explicit bullish, bearish, warning, and neutral semantics.
5. Check that the result still communicates truthfully. Visual emphasis must never imply stronger model validity than the underlying logic supports.

## Non-Negotiables

- Keep the overall tone trading-grade, not editorial-luxury, startup-marketing, or generic admin-template.
- Prefer near-black and deep-slate surfaces with restrained blue, teal, amber, green, and red accents.
- Use typography that feels technical and modern. Favor `Space Grotesk`, `IBM Plex Sans`, and `IBM Plex Mono` or close equivalents already present in the project.
- Make bullish, bearish, warning, and neutral states visually distinct at a glance.
- Preserve scanability. Dense information is acceptable; clutter is not.
- Distinguish live operational surfaces from read-only research surfaces through labels, copy, and supporting layout cues.

## File Scope

Consult this skill before editing or creating:

- `index.html`
- `styles.css`
- `script.js` when it changes rendered UI
- Any new `.html`, `.css`, or other visual asset added for dashboard communication

## References

- Read `references/visual-language.md` for the concrete rule set.
