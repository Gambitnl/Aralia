# GAPS: Sideproject: Basic Chat

Status: active
Last updated: 2026-05-31

Use this file for durable unresolved findings that are specific to this sideproject
and important enough to preserve at this level.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | blocked_human_decision | pending | docs/projects/sideproject-basic-chat/TRACKER.md | docs-only cold-start refresh | Sideproject status is marked "implemented" but undecided as active vs reference-only | [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md) row 123 | Team cannot safely route future work without this boundary decision | Confirm decision with project owner and set status context in NORTH_STAR/TRACKER | `PROJECT_TRACKER.md` row text + updated tracker language |
| G2 | not_started | adjacent_follow_up | pending | sideproject-basic-chat/TRACKER.md | docs-only cold-start refresh | No formal runtime smoke check is attached to this project package | [sideprojects/basic-chat/server.py](sideprojects/basic-chat/server.py), [sideprojects/basic-chat/run.ps1](sideprojects/basic-chat/run.ps1) | Future maintainers need a repeatable validation step before expanding functionality | Add a short next-check command line sequence in NORTH_STAR or tracker once status is set | Local manual check or recorded note in next task |

## Classification Reference

- `adjacent_follow_up`: useful but not required to finish this doc pass.
- `blocked_human_decision`: waiting on owner choice before meaningful continuation work can resume.
