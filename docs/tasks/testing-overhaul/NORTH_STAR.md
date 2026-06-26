# Testing Overhaul North Star

Status: active
Last updated: 2026-06-25

## Why This Project Exists

This project keeps test-planning context for a large, growing area of the app in one cold-start surface.
Its goal is to prevent duplicate discovery and preserve unfinished scope while execution ownership is assigned.

## Purpose And Scope

Ensure testing work for UI, interaction, map, gameplay, and utility areas proceeds from a shared, explicit plan.

- In scope: clarify current reality, define bounded slices, preserve execution evidence, and route live test gaps.
- Out of scope for this consolidation pass: broad source refactors or claiming full test-suite completion.

## Current State

- The project is registered in `docs/projects/PROJECT_TRACKER.md`.
- The old phase backlog files were retired on 2026-06-25 after their still-valid work was moved into `GAPS.md`.
- The three project docs in this folder are now the live handoff surface for this task.
- Future execution should choose one stream gap from `GAPS.md`, inspect current tests/source, implement a focused proof, and update the matching row.

## Active Task

| Field | Value |
|---|---|
| Task | Execute the next focused testing slice from the stream matrix. |
| Acceptance criteria | One selected testing stream gains a focused, current proof and the matching `GAPS.md` row is updated. |
| Allowed boundaries | The selected source/test files plus these testing-overhaul docs. |
| Stop condition | Do not widen into a full test-suite rewrite; keep each pass tied to one stream and one proof boundary. |
| Verification | Focused Vitest/RTL proof for the selected slice; rendered proof if the claim is visual. |
| Owner | testing-overhaul maintainer |
| Next action | Pick G4, G5, G6, G7, or G8 from `GAPS.md` and implement one focused test slice. |

## Scope Boundaries

In scope:
- Preserve and update testing intent.
- Track implemented versus planned test coverage.
- Record owner-aware, risk-aware next actions.
- Keep cross-project gap routing visible.

Adjacent but not automatically in this slice:
- Full cross-task harmonization of all non-testing roadmap docs.
- Broad quality-gate or CI policy work owned by scripts-quality.

Out of scope:
- Restoring retired phase checklist files.
- Declaring the whole test surface complete from one focused proof.

## File Map

| File | Role |
|---|---|
| `NORTH_STAR.md` | Cold-start entry point and scope memory. |
| `TRACKER.md` | Active queue, stream matrix, owner, status, evidence, and next checks. |
| `GAPS.md` | Durable unresolved findings with next proof. |

## Implemented / Planned

Implemented:
- Project registration in the repo-level tracker remains visible.
- Core three-file handoff surface is present.
- Old phase backlog files were consolidated and retired.

Planned:
- Execute stream gaps G4-G8 one focused slice at a time.
- Update proof rows after each slice.
- Route quality-gate or script-test policy work to `docs/projects/scripts-quality`.

## Integrations

- `docs/projects/PROJECT_TRACKER.md`: owns project registry and required progress signal.
- `docs/projects/GLOBAL_GAPS.md`: cross-project or external gap routing.
- `docs/projects/scripts-quality`: adjacent owner for quality-gate and script-test infrastructure.
- `docs/ARCHITECTURE.md`: system ownership context for components named in this testing scope.

## Resume Path For A Cold Agent

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Choose exactly one active stream gap.
5. Inspect current source/tests for that stream.
6. Add one focused proof and update the matching gap row.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/testing-overhaul/NORTH_STAR.md","sha256WithoutMarker":"30ffbbabde780350c7ffcbf7d626df54eabc32c2216562cfe639d4099100b1a8","markedAtUtc":"2026-06-25T22:29:38.630Z"} -->
