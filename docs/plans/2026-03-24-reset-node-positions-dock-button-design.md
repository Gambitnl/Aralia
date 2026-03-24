# Design: Move Reset Node Positions to Bottom Dock

**Date:** 2026-03-24

## Summary

Move the "Reset Node Positions" button out of the collapsible toolbar menu and into the permanent bottom dock alongside the existing zoom and reset-view controls.

## Current State

- "Reset Node Positions" lives at line ~2039 of `RoadmapVisualizer.tsx` inside the collapsible toolbar menu (`showToolbarMenu` gate).
- Bottom dock (lines ~3501–3571) contains: a zoom pill with `[-]` and `[+]` buttons, and a standalone "Reset View" button.

## Target Layout

```
[ - | + ]  |  Reset View  |  Reset Node Positions
```

A `h-5 w-px` divider (matching the existing one between `-` and `+`) separates the zoom pill from the two reset buttons, grouping them visually.

## Changes

### `RoadmapVisualizer.tsx`

1. **Remove** the "Reset Node Positions" `<button>` from the toolbar menu (line ~2039).

2. **Add** a `h-5 w-px` divider after the zoom pill group (before "Reset View") using the same dark/light class pattern as the existing internal divider.

3. **Add** a "Reset Node Positions" button after "Reset View", styled identically (same `rounded-full border px-4 min-h-10 text-sm font-semibold transition-colors` classes, same dark/light variants).
   - Full label: `Reset Node Positions`
   - Compact label (`isCompactViewport`): `Node Pos`
   - `onClick`: calls existing `resetNodePositions` function

No new state, no new props, no new functions — only DOM restructuring.
