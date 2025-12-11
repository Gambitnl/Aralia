# Level 1 Spell Migration - Batch 4

**Scope**: Validate/confirm structured schema coverage for the next five Level 1 spells, glossary, and manifest. Ensure no legacy flat copies remain.

## Spells in this batch
- command
- compelled-duel
- comprehend-languages
- create-or-destroy-water
- cure-wounds

## Execution Steps
1. Confirm each spell lives at `public/data/spells/level-1/{id}.json` with structured schema (ritual field, `castingTime.combatCost.type`, plural `validTargets`, save/attack conditions on effects).
2. Ensure glossary entries in `public/data/glossary/entries/spells/{id}.md` match IDs/names and include `level 1` tag.
3. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
4. Log outcomes and any gaps.

## Per-Spell Checklist
- command: Data ✅ / Validation ✅ / Integration ✅ (notes: one-word control options, Wis save, scaling +1 target per slot)
- compelled-duel: Data ✅ / Validation ✅ / Integration ✅ (notes: taunt with leash/break conditions; concentration 1 min)
- comprehend-languages: Data ✅ / Validation ✅ / Integration ✅ (notes: ritual; 1-hour self info utility; exploration read cost captured)
- create-or-destroy-water: Data ✅ / Validation ✅ / Integration ✅ (notes: create/destroy water or fog; AoE cube; scaling gallons/size by slot)
- cure-wounds: Data ✅ / Validation ✅ / Integration ✅ (notes: touch heal 2d8+mod; scaling +2d8 per slot)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
