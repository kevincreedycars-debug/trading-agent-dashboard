# Card Layout Checklist

## Purpose

Use this checklist before shipping any dashboard-facing visual change that places text inside a bounded surface.

## Components To Check

- Signal cards
- Status cards
- Hero side panels
- Legend cards
- Workflow rows
- Metric cards
- Buttons, pills, and badges
- Tabs and compact navigation

## CSS Safety Defaults

- Put `min-width: 0` on text-bearing flex and grid children.
- Use `overflow-wrap: anywhere` on dynamic text values when length is unpredictable.
- Use `word-break: break-word` when tokens may be long or unspaced.
- Prefer `white-space: normal` for compact statuses and labels.
- Allow card headings and metric values to wrap before shrinking type aggressively.
- Keep enough internal padding that wrapped lines do not touch borders.

## Red Flags

- `white-space: nowrap` inside narrow cards without explicit truncation handling
- fixed-width cards with variable-length labels
- right-aligned status text that cannot wrap
- large headings in cards without `min-width: 0`
- metric grids that assume every value is short

## Review Pass

1. Check desktop width.
2. Check a narrower viewport.
3. Look for clipping, overlap, escaped text, or cut-off lines.
4. If wrapping looks messy, shorten the copy or reduce field count before reducing readability.

## Preference Order

1. Reflow safely
2. Simplify content density
3. Truncate intentionally

Never accept invisible or escaped text as the final state.
