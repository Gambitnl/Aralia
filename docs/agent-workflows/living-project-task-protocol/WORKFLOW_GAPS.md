# Living Project Workflow Gaps

Status: active
Last updated: 2026-06-22

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
| _None_ | _n/a_ | _n/a_ | _n/a_ | No active workflow gaps after WFG-008 resolution. | _n/a_ | Keep checking this file during each iteration. | _n/a_ | 2026-06-22 |

### WFG-002 - Routing projects have no required write obligation into owner project docs

Status: resolved
Severity: medium
Workflow area: Bounded Gap Sweep / Required Closeout Updates
Opened: 2026-06-10
Last updated: 2026-06-10

#### Problem

When a project like `code-modularization-audit` routes a gap to an owner project
(e.g. "route CMA-G17 to layout"), the workflow only says to record the routing
in the source project's `GAPS.md`. It does not require the routing agent to also
write a stub row into the owner project's `GAPS.md`. The result is that the
route exists only in the routing project's docs. An agent working on `layout`
has no way to discover it through normal workflow steps.

This was confirmed by scanning all six owner GAPS.md files for CMA-G14..G19:
none of them contain a row referencing the inbound route, even though CMA marked
all six as "routed" in June 2026.

#### Why This Is Workflow-Level

This affects every project that acts as a routing source (code-modularization-audit,
global gaps, architecture sweep, etc.) across all owner projects. Any routing
project that follows the current workflow instructions faithfully will produce
the same invisible-route problem.

#### Current Safe Handling

When a routing agent records a gap as "routed" to an owner project, it should
also write a minimal stub gap row directly into the owner project's `GAPS.md`
at the same time. The stub must include: gap ID (cross-referencing the source
gap), classification `adjacent_follow_up`, owner, source evidence path, why it
matters, and next action. Do not wait for the owner project's agent to discover
the route on their own.

#### Testimonies

- 2026-06-10 | docs/projects/code-modularization-audit iteration 5 | Amazon Q:
  I ran the owner-acceptance scan for CMA-G14..G19 and found that none of the
  six owner GAPS.md files contain a row referencing their inbound CMA route,
  despite the routing project marking them "routed" in a prior iteration. The
  workflow has no rule that required the routing agent to write anything into
  the owner docs. I avoided assuming the owner projects had failed; the
  routing project simply had no obligation to push the route.

#### Proposed Workflow Refinement

Add a rule to the "Required Closeout Updates" section:

> When a gap is marked `routed` to an owner project, the routing agent must
> also write a stub gap row into the owner project's `GAPS.md` in the same
> iteration. The stub must cross-reference the source gap ID, name the
> classification, owner, evidence, why it matters, and next action. A routed
> gap is not complete until the owner stub exists.

#### Resolution

Resolved on 2026-06-10 by updating the protocol README, shared iteration
workflow, and gap templates. Routing agents must now write a minimal inbound
stub row into the destination owner's `GAPS.md` when marking a gap as routed,
or explicitly record why the stub could not be written. The rule now appears in
the README Global Gap Routing and Iteration Pass Closing Rule sections, the
shared workflow Required Closeout Updates section, and the `GAPS.md` /
`GLOBAL_GAPS.md` templates.

---

### WFG-003 - Owner-project agents have no required inbound-route discovery step

Status: resolved
Severity: medium
Workflow area: Bounded Gap Sweep
Opened: 2026-06-10
Last updated: 2026-06-10

#### Problem

The bounded gap sweep in the shared workflow tells agents to check their own
`GAPS.md`, `GLOBAL_GAPS.md`, and `WORKFLOW_GAPS.md`. It does not tell owner-project
agents to check whether any routing project (code-modularization-audit,
architecture sweep, global gaps) has an open row naming their project as the
destination owner.

Even if WFG-002 is fixed and routing agents do write stubs into owner docs, an
owner agent could still miss the stub if they do not read their own full
`GAPS.md` before choosing work. The current sweep instruction says "this
project's GAPS.md" but does not explicitly call out inbound cross-project rows
as a required check category.

