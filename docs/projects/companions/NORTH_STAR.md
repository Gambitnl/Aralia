---
schema_version: 1
project: Companions System
slug: companions
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: review-required
last_updated: 2026-06-08
confidence: medium
evidence: docs/projects/companions/NORTH_STAR.md
gap_signal: "G1/G2/G3/G4/G5/G7/G8/G9 resolved; G6 remains a human-decision blocker"
protocol: living project doc set
next_step: Human/story decision: choose automatic, event-driven, or hysteresis breakup semantics for romance lock-in before assigning more companion work.
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
  - scoped_tests
  - docs_consistency
completed_verification:
  - scoped_tests
  - docs_consistency
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: human-review-required
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "yes"
---
# Companions System North Star

Status: review-required
Last updated: 2026-06-08

## Why This Project Exists
The project tracker already marks Companions as implemented (`docs/projects/PROJECT_TRACKER.md`), but ownership context was still scaffold-only. This project now captures the current behavior and risk surface so future agents can continue without re-deriving intent.

## Intended Outcome
Create a durable, evidence-backed handoff for the companion social stack (relationship state, reaction dispatch, banter/conversation UX, and associated reducers), while preserving incomplete-but-important intent and identifying concrete gaps before implementation resumes.

## Current State
- Systems are split and active:
  - `src/systems/companions/RelationshipManager.ts` handles approval math, thresholds, unlock checks, and history/event append.
  - `src/systems/companions/CompanionReactionSystem.ts` computes reaction approvals and text from rule matches, and now filters rules that fall outside their relationship bounds before aggregation.
  - `src/systems/companions/BanterManager.ts` selects banter candidates by cooldown/location/participants/relationship/chance.
  - `src/systems/companions/RelationshipManager.ts` now also exposes a conservative loyalty-retention floor instead of leaving `checkLoyalty` as a placeholder.
- AI and event hooks drive runtime behavior:
  - `src/hooks/useCompanionBanter.ts` for ambient NPC banter and player-directed interjection/ignore/escalation, with an explicit `generatePlayerDirectedLine` -> response window -> escalation/interrupt contract backed by a focused hook regression.
  - The hook remains the companion-owned orchestration shell for trigger/session gating, line pacing, response windows, and archive/summarize side effects; the later modularization plan keeps those responsibilities intact while separating dialogue and conversation-panel ownership.
  - `src/hooks/useCompanionCommentary.ts` for system reactions to location/messages/gold/crime state changes.
  - `src/hooks/useConversation.ts` for interactive conversation start/send/end and memory/sentiment summarization.
- State integration path is established:
  - `src/state/reducers/companionReducer.ts`, `src/state/reducers/conversationReducer.ts`, `src/state/actionTypes.ts`, `src/state/appState.ts`, `src/state/initialState.ts`, with `UPDATE_COMPANION_APPROVAL.source` documented as provenance-only routing.
- UI surfaces are wired in game flow:
  - `src/components/ui/CollapsibleBanterPanel.tsx`
  - `src/components/ui/BanterAttentionBanner.tsx`
  - `src/components/ui/BanterInterruptUI.tsx`
  - `src/components/ui/CompanionReaction.tsx`
  - `src/components/ConversationPanel/ConversationPanel.tsx`
  - `src/components/ui/CompanionCard.tsx`
  - `src/components/Party/RelationshipsPane.tsx`
  - plus root integration in `src/App.tsx`.
- Data and tests are present:
  - `src/data/companions.ts` and `src/data/banter.ts` are seeded and typed via `src/types/companions.ts`.
  - Tests exist in `src/systems/companions/__tests__/*` and in `src/hooks/__tests__/useCompanionBanter.test.ts`, `src/hooks/__tests__/useCompanionCommentary.test.ts`.
