# NORTH_STAR: Scripts: Workflows

Status: active
Last updated: 2026-05-31

## Why this project exists

`scripts/workflows` is where workflow automation moved out of the flat `scripts/` root. This project keeps a warm handoff for:

- what workflow scripts exist,
- how they are expected to be run,
- what moved wrappers still exist for compatibility,
- and what remains uncertain in the orchestration lane.

## Purpose and scope

This project documents the workflow automation surface for Gemini image generation/research and chat-debug tooling only.

It is a cold-start map for the next agent, not an implementation change log.

## File map

| File | Role |
|---|---|
| `scripts/workflows/chat-debug/README.md` | Chat-debug migration note and script roster. |
| `scripts/workflows/chat-debug/*.ts`, `.d.ts` | Interactive selectors, inspection, and monitoring helpers. |
| `scripts/workflows/chat-debug/{inspect-site.ts,deep-inspect.ts,interact-chat.ts,gemini-monitor.ts}` | Primary chat-debug commands. |
| `scripts/workflows/gemini/README.md` | Gemini workflow index and folder map. |
| `scripts/workflows/gemini/core/image-gen-mcp.ts` | Core MCP + Playwright image-generation integration. |
| `scripts/workflows/gemini/image-gen/*.ts` | Portrait generation and regeneration flows. |
| `scripts/workflows/gemini/research/*.ts` | Deep-research profile workflows. |
| `scripts/workflows/gemini/research/debug/*.ts` | CDP debug helpers for research UI flows. |
| `scripts/workflows/gemini/image-gen/launch-debug-chrome.js` | Local Chrome bootstrap with remote debugging on port 9222. |
| `scripts/workflows/gemini/image-gen/open-gemini-profile.ts` | First-time profile/login setup flow. |
| `package.json` scripts | Supported external entrypoint surface. |
| `scripts/run-chrome-mcp.js` | Wrapper for MCP chrome-devtools launcher and port prereqs. |
| `scripts/run-image-regen.cmd`, `scripts/run-portrait-regen.cmd` | Windows orchestration examples for regeneration workflows. |
| `scripts/*.ts` tombstones | Compatibility wrappers that point to moved workflow paths. |

## Implemented state

- `scripts/workflows` exists and is split into `chat-debug` and `gemini`.
- `scripts/workflows/gemini` owns primary image/research automation; this includes:
  - `generate-race-images.ts`,
  - `regenerate-character-creator-race-images.ts`,
  - `regenerate-race-images-from-backlog.ts`,
  - `research-races-with-gemini.ts`,
  - and core MCP/driver helpers.
- Root `scripts/` wrappers for migrated files are still present as migration tombstones.
- Package scripts currently expose canonical starts for automation:
  - `npm run mcp:chrome`
  - `npm run image-gen:login`
  - `npm run generate:race-images`
  - `npm run research:race-profiles`
- Current runbook references are split across `docs/portraits/race_portrait_regen_handoff.md` and `docs/guides/MCP_INTEGRATION.md`.

## Integrations

| Integration | Evidence | What it connects |
|---|---|---|
| MCP bridge | `package.json` scripts and `.mcp.json` | `mcp:chrome`, `npm run mcp`, `npm run test:mcp`, and image-gen execution. |
| Chrome CDP session | `scripts/workflows/gemini/image-gen/launch-debug-chrome.js`, `scripts/run-chrome-mcp.js` | Debug-port and profile requirements for browser automation. |
| Portrait workflows | `scripts/workflows/gemini/image-gen/regenerate-*`, `docs/portraits/race_portrait_regen_handoff.md` | Backlog regeneration and QA pipeline expectations. |
| Profile generation | `scripts/workflows/gemini/research/research-races-with-gemini.ts`, `docs/portraits/race_profiles/research-status.json` | CDP-based race lore profile generation flow. |
| Migration compatibility | `scripts/*.ts` tombstone wrappers using `runMovedScriptTombstone` | Prevent stale command callers from failing silently. |

## Active Task

