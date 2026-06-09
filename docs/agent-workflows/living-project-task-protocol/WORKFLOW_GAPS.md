# Living Project Workflow Gaps

Status: active
Last updated: 2026-06-09

This file tracks gaps in the living-project workflow itself. It is not a
project blocker list. Use it only when an agent finds ambiguity, unsafe
assumption pressure, missing workflow guidance, or repeatable process friction
that could affect future iteration agents across more than one project.

Project-specific blockers still belong in the owning project's `GAPS.md`.
Cross-project product or codebase gaps still belong in
`docs/projects/GLOBAL_GAPS.md`.

## First-Read Rule

Every project iteration agent must read this file during the first document-read
step, before choosing implementation work. If active workflow gaps exist, the
agent must decide whether the active gap changes the safety of the planned
iteration and mention that decision in the final report.

## Registration Rules

Create or update a workflow gap when:

1. The shared workflow wording forces an unsafe assumption.
2. A required closeout, verification, proof, or handoff step is unclear.
3. Two or more reasonable agents could interpret the same workflow instruction
   differently.
4. The workflow lacks guidance for a recurring process situation.
5. A project iteration is blocked by process ambiguity rather than by the
   project itself.

Do not create a workflow gap when:

1. The issue only concerns one project's product scope or implementation.
2. The agent simply ran out of time or context.
3. The problem is already covered by a project `GAPS.md` entry.
4. The agent dislikes a workflow step but can still follow it safely.

## +1 Testimony Rules

Agents may add a `+1` only when they personally encountered the same workflow
problem. Each testimony must include:

1. date
2. project or task context
3. what the agent was trying to do
4. the ambiguous or unsafe workflow point
5. why this is the same gap, not a new one
6. what assumption was avoided or made

Do not add anonymous vote counts. The testimony is the evidence.

## Dashboard Severity

- `blocking`: stop launching more iteration agents until this is clarified.
- `high`: agents may continue, but dispatchers should review before broad runs.
- `medium`: workflow refinement needed; safe to continue with caution.
- `low`: clarity or ergonomics issue.

## Active Workflow Gaps

| ID | Status | Severity | Workflow Area | Issue | Testimonies | Next Action | Owner | Last Updated |
|---|---|---|---|---|---|---|---|---|
| _None_ | _n/a_ | _n/a_ | _n/a_ | No active workflow gaps after WFG-001 resolution. | _n/a_ | Keep checking this file during each iteration. | _n/a_ | 2026-06-09 |

### WFG-001 - Living-project file paths still point at moved or stale locations

Status: resolved
Severity: medium
Workflow area: Start Of Iteration
Opened: 2026-06-05
Last updated: 2026-06-09

#### Problem

The living-project instructions and some cold-start prompts still name shared
workflow files at stale top-level paths, but the canonical files now live under
`docs/agent-workflows/living-project-task-protocol/` and
`docs/projects/PROJECT_CARD_SCHEMA.md`. A first-read agent has to hunt for the
actual files before it can follow the workflow.

#### Why This Is Workflow-Level

This affects every project that uses the living-project iteration workflow, not
just one project handoff.

#### Current Safe Handling

If a named top-level path is missing, resolve the canonical moved path and keep
going. Do not assume the workflow itself is broken; log the mismatch here so it
can be cleaned up centrally.

#### Testimonies

- 2026-06-05 | docs/projects/puzzles iteration pass | Codex: I was told to read
  shared workflow files at top-level paths that do not exist, had to locate the
  moved protocol package manually, and avoided assuming the prompt was only a
  project-local issue.
- 2026-06-05 | docs/projects/racial-mechanics docs-only iteration | Codex: I
  hit the same stale-path problem while following the living-project rollout,
  resolved it by using the canonical
  `docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md`
  path, and avoided assuming the missing top-level path meant the workflow was
  broken.
- 2026-06-05 | docs/projects/religion docs-only iteration | Codex: I was
  asked to read the shared workflow files by their moved canonical locations,
  had to correct the stale-path mismatch before proceeding, and avoided
  assuming the missing top-level path meant the project docs themselves were
  broken.
