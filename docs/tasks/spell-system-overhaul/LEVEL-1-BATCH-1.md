# Level 1 Spell Migration - Batch 1

**Scope**: Migrate/update the first five Level 1 spells to the structured schema, glossary, and manifest. Level-1 paths only; follow current validator rules.

## Spells in this batch
- alarm
- animal-friendship
- armor-of-agathys
- arms-of-hadar
- bane

## Execution Steps
1. Migrate each spell to `public/data/spells/level-1/{id}.json` (remove any flat copy).
2. Ensure required fields: `ritual` present, `castingTime.combatCost.type` present, enums/casing correct, every effect has `trigger` + `condition`, `validTargets` plural.
3. Add/update glossary entry `public/data/glossary/entries/spells/{id}.md` with matching ID/name + level tag.
4. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
5. Log results and any gaps.

## Per-Spell Checklist
- alarm: Data ✅ / Validation ✅ / Integration ✅ (notes: minute cast with exploration cost; mental/audible alarm)
- animal-friendship: Data ✅ / Validation ✅ / Integration ✅ (notes: Beast-only charmed; scaling targets by slot)
- armor-of-agathys: Data ✅ / Validation ✅ / Integration ✅ (notes: Temp HP + reactive cold damage scale with slot)
- arms-of-hadar: Data ✅ / Validation ✅ / Integration ✅ (notes: AoE necrotic; reaction suppression on failed save)
- bane: Data ✅ / Validation ✅ / Integration ✅ (notes: Bane condition applied on failed Charisma save; scaling targets)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
