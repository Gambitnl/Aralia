# GAPS: Scripts: Git

Status: active
Last updated: 2026-05-31

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker C | docs/projects/scripts-git/TRACKER.md | This docs refresh | No automated checks validate hook script behavior end-to-end | `scripts/git/pre-push-aralia.sh`, `scripts/git/*.cjs` | Uncovered policy drift is hard to detect without a reproducible check | add a narrow verification checklist or test in scripts or docs next slice | run `npm run sync-check`, `npm run git:hygiene`, and `npm run intent-gate -- --strict` together with a documented sample run |
| G2 | not_started | adjacent_follow_up | Worker C | docs/projects/scripts-git/TRACKER.md | This docs refresh | No local runbook file for Scripts: Git policy execution flow | `scripts/git`, `docs/DEVELOPMENT_GUIDE.md` | Operators use multiple partial docs instead of one command map | decide whether to add `RUNBOOK.md` in this folder or route this to task-level docs | confirm preferred handoff format with caller and add docs if needed |
