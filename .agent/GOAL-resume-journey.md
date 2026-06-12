# GOAL: Resume Journey Flow

> Loop retargeted here 2026-06-11 by Remy ("set the loop to fix the resume journey flow").
> Previous goal (3D visual quality) is parked with its tracker current — see
> `.agent/GOAL-3d-visual-quality.md` (tasks through 80 closed, drift-clean).

## The Standard

"Continue Journey" must reliably restore the player's previous session. A player
who saves (or autosaves), closes the game, reopens it, and clicks Continue
Journey should land exactly where they left off:

- [ ] **Correct surface.** They return to the surface they were on (World3D /
      submap / town / combat / dialogue — whichever was active), not a default.
- [ ] **Correct state.** Party, position, time-of-day, inventory, gold, active
      quests, and in-progress activities survive the round trip.
- [ ] **No errors.** Zero console errors during load; no broken UI panels after.
- [ ] **No dead ends.** Every surface reachable before the save is reachable
      after the resume (menus, combat path, travel).
- [ ] **Fast.** The resume completes without hangs or multi-second stalls
      beyond asset loading.

## Known Context (start here, verify before trusting)

- The headless rig (`.agent/3d-visual-quality/captures/shoot.mjs` +
  `save-bridge.mjs` + `storageState.json`) already automates: load app →
  click "Continue Journey" → wait for phase change. Reuse it for evidence.
- 2026-06-11 observation (3D-combat-map lane): the autosave currently loads
  into the World3D surface; reaching combat required `?dev_combat=1`.
  Whether that surface choice is correct-by-design or a resume defect is an
  audit question.
- Console buffer is stale across reloads in the preview tab — verify console
  claims via in-page deterministic replay or headless capture, not
  `preview_console_logs` (see memory: world3d-console-buffer-stale).

## Process Rules

1. **Audit before fixing.** Task 1 in the tracker is an end-to-end symptom
   audit. Do not fix anything until the failure list is written down.
2. **Evidence per fix.** Before/after captures or console transcripts in
   `.agent/resume-journey/evidence/`, reproducible via a script where possible.
3. **Update TRACKER.md after every task; log out-of-scope finds in GAPS.md.**
4. **Round-trip gate.** Any fix must keep the full save → reload → continue
   round trip green before it counts as done.

## Read These

- `.agent/resume-journey/TRACKER.md` — living task list.
- `.agent/resume-journey/GAPS.md` — out-of-scope issues found along the way.
