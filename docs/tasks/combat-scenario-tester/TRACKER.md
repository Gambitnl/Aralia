# Combat Scenario Tester Living Tracker

Status: reference-only
Last updated: 2026-06-25

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

---

## Historical Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Bounded Core Testing Grids & Scenario Selector | Gemini | 2026-06-01 | [PreviewCombatScenarios.tsx](file:///f:/Repos/Aralia/src/components/DesignPreview/steps/PreviewCombatScenarios.tsx) | Verify gameplay mechanics locally | Choose step in dashboard and run turns |
| T2 | routed | Display Visual Obscurement Fog in 2D View | UI Developer | 2026-06-25 | `docs/projects/design-preview-scenarios/subprojects/darkvision-senses`; `docs/projects/design-preview-scenarios/subprojects/stealth-hidden` | Route through the active Design Preview Scenarios child packet before implementation. | Child tracker/gap row carries the next proof boundary. |
| T3 | routed | Add Vision Senses Indicator to Inspector | UI Developer | 2026-06-25 | `docs/projects/design-preview-scenarios/subprojects/darkvision-senses` | Route through the active Design Preview Scenarios child packet before implementation. | Child tracker/gap row carries the next proof boundary. |
| T4 | done | Implement Concentration & Spell Interruption Scenario | Gemini | 2026-06-01 | [PreviewCombatScenarios.tsx](file:///f:/Repos/Aralia/src/components/DesignPreview/steps/PreviewCombatScenarios.tsx) | Load scenario and damage wizard to verify save check logs | Spell concentration visual indicators and logs verified |
| T5 | done | Implement Opportunity Attacks & Reactions Scenario | Gemini | 2026-06-01 | [PreviewCombatScenarios.tsx](file:///f:/Repos/Aralia/src/components/DesignPreview/steps/PreviewCombatScenarios.tsx) | Walk away without Disengage and check attack rolls | Opportunity Attack reaction triggers and disengage prevention verified |
| T6 | done | Implement Resistance, Vulnerability & Immunity Scenario | Gemini | 2026-06-02 | [PreviewCombatScenarios.tsx](file:///f:/Repos/Aralia/src/components/DesignPreview/steps/PreviewCombatScenarios.tsx) | Attack skeleton with Staff and fire elemental with Ray of Frost / Fire Bolt to verify logs | Vulnerability 2x, resistance 0.5x, and immunity 0x scaling verified successfully |
| T7 | routed | Implement Prone & Grappled States Scenario | Gemini | 2026-06-25 | `docs/projects/design-preview-scenarios/subprojects/conditions`; `src/components/DesignPreview/steps/PreviewCombatScenarioCatalog.ts` conditions lane | Route through the Conditions child packet before implementation. | Child tracker/gap row carries the next proof boundary. |

---

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | routed | adjacent_follow_up | UI Developer | Design Preview Scenarios / Battle Map | T1 | 3D map lighting does not dynamically update on biome change | `BattleMap3D.tsx`; `docs/projects/design-preview-scenarios` | Swapping scenarios does not reload preset lighting immediately | Route through the relevant Design Preview Scenarios or Battle Map owner before implementation. | Child or owner tracker carries rendered proof. |
| G2 | routed | support_needed_now | Combat Dev | Visibility / Design Preview Scenarios | T1 | LightSource active expiration is only rounds-based, not real-time | `VisibilitySystem.ts`; `docs/projects/design-preview-scenarios/subprojects/darkvision-senses` | Lantern/light sources don't expire correctly in real-time exploration | Route through Visibility or the Darkvision & Senses child packet before implementation. | Owner tracker carries combat/exploration proof. |
| G3 | routed | adjacent_follow_up | Next Agent | Resistance & Vulnerability child lane | T6 | Environmental spell zones that grant damage resistance/immunity are not dynamically applied to damage calculations | `ResistanceCalculator`; `docs/projects/design-preview-scenarios/subprojects/resistance-vulnerability` | Standing inside a protective spell zone does not dynamically grant resistance in `calculateDamage`. | Route through the Resistance & Vulnerability child packet before implementation. | Child tracker carries damage-scaling proof. |
| G4 | routed | adjacent_follow_up | Next Agent | Battle Map / Resistance & Vulnerability child lane | T6 | Damage resistances, vulnerabilities, and immunities are not visually exposed in the 2D/3D map overlays | `BattleMap.tsx`; `docs/projects/design-preview-scenarios/subprojects/resistance-vulnerability` | Players must open character sheets manually to see target weaknesses/immunities, slowing down strategic selection in the sandbox. | Route through the relevant Design Preview Scenarios child packet or Battle Map owner. | Owner tracker carries rendered badge/tooltip proof. |

---

## Update Rules

- Treat this tracker as reference-only.
- Do not assign new work from this folder unless the canonical Design Preview
  Scenarios project explicitly reopens it.
- Route scenario behavior work through `docs/projects/design-preview-scenarios`
  and its child packets.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/combat-scenario-tester/TRACKER.md","sha256WithoutMarker":"bda4d3d52d306a210008da3e02cbd336638b61c7371522c73592c5878a54e923","markedAtUtc":"2026-06-25T22:29:38.625Z"} -->
