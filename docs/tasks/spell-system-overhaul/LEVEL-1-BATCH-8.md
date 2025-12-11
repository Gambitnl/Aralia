# Level 1 Spell Migration - Batch 8

**Scope**: Validate/confirm structured schema coverage for the next five Level 1 spells, glossary, and manifest. Ensure no legacy flat copies remain.

## Spells in this batch
- goodberry
- grease
- guiding-bolt
- hail-of-thorns
- healing-word

## Execution Steps
1. Confirm each spell lives at `public/data/spells/level-1/{id}.json` with structured schema (ritual field, `castingTime.combatCost.type`, plural `validTargets`, save/attack conditions on effects).
2. Ensure glossary entries in `public/data/glossary/entries/spells/{id}.md` match IDs/names and include `level 1` tag.
3. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
4. Log outcomes and any gaps.

## Per-Spell Checklist
- goodberry: Data ✅ / Validation ✅ / Integration ✅ (creates 10 berries; each heals 1 HP; 24h shelf)
- grease: Data ✅ / Validation ✅ / Integration ✅ (10-foot square difficult terrain; Dex save prone; on-enter saves)
- guiding-bolt: Data ✅ / Validation ✅ / Integration ✅ (ranged spell attack radiant damage; grants advantage on next attack; scaling +1d6)
- hail-of-thorns: Data ✅ / Validation ✅ / Integration ✅ (next ranged attack AoE burst Dex save half; scaling damage)
- healing-word: Data ✅ / Validation ✅ / Integration ✅ (bonus action ranged heal 1d4+mod; scaling +1d4)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
