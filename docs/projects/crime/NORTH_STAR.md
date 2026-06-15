---
schema_version: 1
project: Crime System
slug: crime
category: Game Systems
main_category: Review / Archive
subcategory: Deprecation Review
status: active
last_updated: 2026-06-12
iteration: 2
confidence: medium
evidence: docs/projects/crime/TRACKER.md
gap_signal: "6 open gaps; G1 through G6 remain open"
protocol: living project doc set
next_step: Resume T3 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â start with G1 expired-bounty cleanup, then reassess G2 fence semantics.
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
last_proof: 2026-06-05
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: docs/projects/crime
human_decision_required: "no"
---

Last updated: 2026-06-12
## Dashboard Card Schema

Project: Crime System
Slug: crime
Category: Game Systems
Status: active
Confidence: medium
Evidence: docs/projects/crime/TRACKER.md
Gap signal: 6 open gaps; G1 through G6 remain open
Protocol: living project doc set
Next step: Resume T3 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â G1 expired-bounty cleanup first.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-08
Lifecycle status: active
Deprecation confidence: none
Deprecation reason: none
Canonical owner: docs/projects/crime
Human decision required: no

## Current State

Crime is in a documentation-first cold-start refresh state. The active queue is
T3, and the first implementation slice should be G1 before revisiting the
remaining crime gaps.

## Resume Path

1. Open `docs/projects/crime/TRACKER.md` and keep T3 active.
2. Start with G1 and use G2-G5 as follow-up debt unless the slice must widen.
3. Keep the handoff compact and route any new project blockers back into
   `docs/projects/crime/GAPS.md`.

## North Star

Crime is a consequence engine: player and NPC criminal acts (theft, fencing,
heists, bounties, black-market trade) produce heat, suspicion, bounties, and
faction reactions that persist through the daily world loop and surface in
the Thieves' Guild UI. The systems live in `src/systems/crime/**`
(CrimeSystem, HeistManager, BlackMarketSystem, FenceSystem),
`src/state/reducers/crimeReducer.ts`, and `src/components/Crime/**`.

## Repair Note (2026-06-11)

This file previously contained ~140k lines of unrelated repo-corpus grep
output (build logs, AGENTS.bak notes, glossary dumps) appended after the
Resume Path section ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â queued for repair by the Decision Blitz
(docs/projects/DECISION_BLITZ_2026-06-10.md, "Items converted to work").
The legitimate frontmatter and body were preserved verbatim; only the
foreign corpus block was removed (it exists in git history if ever needed).
Tracker (T1-T3) and GAPS (G1-G5) were never corrupted and remain canonical.

