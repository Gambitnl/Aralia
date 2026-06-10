---
schema_version: 1
project: Visibility
slug: visibility
category: active project
main_category: "Game & Simulation"
subcategory: "World, Travel & Maps"
status: active
last_updated: 2026-06-05
confidence: unknown
evidence: "docs/projects/visibility/TRACKER.md; docs/projects/visibility/GAPS.md"
gap_signal: present
protocol: living-project
next_step: Resume from TRACKER.md and keep the gap log aligned.
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - docs consistency
completed_verification:
  - docs refresh
last_proof: 2026-06-05
workflow_gaps_reviewed: ""
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Visibility System North Star

Status: active
Last updated: 2026-06-05
Owner: Worker A
Evidence seed: `docs/projects/PROJECT_TRACKER.md` row for `Visibility System`

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Visibility |
| Slug | visibility |
| Category | active project |
| Status | active |
| Confidence | unknown |
| Evidence | docs/projects/visibility/TRACKER.md; docs/projects/visibility/GAPS.md |
| Gap signal | present |
| Protocol | living-project |
| Next step | Resume from TRACKER.md and keep the gap log aligned. |
| Required verification | docs consistency |
| Completed verification | docs refresh |
| Last proof | 2026-06-05 docs refresh |
| Workflow gaps reviewed | yes |

## Why This Project Exists

Visibility is a live but partially wired subsystem for light and line-of-sight
decisions in combat maps. The project protects what is already implemented,
what is not yet wired into rendering, and what is missing in the integration
chain.

## Intended Outcome

Create a durable handoff for current visibility behavior so later workers can
continue with minimal rediscovery and clear boundaries.

## Current State

- Implementation exists in `src/systems/visibility`.
- A public hook exists under `src/hooks/combat/useVisibility.ts`.
- LOS primitives are used by combat targeting and by legacy bridge exports.
- A major integration gap remains between visibility computation and map tile
  rendering/visibility masking in UI surfaces.

## Concrete File Map

| File | Role |
|---|---|
| `src/systems/visibility/VisibilitySystem.ts` | Core visibility engine with static `calculateLightLevels` and `calculateVisibility`. |
| `src/systems/visibility/VisibilitySystem.test.ts` | Unit tests for light propagation, dark/light transitions, and wall blocking. |
| `src/systems/visibility/index.ts` | Barrel export for the system. |
| `src/hooks/combat/useVisibility.ts` | Adapter hook for memoized light level calculation + visible tile set. |
| `src/hooks/combat/__tests__/useVisibility.test.ts` | Hook behavior tests (`visibleTiles`, fallback with missing map data). |
| `src/hooks/combat/useTargetValidator.ts` | Attack/spell target validation with line-of-sight checks for attack and spell abilities. |
| `src/utils/spatial/lineOfSight.ts` | Canonical Bresenham line and `hasLineOfSight` helper. |
| `src/utils/lineOfSight.ts` | Deprecated bridge re-exporting the spatial utility. |
| `src/commands/factory/AbilityCommandFactory.ts` | Uses visibility light tiers for lighting-based darkness disadvantage in combat attacks. |
| `src/types/combat.ts` | Types for `LightLevel`, `LightSource`, `BattleMapTile`, `BattleMapData`, and combat character senses. |
| `src/types/core.ts` | `CharacterSenses` fields (`darkvision`, `blindsight`, etc.) used by visibility checks. |
| `src/types/environment.ts` | `VisibilityLevel` and environmental obscuration fields that are not yet fully bridged to visibility math. |
| `docs/architecture/VISIBILITY_SYSTEM.md` | Existing integration guide with current drift notes. |
| `docs/architecture/domains/environment-physics.md` | Domain context and adjacent systems map including visibility as integration lane. |

## Implemented State (Evidence-Backed)

- `VisibilitySystem.calculateLightLevels(mapData, lightSources)` initializes all tiles to
  `darkness`, applies bright/dim tiers in feet-to-grid conversion (`5ft` per tile),
  and blocks propagation with `isLineBlocked`.
- `VisibilitySystem.calculateVisibility(observer, mapData, lightLevels)` applies:
  - blindsight override (visible radius),
  - LOS check via the same blocking logic,
  - light-level tier rules (`bright`, `dim`, `darkness`, `magical_darkness`),
  - darkvision conversion from feet to tile units.
- `useVisibility` returns:
  - `lightLevels` map,
  - `visibleTiles` set of non-hidden tile IDs,
  - `canSeeTile` helper,
  - `getLightLevel`.
- `useVisibility` uses ambient shortcut logic by map theme:
  - `cave`/`dungeon`: dark default and calculate per-source illumination
  - other themes: treated as bright baseline for current short-term performance path.
- `useTargetValidator` enforces LOS through `hasLineOfSight` for attack/spell target
  validation before command execution.
- `AbilityCommandFactory` applies lighting-based attack disadvantage when target tile
  is in `darkness` or `magical_darkness` on cave/dungeon maps and the attacker lacks
  sufficient darkvision/blindsight range.
