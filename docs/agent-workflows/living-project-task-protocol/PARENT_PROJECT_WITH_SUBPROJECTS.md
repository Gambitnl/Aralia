# Parent Project With Subprojects Protocol

Status: agent-facing creation and onboarding protocol.

Audience: agents creating, upgrading, or onboarding a broad living project that
needs durable child lanes under one parent project.

Use this protocol after reading `README.md` in this workflow package and
`docs/projects/PROJECT_CARD_SCHEMA.md`. This file explains the parent/child
shape; the living-project protocol still owns the general rules for project
conversion, gap routing, evidence boundaries, and iteration closeout.

## When To Use `parent_with_subprojects`

Use `project_mode: parent_with_subprojects` when a project is broad enough that
one parent pass would be misleading, but the child lanes still belong under one
durable owner.

Good signals:

1. The owner needs one umbrella project to preserve purpose, boundaries, and
   routing.
2. The work has multiple durable lanes that future agents may execute
   independently.
3. Existing task folders or project rows point at the same broad area and need
   to be folded under one parent.
4. Some related work is linked support or an adjacent dependency, not owned
   child work.
5. The dashboard should show a scoped child-lane list with filters, not a fake
   parent iteration.

Do not use this mode when:

1. A single living project can honestly own the next pass.
2. The lanes have separate top-level owners and should not share one parent.
3. The request only needs one tracker row or one gap row.
4. The parent would become a dumping ground for unrelated work.

## Parent Ownership Model

The parent owns routing. Child packets own execution.

Parent owns:

1. Overarching purpose and scope boundaries.
2. Child-lane registry health.
3. Owned-lane versus linked-support decisions.
4. Imported parent-owned gaps.
5. Parent dashboard/schema fields.
6. Proof that routing, child setup links, and support boundaries are current.

Child subproject packets own:

1. Active implementation or audit passes.
2. Iteration/pass telemetry.
3. Child-specific tracker rows.
4. Child-specific gaps.
5. Runtime, audit, rendered, or document proof for that lane.
6. The cold-start handoff for agents working directly in the lane.

Linked support projects own their own files, gaps, and execution history. The
parent records why the support project matters and imports only findings that
become parent-owned product or routing gaps.

## Parent File Set

Create the parent folder at:

```text
docs/projects/<parent-slug>/
```

Recommended parent files:

```text
NORTH_STAR.md              <- overarching purpose, boundaries, child map
TRACKER.md                 <- parent routing decisions and lane status summary
GAPS.md                    <- parent-owned gaps and imported child/support gaps
COLD_START_AGENT_PROMPT.md <- parent onboarding and child-lane selection prompt
SUBPROJECTS.md             <- required child-lane registry
DECISIONS.md               <- ownership, linked-support, and import decisions
AUDIT_OR_PROOF.md          <- proof that routing and child links are current
RUNBOOK.md                 <- optional parent maintenance workflow
subprojects/               <- owned child packets
```

The parent docs should read as overarching routing and ownership documents, not
as normal child execution docs.

## Parent Dashboard Frontmatter

In the parent `NORTH_STAR.md`, set the living-project schema fields required by
`docs/projects/PROJECT_CARD_SCHEMA.md`.

Minimum parent-specific fields:

```yaml
project_mode: parent_with_subprojects
subproject_tracker: docs/projects/<parent-slug>/SUBPROJECTS.md
subproject_count: <number of active or tracked child/support rows>
subproject_signal: "<short dashboard summary>"
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - SUBPROJECTS.md
```

For parent projects, the parent-level agent/pass telemetry can stay empty unless
an agent is changing the parent routing surface itself:

```yaml
active_agent: ""
agent_pass_status: ""
agent_pass_started_at: ""
agent_pass_ended_at: ""
```

Do not invent `iteration: 1` for a parent if no single parent pass can advance
all child lanes. Use child packet telemetry for executable work.

## `SUBPROJECTS.md` Registry Shape

