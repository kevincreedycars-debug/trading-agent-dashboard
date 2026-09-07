---
name: dashboard-layout-safety-rules
description: Layout-safety rules for dashboard-facing UI in this repository. Use when creating or editing cards, panels, tables, tabs, badges, compact summaries, project brief pages, or any other text-bearing visual surface where content could overflow, clip, wrap badly, or become unreadable at desktop or mobile sizes.
---

# Dashboard Layout Safety Rules

## Overview

Use this skill to keep text and data inside their intended containers. Treat overflow prevention as a core quality requirement for every dashboard-facing visual change.

## Workflow

1. Read `references/card-layout-checklist.md` before changing any dashboard-facing HTML, CSS, or rendered UI JavaScript.
2. Identify every component that can receive variable-length content such as statuses, agent names, timestamps, metrics, explanatory copy, and button labels.
3. Apply safe sizing and wrapping rules before styling polish:
   - set `min-width: 0` on flex and grid children that contain text
   - allow labels and values to wrap when the container is compact
   - use `overflow-wrap: anywhere` or `word-break: break-word` on volatile strings
   - avoid `white-space: nowrap` unless clipping is intentional and visibly handled
4. Check the result in the local preview at both desktop and narrow widths. If a card is dense, prefer shorter copy or fewer visible fields over unsafe compression.
5. If any text still collides, clips, or escapes, fix the layout before doing further styling work.

## Non-Negotiables

- No text should run outside a card, panel, chip, badge, table cell, or button.
- Compact cards must support unknown future content lengths, not just today's sample data.
- Visual hierarchy must survive wrapping. A wrapped status is acceptable; clipped or overlapping text is not.
- Do not solve overflow by reducing contrast, shrinking text into illegibility, or hiding important meaning.
- When truncation is necessary, make it explicit and intentional.

## File Scope

Consult this skill before editing or creating:

- `index.html`
- `styles.css`
- `script.js` when it changes rendered UI
- `dashboard-northstar.html`
- Any new dashboard-facing `.html`, `.css`, or visual JS in this repository

## References

- Read `references/card-layout-checklist.md` for the concrete layout checks and CSS patterns.
