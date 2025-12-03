# Spell Pipeline Test Plan

Lightweight, scriptable checks to gate spell migrations before integration testing.

## Scripts

- `tests/pipeline/spell-data-smoke.ts`
  - Scans cantrip files in `public/data/spells/level-0/`.
  - Verifies required top-level fields exist (id, name, level, school, classes, castingTime, range, components, duration, targeting, effects).
  - Checks effects contain BaseEffect fields (`trigger`, `condition`) and that enums are casing-consistent for castingTime.unit and effect.type.

## How to run

```bash
npx tsx tests/pipeline/spell-data-smoke.ts
```

## What this is (and is not)

- ✅ Fast smoke for data format hygiene on migrated spells.
- ✅ Catches obvious enum casing errors and missing BaseEffect fields.
- ❌ Does not replace `npm run validate:spells` (schema validation).
- ❌ Does not exercise UI flows (creator/sheet/combat); use `docs/spells/SPELL_INTEGRATION_CHECKLIST.md` for that.
