# Dialogue Living Tracker

Status: active  
Last updated: 2026-06-12

## Status Vocabulary
- `not_started`
- `active`
- `blocked`
- `done`
- `superseded`

## Active Task Queue

| ID | Status | Task | Owner | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|
| D2 | active | Track unresolved dialogue gaps and keep this project-level gap list aligned | aralia-dialogue | `docs/projects/dialogue/GAPS.md`, `docs/projects/dialogue/NORTH_STAR.md` | Keep the gap log aligned with the current resume path and only add evidence-backed Dialogue gaps | Keep gap status and next proof in GAPS.md |

## Change Log

| Date | File | Change | Why | Next check |
|---|---|---|---|---|
| 2026-05-31 | `docs/projects/dialogue/NORTH_STAR.md` | Replaced scaffold with concrete runtime facts | Documentation now reflects implemented system state | Keep synced with future feature changes |
| 2026-05-31 | `docs/projects/dialogue/GAPS.md` | Added implementation-backed gap log and status labels | Preserve unresolved items for cold handoff | Review blocked/human-decision items before next scope expansion |
| 2026-05-31 | `docs/projects/dialogue/TRACKER.md` | Added active tasks for continuity and checks | Make next steps explicit for cold starts | Retire completed tasks in place |
| 2026-06-05 | `docs/projects/dialogue/NORTH_STAR.md`, `docs/projects/dialogue/TRACKER.md`, `docs/projects/dialogue/GAPS.md`, `docs/projects/dialogue/COLD_START_AGENT_PROMPT.md` | Refreshed the cold-start resume state and expanded the project gap inventory with Dialogue-specific follow-ups | Keep the handoff compact, current, and evidence-backed | Resume from D2 and keep D3 visible |
| 2026-06-10 | `docs/projects/dialogue/NORTH_STAR.md`, `docs/projects/dialogue/TRACKER.md`, `docs/projects/dialogue/GAPS.md`, `docs/projects/dialogue/COLD_START_AGENT_PROMPT.md`, `docs/projects/dialogue/AUDIT_OR_PROOF.md` | D3 verified: session lifecycle, reducer mapping, save/load ephemeral behavior documented in North Star; gap signal corrected to 6 open gaps | Iteration 2 cold-start pass; D3 closed with evidence | Resume from D2 with focus on DIAL-002 unlock propagation decision |

## Update Rules
- Update active tasks when behavior or tests change.
- Keep this tracker aligned with any new durable project risk or follow-up in GAPS.md.
- Use only project-local docs for core decisions; avoid expanding scope to unrelated systems in this tracker.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
