# Visual test harness + entity debugger — design

**Date:** 2026-07-14
**Status:** Approved by Remy (scope: "Both, phased" — harness shell + entity debugger module; design approved same session)
**Problem:** visual verification happens through ~178 one-off Playwright scripts in `.agent/scratch/`, each rediscovering the same window hooks, waits, clock scrubs, and camera poses. There is no single page to eyeball a visual system and no single command to capture one.

## What we're building

1. **A scenario registry** — pure data, one file. A scenario = a named, deep-linkable visual test: which page, which URL params, what to look for, and a short declarative capture recipe (wait for a hook, set the clock, pose the camera, read back the frame).
2. **A harness page** (`design.html?step=vistest`) — the registry rendered as a browsable list (grouped, searchable) with a live iframe viewport. Per scenario: load in viewport, open in new tab, copy the headless capture command.
3. **A canonical capture runner** (`tools/vistest/shoot.ts`, run with tsx) — reads the same registry, executes each scenario's recipe headlessly, writes PNGs to `.agent/vistest/captures/`. Replaces the scratch-probe pattern.
4. **An entity debugger page** (`design.html?step=entitydebug`) — the first deep module: one entity under instrumentation. Anchor overlay (all 15 anchors, labeled), gait freeze + phase scrub, action-state buttons (walk, melee, ranged, cast, hit, death), render mode toggle, part visibility checklist, camera presets + turntable, live stats (fps, triangles, draw calls, field rebuild ms). This is where the wireframe-body redo gets eyeballed.

## Key decisions

- **Existing game pages do not change.** The registry's capture recipes use the hooks pages already expose (`__entityforge`, `__wf3dScene`, `__wf3dSetPose`, `__wfAgentClock`, `__bm3dCam`). Formalize, don't retrofit. A standard hook can come later if ever needed.
- **One source of truth.** The registry is a TypeScript data module (`src/devtools/vistest/scenarios.ts`) imported by both the harness page (vite) and the runner (tsx). No JSON mirror.
- **Declarative capture steps**, interpreted by the runner: `waitHook` (window expression truthy), `sleep`, `eval` (clock scrubs, camera poses, button clicks), `readback` (rAF framebuffer read — the proven technique for R3F pages under SwiftShader), `screenshot` (plain capture for 2D pages). A registry test validates every scenario (unique ids, non-empty recipe, terminal capture step).
- **Debugger needs two small entity API additions** on `EntityHandle`: read-only `pose` (the driver's anchor transforms) and `setGaitPhase(p)` + a `stats()` snapshot (resolution, last field rebuild ms). No behavior change for existing consumers.
- **Action states** reuse `combatOverlayPose` from the combat actor (already pure + tested).

## Out of scope

Retrofitting a standard `__vistest` hook into game scenes; migrating or deleting old scratch scripts (they are throwaway); golden-image diffing (captures are for eyeballs and agents, not pixel assertions); non-3D UI testing.

## Testing

- Registry validation test (ids unique, recipes well-formed, URLs relative).
- Runner's pure pieces tested (URL building, step validation); the Playwright loop is smoke-run against real scenarios as the build's verification step.
- Entity API additions covered in the assembler test.
- Visual proof: harness + debugger screenshots via the runner itself (it must capture its own pages).
