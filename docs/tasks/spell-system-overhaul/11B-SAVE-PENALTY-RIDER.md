# 11B - Save Penalty Rider (Cantrip Gap: Mind Sliver)

## Context
- Gap from `1K-MIGRATE-CANTRIPS-BATCH-3.md`: Mind Sliver imposes "subtract 1d4 from the next saving throw" but current schema lacks a structured way to express a temporary save penalty rider.

## Problem
- `UTILITY` description holds the mechanic; engine cannot apply a one-time save penalty to the target's next saving throw. AI/automation can't account for it.

## Goals
1. Add a structured rider for "next save" penalties (dice or static).
2. Ensure it can be consumed by combat save resolution and expires after one save or a duration.
3. Keep backward compatibility (optional field).

## Proposed Approach
- Schema:
  - Add optional `savePenalty` block to `UtilityEffect` or a new `Defensive/Offensive` substructure, e.g.:
    ```json
    {
      "savePenalty": {
        "dice": "1d4",
        "applies": "next_save" | "all_saves",
        "duration": { "type": "rounds", "value": 1 }
      }
    }
    ```
- Validator:
  - Add Zod schema for `savePenalty`, optional.
- Engine:
  - Track a per-target rider that consumes on the next saving throw or expires after duration; integrate into saving throw resolution.
- Data migration:
  - Update `mind-sliver.json` to include `savePenalty` and remove reliance on prose for the mechanic.

## Acceptance Criteria
- Schema and validator updated; `npm run validate` passes.
- Combat save resolution applies and clears the penalty appropriately.
- `public/data/spells/level-0/mind-sliver.json` updated to use `savePenalty`; validation/tests stay green.

## Notes
- Keep enums consistent; make the field optional to avoid impacting other utility effects.
