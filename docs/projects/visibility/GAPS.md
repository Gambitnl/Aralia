# Visibility System Gap Registry

Status: active
Last updated: 2026-05-31
Owner: Worker A
Parent tracker: `docs/projects/visibility/TRACKER.md`

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| V-G1 | active | in_scope_now | Worker A | `docs/projects/visibility/TRACKER.md` | Scope pass | Visibility outputs are not wired into map rendering, so hidden/visible tile filtering is not guaranteed in UI. | `src/hooks/combat/useVisibility.ts`; `rg -l -F "useVisibility" src/components src/hooks` | Without integration, the engine calculates visibility but does not enforce it in presentation. | Add a concrete rendering contract and consumption points in combat map surfaces. | One integration proof showing renderer consumes `visibleTiles` or equivalent. |
| V-G2 | not_started | support_needed_now | Worker A | `docs/projects/visibility/TRACKER.md` | Types/doc scan | Environment/visibility conversion remains implicit (`fog`, `lightly_obscured`, `heavily_obscured`, `magical_darkness`). | `src/types/environment.ts`, `src/types/combat.ts`, `src/systems/environment/EnvironmentSystem.ts`, `src/systems/underdark/UnderdarkMechanics.ts` | Gameplay can under-model weather and obscuration if no canonical mapping exists. | Define conversion rules and where they execute (visibility system, combat hooks, or environment system). | Add focused proof row when the first mapping is implemented. |
| V-G3 | not_started | support_needed_now | Worker A | `docs/projects/visibility/TRACKER.md` | Source scan | Deprecated LOS bridge still exists and may hide import drift. | `src/utils/lineOfSight.ts` + `src/utils/spatial/lineOfSight.ts` | Non-fatal now, but complicates migration and ownership boundaries. | Remove dependency bridge only after all callsites are migrated and tested. | Confirm no production import of bridge path. |
| V-G4 | not_started | adjacent_follow_up | Worker A | `docs/projects/visibility/TRACKER.md` | Source scan | Duplicate and inconsistent lighting checks exist across visibility and attack factories. | `src/hooks/combat/useTargetValidator.ts`, `src/commands/factory/AbilityCommandFactory.ts`, `src/systems/visibility/VisibilitySystem.ts` | Divergence can create inconsistent LOS or disadvantage outcomes in edge cases. | Add shared policy surface for "visibility effect for an attack" decision before behavior changes. | Align one test fixture across both paths and record parity in next tracker row. |
| V-G5 | not_started | adjacent_follow_up | Worker A | `docs/projects/GLOBAL_GAPS.md` | Design scan | Renderer-layer ownership may belong with combat-map project if it owns tile visibility display policy. | `src/components/BattleMap/*`, `docs/architecture/COMBAT_MAP_ENGINE.md` | Could widen visibility ownership incorrectly and duplicate UI contracts. | Route this ownership decision to the combat map subsystem before work starts. | Add routed decision with owner in `docs/projects/GLOBAL_GAPS.md` if confirmed. |
