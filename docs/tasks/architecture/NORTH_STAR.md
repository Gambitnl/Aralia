# Architecture Sweep North Star

Status: active
Last updated: 2026-06-25

## Why This Project Exists

Keep one cold-start surface for architecture review work so future agents can continue without re-learning:
- what is already documented,
- what is still planned,
- and where implementation-risky architecture evidence lives.

## Scope and Purpose

This sweep is a documentation pass over the existing architecture mapping:
- `docs/tasks/architecture` planning surface,
- `docs/ARCHITECTURE.md`,
- `docs/architecture/` domain and tooling docs,
- `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md`.

Source code edits are out of scope.

## File Map

- `docs/tasks/architecture/NORTH_STAR.md`: this cold-start guide for the Architecture Sweep project.
- `docs/tasks/architecture/TRACKER.md`: active queue, status, and proof pointers.
- `docs/tasks/architecture/GAPS.md`: stable unresolved findings that belong to this sweep.
- `docs/tasks/architecture/agent_prompts/01_architecture_compendium.md`: historical prompt provenance.

## Implemented / Planned State

- Implemented
  - Architecture compendium index exists at `docs/ARCHITECTURE.md` (updated `2026-03-10`).
  - Domain docs and generator guide exist under `docs/architecture/`.
  - Generator outputs are present: `docs/architecture/_generated/deps.json`, `docs/architecture/_generated/file-inventory.json`, `docs/architecture/_generated/coverage-report.json`.
  - Project tracker row exists for `Architecture Sweep` in `docs/projects/PROJECT_TRACKER.md`.
  - Task triad files in this folder exist.
- Implemented
  - Architecture compendium related-document links were refreshed on 2026-06-25 so they point only at existing docs.
  - The stale `docs/VISION.md` broken-link concern was rechecked and closed because `docs/PROJECT_ARCHITECTURE.md` exists.
- Planned next
  - Keep only actionable gap rows, avoiding duplicate or stale task noise.
  - Run the targeted architecture text-hygiene pass for the remaining encoding-artifact follow-up.

## Integrations

- `docs/architecture/README.md` and `scripts/generate-architecture-compendium.ts` define regeneration and maintenance.
- `docs/ARCHITECTURE.md` is the public architecture landing and depends on generated dependency artifacts.
- `docs/projects/PROJECT_TRACKER.md` links the project to repo-level discoverability.
- `docs/projects/GLOBAL_GAPS.md` receives cross-project or out-of-scope findings.

## Active Task

- Objective: Preserve the architecture sweep as a live docs-only owner surface and keep remaining gaps explicitly routed.
- Acceptance criteria:
  - `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` describe current architecture evidence, scope boundaries, checks, and unresolved items.
  - Missing links and stale references are recorded with exact next checks.
- Allowed boundary: files in this folder and direct architecture references listed above.
- Stop condition: docs-only sweep refresh is complete; no source file changes.

## Gaps and Uncertainties

- Remaining architecture follow-up is text hygiene only; known broken architecture reference targets were rechecked on 2026-06-25.
- Some architecture docs include non-ASCII artifact text, which may need a targeted hygiene pass.
- Several architecture notes mix historical state and current reality; this requires explicit in/out-of-scope classification before moving to implementation.

## Next Checks

- Run a targeted text-hygiene pass for the architecture domain docs named in `GAPS.md`.
- Confirm generated docs assumptions (`scripts/generate-architecture-compendium.ts`) match current architecture folder structure when the compendium is next regenerated.
- Route any new architecture findings into `GAPS.md` with exact link or file evidence.

## Resume Path

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Continue from the active row with the next action and required proof.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/architecture/NORTH_STAR.md","sha256WithoutMarker":"3c468dbe4e10f7a8fbe3b009bc36cd86471371343ebaeb351997c506f93a15b9","markedAtUtc":"2026-06-25T22:29:38.632Z"} -->
