# Testkit DevTools Toolkit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/testkit` project skill (troubleshoot / perf / smoke modes driven live through the chrome-devtools MCP) plus a baseline-diff script so regressions are called out automatically.

**Architecture:** The skill is markdown playbooks — `SKILL.md` dispatches to one workflow file per mode, and each workflow tells the executing agent exactly which `mcp__chrome-devtools__*` tools to call against the Aralia dev server. The only code is `tools/testkit/baseline.mjs`: a pure `compareRuns` function plus a small CLI that persists runs under `.agent/testkit/` and diffs against a promoted baseline.

**Tech Stack:** Node ESM (.mjs), vitest 4 for tests, chrome-devtools MCP (no Puppeteer/Playwright).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-14-testkit-devtools-toolkit-design.md`.
- Thresholds (verbatim from spec): heap +15%, any console-error count above baseline, any other perf metric +20%.
- `.agent/testkit/` is gitignored scratch (this repo does NOT wholesale-ignore `.agent/`; add the specific path).
- No fallback paths: if the MCP or dev server is unavailable, the workflows say so and stop (Remy's no-fallback directive).
- A visual surface never passes without a screenshot.
- Do NOT create git commits — this repo auto-commits via a 2am daily snapshot; skip every "Commit" step convention.
- Writing style for all markdown: GOV.UK plain English, US spelling.
- Dev server: launch config `dev` on port 5174 (`.claude/launch.json`); base URL `http://localhost:5174`.

---

### Task 1: baseline compare logic + CLI (`tools/testkit/baseline.mjs`)

**Files:**
- Create: `tools/testkit/baseline.mjs`
- Test: `tools/testkit/__tests__/baseline.test.ts`
- Modify: `.gitignore` (append the `.agent/testkit/` ignore)

**Interfaces:**
- Produces: `compareRuns(baseline, run) => { regressions: string[], improvements: string[], notes: string[] }` (named export).
- Produces: CLI `node tools/testkit/baseline.mjs <run.json> [--promote]` — exit 0 clean, exit 1 if regressions.
- Run JSON shape (both files use it):

```json
{
  "surfaces": {
    "atlas": { "consoleErrors": 0, "heapMB": 312.4, "lcpMs": 1800, "longTasksMs": 240 }
  }
}
```

Any numeric key other than `consoleErrors` and `heapMB` uses the generic +20% threshold. `heapMB` uses +15%. `consoleErrors` regresses on ANY increase over baseline.

- [ ] **Step 1: Write the failing tests**

Create `tools/testkit/__tests__/baseline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { compareRuns } from '../baseline.mjs';

const base = {
  surfaces: {
    atlas: { consoleErrors: 0, heapMB: 100, lcpMs: 1000 },
  },
};

describe('compareRuns', () => {
  it('reports clean when metrics are within thresholds', () => {
    const run = { surfaces: { atlas: { consoleErrors: 0, heapMB: 110, lcpMs: 1100 } } };
    const result = compareRuns(base, run);
    expect(result.regressions).toEqual([]);
  });

  it('flags any console-error increase', () => {
    const run = { surfaces: { atlas: { consoleErrors: 1, heapMB: 100, lcpMs: 1000 } } };
    const result = compareRuns(base, run);
    expect(result.regressions).toHaveLength(1);
    expect(result.regressions[0]).toContain('consoleErrors');
  });

  it('flags heap growth over 15%', () => {
    const run = { surfaces: { atlas: { consoleErrors: 0, heapMB: 116, lcpMs: 1000 } } };
    expect(compareRuns(base, run).regressions[0]).toContain('heapMB');
  });

  it('flags generic metrics over 20% but not under', () => {
    const over = { surfaces: { atlas: { consoleErrors: 0, heapMB: 100, lcpMs: 1201 } } };
    const under = { surfaces: { atlas: { consoleErrors: 0, heapMB: 100, lcpMs: 1199 } } };
    expect(compareRuns(base, over).regressions).toHaveLength(1);
    expect(compareRuns(base, under).regressions).toEqual([]);
  });

  it('notes surfaces new to this run and surfaces missing from it', () => {
    const run = { surfaces: { combat: { consoleErrors: 0 } } };
    const result = compareRuns(base, run);
    expect(result.notes.join(' ')).toContain('combat');
    expect(result.notes.join(' ')).toContain('atlas');
  });

  it('reports improvements when a metric drops 20% or more', () => {
    const run = { surfaces: { atlas: { consoleErrors: 0, heapMB: 100, lcpMs: 700 } } };
    expect(compareRuns(base, run).improvements[0]).toContain('lcpMs');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tools/testkit/__tests__/baseline.test.ts`