- 2026-06-05 | docs/projects/roadmap-maintenance docs-only iteration | Codex: I
  was asked to read the shared workflow files by stale top-level names, had to
  resolve the moved `docs/agent-workflows/living-project-task-protocol/` paths
  manually, and avoided assuming the project-local docs were at fault.
- 2026-06-05 | docs/projects/scripts-workflows docs-only iteration | Codex: I
  was refreshing the living-project packet and again hit the stale top-level
  path mismatch before using the canonical
  `docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md`
  and `docs/projects/PROJECT_CARD_SCHEMA.md` paths; I treated it as the same
  workflow-level gap and avoided assuming the project docs were broken.
- 2026-06-05 | docs/projects/realmsmith-service docs-only iteration | Codex: I
  was asked to follow top-level shared workflow paths that do not exist in this
  workspace, resolved the canonical moved paths manually, and avoided assuming
  the project packet or workflow package was broken before I found the
  relocated files.
- 2026-06-05 | docs/projects/scripts-quality docs-only iteration | Codex: I
  was asked to read the shared living-project files, had to resolve the moved
  `docs/agent-workflows/living-project-task-protocol/` and
  `docs/projects/PROJECT_CARD_SCHEMA.md` paths before continuing, and avoided
  assuming the project docs were wrong when the workflow references were
  stale.
- 2026-06-07 | docs/projects/documentation-cleanup iteration 2 | Qoder: I
  followed the cold-start prompt to the shared workflow files, had to use the
  canonical `docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md`
  and `docs/projects/PROJECT_CARD_SCHEMA.md` paths, and additionally found that
  the PROJECT_TRACKER.md Documentation Cleanup row itself linked to the stale
  `docs/tasks/documentation-cleanup/` path instead of the living-project surface.
  Corrected the link as part of this iteration's G4 gap. Avoided assuming the
  stale link meant the project was not registered.

#### Proposed Workflow Refinement

Update the shared instructions and cold-start prompts to name the canonical
paths explicitly, and note that the entry-point file is a pointer rather than a
replacement for the moved workflow package.

#### Resolution

Resolved on 2026-06-09 by updating
`docs/agent-workflows/living-project-task-protocol/README.md` with an explicit
Canonical Aralia Paths section and by confirming current project
`COLD_START_AGENT_PROMPT.md` files use the canonical
`docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md`,
`docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`, and
`docs/projects/PROJECT_CARD_SCHEMA.md` references. Historical copied text in
older project docs may still mention generic template filenames, but the active
shared workflow and active handoff path now point agents at canonical files.

## Resolved Workflow Gaps

| ID | Status | Severity | Workflow Area | Issue | Resolution | Last Updated |
|---|---|---|---|---|---|---|
| WFG-001 | resolved | medium | Start Of Iteration | Shared living-project docs still pointed at moved or stale canonical paths. | Added explicit Canonical Aralia Paths to the protocol README and verified active handoffs use canonical workflow/schema paths. | 2026-06-09 |

## Gap Detail Template

Copy this block when opening a new workflow gap.

```markdown
### WFG-001 - Short issue title

Status: open
Severity: medium
Workflow area: Start Of Iteration / Choose The Work / Verification Standard / Bounded Gap Sweep / Required Closeout Updates / End Of Iteration Response
Opened: 2026-06-04
Last updated: 2026-06-04

#### Problem

What workflow wording, missing rule, or repeated process situation is unsafe or
ambiguous?

#### Why This Is Workflow-Level

Explain why this is not merely a project-specific blocker.

#### Current Safe Handling

What should an agent do until the workflow is clarified?

#### Testimonies

- 2026-06-04 | project-or-task | agent/session: What happened, why this
  matches the gap, and what assumption was avoided or made.

#### Proposed Workflow Refinement

What rule, wording, dashboard signal, template change, or closeout requirement
would remove the ambiguity?
```
