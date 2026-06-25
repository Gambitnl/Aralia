# Spell System Overhaul Architecture Note

Status: active
Last updated: 2026-05-31

## Architecture Boundaries

- Validation and schema: `src/systems/spells/validation/*`, `src/systems/spells/schema/spell.schema.json`, `src/types/spells.ts`
- Runtime command surface: `src/commands/factory/SpellCommandFactory.ts`
- Spell-to-ability bridge: `src/utils/character/spellAbilityFactory.ts`, `src/hooks/useAbilitySystem.ts`
- Data loading paths:
  - eager bundle path: `src/context/SpellContext.tsx` -> `public/data/spells_bundle.json`
  - manifest + lazy path: `src/services/SpellService.ts` -> `public/data/spells_manifest.json` + `public/data/spells`
- Targeting/effects runtime: `src/systems/spells/targeting/*`, `src/systems/spells/effects/*`

## Evidence Pointers

- `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`
- `docs/architecture/SPELL_SYSTEM_ARCHITECTURE.md`
- `docs/spells/STATUS_LEVEL_0.md` etc.
- `docs/tasks/spell-system-overhaul/1A-PROJECT-MASTER-SPRINGBOARD.md`
- `docs/projects/spells/subprojects/targeting-object-area/GAPS.md`
- `docs/tasks/spell-system-overhaul/gaps/GAP-CHOICE-SPELLS.md`
- `docs/tasks/spell-system-overhaul/gaps/GAP-UNSPLIT-SPELL-EFFECTS.md`

## Contract Seams to Preserve

- The data model and command runtime are currently hybrid; treat this as intended unless a slice has explicit migration acceptance criteria.
- Gaps in object targeting, area logic, and choice/utility typing are currently implementation-critical and should remain open unless this slice explicitly absorbs them.
- Do not remove split execution paths until a coordinator strategy has proof-based acceptance criteria.
