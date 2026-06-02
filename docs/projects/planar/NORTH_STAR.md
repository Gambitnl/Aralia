# Planar System North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists
This project owns Planar mechanics and its integration points in command, combat, and location context. It existed as a registry entry with minimal local notes, but execution currently depends on multiple partially implemented systems with mixed readiness.

## Intended Outcome
Preserve what is already implemented, and document the exact in-repo contracts and known gaps so future work can continue with minimal re-discovery.

## Current State
The Planar slice is partially implemented and test-backed:

- Core services are in `src/systems/planar`:
  - `PlanarService.ts`
  - `PortalSystem.ts`
  - `PlanarHazardSystem.ts`
  - `rest.ts`
  - `AbyssalMechanics.ts`
  - `AstralMechanics.ts`
  - `FeywildMechanics.ts`
  - `InfernalMechanics.ts`
  - `ShadowfellMechanics.ts`
- Tests cover most branches:
  - `src/systems/planar/__tests__/AbyssalMechanics.test.ts`
  - `src/systems/planar/__tests__/AstralMechanics.test.ts`
  - `src/systems/planar/__tests__/FeywildMechanics.test.ts`
  - `src/systems/planar/__tests__/InfernalMechanics.test.ts`
  - `src/systems/planar/__tests__/PlanarHazardSystem.test.ts`
  - `src/systems/planar/__tests__/PlanarIntegration.test.ts`
  - `src/systems/planar/__tests__/PlanarService.test.ts`
  - `src/systems/planar/__tests__/PortalSystem.test.ts`
  - `src/systems/planar/__tests__/rest.test.ts`
- Data and type surfaces are present:
  - `src/data/planes.ts`
  - `src/types/planes.ts`
  - `src/types/infernal.ts`
  - `src/types/world.ts`
- Planar utility + targeting integration exists:
  - `src/utils/planar/planarUtils.ts`
  - `src/utils/planar/planarTargeting.ts`
  - `src/utils/planar/index.ts`
- Combat + command integration exists but is not fully unified:
  - `src/hooks/useAbilitySystem.ts` (currentPlane passthrough)
  - `src/commands/factory/SpellCommandFactory.ts` (planar cast-level lift)
  - `src/commands/effects/DamageCommand.ts` (planar modifiers for DC and damage)
  - `src/components/Combat/CombatView.tsx` (combat-plane prop)

## Active Task

| Field | Value |
|---|---|
| Task | Document Planar as cold-start ownership: ownership boundary, implementation state, integration edges, and prioritized gaps |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` in `docs/projects/planar` include file map, implemented state, integration points, and prioritized unresolved work |
| Allowed boundaries | `docs/projects/planar/*`; read-only evidence from `src`, `docs`, and tests |
| Stop condition | Stop after docs capture factual system state and evidence-backed gaps, no gameplay changes |
| Verification | Confirm files read include `src/systems/planar`, `src/data/planes.ts`, `src/utils/planar`, and `src/commands` references |
| Owner | Planar Spark worker |
| Next action | Use `TRACKER.md` and `GAPS.md` rows as input for next implementation slice |

## Scope Boundaries

In scope:
- Documented evidence-driven Planar surface in this project folder only.
- Mapping runtime contracts (spell command context, combat plane context, hazard/rest entry points).
- Capturing concrete gaps and unresolved integrations.

Adjacent but not in this slice:
- Implementing full portal travel flow.
- Rebuilding travel lane or map generation.
- Refactoring unrelated combat/locations systems.

Out of scope:
- Functional code changes outside `docs/projects/planar`.
- Rewriting mechanics beyond documentation.

## What Must Not Be Lost
- Location-driven plane selection is currently heuristic in `PlanarService` and guarded only by partial data.
- Portal spell/time requirement logic is incomplete and currently returns false for spell checks.
- Infernal contract workflow exists for drafting/signing, but breach detection and contract state integration remain partial.
- Tests intentionally include fallbacks (`TODO` comments) where IDs and exact schemas are not yet stable.
- `activeContracts` in game state is still `unknown[]`, which forces casting to typed mechanics in `InfernalMechanics`.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Resolve canonical plane selection path from current location object to Plane, replacing `currentLocationId` prefix fallback logic in `PlanarService` | support_needed_now | Planar team | `src/systems/planar/PlanarService.ts` | Add test proving location record + `Location.planeId` path and deprecate prefix heuristic |
| Implement and document portal spell requirement semantics (currently hard stub) | support_needed_now | Planar team | `src/systems/planar/PortalSystem.ts` | Add test matrix for type `spell` requirements and source tracking |
| Tighten time requirement semantics in `PortalSystem` and align with live time model | in_scope_now | Planar team | `src/systems/planar/PortalSystem.ts` | Add concrete time-of-day/astral phase cases backed by real time source |
| Add explicit infernal contract state typing and breach payload mechanics | in_scope_now | Planar team | `src/types/infernal.ts`, `src/types/state.ts`, `src/systems/planar/InfernalMechanics.ts` | Replace `unknown[]` assumptions with `InfernalContract[]` usage and validate in tests |
| Remove placeholder/unknown IDs for hazards and rest denial paths when state is incomplete | adjacent_follow_up | Planar team | `src/systems/planar/PlanarHazardSystem.ts`, `src/systems/planar/rest.ts` | Add negative tests that fail deterministically on missing ids instead of fallback ids |

## Global Gap Imports

Check the global gap tracker before creating new gaps.

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | All current gaps are owned within Planar mechanics and integration contracts |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| `PROJECT_TRACKER` row | Planar already scoped as partial system with explicit next step | `docs/projects/PROJECT_TRACKER.md` |
| Planar system tests | Unit coverage exists for service, hazards, rest, portal activation, command integration | `src/systems/planar/__tests__/*`, `src/systems/planar/__tests__/PlanarIntegration.test.ts` |
| Planar data and type tests | Data registry and schema contract are present | `src/data/__tests__/planes.test.ts` |
| Spell and command integration logs | Planar modifiers flow through command context and combat damage path | `src/commands/factory/SpellCommandFactory.ts`, `src/commands/effects/DamageCommand.ts` |
| Cross-plane targeting utilities | Separate cross-plane visibility and interaction checks exist | `src/utils/planar/planarTargeting.ts` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Project registry anchor and status | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project routing check | active |
| `docs/projects/planar/TRACKER.md` | Active queue and gap routing decisions | active |
| `docs/projects/planar/GAPS.md` | Durable unresolved findings | active |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/planar/TRACKER.md`.
3. Read `docs/projects/planar/GAPS.md`.
4. Re-read `PLANES`, `PlanarService.ts`, `PortalSystem.ts`, `PlanarHazardSystem.ts`, and relevant tests to confirm current behavior.
5. Continue from active tracker row with highest `support_needed_now` gap.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
