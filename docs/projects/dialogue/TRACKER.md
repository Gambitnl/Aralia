# Dialogue Living Tracker

Status: active  
Last updated: 2026-06-18

## Status Vocabulary
- `not_started`
- `active`
- `blocked`
- `done`
- `superseded`

## Active Task Queue

| ID | Status | Task | Owner | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|
| D2 | active | Track unresolved dialogue gaps and keep this project-level gap list aligned | GitHub Copilot / MAI-Code-1-Flash | `docs/projects/dialogue/GAPS.md`, `docs/projects/dialogue/NORTH_STAR.md`, `src/hooks/useDialogueSystem.ts` | Keep the six-gap inventory aligned and preserve DIAL-002/DIAL-004 as the highest-value decision path | Re-check the gap inventory and proof summary at the next resume pass |

## Change Log

| Date | File | Change | Why | Next check |
|---|---|---|---|---|
| 2026-05-31 | `docs/projects/dialogue/NORTH_STAR.md` | Replaced scaffold with concrete runtime facts | Documentation now reflects implemented system state | Keep synced with future feature changes |
| 2026-05-31 | `docs/projects/dialogue/GAPS.md` | Added implementation-backed gap log and status labels | Preserve unresolved items for cold handoff | Review blocked/human-decision items before next scope expansion |
| 2026-05-31 | `docs/projects/dialogue/TRACKER.md` | Added active tasks for continuity and checks | Make next steps explicit for cold starts | Retire completed tasks in place |
| 2026-06-05 | `docs/projects/dialogue/NORTH_STAR.md`, `docs/projects/dialogue/TRACKER.md`, `docs/projects/dialogue/GAPS.md`, `docs/projects/dialogue/COLD_START_AGENT_PROMPT.md` | Refreshed the cold-start resume state and expanded the project gap inventory with Dialogue-specific follow-ups | Keep the handoff compact, current, and evidence-backed | Resume from D2 and keep D3 visible |
| 2026-06-10 | `docs/projects/dialogue/NORTH_STAR.md`, `docs/projects/dialogue/TRACKER.md`, `docs/projects/dialogue/GAPS.md`, `docs/projects/dialogue/COLD_START_AGENT_PROMPT.md`, `docs/projects/dialogue/AUDIT_OR_PROOF.md` | D3 verified: session lifecycle, reducer mapping, save/load ephemeral behavior documented in North Star; gap signal corrected to 6 open gaps | Iteration 2 cold-start pass; D3 closed with evidence | Resume from D2 with focus on DIAL-002 unlock propagation decision |
| 2026-06-18 | `docs/projects/dialogue/NORTH_STAR.md`, `docs/projects/dialogue/TRACKER.md`, `docs/projects/dialogue/GAPS.md`, `docs/projects/dialogue/COLD_START_AGENT_PROMPT.md`, `docs/projects/dialogue/AUDIT_OR_PROOF.md` | D2 alignment pass refreshed the living-project docs, preserved the six evidence-backed gaps, and recorded the current proof path for the next handoff | Keep the current inventory stable until a real unlock-propagation decision is implemented | Re-check this pass after the next evidence-backed Dialogue change |

## Update Rules
- Update active tasks when behavior or tests change.
- Keep this tracker aligned with any new durable project risk or follow-up in GAPS.md.
- Use only project-local docs for core decisions; avoid expanding scope to unrelated systems in this tracker.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| DIAL-001 | not_started | adjacent_follow_up | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | Runtime scan | Scripted node/tree format is not implemented yet. | `src/components/Dialogue/DialogueInterface.tsx`, `src/services/dialogueService.ts` | Future expansion may require a durable conversation schema. | Define the schema direction before adding new dialogue content. | Acceptance tests for a script import or conversion path. |
| DIAL-002 | active | support_needed_now | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | Runtime scan | Cross-NPC topic propagation is only partially implemented and currently stubbed. | `src/hooks/useDialogueSystem.ts` (TODO marker), `src/state/reducers/npcReducer.ts` | Unlocks may stop at session scope instead of persisting globally. | Decide whether unlock propagation should use DiscoveryLog or `NPC KnownFact`. | Regression test for durable unlock propagation beyond one session. |
| DIAL-003 | active | in_scope_now | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | Runtime scan | `sessionDispositionMod` and `availableTopicIds` are not fully wired into the runtime path. | `src/types/dialogue.ts`, `src/components/Dialogue/DialogueInterface.tsx`, `src/services/dialogueService.ts` | Session intent and runtime behavior can drift. | Apply the fields or remove/refine them in the current system. | Test or remove field expectations and update docs. |
| DIAL-004 | active | support_needed_now | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | North Star review | Unlock outcomes are session-local in the current docs path. | `docs/projects/dialogue/NORTH_STAR.md` | Future dialogue content may lose unlock progress without an explicit global model. | Decide and document the durable unlock-fact rule before expanding content. | Proof that the chosen persistence model is explicit. |
| DIAL-005 | not_started | adjacent_follow_up | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | North Star review | Dialogue and companion chat share the same surface area but their ownership boundary is not formalized. | `docs/projects/dialogue/NORTH_STAR.md`, `src/components/ConversationPanel`, `src/hooks/useConversation.ts` | Future work can patch the wrong flow or assume shared state. | Add the ownership boundary note before broader follow-up work. | Handoff note that points to the correct flow without ambiguity. |
| DIAL-006 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` | Code modularization audit routing | Companion banter ownership and cross-flow orchestration still require a clearer boundary. | `src/hooks/useCompanionBanter.ts`, `docs/projects/companions/GAPS.md` | Dialogue expansion can accidentally inherit the wrong ownership path. | Add a boundary note before any banter extraction or refactor work. | Handoff clearly states which flow owns companion banter. |
