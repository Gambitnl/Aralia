# Level 1 Spell Migration - Batch 12

**Scope**: Validate/confirm structured schema coverage for the next five Level 1 spells, glossary, and manifest. Ensure no legacy flat copies remain.

## Spells in this batch
- sanctuary
- searing-smite
- shield
- shield-of-faith
- silent-image

## Execution Steps
1. Confirm each spell lives at `public/data/spells/level-1/{id}.json` with structured schema (ritual field, `castingTime.combatCost.type`, plural `validTargets`, save/attack conditions on effects).
2. Ensure glossary entries in `public/data/glossary/entries/spells/{id}.md` match IDs/names and include `level 1` tag.
3. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
4. Log outcomes and any gaps.

## Per-Spell Checklist
- sanctuary: Data ✅ / Validation ✅ / Integration ✅ (warded creature; attackers must save or choose new target; ends on attack/spell)
- searing-smite: Data ✅ / Validation ✅ / Integration ✅ (bonus action; next melee hit adds fire + ongoing save to end flames; concentration)
- shield: Data ✅ / Validation ✅ / Integration ✅ (reaction when hit/targeted; +5 AC until start of next turn; blocks magic missile)
- shield-of-faith: Data ✅ / Validation ✅ / Integration ✅ (+2 AC, concentration 10 min, bonus action)
- silent-image: Data ✅ / Validation ✅ / Integration ✅ (15-foot cube illusion; action to move/alter; Investigation check to discern)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
