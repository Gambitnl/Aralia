# Combat Scenario Tester North Star

Status: active
Last updated: 2026-06-01

## Why This Project Exists

The **Combat Scenario Tester** provides a dedicated, developer-facing testing dashboard to isolate, verify, and showcase individual combat mechanics (specifically Cover tiers, Darkvision obscurement, and Difficult Terrain speed costs) in real turn-based situations. 

Without this sandbox, testing these systems required manual gameplay setup, which was highly fragile and slow. Tying them to static, programmatic maps guarantees 100% reproducible edge cases on native rendering surfaces (`BattleMap`, `BattleMap3D`) under full rules engine orchestration.

## Intended Outcome

Create a visual sandbox inside Aralia's design dashboard (`misc/design.html`) where developers can choose a specific mechanic to test, see a custom-built test board loaded instantly, and run the real D&D 5e-style combat hooks with visual state trace logs.

## Current State

- The feature is fully implemented and mounted as a first-class preview step: `"Combat Scenarios"`.
- Entry point path: `/misc/design.html -> currentStep: 'scenarios'`.
- Lane step component: [PreviewCombatScenarios.tsx](file:///f:/Repos/Aralia/src/components/DesignPreview/steps/PreviewCombatScenarios.tsx).
- Dashboard router integration: [DesignPreviewPage.tsx](file:///f:/Repos/Aralia/src/components/DesignPreview/DesignPreviewPage.tsx).
- Core gameplay system linkages:
  - Turn orchestration: `useTurnManager` (`src/hooks/combat/useTurnManager.ts`)
  - Target/LoS resolution: `useAbilitySystem` (`src/hooks/useAbilitySystem.ts`)
  - Map grids: `BattleMap` (`src/components/BattleMap/BattleMap.tsx`) and `BattleMap3D` (`src/components/BattleMap/BattleMap3D.tsx`)
  - Combatant hydration: `createQuickCombatCharacter` (`src/utils/sandbox/quickCharacterGenerator.ts`)

---

## Bounded Active Task: Prone & Grappled States Sandbox

We are moving forward with implementing the Prone and Grappled states playground to isolate and verify martial/positional rules.

| Field | Value |
|---|---|
| Task | Implement the Prone & Grappled States test sandbox. |
| Acceptance criteria | The new sandbox template mounts in the selector, populating an adjacent target that can be knocked Prone to verify melee advantage and ranged disadvantage mechanics. |
| Allowed boundaries | `src/components/DesignPreview/steps/PreviewCombatScenarios.tsx` only |
| Stop condition | Do not implement the underlying grapple check resolver; isolate using transient properties. |
| Verification | Manual inspection on `/misc/design.html`. |
| Owner | Next Agent |
| Next action | Build the programmatic layout and character presets for T7. |

---

## Scope Boundaries

In scope:
- Non-procedural static map builders (`width = 16`, `height = 12`) using standard tile schemas.
- Dynamic scenario switching and quick-character hydration using the standard context.
- Dual-support for HTML grid (2D) and Canvas (3D) views.

Adjacent but deferred:
- Creating custom status conditions or vision traits.
- Tying character stats to persistent state (the sandbox uses transient structures).

Out of scope:
- Modifying the underlying pathfinder (`pathfinding.ts`) or line-of-sight algorithms (`lineOfSight.ts`).

---

## What Must Not Be Lost

- **Static Reproducibility**: The scenarios must not use Perlin noise or random maps. They rely on fixed, hardcoded tile layouts so coordinates like `[7, 5]` have deterministic terrain.
- **Rules Parity**: The sandbox must not mock combat outcomes. It runs the real hooks under the hood so character AC, Dex saves, and movement remain authentic.
- **Standalone Decoupling**: The sandbox must run correctly on the standalone Design Preview page without requiring full game state hydration.

---

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| 3D map lighting does not dynamically update when changing biomes | adjacent_follow_up | UI Developer | `BattleMap3D.tsx` | Ensure R3F lights hot-reload when loading new themes |
| Human Wizard cannot see target but is not visually blocked in 2D grid overlay | adjacent_follow_up | Combat UI | `PreviewCombatScenarios.tsx` | Add a visual Fog of War shader or hidden opacity toggle on the 2D tiles |
| Environmental spell zones that grant damage resistance/immunity are not dynamically applied to damage calculations | adjacent_follow_up | Next Agent | `ResistanceCalculator` | Update `ResistanceCalculator` to check target's tile overlap with active spell zones |
| Damage resistances, vulnerabilities, and immunities are not visually exposed in the 2D/3D map overlays | adjacent_follow_up | Next Agent | `BattleMap.tsx` | Add small elemental badges or tooltips displaying active traits |

---

## Global Gap Imports

*No global gaps were explicitly imported for this pass.*

---

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Interactive Sandbox Component | Chooser panel, scenario map builders, and engine linkages are in place | `src/components/DesignPreview/steps/PreviewCombatScenarios.tsx` |
| Integrated Dashboard Route | Mounted as a visual preview tab in the standalone developer dash | `src/components/DesignPreview/DesignPreviewPage.tsx` |

---

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Long-term registry anchor | active |
| `docs/tasks/combat-scenario-tester/TRACKER.md` | Active queue and task logs | active |

---

## Resume Path For A Cold Agent

1. Read this file.
2. Read [TRACKER.md](file:///f:/Repos/Aralia/docs/tasks/combat-scenario-tester/TRACKER.md).
3. Access `/misc/design.html` on a local dev server and select "Combat Scenarios".
4. Continue from **T2** in the active queue.
