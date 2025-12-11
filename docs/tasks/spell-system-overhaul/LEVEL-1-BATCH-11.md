# Level 1 Spell Migration - Batch 11

**Scope**: Validate/confirm structured schema coverage for the next five Level 1 spells, glossary, and manifest. Ensure no legacy flat copies remain.

## Spells in this batch
- mage-armor
- magic-missile
- protection-from-evil-and-good
- purify-food-and-drink
- ray-of-sickness

## Execution Steps
1. Confirm each spell lives at `public/data/spells/level-1/{id}.json` with structured schema (ritual field, `castingTime.combatCost.type`, plural `validTargets`, save/attack conditions on effects).
2. Ensure glossary entries in `public/data/glossary/entries/spells/{id}.md` match IDs/names and include `level 1` tag.
3. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
4. Log outcomes and any gaps.

## Per-Spell Checklist
- mage-armor: Data ✅ / Validation ✅ / Integration ✅ (set base AC 13 + Dex; 8-hour duration)
- magic-missile: Data ✅ / Validation ✅ / Integration ✅ (auto-hit force darts; scaling +1 dart per slot)
- protection-from-evil-and-good: Data ✅ / Validation ✅ / Integration ✅ (ward vs six creature types; disadvantage on attacks; charm/fear/possess advantage; concentration)
- purify-food-and-drink: Data ✅ / Validation ✅ / Integration ✅ (ritual; cleanses 5-foot radius consumables/fluids)
- ray-of-sickness: Data ✅ / Validation ✅ / Integration ✅ (ranged spell attack poison damage; Con save or poisoned; scaling +1d8)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
