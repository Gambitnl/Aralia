---
schema_version: 1
project: Scripts: Workflows
slug: scripts-workflows
category: Tools, Automation, and Infrastructure
main_category: "Runtime & Services"
subcategory: "Commands & Runtime Support"
status: partial
last_updated: 2026-06-12
iteration: 3
confidence: medium
evidence: docs/projects/scripts-workflows
gap_signal: 2 open gaps; 2 open project gaps (G1 command matrix, G2 env-var matrix)
protocol: living project doc set
next_step: Consolidate the canonical command matrix in project-owned docs, then normalize env-var defaults if the slice stays stable.
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-05
workflow_gaps_reviewed: 2026-06-05
compaction_status: needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# NORTH_STAR: Scripts: Workflows

Status: active
Last updated: 2026-06-12

## Why this project exists

`scripts/workflows` is where workflow automation moved out of the flat `scripts/` root. This project keeps a warm handoff for:

- what workflow scripts exist,
- how they are expected to be run,
- what moved wrappers still exist for compatibility,
- and what remains uncertain in the orchestration lane.

## Purpose and scope

This project documents the workflow automation surface for Gemini image generation/research and chat-debug tooling only.

It is a cold-start map for the next agent, not an implementation change log.

## Dashboard Card Schema

Project: Scripts: Workflows
Slug: scripts-workflows
Category: Tools, Automation, and Infrastructure
Status: partial
Confidence: medium
Evidence: docs/projects/scripts-workflows
Gap signal: 2 open project gaps (G1 command matrix, G2 env-var matrix)
Protocol: living project doc set
Next step: Consolidate the canonical command matrix in project-owned docs, then normalize env-var defaults if the slice stays stable.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

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
  - The dashboard card schema is now explicit in this North Star so the next agent can read project state without inferring it from prose.
  - The open project follow-ups are tracked as T3/T4 in `TRACKER.md`, which keeps the command-matrix and env-var-matrix work visible without widening the slice.

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
  | Task | Keep the dashboard packet current and continue the command-matrix follow-up surfaced in `TRACKER.md`. |
  | Acceptance criteria | `NORTH_STAR.md` carries the dashboard schema; `TRACKER.md` exposes the open command/env-var queue; `GAPS.md` stays compact and actionable; `COLD_START_AGENT_PROMPT.md` points the next agent at the next step. |
  | Allowed boundaries | `docs/projects/scripts-workflows/*` and `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` only for shared-path testimony |
  | Stop condition | the docs reflect current state and no new project code/docs outside this packet are touched. |
  | Verification | `Get-Content` review of touched docs and the registry row. |
  | Owner | Worker C |
  | Next action | Continue with `TRACKER.md` row T3, then T4 if the command matrix stays stable. |

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
  | Command entry points are documented in multiple places with different examples. | adjacent_follow_up | Worker C | `docs/portraits/race_portrait_regen_handoff.md`, `docs/guides/MCP_INTEGRATION.md`, `package.json` | Add one canonical command matrix in project-owned docs and keep legacy pointers explicit. |
  | Research/profile and portrait lanes share environment knobs but docs do not fully normalize them. | support_needed_now | Worker C | `scripts/workflows/gemini/*.ts` | Add one environment-variable matrix reference in project docs and capture defaults from the scripts. |

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
4. Re-verify the registry row in [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md) only if the dashboard card drifts.
5. Continue from T3: keep the command matrix canonical, then refresh the cold-start packet after any command-surface drift.


## Cold-Start Gap Routing

  The next cold-start agent should:
  - start with `TRACKER.md` row T3 and keep T4 queued behind it
  - keep the command matrix and env-var defaults in one project-owned reference
  - only add new project gaps when they are real, evidence-backed, and not duplicates of the shared workflow-path issue already tracked in `WORKFLOW_GAPS.md`

## Required Review Brief

Title: Scripts: Workflows partial due to command/env matrix gaps
Question: Where should operators find the canonical workflow command and environment matrix?
Issue: The project has open gaps for distributed command examples and scattered env-var tuning.
Current behavior: The next step says to consolidate the canonical command matrix, then normalize env-var defaults.
Why blocked: Operators can otherwise follow stale launch patterns and hit brittle CDP/image-generation behavior.
Option A: Create one project-owned command matrix and point legacy docs to it.
Option B: Start with the env-var matrix if runtime fragility is the immediate blocker.
Evidence: NORTH_STAR.md next_step; GAPS.md G1 and G2.
Decision owner: Scripts/Workflow tooling owner
Proof after decision: Project docs and package scripts point to the same command/env matrix.
