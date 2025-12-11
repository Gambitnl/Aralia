# Level 1 Spell Migration - Batch 13

**Scope**: Validate/confirm structured schema coverage for the next five Level 1 spells, glossary, and manifest. Ensure no legacy flat copies remain.

## Spells in this batch
- sleep
- speak-with-animals
- tashas-caustic-brew
- tashas-hideous-laughter
- tensers-floating-disk

## Execution Steps
1. Confirm each spell lives at `public/data/spells/level-1/{id}.json` with structured schema (ritual field, `castingTime.combatCost.type`, plural `validTargets`, save/attack conditions on effects).
2. Ensure glossary entries in `public/data/glossary/entries/spells/{id}.md` match IDs/names and include `level 1` tag.
3. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
4. Log outcomes and any gaps.

## Per-Spell Checklist
- sleep: Data ✅ / Validation ✅ / Integration ✅ (HP-pool sleep, ascending HP order; scaling +2d8)
- speak-with-animals: Data ✅ / Validation ✅ / Integration ✅ (ritual; communicate/simple questions with beasts)
- tashas-caustic-brew: Data ✅ / Validation ✅ / Integration ✅ (line acid, Dex save; ongoing start-of-turn damage until washed; scaling +1d4)
- tashas-hideous-laughter: Data ✅ / Validation ✅ / Integration ✅ (Wis save or prone/incapacitated; repeat saves; immune if Int<4)
- tensers-floating-disk: Data ✅ / Validation ✅ / Integration ✅ (ritual; 3-ft disk carries 500 lb, follows caster)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
