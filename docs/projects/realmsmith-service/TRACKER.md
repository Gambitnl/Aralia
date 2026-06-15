# RealmSmith Service Living Tracker

Status: active
Last updated: 2026-06-15

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
| T2 | done | Confirm RealmSmith service contract and retry policy before next implementation change | Claude Code (Devin CLI) | 2026-06-15 | `src/services/RealmSmithTownGenerator.ts`, `src/services/RealmSmithAssetPainter.ts`, `src/hooks/useTownController.ts`, `src/types/realmsmith.ts` | Source scan completed; contract and retry policy documented in NORTH_STAR.md "Service Contract Documentation" section | Contract and retry policy now documented; G1 and G2 resolved in GAPS.md |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | support_needed_now | Claude Code (Devin CLI) | `docs/projects/realmsmith-service/GAPS.md` | T2 source scan | No explicit RealmSmith API error/retry contract | `src/services/RealmSmithTownGenerator.ts`, `src/services/RealmSmithAssetPainter.ts`, `src/hooks/useTownController.ts`, `src/components/Town/TownCanvas.tsx` | implementation stability and future refactors depend on contract clarity | Contract now documented in NORTH_STAR.md under "Service Contract Documentation" section | review documented contract before next implementation change |
| G2 | resolved | support_needed_now | Claude Code (Devin CLI) | `docs/projects/realmsmith-service/GAPS.md` | T2 source scan | No documented retry/backoff strategy for generation or paint path | `src/services/RealmSmithTownGenerator.ts`, `src/hooks/useTownController.ts`, project-wide retry pattern scan | failures during generation/paint could become unbounded UX breakage | Retry policy now documented in NORTH_STAR.md: hard-fail with console logging, no retry, no fallback | add retry policy acceptance checks if implementation changes are planned |
| G3 | active | adjacent_follow_up | pending | `docs/projects/realmsmith-service/GAPS.md` | code scan and map review | World/content generation assumptions are tightly coupled and not versioned | `src/types/realmsmith.ts`, `src/data/realmsmithBiomes.ts`, `src/components/Town/TownCanvas.tsx`, `src/services/RealmSmithAssetPainter.ts` | non-versioned coupling increases chance of silent breakage in content generation and interactions | add contract notes in implementation handoff before biome/painter changes | create next check and record expected payload shape |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