Expected: FAIL — cannot resolve `../baseline.mjs`.

- [ ] **Step 3: Write the implementation**

Create `tools/testkit/baseline.mjs`:

```js
// Testkit baseline store + diff. Pure logic in compareRuns; CLI persists runs
// under .agent/testkit/ and diffs against .agent/testkit/baseline.json.
// Usage: node tools/testkit/baseline.mjs <run.json> [--promote]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HEAP_THRESHOLD = 0.15;      // heapMB may grow 15% before it regresses
const GENERIC_THRESHOLD = 0.20;   // every other numeric metric: 20%

export function compareRuns(baseline, run) {
  const regressions = [];
  const improvements = [];
  const notes = [];
  const baseSurfaces = baseline?.surfaces ?? {};
  const runSurfaces = run?.surfaces ?? {};

  for (const name of Object.keys(runSurfaces)) {
    if (!(name in baseSurfaces)) notes.push(`surface "${name}" is new (no baseline)`);
  }
  for (const name of Object.keys(baseSurfaces)) {
    if (!(name in runSurfaces)) notes.push(`surface "${name}" missing from this run`);
  }

  for (const [name, metrics] of Object.entries(runSurfaces)) {
    const baseMetrics = baseSurfaces[name];
    if (!baseMetrics) continue;
    for (const [key, value] of Object.entries(metrics)) {
      const baseValue = baseMetrics[key];
      if (typeof value !== 'number' || typeof baseValue !== 'number') continue;
      if (key === 'consoleErrors') {
        if (value > baseValue) regressions.push(`${name}.consoleErrors: ${baseValue} -> ${value}`);
        continue;
      }
      const threshold = key === 'heapMB' ? HEAP_THRESHOLD : GENERIC_THRESHOLD;
      if (baseValue > 0 && value > baseValue * (1 + threshold)) {
        regressions.push(`${name}.${key}: ${baseValue} -> ${value} (over +${threshold * 100}%)`);
      } else if (baseValue > 0 && value <= baseValue * (1 - GENERIC_THRESHOLD)) {
        improvements.push(`${name}.${key}: ${baseValue} -> ${value}`);
      }
    }
  }
  return { regressions, improvements, notes };
}

function main() {
  const args = process.argv.slice(2);
  const promote = args.includes('--promote');
  const runPath = args.find((a) => !a.startsWith('--'));
  if (!runPath) {
    console.error('Usage: node tools/testkit/baseline.mjs <run.json> [--promote]');
    process.exit(2);
  }
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const storeDir = path.join(repoRoot, '.agent', 'testkit');
  const runsDir = path.join(storeDir, 'runs');
  const baselinePath = path.join(storeDir, 'baseline.json');

  const run = JSON.parse(readFileSync(runPath, 'utf8'));
  mkdirSync(runsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(path.join(runsDir, `${stamp}.json`), JSON.stringify(run, null, 2));

  if (!existsSync(baselinePath)) {
    writeFileSync(baselinePath, JSON.stringify(run, null, 2));
    console.log('No baseline existed — this run is now the baseline.');
    return;
  }

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const { regressions, improvements, notes } = compareRuns(baseline, run);
  for (const n of notes) console.log(`note: ${n}`);
  for (const i of improvements) console.log(`improved: ${i}`);
  if (regressions.length) {
    console.log(`REGRESSIONS (${regressions.length}):`);
    for (const r of regressions) console.log(`  ${r}`);
  } else {
    console.log('Clean: no regressions against baseline.');
  }

  if (promote) {
    writeFileSync(baselinePath, JSON.stringify(run, null, 2));
    console.log('Baseline promoted to this run.');
  }
  process.exit(regressions.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tools/testkit/__tests__/baseline.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Add the gitignore entry**

Append to `.gitignore` (near the other path-specific `.agent/` entries around line 243):

```gitignore
# Testkit run history + baselines (throwaway proof, spec 2026-07-14-testkit)
.agent/testkit/
```

- [ ] **Step 6: Smoke the CLI by hand**

```powershell
'{"surfaces":{"atlas":{"consoleErrors":0,"heapMB":100}}}' | Out-File -Encoding utf8 G:\Temp\claude\run1.json
node tools/testkit/baseline.mjs G:\Temp\claude\run1.json
'{"surfaces":{"atlas":{"consoleErrors":2,"heapMB":100}}}' | Out-File -Encoding utf8 G:\Temp\claude\run2.json
node tools/testkit/baseline.mjs G:\Temp\claude\run2.json
```

Expected: first call prints "No baseline existed"; second prints `REGRESSIONS (1)` with `atlas.consoleErrors: 0 -> 2` and exits 1. Confirm `.agent/testkit/runs/` holds two files and `git status` does not show `.agent/testkit/`.

---

### Task 2: skill entry point (`.claude/skills/testkit/SKILL.md`)

**Files:**
- Create: `.claude/skills/testkit/SKILL.md`

**Interfaces:**
- Consumes: `tools/testkit/baseline.mjs` CLI from Task 1.
- Produces: the mode-dispatch contract used by Tasks 3–5 — workflow files at `.claude/skills/testkit/workflows/{troubleshoot,perf,smoke}.md`, and the shared run-JSON shape from Task 1.

- [ ] **Step 1: Write SKILL.md**

```markdown
---
name: testkit
description: Use when testing or diagnosing Aralia in a real browser — bug troubleshooting, performance/memory checks, or smoke passes over the key game surfaces. Drives the chrome-devtools MCP live and diffs results against saved baselines. Modes: troubleshoot | perf | smoke.
---