- `src/systems/companions/Companions_Ralph.md` keeps historical notes about unresolved behavior issues.
- Historical notes in `src/systems/companions/Companions_Ralph.md` also validate two higher-priority follow-ups (romance lock-in and runtime-safe IDs); this pass imported both into `GAPS.md`.
- This pass implemented relationship-bound reaction filtering, a FIFO companion reaction queue with duplicate suppression, proved shared ID-helper fallback behavior, reconciled the `-500..500` relationship scale across types/runtime/UI, added focused player-directed banter regression coverage, and refreshed the companion project docs to match.

## Dashboard Card Schema

Project: Companions System
Slug: companions
Category: Feature/UI Projects
Status: review-required
Confidence: medium
Evidence: docs/projects/companions/NORTH_STAR.md
Gap signal: G1/G2/G3/G4/G5/G7/G8/G9 resolved; G6 remains a human-decision blocker
Protocol: living project doc set
Next step: Human/story decision: choose automatic, event-driven, or hysteresis breakup semantics for romance lock-in before assigning more companion work.
Required verification: scoped_tests, docs_consistency
Completed verification: scoped_tests, docs_consistency
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08

Dashboard lifecycle: human-review-required
Assignment rule: Do not assign forward iteration agents until the romance downgrade policy is decided or a fresh source-backed scan finds a non-G6 gap.

## Required Review Brief

Title: Companion Romance Downgrade Policy
Question: Should a companion in `romance` automatically downgrade when approval collapses, wait for an event-driven breakup, or use hysteresis before leaving romance state?
Issue: The relationship state can still present `romance` after approval falls into hostile territory.
Current behavior: `RelationshipManager` now has tested approval scale and loyalty-floor behavior, but it does not own a breakup/downgrade policy for established romance.
Why blocked: New companion relationship content or further state extraction could preserve the wrong story contract if romance exit semantics are guessed by an agent.
Option A: Automatic downgrade when approval crosses a defined hostile or low-approval threshold.
Option B: Event-driven breakup where story/dialogue content explicitly commits the downgrade.
Option C: Hysteresis policy where romance survives temporary approval dips but exits after sustained low approval.
Evidence: `src/systems/companions/Companions_Ralph.md`; `src/systems/companions/RelationshipManager.ts`; `docs/projects/companions/GAPS.md` G6.
Decision owner: Human/story owner.
Proof after decision: Update G6, encode the chosen policy in `RelationshipManager`, and add a focused regression that drops approval from romance to hostile and verifies the chosen exit behavior.

## Active Task

| Field | Value |
|---|---|
| Task | G1/G2/G3/G4/G5/G7/G8/G9 complete: relationship-bounded reactions, companion reaction queueing/dedupe, relationship scale alignment, loyalty retention floor, companion approval source routing, explicit player-directed banter routing, shared ID-helper generation, the companion-owned banter split contract, and the player-directed response-window regression are implemented and reflected in the docs. |
| Acceptance criteria | Reaction bounds reject out-of-range rules; repeated companion reaction bubbles queue in FIFO order with duplicate suppression; approval comments, clamp behavior, and the card marker use the same `-500..500` scale; `checkLoyalty` exposes a tested retention-floor contract; relationship event IDs route through the shared helper fallback; companion approval `source` remains provenance-only; player-directed banter follows the documented response-window contract and has a focused regression for the directed opening, waiting deadline, and interrupt reset; the banter split contract names preserved responsibilities, extraction candidates, and proof tests without touching romance policy; `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` reflect the resolved gaps. |
| Allowed boundaries | `src/systems/companions/CompanionReactionSystem.ts`, `src/systems/companions/RelationshipManager.ts`, `src/types/companions.ts`, `src/components/ui/CompanionCard.tsx`, `src/components/ui/CompanionReaction.tsx`, nearby tests, and `docs/projects/companions/*`. |
| Stop condition | G1/G2/G3/G4/G5/G7/G8/G9 are implemented or contract-locked, tested or documented, and reflected in the companion docs. |
| Verification | Focused reaction-system, reaction-queue, relationship-manager, companion-card, and banter-hook tests plus updated docs reference explicit source files/tests and project trackers; the G5 and G8 contracts are documented at the reducer, hook, and split-plan edges. |
| Owner | Worker A |
| Next action | Use `TRACKER.md` + `GAPS.md` to prioritize the next execution slice; avoid `G6` until its human decision clears, and use the documented G8 split contract when the later code pass starts extracting helpers. |