Create `docs/projects/<parent-slug>/SUBPROJECTS.md` with frontmatter and the
canonical table shape.

```markdown
---
schema_version: 1
subproject_schema: project_subproject_registry
project: <Parent Project Name>
slug: <parent-slug>
status: active
last_updated: YYYY-MM-DD
parent_project: docs/projects/<parent-slug>/NORTH_STAR.md
subproject_count: 0
owned_lane_count: 0
linked_support_count: 0
adjacent_dependency_count: 0
highest_priority: ""
proof_freshness: initial
---
# <Parent Project Name> Subproject Registry

Status: active
Last updated: YYYY-MM-DD

## Purpose

Use this registry to choose the correct child lane before editing files or
adding parent gaps.

## Owned And Linked Subprojects

| Subproject ID | Project setup | Status | Relationship | Scope | Existing project/task evidence | Current gap IDs | Next high-impact slice | Proof boundary | Notes |
|---|---|---|---|---|---|---|---|---|---|
```

Relationship values:

1. `owned lane`: belongs under the parent and should route future work through
   a child packet in `subprojects/`.
2. `linked support`: helps the parent, but stays owned by another project.
3. `adjacent dependency`: affects the parent, but is not a child lane.

Status values can be plain language, but prefer stable names such as `active`,
`waiting`, `linked support`, `adjacent dependency`, `done`, and `out of scope`.

## Child Packet Setup

For every owned lane, create a full child packet:

```text
docs/projects/<parent-slug>/subprojects/<child-slug>/
  NORTH_STAR.md
  TRACKER.md
  GAPS.md
  COLD_START_AGENT_PROMPT.md
  DECISIONS.md
  AUDIT_OR_PROOF.md
  RUNBOOK.md
```

Each child `NORTH_STAR.md` should include:

```yaml
schema_version: 1
project: <Parent> / <Child>
slug: <child-slug>
project_mode: subproject
parent_project: docs/projects/<parent-slug>/NORTH_STAR.md
subproject_registry: docs/projects/<parent-slug>/SUBPROJECTS.md
status: active
iteration: 0
active_agent: ""
agent_pass_status: not_started
agent_pass_started_at: ""
agent_pass_ended_at: ""
```

The child North Star should explain:

1. Why the lane exists under the parent.
2. What the lane owns.
3. What the lane must not absorb.
4. Which parent registry row points to it.
5. Which files or systems prove current state.
6. The next executable slice.
7. The proof required before marking a child task done.

Use the child `TRACKER.md`, `GAPS.md`, `COLD_START_AGENT_PROMPT.md`,
`DECISIONS.md`, `AUDIT_OR_PROOF.md`, and `RUNBOOK.md` like a normal living
project packet. The child is the unit an implementation agent can execute.

## Linked Support Handling

Do not create a fake child packet for linked support unless the support work is
actually being onboarded as an owned child lane.

For linked support rows:

1. Point `Project setup` at the support project's real North Star.
2. Set `Relationship` to `linked support`.
3. Explain which support findings may be imported into the parent.
4. Keep support-project gaps in the support project unless they change
   parent-owned product behavior or parent routing.
5. If importing a support finding, add a parent `GAPS.md` row with explicit
   source evidence and a proof boundary.

For adjacent dependencies:

1. Do not put them under `subprojects/`.
2. Record why they matter and the routing rule.
3. Route durable gaps to the owning project if they are not parent-owned.

## Onboarding Read Order

When an agent receives work for a parent project, use this read order:

1. Parent `NORTH_STAR.md`.
2. Parent `SUBPROJECTS.md`.
3. Parent `COLD_START_AGENT_PROMPT.md`.
4. The child packet named by the user, active tracker row, or highest-priority
   registry row.
5. The child `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md`.
6. Parent `DECISIONS.md` if ownership or linked-support routing is unclear.
7. Parent `AUDIT_OR_PROOF.md` if dashboard or routing proof is part of the
   task.

