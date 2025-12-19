# Dead Code & Deprecation Report

## Overview
This report documents identified dead code, deprecated features, and potential cleanup targets within the `src/` directory.

## Findings

### 1. Legacy Merchant Features
**File:** `src/hooks/useGameActions.ts`
**Type:** Legacy Feature Usage
**Risk:** Medium
**Description:** The code dispatches `OPEN_MERCHANT` actions with names "General Store (Legacy)" and "The Anvil (Legacy)".
**Verification:**
- Found string literals "General Store (Legacy)" in `useGameActions.ts`.
- Suggests these are old implementations kept around.
- **Action:** Investigate if these can be migrated to the standard merchant system or if they should be removed.

### 2. Console Logs
**Files:** Various (e.g., `src/components/ActionPane.tsx`)
**Type:** Dev Artifacts
**Risk:** Low
**Description:** active `console.log` statements in production code.
- `src/components/ActionPane.tsx`: `console.log('Player is ON village tile - adding ENTER_VILLAGE');`
- **Action:** Remove these log statements.

## Resolved Items
- **Deprecated Data File:** The report previously listed `src/data/races/gnome_subraces/deep_gnome.md` as deprecated. This file was confirmed to be already deleted. The existing `src/data/races/deep_gnome.README.md` documents the active implementation and was retained.
- **Unused Legacy Code:** `legacyNames` and `getRandomLegacyName` in `src/utils/settlementGeneration.ts` were confirmed to be already removed from the codebase.