#### Why This Is Workflow-Level

This affects every owner-project agent operating under the living-project
workflow. Without an explicit inbound-route discovery step, routing signals from
any routing project are silently invisible to the agents who need to act on them.

#### Current Safe Handling

During the bounded gap sweep, explicitly search the project's `GAPS.md` for any
row whose evidence path or owning-tracker field references a routing project
(e.g. `code-modularization-audit`, `GLOBAL_GAPS.md`, `architecture`). Treat any
unacknowledged inbound route as an `adjacent_follow_up` gap if it is not already
represented.

#### Testimonies

- 2026-06-10 | docs/projects/code-modularization-audit iteration 5 | Amazon Q:
  I reviewed all six owner project GAPS.md files (three-d-modal, battle-map,
  submap, layout, combat, scripts-audits) and confirmed that none of them
  contain a row for their respective CMA-G14..G19 inbound route. Their bounded
  gap sweeps would not surface these routes under the current workflow rules
  because the routes were never written into their docs (WFG-002) and the sweep
  does not require checking routing-project sources (this gap). Both problems
  are needed together to close the discovery path.

#### Proposed Workflow Refinement

Add a step to the "Bounded Gap Sweep" section:

> Also check whether any known routing project (`code-modularization-audit`,
> `docs/projects/GLOBAL_GAPS.md`, architecture sweep, or similar) has an open
> row naming this project as the destination owner that is not yet reflected
> in this project's `GAPS.md`. If found, add a stub row or acknowledge the
> inbound route explicitly before closing the sweep.

#### Resolution

Resolved on 2026-06-10 by adding inbound-route discovery to the bounded gap
sweep in both the protocol README and shared iteration workflow. Iteration
agents must now check known routing projects, including
`code-modularization-audit`, architecture sweep docs, global gaps, roadmap
reviews, or any tracker/gap file that names the current project as destination
owner. The cold-start prompt template now includes this sweep requirement so
project-specific handoffs carry the same discovery rule.

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

### WFG-004 - Cold-start "active task: None" is ambiguous between stop and pick-up-next

Status: resolved
Severity: medium
Workflow area: Choose The Work / Idle Mission
Opened: 2026-06-10
Last updated: 2026-06-10

#### Problem

When a cold-start handoff says `Current Mission: None for G1` (or any "no
active task" phrasing), agents read it as a hard stop: preserve state, do not
touch implementation, do not pick up new work. The intended behavior is a
two-phase sequence:

1. **Scan phase** (always runs): read the workflow, North Star, Tracker, Gaps,
   and this file; orient to current state.
2. **Decision gate**: if an active task exists, execute it. If not, scan the
   project's `GAPS.md`, `GLOBAL_GAPS.md`, and `WORKFLOW_GAPS.md` for the next
   actionable item.
3. **Build phase**: pick up the selected gap as the new active task and execute
   it.

The current wording gives step 1 but does not explicitly trigger step 2 â†’ 3
when the mission is empty, so agents stop after step 1.

#### Why This Is Workflow-Level

This affects every living-project cold-start handoff where the prior iteration
closed its active task but did not pre-assign the next one. Any project in
"active" status with an empty mission field will produce the same stop-short
behavior across all future iteration agents.

#### Current Safe Handling

When the cold-start mission reads as "None" or empty, treat that as a trigger
to perform the scan â†’ gate â†’ pick-up â†’ build sequence. Record the picked-up
gap as the new active task in the iteration handoff before executing. If no
actionable gap is found, register the idle state per WFG-005 instead of
silently ending the iteration.

#### Testimonies

- 2026-06-10 | docs/projects/crafting iteration 6 review | Qoder CLI: Reading
  the crafting cold-start prompt, I interpreted "Current Mission: None for G1"
  as a directive to hold and not build, and reported the correct action as
  "verification and gap routing, not code changes." The user confirmed the
  intended behavior was scan-first, then build. Avoided assuming the idle
  mission meant the project was done; the ambiguity is in the handoff wording,
  not the project state.

#### Proposed Workflow Refinement

Update the cold-start prompt template's "Current Mission" section to include
an explicit two-branch instruction:

> If the active task field is "None" or empty, the agent must still complete
> the scan phase, then pick up the next actionable gap from the project's
> `GAPS.md`, `GLOBAL_GAPS.md`, or `WORKFLOW_GAPS.md` as the new active task.
> If no actionable gap exists, register the project idle per WFG-005.

And update the shared `ITERATION_AGENT_WORKFLOW.md` "Choose The Work" step to
state the scan â†’ gate â†’ pick-up â†’ build sequence explicitly, so the idle
mission is not a terminal state.

#### Resolution

Resolved on 2026-06-10 by updating the shared iteration workflow, protocol
README, and cold-start prompt template. The Choose The Work step now requires a
scan phase before declaring no work, treats `None` or empty active-task fields
as a decision gate, requires agents to pick the next actionable project/global/
workflow gap when one exists, and records the selected item as the new active
task before execution. The cold-start template now carries the same instruction
inside Current Mission so project handoffs do not read as terminal when the
prior agent left no assigned task.

---

### WFG-005 - Active projects with no actionable gaps have no idle-status registration

Status: resolved
Severity: medium
Workflow area: End Of Iteration Response / Project Status
Opened: 2026-06-10
Last updated: 2026-06-10

#### Problem

When a project's status is `active` but a cold-start agent (after performing
the WFG-004 scan â†’ gate â†’ pick-up sequence) finds no actionable gap in the
project's `GAPS.md`, `GLOBAL_GAPS.md`, or `WORKFLOW_GAPS.md`, the workflow
gives no way to record that outcome. The project stays `active`, the next
handoff still says `status: active`, and the next iteration agent repeats the
same empty scan. The project is functionally idle but the dashboard and
tracker have no field that says so.

