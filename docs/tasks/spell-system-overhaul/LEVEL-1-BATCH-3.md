# Level 1 Spell Migration - Batch 3

**Scope**: Migrate remaining Level 1 root spells to the structured schema, glossary, and manifest. Remove flat copies, ensure glossary coverage with level tags, and keep validator/integrity scripts green.

## Spells in this batch
- absorb-elements
- catapult
- snare

## Execution Steps
1. Move each spell to `public/data/spells/level-1/{id}.json` using the structured schema; delete flat copies in `public/data/spells/`.
2. Ensure required fields: `ritual`, `castingTime.combatCost.type`, plural `validTargets`, save/attack conditions on effects, and level tags in glossary cards.
3. Add/update glossary entries in `public/data/glossary/entries/spells/{id}.md` with matching IDs, names, and `level 1` tags.
4. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
5. Log outcomes and any gaps.

## Per-Spell Checklist
- absorb-elements: Data ✅ / Validation ✅ / Integration ✅ (notes: reaction on elemental damage; grants resistance 1 round and adds extra 1d6 stored damage on next melee hit; scaling +1d6 per slot)
- catapult: Data ✅ / Validation ✅ / Integration ✅ (notes: 1–5 lb unattended object hurled 90 ft; Dex save or 3d8 bludgeoning; scaling +1d8 per slot)
- snare: Data ✅ / Validation ✅ / Integration ✅ (notes: 1-minute cast consuming rope; 5-foot trap Dex save or Restrained with action to escape; disarm via Dex check vs save DC; lasts 8 hours)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
