---
schema_version: 1
project: Planar System
slug: planar
category: Systems
main_category: "Content & Rules"
subcategory: "Rules, Spells & Source Data"
status: partial
last_updated: 2026-06-05
confidence: high
evidence: docs/projects/planar
gap_signal: 5 open gaps, with 3 support-needed-now items at the front of the queue
protocol: living project doc set
next_step: Start with G1 canonical plane resolution, then G2 portal spell/time semantics.
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
  - docs_consistency
  - scoped_review
completed_verification:
  - docs_consistency
last_proof: 2026-06-05
workflow_gaps_reviewed: 2026-06-05
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Planar System North Star

Status: active
Last updated: 2026-06-05

## Why This Project Exists
This project owns Planar mechanics and the command, combat, and location
integration points that consume them.

## Intended Outcome
Preserve implemented behavior, document the in-repo contracts, and keep the
next execution slice grounded in evidence.

## Dashboard Card Schema

Project: Planar System
Slug: planar
Category: Systems
Status: partial
Confidence: high
Evidence: docs/projects/planar
Gap signal: 5 open gaps, with 3 support-needed-now items at the front of the queue
Protocol: living project doc set
Next step: Start with G1 canonical plane resolution, then G2 portal spell/time semantics.
Required verification: docs_consistency, scoped_review
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Current State

Planar is partially implemented and test-backed. The live surface spans core
services, data/type definitions, utilities, and integration edges that are
already wired into combat and commands:

- Core services live in `src/systems/planar`:
  - `PlanarService.ts`
  - `PortalSystem.ts`
  - `PlanarHazardSystem.ts`
  - `rest.ts`
  - `AbyssalMechanics.ts`
  - `AstralMechanics.ts`
  - `FeywildMechanics.ts`
  - `InfernalMechanics.ts`
  - `ShadowfellMechanics.ts`
- Tests cover the major branches:
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
- Planar utility and targeting integration exists:
  - `src/utils/planar/planarUtils.ts`
  - `src/utils/planar/planarTargeting.ts`
  - `src/utils/planar/index.ts`
- Combat and command integration exists, but it is not fully unified:
  - `src/hooks/useAbilitySystem.ts` (`currentPlane` passthrough)
  - `src/commands/factory/SpellCommandFactory.ts` (planar cast-level lift)
  - `src/commands/effects/DamageCommand.ts` (planar modifiers for DC and damage)
  - `src/components/Combat/CombatView.tsx` (combat-plane prop)

## Active Task

| Field | Value |
|---|---|
| Task | Docs handoff refresh is complete; next implementation slice starts with the highest-priority open gap in `GAPS.md` |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` stay compact, evidence-backed, and aligned with `docs/projects/PROJECT_CARD_SCHEMA.md` |
| Allowed boundaries | `docs/projects/planar/*`; read-only evidence from `src`, `docs`, and tests |
| Stop condition | No gameplay changes in this pass |
| Verification | `docs_consistency` against `PROJECT_CARD_SCHEMA.md` plus workflow-gap review |
| Owner | Planar Spark worker |
| Next action | Start with `GAPS.md` row `P1`, then work downward by priority |

## Scope Boundaries

In scope:
- Documented evidence-driven Planar surface in this project folder only.
- Mapping runtime contracts for spell commands, combat plane context, hazard
  handling, and rest entry points.
- Capturing concrete gaps and unresolved integrations.

Adjacent but not in this slice:
- Implementing full portal travel flow.
- Rebuilding travel lane or map generation.
- Refactoring unrelated combat or location systems.

Out of scope:
- Functional code changes outside `docs/projects/planar`.
- Rewriting mechanics beyond documentation.

## What Must Not Be Lost

- Location-driven plane selection is still heuristic in `PlanarService`.
- Portal spell and time requirement logic is incomplete and still returns false
  for unsupported branches.
- Infernal contract workflow exists for drafting and signing, but breach
  detection and contract-state integration remain partial.
- Tests intentionally include fallbacks (`TODO` comments) where IDs and exact
  schemas are not yet stable.
- `activeContracts` in game state is still `unknown[]`, which forces casting to
  typed mechanics in `InfernalMechanics`.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Resolve canonical plane selection from current location data instead of `currentLocationId` prefix fallback logic in `PlanarService` | support_needed_now | Planar team | `src/systems/planar/PlanarService.ts` | Add a location-record regression test that proves the authoritative `Location.planeId` path |
| Implement portal spell requirement semantics and document the activation reason contract | support_needed_now | Planar team | `src/systems/planar/PortalSystem.ts` | Add a test matrix for `spell` requirements and source-tracking reasons |
| Tighten time requirement semantics in `PortalSystem` and align them with the live time model | support_needed_now | Planar team | `src/systems/planar/PortalSystem.ts` | Add concrete time-of-day and astral-phase cases backed by the real time source |
| Add explicit infernal contract state typing and breach payload mechanics | in_scope_now | Planar team | `src/types/infernal.ts`, `src/types/state.ts`, `src/systems/planar/InfernalMechanics.ts` | Replace `unknown[]` assumptions with `InfernalContract[]` usage and validate in tests |
| Remove placeholder or unknown IDs for hazards and rest denial paths when state is incomplete | adjacent_follow_up | Planar team | `src/systems/planar/PlanarHazardSystem.ts`, `src/systems/planar/rest.ts` | Add negative tests that fail deterministically on missing ids instead of fallback ids |

## Global Gap Imports

Check the global gap tracker before creating new gaps.

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | All current gaps are owned within Planar mechanics and integration contracts |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| `PROJECT_TRACKER` row | Planar is still scoped as partial with explicit next-step language | `docs/projects/PROJECT_TRACKER.md` |
| Planar system tests | Unit coverage exists for service, hazards, rest, portal activation, and command integration | `src/systems/planar/__tests__/*`, `src/systems/planar/__tests__/PlanarIntegration.test.ts` |
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
4. Re-check `src/data/planes.ts`, `src/systems/planar/PlanarService.ts`,
   `src/systems/planar/PortalSystem.ts`, `src/systems/planar/PlanarHazardSystem.ts`,
   and the relevant tests.
5. Continue from `GAPS.md` row `P1`.

## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- keep the gap registry evidence-backed and compact
- route any workflow ambiguity to `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`
- route any cross-project issue to `docs/projects/GLOBAL_GAPS.md`
- avoid inventing filler gaps when no real gap is found

