# Spell Branch Navigator Node Cleanup

**Date:** 2026-03-23
**Status:** Approved

## Problem

The `Spell Branch Navigator` sub-branch in `generate.ts` contains two sets of wrong nodes:

1. **Old (stale in paths list):** `Spell Profile Data Feed` — infrastructure node, no user-facing visual
2. **New (wrong in milestones list):** `Spell List Source` + 3 children, `Spell List Loader` + 3 children — implementation details, not visible behavior

Neither set represents user-facing, interactive, or visually-functional capabilities. The media capture for `Spell Profile Data Feed` (a PNG of raw JSON) violates the principle that previews should show something a user can observe.

## Design Principle

> A node gets a visual (GIF or screenshot) if and only if:
> - The user does something → something observable happens, OR
> - The node has a specific visual element with meaning (labels, markers, etc.)
>
> A sub-branch top-level node gets a capability overview GIF showing what the whole thing does.
> Children that are infrastructure/data concerns get no visual and may stay as leaf nodes without captures.

## Target Structure

```
Roadmap Tool > Spell Branch Navigator          ← NEW top-level GIF (full navigator overview)
  > Axis Engine                                 ← keep existing GIF (interactive: class filter → counts update)
  > VSM Drill-Down Navigator                   ← keep existing GIF (interactive: step-by-step drill)
  > Requirements Component Mapping             ← keep existing screenshot (visual: V/S/M labels)
```

**Spell Graph Navigation** — unchanged, all 3 nodes are correct.

## Changes Required

### 1. `generate.ts` — paths list (lines ~89–100)
- Remove: `'Roadmap Tool > Spell Branch Navigator > Spell Profile Data Feed'`
- Do NOT add Spell List Source or Spell List Loader paths (they're being removed)

### 2. `generate.ts` — descriptions object
- Remove key: `'Roadmap Tool > Spell Branch Navigator > Spell List Source'` and its 3 children
- Remove key: `'Roadmap Tool > Spell Branch Navigator > Spell List Loader'` and its 3 children
- Remove key: `'Roadmap Tool > Spell Branch Navigator > Spell Profile Data Feed'` (if present)

### 3. `generate.ts` — milestones list (lines ~1617–1630)
- Remove: all 8 Spell List Source / Spell List Loader milestone entries
- Keep: Spell Branch Navigator, Axis Engine, VSM Drill-Down Navigator, Requirements Component Mapping

### 4. `.media/` — delete stale capture
- Delete: `sub_pillar_dev_tools_roadmap_tool_spell_branch_navigator_spell_profile_data_feed.png`

### 5. `capture-gifs-screenshots.mjs` — add top-level navigator capture
- Add a capture for `sub_pillar_dev_tools_roadmap_tool_spell_branch_navigator` showing the full Spell Branch tab with all axes visible (the capability overview GIF)

### 6. Run the capture script
- Execute the updated capture script to produce the new top-level GIF
- Verify the file lands in `.media/` with correct naming

### 7. Verify in browser
- Confirm the 8 removed nodes no longer appear in the canvas
- Confirm `Spell Branch Navigator` parent node now shows VIEW PREVIEW
- Confirm Axis Engine, VSM Drill-Down, Requirements still show VIEW PREVIEW
