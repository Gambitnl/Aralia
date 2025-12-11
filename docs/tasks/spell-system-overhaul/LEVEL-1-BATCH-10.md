# Level 1 Spell Migration - Batch 10

**Scope**: Validate/confirm structured schema coverage for the next five Level 1 spells, glossary, and manifest. Ensure no legacy flat copies remain.

## Spells in this batch
- identify
- illusory-script
- inflict-wounds
- jump
- longstrider

## Execution Steps
1. Confirm each spell lives at `public/data/spells/level-1/{id}.json` with structured schema (ritual field, `castingTime.combatCost.type`, plural `validTargets`, save/attack conditions on effects).
2. Ensure glossary entries in `public/data/glossary/entries/spells/{id}.md` match IDs/names and include `level 1` tag.
3. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
4. Log outcomes and any gaps.

## Per-Spell Checklist
- identify: Data ✅ / Validation ✅ / Integration ✅ (ritual; 1-minute cast; learn properties/charges/attunement)
- illusory-script: Data ✅ / Validation ✅ / Integration ✅ (ritual; hidden message readable by chosen readers; duration)
- inflict-wounds: Data ✅ / Validation ✅ / Integration ✅ (melee spell attack 3d10 necrotic; scaling +1d10)
- jump: Data ✅ / Validation ✅ / Integration ✅ (triples jump distance; concentration 1 min)
- longstrider: Data ✅ / Validation ✅ / Integration ✅ (+10 speed; scaling +1 target per slot; no concentration)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
