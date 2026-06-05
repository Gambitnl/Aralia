# Living Project Workflow Gaps

Status: active
Last updated: 2026-06-04

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
|---|---|---|---|---|---:|---|---|---|

## Resolved Workflow Gaps

| ID | Status | Severity | Workflow Area | Issue | Resolution | Last Updated |
|---|---|---|---|---|---|---|

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
