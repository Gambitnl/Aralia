# Level 2 Spell Migration - Batch 4

**Scope**: Migrate/update the next ten Level 2 spells to the structured schema, glossary, and manifest. Remove flat roots, ensure glossary coverage with level tags, and keep validator/integrity scripts green.

## Spells in this batch
- gust-of-wind
- heat-metal
- hold-person
- invisibility
- knock
- lesser-restoration
- levitate
- locate-animals-or-plants
- locate-object
- magic-mouth

## Execution Steps
1. Migrate each spell to `public/data/spells/level-2/{id}.json` (remove any flat copy).
2. Ensure required fields: `ritual` present, `castingTime.combatCost.type` present, enums/casing correct, every effect has `trigger` + `condition`, `validTargets` plural.
3. Add/update glossary entry `public/data/glossary/entries/spells/{id}.md` with matching ID/name + level tag.
4. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
5. Log results and any gaps.

## Per-Spell Checklist
- gust-of-wind: Data ✅ / Validation ✅ / Integration ✅ (line push, dispel gas/flames; concentration)
- heat-metal: Data ✅ / Validation ✅ / Integration ✅ (repeatable bonus-action damage, Con save to drop or suffer disadvantage; scaling +1d8)
- hold-person: Data ✅ / Validation ✅ / Integration ✅ (Wis save paralysis with repeat; scaling +1 target)
- invisibility: Data ✅ / Validation ✅ / Integration ✅ (touch invisibility ends on attack/spell; scaling +1 target)
- knock: Data ✅ / Validation ✅ / Integration ✅ (unlock/suppress Arcane Lock; audible)
- lesser-restoration: Data ✅ / Validation ✅ / Integration ✅ (end disease or blind/deaf/paralyzed/poisoned)
- levitate: Data ✅ / Validation ✅ / Integration ✅ (vertical suspend/move 20 ft; Con save negates for unwilling)
- locate-animals-or-plants: Data ✅ / Validation ✅ / Integration ✅ (ritual; nearest kind within 5 miles)
- locate-object: Data ✅ / Validation ✅ / Integration ✅ (sense familiar object within 1,000 ft unless lead blocks)
- magic-mouth: Data ✅ / Validation ✅ / Integration ✅ (triggered spoken message; consumes jade dust)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