## Scope Boundaries

In scope:
- File-level ownership map and subsystem status capture for `companions`.
- Concrete gap definition with owner and proof evidence.
- Resume instructions for future cold-start continuation.

Adjacent but not in this slice:
- Implementing behavior changes in AI banter/reaction/relationship logic.
- Reclassifying unrelated gameplay systems.

Out of scope:
- Non-doc gameplay edits.
- Cross-project global refactors.

## What Must Not Be Lost
- Relationship approval is implemented on a `-500..500` scale with 11 levels, including romance behavior guards.
- Ambient banter and directed conversation paths are already product-visible and stateful.
- The project intentionally mixes finished mechanics with placeholder/unfinished behavior (documented below), so preserving that distinction matters more than minimizing file count.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| `CompanionReactionSystem` requirement bounds are now enforced during evaluation. | done | Worker A | `src/systems/companions/CompanionReactionSystem.ts`, `src/systems/companions/__tests__/CompanionReactionSystem.test.ts` | Keep the regression coverage in place when adding new reaction content. |
| `RelationshipManager.checkLoyalty` now has an explicit retention-floor contract; leave/betrayal remains a separate future slice. | done | Worker A | `src/systems/companions/RelationshipManager.ts`, `src/systems/companions/__tests__/RelationshipManager.test.ts` | Keep the floor proof in place and only add departure behavior when the story policy is chosen. |
| Companion approval `source` and player-directed banter flow are now explicitly routed in docs and comments. | done | Worker A | `src/state/reducers/companionReducer.ts`, `src/hooks/useCompanionBanter.ts`, `src/state/appState.ts`, `docs/projects/companions/GAPS.md` | Keep the provenance field and player-response window documented as separate contracts. |
| Romance state lock-in: once a companion reaches `romance`, approval can collapse without the state downgrading or breaking. | blocked_human_decision | Worker A | `src/systems/companions/Companions_Ralph.md`, `src/systems/companions/RelationshipManager.ts` | Choose automatic, event-driven, or hysteresis breakup semantics and encode them in `RelationshipManager`. |
| `RelationshipManager` ID generation now uses the shared `generateId()` helper. | done | Worker A | `src/systems/companions/RelationshipManager.ts`, `src/systems/companions/__tests__/RelationshipManager.test.ts`, `src/utils/core/idGenerator.ts` | Keep the helper as the single ID-generation entrypoint. |
| Relationship scale inconsistency resolved: type comments, runtime clamp, threshold tests, and `CompanionCard` approval marker all use `-500..500`. | done | Worker A | `src/types/companions.ts`, `src/systems/companions/RelationshipManager.ts`, `src/components/ui/CompanionCard.tsx`, `src/components/ui/CompanionCard.test.tsx` | Keep future UI math and type comments aligned with the runtime clamp. |
| `CompanionReaction.tsx` now queues repeated bubbles with a conservative duplicate window. | done | Worker A | `src/components/ui/CompanionReaction.tsx`, `src/components/ui/CompanionReaction.test.tsx` | Keep the FIFO queue and duplicate window in place when adding new reaction sources. |
| Companion banter modularization is now a documented split contract: preserve the companion-owned shell, then extract session policy, line flow, response-window, and archive/summarize helpers later. | done | Worker A | `docs/projects/companions/GAPS.md`, `docs/projects/companions/TRACKER.md`, `src/hooks/useCompanionBanter.ts`, `src/hooks/__tests__/useCompanionBanter.test.ts` | Keep the hook as the integration shell and keep dialogue/conversation-panel ownership separate when the later code pass begins. |
| Player-directed banter response-window contract now has a focused regression for the opening line, waiting deadline, and interrupt reset. | done | Worker A | `src/hooks/useCompanionBanter.ts`, `src/hooks/__tests__/useCompanionBanter.test.ts` | Keep the regression in place when changing the banter hook or response-window state. |
| Party-facing and AI flow coupling remains broad; some fields are optional and guarded by runtime checks. | adjacent_follow_up | Worker A | `src/hooks/useCompanionCommentary.ts`, `src/hooks/useCompanionBanter.ts`, `src/components/ui/CollapsibleBanterPanel.tsx` | Tighten flow contracts while preserving backward compatibility. |

