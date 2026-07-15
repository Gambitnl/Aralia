# Visual Test Harness + Entity Debugger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One page to eyeball any 3D visual system, one command to capture any of them headlessly, and a deep entity debugger — replacing the scattered `.agent/scratch` probe scripts.

**Architecture:** A pure-data scenario registry (`src/devtools/vistest/scenarios.ts`) is the single source of truth, imported by the harness design step (browsable list + iframe viewport), by a tsx Playwright runner (`tools/vistest/shoot.ts`) that interprets each scenario's declarative capture recipe, and validated by tests. The entity debugger is a second design step instrumenting one `EntityHandle` (anchors, phase scrub, action states, stats) via two small read/debug additions to the assembler API.

**Tech Stack:** TypeScript, React (design-preview steps), three/R3F (debugger scene), Playwright via tsx (runner), vitest 4.

**Spec:** `docs/superpowers/specs/2026-07-14-visual-test-harness-design.md`

## Global Constraints

- **No git commits/branches/worktrees** (Remy directive + Agora rule 6); tasks end at "tests green".
- **Agora:** lock `src/components/DesignPreview/DesignPreviewPage.tsx` and `src/systems/entities3d/**` before editing; `unlock --mine` when done. Agent id `fable-entitygen`.
- **Existing game pages do not change** — capture recipes use hooks pages already expose.
- **No fallbacks:** malformed scenarios fail validation loudly; the runner throws on a failed step naming the scenario + step.
- **Writing:** GOV.UK plain English, US spelling in all copy.
- Test: `npx vitest run <path>`; typecheck: `npm run typecheck` (filter output to touched files; repo has known pre-existing errors elsewhere).

## File Structure

```
src/devtools/vistest/
  scenarios.ts        — CaptureStep + VisScenario types, SCENARIOS array (seed ~10), validateScenarios()
  runnerCore.ts       — pure helpers the node runner + tests share (URL join, step checks, capture command string)
  __tests__/scenarios.test.ts
tools/vistest/shoot.ts — Playwright interpreter (goto → steps → PNG to .agent/vistest/captures/<id>.png)
src/components/DesignPreview/steps/PreviewVisTest.tsx      — harness step (list + iframe + copy command)
src/components/DesignPreview/steps/PreviewEntityDebug.tsx  — debugger controls (lazy scene below)
src/components/DesignPreview/steps/EntityDebugScene.tsx    — R3F scene: instrumented entity
src/components/DesignPreview/DesignPreviewPage.tsx         — MODIFY: two steps (SHARED — lock)
src/systems/entities3d/three/assembleEntity.ts             — MODIFY: pose getter, setGaitPhase, stats()
src/systems/entities3d/__tests__/assemble.test.ts          — MODIFY: cover the debug API
```

---

### Task 1: Scenario registry + validation

**Files:** Create `src/devtools/vistest/scenarios.ts`, `src/devtools/vistest/__tests__/scenarios.test.ts`

**Produces (exact contracts later tasks rely on):**

```ts
export type CaptureStep =
  | { kind: 'waitHook'; expr: string; timeoutMs?: number }  // poll until window expression truthy
  | { kind: 'sleep'; ms: number }
  | { kind: 'eval'; js: string }                            // clock scrub, camera pose, UI click
  | { kind: 'readback' }                                    // rAF toDataURL of the WebGL canvas (terminal)
  | { kind: 'screenshot' };                                 // plain Playwright screenshot (terminal)
export interface VisScenario {
  id: string;                        // kebab-case, unique, becomes <id>.png
  title: string;
  group: 'entities' | 'combat' | 'world' | 'interiors' | 'crowds';
  url: string;                       // relative to dev base, no leading slash, e.g. 'misc/design.html?step=entityforge&race=hill_dwarf&class=wizard&walk=0'
  notes: string;                     // what a reviewer should look for
  capture: CaptureStep[];            // non-empty; exactly one terminal step, last
}
export const SCENARIOS: VisScenario[];
export function validateScenarios(list: VisScenario[]): string[]; // human-readable problems; [] = valid
```