- LOS unit coverage exists in `src/utils/spatial/__tests__/lineOfSight.test.ts`.

## Integration Points

- Targeting path: `useAbilitySystem` delegates validation to `useTargetValidator`,
  which uses `hasLineOfSight` from spatial LoS.
- Visibility path for combat command penalties: `AbilityCommandFactory` reads current
  `activeLightSources` and recomputes light levels.
- UI surface gap: no current production component import path under `src/components`
  was found for `useVisibility` outputs (`visibleTiles`, `lightLevels`, or
  `getLightLevel`) in this scan.
- Terrain/visibility type boundary: `Weather/Environment` visibility levels and
  concealment fields are present but not currently converted into `LightLevel` tiers
  in a shared policy layer.

## Active Task

| Field | Value |
|---|---|
| Task | Replace scaffolded Visibility docs with concrete system state, ownership boundaries, and evidence-backed gaps. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` include concrete file map, implemented state, integration points, and next checks. |
| Allowed boundaries | `docs/projects/visibility/*` only. |
| Stop condition | No non-doc source edits; no additional project folders modified. |
| Verification | `rg -l -F \"VisibilitySystem|useVisibility|hasLineOfSight|magical_darkness\" src` and file-level references in tracker/gap docs. |
| Owner | Worker A |
| Next action | Keep gap registry aligned to current evidence, then route non-local global gaps if any are discovered. |

## Scope Boundaries

In scope:
- Visibility-facing implementation and direct callsites around combat LOS/target checks.
- Light/sense model evidence and current tests.
- Project docs that preserve this slice for cold-start continuity.

Adjacent but not in this slice:
- Refactoring combat UI to consume visibility output.
- Full environmental visibility semantics (weather, fog density, concealment) across all domains.
- Performance rewrites of LOS algorithm or light propagation.

Out of scope:
- Changing gameplay behavior in source code.
- Non-targeted cleanup in unrelated movement/pathfinding systems.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| `useVisibility` outputs are not consumed by map rendering surfaces in this repo slice, so fog-of-war and hidden tile masking are not guaranteed to be user-facing. | in_scope_now | Worker A | `src/hooks/combat/useVisibility.ts`, `rg -l -F \"useVisibility\" src/components src/hooks` | Confirm current renderer contract in a follow-up and add rendering mapping doc slice before gameplay refactor. |
| Visibility system uses legacy `visibility` and `environment` abstractions inconsistently (`magical_darkness`, `fog`, `lightly_obscured`, `heavily_obscured`) without a unified mapping layer. | support_needed_now | Worker A | `src/types/combat.ts`, `src/types/environment.ts`, `docs/architecture/VISIBILITY_SYSTEM.md` | Define map conversion rules between environment/LoS tiers and light tiers in next implementation slice. |
| Attack LOS and visibility logic are duplicated across `useTargetValidator` and `AbilityCommandFactory` with slight rule differences. | adjacent_follow_up | Worker A | `src/hooks/combat/useTargetValidator.ts`, `src/commands/factory/AbilityCommandFactory.ts`, `src/systems/visibility/VisibilitySystem.ts` | Align first-party rule owner and avoid duplicated light/disadvantage calculations. |
| Deprecated `src/utils/lineOfSight.ts` bridge remains with TODO intent but no migration proof into a single import contract. | support_needed_now | Worker A | `src/utils/lineOfSight.ts`, `src/utils/spatial/lineOfSight.ts` | Add explicit deprecation completion check when any remaining callers are migrated. |

## Global Gap Imports

Check the global gap tracker before creating new scope:
`docs/projects/GLOBAL_GAPS.md`.

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | No cross-project gap has been classified into scope yet. |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Visibility implementation API | Core light tier and visibility calculations exist in `VisibilitySystem.ts`. | `src/systems/visibility/VisibilitySystem.ts` |
| Validation path | LOS-based target validation is active for attacks and spells. | `src/hooks/combat/useTargetValidator.ts` |
| Light command interaction | Lighting affects attack disadvantage in dark map themes. | `src/commands/factory/AbilityCommandFactory.ts` |
| Registry row | Project is explicitly owned and high-priority in tracker. | `docs/projects/PROJECT_TRACKER.md` |
| Renderer wiring check | Current scan shows no component usage of `useVisibility` outputs. | `rg -l -F \"useVisibility\" src/components src/hooks` |

## Artifact Boundary

Keep durable items here: project scope, evidence anchors, gap decisions, next checks.
Do not archive raw TODO comments, ad-hoc test transcripts, or local command output.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Which map renderer (2D, 3D, and overlays) owns final visibility masking contract? | Prevents duplicate or missing hidden-tile behavior across renderers. | Visibility + Combat mapping owners | Next implementation slice |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/visibility/TRACKER.md`.
3. Read `docs/projects/visibility/GAPS.md`.
4. Verify the tracker evidence links and re-check `src/hooks/combat/useVisibility.ts` usage from renderers.
5. Continue from active gap V-G1 (renderer wiring of visibility output).


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
