# Physics System Decisions

Status: active
Last updated: 2026-06-15

Use this file for durable choices that affect project scope, required documentation, or protocol interpretation. Keep operational notes in `AUDIT_OR_PROOF.md` and re-openable workflow deltas in `TRACKER.md` or `GAPS.md`.

## Decision Log

### D1: Required-doc surface initialized

Date: 2026-06-10

Owner: schema migration pass

Decision point:
`NORTH_STAR.md` declares `DECISIONS.md` as part of the required living-project surface.

Decision made:
Create this concise decisions file so the project folder matches the declared schema contract.

Rationale and evidence:
- Project folder: `docs/projects/physics`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-05`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Damage-type to elemental-state mapping scope (T4)

Date: 2026-06-15

Owner: Physics worker (Claude Opus 4.8 iteration 3)

Decision point:
T4 needed a command-level mapping from damage element to `StateTag`. The full
damage-type vocabulary (bludgeoning, piercing, slashing, force, necrotic,
psychic, radiant, thunder, etc.) does not all have a clean elemental meaning.

Decision made:
Map only damage types with an unambiguous elemental state: `fire -> Burning`,
`cold -> Cold`, `lightning -> Electrified`, `poison -> Poisoned`,
`acid -> Acid`. All other damage types map to nothing and leave `stateTags`
untouched. Mapping lives in `DamageTypeToStateTag` / `getStateTagForDamageType`
in `src/types/elemental.ts`.

Rationale and evidence:
- Keeps the physics state model honest: only contact that has a physical
  elemental analogue applies a state.
- `StateTag` enum has no member for physical/force/psychic/radiant damage, so
  forcing a mapping would invent states.
- Verified by scoped Vitest (see `AUDIT_OR_PROOF.md`, 2026-06-15).

Follow-up:
Revisit if status-condition wiring (T5) introduces conditions that imply states
not covered by damage types (e.g. Wet from a soak condition, Webbed from an
entangle condition).
