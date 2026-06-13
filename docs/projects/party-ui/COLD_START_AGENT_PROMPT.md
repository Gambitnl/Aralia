---
schema_version: 1
handoff_type: agent_to_agent
project: Party UI
slug: party-ui
Status: partial
last_updated: 2026-06-12
iteration: 6
source_agent: Qoder
target_agent: next cold-start agent
runtime_surface: MCP/subagent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/party-ui/NORTH_STAR.md
tracker: docs/projects/party-ui/TRACKER.md
gaps: docs/projects/party-ui/GAPS.md
---
# Party UI Cold Start Agent Handoff

Status: partial
Last updated: 2026-06-12

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/party-ui/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Party UI
Project folder: docs/projects/party-ui
iteration: 6
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/party-ui/NORTH_STAR.md
Tracker: docs/projects/party-ui/TRACKER.md
Gaps: docs/projects/party-ui/GAPS.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Spawned by the foreman as a bounded living-project iteration worker; reducer-backed companion-context regression tests and Party UI docs refresh |
| 4 | Qoder | MCP/subagent | certain | 2026-06-08 | Living-project iteration worker; T5 companion-context verification and mismatch-warning evaluation; G8 resolved |
| 5 | Qoder | MCP/subagent | certain | 2026-06-08 | G3 resolved: both Party READMEs rewritten from source audit to match current implementation; G9 and G10 registered from gap sweep |

## Previous Agent Handoff

Iteration 5 resolved G3 (README alignment). Both `PartyOverlay.README.md` and `PartyPane.README.md` were audited against source and rewritten to document all current props, sub-components, integration points, and rest footer behavior. `PartyPane/PartyPane.README.md` confirmed non-existent (covered by parent README). G9 (PartyMemberCard test coverage) and G10 (short rest modal parity) were registered from the bounded gap sweep. 17/17 scoped tests pass.

## Current Mission

Active task:
All T-tasks (T1â€“T5) are done. G3 and G8 are resolved. The next safe work is gap-driven:
- G5 remains blocked on human decision (roster acceptance rule for non-companion NPCs). Do not touch G5 except to keep it recorded.
- G7 (wire companion relationship data into PartyOverlay) is the next safe implementation lane, but it depends on G5 being decided first.
- G9 (add `PartyMemberCard` test coverage) is an independent test-coverage task any agent can pick up.
- G10 (short rest modal parity with long rest) is an independent UX/rules follow-up.
- G4 (missing-choice warning placement rule) is an independent adjacent follow-up.

Acceptance criteria:
- If picking up G9: add `PartyMemberCard.test.tsx` covering stat row, HP bar, spell slots, missing-choice warning, and more-button callback.
- If picking up G10: decide whether short rest needs a modal for Hit Dice spending or racial rest choices; implement or document the decision.
- If picking up G4: add explicit display rule text in NORTH_STAR for missing-choice warning placement.
- Do not touch G5 except to keep it recorded as blocked on human decision.

Key files to touch:
- docs/projects/party-ui/NORTH_STAR.md
- docs/projects/party-ui/TRACKER.md
- docs/projects/party-ui/GAPS.md
- docs/projects/party-ui/COLD_START_AGENT_PROMPT.md
- For G9: `src/components/Party/PartyPane/__tests__/PartyMemberCard.test.tsx` (new file)
- For G10: `src/components/layout/GameModals.tsx`, `src/components/Party/PartyOverlay.tsx`, potentially a new `ShortRestModal`
- For G4: `docs/projects/party-ui/NORTH_STAR.md` (display rule text)

Scoped verification:
Run the targeted Party UI tests (`npx vitest run src/components/layout/__tests__/GameModals.test.tsx`) plus `git diff --check`. For G9, also run the new `PartyMemberCard` tests.

Blocking dependencies / do-not-touch:
G5 remains blocked on human decision. Stay inside the Party UI scope and preserve existing unrelated dirty work.

Recent progress:
Iteration 5 audited both Party READMEs against source, rewrote them to match current implementation (8 props, WindowFrame host, rest footer, PartyMemberCard sub-component), confirmed the third README does not exist, registered G9 and G10 from gap sweep, and verified 17/17 scoped tests pass.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers. Keep the iteration agent ledger as one compact row per completed iteration; do not preserve old handoff transcripts in this file.
Required docs to account for before closeout:
- NORTH_STAR.md
- TRACKER.md
- GAPS.md
- COLD_START_AGENT_PROMPT.md
- DECISIONS.md
- AUDIT_OR_PROOF.md
- RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes
---END NEXT AGENT HANDOFF---

## Project Prompt Conformance Notes

Last updated: 2026-06-12

This section aligns older cold-start prompts with the shared living-project workflow without replacing the project-specific handoff above. The original handoff remains authoritative for project context; this section records the universal prompt shape that every next agent must honor.

Conformance issues repaired on 2026-06-12: missing_decisions_reference, missing_proof_reference, missing_runbook_reference.

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md

Agent identity / runtime:
Before selecting work, identify yourself and the surface you are running through. Use one of: CLI agent, application agent, browser/app-embedded agent, MCP/subagent, or unknown. Mark the classification as certain, inferred, or unknown and name the clue used.

### Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original party-ui handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/party-ui/NORTH_STAR.md
- docs/projects/party-ui/TRACKER.md
- docs/projects/party-ui/GAPS.md
- docs/projects/party-ui/COLD_START_AGENT_PROMPT.md
- docs/projects/party-ui/DECISIONS.md
- docs/projects/party-ui/AUDIT_OR_PROOF.md
- docs/projects/party-ui/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.