## Global Gap Imports

Check the global gap tracker before creating this project surface:
`docs/projects/GLOBAL_GAPS.md`.

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | No cross-project/orphaned gaps were identified during this documentation pass. |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Registry anchor | Companions is already a tracked, in-progress subsystem | `docs/projects/PROJECT_TRACKER.md` |
| Relationship system implementation | Approval math, clamps, unlock checks, event history | `src/systems/companions/RelationshipManager.ts` |
| Reaction engine implementation | Tag matching and approval aggregation path | `src/systems/companions/CompanionReactionSystem.ts` |
| Banter selection logic | Cooldown/location/participant/relationship/chance filtering | `src/systems/companions/BanterManager.ts` |
| Banter split contract | Preserved banter responsibilities, extraction candidates, and proof tests for the later modularization pass | `docs/projects/companions/GAPS.md`, `docs/projects/companions/TRACKER.md`, `src/hooks/useCompanionBanter.ts`, `src/hooks/__tests__/useCompanionBanter.test.ts` |
| Historical note validation | Additional validated follow-ups: romance lock-in and runtime-safe IDs | `src/systems/companions/Companions_Ralph.md` |
| Hook-level orchestration | Ambient banter, commentary triggers, interactive talk loop | `src/hooks/useCompanionBanter.ts`, `src/hooks/useCompanionCommentary.ts`, `src/hooks/useConversation.ts` |
| Reducer-state wiring | Action surface and update paths for companion state/memory/conversation | `src/state/actionTypes.ts`, `src/state/reducers/companionReducer.ts`, `src/state/reducers/conversationReducer.ts`, `src/state/appState.ts` |
| UI integration | Banter/conversation/reaction surfaces are rendered and controlled | `src/App.tsx`, `src/components/ui/CollapsibleBanterPanel.tsx`, `src/components/ConversationPanel/ConversationPanel.tsx`, `src/components/ui/CompanionReaction.tsx`, `src/components/ui/CompanionReaction.test.tsx` |
| Reaction queue implementation | FIFO bubble order and duplicate suppression for dense companion bursts | `src/components/ui/CompanionReaction.tsx`, `src/components/ui/CompanionReaction.test.tsx` |
| Data seeds | Initial companions and banter definitions are data-backed | `src/data/companions.ts`, `src/data/banter.ts` |
| Test evidence | Existing suite validates reaction, banter, and approval behaviors | `src/systems/companions/__tests__/`, `src/hooks/__tests__/useCompanionBanter.test.ts`, `src/hooks/__tests__/useCompanionCommentary.test.ts` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| docs/projects/PROJECT_TRACKER.md | Repo-level project registry | active |
| docs/projects/GLOBAL_GAPS.md | Cross-project/out-of-scope gap routing | active |
| docs/projects/companions/TRACKER.md | Active queue, gap log, and next actions | active |
| docs/projects/companions/GAPS.md | Durable in-project gap inventory | active |
| src/systems/companions/Companions_Ralph.md | Historical risk and unresolved behavior notes | reference |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/companions/TRACKER.md`.
3. Read `docs/projects/companions/GAPS.md`.
4. Verify evidence by opening referenced `src` files + tests.
5. Continue from the highest-priority open gap row: avoid `G6` until the relationship-policy decision clears, and treat `G8` as the documented companion-banter split contract for the next code pass.

## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
