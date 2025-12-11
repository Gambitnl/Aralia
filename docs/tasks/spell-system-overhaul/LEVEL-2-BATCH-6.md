# Level 2 Spell Migration - Batch 6

**Scope**: Migrate/update the next ten Level 2 spells to the structured schema, glossary, and manifest. Remove flat roots, ensure glossary coverage with level tags, and keep validator/integrity scripts green.

## Spells in this batch
- ray-of-enfeeblement
- rope-trick
- scorching-ray
- see-invisibility
- shatter
- silence
- skywrite
- spider-climb
- spike-growth
- spiritual-weapon

## Execution Steps
1. Migrate each spell to `public/data/spells/level-2/{id}.json` (remove any flat copy).
2. Ensure required fields: `ritual` present, `castingTime.combatCost.type` present, enums/casing correct, every effect has `trigger` + `condition`, `validTargets` plural.
3. Add/update glossary entry `public/data/glossary/entries/spells/{id}.md` with matching ID/name + level tag.
4. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
5. Log results and any gaps.

## Per-Spell Checklist
- ray-of-enfeeblement: Data ✅ / Validation ✅ / Integration ✅ (Str-weapon damage halved on hit; Con save end)
- rope-trick: Data ✅ / Validation ✅ / Integration ✅ (extradimensional space via rope; holds 8 Medium)
- scorching-ray: Data ✅ / Validation ✅ / Integration ✅ (3 rays at 2d6 fire; +1 ray per slot level)
- see-invisibility: Data ✅ / Validation ✅ / Integration ✅ (see invisibility + Ethereal for 1 hour)
- shatter: Data ✅ / Validation ✅ / Integration ✅ (10-ft sphere Con save 3d8 thunder; inorganic disadvantage; objects take damage)
- silence: Data ✅ / Validation ✅ / Integration ✅ (20-ft silence sphere; thunder immunity; prevents verbal casting; ritual)
- skywrite: Data ✅ / Validation ✅ / Integration ✅ (ritual cloud-words up to 10; 1 hour; dispersed by strong wind)
- spider-climb: Data ✅ / Validation ✅ / Integration ✅ (climb difficult surfaces/ceilings; climb speed = walk; concentration)
- spike-growth: Data ✅ / Validation ✅ / Integration ✅ (difficult terrain spikes; 2d4 per 5 ft moved; camouflaged; concentration)
- spiritual-weapon: Data ✅ / Validation ✅ / Integration ✅ (bonus action spectral weapon, 1d8+mod force; scaling every two slot levels)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