If the task changes only parent routing, work in the parent packet. If the task
changes behavior, data, audit output, or implementation for one lane, work in
the child packet and update the parent only for routing, imported gaps, or
summary changes.

## Verification Expectations

Before claiming setup complete:

1. Parent `NORTH_STAR.md` has `project_mode: parent_with_subprojects`.
2. Parent required docs include `SUBPROJECTS.md`.
3. Parent `SUBPROJECTS.md` exists and has the canonical table.
4. Every owned lane row points to an existing child `NORTH_STAR.md`.
5. Every child packet has at least `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`,
   and `COLD_START_AGENT_PROMPT.md`.
6. Linked support rows point to real owning project docs or clearly state why
   they are only planned.
7. Parent `GAPS.md` contains only parent-owned or explicitly imported gaps.
8. Parent `COLD_START_AGENT_PROMPT.md` tells the next agent how to choose a
   child packet.
9. `docs/projects/PROJECT_TRACKER.md` points to the parent North Star and uses
   a parent-style next action.

For UI/dashboard-facing parent work, also verify the rendered project detail
page:

1. Parent detail summary says the parent is a routing surface.
2. The scoped child dashboard renders rows from `SUBPROJECTS.md`.
3. Owned lanes and linked support are distinguishable.
4. Child rows preserve project-card details and setup links.
5. Parent docs read as overarching routing docs, not child execution docs.

## Creation Checklist

1. Confirm the work really needs a parent project.
2. Search `docs/projects/PROJECT_TRACKER.md` for existing rows to fold in.
3. Search existing docs/tasks for work that should route under the parent.
4. Choose the parent slug and folder.
5. Create or refresh parent `NORTH_STAR.md`.
6. Create parent `TRACKER.md`, `GAPS.md`, `COLD_START_AGENT_PROMPT.md`,
   `DECISIONS.md`, `AUDIT_OR_PROOF.md`, and `RUNBOOK.md` as needed.
7. Add `SUBPROJECTS.md` and fill owned, linked support, and adjacent rows.
8. Create full child packets for owned lanes.
9. Do not create child packets for linked support unless ownership actually
   moved.
10. Update `docs/projects/PROJECT_TRACKER.md` so top-level rows route through
    the parent instead of remaining duplicate assignable projects.
11. Run the project docs audit when available.
12. Render-check the parent dashboard when UI behavior is claimed.
13. Record proof and next safe resume action.

## Examples In This Repository

Reference examples:

1. `docs/projects/design-preview-scenarios/`
   - Parent project for Tactical Sandbox scenario lanes.
   - Mostly owned child lanes.
   - Good example of many child packets under one parent.
2. `docs/projects/spells/`
   - Parent project for broad spell work.
   - Mixes owned lanes, linked support, and adjacent dependencies.
   - Good example of folding prior task/project rows into one parent routing
     surface.

When examples conflict with this protocol, prefer this protocol plus
`docs/projects/PROJECT_CARD_SCHEMA.md`; examples may reflect older migration
state or unfinished proof.

## Anti-Patterns

Avoid these failures:

1. Creating one parent pass that pretends to advance every child lane.
2. Copying raw audit findings into parent `GAPS.md` before they are actionable.
3. Making every adjacent dependency a child.
4. Creating duplicate top-level project rows for lanes already owned by the
   parent.
5. Hiding linked support ownership inside the parent.
6. Leaving child packets without a cold-start prompt.
7. Creating a parent dashboard with no child setup links.
8. Treating setup file creation as completion of the product work.
9. Leaving the parent docs framed like ordinary implementation docs instead of
   overarching routing docs.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/agent-workflows/living-project-task-protocol/PARENT_PROJECT_WITH_SUBPROJECTS.md","sha256WithoutMarker":"5a3ab84783f65fe5779f2674e45f0507c64cb41320bcc9452fe09152f567a3cd","markedAtUtc":"2026-06-25T22:57:26.955Z"} -->
