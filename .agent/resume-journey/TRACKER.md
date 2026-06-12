# Resume Journey Flow — Task Tracker

> Single source of truth for resume-journey tasks.
> Read `.agent/GOAL-resume-journey.md` for the standard and process rules.

## Status Key
- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked

## Tasks

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1 | End-to-end audit: save → reload → Continue Journey. Enumerate per-surface what restores, what resets, what errors. Write the symptom list into this tracker as new tasks. | P0 | [x] | Done 2026-06-11. Rig: `audit.mjs` (resume + saved-vs-live diff) + `roundtrip.mjs` (resume → switch surface → autosave → reload → resume) + dev probe `window.__araliaState` (App.tsx, canUseDevTools-gated). Evidence in `evidence/run1-*`, `evidence/rt1-*`. **What PASSES:** Continue routes to the latest slot incl. autosave; LOAD_TRANSITION → PLAYING in ~3.1s; zero console errors; location, submap coords, worldViewMode, party, gold, inventory restore exactly; full round trip (3D → Atlas → autosave → reload → Continue) preserves the surface change; atlas/exploration UI healthy after resume (rt1-resume2.png). **Symptoms found → tasks 2-5.** |
| 2 | **World3D resume shows a featureless blue wedge — saved playerWorldPos can be off-map.** The autosave carries `playerWorldPos z=-881` (valid 0..40960): `World3DWrapper.handlePositionChange` dispatches unclamped camera coords, autosave persists them, resume restores them faithfully → the chunk streamer centers outside the grid. Fixed: clamp at dispatch (wrapper) AND clamp/heal on load (appState validatedPlayerWorldPos). | P0 | [x] | Done 2026-06-11. `World3DWrapper.tsx` clamps to `gridWorldDimensions` before throttle/dispatch; `appState.ts` LOAD_GAME_SUCCESS clamps the loaded position into the world grid (heals existing bad saves). 2 new reducer tests (off-map clamped / in-bounds untouched); 12 suites green (32 tests). **Before/after on the same bad autosave:** run1-result.json (live z stayed −881) → run2-postfix-result.json (live z=0, y recomputed 32.98, zero console errors). **Honest scoping:** the view at the healed position is STILL near-featureless (run2-postfix-resumed.png) — control experiment world3d-control.png proves the World3DDemo's known-good spawn renders the same minimal plain, so the emptiness is the streamed-world surface's current fidelity (worldforge 3D-ground-mode lane, in progress by design), NOT a resume defect. Resume now restores correct, in-bounds state with zero errors. Logged as GAPS #3. |
| 3 | **Combat does not resume.** `saveLoadService.loadGame` forces `phase = PLAYING` (line ~354) and combat runtime (turn manager, initiative, battle map) is hook-local — never serialized. Autosave IS eligible during COMBAT/BATTLE_MAP_DEMO (`useAutoSave.isGameplayPhase`), so a mid-combat save quietly resumes on the exploration surface instead. | P1 | [ ] | Decide: serialize combat (large) vs explicit pre-combat checkpoint + "combat doesn't save" rule (small). Code-confirmed; runtime repro needs a mid-combat save. |
| 4 | Saved-while-overlay-open view state resets by design: `isMapVisible`/`isSubmapVisible`/journal/dev-menu forced false on save AND load. Substance (subMapCoordinates etc.) restores; only the open panel is lost. | P2 | [ ] | Verify this is acceptable-by-design with Remy; if a player saves from the submap they reopen it in one click. Document or fix. |
| 5 | Resume log noise: every load appends "Game loaded successfully." to the persistent message log (3 accumulated in rt1-resume2.png). | P2 | [ ] | Cosmetic; either don't persist the load confirmation or collapse repeats. |

## Progress Log

| Date | Task # | Action | Result |
|------|--------|--------|--------|
| 2026-06-11 | — | Goal created; loop retargeted from 3D visual quality | Scaffolding only — no audit performed yet. |
| 2026-06-11 | 1 | End-to-end audit executed | Built `audit.mjs`/`roundtrip.mjs` + `__araliaState` dev probe. Happy path is healthier than reported: state fidelity exact, 0 console errors, ~3.1s resume, round-trip green. The real defect is task 2 (off-map saved position → wedge view on the World3D surface) — the most likely source of "resume feels broken". Tasks 2-5 enumerated with evidence. |
| 2026-06-11 | 2 | Off-map playerWorldPos clamp (dispatch + load-heal) | `World3DWrapper.handlePositionChange` clamps to the world grid before anything persists; `appState` LOAD_GAME_SUCCESS heals existing saves (audited z=-881 → 0). A/B: run1-* → run2-postfix-* (same bad autosave; position now in-bounds, 0 errors). Round-trip gate re-run green (rt2-postfix-result.json). Control experiment (world3d-control.png) separated the remaining featureless view from resume: the World3D streamed surface renders the same minimal plain at its known-good demo spawn — that's worldforge ground-mode fidelity work, not a resume defect (GAPS #3). Pre-existing tsc error appState.ts:773 (`isLongRestModalVisible`) belongs to a concurrent session's uncommitted long-rest work — not touched. |
