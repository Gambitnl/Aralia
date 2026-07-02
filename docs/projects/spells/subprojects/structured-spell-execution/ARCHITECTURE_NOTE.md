# Spell System Overhaul Architecture Note

Status: active (relocated 2026-07-01 from `docs/tasks/spell-system-overhaul/ARCHITECTURE_NOTE.md` into the structured-spell-execution lane)
Last updated: 2026-07-01

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
- `docs/projects/spells/NORTH_STAR.md`
- `docs/projects/spells/SUBPROJECTS.md`
- `docs/projects/spells/subprojects/targeting-object-area/GAPS.md`
- `docs/tasks/spell-system-overhaul/gaps/GAP-CHOICE-SPELLS.md`
- `docs/archive/spell-system/GAP-UNSPLIT-SPELL-EFFECTS.md` (closed and archived 2026-07-01)

## Contract Seams to Preserve

- The data model and command runtime are currently hybrid; treat this as intended unless a slice has explicit migration acceptance criteria.
- Object targeting now has a real spell-side seam: `src/systems/spells/targeting/ObjectTargetRegistry.ts` plus its focused test; remaining object-targeting work (live map objects, selection, command context, object stats) is tracked in `docs/projects/spells/subprojects/targeting-object-area/GAPS.md` G5. Area logic and choice/utility rendered-proof gaps remain open in their owning lane rows.
- The unsplit-effects gap is enforced closed: `expect(monolithicFailures).toHaveLength(0)` in `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` (~line 5368) hard-fails the corpus if a monolithic effect reappears; the `SpellEffect` union lives in `src/types/spellEffectTypes.ts`.
- Do not remove split execution paths until a coordinator strategy has proof-based acceptance criteria (tracked as structured-spell-execution-G3).

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-system-overhaul/ARCHITECTURE_NOTE.md","sha256WithoutMarker":"9402316d6e1e1962674ca4c2e1559a626ea466b8d365d561136acf9e66b81a3f","markedAtUtc":"2026-06-25T22:29:38.583Z"} -->
