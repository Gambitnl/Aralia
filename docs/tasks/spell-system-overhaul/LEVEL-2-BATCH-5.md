# Level 2 Spell Migration - Batch 5

**Scope**: Migrate/update the next ten Level 2 spells to the structured schema, glossary, and manifest. Remove flat roots, ensure glossary coverage with level tags, and keep validator/integrity scripts green.

## Spells in this batch
- magic-weapon
- melfs-acid-arrow
- mind-spike
- misty-step
- moonbeam
- pass-without-trace
- phantasmal-force
- prayer-of-healing
- protection-from-poison
- pyrotechnics

## Execution Steps
1. Migrate each spell to `public/data/spells/level-2/{id}.json` (remove any flat copy).
2. Ensure required fields: `ritual` present, `castingTime.combatCost.type` present, enums/casing correct, every effect has `trigger` + `condition`, `validTargets` plural.
3. Add/update glossary entry `public/data/glossary/entries/spells/{id}.md` with matching ID/name + level tag.
4. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
5. Log results and any gaps.

## Per-Spell Checklist
- magic-weapon: Data ✅ / Validation ✅ / Integration ✅ (touch weapon +1, scaling +2 at slot 4, +3 at slot 6; concentration)
- melfs-acid-arrow: Data ✅ / Validation ✅ / Integration ✅ (ranged attack 4d4 acid + 2d4 delayed; miss = half initial; both scale +1d4)
- mind-spike: Data ✅ / Validation ✅ / Integration ✅ (Wis save half 3d8 psychic; on fail track location for 1 hour; scaling +1d8)
- misty-step: Data ✅ / Validation ✅ / Integration ✅ (bonus action 30-ft teleport)
- moonbeam: Data ✅ / Validation ✅ / Integration ✅ (5-ft radius cylinder Con save 2d10 radiant; shapechanger disadvantage; scaling +1d10)
- pass-without-trace: Data ✅ / Validation ✅ / Integration ✅ (+10 Stealth aura 30 ft; no tracking except magic; concentration)
- phantasmal-force: Data ✅ / Validation ✅ / Integration ✅ (Int save or illusory 10-ft cube; can deal 1d6 psychic per turn; Investigation ends)
- prayer-of-healing: Data ✅ / Validation ✅ / Integration ✅ (10-minute cast; up to 6 targets heal 2d8+mod; scales +1d8)
- protection-from-poison: Data ✅ / Validation ✅ / Integration ✅ (neutralize one poison; adv on saves vs poison; resistance for 1 hour)
- pyrotechnics: Data ✅ / Validation ✅ / Integration ✅ (transform 5-ft flame into fireworks blind or smoke obscure)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
-, `npm run validate`
-, `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
