# Level 1 Spell Migration - Batch 7

**Scope**: Validate/confirm structured schema coverage for the next five Level 1 spells, glossary, and manifest. Ensure no legacy flat copies remain.

## Spells in this batch
- faerie-fire
- false-life
- feather-fall
- find-familiar
- fog-cloud

## Execution Steps
1. Confirm each spell lives at `public/data/spells/level-1/{id}.json` with structured schema (ritual field, `castingTime.combatCost.type`, plural `validTargets`, save/attack conditions on effects).
2. Ensure glossary entries in `public/data/glossary/entries/spells/{id}.md` match IDs/names and include `level 1` tag.
3. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
4. Log outcomes and any gaps.

## Per-Spell Checklist
- faerie-fire: Data ✅ / Validation ✅ / Integration ✅ (20-foot cube, Dex save or outlined; grants advantage; concentration)
- false-life: Data ✅ / Validation ✅ / Integration ✅ (temp HP 1d4+4; scaling +5 HP per slot)
- feather-fall: Data ✅ / Validation ✅ / Integration ✅ (reaction on fall; up to 5 targets; descent slowed; no damage)
- find-familiar: Data ✅ / Validation ✅ / Integration ✅ (ritual; 1-hour cast; consumable materials; persistent familiar with form options)
- fog-cloud: Data ✅ / Validation ✅ / Integration ✅ (20-foot radius sphere heavy obscuration; scaling size by slot; concentration)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
