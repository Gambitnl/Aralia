# Level 1 Spell Migration - Batch 14

**Scope**: Validate/confirm structured schema coverage for the final Level 1 spells, glossary, and manifest. Ensure no legacy flat copies remain.

## Spells in this batch
- thunderous-smite
- thunderwave
- unseen-servant
- witch-bolt
- wrathful-smite

## Execution Steps
1. Confirm each spell lives at `public/data/spells/level-1/{id}.json` with structured schema (ritual field, `castingTime.combatCost.type`, plural `validTargets`, save/attack conditions on effects).
2. Ensure glossary entries in `public/data/glossary/entries/spells/{id}.md` match IDs/names and include `level 1` tag.
3. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
4. Log outcomes and any gaps.

## Per-Spell Checklist
- thunderous-smite: Data ✅ / Validation ✅ / Integration ✅ (next melee hit thunder damage + STR save push/prone; concentration)
- thunderwave: Data ✅ / Validation ✅ / Integration ✅ (15-foot cube Con save half; push on fail; audible boom)
- unseen-servant: Data ✅ / Validation ✅ / Integration ✅ (ritual; invisible force with simple tasks; 1-hour duration)
- witch-bolt: Data ✅ / Validation ✅ / Integration ✅ (ranged spell attack lightning beam; action to deal 1d12 each turn while concentrating; scaling +1d12)
- wrathful-smite: Data ✅ / Validation ✅ / Integration ✅ (bonus action; next melee hit psychic + frightened save; bonus action to repeat save)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
