# Testkit: DevTools-driven testing toolkit

Date: 2026-07-14
Status: approved design, pre-implementation

## Purpose

One project skill, `/testkit`, that turns the chrome-devtools MCP ("DevTools for agents", Chrome 150) into a repeatable testing workflow for Aralia. It covers three jobs: bug troubleshooting, performance and memory watching, and visual/functional smoke tests. Results persist as baselines so regressions are called out automatically.

## Packaging

- Skill lives at `.claude/skills/testkit/` with `SKILL.md` as the entry point and one workflow file per mode.
- Modes: `/testkit troubleshoot`, `/testkit perf`, `/testkit smoke`. Bare `/testkit` asks which mode.
- All browser work uses chrome-devtools MCP tools live (navigate, console, network, evaluate, traces, heap snapshots, screenshots). No new automation framework.
- One helper script: `tools/testkit/baseline.mjs` for saving and diffing run results.

## Mode 1: troubleshoot

For "the game is broken in the browser." A checklist the agent follows in order:

1. Confirm the dev server is running; start it via the existing launch config if not.
2. Open the target URL in a DevTools-MCP page.
3. Read fresh console messages. Do not trust stale buffers — use the in-page deterministic replay recipe for World3D issues.
4. List network requests; flag failures and missing chunks.
5. Probe app state with `evaluate_script` as needed.
6. If a memory leak is suspected, take a heap snapshot and inspect.
7. Capture a proof screenshot.

Embedded gotchas the workflow must state:
- R3F scenes hang naive screenshot tools; use rAF readback or shoot.mjs instead.
- StrictMode clobbers one-shot drill signals.
- Combat can run Ollama-free via `?dummy=1&dev_combat=1`.

## Mode 2: perf

For a named surface (3D world, atlas, combat, town preview):

1. `performance_start_trace` → drive the interaction → `performance_stop_trace`.
2. `performance_analyze_insight` for the main findings.
3. Heap snapshot before and after the interaction; report the delta.
4. Optional Lighthouse audit for 2D surfaces.
5. Write key metrics (LCP, long-task total, heap size) to the baseline store.

## Mode 3: smoke

A fixed, editable surface list in the skill:

- Worldforge atlas (main map)
- `?phase=spawnpreview`
- 3D entry via wf-town3d preview
- `?phase=agentsim`
- `?pixiboard=1`
- Dungeon preview
- Combat via `?dummy=1&dev_combat=1`

For each surface: navigate, wait for ready, count console errors, capture a screenshot. Output is a pass/fail table plus the screenshots sent to the user for eyeballing. A surface never passes on numbers alone — the screenshot must exist.

## Baselines

`tools/testkit/baseline.mjs`:

- Input: a JSON blob of the run's metrics (per-surface error counts, perf metrics, heap sizes).
- Writes the run under `.agent/testkit/runs/<timestamp>.json`.
- Diffs against `.agent/testkit/baseline.json` and prints regressions.
- Default thresholds: heap +15%, any console-error count above baseline, any perf metric +20%.
- `--promote` makes the current run the new baseline.
- `.agent/testkit/` is gitignored scratch, like other proof output.

## Error handling

- If the chrome-devtools MCP or the dev server is unavailable, fail honestly and say so. No fallback paths.
- Never report a visual surface as passing without a screenshot.

## Out of scope

- CI integration.
- Subagent dispatch for heavy runs (add later if token cost bites).
- Chrome extension management and `--experimentalMemory` flags; the standard MCP heap tools cover current needs.
