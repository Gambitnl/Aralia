# Level 1 Spell Migration - Batch 5

**Scope**: Validate/confirm structured schema coverage for the next five Level 1 spells, glossary, and manifest. Ensure no legacy flat copies remain.

## Spells in this batch
- detect-evil-and-good
- detect-magic
- detect-poison-and-disease
- disguise-self
- dissonant-whispers

## Execution Steps
1. Confirm each spell lives at `public/data/spells/level-1/{id}.json` with structured schema (ritual field, `castingTime.combatCost.type`, plural `validTargets`, save/attack conditions on effects).
2. Ensure glossary entries in `public/data/glossary/entries/spells/{id}.md` match IDs/names and include `level 1` tag.
3. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
4. Log outcomes and any gaps.

## Per-Spell Checklist
- detect-evil-and-good: Data ✅ / Validation ✅ / Integration ✅ (notes: 30 ft sensory for creature types/Hallow; blocked by common materials)
- detect-magic: Data ✅ / Validation ✅ / Integration ✅ (notes: ritual option; Magic action to read auras; blocked by common materials)
- detect-poison-and-disease: Data ✅ / Validation ✅ / Integration ✅ (notes: now marked ritual; material yew leaf; 30 ft sensory)
- disguise-self: Data ✅ / Validation ✅ / Integration ✅ (notes: appearance illusion with Investigation check via Study; non-concentration)
- dissonant-whispers: Data ✅ / Validation ✅ / Integration ✅ (notes: Wis save half; on fail forced movement away using reaction; scaling +1d6 per slot)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
