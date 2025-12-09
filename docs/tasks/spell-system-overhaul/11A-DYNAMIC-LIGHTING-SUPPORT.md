# 11A - Dynamic Lighting Support (Cantrip Gap: Light)

## Context
- Gap surfaced in `1K-MIGRATE-CANTRIPS-BATCH-3.md` (Light): The spell is modeled as `UTILITY` text; no engine mechanic exists for dynamic light sources.
- Current schema allows `utilityType: "light"` and descriptive text, but runtime systems (battle map/world) do not consume it to render light or affect vision.

## Problem
- There is no structured lighting model to attach to spells/items. Light radius, dim/bright falloff, and attachment to a token/object are not machine-readable, so the effect remains narrative only.

## Goals
1. Add schema fields to describe light sources (radius, brightness tiers, duration, attachment).
2. Integrate with rendering/vision systems so light sources created by spells are applied automatically.
3. Keep backward compatibility: non-light spells unaffected; existing validations pass.

## Proposed Approach
- Schema:
  - Extend `UtilityEffect` with an optional `light` block: `{ brightRadius: number; dimRadius?: number; attachedTo?: "caster" | "target" | "point"; duration?: EffectDuration; color?: string }`.
- Validator:
  - Add corresponding Zod schema; ensure optional and scoped to utility effects.
- Engine/UI:
  - When a spell with `light` is active, emit a light source into the map/vision system; remove on duration end/concentration drop.
  - Allow attaching to caster/target or a point; update position each tick/turn if attached.
- Migration:
  - Update `light.json` to populate `utilityType: "light"` + `light` block with bright/dim radii (e.g., 20/20).

## Acceptance Criteria
- New schema fields validated; `npm run validate` passes.
- Light effects render in map/vision when applied; removed when expired.
- `public/data/spells/level-0/light.json` updated to use the `light` block; validation and tests remain green.

## Notes
- Keep enums consistent with existing casing.
- Avoid breaking other utility spells; default behavior unchanged when `light` is absent.