# Testkit

Test Aralia through the chrome-devtools MCP ("DevTools for agents"). Three modes,
each a checklist in `workflows/`:

| Mode | When | File |
|------|------|------|
| `troubleshoot` | Something is broken in the running game | `workflows/troubleshoot.md` |
| `perf` | Measure a surface: trace + heap + (2D only) Lighthouse | `workflows/perf.md` |
| `smoke` | Sweep the key surfaces for errors + proof screenshots | `workflows/smoke.md` |

Invoked without a mode? Ask which one (use AskUserQuestion).

## Ground rules (all modes)

1. **Dev server first.** Target the `dev` launch config, `http://localhost:5174`.
   If it is not running, start it via the preview tools (`preview_start` with
   name `dev`), never via Bash. If it will not start or the chrome-devtools MCP
   tools are unavailable, STOP and say so — no fallback path.
2. **Fresh console only.** Chrome buffers console messages; a buffer read after
   the fact can be stale. Navigate (or reload) first, then read
   `list_console_messages`. For World3D issues use the in-page deterministic
   replay recipe instead of trusting old output.
3. **Screenshots are the pass condition for anything visual.** Never report a
   visual surface as working from numbers alone. R3F/WebGL scenes can hang naive
   screenshot paths — if `take_screenshot` stalls, fall back to the repo's
   shoot.mjs rig or a rAF readback, and say which you used.
4. **Baselines.** When a mode produces metrics, write them into the run-JSON
   shape below and run `node tools/testkit/baseline.mjs <run.json>`
   (`--promote` only when the user agrees the run is the new baseline). Runs
   live in `.agent/testkit/` (gitignored).

## Run JSON shape

    {
      "surfaces": {
        "<surface-name>": {
          "consoleErrors": 0,
          "heapMB": 312.4,
          "lcpMs": 1800,
          "longTasksMs": 240
        }
      }
    }

`consoleErrors` regresses on any increase; `heapMB` on +15%; every other numeric
metric on +20%.

## Known gotchas (apply in every mode)