#### Why This Is Workflow-Level

This affects any long-running living project that has closed its known gaps
but is not yet done as a product. Without an idle status, the project keeps
appearing on active dashboards, keeps triggering cold-start iterations that
do nothing, and silently hides the fact that it is waiting for new evidence
rather than active work.

#### Current Safe Handling

Until an idle status is defined, when the scan finds no actionable gap, the
iteration agent should record the "no gaps found" outcome explicitly in the
cold-start handoff's `Recent progress` and `Current Mission` fields, and note
the idle state in the iteration ledger. Do not change the project status to
`done` or `dormant` without human confirmation â€” but do surface the idle
signal so dispatchers see it.

#### Testimonies

- 2026-06-10 | docs/projects/crafting iteration 6 review | Qoder CLI: After
  the crafting G1 compatibility proof closed and G5 remained blocked, the
  project is functionally idle â€” no actionable gaps, but the status stays
  `active` and the handoff keeps producing "preserve and wait" iterations.
  Avoided assuming the project was done; the state is "waiting for evidence,"
  which the schema has no place to record.

#### Proposed Workflow Refinement

Add an `idle` status value to the project card schema
(`docs/projects/PROJECT_CARD_SCHEMA.md`) with defined semantics distinct from
`active`, `paused`, and `done`:

- `idle`: project is alive and may be resumed, but no actionable gap exists
  right now. Cold-start agents should not launch new iterations unless a new
  gap is registered.

