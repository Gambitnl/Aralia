# Dead Code & Deprecation Report

## Overview
This report documents identified dead code, deprecated features, and potential cleanup targets within the `src/` directory.

## Findings

### 1. Deprecated Content
**File:** `src/data/races/gnome_subraces/deep_gnome.md`
**Type:** Deprecated Data File
**Risk:** Low
**Description:** The file is explicitly marked as "deprecated" in its frontmatter and body. It states that the Deep Gnome is now a standalone race option and this subrace entry is obsolete.
**Verification:**
- Frontmatter contains `tags: [..., "deprecated"]`.
- Content contains a warning block: "This entry is deprecated. The Deep Gnome is now a standalone race option."
- References to `deep_gnome` in the codebase (`src/data/races/gnome.ts`, `src/services/characterGenerator.ts`) point to the new standalone race ID `deep_gnome`, not `deep_gnome_legacy`.
- **Action:** Delete the file.

### 2. Unused / Legacy Code
**File:** `src/utils/settlementGeneration.ts`
**Type:** Unused Variable / Dead Code
**Risk:** Low
**Description:** The variable `legacyNames` and function `getRandomLegacyName` are defined at the bottom of the file but appear to be unexported (or at least unused if they were intended to be internal). However, checking the file content again revealed they *are* exported but might not be used.
**Verification:**
- `legacyNames` array defines a list of town names.
- `getRandomLegacyName` returns a random name from this list.
- A grep for `legacyNames` outside of this file returned no results.
- **Action:** Remove the `legacyNames` array and `getRandomLegacyName` function if confirmed unused by other modules.

### 3. Legacy Merchant Features
**File:** `src/hooks/useGameActions.ts`
**Type:** Legacy Feature Usage
**Risk:** Medium
**Description:** The code dispatches `OPEN_MERCHANT` actions with names "General Store (Legacy)" and "The Anvil (Legacy)".
**Verification:**
- Found string literals "General Store (Legacy)" in `useGameActions.ts`.
- Suggests these are old implementations kept around.
- **Action:** Investigate if these can be migrated to the standard merchant system or if they should be removed.

### 4. Console Logs
**Files:** Various (e.g., `src/components/ActionPane.tsx`)
**Type:** Dev Artifacts
**Risk:** Low
**Description:** active `console.log` statements in production code.
- `src/components/ActionPane.tsx`: `console.log('Player is ON village tile - adding ENTER_VILLAGE');`
- **Action:** Remove these log statements.

## Recommendation
The safest and most explicit removal candidate is **`src/data/races/gnome_subraces/deep_gnome.md`**. It is a data file marked as deprecated with clear instructions to remove it.

The `legacyNames` in `settlementGeneration.ts` is also a strong candidate, as it appears to be dead code within a utility file.
