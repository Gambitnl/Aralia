---
schema_version: 1
project: Crime System
slug: crime
category: Game Systems
main_category: Review / Archive
subcategory: Deprecation Review
status: complete_for_current_gap_set
last_updated: 2026-06-25
iteration: 8
confidence: medium
evidence: docs/projects/crime/TRACKER.md
gap_signal: "0 open gaps; G1 expired-bounty cleanup, G2 fence outcome contract, G3 market utility ownership, G4 heat/severity boundary, G5 TODO/type-debt classification, and G6 suspect/report decision resolved"
protocol: living project doc set
next_step: Run a fresh source-backed Crime scan before assigning more Crime work.
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
last_proof: 2026-06-25
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: complete_for_current_gap_set
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: docs/projects/crime
human_decision_required: "no"
---

Last updated: 2026-06-25

## Dashboard Card Schema

Project: Crime System
Slug: crime
Category: Game Systems
Status: complete_for_current_gap_set
Confidence: medium
Evidence: docs/projects/crime/TRACKER.md
Gap signal: 0 open gaps; G1 expired-bounty cleanup, G2 fence outcome contract, G3 market utility ownership, G4 heat/severity boundary, G5 TODO/type-debt classification, and G6 suspect/report decision resolved
Protocol: living project doc set
Next step: Run a fresh source-backed Crime scan before assigning more Crime work.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-25
Workflow gaps reviewed: 2026-06-08
Lifecycle status: complete_for_current_gap_set
Deprecation confidence: none
Deprecation reason: none
Canonical owner: docs/projects/crime
Human decision required: no

## Current State

Crime is complete for the current gap set. T3 and G1-G6 are resolved; the
suspect/report aggregate was intentionally deferred until a guard, memory,
faction, or UI caller needs structured report data.

## Resume Path

1. Open `docs/projects/crime/TRACKER.md` and confirm no new source-backed gap has been added.
2. Run a fresh source scan before selecting new Crime work.
3. Keep the handoff compact and route any new project blockers back into
   `docs/projects/crime/GAPS.md`.

## North Star

Crime is a consequence engine: player and NPC criminal acts (theft, fencing,
heists, bounties, black-market trade) produce heat, suspicion, bounties, and
faction reactions that persist through the daily world loop and surface in
the Thieves' Guild UI. The systems live in `src/systems/crime/**`
(`CrimeSystem`, `HeistManager`, `BlackMarketSystem`, `FenceSystem`),
`src/state/reducers/crimeReducer.ts`, and `src/components/Crime/**`.

## Repair Note (2026-06-11)

This file previously contained about 140k lines of unrelated repo-corpus grep
output (build logs, AGENTS.bak notes, glossary dumps) appended after the
Resume Path section. The Decision Blitz queued that corruption for repair in
`docs/projects/DECISION_BLITZ_2026-06-10.md` under "Items converted to work".
The legitimate frontmatter and body were preserved; only the foreign corpus
block was removed. It exists in git history if ever needed. Tracker and GAPS
were never corrupted and remain canonical.
