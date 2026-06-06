# TRACKER: RealmSmith Service

Status: active
Last updated: 2026-06-05

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Refresh docs for cold-start continuity in `docs/projects/realmsmith-service/` | Codex agent | 2026-05-31 | `NORTH_STAR.md`, `GAPS.md` | continue with implementation follow-ups from gaps | source path + tracker alignment still valid |
| T2 | active | Confirm RealmSmith service contract and retry policy before next implementation change | Codex agent | 2026-06-05 | `src/services/RealmSmithTownGenerator.ts`, `src/services/RealmSmithAssetPainter.ts`, `src/services/README.md` | source-scan the contract surface and document the chosen retry/failure policy | docs agree on the contract and retry decision |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | active | support_needed_now | pending | `docs/projects/realmsmith-service/GAPS.md` | this pass | No explicit RealmSmith API error/retry contract | `src/services/RealmSmithTownGenerator.ts`, `src/services/RealmSmithAssetPainter.ts` | implementation stability and future refactors depend on contract clarity | define the caller contract and failure shape before the next implementation change | update `NORTH_STAR.md` and `GAPS.md` |
| G2 | active | support_needed_now | pending | `docs/projects/realmsmith-service/GAPS.md` | this pass | world content generation pipeline assumptions not versioned | `src/types/realmsmith.ts`, `src/hooks/useTownController.ts`, `src/components/Town/TownCanvas.tsx` | hidden interface drift can desync generation and rendering | add contract notes before future generator/painter refactors | add a versioned contract summary |
