# SaveLoad Tracker

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
|---|---|---|---|---|---|---|---|---|
| T1 | done | Document current SaveLoad runtime scope in NORTH_STAR.md | Worker B | 2026-05-31 | `docs/projects/saveload/NORTH_STAR.md` | Validate tracker and gaps reflect runtime evidence | `Get-Content` on NORTH_STAR, TRACKER, GAPS |
| T2 | done | Record implementation-aligned gaps and integration seams | Worker B | 2026-05-31 | `docs/projects/saveload/NORTH_STAR.md`, `src/services/saveLoadService.ts` | Keep GAPS updated with next checks | GAPS row verification |
| T3 | active | Decide runtime bootstrap path for storage migration and version policy before code changes | Worker B | 2026-06-05 | `src/services/saveLoadService.ts`, `docs/projects/saveload/GAPS.md` | Confirm owner, then implement in code only when scope resumes | Add startup call or mark blocked by approval |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | support_needed_now | Worker B | `docs/projects/saveload/GAPS.md` | docs rewrite | `initializeStorage()` is never called during startup | `src/services/saveLoadService.ts`; repo-wide scan | IndexedDB migration/emergency recovery can be skipped in runtime | Confirm and wire initialization point in App/startup path | Smoke test with localStorage save and IDB enabled |
| G2 | active | adjacent_follow_up | Worker B | `docs/projects/saveload/GAPS.md` | docs rewrite | Checkpoint tier write flow not present in runtime scan | `src/services/saveLoadService.ts`; `rg` scan | Unclear if checkpoint tiers are implemented or vestigial | Decide ownership and define write scheduler or retire placeholders | Update TRACKER if feature is planned |
| G3 | active | adjacent_follow_up | Worker B | `docs/projects/saveload/GAPS.md` | docs rewrite | No explicit export/import backup path for save files | `src/components/SaveLoad/*`, `src/services/saveLoadService.ts` | Missing user-facing recovery path and QA backup flow | Confirm scope and required UX in next implementation slice | Add follow-up task or close explicitly |
| G4 | active | in_scope_now | Worker B | `docs/projects/saveload/GAPS.md` | docs rewrite | Save version mismatch remains hard failure | `src/services/saveLoadService.ts` | Future schema bumps can strand users if compatibility cannot be preserved | Define policy and migration matrix | Add policy doc + tests before format change |

## Update Rules

- Update this tracker before changing active slice behavior.
- Keep one active row per implementation slice.
- Keep unresolved cross-scope items in `docs/projects/saveload/GAPS.md` with evidence and proof target.
