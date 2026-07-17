# Text-to-Creature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Describe any monster in text; the Claude CLI writes a constrained JSON body plan; the segment pipeline builds a walking creature; every generation lands in a reviewable library where approval turns it into shippable game data.

**Architecture:** A pure schema/validator defines the body-plan language. A compiler turns a plan into the existing `EntityBlueprint` (plus a `planSpec` the new `plan` gait driver animates: treadmill legs, wag tails, wave tentacles, flap wings, bobbing multi-heads, serpentine/floating spines). A new devhub domain module shells out to `claude -p` and owns the library files. The forge gains Describe + Library modes; the debugger loads library creatures by id.

**Tech Stack:** TypeScript, three ^0.172, vitest 4, vite dev-server middleware (devhub domain-module pattern), Claude CLI (`claude -p --model claude-fable-5`).

**Spec:** `docs/superpowers/specs/2026-07-15-text-to-creature-design.md`

## Global Constraints

- **No git commits/branches/worktrees** (Remy standing rule; 2am auto-snapshots). Tasks end at "tests green".
- **Agora:** re-register (`AGORA_AGENT_ID=fable-entitygen`), lock `src/systems/entities3d/**` + `src/components/DesignPreview/steps/PreviewEntityForge.tsx` + `scripts/vite-plugins/devHubApiManager.ts` before editing; on conflict RESERVE (`client.mjs reserve <path>`), never proceed unlocked; `unlock --mine` at the end. Lock in its OWN command; check the result before any write.
- **No fallbacks:** invalid plans fail with the full named-error list (one CLI retry with errors appended, then surface verbatim). No silent clamping. Unknown `partId` → reject.
- **Writing:** GOV.UK plain English, US spelling in all copy and errors.
- **Determinism:** compiling a stored plan is pure; recipe `seed` only drives blink/idle offsets.
- Test: `npx vitest run <path>`; typecheck `npm run typecheck` filtered to touched files (repo has known pre-existing errors elsewhere).
- Races/classes and the six existing gaits are untouched; `assembleEntity`'s public contract is unchanged.

## File Structure

```
src/systems/entities3d/
  textPlan/planSchema.ts        — CreaturePlan/Appendage/Head types + validateCreaturePlan (pure)
  textPlan/compilePlan.ts       — CreaturePlan → { frame, palette, parts, label, planSpec }
  textPlan/fixtures.ts          — canned plans: dragon, three-headed serpent, tentacled ooze, floating eye
  types.ts                      — Gait union += 'plan'; EntityBlueprint += planSpec?; EntityRecipe += {kind:'planned'}
  generateEntityBlueprint.ts    — handle kind 'planned' via compilePlan
  three/gaits.ts                — PlanDriver + createGaitDriver(gait, frame, planSpec?)
  three/assembleEntity.ts       — pass blueprint.planSpec into createGaitDriver (one line)
  __tests__/planSchema.test.ts / compilePlan.test.ts / planDriver.test.ts
scripts/vite-plugins/devhub/
  creaturePlanRoutes.ts         — handleCreaturePlanRoutes(ctx): generate/revise/list/approve + CLI runner + library io
  __tests__/creaturePlanRoutes.test.ts
scripts/vite-plugins/devHubApiManager.ts — +2 lines: dynamic import + dispatch (SHARED — lock)
src/data/creatures3d/plans/    — library entries (route-written JSON; game-importable via import.meta.glob)
src/components/DesignPreview/steps/
  PreviewEntityForge.tsx        — +Describe and +Library modes (SHARED-ish — lock)
  PreviewEntityDebug.tsx        — ?planId=<id> loads a library creature
```

---

### Task 1: Body-plan schema + validator

**Files:**
- Create: `src/systems/entities3d/textPlan/planSchema.ts`
- Test: `src/systems/entities3d/__tests__/planSchema.test.ts`

**Produces (later tasks rely on these exact names):**

