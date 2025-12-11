# Level 1 Spell Migration - Batch 9

**Scope**: Validate/confirm structured schema coverage for the next five Level 1 spells, glossary, and manifest. Ensure no legacy flat copies remain.

## Spells in this batch
- hellish-rebuke
- heroism
- hex
- hunters-mark
- ice-knife

## Execution Steps
1. Confirm each spell lives at `public/data/spells/level-1/{id}.json` with structured schema (ritual field, `castingTime.combatCost.type`, plural `validTargets`, save/attack conditions on effects).
2. Ensure glossary entries in `public/data/glossary/entries/spells/{id}.md` match IDs/names and include `level 1` tag.
3. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
4. Log outcomes and any gaps.

## Per-Spell Checklist
- hellish-rebuke: Data ✅ / Validation ✅ / Integration ✅ (reaction when damaged; Dex save half; scaling +1d10)
- heroism: Data ✅ / Validation ✅ / Integration ✅ (no fear + temp HP each turn; concentration)
- hex: Data ✅ / Validation ✅ / Integration ✅ (bonus action curse; extra necrotic damage on hits; ability check disadvantage; scaling duration)
- hunters-mark: Data ✅ / Validation ✅ / Integration ✅ (bonus action mark; extra damage on weapon hits; advantage to track; scaling duration)
- ice-knife: Data ✅ / Validation ✅ / Integration ✅ (ranged spell attack pierce + AoE Dex save cold on shard burst; scaling +1d6 cold)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
