---
schema_version: 1
project: Spells
project_name: Spells
slug: spells
project_slug: spells
category: Game & Simulation
main_category: Game & Simulation
subcategory: Spell Runtime And Data
tracker_group: Spells
status: active
last_updated: 2026-06-22
iteration: 0
confidence: medium
evidence: docs/projects/spells
gap_signal: "Parent imports 5 active spell-domain gaps after lane ownership is chosen; child packets own execution proof."
protocol: living project doc set
next_step: "Choose the highest-impact child lane from SUBPROJECTS.md, run the executable pass in that child packet, then import only parent-visible routing or product gaps back here."
project_mode: parent_with_subprojects
subproject_tracker: docs/projects/spells/SUBPROJECTS.md
subproject_count: 8
subproject_signal: "8 tracked child lanes; 7 owned Spells lanes plus 1 linked support project"
agent_comments: "Parent is a scoped routing dashboard, not one executable spell-work iteration."
active_agent: ""
agent_pass_status: ""
agent_pass_started_at: ""
agent_pass_ended_at: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - SUBPROJECTS.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - subprojects/
  - docs/tasks/spells/
  - linked support project docs
required_verification:
  - docs_consistency
  - rendered_parent_dashboard_check
completed_verification:
  - docs_consistency
last_proof: 2026-06-22
workflow_gaps_reviewed: 2026-06-22
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: docs/projects/spells/NORTH_STAR.md
human_decision_required: no
source_path: docs/projects/spells/NORTH_STAR.md
---
# Spells Parent North Star

status: active
Last updated: 2026-06-22

## Why This Project Exists

Spells is a parent scoped-dashboard project. It preserves the broad spell-system map while runtime execution, corpus completeness, UI flows, validation, data taxonomy, documentation, and mechanics discovery proceed through smaller child lanes.

The parent does not represent one executable implementation pass and it should not increment a single parent iteration counter for child work. The parent owns routing, lane boundaries, imported gap visibility, and the durable map of which child packet should carry each spell-system slice.

## Parent Routing Contract

Use this parent project when the work is about spell-domain ownership, lane selection, gap import policy, or dashboard discoverability. Once a concrete implementation/audit slice is chosen, move into the matching child packet listed in `SUBPROJECTS.md` and let that child own its pass status, active agent, proof, tracker updates, and local gap log.

The parent should answer four questions for a cold-start agent:

1. Which spell lane owns this work?
2. Is the lane owned by Spells, linked support, adjacent dependency, or out of scope?
3. Which parent-visible gaps need to be imported upward?
4. What dashboard evidence helps the next agent route without rediscovering the project map?

## Current Parent Objective

Keep the spell project family coherent while the spell runtime, data corpus, validation rules, UI behavior, and supporting audits expand in parallel. Preserve broad spell-system intent without turning the parent into a catch-all execution packet.

## Child Lane Registry

The authoritative registry is `docs/projects/spells/SUBPROJECTS.md`.

| Lane | Relationship | Purpose |
|---|---|---|
| Structured Spell Execution | owned lane | Runtime execution, validation, commands, targeting, effects, and player-facing behavior. |
| Spell Completeness Audit | owned lane | Corpus completeness, source-vs-JSON audits, and imported product gap decisions. |
| Spell UI And Choice Flows | owned lane | Spellcasting panels, choice prompts, summaries, and rendered interaction proof. |
| Spell Data Taxonomy | owned lane | Tags, buckets, canonical metadata, schema fields, and corpus consistency. |
| Spell Automation And Validation | owned lane | Validators, scripts, gates, and repeatable integrity checks. |
| Spell Documentation And Handoffs | owned lane | Living docs, cold-start prompts, task packets, and routing summaries. |
| Mechanics Discovery Packages | owned lane | New spell-mechanic discovery packs that are not yet ready for runtime implementation. |
| Runtime Template Audit | linked support | Supporting audit of runtime templates; import findings only when they change spell-domain product behavior. |

## Parent Gap Policy

`GAPS.md` is a parent intake surface, not the only place spell gaps may live. Child packet gaps stay in the child packet until one of these is true:

1. The gap affects multiple child lanes.
2. The gap changes parent routing, ownership, or priority.
3. The gap is imported from a linked support project and needs Spells-domain visibility.
4. The gap is a product-behavior issue that the parent must expose on the dashboard.

Do not copy every child TODO upward. The parent should stay useful as a routing dashboard.

## Highest-Impact Resume Path

Start with `SUBPROJECTS.md`, then choose the child lane that owns the next concrete work. As of this parent refresh, the highest-impact imported lane is the created-object / persistent-structure mechanics stream currently represented by parent gap G15 and the Mechanics Discovery Packages lane.

A normal resume should be:

1. Read this file for parent scope.
2. Read `SUBPROJECTS.md` for lane ownership and priority.
3. Open the chosen child packet and run the executable pass there.
4. Update parent `GAPS.md`, `TRACKER.md`, or `DECISIONS.md` only when ownership, routing, imported gaps, or dashboard-visible status changes.

## Supporting Files

| File | Purpose |
|---|---|
| `SUBPROJECTS.md` | Parent dashboard registry and child lane routing table. |
| `TRACKER.md` | Parent-level routing, registry, and dashboard maintenance tasks only. |
| `GAPS.md` | Parent-visible imported gaps only; lane-local gaps belong in child packets. |
| `COLD_START_AGENT_PROMPT.md` | Handoff prompt that routes agents to child packets before coding. |
| `DECISIONS.md` | Durable parent routing, ownership, and import decisions. |
| `AUDIT_OR_PROOF.md` | Concise parent proof summaries plus imported child-proof references. |
| `RUNBOOK.md` | Repeatable parent onboarding and maintenance checks. |

## Boundary

The parent may summarize runtime and audit proof, but it should not become the proof owner for child implementation work. Keep detailed validation output in the child project or the relevant task packet; import concise proof here only when it explains a parent routing decision.