Seed scenarios (10): `forge-dwarf-wizard`, `forge-dragon-huge`, `forge-lineup`, `entitydebug-anchors` (added properly in Task 5 but id reserved here), `combat3d-party`, `combat3d-enemies` (3D View click + `__bm3dCam.poseTeam` + readback), `world-cast-diorama` (`?phase=world3d&ground=1&cast=1`, wheel-zoom eval, readback), `interior-villager` (clock 20 eval + scene-walk pose eval + readback), `crowd-commute` (clock 7.2 + open-walker pose eval + readback), `town-street-aerial`. Copy the working eval snippets verbatim from the proven scratch probes.

- [x] Failing test: ids unique + kebab-case; urls relative (no leading `/`, no host); capture non-empty; exactly one terminal step and it is last; `waitHook.expr`/`eval.js` non-empty; every group is one of the five; `validateScenarios(SCENARIOS)` returns `[]`.
- [x] Implement; `npx vitest run src/devtools/vistest` → PASS.

### Task 2: Runner

**Files:** Create `src/devtools/vistest/runnerCore.ts`, `tools/vistest/shoot.ts`; extend `src/devtools/vistest/__tests__/scenarios.test.ts`

**Produces:**
```ts
// runnerCore.ts (pure, node-free)
export function scenarioUrl(base: string, s: VisScenario): string;        // joins without double slashes
export function captureCommand(s: VisScenario): string;                   // 'npx tsx tools/vistest/shoot.ts --only <id>'
export function outputPath(dir: string, s: VisScenario): string;          // '<dir>/<id>.png'
```
`tools/vistest/shoot.ts`: args `[--only id[,id…]] [--base http://localhost:5174/Aralia/] [--out .agent/vistest/captures]`. Launch chromium headless with the SwiftShader args used by the proven rigs (`--ignore-gpu-blocklist --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader`); per scenario: `goto(scenarioUrl)`, interpret steps (`waitHook` = poll `page.evaluate` every 500 ms up to `timeoutMs ?? 60000`; `readback` = the rAF `canvas.toDataURL` pattern; `screenshot` = `page.screenshot({ timeout: 60000 })` after `document.fonts.ready`), write PNG, log `shot <path>`; throw with scenario id + step index on failure; exit non-zero if any scenario failed.

- [x] Failing tests for the three pure helpers (base with/without trailing slash; command string exact; path join).
- [x] Implement both files; unit tests PASS. (Live smoke happens in Task 6 against the dev server.)

### Task 3: EntityHandle debug API

**Files:** Modify `src/systems/entities3d/three/assembleEntity.ts`, `src/systems/entities3d/three/gaits.ts` (only if a phase setter needs plumbing), `src/systems/entities3d/__tests__/assemble.test.ts`

**Produces (on `EntityHandle`):**
```ts
readonly pose: Pose;                       // the live driver pose (anchor transforms)
setGaitPhase(phase: number): void;         // debugger scrub; next update(t, 0) re-poses at that phase
stats(): { resolution: number; lastFieldRebuildMs: number; renderMode: EntityRenderMode };
```
Implementation: `pose` getter returns `driver.pose`; `setGaitPhase` writes `driver.gaitPhase` (public field on BaseDriver) and resets the field throttle (`lastFieldT = -Infinity`) so the next update rebuilds; wrap the field-rebuild block in `performance.now()` bookkeeping for `lastFieldRebuildMs`.

- [x] Failing test: after `setGaitPhase(0.25)` + `update(t, 0)`, `handle.pose.anchors.handR.pos.z` differs from phase 0.75 at the same `t` while walking; `stats().resolution` > 0; `stats().lastFieldRebuildMs` ≥ 0.
- [x] Implement; `npx vitest run src/systems/entities3d` → all PASS.

### Task 4: Harness step

**Files:** Create `src/components/DesignPreview/steps/PreviewVisTest.tsx`; Modify `src/components/DesignPreview/DesignPreviewPage.tsx` (lock first): import + `{ id: 'vistest', label: 'Visual Tests', group: 'tooling' }` + render line.

