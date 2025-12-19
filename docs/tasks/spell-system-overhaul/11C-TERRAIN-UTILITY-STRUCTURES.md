# 11C - Structured Terrain/Utility Actions (Cantrip Gap: Mold Earth)

## Context
- Gap from `1K-MIGRATE-CANTRIPS-BATCH-3.md`: Mold Earth's excavation, difficult terrain creation, and cosmetic changes are only encoded in `UTILITY` text. No structured way to model small earth moves or terrain state changes.

## Problem
- The engine cannot automate terrain changes (digging a 5-foot cube, making terrain difficult, cosmetic effects) because they are unstructured. AI can't evaluate impact.

## Goals
1. Add structured fields for small-scale terrain manipulation (dig/fill, difficult terrain, cosmetic earth shaping).
2. Allow action resolution to mark terrain tiles with state (e.g., difficult, excavated depth) and duration where applicable.
3. Keep optional/compatible so existing spells aren't broken.

## Proposed Approach
- Schema:
  - Extend `TERRAIN` effect with optional `manipulation` block, e.g.:
    ```json
    {
      "manipulation": {
        "type": "excavate" | "fill" | "difficult" | "cosmetic",
        "volume": { "shape": "Cube", "size": 5, "depth": 5 },
        "duration": { "type": "minutes", "value": 1 }
      }
    }
    ```
  - Allow `cosmetic` to be non-mechanical but recorded.
- Validator:
  - Add optional `manipulation` schema.
- Engine:
  - Update terrain system to apply `difficult` flags, track excavated tiles/depth, and clear on duration end if applicable.
- Data migration:
  - Update `mold-earth.json` to use `manipulation` for dig/difficult/cosmetic entries instead of pure prose.

## Acceptance Criteria
- Schema and validator updated; `npm run validate` passes.
- Terrain state updates occur when the effect resolves; state is cleared/maintained per duration.
- `public/data/spells/level-0/mold-earth.json` updated to structured fields; validation/tests green.

## Notes
- Keep units in feet; align shapes with existing AoE enums (`Cube`, etc.).
- Make fields optional to avoid impacting unrelated terrain spells.
