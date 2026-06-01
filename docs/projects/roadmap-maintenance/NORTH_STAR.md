# Roadmap Maintenance North Star

Status: active
Last updated: 2026-05-31

## Why this project exists

This folder is the surviving `roadmap-maintenance` registration in `docs/projects` and preserves the durable, cross-cycle facts for a project whose source evidence remains in an ignored roadmap tool tree.

The canonical evidence pointer is `docs/projects/PROJECT_TRACKER.md` (row: Roadmap Maintenance, line 148), which still points to `docs/tasks/roadmap` and expects this project to keep the living docs set maintained.

## Project intent and evidence basis

- `docs/projects/PROJECT_TRACKER.md` marks Roadmap Maintenance as **planned** and already linked to `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md`.
- `docs/tasks/roadmap` is the historical planning corpus for roadmap tooling and remains referenced as evidence, but it is gitignored in this repo (`.gitignore:193`).
- `devtools/roadmap` is the live tooling folder for implementation and includes: `scripts/roadmap-*.ts`, audit references, and generated cross-check outputs.
- `package.json` exposes roadmap orchestration scripts (`roadmap:*`) and `dev:roadmap` for the local visualizer (`vite --mode roadmap --host 0.0.0.0 --port 3010`).
- `.agent/roadmap-local` is the local workspace and stores orchestration state snapshots (`processing_manifest.json`, `doc_library.json`, `path_provenance.json`).
- `devtools/roadmap/scripts/roadmap-storage.ts` treats `tooling_state.sqlite` as the local source of truth and writes compatibility snapshots for legacy JSON artifacts.
- `devtools/roadmap/scripts/roadmap-session-close.ts`, `roadmap-process-game-docs.ts`, and `roadmap-derive-structured-doc.ts` are the current orchestration boundaries for document processing and structured extraction.

## Current State (as of 2026-05-31)

- Registered row exists in `docs/projects/PROJECT_TRACKER.md` and is expected to stay the stable cross-cycle owner.
- Durable project docs in this folder are present (`NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`).
- The project currently has a partial alignment gap: `PROJECT_TRACKER.md` still references roadmap-task schemas and local tool evidence, but this folder has not yet absorbed all available schema/ownership/clarity details in a single durable slice.
- Several roadmap operating open items are still marked unresolved in local evidence docs.

## What must not be lost

1. The project must remain in this folder only as the durable handoff and not in the ignored `docs/tasks/roadmap` area.
2. The boundary between:
   - current operational tooling (`devtools/roadmap`, package scripts, `.agent/roadmap-local`), and
   - durable roadmap evidence (`docs/tasks/roadmap`)
   must remain explicit in project docs.
3. The partial/open status of roadmap maintenance items should be documented as `open`/`uncertain` when directly evidenced, rather than implied complete.

## Active Task

| Field | Value |
|---|---|
| Task | Capture and stabilize Roadmap Maintenance docs as a source-of-truth slice for ownership, status, scripts, and open gaps. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` should be evidence-backed on: project ownership, live script/storage evidence, local orchestration boundaries, and unresolved roadmap-maintenance gaps with next-step owners. |
| Allowed boundaries | `docs/projects/roadmap-maintenance` only. No source edits; no changes outside the `docs/projects/roadmap-maintenance/` folder. |
| Stop condition | All required durable facts are recorded and current gaps are classified in `GAPS.md` for the next cold-start agent. |
| Verification | Manual doc inspection of this project folder + evidence files listed above + `git diff --check` on changed files. |
| Owner | future agent |
| Next action | Update and align this tracker with the roadmap evidence stack, then classify unresolved items in `GAPS.md`. |

## Scope boundaries

In scope:
- Roadmap maintenance ownership/schema notes for this project.
- Evidence-backed tracker maintenance and cold-start guidance.
- Classification of unresolved roadmap maintenance items that affect continuation.

Adjacent but out of scope:
- Changing roadmap engine code or running script command output updates.
- Expanding or rewiring `.agent/roadmap-local` feature notes.

Out of scope:
- Source code edits and live runtime behavior changes.

## Resume Path for a cold agent

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Confirm `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md` references.
5. Continue with next in-scope action from `TRACKER.md` and `GAPS.md`.

## Evidence Index (high signal)

- `docs/projects/PROJECT_TRACKER.md` (project registration row)
- `docs/tasks/roadmap/NORTH_STAR.md` (historical scaffold)
- `package.json` (`roadmap:*`, `dev:roadmap` scripts)
- `devtools/roadmap/scripts/roadmap-storage.ts` (SQLite + compatibility snapshots)
- `.agent/roadmap-local/README.md` (local workspace notes)
- `.agent/roadmap-local/features/roadmap-visualizer/open_tasks.md` (current open items)