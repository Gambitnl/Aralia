# Level 1 Spell Migration - Batch 2

**Scope**: Migrate/update the next five Level 1 spells to the structured schema, glossary, and manifest. Remove flat roots, ensure glossary coverage with level tags, and keep validator/integrity scripts green.

## Spells in this batch
- bless
- burning-hands
- charm-person
- chromatic-orb
- color-spray

## Execution Steps
1. Move each spell to `public/data/spells/level-1/{id}.json` using the structured schema; delete flat copies in `public/data/spells/`.
2. Ensure required fields: `ritual`, `castingTime.combatCost.type`, plural `validTargets`, save/attack conditions on effects, and level tags in glossary cards.
3. Add/update glossary entries in `public/data/glossary/entries/spells/{id}.md` with matching IDs, names, and `level 1` tags.
4. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
5. Log outcomes and any gaps.

## Per-Spell Checklist
- bless: Data ✅ / Validation ✅ / Integration ✅ (notes: multi-target +1d4 buff; scaling +1 target per slot)
- burning-hands: Data ✅ / Validation ✅ / Integration ✅ (notes: 15 ft cone Dex save for fire damage; ignites unattended objects)
- charm-person: Data ✅ / Validation ✅ / Integration ✅ (notes: Humanoid-only Wisdom save with advantage if fighting; charmed 1 hour; ends on harm, target knows afterward)
- chromatic-orb: Data ✅ / Validation ✅ / Integration ✅ (notes: ranged attack, 3d8 chosen damage type; material diamond 50 gp, scaling +1d8 per slot)
- color-spray: Data ✅ / Validation ✅ / Integration ✅ (notes: HP-pool targeting captured in control note; blinds affected creatures for 1 round; scaling +2d10 pool per slot)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