| Field | Value |
|---|---|
| Task | Keep docs-only project cold-start packet current for workflow scripts. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` include scope, file map, implemented state, integrations, gaps, next checks, and resume path. |
| Allowed boundaries | `docs/projects/scripts-workflows/*`, registry row only for read-only verification |
| Stop condition | no code changes required; documentation reflects actual script surface and command entry points. |
| Verification | `Get-Content` for workflow files and registry evidence. |
| Owner | Worker C |
| Next action | Keep GAPS and tracker aligned when command entry points change. |

## Scope boundaries

In scope:
- documentation-only cold-start updates for workflow automation,
- command surface map for `scripts/workflows`,
- migration wrapper and runbook references.

Adjacent but not in this slice:
- changing workflow behavior or fixing Gemini failures,
- adding or editing runbooks outside this docs packet,
- touching implementation code under `scripts/workflows`.

Out of scope:
- editing `docs/projects/PROJECT_TRACKER.md`.

## What must not be lost

- `scripts/workflows` intent and split (`chat-debug`, `gemini`).
- Legacy callers still resolving through tombstone wrappers under `scripts/`.
- CDP requirement and dedicated profile path (`.chrome-gemini-profile`) for automation stability.
- Backlog regeneration and profile generation evidence in `docs/portraits/race_portrait_regen_handoff.md`.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Command entry points are documented in multiple places with different examples. | adjacent_follow_up | Worker C | `docs/portraits/race_portrait_regen_handoff.md`, `docs/guides/MCP_INTEGRATION.md`, `package.json` | Add one canonical command matrix in project-owned runbook or keep explicit pointer policy. |
| Some handoff docs carry old run snapshots while workflows keep evolving. | out_of_scope | Worker C | `docs/portraits/race_portrait_regen_handoff.md` | Keep as historical ledger and refresh only when a workflow owner approves. |
| Research/profile and portrait lanes share environment knobs but docs do not fully normalize them. | support_needed_now | Worker C | `scripts/workflows/gemini/*.ts` | Add one environment variable matrix reference in this project docs. |

## Global Gap Imports

Check [docs/projects/GLOBAL_GAPS.md](docs/projects/GLOBAL_GAPS.md) before adding cross-project gaps.

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | no imported global gaps for this doc scope |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Registry row | Project intent and location | [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md) |
| Workflow file set | Implementation scope | `scripts/workflows` |
| Package script surface | Supported invocation points | `package.json` |
| Migration tombstones | Compatibility strategy | `scripts/*.ts` |
| Runbook references | Runtime support notes | `docs/portraits/race_portrait_regen_handoff.md`, `docs/guides/MCP_INTEGRATION.md` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md) | Registry anchor | active |
| [docs/projects/GLOBAL_GAPS.md](docs/projects/GLOBAL_GAPS.md) | Cross-project gap routing | active |
| [docs/projects/scripts-workflows/TRACKER.md](docs/projects/scripts-workflows/TRACKER.md) | Active queue and status | active |
| [docs/projects/scripts-workflows/GAPS.md](docs/projects/scripts-workflows/GAPS.md) | Durable unresolved findings | active |

## Artifact Boundary

Keep durable state in this project doc surface and tracker. Exclude raw logs, run output, temporary screenshots, and local run-state artifacts unless a concise, future-useful summary is needed.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Should this project own a single runbook entry that merges command examples from `docs/portraits` and `docs/guides`? | Prevents drift and inconsistent CLI usage. | Worker C | next workflow maintenance pass |
| Are chat-debug workflows still actively used outside manual cleanup? | Avoids keeping stale migration wrappers active longer than needed. | Operator | next review cycle |

## Resume Path For A Cold Agent

1. Read this file.
2. Read [docs/projects/scripts-workflows/TRACKER.md](docs/projects/scripts-workflows/TRACKER.md).
3. Read [docs/projects/scripts-workflows/GAPS.md](docs/projects/scripts-workflows/GAPS.md).
4. Re-verify registry path in [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md).
5. Continue from: keep command-entrypoint and gap tracking accurate for workflow automation.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