- StrictMode double-invokes effects and clobbers one-shot drill signals — a
  "missed" 3D drill is often this, not a bug.
- Combat runs without Ollama via `?dummy=1&dev_combat=1`.
- The player's streamed cell is not the town cell — town identity comes from
  `groundTownBurgs`.
```

- [ ] **Step 2: Verify the skill loads**

Run: `Get-ChildItem .claude/skills/testkit` and confirm `SKILL.md` exists. In a fresh session (or via the Skill tool if the harness picks it up live), confirm `testkit` appears in the available-skills list. If live pickup is not possible, note that verification happens in Task 6.

---

### Task 3: troubleshoot workflow

**Files:**
- Create: `.claude/skills/testkit/workflows/troubleshoot.md`

**Interfaces:**
- Consumes: ground rules + gotchas from `SKILL.md` (Task 2).

- [ ] **Step 1: Write workflows/troubleshoot.md**

```markdown
# Testkit: troubleshoot

Use with the superpowers:systematic-debugging skill — this file is the
browser-evidence half; that skill owns the hypothesis loop.

Input needed from the user (ask if missing): the URL or phase where the bug
shows, and what "broken" looks like.

## Checklist

1. Ensure the dev server is running (SKILL.md ground rule 1).
2. `new_page` (or `select_page`) to the target URL. Reproduce from a fresh
   navigation so the console buffer is fresh.
3. `list_console_messages` — record every error/warning verbatim.
4. `list_network_requests` — flag failed requests, 4xx/5xx, and missing chunks.
   `get_network_request` on anything suspicious.
5. Probe app state with `evaluate_script` (read-only probes; do not patch the
   page to "fix" it — fixes go in source).
6. Reproduce the interaction with `click` / `type_text` / `press_key`, watching
   the console between steps to bracket exactly which action triggers the error.
7. Suspected memory leak: `take_heapsnapshot` before and after the interaction,
   compare retained sizes, name the biggest growers.
8. `take_screenshot` of the broken state (fallbacks per ground rule 3).

## Output

Report: reproduction steps, verbatim error(s), the narrowed trigger, network
evidence, and the screenshot. Then hand back to systematic-debugging for root
cause — do not jump to a patch from symptoms alone.
```

- [ ] **Step 2: Review against spec**

Confirm the file covers spec Mode 1 items 1–7 and all three embedded gotchas (gotchas live in SKILL.md; the workflow references ground rules). Fix any gap inline.

---

### Task 4: perf workflow

**Files:**
- Create: `.claude/skills/testkit/workflows/perf.md`

**Interfaces:**
- Consumes: run-JSON shape + baseline CLI from Task 1; ground rules from Task 2.

- [ ] **Step 1: Write workflows/perf.md**

```markdown
# Testkit: perf

Measure one named surface. Ask the user which if not given. Canonical surfaces
and how to reach them:

| Surface | URL |
|---------|-----|
| atlas | http://localhost:5174/ (Worldforge map) |
| world3d | 3D entry via the wf-town3d flow |
| combat | http://localhost:5174/?dummy=1&dev_combat=1 |
| townpreview | wf-town3d design preview |

## Checklist

1. Ensure the dev server is running; open the surface in a fresh page.
2. `performance_start_trace` (with reload if measuring load; without if
   measuring an interaction).
3. Drive the representative interaction (pan/zoom the atlas, run a combat
   round, walk the 3D scene) with `click` / `press_key`.
4. `performance_stop_trace`, then `performance_analyze_insight` on the insights
   the trace summary lists. Record: LCP (load traces), total long-task time,
   and the top insight findings.
5. Heap delta: `take_heapsnapshot` before the interaction and after; record
   both sizes in MB. Growth after the scene is settled = leak candidate.
6. 2D surfaces only (atlas, planmap, dev hub): `lighthouse_audit`, record the
   performance score.
7. Write the numbers into the run JSON (shape in SKILL.md) at
   `.agent/testkit/last-perf.json`, then:
   `node tools/testkit/baseline.mjs .agent/testkit/last-perf.json`
