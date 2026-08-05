# Hero-Look Pipeline + Accepted Entities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Approved library creatures gain sculpted hero looks through a staged pipeline (plan → reference image → TRELLIS → budget-gated optimization → library display), and become a first-class runtime source the game loads without ever regenerating.

**Architecture:** Five stage tools with durable artifacts under `src/data/creatures3d/hero/<entryId>/` (`reference.png`, `master.glb`, `hero.glb`, `hero.json`), gated by a pure hero store; a bundled `acceptedEntities` module exposes approved entries to game surfaces (combat name-lookup first). Display rides the existing forge/debugger.

**Tech Stack:** TypeScript, three ^0.172 (GLTFLoader), `@gradio/client` (TRELLIS Space), `@gltf-transform/core`+`functions` (optimize), vitest 4, Claude-driven Chrome for Gemini Images.

**Spec:** `docs/superpowers/specs/2026-07-16-hero-look-pipeline-design.md`

## Global Constraints

- No git commits/branches/worktrees; tasks end at tests green. Agora lock `src/systems/entities3d/**` + forge/debugger steps under `fable-entitygen` (daemon currently down — no locks possible; keep edits inside these paths).
- Subagents: Fable 5 only (fleet rule: NO SonNET); parallel subagents touch DISJOINT files (shared tree, no worktrees).
- No fallbacks: every stage produces its artifact or fails with a named error; downstream stages refuse on missing upstream artifacts.
- Budget single-source: move the 30k fixture budget into `src/systems/entities3d/textPlan/budgets.ts` (`PLAN_TRIANGLE_BUDGET = 30_000`, `HUMANOID_TRIANGLE_BUDGET = 12_000`); perfBudget.test.ts imports it; optimize tool imports it.
- New deps (root): `@gradio/client`, `@gltf-transform/core`, `@gltf-transform/functions` (devDependencies; tools + tests only — no game-bundle imports).
- ASD-STE100 Simplified Technical English, US spelling.

## File Structure

```
src/systems/entities3d/
  textPlan/heroImagePrompt.ts        — pure prompt builder (T1)
  textPlan/budgets.ts                — shared triangle budgets (T3)
  library/heroStore.ts               — hero folder paths, hero.json io, stage gating (T2, node-safe pure-ish)
  library/acceptedEntities.ts        — approved-only runtime source (T5)
  recipeFromCombatant.ts             — accepted-name lookup first (T5)
  __tests__/heroImagePrompt.test.ts / heroStore.test.ts / acceptedEntities.test.ts / perfBudget.test.ts (budget import)
tools/creatureHero/
  collect-reference.mjs              — newest Gemini download → hero folder (T4)
  convert.mjs                        — TRELLIS Space via @gradio/client → master.glb (T4)
  optimize.mjs                       — gltf-transform weld/dedupe/prune/simplify/resize → hero.glb, budget-gated (T3)
src/components/DesignPreview/steps/
  PreviewEntityForge.tsx             — Hero chip + hero toggle (T6)
  PreviewEntityDebug.tsx / EntityDebugScene.tsx — ?hero=1 GLB mount (T6)
src/data/creatures3d/hero/           — artifacts (gitkeep)
```

---

### Task 1 (SUBAGENT A, disjoint): heroImagePrompt

**Files:** Create `src/systems/entities3d/textPlan/heroImagePrompt.ts`, `src/systems/entities3d/__tests__/heroImagePrompt.test.ts`

**Produces:** `export function heroImagePrompt(plan: CreaturePlan): string`

Content rules (each asserted by a test): starts with "Full body 3D character concept"; contains "neutral standing pose", "solid neutral gray background", "clean silhouette", "no pedestal", "single creature"; palette hexes rendered as `deep red (#8c3b2e)`-style pairs using a small hex→name mapper (12 hue buckets × light/dark, deterministic); mentions height in feet, stance word (standing/four-legged/serpentine/floating from stance), appendage summary ("four legs, two membrane wings, one long tail" — counts by kind from the plan), head form word when present; ends with "stylized game sculpt, hand-painted look, high detail".

- [x] Failing tests (≥8 assertions incl. dragon fixture snapshot-ish contains-checks), run → FAIL, implement, run → PASS (`npx vitest run src/systems/entities3d/__tests__/heroImagePrompt.test.ts`).

### Task 2 (SUBAGENT B, disjoint): heroStore

**Files:** Create `src/systems/entities3d/library/heroStore.ts`, `src/systems/entities3d/__tests__/heroStore.test.ts`

