# Level 1 Spell Migration - Batch 6

**Scope**: Validate/confirm structured schema coverage for the next five Level 1 spells, glossary, and manifest. Ensure no legacy flat copies remain.

## Spells in this batch
- divine-favor
- divine-smite
- ensnaring-strike
- entangle
- expeditious-retreat

## Execution Steps
1. Confirm each spell lives at `public/data/spells/level-1/{id}.json` with structured schema (ritual field, `castingTime.combatCost.type`, plural `validTargets`, save/attack conditions on effects).
2. Ensure glossary entries in `public/data/glossary/entries/spells/{id}.md` match IDs/names and include `level 1` tag.
3. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
4. Log outcomes and any gaps.

## Per-Spell Checklist
- divine-favor: Data ✅ / Validation ✅ / Integration ✅ (bonus action, radiant rider on weapon hits; concentration 1 min)
- divine-smite: Data ✅ / Validation ✅ / Integration ✅ (paladin-only slot burn on melee hit; radiant damage with undead/fiend rider)
- ensnaring-strike: Data ✅ / Validation ✅ / Integration ✅ (bonus action on-hit vines; restrain + start-of-turn damage; size-based advantage captured)
- entangle: Data ✅ / Validation ✅ / Integration ✅ (difficult terrain + restrain on failed STR; on-enter/on-end-turn saves)
- expeditious-retreat: Data ✅ / Validation ✅ / Integration ✅ (bonus-action cast; bonus-action Dash each turn while concentrating)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