Also update `docs/projects/PROJECT_TRACKER.md` and the cold-start prompt
template to recognize `idle` as a valid project status and to require the
registering agent to write the idle transition into the handoff's `Recent
progress` and `Current Mission` fields when moving a project from `active`
to `idle`.

#### Resolution

Resolved on 2026-06-10 by defining `idle` in the shared protocol status
vocabulary, adding it to `docs/projects/PROJECT_CARD_SCHEMA.md`, adding it to
the `docs/projects/PROJECT_TRACKER.md` legend, and updating the shared workflow
and cold-start prompt template with idle-registration rules. When no actionable
project, global, or workflow gap exists after the required scan, agents must
mark the project `idle`, record the checked surfaces and resume trigger in the
North Star/tracker/handoff/project tracker row when applicable, and avoid
marking the project done, dormant, or paused without source evidence or human
direction.

---

### WFG-006 - Agents are not required to look for expansion opportunities continuously

Status: resolved
Severity: medium
Workflow area: Choose The Work / Bounded Gap Sweep / End Of Iteration Response
Opened: 2026-06-10
Last updated: 2026-06-10

#### Problem

The living-project workflow says to preserve future possibility and record
adjacent findings, but it mostly frames discovery as a bounded closeout sweep.
Agents can follow the workflow faithfully while treating expansion discovery as
optional or only end-of-iteration bookkeeping. That encourages narrow execution
and makes agents miss opportunities to grow the project safely while evidence
is fresh.

#### Why This Is Workflow-Level

This affects every living project. The protocol exists to preserve expanding
tasks and future optionality, so expansion discovery cannot depend on each
agent's personal initiative. It needs to be a required behavior that coexists
with bounded execution.

#### Current Safe Handling

Agents should maintain an expansion radar during execution. When a source file,
doc, test, proof result, or integration point reveals a new capability,
project slice, reusable system, automation target, adjacent owner task, or
scope boundary worth preserving, the agent should classify it with the normal
gap classifications and record it in the owning project tracker, project
`GAPS.md`, or `docs/projects/GLOBAL_GAPS.md`. This does not authorize widening
the active slice unless the finding is `in_scope_now` or `support_needed_now`.

#### Testimonies

- 2026-06-10 | living-project protocol ownership | User/operator: Noted that
  agents seem not to look for opportunities to expand at all times and
  identified that as a workflow gap. This matches the protocol-level problem
  because it affects the default behavior of every future iteration agent, not
  one project's product scope.

#### Proposed Workflow Refinement

Add a continuous expansion-radar rule to the shared workflow, protocol README,
and cold-start prompt template. Require agents to report expansion
opportunities found, routed, or explicitly not found in the final response.
Clarify that expansion discovery records future work but does not widen the
active slice unless the opportunity is required now.

#### Resolution

Resolved on 2026-06-10 by adding a Continuous Expansion Radar section to the
shared iteration workflow, adding expansion-radar language to Choose The Work,
Bounded Gap Sweep, and End Of Iteration Response, updating the protocol README
During The Task and Gap Classification sections, and adding expansion-radar
instructions to the cold-start prompt, GAPS template, and living tracker
template. Agents must now actively look for source-backed expansion
opportunities during execution, route them to the right tracker, and report
whether any were found without inventing speculative work.

---

### WFG-007 - Project dashboard lacks explicit active agent pass telemetry

Status: resolved
Severity: medium
Workflow area: Start Of Iteration / Required Closeout Updates / Project Dashboard Schema
Opened: 2026-06-15
Last updated: 2026-06-15

#### Problem

The workflow required agents to identify themselves in prose, but it did not
require a structured dashboard-visible record of the active agent, pass start
time, pass status, or pass end time. A project could therefore appear current
while no tile or schema field showed who was currently working on it, when the
pass started, whether it was blocked or finished, or whether a previous pass
was left half-open.

#### Why This Is Workflow-Level

This affects every living project that uses the shared dashboard and
cold-start handoff. It is not a product gap inside one project; it is a missing
workflow contract between iteration agents, project docs, and the project
tracker UI.

#### Current Safe Handling

At the start of a pass, after reading enough handoff metadata to identify the
project files and after identifying itself, the agent should update dashboard
schema fields in `NORTH_STAR.md` or `TRACKER.md`: `active_agent`,
`agent_pass_status: in_progress`, `agent_pass_started_at`, and an empty
`agent_pass_ended_at`. At closeout, the agent should keep the owner and start
time, set `agent_pass_status` to the true final pass state, and set
`agent_pass_ended_at`.

#### Testimonies

- 2026-06-15 | project tracker dashboard browser review | User/operator:
  Selected the project-row metric strip and requested explicit workflow,
  schema, and UI support for active agent name, task start time, pass status,
  and end time. This is workflow-level because it changes what every project
  iteration agent must write before and after work, and what the dashboard
  should surface.

#### Proposed Workflow Refinement

Add pass telemetry fields to `docs/projects/PROJECT_CARD_SCHEMA.md`, render
them in the project tracker UI/template, and update the shared workflow and
cold-start prompt template so agents set pass-start fields before deeper
project reading or task selection and set pass-end fields during closeout.

#### Resolution

Resolved on 2026-06-15 by adding `active_agent`, `agent_pass_status`,
`agent_pass_started_at`, and `agent_pass_ended_at` to the project dashboard
schema; rendering active agent, pass status, start time, and end time tiles in
the project tracker UI and template data; and updating the README, shared
iteration workflow, and cold-start prompt template with start-of-pass and
closeout requirements.

### WFG-008 - Passive sweep bias misses adjacent component flaws (needs active chaos testing)

Status: resolved
Severity: medium
Workflow area: Bounded Gap Sweep / Choose The Work / End Of Iteration Response
Opened: 2026-06-22
Last updated: 2026-06-22

#### Problem

The warning against "inventing gaps just to satisfy the count" and the suggestion to focus sweeps on "touched files only" creates a systemic bias. When performing a bounded gap sweep, agents tend to only audit files they have directly modified during the iteration. As a result, they may declare a project "gap-free" (or recommend it go `idle`), missing pre-existing bugs or incomplete features in unedited but closely related/adjacent files in the same project.

Without active, adversarial probing—or **chaos testing** of system boundaries—agents default to a passive, static inspection of their own code changes. They assume adjacent code works correctly, missing hidden integration failures and logic gaps in untouched files.

#### Why This Is Workflow-Level

This is a cognitive and process bias induced by the shared workflow guidelines. It affects all living projects. If the workflow encourages agents to look only at their own modified code, they will consistently fail to see adjacent debt, causing projects to be falsely flagged as "idle" or "gap-free".

#### Current Safe Handling

When performing a gap sweep, agents must actively scan adjacent or closely coupled components, integration boundaries, and recent commits in the project, rather than strictly limiting sweeps to the files they modified. They must engage in active **chaos testing** (e.g., executing actions in invalid states, triggering buttons in unexpected sequences, simulating missing state values) to explicitly verify that system boundaries are resilient.

#### Testimonies

- 2026-06-22 | docs/projects/party-ui iteration 9 | Gemini:
  I performed a sweep and initially claimed the project was gap-free because I only focused on the files I touched. When prompted by the user to look closer and audit adjacent components, I discovered two severe open bugs: resting mid-combat (G11) and warning card UI rendering only the first issue (G12). Focus on touched-files-only created a systemic blind spot that was only resolved by actively auditing and attempting to break adjacent behaviors.

#### Proposed Workflow Refinement

Update the "Bounded Gap Sweep" guidelines to specify that declaring a project "gap-free" or "idle" requires performing active **chaos testing** of the system's integration points, state boundaries, and edge cases. Instead of restricting audits to static analysis or touched files, agents must actively attempt to break the UI or state machine by testing combinations of state and actions in adjacent modules. A project cannot be declared gap-free without documenting these active edge-case and chaos testing vectors.

#### Resolution

Resolved on 2026-06-22 by updating the shared iteration workflow, protocol
README, cold-start prompt template, project dashboard schema, and gap/tracker
templates. The workflow now requires active edge-case or chaos probes against
adjacent components, shared state, integration points, recent project changes,
invalid states, unusual action order, missing/stale data, and
disabled/loading/error states before an agent may claim no additional gaps,
gap-free, or idle. Final reports and handoffs must name the checked adjacent
surfaces and probe vectors; static reading of touched files is no longer
enough to support an idle/no-gap claim.

## Resolved Workflow Gaps

| ID | Status | Severity | Workflow Area | Issue | Resolution | Last Updated |
|---|---|---|---|---|---|---|

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

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md","sha256WithoutMarker":"89ff064a82aa77aefb755a0b75bdc9a057a6c5f548f6b77e4dc0560b9b988d9d","markedAtUtc":"2026-06-25T22:54:19.191Z"} -->