```ts
export interface PlanChainLink { lenFt: number; r: number }
export interface PlanAppendage {
  kind: 'leg' | 'arm' | 'tail' | 'tentacle' | 'neck' | 'wing';
  attach: number;            // 0 front – 1 rear along the spine
  heightFrac?: number;       // 0–1; defaults per kind (leg 0.05, arm 0.75, tail 0.35, tentacle 0.4, neck 0.9, wing 0.8)
  perSide?: boolean;
  count: number;             // 1–4 (per side when perSide)
  chain: PlanChainLink[];    // 1–8 links; lenFt 0.1–12; r 0.02–1 (fraction of base body radius)
}
export interface PlanHead {
  neckIndex?: number;        // index into appendages; that entry must be kind 'neck'
  sizeScale: number;         // 0.4–2
  eyes: { count: number; sizeScale: number };  // count 0–8; sizeScale 0.4–2
  snout?: { lengthScale: number; droop: number };  // 0.3–2.5 / -0.6–0.8
}
export interface CreaturePlan {
  name: string;              // 1–40 chars
  frame: { heightFt: number; lengthFt?: number; bulk: number; stance: 'upright' | 'horizontal' | 'serpentine' | 'floating' };
  spine: { segments: number; taper: number; arch: number };  // 2–8 / 0.3–1 / -0.5–0.5
  appendages: PlanAppendage[];  // 0–12
  heads: PlanHead[];            // 1–5
  palette: { bodyHex: string; accentHex?: string; bellyHex?: string; eyeHex: string };
  garnish?: Array<{ partId: string; params?: Record<string, number> }>;  // 0–8
}
export function validateCreaturePlan(input: unknown, knownPartIds: ReadonlySet<string>): string[];
export const PLAN_LIMITS: { heightFt: [0.5, 30]; lengthFt: [1, 60]; ... };  // every range above, exported for prompt-building
```

Validation rules (each produces one named error string, e.g. `frame.heightFt 45 outside 0.5–30`):
ranges above; `name` 1–40 chars; hex fields match `/^#[0-9a-f]{6}$/i`; `lengthFt` REQUIRED when stance is `horizontal` or `serpentine`; `heads[i].neckIndex` must point at an existing appendage of kind `neck`; `garnish[].partId` must be in `knownPartIds`; unknown top-level or nested keys rejected (`unknown field appendages[2].motion`); non-object input → `plan is not an object`.

- [x] **Write the failing tests first** — accept: all four fixture-shaped plans (inline literals here; Task 2 moves them to fixtures.ts) return `[]`. Reject: each rule above with at least one case asserting the exact error substring (13+ cases). Include: serpent with 0 appendages valid; `neckIndex` at a `tail` → error; extra key → error.
- [x] Run: `npx vitest run src/systems/entities3d/__tests__/planSchema.test.ts` → FAIL (module missing).
- [x] Implement `planSchema.ts` — hand-rolled walker (no zod dep): typed guards per field, collect errors, never throw. Unknown-key check via `Object.keys` allowlists per level.
- [x] Run the same command → PASS.

### Task 2: Compiler, fixtures, and the `planned` recipe kind

**Files:**
- Create: `src/systems/entities3d/textPlan/compilePlan.ts`, `src/systems/entities3d/textPlan/fixtures.ts`
- Modify: `src/systems/entities3d/types.ts` (three additions), `src/systems/entities3d/generateEntityBlueprint.ts`
- Test: `src/systems/entities3d/__tests__/compilePlan.test.ts`

**Interfaces:**
- Consumes: `CreaturePlan` (Task 1), existing `deriveFrame`, `Frame`, `Palette`, `PartInstance`.
- Produces:

```ts
// types.ts
export type Gait = 'biped' | 'quad' | 'hexapod' | 'hopper' | 'flyer' | 'float' | 'plan';
export interface PlanSpec {                       // compiled, driver-ready (meters, not feet)
  stance: CreaturePlan['frame']['stance'];
  bodyLenM: number; bodyRadM: number;
  spine: { segments: number; taper: number; arch: number };
  chains: Array<{
    id: string;                                   // stable: 'leg0L', 'tent2', 'neck1' …
    kind: PlanAppendage['kind'];
    side: -1 | 0 | 1;                             // mirrored pairs get L/R
    attach: number; heightFrac: number;
    links: Array<{ lenM: number; rM: number }>;
    phaseOffset: number;                          // legs: distributed stride phases; others 0
  }>;
  heads: Array<{ chainId?: string; sizeScale: number; eyes: { count: number; sizeScale: number }; snout?: { lengthScale: number; droop: number } }>;
}
// EntityBlueprint gains: planSpec?: PlanSpec;
// EntityRecipe gains: | { kind: 'planned'; plan: CreaturePlan; seed: string }

// compilePlan.ts
export function compilePlan(plan: CreaturePlan): Pick<EntityBlueprint, 'gait' | 'frame' | 'palette' | 'parts' | 'label' | 'planSpec'>;
// fixtures.ts
export const PLAN_FIXTURES: Record<'dragon' | 'threeHeadedSerpent' | 'tentacledOoze' | 'floatingEye', CreaturePlan>;
```

