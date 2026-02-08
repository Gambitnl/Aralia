---
description: Maintain and update the Aralia icon system
---

# Maintain Icon System Workflow

Follow this checklist to safely add or update icons without regressions.

1.  **Pre-Flight Check**
    - [ ] **Search for Duplicates**: Search `src/components/Glossary/IconRegistry.tsx` for the icon name to ensure the key doesn't already exist.
    - [ ] **Check Missing Report**: View `http://localhost:3000/misc/design.html` -> "Missing Icons" tab.

2.  **Source & Implement**
    - [ ] Source reliable SVG from MDI (GitHub raw).
    - [ ] Add/Update in `IconRegistry.tsx`.
    - [ ] **Verify Write**: Read the file back to confirm the new SVG is present and correct.

3.  **Register & Categorize**
    - [ ] Add to `VALID_ICONS` in `GlossaryTraitTable.tsx`.
    - [ ] Add to `CATEGORIZED_ICONS` in `PreviewIcons.tsx`.

4.  **Visual Verification**
    - [ ] Check Design Preview ("Icons" tab).
    - [ ] **Confirm No Fallback**: Ensure the icon renders as a graphic, not a text span (fallback).
    - [ ] **Confirm No Duplicates**: If updating, ensure the old version is gone.

5.  **Status Configuration**
    - [ ] Cycle status (Selected/Deprecated) in UI.
    - [ ] Copy changes and update `PreviewIcons.tsx` sets.
