# Combat Scenario Tester Living Tracker

Status: active
Last updated: 2026-06-01

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

---

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Bounded Core Testing Grids & Scenario Selector | Gemini | 2026-06-01 | [PreviewCombatScenarios.tsx](file:///f:/Repos/Aralia/src/components/DesignPreview/steps/PreviewCombatScenarios.tsx) | Verify gameplay mechanics locally | Choose step in dashboard and run turns |
| T2 | not_started | Display Visual Obscurement Fog in 2D View | UI Developer | 2026-06-01 | none | Define opacity overlay styles based on visibility map | Render dim/dark tiles greyed out for player vision |
| T3 | not_started | Add Vision Senses Indicator to Inspector | UI Developer | 2026-06-01 | none | Append 'Blindsight' or 'Darkvision' to character sheet | Select token and confirm senses list |
| T4 | done | Implement Concentration & Spell Interruption Scenario | Gemini | 2026-06-01 | [PreviewCombatScenarios.tsx](file:///f:/Repos/Aralia/src/components/DesignPreview/steps/PreviewCombatScenarios.tsx) | Load scenario and damage wizard to verify save check logs | Spell concentration visual indicators and logs verified |
| T5 | done | Implement Opportunity Attacks & Reactions Scenario | Gemini | 2026-06-01 | [PreviewCombatScenarios.tsx](file:///f:/Repos/Aralia/src/components/DesignPreview/steps/PreviewCombatScenarios.tsx) | Walk away without Disengage and check attack rolls | Opportunity Attack reaction triggers and disengage prevention verified |
| T6 | active | Implement Resistance, Vulnerability & Immunity Scenario | Gemini | 2026-06-01 | none | Add elemental vulnerability map layouts to the sandbox selection options | Attack skeleton and fire elemental, check damage logs |
| T7 | not_started | Implement Prone & Grappled States Scenario | Gemini | 2026-06-01 | none | Add prone knockdown visual test sandbox | Knock target prone and verify melee vs ranged attack rolls |

---

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | UI Developer | battle-map | T1 | 3D map lighting does not dynamically update on biome change | `BattleMap3D.tsx` | Swapping scenarios does not reload preset lighting immediately | Verify R3F Canvas lighting presets re-evaluation | Check lighting preset on scene change |
| G2 | not_started | support_needed_now | Combat Dev | combat | T1 | LightSource active expiration is only rounds-based, not real-time | `VisibilitySystem.ts` | Lantern/light sources don't expire correctly in real-time exploration | Standardize expiration duration checks | Verify lights trigger removal in both combat and exploration |

---

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Keep raw process artifacts out unless a concise summary helps future work.