UI: left column — search box + scenarios grouped by `group`, each row: title, notes, buttons **Load** (sets iframe src to `/Aralia/${s.url}` — note the iframe needs the leading base), **Open** (`window.open`), **Copy capture cmd** (`navigator.clipboard.writeText(captureCommand(s))`). Right: `<iframe>` filling the pane (`title="vistest viewport"`). Selected row highlighted; deep link `?step=vistest&scenario=<id>` preselects + loads.

- [x] Wire + eyeball via `node tools/agora/shoot-page.mjs "http://localhost:5174/Aralia/misc/design.html?step=vistest&scenario=forge-dwarf-wizard" .agent/vistest/harness.png --wait 9000` — list left, live forge scene in the iframe right.

### Task 5: Entity debugger step

**Files:** Create `src/components/DesignPreview/steps/PreviewEntityDebug.tsx` (controls; lazy-loads scene), `src/components/DesignPreview/steps/EntityDebugScene.tsx`; Modify `DesignPreviewPage.tsx` (step `{ id: 'entitydebug', label: 'Entity Debug', group: 'character' }`), `src/devtools/vistest/scenarios.ts` (replace the reserved `entitydebug-anchors` stub with the real URL/recipe).

Controls (URL-initialized like the forge: `race`, `class`, `mode`, `type`, `size`, `seed`, plus `overlay` flags): race/class or creature pickers (reuse the forge's data imports), render mode select, **anchors overlay** toggle, **freeze** toggle + **phase slider 0–1** (drives `setGaitPhase`, freeze passes `dt = 0` and holds `t`), action-state buttons `idle | walk | melee | ranged | cast | hit | death` (walk = loco speed; others drive `combatOverlayPose` from `@/components/BattleMap/characters/characterActor/entityOverlays` applied to `handle.group` exactly as `EntityModel` does, with a local anim clock), part visibility checklist (toggles `visible` on `part:<id>` containers), camera preset buttons (front/side/top/turntable via OrbitControls + a slow auto-rotate flag), stats readout (fps rolling avg, `gl.info.render.triangles`/`calls`, `handle.stats()`).

Scene: single entity at origin on the forge's toon yard (reuse `Ground`/`SceneChrome` patterns from `EntityForgeScene`); anchors overlay = 15 small spheres + `<Html>` labels positioned each frame from `handle.pose`; expose `window.__entitydebug = { scene, camera, renderer, handle }`.

- [x] Wire; suites still green (`npx vitest run src/devtools/vistest src/systems/entities3d`).
- [x] Eyeball: shoot `?step=entitydebug&race=hill_dwarf&class=wizard&overlay=anchors` and an action state; anchors sit on head/hands/hips; scrub freezes mid-stride.

### Task 6: End-to-end verification + closeout

- [x] `npx tsx tools/vistest/shoot.ts --only forge-dwarf-wizard,world-cast-diorama,crowd-commute` against the dev server → three PNGs in `.agent/vistest/captures/`; eyeball each.
- [x] Full run `npx tsx tools/vistest/shoot.ts` → all scenarios captured or a named failure.
- [x] `npm run typecheck` filtered to touched files → clean; all new/touched vitest suites green.
- [x] Send Remy the harness + debugger + one runner capture as proof.
- [x] Plan-map: add feature to `entity-generator-3d`? No — new topic `visual-test-harness` (campaign `tooling`, status `done`, link to spec) via `tools/agora/planmap-add.mjs` (lock `public/planmap/topics.json`).
- [x] Memory: new `visual-test-harness` memory + MEMORY.md line; Agora `say` + `unlock --mine`.

## Self-review

- **Spec coverage:** registry (T1), runner (T2), harness page (T4), debugger + API (T3+T5), tests (T1–T3), proof-by-own-runner (T6). Out-of-scope items untouched. ✓
- **Placeholders:** none; every step names files, ids, commands. ✓
- **Type consistency:** `VisScenario`/`CaptureStep` (T1) consumed by T2/T4/T5; `captureCommand` (T2) used in T4; `setGaitPhase`/`stats`/`pose` (T3) used in T5. ✓
