# NORTH_STAR: Scripts: Quality

Status: active
Last updated: 2026-05-31

## Why This Project Exists

`scripts/quality` owns the local debt-report entrypoint for quality debt visibility.
The project exists to keep debt reporting and push-policy expectations discoverable
for future agents without over-committing to cleanup work in unrelated slices.

## Intended Outcome

Create a compact continuation surface that tells a future agent:
- what quality debt tooling is actually implemented,
- how it is wired into push workflow policy,
- what is still unknown or unverified,
- and where to continue next.

## File Map

- `scripts/quality/debt-summary.cjs`
  - runs `npm run typecheck` and an ESLint JSON summary,
  - prints grouped counts only in normal mode,
  - supports strict exit in `--strict`.
- `package.json` scripts
  - `quality:debt` -> `node scripts/quality/debt-summary.cjs`
  - `quality:debt:strict` -> strict mode of same command
  - `typecheck`, `lint`, `sync-check`, `intent-gate`
- `docs/DEVELOPMENT_GUIDE.md`
  - documents the ordinary and strict quality flow for pushes.
- `scripts/git/pre-push-aralia.sh`
  - runs `npm run quality:debt:strict` only when `ARALIA_PRE_PUSH_STRICT=1`.

## Implemented State

- Implemented:
  - single debt-report script in `scripts/quality/debt-summary.cjs`,
  - npm script wiring in `package.json`,
  - policy integration in `scripts/git/pre-push-aralia.sh`.
- Not yet implemented:
  - automated verification that debt summaries are produced and reviewed on a fixed cadence,
  - persisted debt summaries for trend tracking.

## Integrations

`scripts/quality` is not a standalone checker. It is intended to sit inside the
larger push policy chain:

1. `scripts/git/pre-push-aralia.sh` runs `sync-check` and `git:hygiene` as hard gates.
2. `intent-gate` must pass (strict mode by default for pre-push).
3. `quality:debt:strict` runs only in `ARALIA_PRE_PUSH_STRICT=1` mode.
4. The repository guide (`docs/DEVELOPMENT_GUIDE.md`) defines that ordinary pushes
   use non-blocking quality summaries.

## Scope Boundaries

In scope:
- documentation for quality reporting ownership and policy integration,
- tracker and gap alignment for this scripts-quality workstream.

Out of scope:
- rewriting `scripts/quality/debt-summary.cjs`,
- changing pre-push policy itself,
- broad lint/type refactors.

Do not edit outside `docs/projects/scripts-quality/` in this task.

## Gaps and Uncertainties

1. No local checkpoint captures debt-output baselines or trend history.
2. No documented "expected range" for lint/type diagnostic growth exists.
3. Lint scope inside the quality script is hardcoded to `src`, `scripts`, `tests`
   and currently excludes other top-level folders; this may be intentional or a gap.

## Active Task

| Field | Value |
|---|---|
| Task | Refresh `scripts-quality` docs into a cold-start handoff with integration and gap clarity |
| Acceptance criteria | NORTH_STAR, TRACKER, GAPS define purpose, file map, implemented state, integrations, active follow-ups, and next checks with specific evidence references |
| Allowed boundaries | `docs/projects/scripts-quality/*` |
| Stop condition | docs are internally consistent and reference current script/push-policy wiring |
| Next checks | `Get-Content package.json`, `Get-Content scripts/git/pre-push-aralia.sh`, `npm run quality:debt` |

## Artifact Boundary

Keep durable intent here and in the tracker/gap file. Keep raw command output,
operator notes, and local run diagnostics outside this project unless a short, durable
excerpt is needed to preserve a real decision or external proof.

## Resume Path

1. Read this file.
2. Read `docs/projects/scripts-quality/TRACKER.md`.
3. Read `docs/projects/scripts-quality/GAPS.md`.
4. Confirm `scripts/quality/debt-summary.cjs`, `package.json`, and
   `scripts/git/pre-push-aralia.sh` still match this map.
