# Fleet Orchestration — Tracker

> Goal: drive Aralia work through the agent fleet (dashboard: `misc/agent_matrix.html`),
> respecting per-agent usage limits and falling back when one runs dry.

## Fleet Readiness (2026-06-12)

| Agent | Headless command | Auth | Live probe | Budget |
|---|---|---|---|---|
| Claude (this session) | — orchestrator — | Pro ✓ | partial | 5h+weekly |
| Codex CLI | `codex exec` ⚠ NOT from sandboxed shells (0xc0000142) — use web-terminal PTY | Plus ✓ | ✓ | ⚠ **wk 0% — DRY until 15 Jun 03:54** (5h 98%); overnight worldforge run drained the weekly. Fall back to agy/gemini/qoder. (probed 2026-06-12 ~14:50) |
| Antigravity | ⚠ `agy -p` silently outputs NOTHING from sandboxed shells (bash AND powershell) — drive the TUI via web-terminal PTY (`misc/codex-terminal.html` + wtSend), file-based I/O (spec file in, output file out) | Google AI Pro ✓ | ✓ | all models 100% |
| Qoder (bob) | `qodercli -p "..."` | Community ✓ | ✓ (log scrape) | 200 Qwen/day |
| Qoder (cranenre) | `QODER_CONFIG_DIR=~/.qoder-cli-cranenre` + `QODER_PERSONAL_ACCESS_TOKEN` (PAT at ~/.qoder-pats/cranenre.txt / user env `QODER_PAT_CRANENRE` — never in repo files) | ✓ PAT verified 2026-06-13, headless `-p` call succeeded (CRANENRE_LANE_OK) | ✓ (log scrape) | Community 0/0 plan credits; the successful Qwen call despite 0 credits implies the daily promo applies → likely a SECOND ~200/day pool (unconfirmed exact count; watch for hard-stops) |
| Qoder (bob, PAT lane) | `QODER_PERSONAL_ACCESS_TOKEN` from user env `QODER_PAT_BOB` (token at ~/.qoder-pats/bob.txt, OUTSIDE repo — never write the raw PAT into repo files) | ✓ verified 2026-06-13, browserless | ✓ (shares bob quota) | same 200/day Qwen pool as bob |
| Gemini CLI | `gemini -p "..."` ✓ smoke-tested 2026-06-12 (PROBE_OK) | ✓ (sunset Jun 18!) | ✓ | quota 0% used |
| Copilot CLI | `copilot -p "..." --allow-all` | ✗ needs /login | — | 50/mo |
| Cursor Agent | `agent -p "..."` | ✗ needs agent login | — | ~50/mo shared |
| OpenCode | `opencode run "..."` | Google+HF keys ✓ | — | per-provider |
| Ollama | local | n/a | — | unlimited |
| Kilo CLI | `kilo run "..."` headless; `kilo stats` native usage readout; 500+ model gateway or BYO keys | ✗ gateway login pending (`kilo auth login`) | n/a (`kilo stats`) | BYO / ~$15 signup credits unverified |

