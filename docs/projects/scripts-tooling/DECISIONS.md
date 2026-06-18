# Scripts: Tooling Decisions

Status: active
Last updated: 2026-06-17

Use this file for durable choices that affect project scope, required documentation, or protocol interpretation. Keep operational notes in `AUDIT_OR_PROOF.md` and re-openable workflow deltas in `TRACKER.md` or `GAPS.md`.

## Decision Log

### D1: Required-doc surface initialized

Date: 2026-06-10

Owner: schema migration pass

Decision point:
`NORTH_STAR.md` declares `DECISIONS.md` as part of the required living-project surface.

Decision made:
Create this concise decisions file so the project folder matches the declared schema contract.

Rationale and evidence:
- Project folder: `docs/projects/scripts-tooling`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-05`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: trackRun() adoption stays intentionally selective

Date: 2026-06-17

Owner: Qoder CLI (ST-2 execution)

Decision point:
ST-2 asked whether `trackRun()` adoption should expand to cover more `scripts/tooling/` scripts or remain intentionally selective.

Decision made:
`trackRun()` adoption stays intentionally selective. Only standalone entry-point scripts that are directly invoked by developers or agents should call `trackRun()`. Library modules, imported utilities, and agent-only helpers that are consumed by other scripts should not be tracked.

Rationale and evidence:
- `scripts/tooling/` contains 15 TypeScript files.
- Only 1 file (`serialize-session-proof.ts`) actually calls `trackRun()` and has a `@script-meta` block.
- The `.run-log.json` contains entries for 5 tooling scripts, but none of those 5 call `trackRun()` — the entries were manually seeded (see STG-004).
- 10 of 15 tooling scripts have zero run-log representation.
- Many tooling scripts are libraries or imported utilities (e.g., `script-tracker.ts` itself is a library imported by other scripts), not standalone entry points.
- `getUntrackedScripts()` is a diagnostic function for discovery, not a mandate to instrument every script.
- Blanket `trackRun()` adoption would add noise to the run-log and create false freshness signals.

Classification:
The 15 tooling scripts fall into three categories:
1. **Standalone entry points** (directly invoked): `diagnose-shell.ts`, `scan-temp-assets.ts`, `purge-stale-branches.ts`, `validate-git-remote.ts`, `serialize-session-proof.ts`, `scan-secrets.ts`, `create-session-pr.ts`, `check-bundle-size.ts`, `verify-ollama-router.ts`
2. **Libraries / imported utilities** (consumed by other code): `script-tracker.ts`, `track-turn-cost.ts`, `mempalace-sync.ts`
3. **Agent-only helpers** (invoked by agent workflows, not standalone): `audit-dependencies.ts`, `audit-typedoc-reference.ts`, `organize-dev-tools.ts`

Follow-up:
- STG-001: Decide whether `script-registry.json` should expand to cover more tooling scripts.
- STG-004: Classify which run-log entries were manually seeded vs. genuinely tracked.
