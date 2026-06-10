---
schema_version: 1
project: Conversation Panel
slug: conversation-panel
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: "UI Shell & Components"
status: partial
last_updated: 2026-06-08
confidence: medium
evidence: docs/projects/conversation-panel
gap_signal: 1 open gap
protocol: living project doc set
next_step: Close current slice, keep activeConversation/activeDialogueSession exclusivity intent in CMA-G12 and continue next planned project action.
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
completed_verification:
  - docs_consistency
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Conversation Panel North Star

Status: active  
Last updated: 2026-06-08

## Dashboard Card Schema

Project: Conversation Panel
Slug: conversation-panel
Category: Feature/UI Projects
Status: partial
Confidence: medium
Evidence: docs/projects/conversation-panel
Gap signal: 1 open gap
Protocol: living project doc set
Next step: Close current slice, keep `activeConversation`/`activeDialogueSession` exclusivity intent in `CMA-G12` and continue next planned project action.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08
Agent comments:

## Why This Project Exists

Conversation Panel is the dedicated UI and state lane for direct companion chat (`@mention`, free text, AI response). It is intentionally separate from topic-based NPC dialogue (`DialogueInterface`) and must stay distinct from topic/discussion logic.

## Intended Outcome

Create and maintain a stable map of the companion conversation path: how it starts from gameplay actions, how turns are gated, and how it is cleared during gameplay transitions.

## Current State

- Core UI: `src/components/ConversationPanel/ConversationPanel.tsx` renders when `gameState.phase === GamePhase.PLAYING && gameState.activeConversation`.
- Core hook: `src/hooks/useConversation.ts` owns start/send/end flow and memory summarization.
- Core reducer state: `src/state/reducers/conversationReducer.ts` handles `START_CONVERSATION`, `ADD_CONVERSATION_MESSAGE`, `SET_CONVERSATION_PENDING`, `END_CONVERSATION`.
- Trigger path now wired:
  - Companion talk now routes through `handleTalk` and dispatches `START_CONVERSATION` from `src/hooks/actions/handleNpcInteraction.ts`.
  - NPC talk path remains topic dialog via `START_DIALOGUE_SESSION`.
- Turn gating now enforced:
  - `sendPlayerMessage` returns early when not player turn.
  - `ConversationPanel` disables send/input when `!activeConversation?.isPlayerTurn` or pending AI response.
- State integration updates:
  - `activeConversation` is now initialized in `src/state/initialState.ts`.
  - `src/state/appState.ts` clears `activeConversation` on `SET_GAME_PHASE` (menu/character creation), `MOVE_PLAYER`, and `LOAD_GAME_SUCCESS`.

## Active Task

| Field | Value |
|---|---|
| Task | Close `START_CONVERSATION` dispatch + `isPlayerTurn` gating implementation; then route remaining exclusivity policy to CMA |
| Acceptance criteria | Companion `talk` opens `ConversationPanel`; player turn and pending response are enforced in send and UI; gameplay transitions clear stale conversation state |
| Allowed boundaries | `docs/projects/conversation-panel/NORTH_STAR.md`, `docs/projects/conversation-panel/TRACKER.md`, `docs/projects/conversation-panel/GAPS.md`, targeted source files |
| Stop condition | Task evidence is captured in source/docs and gap ledger reflects remaining follow-up only |
| Verification | `rg` evidence scans, targeted source diff review, and focused project-doc consistency check |
| Owner | Project worker |
| Next action | Coordinate with `docs/projects/code-modularization-audit/CMA-G12` before any adjacent scope expansion |

## Concrete File Map

- `src/hooks/actions/handleNpcInteraction.ts`: companion branch in `talk` now dispatches `START_CONVERSATION`.
- `src/components/ConversationPanel/ConversationPanel.tsx`: interaction lock UI (input/send/close) now tied to pending + player turn.
- `src/hooks/useConversation.ts`: hook-level send guard now includes `isPlayerTurn`.
- `src/state/appState.ts`: conversation state gets cleared on phase/move/load boundaries.
- `src/state/initialState.ts`: `activeConversation: null` initialized.
- `src/components/Dialogue/DialogueInterface.tsx` and `src/hooks/useDialogueSystem.ts`: unchanged topic flow remains separate.

## Implemented State and Integration

- `START_CONVERSATION` creates `ActiveConversation` with participants, seeded message, turn state, and pending state.
- `ADD_CONVERSATION_MESSAGE` still flips turn state (`isPlayerTurn`) and appends messages.
- `SET_CONVERSATION_PENDING` controls both hook and panel lock behavior.
- `END_CONVERSATION` resets `activeConversation`.
- `handleTalk` branch:
  - Companion-only branch: resolves companion, ends any active topic dialogue session, opens conversation with seeded message.
  - NPC branch remains topic dialogue as before.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Broader exclusivity policy between companion conversation and modularized banter/companion orchestration is still owned by code-modularization work | adjacent_follow_up | `docs/projects/code-modularization-audit` (`CMA-G12`) | `src/hooks/actions/handleNpcInteraction.ts`, `src/state/appState.ts` | Keep this decision in `CMA-G12`; do not expand this project beyond current scope |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Companion talk now dispatches `START_CONVERSATION` | Trigger path exists for gameplay `talk` actions | `src/hooks/actions/handleNpcInteraction.ts` |
| Turn gating now includes player-turn lock | Request/UI consistency for companion turn state | `src/hooks/useConversation.ts`, `src/components/ConversationPanel/ConversationPanel.tsx` |
| Transition cleanup | Stale conversation state cannot survive movement/load/phase transitions | `src/state/appState.ts`, `src/state/initialState.ts` |

## Artifact Boundary

Keep durable intent and decisions in project docs. Avoid adding runtime log dumps or command output.

## Open Questions

- Whether to make `activeConversation` exclusive with legacy banter orchestration beyond start/clear boundaries remains handled by `CMA-G12`.

## Resume Path For A Cold Agent

1. Read this North Star, `TRACKER.md`, and `GAPS.md`.
2. Confirm `TRACKER` task state and review `docs/projects/GLOBAL_GAPS.md` only for cross-project routing.
3. Continue with next open tracker action and any handoff notes from `COLD_START_AGENT_PROMPT.md`.

## Cold-Start Resume Notes

- The implementation slice for `START_CONVERSATION` trigger path and `isPlayerTurn` gating is now in place.
- Any remaining cross-flow sequencing questions belong to `CMA-G12`; this project is now at evidence-complete handoff state.