## Dispatch Rules
1. Cheap/mechanical → free-tier agents (qoder Qwen promo, gemini until Jun 18, agy Gemini Flash).
2. Backend/heavy implementation → codex (gpt-5.5 xhigh) via web-terminal PTY (NOT `codex exec` from a sandboxed shell).
3. Planning/frontend/hardest parts → this session (Remy's division-of-labor directive).
4. Before dispatching: check `/api/agent-usage?agent=X`; on limit-hit errors, fall back down the list.
5. ALWAYS verify dispatched work here (tests + diff review) before marking done.
6. **Launch headless dispatches through the dashboard session rig (added 2026-06-12)** so Remy can watch each one as a live terminal tile in `misc/agent_matrix.html` ("Live Dispatches" section) and type into it if it stalls:
   ```bash
   curl -s -X POST http://localhost:5174/api/agent-sessions/spawn \
     -H "Content-Type: application/json" \
     -d '{"title":"<short task name>","agent":"codex","cmd":"codex exec --full-auto \"...\""}'
   ```
   Returns `{id}`. Poll `GET /api/agent-sessions` for status/exit; `POST /api/agent-sessions/<id>/kill` to abort. The PTY survives browser tabs closing (unlike the sticky codex-terminal PTY) — the dev server owns it. Raw-Bash `codex exec` is the fallback when the dev server isn't running.

## Open Dispatches / Next Loop
- **✓ DONE 2026-06-12 — resume-journey task 3 (combat resume), Option B.** Gemini's analysis (`combat-resume-analysis-gemini.md`) verified + implemented in-session at the true chokepoints (reducers kept pure). See resume-journey TRACKER task 3 row for the full diff summary. Tests: new loader test + 419 hooks/services green.
- **Task 4 BUILT 2026-06-12 (Remy chose "Build it" via the visual report):** overlay persistence implemented at all three forcing layers (saveGame/emergencySaveSync/loadGame + the hidden appState LOAD_GAME_SUCCESS re-force). 140/140 services+state green. Awaiting Remy's live validation (submap open → save → reload → reopens); report file kept until then. Details: resume-journey TRACKER task 4 row.
- **Worldforge board = Remy-decision checkpoint (surveyed 2026-06-12 ~15:00).** Full TRACKER read: the overnight run closed 12/12 tasks (atlas→region→local→3D enterable village w/ named, scheduled occupants; deltas reach the 3D village; playerGroundPos persistence wired). Lanes A/B/C all COMPLETE/accepted, silent since ~10:45. The remaining items are NOT autonomous-dispatchable — they need Remy's live judgment: (1) **Enter Village HUD button** placement (data-driven entry works via `?wf_ground=1&wf_town=1`, just no in-HUD affordance — UX call); (2) **live ground-position check** — WF-STORE-2 wiring type-checks + reducer is test-proven, but the camera-move→autosave→reload loop can't be verified headless (autosave hook never fires in short headless sessions); one drag+reload in a live session confirms it; (3) **roof occlusion** judgement (hide roof when camera inside?). No free-agent dispatch queued — would collide with the worldforge orchestrator session and the work is decision-gated, not spec-gated.
- **Dedicated agent terminal (2026-06-12):** `dev:agents` launch entry → port 5177, own preview tab + own sticky PTY at `http://localhost:5177/Aralia/misc/codex-terminal.html`. Use THIS for agy/codex TUI dispatches — concurrent sessions use the 5174 tab and can't kill this PTY. Reminder: the sticky PTY dies when its last ws client disconnects, so never navigate this tab away mid-run.
- **Dashboard login buttons (2026-06-14, settled):** Copilot/Cursor/Kilo chips have a gold "log in" button → `POST /api/agent-sessions/open-login {agent}` opens a REAL detached OS console (`cmd /c start cmd /k <login>`). **ROOT CAUSE (found 2026-06-15):** the CPU spike was NOT node-pty — it was the repo `.mcp.json` `github` MCP server (empty `GITHUB_PERSONAL_ACCESS_TOKEN`) exiting instantly and Copilot CLI respawning it in a tight `npx` loop (`~/.copilot/logs/process-*.log`). Hits ANY copilot in the repo dir, any terminal host (real OS console spiked too; VS Code terminal wouldn't help). **Fix A (done):** open-login launches with cwd=%USERPROFILE% (no .mcp.json → no project MCP → no loop). **Fix B (pending user decision):** repair or remove the empty-token github server in .mcp.json **UPDATE 2026-06-15 (Gemini-assisted, embedded login now viable):** applied 3 fixes to agentSessionManager — (1) `taskkill /PID <pid> /T /F` process-tree teardown (hardKill) → fixes the conhost/orphan leak + AttachConsole crash; (2) `CI=1`+`FORCE_COLOR=1` env on login spawns → suppresses 60Hz spinner redraw flood; (3) clean cwd=%USERPROFILE% → no repo .mcp.json → no github-MCP respawn loop. Measured copilot login-tile CPU: **99%→46%→34%→30%→17%→21% over 21s** — a transient ~3s boot spike that SETTLES to ~20%, vs the old 92%-SUSTAINED peg. Teardown verified leak-free (0 procs after DELETE). Login button now routes to `/api/agent-sessions/spawn-login` (visible Live-Dispatch tile, auto-expands). `/api/agent-sessions/open-login` (detached console, also clean-cwd) kept as fallback. Fix B (repair/remove empty-token github MCP server) STILL recommended — it's the durable repo-wide fix; the cwd workaround only protects the login path. — it's a CPU footgun for EVERY MCP-reading CLI launched in this repo (copilot, qoder, claude session churn). Earlier mis-diagnosis (node-pty) was wrong; the detached console still spiked, proving the process — not the host — was the hog. node-pty tiles remain fine ONLY for non-interactive `-p`/`exec` dispatches that exit. If "see the login in Live Dispatches" is wanted, build a READ-ONLY status/mirror tile (poll a tee'd logfile), never a live node-pty xterm.
- Browser logins still pending (Remy completes in the opened console / browser): cursor, copilot, NVIDIA key, kilo (window opened 2026-06-14 — pick "Kilo Gateway"). qoder-cranenre DONE via PAT.

## Dispatch Log

| Date | Task | Agent | Result |
|------|------|-------|--------|
| 2026-06-12 | resume-journey task 3 (combat-resume Option B) | gemini -p (free, headless analyze) → implementation in-session | CLOSED. Gemini's architecture analysis was correct (incl. the appState:770 citation this orchestrator initially mis-graded — grep pattern error, not Gemini error). Implementation (one coherent set, verified on disk) at the true chokepoints, reducers kept pure: useAutoSave eligibility excludes combat + a one-shot pre-combat checkpoint fires on the exploration→combat transition; loader heals raw COMBAT/BATTLE_MAP_DEMO phase to PLAYING with a "Resumed from pre-combat checkpoint." toast; handleSaveGame blocks manual saves during combat. New loader test green; saveLoadService 21/21; full hooks+services sweep 419 passed/8 skipped; tsc clean on touched files (2 pre-existing unrelated errors remain: appState.ts:773 long-rest, worldHistory test). **Coordination note:** two sessions briefly converged on this task — the working tree ended with a single implementation (grep-verified, no double-apply). Check `git status` + tracker timestamps before implementing anything another session may own. |
| 2026-06-12 | resume-journey task 4 (restore open overlay on resume) | orchestrator in-session (Remy picked "Build it" off the task4-overlay-report.html visual; full context already loaded from task 3 — dispatch overhead > task size) | ✓ BUILT, pending Remy live validation. Three forcing layers fixed (saveGame, emergencySaveSync, loadGame strict-boolean heal) + the hidden fourth (appState LOAD_GAME_SUCCESS re-force — service-only fix would have silently done nothing in-game). Dev/debug surfaces stay closed. TDD red→green: 3 new tests, 140/140 services+state, tsc clean. Cost: $0. |
| 2026-06-12 | Usage-probe fixes (claude/qoder recipes) | codex exec (gpt-5.5 xhigh) | Partial: tool layer died (0xc0000142 from sandboxed shell) but its diagnosis (Tab-accept, qoder log scrape) was correct — applied by orchestrator; qoder probe now clean, claude probe partial. 393k tokens. |
| 2026-06-12 | resume-journey task 5 (persistent "Game loaded successfully." duplicates) | qodercli -p (free Qwen3.7-Max, read-only analyze→propose; orchestrator applied+verified) | ✓ SHIPPED. Qoder pinpointed useGameInitialization.ts:232 + serialization mechanism + clean diff on its free quota. Pattern note: the permission classifier (correctly) blocks spawning sub-agents with bypass_permissions — the analyze-readonly→orchestrator-applies split is the sanctioned shape. 36 suites/192 tests green. |
| 2026-06-12 (overnight) | Worldforge Living Town vertical — 10 directives: B6 TownPlan persistence, B7 delta→interior, ROSTER-1, GROUND-DELTA-1, WF-STORE-1/2, NAMEPLATE-1, TOWNTILES-1, ATLAS-OVERLAYS-1, WFG5-1 river carve | codex exec gpt-5.5 medium --full-auto, ~10 sequential seats from the worldforge orchestrator session (briefs at docs/projects/worldforge/orchestration/BRIEF-*.md) | ✓ ALL 10 ACCEPTED after independent verification (tests+tsc+scope per brief; worldforge 194/194). NOTE: codex exec worked fine from this session's Bash (contradicts the sandboxed-shell 0xc0000142 row — environment differs). ~1.5M codex tokens total; codex 5h/weekly budget now likely DRY — prefer other agents next. Orchestrator-side slices: interiors gen+3D, culture names (PRNG boundary), time-of-day, biome blend, in-game ground entry (wf_ground/wf_town; lazy-module URL bug fixed live with Remy). |
| 2026-06-12 | Agent Matrix v2 "Cockpit" redesign (spec: COCKPIT_SPEC.md) | orchestrator in-session (frontend = Fable lane; brainstormed w/ Remy via visual companion, layout A chosen) | ✓ SHIPPED + eyeballed. misc/agent_matrix.html restructured: quota strip (10 chips, live probe data, click→reference drawer), full-width dispatch grid (existing interactive xterm tiles), right rail (quick-dispatch form → /spawn + activity feed). 1:1 content preservation: all 13 hand-maintained reference sections moved verbatim into slide-over drawers (#drawer-host). Backend: agentSessionManager.ts now logs spawn/exit to .agent/orchestration/activity.jsonl, serves GET /api/agent-activity, MAX_DONE_RETAINED 8→16. Verified live on :5174 — form-spawned smoke session streamed in a tile, exit logged to feed, zero console errors; captures: .agent/orchestration/cockpit.png + cockpit-drawer.png (shoot-cockpit.mjs added for future eyeballs). |

### Dispatch round 2026-06-12 ~20:00 (worldforge/live orchestrator session, Remy goal: matrix-driven, max 4 agents)

| Task | Agent/lane | Session | Retrieval |
|------|-----------|---------|-----------|
| CC-RANDOM-1 Auto-Fill creator button | codex (launched pre-dry-discovery) | raw bash log .agent/codex-ccrandom1.log | ✓ RETRIEVED+ACCEPTED: seat hit 0xc0000142 before its report, but the code landed — orchestrator verified: randomizeCreation engine + 30-seed legality tests 2/2, tsc clean, button wired (CharacterCreator.tsx:591). Codex weekly now DRY (per readiness row) — no further codex dispatches until Jun 15. |
| streets visibility (ground mode) | gemini -p (read-only propose) | as-mqbiuq2d-7375a2 | report file .agent/orchestration/dispatch-reports/streets-visibility.md + session watch; orchestrator applies+verifies |
| worldmap modal dead-zone | qoder bob -p (read-only propose) | as-mqbivbzu-65053f | report file worldmap-deadzone.md + session watch |
| tree variety (ground mode) | qoder cranenre lane -p (read-only propose) | as-mqbivcbp-cb4a23 | report file tree-variety.md + session watch |

Concurrency: 3 running + 0 (codex done) = 3/4 cap. Watch loop b7r0azg0q
polls /api/agent-sessions every 20s → notifies orchestrator on all-exit;
fallback: reports are files on disk regardless of session state.
Also this session (in-lane, not dispatched): legacy 3D retired from
PLAYING (ground default, ?wf_legacy=1 escape, clicked-tile routing).

### Dispatch round outcomes (2026-06-12 ~21:30)

| Task | Lane | Outcome |
|------|------|---------|
| worldmap dead-zone | qoder bob | ✓ APPLIED+verified: preserveAspectRatio=none on the Azgaar #map SVG (bridge script injection, MapPane.tsx); qoder analysis was citation-grade. Awaiting Remy eyeball; trade-off (stretch vs ocean-fill) noted. |
| tree variety | qoder bob (v2; cranenre lane env bug burned attempt 1) | ✓ APPLIED+verified with TWO orchestrator corrections the proposal missed: (1) three.js setColorAt-after-first-render needs material.needsUpdate (USE_INSTANCING_COLOR recompile), (2) palette floats must be written as SRGBColorSpace (linear washed all trees to pale mint). Split tree/bush instanced layers, 3-shade palettes, size by id hash. 54/54 components+bridge; proof variety-after3.png. |
| streets visibility | gemini (2 failed runs) → orchestrator in-session | gemini -p unusable through the rig PTY (arg-splitting: "positional + -p" error even with file-brief pattern) — ENVIRONMENT LEARNING: gemini dispatches need stdin piping or direct Bash, not the rig cmd line. Fix done in-session: street width floor 1.5→2.5m + packed-dirt #a08b62. |
| CC-RANDOM auto-fill | codex (final pre-dry seat) | ✓ verified earlier this round. |
Also in-session: World3DWrapper now lazy-imports the worldforge bridge
(the static import dragged the full FMG stack into PLAYING's chunk and
the unit-test module graph — loader test 8.7s import → fast again;
legacy fallback now async, test updated with waitFor).
Concurrency peak this round: 3/4. All sessions exited; reports under
.agent/orchestration/dispatch-reports/.