**Produces:**
```ts
export interface HeroRecord {
  entryId: string;
  prompt?: string;
  stages: Partial<Record<'reference' | 'master' | 'hero', { at: string; note?: string }>>;
  triangles?: { master: number; hero: number };
  status: 'generated' | 'approved';
}
export function heroDir(baseDir: string, entryId: string): string;              // <base>/<entryId>
export function readHero(baseDir: string, entryId: string): HeroRecord | null; // null = no hero yet
export function writeHero(baseDir: string, record: HeroRecord): void;          // mkdir -p + hero.json
export function assertStage(baseDir: string, entryId: string, needs: 'reference' | 'master'): void;
// assertStage throws `stage "<needs>" artifact missing for <entryId> — run the earlier stage first`
// checking BOTH hero.json stage entry AND the file on disk (reference.png / master.glb).
```
Node `fs` allowed (tools + tests only import this; game code never does).

- [x] Failing tests in a tmpdir (round-trip, null on missing, assertStage both-checks, mkdir), FAIL → implement → PASS.

### Task 3 (ME): budgets + optimize tool

**Files:** Create `src/systems/entities3d/textPlan/budgets.ts`, `tools/creatureHero/optimize.mjs`; Modify `src/systems/entities3d/__tests__/perfBudget.test.ts` (import budgets); deps install.

- [x] `npm i -D @gradio/client @gltf-transform/core @gltf-transform/functions` (root; verify install clean).
- [x] budgets.ts + perfBudget import swap; suite PASS.
- [x] `optimize.mjs <entryId> [--base src/data/creatures3d/hero]`: assertStage master → read master.glb via @gltf-transform NodeIO → `weld() → dedup() → prune() → simplify({ratio stepped 1→0.1 until ≤ PLAN_TRIANGLE_BUDGET}) → textureCompress? no: textureResize({size:[1024,1024]})` → write hero.glb; update hero.json stages.hero + triangles. Over budget at min ratio → exit 1 `optimization cannot reach 30000 triangles (best: N)`.
- [x] Verify on a checked-in tiny fixture GLB (`tools/creatureHero/__fixtures__/box.glb`, generated once by a script using NodeIO — commit-free tree, just written to disk) → hero.glb written, counts recorded; missing master → named error.

### Task 4 (ME): collect-reference + convert tools

**Files:** Create `tools/creatureHero/collect-reference.mjs`, `tools/creatureHero/convert.mjs`

- [x] `collect-reference.mjs <entryId>`: newest `Gemini_Generated_Image_*.png` in `C:\Users\Gambit\Downloads` (mtime, must be < 15 min old — stale downloads rejected loudly) → copy to hero folder as reference.png; stamp hero.json (create record if absent, embed prompt when passed via `--prompt-file`).
- [x] `convert.mjs <entryId>`: assertStage reference → `Client.connect("trellis-community/TRELLIS")` (@gradio/client) → follow the Space's documented api: preprocess/generate then extract GLB (introspect `client.view_api()` on first run and pin endpoint names in the script; log every step) → download → master.glb; stamp hero.json. Any missing endpoint/queue error/timeout (300s) → exit 1 with the Space's message.
- [x] Smoke: run convert against a locally saved test image for an entry; artifact + stamps verified (live Space — acceptable manual-run verification; NOT in vitest).

### Task 5 (SUBAGENT C, disjoint): acceptedEntities + combat wiring

**Files:** Create `src/systems/entities3d/library/acceptedEntities.ts`, `src/systems/entities3d/__tests__/acceptedEntities.test.ts`; Modify `src/systems/entities3d/recipeFromCombatant.ts` (+ its test file)

**Produces:**
```ts
export interface AcceptedEntity { id: string; name: string; plan: CreaturePlan; sizeCategory?: string; heroGlb?: string }
export function approvedEntries(): AcceptedEntity[];                 // import.meta.glob('/src/data/creatures3d/plans/*.json', {eager:true}), status==='approved' only
export function acceptedById(id: string): AcceptedEntity | null;
export function acceptedByName(name: string): AcceptedEntity | null; // trim + case-insensitive exact
export function recipeForAccepted(e: AcceptedEntity): EntityRecipe;  // {kind:'planned', plan, seed: e.id}
```
`recipeFromCombatant`: BEFORE the existing monster path, `const hit = acceptedByName(c.name); if (hit) return recipeForAccepted(hit);` (PCs/humanoid branch untouched — accepted lookup only for the non-PC monster branch). Tests: vitest can't do import.meta.glob over real dir? It CAN (vite-node) — glob resolves real approved files; test seeds a temp approved fixture? Simpler: module accepts injectable entries for tests via `__setEntriesForTests(entries|null)`; production path uses the glob. Test: approved-only filtering, name lookup trim/case, combatant named exactly like an approved entry gets kind 'planned', unknown name keeps legacy path.

