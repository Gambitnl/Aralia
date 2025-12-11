# Level 2 Spell Migration - Batch 1

**Scope**: Migrate the first five Level 2 spells to the structured schema, glossary, and manifest. Remove flat roots, ensure glossary coverage with level tags, and keep validator/integrity scripts green.

## Spells in this batch
- aid
- alter-self
- animal-messenger
- arcane-lock
- augury

## Execution Steps
1. Migrate each spell to `public/data/spells/level-2/{id}.json` (remove any flat copy).
2. Ensure required fields: `ritual` present, `castingTime.combatCost.type` present, enums/casing correct, every effect has `trigger` + `condition`, `validTargets` plural.
3. Add/update glossary entry `public/data/glossary/entries/spells/{id}.md` with matching ID/name + level tag.
4. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
5. Log results and any gaps.

## Per-Spell Checklist
- aid: Data ✅ / Validation ✅ / Integration ✅ (notes: +5 max/current HP to up to 3 targets; scaling +5 per slot)
- alter-self: Data ✅ / Validation ✅ / Integration ✅ (notes: appearance/weapon/aquatic options; concentration 1 hour)
- animal-messenger: Data ✅ / Validation ✅ / Integration ✅ (notes: ritual; Tiny beast courier 25–50 miles; duration scaling)
- arcane-lock: Data ✅ / Validation ✅ / Integration ✅ (notes: +10 DC lock with password/creature exceptions; 25 gp gold dust consumed)
- augury: Data ✅ / Validation ✅ / Integration ✅ (notes: ritual; omen about action within 30 minutes; 25 gp tokens consumed)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
