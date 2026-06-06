# Visibility System Living Tracker

Status: active
Last updated: 2026-06-05
Owning docs: `NORTH_STAR.md`, `GAPS.md`

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| V-1 | done | Replace placeholder visibility docs with concrete project context and evidence links. | Worker A | 2026-05-31 | `docs/projects/visibility/NORTH_STAR.md` | Keep tracker/gap table current. | Confirm only visibility docs changed. |
| V-2 | active | Verify renderer integration evidence and classify non-local gaps for routing. | Worker A | 2026-05-31 | `src/hooks/combat/useVisibility.ts`, `src/hooks/combat/useTargetValidator.ts`, `src/commands/factory/AbilityCommandFactory.ts` | Add/confirm non-local gap if environment or renderer ownership requires routing. | Re-run `rg -l -F \"useVisibility\" src/components src/hooks` and validate that result remains no production consumer. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| V-G1 | active | in_scope_now | Worker A | `docs/projects/visibility/GAPS.md` | Visibility scan | `useVisibility` is not currently consumed by map rendering components for hidden-tile masking. | `src/hooks/combat/useVisibility.ts`, `src/hooks/combat/__tests__/useVisibility.test.ts`, `rg -l -F \"useVisibility\" src/components src/hooks` | Player-visible obscuration and tile reveal behavior can remain inconsistent with current engine math. | Add a concrete renderer wiring row in next implementation pass. | Show one component import path that consumes `visibleTiles`/`getLightLevel`. |
| V-G2 | not_started | support_needed_now | Worker A | `docs/projects/visibility/GAPS.md` | Type/doc scan | Environment and weather visibility states are not mapped into visibility tiers. | `src/types/environment.ts`, `src/types/combat.ts`, `docs/architecture/domains/environment-physics.md` | Obscuration rules cannot be applied consistently without bridge mapping. | Define conversion policy for fog and heavily obscured conditions. | Add test-backed translation rule for at least one environment-to-visibility path. |
| V-G3 | not_started | support_needed_now | Worker A | `docs/projects/visibility/GAPS.md` | Source scan | `src/utils/lineOfSight.ts` is still a compatibility bridge with TODO intent. | `src/utils/lineOfSight.ts`, `src/utils/spatial/lineOfSight.ts` | Split imports create import fragmentation and block clean dependency contracts. | Decide migration owner for all LOS imports and remove bridge after completion. | Confirm no non-visibility modules still rely on the bridge path. |
| V-G4 | not_started | adjacent_follow_up | Worker A | `docs/projects/visibility/GAPS.md` | Source scan | Lighting/disadvantage logic exists both in `useTargetValidator` LOS checks and in `AbilityCommandFactory` attack math. | `src/hooks/combat/useTargetValidator.ts`, `src/commands/factory/AbilityCommandFactory.ts`, `src/systems/visibility/VisibilitySystem.ts` | Duplicate or diverging rules can drift and produce inconsistent targeting outcomes. | Normalize visibility effect ownership behind `VisibilitySystem` first. | Add one comparison test that documents parity across both paths. |

## Update Rules

- Update this tracker before each new visibility slice.
- Every active, waiting, or blocked row must include owner, last updated date, next proof/check.
- In-scope gaps live in `GAPS.md`; cross-project discoveries should be moved to
  `docs/projects/GLOBAL_GAPS.md` first.
- Do not broaden this project by absorbing unrelated engine concerns.