- [x] Failing tests → implement → `npx vitest run src/systems/entities3d` all green.

### Task 6 (ME): hero display

**Files:** Modify `PreviewEntityForge.tsx` (Hero chip; hero state passthrough), `PreviewEntityDebug.tsx` (`?hero=1` param + toggle when entry has hero), `EntityDebugScene.tsx` (mount `hero.glb` via GLTFLoader inside the entity slot when hero mode: hide `handle.group`, show loaded scene, same yard/turntable; contactSheet frames via Box3 of whichever is visible — adjust its `setFromObject` root to the debug rig root).

- [x] Library list marks entries having `src/data/creatures3d/hero/<id>/hero.glb` (dev route lists them: extend `GET /devhub/api/creature-plans` to stat hero.glb → `heroGlb: '/src/…'`? Game-safe path: serve via vite `/src/data/...` works in dev; entries store `heroGlb` relative path in the route response only — the on-disk entry JSON gains heroGlb only at APPROVE time of the hero (slice-1: route stamps it when hero.json exists on list).
- [x] Eyeball via debugger once a hero.glb exists (Task 7).

### Task 7 (ME): dragon end-to-end + closeout

- [x] Stage 1: `heroImagePrompt(dragon fixture plan)` → I drive gemini.google.com/images in Remy's Chrome (extension) with it → download → `collect-reference.mjs fix00000`.
- [x] Stage 2: CLOSED WITHOUT RUNNING — Remy dropped the TRELLIS shot 2026-07-23 ("nevermind") after the free path died (three quota blocks incl. post-reset 15:46, even /preprocess_image rejected at "0s left"; the account's ZeroGPU pool reads zero at every window). The code-sculpt route (img2threejs factory) IS this pipeline's image→3D stage now; convert.py/convert.mjs stay as archival tools. Paid-route survey (fal ~$0.30/gen, HF PRO 8x, GCP+DINOv3) recorded in the hero-code-sculpt-route memory if ever wanted.
- [x] Stage 3: `optimize.mjs fix00000` — RAN for real on the code-sculpt master (39,092 tris -> hero.glb 29,517 tris, ratio 0.75, budget 30,000). TRELLIS candidate will get the same pass when its master lands.
- [x] Stage 4: debugger sheet + comparison — hero.glb mounted via ?hero=1 on the live server; sheet at `.agent/vistest/hero-dragon.png`; harsh critique vs procedural + reference delivered 2026-07-23.
- [x] Full suites `npx vitest run src/systems/entities3d scripts/vite-plugins/devhub`; typecheck filtered.
- [x] Closeout: plan-map (hero-look → active→done when built; accepted-entities feature added), memory (entity-generator-3d addendum), Agora say/unlock when daemon returns; harsh critique of the hero dragon vs Behance.

## Self-review

- Spec coverage: stages 1a/1b (T1,T4), 2 (T4), 3 (T3), display (T6), accepted runtime + combat (T5), artifacts/gating (T2), dragon target + review gates (T7). ✓
- Placeholders: TRELLIS endpoint names resolved by documented `view_api()` introspection step — a decision procedure, not a TBD. ✓
- Type consistency: HeroRecord/AcceptedEntity/heroImagePrompt names used consistently across T2/T3/T4/T5/T6. ✓
- Parallelism: T1/T2/T5 disjoint file sets → three Fable 5 subagents; T3/T4/T6/T7 sequential (deps, external services, visual gates) → me. ✓

## Execution notes (2026-07-22)

- Subagent wave (3× Fable 5, disjoint files): heroImagePrompt 17 tests, heroStore 13 tests, acceptedEntities+combat 20 tests — all green first integration run (226 total with devhub).
- Reference stage LIVE-PROVEN: heroImagePrompt(dragon) → Gemini Images (Remy's Chrome, Nano Banana 2) produced a superb on-brief dragon reference → collect-reference filed it (public/creatures3d/hero/fix00000/reference.png + hero.json).
- Garnish gap found+fixed during E2E: wings/horns live in garnish, not appendages — prompt builder now emits garnish phrases (contract test flipped).
- TRELLIS Space API (introspected): /start_session → /preprocess_image(image) → /generate_and_extract_glb(image, seed, mesh_simplify, texture_size) — ONE combined endpoint; @gradio/client keeps its socket open (explicit process.exit needed).
- ZeroGPU quota: per-USER daily pool shared across ALL ZeroGPU Spaces; anonymous AND the matrix HF_TOKEN account both exhausted today. convert.mjs reads HF_TOKEN from env automatically.
- Hero artifacts moved to public/creatures3d/hero/ (vite serves public/; src/data isn't URL-fetchable).
- 18:37 retry (convert.py, HF_TOKEN forwarded, token: yes): start_session + preprocess_image succeeded; /image_to_3d rejected — "You have exceeded your ZeroGPU quota (120s requested vs. 0s left). Try again in 0:00:00. Authenticate with a Hugging Face token for more quota". Pool still empty before the ~2026-07-23 15:45 reset. One attempt only, then stopped (no pool burn). Note: the message still shows the "authenticate for more quota" hint even with the token sent.

## Execution notes (2026-07-23, code-sculpt route)

- 02:54 retry also quota-blocked (same message). Remy redirected: "find other ways to use compute for TRELLIS 2" -> pointed at img2threejs (hoainho, MIT) — an agent skill that rebuilds a reference image as a code-only three.js factory with staged gates and agent-vision review. Compute = agent vision + codegen, no GPU.
- Route survey first: fal.ai hosts TRELLIS 2 officially ($0.25-0.35/gen); HF PRO = 8x ZeroGPU pool; no free non-ZeroGPU mirror exists; local needs 16-24 GB VRAM (box has 8 GB). All paid routes need a Remy billing action; the code-sculpt route needs none.
- Skill vendored to `.agent/scratch/img2threejs` (gitignored). Full pipeline run in `.agent/scratch/hero-code/`: assessment + 14-detail inventory + 26-component spec (strict-quality PASS, PBR evidence extracted for all 7 materials) -> 8 gated passes (blockout, structural, form, material, surface, lighting, interaction, optimization), each with render + comparison sheet + scored review in the spec's reviewHistory. First blockout attempt (generic scaffold) scored 0.05 and was refine-coded into a hand-authored factory (`hero-code/src/createEmberwingDragonModel.ts` + `emberwingTextures.ts`): lofted hull, spar-frame wings with scalloped veined membranes, armor systems, canvas-painted albedo/roughness/stroke-derived normal maps.
- Export -> GLTFExporter binary -> `optimize.mjs --base` -> hero.glb 29,517 tris (budget 30,000). Candidate staged at `public/creatures3d/hero/fix00000/hero.glb` (+ hero.json stamped); `master.glb` slot reserved for the TRELLIS candidate (timer fires 15:46). Debugger sheet `.agent/vistest/hero-dragon.png` shot via ?hero=1 on the live :3000 server.
- Agora daemon still down at both 02:38 and 05:2x checks — no locks/say possible either session.
- Kimi assist (Remy: "ask Kimi v3 to help"): Kimi Code CLI 0.27.0 found at `~/.kimi-code` (default model kimi-code/k3). K3's engine 429'd through 3 spaced retries; the `kimi-for-coding` fallback executed a 5-task polish brief in the sandbox (arc-length/circumference UVs for even texel density, canon-red zone stops, two-tone blade+fin vertex colors, split-quadratic scallops, membrane transmission). Fix-forward pass corrected its tiling artifacts (removed spine/belly accent lines that repeated as dashed stripes, transmission 0.25->0.12, scallop depth eased). Result: master 39,716 -> hero.glb 29,985 tris; restaged + re-sheeted. CLI gotchas: `-p` prompt mode rejects both `--yolo` and `--auto`; plain `-p` edits workspace files fine. Also: optimize.mjs now registers ALL gltf-transform extensions so clearcoat/transmission/texture-transform survive.
- v3 (parallel session, 2026-07-23 afternoon): 360-critique fix pass on top of the Kimi round — barrel chest, contact-shade AO bake, de-pedestaled blades, shingled belly plates, swept jaw, orange wing leading edge, membrane root fix, lip-line teeth. master 29,476 -> hero.glb 29,032 tris at simplify ratio 1 (near-lossless). Staged live; v3 GLBs backed up in heropipe as {master,hero}-codesculpt-v3.glb. Details in the hero-code-sculpt-route memory.
- 15:46 TRELLIS timer FIRED and was quota-blocked (third block, message above); it never wrote, so the staged v3 master.glb is untouched. Free ZeroGPU path closed for good on this account.
