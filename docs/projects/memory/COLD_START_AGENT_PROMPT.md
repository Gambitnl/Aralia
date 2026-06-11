---
schema_version: 1
handoff_type: agent_to_agent
project: Memory System
slug: memory
status: active
last_updated: "2026-06-09"
iteration: 6
source_agent: Helmholtz / gpt-5.4-mini high
target_agent: next cold-start agent
runtime_surface: "MCP-subagent + local foreman verification"
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/memory/NORTH_STAR.md
tracker: docs/projects/memory/TRACKER.md
gaps: docs/projects/memory/GAPS.md
---
# Memory System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-09

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/memory/NORTH_STAR.md

agent_comments: none

---BEGIN NEXT AGENT HANDOFF---
## Iteration Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 6 | Helmholtz / gpt-5.4-mini high | MCP-subagent + local foreman verification | certain | 2026-06-09 | Advanced G4 by adding first-contact recency coverage in `handleNpcInteraction.ts`. |
| 5 | Helmholtz / gpt-5.4-mini high | MCP-subagent + local foreman verification | certain | 2026-06-09 | Closed the egregious witness-gossip recency slice in Memory G4 and kept remaining combat/ritual branches open. |

Project: Memory System
Project folder: docs/projects/memory
Iteration: 6

Previous agent context:
- Iteration 3 closed G5 by routing active Gemini formatting to `src/utils/world/memoryUtils.ts`.
- This pass kept the deprecated bridge fenced and then moved G4 forward by stamping interaction recency in the direct social-check branch, the first-contact branch, the targeted custom-prompt branch that attaches to an NPC, and the egregious witness-gossip branch.
- The action-to-memory matrix now has source-backed coverage for talk, first-contact, social-check, egregious witness gossip, movement gossip, world-event maintenance, and reducer writes.

Current mission:
Active task:
G4 - continue action-to-memory coverage for the remaining combat and ritual branches

Acceptance criteria:
- G1-G4 remain the only open Memory gaps in the tracker.
- The direct social-check branch, the first-contact branch, the targeted custom-prompt branch that attaches to an NPC, and the egregious witness-gossip branch write `UPDATE_NPC_INTERACTION_TIMESTAMP` in addition to disposition and fact writes.
- The Memory docs contain a source-backed action-to-memory coverage matrix.
- `git diff --check` passes on touched files.
- Focused handler tests pass for the social-check, first-contact, targeted prompt, and egregious witness-gossip recency paths.

Key files:
- `src/hooks/actions/handleGeminiCustom.ts`
- `src/hooks/actions/__tests__/handleGeminiCustom.test.ts`
- `src/hooks/actions/handleNpcInteraction.ts`
- `src/hooks/actions/__tests__/handleNpcInteraction.test.ts`
- `docs/projects/memory/NORTH_STAR.md`
- `docs/projects/memory/TRACKER.md`
- `docs/projects/memory/GAPS.md`
- `docs/projects/memory/DECISIONS.md`
- `docs/projects/memory/AUDIT_OR_PROOF.md`
- `docs/projects/memory/RUNBOOK.md`

Verification:
- `npm test -- --run src/hooks/actions/__tests__/handleNpcInteraction.test.ts`
- `git diff --check`
- `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/actions/handleNpcInteraction.ts`
- `node scripts/audit-living-project-docs.cjs`

Blockers:
- No review gate on G4; the remaining branches are implementation work, not a human decision gate.
- G1 schema normalization is still open, but it does not block the recency stamp slice already landed.

Recent progress:
- Routed the direct social-check branch through the memory timestamp action, then extended the same recency rule to the first-contact branch, the targeted custom-prompt branch that attaches to an NPC, and the egregious witness-gossip branch.
- Added a focused handler test proving the new recency dispatch for the first-contact slice while keeping the earlier recency proofs intact.
- Reflected the partial closures in the tracker, gap registry, audit log, and North Star matrix.

Workflow-gap review:
- Reviewed `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`; no new workflow-level ambiguity added.

Dashboard-schema updates:
- `NORTH_STAR.md`: added the action-to-memory coverage matrix, updated the next step, and documented the social-check, first-contact, targeted prompt, and egregious witness-gossip recency slices.
- `TRACKER.md`: current state summary and G4 evidence/source now mention the partial closures and both focused handler tests.
- `GAPS.md`: G4 evidence/source now includes the focused first-contact test and the remaining combat and ritual branches are described more precisely.
- `AUDIT_OR_PROOF.md`: added the latest proof row for the first-contact recency slice.

Required docs:
- Accounted for `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, `COLD_START_AGENT_PROMPT.md`, `DECISIONS.md`, `AUDIT_OR_PROOF.md`, and `RUNBOOK.md`.

Optional docs:
- `tasks/`, architecture notes, migration notes, and project-specific proof notes were not present and were not needed.

Agent comments:
- none

Next safe resume action:
- Continue G4 action-to-memory coverage for the remaining combat and ritual branches. If schema normalization turns into the next blocking prerequisite, reroute to G1 instead of guessing.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers; do not preserve old handoff transcripts in this file.

Final response must report:
- files updated
- files intentionally not updated
- verification performed or skipped
- bounded gap sweep surfaces checked
- project gaps recorded
- workflow gaps read or updated
- dashboard schema fields updated
- required docs accounted for
- optional docs touched, skipped, or not present
- documentation compaction performed or not needed
- agent comments added or intentionally left empty
- assumptions made
- next safe resume action
---END NEXT AGENT HANDOFF---
