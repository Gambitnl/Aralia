# Companions System North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists
The project tracker already marks Companions as implemented (`docs/projects/PROJECT_TRACKER.md`), but ownership context was still scaffold-only. This project now captures the current behavior and risk surface so future agents can continue without re-deriving intent.

## Intended Outcome
Create a durable, evidence-backed handoff for the companion social stack (relationship state, reaction dispatch, banter/conversation UX, and associated reducers), while preserving incomplete-but-important intent and identifying concrete gaps before implementation resumes.

## Current State
- Systems are split and active:
  - `src/systems/companions/RelationshipManager.ts` handles approval math, thresholds, unlock checks, and history/event append.
  - `src/systems/companions/CompanionReactionSystem.ts` computes reaction approvals and text from rule matches.
  - `src/systems/companions/BanterManager.ts` selects banter candidates by cooldown/location/participants/relationship/chance.
- AI and event hooks drive runtime behavior:
  - `src/hooks/useCompanionBanter.ts` for ambient NPC banter and player-directed interjection/ignore/escalation.
  - `src/hooks/useCompanionCommentary.ts` for system reactions to location/messages/gold/crime state changes.
  - `src/hooks/useConversation.ts` for interactive conversation start/send/end and memory/sentiment summarization.
- State integration path is established:
  - `src/state/reducers/companionReducer.ts`, `src/state/reducers/conversationReducer.ts`, `src/state/actionTypes.ts`, `src/state/appState.ts`, `src/state/initialState.ts`.
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
- No source code changes were made in this pass; docs-only updates only.

## Active Task

| Field | Value |
|---|---|
| Task | Enrich the three project docs with evidence-backed state map, partial/uncertain areas, concrete gaps, and cold-start resume path. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` document current state and evidence-backed gaps without modifying source files. |
| Allowed boundaries | `docs/projects/companions/*` only; source reads are evidence-only. |
| Stop condition | Documentation package is complete, internally consistent, and reviewable without code edits. |
| Verification | Evidence mapping in docs references explicit source files/tests and project trackers. |
| Owner | Worker A |
| Next action | Use `TRACKER.md` + `GAPS.md` to prioritize next execution slice. |

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
| `CompanionReactionSystem` declares requirement fields but does not enforce them during evaluation. | support_needed_now | Worker A | `src/systems/companions/CompanionReactionSystem.ts`, `src/types/companions.ts` | Add/verify requirement filtering + tests before adding new reaction content. |
| `RelationshipManager.checkLoyalty` and several type/import TODOs are placeholders. | support_needed_now | Worker A | `src/systems/companions/RelationshipManager.ts` | Decide contract and either implement or mark intentional de-scope. |
| `CompanionReaction.tsx` only tracks a single dismissed message; concurrent reaction bubbles are not queued. | adjacent_follow_up | Worker A | `src/components/ui/CompanionReaction.tsx` | Decide queue strategy (global/companion) and add regression for parallel events. |
| Relationship scale inconsistency: type/comments still imply legacy `-100..100` while runtime uses `-500..500`. | support_needed_now | Worker A | `src/types/companions.ts`, `src/systems/companions/RelationshipManager.ts`, `src/components/ui/CompanionCard.tsx` | Reconcile type comments and any dependent UI assumptions. |
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
| Hook-level orchestration | Ambient banter, commentary triggers, interactive talk loop | `src/hooks/useCompanionBanter.ts`, `src/hooks/useCompanionCommentary.ts`, `src/hooks/useConversation.ts` |
| Reducer/state wiring | Action surface and update paths for companion state/memory/conversation | `src/state/actionTypes.ts`, `src/state/reducers/companionReducer.ts`, `src/state/reducers/conversationReducer.ts`, `src/state/appState.ts` |
| UI integration | Banter/conversation/reaction surfaces are rendered and controlled | `src/App.tsx`, `src/components/ui/CollapsibleBanterPanel.tsx`, `src/components/ConversationPanel/ConversationPanel.tsx`, `src/components/ui/CompanionReaction.tsx` |
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
5. Continue from the highest `support_needed_now` gap row and update this folder when behavior changes.