8. Report the baseline diff output verbatim, plus your reading of the top
   insight. `--promote` only with user sign-off.

## Notes

- One surface per trace. Traces on the 3D world are heavy; keep interactions
  short (10–20 s).
- Do not run Lighthouse on WebGL surfaces; its metrics are meaningless there.
```

- [ ] **Step 2: Review against spec**

Confirm coverage of spec Mode 2 items 1–5 (trace, insight, heap before/after, optional Lighthouse, baseline write). Fix gaps inline.

---

### Task 5: smoke workflow

**Files:**
- Create: `.claude/skills/testkit/workflows/smoke.md`

**Interfaces:**
- Consumes: run-JSON shape + baseline CLI from Task 1; ground rules from Task 2.

- [ ] **Step 1: Write workflows/smoke.md**

```markdown
# Testkit: smoke

Sweep the key surfaces: navigate, wait for ready, count console errors,
screenshot. Edit this table to add or retire surfaces.

| # | Surface | URL / route | Ready signal |
|---|---------|-------------|--------------|
| 1 | atlas | http://localhost:5174/ | map SVG rendered (wait_for map container) |
| 2 | spawnpreview | http://localhost:5174/?phase=spawnpreview | preview canvas visible |
| 3 | world3d | 3D entry via wf-town3d flow | first frame rendered (rAF readback if screenshot hangs) |
| 4 | agentsim | http://localhost:5174/?phase=agentsim | commuters moving |
| 5 | pixiboard | http://localhost:5174/?pixiboard=1 | Pixi canvas visible |
| 6 | dungeon | dungeon preview route (PreviewDungeon — gitignored, on disk only) | sheet rendered |
| 7 | combat | http://localhost:5174/?dummy=1&dev_combat=1 | combat HUD visible |

## Per surface

1. `navigate_page` to the URL; `wait_for` the ready signal (10 s budget —
   longer for world3d first load).
2. `list_console_messages`; count messages at error level. Record the count
   and the first error verbatim if any.
3. `take_screenshot` (fallback per SKILL.md ground rule 3). Save to
   `.agent/testkit/shots/<surface>.png`.
4. Mark pass/fail: fail = ready signal never appeared, OR any console error,
   OR no screenshot captured.

## Output

1. A pass/fail table (surface, errors, first error, screenshot path).
2. Send ALL screenshots to the user — they eyeball every visual surface;
   numbers alone never pass a surface.
3. Write consoleErrors per surface into the run JSON at
   `.agent/testkit/last-smoke.json`, run
   `node tools/testkit/baseline.mjs .agent/testkit/last-smoke.json`, and
   include the diff output in the report.
4. If a surface fails, offer to switch to `workflows/troubleshoot.md` on it.
```

- [ ] **Step 2: Review against spec**

Confirm all seven spec surfaces appear, output includes pass/fail table + screenshots to user + baseline diff. Fix gaps inline.

---

### Task 6: end-to-end verification run

**Files:**
- No new files; exercises everything above.

**Interfaces:**
- Consumes: the full skill (Tasks 2–5) and the CLI (Task 1).

- [ ] **Step 1: Run the smoke workflow for real**

Invoke `/testkit smoke` (or follow `workflows/smoke.md` manually with the chrome-devtools MCP tools). Dev server via `preview_start` name `dev`.

Expected: a pass/fail table for all 7 surfaces, screenshots in `.agent/testkit/shots/`, screenshots sent to the user, and a baseline diff printed ("No baseline existed" on the first ever run).

- [ ] **Step 2: Run one perf pass**

Follow `workflows/perf.md` on the `atlas` surface. Expected: trace insights reported, heap before/after numbers, Lighthouse score, and `last-perf.json` written and diffed.

- [ ] **Step 3: Confirm hygiene**

Run: `git status --short`
Expected: new skill files and `tools/testkit/` show as untracked/modified; nothing under `.agent/testkit/` appears. Do not commit — the 2am snapshot handles it.

- [ ] **Step 4: Report to the user**

Send the smoke table + screenshots and the perf findings. Ask (via AskUserQuestion) whether to `--promote` these runs as the initial baselines.
