# Handover — World-quality / Combat / Maritime campaigns (2026-07-06)

You are taking over an autonomous build campaign on **Aralia** (a browser-based
D&D-like RPG with a procedurally generated 3D world). The prior orchestrator
(Claude Fable 5) ran several parallel waves via the Agora multi-agent flow. This
document is your full briefing: current state, the files that matter, and the
open decisions to make. Read it top to bottom before acting.

---

## 0. Ground rules (non-negotiable — these are the owner's standing directives)

- **Work ONLY in `master`. NEVER create a git branch or worktree.** The user
  (Remy) hates them. The repo auto-commits to GitHub at 2am daily — **do NOT
  commit or suggest committing**; leave work in the tree.
- **No fallback / graceful-degradation systems.** Build ONE real path and fail
  honestly. When a real alternative genuinely exists (e.g. WebGPU→WebGL), the
  failure must be an **active error with a one-click user choice** ("Use WebGL
  instead"), never a silent auto-fallback. Backend-capable scenes must wear an
  on-screen badge showing the genuine active backend.
- **Visual proof is mandatory.** Render and eyeball every visual/generation
  slice; numeric tests alone are not proof. `preview_screenshot` HANGS on R3F —
  use the headless Playwright shoot rigs in `.agent/scratch/` and
  `.agent/3d-visual-quality/` (camera hooks `window.__wf3dSetPose`, `__bm3dCam`,
  `__fipTestFight`). Save throwaway PNGs to `.agent/scratch/` (gitignored). Be
  critical of your own shots.
- **No time estimates, no feasibility-shrinking.** Give the full vision and a
  priority order; do what you can.
- **Plain language for the user.** Front-load the answer; one idea per sentence;
  concrete (name/number/date); no jargon or code identifiers in decision-facing
  summaries. US English. End direction-seeking turns with the AskUserQuestion
  tool, not raw-text questions.
- **Model routing:** NO SONNET ever (owner: "bad and expensive"). Visual/UI/3D
  and investigation work → Fable 5 low; heavy systems → Opus. **CAVEAT (as of
  2026-07-05): the Fable 5 monthly spend limit was hit — Fable subagents die
  instantly with a spend-limit message. Route everything to Opus until Remy
  raises the limit; re-check whether it reset before assuming.**

---

## 1. Use the Agora flow (multi-session coordination — REQUIRED)

**This is a shared checkout with a LIVE multi-session fleet.** As of this
handover ~11 agents from other chats were online (a `codex-governance`
orchestrator, an `agent-16d417` 2D-UI-playtest fleet, a `catalog-expand` agent,
a `codex-stitch-cleanup` agent). Agents clobber each other without coordination.

**Daemon:** `http://localhost:4319`. If down, `npm run agora` (background).
Skill: `agora-coordination`. Full guides: `tools/agora/ORCHESTRATOR.md`,
`tools/agora/AGENT.md`, `tools/agora/PROTOCOL.md`, `tools/agora/PLANNING-STACK.md`.

**The flow you MUST follow:**
1. Register with a UNIQUE identity: `export AGORA_AGENT_ID=<your-handle>` then
   `node tools/agora/client.mjs register <your-handle> --note "<scope>"`.
   (Shared identity = `unlock --mine` frees other agents' locks — a real bug that
   bit us. Always scope your identity.)
2. **Before editing any file, LOCK it** via the client; a `409` is a hard stop —
   back off and coordinate. Release promptly when done (`unlock <path>`).
3. **`public/planmap/topics.json` is a HOT contended file** (multiple sessions +
   a codex swarm rework it). Lock it, read FRESH, make a minimal edit, release
   fast. If you get a 409, skip it and note so.
4. Announce non-trivial work with `client.mjs say --to all "..."`; poll
   `client.mjs inbox --since <seq>` for replies.
5. If dispatching your own subagents, give EACH a unique `AGORA_AGENT_ID` and the
   same lock-before-edit contract. Partition packets so no two concurrent agents
   edit the same file (the one hard rule).

---

## 2. The plan-map (roadmap — keep it updated)

Tech-tree roadmap of topics + typed dependency edges, NO dates. Data:
`public/planmap/topics.json`. Viewer: `public/planmap/index.html` (served on any
dev server at `/Aralia/planmap/index.html`; dedicated `planmap` launch config on
port 5183). **Data-model decisions are recorded in**
`docs/superpowers/2026-07-05-planmap-data-model-decisions.md`:
- **Edges are `hard` (solid, gate the ▶READY highlight) vs `chosen` (dashed,
  strategic ordering, don't block readiness), each with a MANDATORY `why`.**
- **Distances are feet-native** — feet is the number in the data; the 5-ft tile
  is a derived referee/render convenience, never the stored unit.

**Keeping it updated:** run `node tools/agora/planmap-reconcile.mjs` (dry-run)
then `--apply`; it promotes topic/feature statuses from done Agora tasks +
feature rollups. **GOTCHA:** a broad campaign topic with a single done feature
FALSE-ROLLS to "done" — add a `parked` follow-up feature so it honestly stays
active (done for `perf-campaign`). Validate with
`node tools/agora/validate-planmap.mjs`. Standing rule: the moment a "we're
building X" decision is made, append it to `topics.json` as a node **in the same
turn** (alpha-signal capture).

**Standing validation items (owned by OTHER sessions — flag, don't fix):**
`building-generator` has `open:0` but its spec lacks a `## Open` section; the
fight-in-place shared design doc trips an advisory drift for the still-parked
`world-reactions` / `ambush-generation` topics (benign — the header honestly
says slices 3–5 remain).

---

## 3. What shipped in the prior waves (all in the tree, uncommitted, tested)

**Beautification wave — `world-props` topic = DONE.** The streamed 3D world went
from a blue-flooded plain to a lived-in landscape: 105-prop catalog placing
through 6 context signals (tavern/wealthy/gate/ruin/riverbank/defile), owned
seeded generators (rocks/logs/bushes + 13 town props: wells/carts/gravestones/
braziers/anvils…), procedural trees (3 biome species) + instanced grass, sun +
soft shadows (near + far cascade) + sky + fog, wind sway, density tuned
130k→4.4k/window, naturalized riverbanks, and the coastal blue-flood terrain bug
fixed at the region layer. Nameplates clamped (screen-space, near-hide, declutter).

**Combat-map FPS lift — `perf-campaign` (1/2 features done).** Draw calls
4295→525 (−88%) by instancing the per-tile visibility masks (4 shade classes);
shadow map 4096→2048 (A/B-identical). CPU render time ~29× lower. The deferred
phase-2 (character-mesh instancing + contact-shadow demand-invalidate) is a
`parked` feature.

**Fight-in-place combat — `fip-slice1` topic (slices 1–2 done).** Combat now
happens INSIDE the streamed world. Slice 1: the invisible 5-ft-tile referee grid
is derived from the terrain at the player's spot; placed props imprint as
cover/blocks-sight/blocks-move; a pure context-picker routes live-world→in-place
vs placeless→arena; dev entry `window.__fipTestFight()` / `?fipfight`. Slice 2
("kill the teleport"): the fight renders in the town — tokens on real ground,
active-turn ring, soft reachable-area disc (gridless, BG3-style), click-to-move
raycast validated by the referee, full combat HUD over the 3D scene, and the 2D
board stays available and correct.

**Maritime sea-encounters — `maritime-remainder` (active).** Ship voyages now
roll per-day-at-sea encounters (seeded, danger-scaled): pirates/sea-beast route
to the tactical arena via the same machinery land ambushes use; wreck-salvage/
merchant/squall resolve as narrative + adventure-log. No new subsystems.

**Early-game playability — `early-game-playable` = DONE (18/18).** Watch-reaction
(attack the town watch → wanted + disposition drop + guards confront), post-
combat conversation no longer replays the pre-fight line, Ollama modal reworded
to the truth (no fake fallback dialogue), peaceful-opening verified.

**WebGPU migration — `webgpu-migration` (active, 3/5).** See §4 — this is the
biggest open thread.

**HUD dev disclosure.** The "3D World View" title is now a Controls-style
dropdown (dev mode only) hosting the DebugHUD readout; `npm run dev` starts with
dev mode ON (`import.meta.env.DEV` in `src/state/initialState.ts`).

---

## 4. OPEN DECISIONS — the choices offered to Remy (give your opinion, then ask)

These are genuinely undecided. For each, the prior orchestrator's leaning is
noted. **Form these into an AskUserQuestion for Remy — but first tell him YOUR
recommendation with reasoning.**

**A. WebGPU — what's left and whether to continue before the eyeball.**
   The whole WebGPU path is unverified on real hardware — everything ran on the
   headless software renderer or the fail-fast error pane (headless Chrome has no
   WebGPU adapter). Remaining:
   - **BLOCKED ON REMY'S REAL-GPU EYEBALL (RTX 2070S):** the probe at
     `?phase=webgpuprobe` and the battle map at `?gpu=1` — both should show a
     green "WebGPU" badge + correct rendering, or a truthful red MISSING list.
   - **Not built (honest MISSING list):** real-time shadows on node materials
     (a genuine three.js 0.170 limitation — baked `colorNode` has no `LightsNode`
     to consume a shadow map; needs upstream fix or a different lighting
     approach), the animated CharacterActor rig + nameplates (tokens ship
     instead), GPU grass wind sway, the smaller 3D preview modals.
   - **Final step (parked):** default flip + WebGL retirement — a one-line change
     in `webgpuBattleMapFlag.ts`, gated on the eyeball passing.
   - *Prior leaning:* HOLD further WebGPU agent work until Remy's eyeball
     confirms the foundation renders correctly — building shadows/actors on an
     unverified base is risky.

**B. Next big combat thread — fight-in-place slice 3+.**
   Slices remaining (each has a subspec in `docs/superpowers/specs/subspecs/`):
   in-scene ability/attack **targeting** (AoE decals, target picking — currently
   abilities resolve via the 2D-board toggle), tactical-orbit **camera**
   (`fip--combat-camera.md`, currently frame-on-start only), **edge = escape**
   (`fip--edge-escape.md`), **full-freedom initiation** (`fip--full-freedom-
   initiation.md`). *Prior leaning:* in-scene targeting is the highest-value next
   rung — it's the last thing forcing the 2D-board toggle mid-fight.

**C. Combat-map perf phase 2 — do it or defer?**
   Character models are ~40 meshes each (~80 draw calls with shadows — the bulk
   of the remaining 525); contact shadows re-render every frame. *Prior leaning:*
   defer unless combat still feels slow after the FPS lift lands on real hardware
   — it's riskier (silhouette-tuned actors) for a smaller win.

**D. Maritime — Plans 4–6 + tuning, or park?**
   Remaining: an in-browser voyage playthrough capture, dock tiers/tender legs
   (4), ferry fares (5), weather+piracy depth (6), and an encounter-odds tuning
   pass against real voyage lengths. *Prior leaning:* lower priority than combat/
   WebGPU; do the odds-tuning + one live playthrough, park 4–6.

**E. Which big unstarted topic comes next (world track)?**
   Candidates on the map: `building-generator` (blueprint pipeline → enterable
   buildings, another session is speccing it), `wf-interiors` (L4),
   `neighbour-streaming` (dynamic world streaming while playing),
   `character-aging`. *Prior leaning:* none strong — depends on whether Remy
   wants to push combat depth (B) or world depth (E) next.

---

## 5. Relevant files (by area)

**Agora / plan-map / orchestration:**
- `tools/agora/{ORCHESTRATOR.md, AGENT.md, PROTOCOL.md, PLANNING-STACK.md}`
- `tools/agora/{client.mjs, orchestrate.mjs, validate-planmap.mjs, planmap-reconcile.mjs, planmap-to-wave.mjs, planmap-add.mjs, agents.json}`
- `public/planmap/{topics.json, index.html, topics.schema.json}`
- `.claude/skills/agora-coordination/SKILL.md`
- `docs/superpowers/2026-07-05-planmap-data-model-decisions.md`

**Fight-in-place combat:**
- Spec: `docs/superpowers/specs/2026-07-02-fight-in-place-combat-design.md`
- Subspecs: `docs/superpowers/specs/subspecs/fip--{combat-surface-picker, referee-patch-sizing, ground-picking, turn-hud, combat-camera, edge-escape, full-freedom-initiation}.md`
- Code: `src/systems/combat/fightInPlace/{combatSurfacePicker.ts, inSceneMovement.ts, fightInPlaceHandoff.ts}`, `src/components/World3D/combat/InPlaceCombatLayer.tsx`, `src/components/Combat/InPlaceCombatScene.tsx`, `src/components/Combat/CombatView.tsx`, `src/components/World3D/World3DWrapper.tsx`, `src/systems/worldforge/bridge/groundChunkLoader.ts` (`extractLocalTerrainPatch`)

**Beautification / props / vegetation / lighting:**
- Spec: `docs/superpowers/specs/2026-07-02-world-beautification-wave.md` + `subspecs/beautification--*.md`
- Code: `src/systems/worldforge/props/` (catalog.ts, placementEngine.ts, generators/), `src/systems/worldforge/vegetation/`, `src/components/World3D/vegetation/`, `src/components/World3D/{GroundProps.tsx, World3DLighting.tsx, InWorldHUD.tsx}`, `src/systems/worldforge/bridge/{groundChunkLoader.ts, groundProps.ts}`

**WebGPU:**
- `src/components/World3D/{WebGPUProbe.tsx, WebGPUProbeScene.tsx}`
- `src/components/BattleMap/{BattleMap3D.tsx, BattleMap3DGpuScene.tsx, webgpuBattleMapFlag.ts}`, `src/components/BattleMap/gpu/{terrainColorNode.ts, gridOverlayNodes.ts}`
- Research: `docs/superpowers/research/2026-07-04-webgpu-probe-report.md`, `docs/superpowers/research/webgpu-validation/`

**Combat-map perf:**
- `src/components/BattleMap/vfx/VFXSystem.tsx`, `src/components/BattleMap/camera/CameraController.tsx`

**Maritime:**
- `src/systems/naval/seaEncounter.ts`, `src/hooks/useSeaEncounter.ts`, `src/state/reducers/navalReducer.ts`, `src/systems/worldforge/travel/shipEmbark.ts`
- Plan: `docs/superpowers/plans/2026-06-30-maritime-travel-status.md`

**Early-game:**
- `src/systems/social/watchReaction.ts`, `src/state/appState.ts`, `src/hooks/actions/handleNpcInteraction.ts`, `src/components/ui/OllamaDependencyModal.tsx`, `src/systems/gameEntry/generateOpeningSituation.ts`
- Spec: `docs/superpowers/specs/2026-07-04-early-game-playability-campaign.md`

**Persistent memory (READ FIRST):**
`C:\Users\Gambit\.claude\projects\F--Repos-Aralia\memory\MEMORY.md` (index) — key
entries: `beautification-wave-build-status`, `aralia-plan-map`,
`fleet-model-assignments`, `remy-no-fallback-directive`,
`fight-in-place-combat-design`, `agora-orchestrator-upgrade`,
`aralia-architecture-patterns`.

---

## 6. Verification quickref

- Dev server: crash-guarded launch configs; app base is `/Aralia/`. Ground world:
  `?phase=world3d&ground=1`. Probe: `?phase=webgpuprobe`. Test fight in world:
  `?fipfight`. WebGPU battle map: any 3D battle map + `&gpu=1`.
- Tests: `npx vitest run <path>`. Repo has a large PRE-EXISTING tsc error
  baseline (~590) in unrelated files — judge by DELTA on touched files, not zero.
  `tsc` bin may be missing — call `node node_modules/typescript/lib/tsc.js`.
- Ollama (local LLM for Oracle/dialogue) runs on `localhost:11434`.

---

## 7. Suggested first moves

1. Read `MEMORY.md` + this doc. Register on Agora with a unique handle.
2. Run the plan-map reconcile + validate to confirm current state.
3. Form the §4 open decisions into an AskUserQuestion for Remy — lead with your
   own recommendation for each. Do NOT start big WebGPU work until decision A is
   settled (his eyeball).