Compile rules: `gait: 'plan'`; frame from `deriveFrame('quad' /* closest base */, heightFt, bulk, 1)` then overridden — the driver reads `planSpec`, the frame exists for `heightM`/anchor scaffolding; feet→meters via the existing 0.3048 constant; leg chains get quad/hexa-style `phaseOffset` distribution (i / legCount alternating sides); mirrored pairs expand to two chains (`side ±1`); garnish → `PartInstance[]` as-is; `label = plan.name`.

- [x] **Failing tests:** every fixture validates (`validateCreaturePlan` returns `[]` — fixtures are the schema's living examples); `compilePlan(dragon)` → gait `'plan'`, planSpec chains include 4 legs (2 mirrored pairs) + 2 wings + 1 tail with correct link meter conversion (assert one exact value: `4 ft → 1.2192 m`); serpent → 0 legs, 3 neck chains, 3 heads bound to them; ooze → tentacle chains, stance horizontal; floating eye → stance floating, 0 appendages, 1 head with eyes.count 1; `generateEntityBlueprint({kind:'planned', plan: PLAN_FIXTURES.dragon, seed:'t'})` returns the compiled blueprint with `label 'Emberwing Dragon'` (fixture name).
- [x] Run: `npx vitest run src/systems/entities3d/__tests__/compilePlan.test.ts` → FAIL.
- [x] Implement fixtures (4 rich, hand-written plans — dragon: Huge horizontal, 2 leg pairs, 2 wings, long tail, 1 snouted head, horns garnish; serpent: serpentine 24ft length, 3 necks+heads; ooze: horizontal blob, 6 tentacles; floating eye: floating sphere, 1 big eye), then `compilePlan`, then the `types.ts` additions, then the `generateEntityBlueprint` branch:

```ts
if (recipe.kind === 'planned') {
  const compiled = compilePlan(recipe.plan);
  return { ...compiled, label: recipe.plan.name };
}
```

- [x] Run: `npx vitest run src/systems/entities3d` → prior suites still PASS (the union widened; no consumer breaks because all existing switches stay exhaustive over old kinds — fix any `never` fallout by handling `'plan'` where the compiler demands).

### Task 3: The plan gait driver

**Files:**
- Modify: `src/systems/entities3d/three/gaits.ts` (PlanDriver + factory signature), `src/systems/entities3d/three/assembleEntity.ts` (line 102 call site)
- Test: `src/systems/entities3d/__tests__/planDriver.test.ts`

**Interfaces:**
- Consumes: `PlanSpec` (Task 2), existing `SegmentSink`, `TreadmillLeg`, `solveKnee`, wag/wave math from `chainParts`, flap math from wings.
- Produces: `createGaitDriver(gait: Gait, frame: Frame, planSpec?: PlanSpec): GaitDriver` — `'plan'` without a spec THROWS (`plan gait needs a planSpec`). `assembleEntity` passes `blueprint.planSpec`.

Driver behavior (all existing `GaitDriver` members: `update/buildBody/pose/gaitPhase/flap/setPhase`):
- **Spine:** `spine.segments` tapered segments along the stance axis — upright: stacked vertically (pelvis→chest like biped torso); horizontal: level at leg height; serpentine: at ground contact, undulating laterally with the tentacle wave (`sin(phase*2π + i*0.9)`), no legs required; floating: hover at `bodyRadM*2 + bob` using the float driver's bob curve.
- **Legs:** each leg chain strides via `TreadmillLeg` at its `phaseOffset`; 2-link chains use `solveKnee`; >2 links distribute the bend angle evenly down the chain; feet emit `ball` sinks.
- **Arms:** swing `sin(phase*2π + π)` counter to the nearest-phase leg (or π offset from `gaitPhase` when no legs).
- **Tails/tentacles:** the wag/wave chain math (reuse the exact formulas from `chainParts.taperedChain` — droop + `sin(t*wagHz + linkIndex)`), attached at `attach`/`heightFrac` on the spine.
- **Wings:** existing flap curve drives chain pitch; `driver.flap` mirrors it (so wing garnish parts stay in sync).
- **Necks + heads:** neck chains arc up with a gentle `sin(t*0.8)` bob; every `planSpec.heads[i]` emits a head ball (+eyes handled by assembleEntity as today — eye COUNT/scale beyond the standard pair is Task 3 scope: PlanDriver exposes `headSockets(): Array<{x,y,z,r, eyes:{count,sizeScale}}>` and `assembleEntity` builds eye meshes per socket when `planSpec` present, replacing the standard two-eye block for planned entities only).
- **Anchors:** full standard set — `head` = first head socket; `handL/R` = first arm chain ends (else spine front); `footL/R` = first leg pair ends (else spine bottom); `tailRoot` = rearmost tail/tentacle attach (else spine rear); the rest (chest/pelvis/…) from spine fractions. Documented mapping in a comment table.

- [x] **Failing tests:** for each fixture (via `compilePlan`): driver builds, `buildBody(sink)` emits ≥ spine.segments + Σchain links segments, ALL coords finite, radii > 0; chain link connectivity (`link[i].a == link[i-1].b` within 1e-6); dragon legs ALTERNATE (footL/footR world z differ mid-stride at phase 0.25 while walking); serpent spine stays within 0.05m of ground height across phases; floating eye's spine min-y > 0.1m always; ids stable across two updates; anchors: all 15 present and finite for every fixture; `createGaitDriver('plan', frame)` without spec throws `/planSpec/`.
- [x] Run: `npx vitest run src/systems/entities3d/__tests__/planDriver.test.ts` → FAIL.
- [x] Implement PlanDriver in `gaits.ts` (same file as the six — it IS a gait); widen the factory; pass `planSpec` at `assembleEntity.ts:102`; add the per-socket eye build branch in assembleEntity.
- [x] Run: `npx vitest run src/systems/entities3d` → ALL suites PASS (including assemble/crowdBake regressions).
- [x] Typecheck: `npm run typecheck` — no NEW errors in touched files.

### Task 4: Devhub route + creature library store

**Files:**
- Create: `scripts/vite-plugins/devhub/creaturePlanRoutes.ts`, `src/data/creatures3d/plans/.gitkeep`
- Modify: `scripts/vite-plugins/devHubApiManager.ts` (2 lines, after the docs dispatch — LOCK first)
- Test: `scripts/vite-plugins/devhub/__tests__/creaturePlanRoutes.test.ts`

**Interfaces:**
- Consumes: `DevHubRouteContext` (`./routeContext`), `validateCreaturePlan` + `PLAN_LIMITS` (Task 1 — imported from `../../../src/systems/entities3d/textPlan/planSchema`), part ids via `registerAllParts()` + `allParts()`.
- Produces:

```ts
export interface CreatureLibraryEntry {
  id: string;            // 8-char hash of description+timestamp
  name: string; slug: string;
  description: string;   // the prompt text (or revise note chain)
  plan: CreaturePlan;
  status: 'generated' | 'approved';
  createdAt: string;     // ISO
  revisedFrom?: string;  // parent entry id
}
export type CliRunner = (prompt: string) => Promise<string>;   // injectable for tests
export function handleCreaturePlanRoutes(ctx: DevHubRouteContext, runner?: CliRunner): Promise<boolean>;
```

Routes (all under `urlPath`):
- `GET /devhub/api/creature-plans` → `{ entries: CreatureLibraryEntry[] }` (read dir, newest first).
- `POST /devhub/api/creature-plan` body `{ text }` → exact-text match in library? return it. Else prompt = schema JSON (from `PLAN_LIMITS` + the TS shapes inlined as a string constant) + authoring rules + text → `runner(prompt)` → parse (strip fences) → `validateCreaturePlan` → on errors, ONE retry with `Previous attempt failed validation:\n<errors>` appended → still invalid → `json({ errors }, 422)`. Valid → write `src/data/creatures3d/plans/<slug>.json`, return `{ entry }`.
- `POST /devhub/api/creature-plan` body `{ reviseId, note }` → load parent, prompt includes `Current plan:\n<json>\nRevision request: <note>` → same validate/retry → new entry with `revisedFrom`.
- `POST /devhub/api/creature-plan/approve` body `{ id }` → rewrite that file with `status: 'approved'`, return `{ entry }`.

Default runner: `execFile('claude', ['-p', prompt, '--model', 'claude-fable-5', '--output-format', 'json'], { timeout: 120000, maxBuffer: 4*1024*1024 })`, parse the CLI JSON envelope (`.result` field) then the plan JSON inside. Before implementing, run `claude --help` once: if an effort flag exists (`--effort`), append `--effort medium`; if not, omit (note which in a code comment). POST bodies read via the docsRoutes accumulator pattern (`req.on('data')`).

- [x] **Failing tests (fake runner, temp dir via `os.tmpdir()` override — export `setLibraryDirForTests(dir)`):** generate happy path (runner returns a fixture plan → entry written, status `generated`); exact-text re-ask returns the SAME entry without calling the runner (spy count 1); invalid-then-valid retry (runner returns junk once, fixture second → entry written, runner called twice, second prompt contains the error text); invalid twice → 422 with `errors`; approve flips status on disk; revise creates a linked entry (`revisedFrom` set, runner prompt contains the parent plan JSON); list returns newest-first; non-matching paths return `false`.
- [x] Run: `npx vitest run scripts/vite-plugins/devhub/__tests__/creaturePlanRoutes.test.ts` → FAIL.
- [x] Implement the module; then LOCK `scripts/vite-plugins/devHubApiManager.ts` (reserve on conflict) and add:

```ts
const { handleCreaturePlanRoutes } = await import('./devhub/creaturePlanRoutes.ts');
if (await handleCreaturePlanRoutes(ctx)) return;
```

- [x] Run route tests → PASS; `npx vitest run scripts/vite-plugins` → prior devhub suites still PASS.

### Task 5: Forge Describe + Library modes; debugger `?planId`

**Files:**
- Modify: `src/components/DesignPreview/steps/PreviewEntityForge.tsx` (LOCK), `src/components/DesignPreview/steps/PreviewEntityDebug.tsx`
- (EntityForgeScene unchanged — it already takes any `EntityRecipe`, and `'planned'` is now one.)

Forge additions — two new `Mode` values `'describe' | 'library'` in the existing mode-button row:
- **Describe:** textarea (4 rows, placeholder `A three-headed serpent with vestigial wings…`), **Imagine** button → `fetch('/devhub/api/creature-plan', {method:'POST', body: JSON.stringify({ text })})`; while pending show `Fable is designing…` in the status line; on `{entry}` set it active → yard shows `[{ recipe: { kind: 'planned', plan: entry.plan, seed: entry.id }, position: [0,0,0], walking } ]`; on `{errors}` render them as a red `<ul>` verbatim. A **Revise** textarea + button appears once a creature is active (`{reviseId: entry.id, note}`). Collapsible `<details><summary>plan JSON</summary><pre>…</pre></details>` under the panel. Deep link: `?step=entityforge&mode=describe&desc=<urlencoded>` auto-submits once on mount.
- **Library:** on-enter `fetch('/devhub/api/creature-plans')`; list rows: name, status chip (`generated` amber / `approved` green), created date, buttons **Load** (activate on yard), **Approve** (POST approve, refresh), **Revise** (prefills the Describe revise flow with this entry). Deep link `?mode=library&planId=<id>` preselects + loads.
- Debugger: in `PreviewEntityDebug.tsx`, when `q.get('planId')` is set, fetch the library list, find the entry, and use `{ kind: 'planned', plan, seed: planId }` as the recipe (mode selectors hidden in that case, title shows the creature name).

- [x] Wire the forge modes; `npx vitest run src/devtools/vistest src/systems/entities3d` still green; typecheck clean on touched files.
- [x] Wire the debugger `planId` branch.
- [x] **Eyeball (fixtures, no CLI):** temporarily seed the library by writing `PLAN_FIXTURES` entries via a scratch node script (`.agent/scratch/seed-creature-library.mjs` calling the route module's write helper), then shoot `design.html?step=entityforge&mode=library&planId=<dragon id>` with the shoot-page rig → dragon walks; repeat for serpent (3 heads visible) + floating eye. Fix look issues before proceeding (this is the real gate — heads distinct, legs alternate, tentacles wave).

### Task 6: Live end-to-end + closeout

- [x] Dev server up; in the forge Describe box (or `curl -X POST localhost:5174/devhub/api/creature-plan -d '{"text":"a squat six-legged basalt beetle with one glowing eye"}'`): live CLI round trip → creature on the yard; check the library file exists with status `generated`; Approve → status flips.
- [x] One revise round trip (`"make the legs twice as long"`) → linked entry, visibly longer legs.
- [x] Captures for Remy: forge Describe result + Library panel + debugger view of one generated creature (shoot-page rig / entity debugger readback).
- [x] Full suites: `npx vitest run src/systems/entities3d scripts/vite-plugins/devhub src/components/World3D src/components/BattleMap` → green; typecheck filtered to touched files.
- [x] Closeout: plan-map feature under `entity-generator-3d` → flip "Text-to-creature … (spec approved)" to done (reservation `aca8c806` should have granted the topics.json lock by then — check `client.mjs reservations`); memory update (`entity-generator-3d.md` + MEMORY.md hook line); Agora `say` + `unlock --mine`; vistest scenario for a library creature when `scenarios.ts` unlocks (follow-up if still held).

## Self-review

- **Spec coverage:** language+validation (T1), compile+planned kind+determinism (T2), driver incl. multi-head eyes/anchors/stances (T3), CLI bridge+library+revise+approve+caching (T4), forge/debugger UI+deep links (T5), live proof+captures (T6). Later slices (in-game, PixVerse, Meshy, plan editor, stat linkage) correctly absent. ✓
- **Placeholders:** none — every step names files, exact routes, exact assertions; the one open probe (`claude --help` effort flag) is a decision procedure with both outcomes specified. ✓
- **Type consistency:** `CreaturePlan`/`PLAN_LIMITS` (T1) → T2 fixtures/compiler → `PlanSpec` (T2) → T3 driver/factory → `CreatureLibraryEntry`/`CliRunner` (T4) → T5 fetch shapes. Factory signature `createGaitDriver(gait, frame, planSpec?)` used at the single call site. ✓

## Execution notes (2026-07-16)

- Live CLI gotchas (all fixed in creaturePlanRoutes.ts): (1) prompt must go via STDIN — as an argv with the Windows .cmd shim (shell:true), newlines mangle the command line; (2) neutral cwd (tmpdir) — from the repo the CLI loads this project's CLAUDE.md and follows Remy's rules instead of emitting JSON; (3) strip CLAUDE*/MCP_ env vars — a dev server running inside a Claude session splices the child CLI into the parent conversation; (4) devhub modules are bundled into the vite config at startup — edits need a config-graph touch (devHubApiManager.ts) to hot-restart.
- Added beyond plan (Remy request): contact-sheet review tooling — window.__entitydebug.contactSheet() renders ¾/front/side(+6ft ghost)/top/face/silhouette auto-framed from the live bounding box into one PNG; capture script .agent/scratch/shoot-contact-sheet.mjs. Harsh-critique iterations landed: auto S-necks, head-bearing neck thickening, mound bodies with embedded heads, tentacle crown fanning, serpentine wave from body length, toe segments, part scale params (wingsMembrane, hornsCurved).
- Live E2E proof: "a squat six-legged basalt beetle with one glowing eye" → Basalt Ember Beetle (3 leg pairs, black, one orange eye); revise "legs twice as long, eye bigger" → legs exactly 0.9/0.8→1.8/1.6 ft, eye 1.8→2 (schema cap respected); approve flipped on disk. Library: src/data/creatures3d/plans/.

## Parts wave v1.1 (2026-07-16, Remy: "parts wave now")

Driven by the Lovecraftian stress test (library lineage 214b68cf → 5987d7d0 → 104c4981):
- Language: `PlanAppendage.tips?: 'hand'` (stylized palm + 3 fingers at non-leg tips), `jointRings?: boolean` (accent energy rings hovering at interior joints), `PlanHead.cilia?: boolean` (twitching lash ring around eyes). Validator + prompt updated.
- Renderer: `SegmentSink.ring()` (optional) + TorusGeometry support in segmentBody — unlit accent material (glow read), no ink shell; wireframe = accent edge lines. `SegmentBodyOptions.accentHex`.
- Driver: hand/ring/cilia emissions; arm sibling fanning (starburst, not broom-bundles); floating arms level, not dangling.
- New part: `crystalSpikes` (jagged accent shards, params scale/jaggedness/count).
- 143 tests green (entities3d + devhub). Proof sheets: .agent/vistest/sheet-horror*.png (v1 dangle → v4 ringed starburst).
