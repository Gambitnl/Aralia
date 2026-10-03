# Board Sweep - Open Questions + Decisions

Last updated: 2026-09-09 (sweep by fable-orch-20260909, seat wayfarer)

Question sheet (round 4 live; rounds 1, 2b and 3 applied 2026-09-10, 2026-09-11 and 2026-09-13): <https://claude.ai/code/artifact/8fd8c20f-acb4-4f92-a6b3-86d809ab7a4e>

Scope: every item the 2026-09-09 board sweep could not close without Remy. Each question names its source row, the options, and the orchestrator's recommendation. Answer inline (`Qn: A`) or in chat; an agent applies the answer and closes the row.

## Question Index (One-Liners)

- Q1: Snapshot commit-msg guard on the scheduler checkout (WF-G76).
- Q2: Seat roster mirror: commit, ignore, or leave (WF-G141).
- Q3: `git init` the operator dashboard checkout (GG-231).
- Q4: Dashboard pet atlas for fresh clones (GG-176).
- Q5: Resistance/vulnerability order: 2024 sequenced or 2014 cancel (GG-193).
- Q6: Extend `Item.effect` with save/condition/multi variants (GG-218).
- Q7: Crafted item cost curve numbers (GG-220).
- Q8: Four red worldforge goldens: regenerate or revert (GG-223).
- Q9: Resync the Entity-Generator engine copy from Aralia (GG-225).
- Q10: Entity-Generator remote and visibility (da59 H10).
- Q11: Skeleton canon: pack 66-joint everywhere or keep the 39-bone biped (Rig Night q3; gates 5 tasks).
- Q12: Finger trace with straightened chains (R1, question sheet q1).
- Q13: Atlas Studio trial needs your hands (T21).
- Q14: MemPalace repair on your personal index (agora-2e50.2).
- Q15: `src/report.py` split tasks name a file that never existed (agora-139c, 97ea).
- Q16: Staged quest type family: migration target or future work (GG-173).
- Q17: Un-ignore the codebase visualizer and the DesignPreview town pane (GG-160, GG-145).
- Q18: Entity-Generator adapter move (da59 H9) and the four review items (P1).

## Status Key

- Answered: Decision is made.
- Pending: Needs your answer.
- Blocked: Depends on another answer.

---

## Q1. Snapshot commit-msg guard on the scheduler checkout (WF-G76) - Answered: A. Remy confirmed 2026-09-13 that the snapshot checkout has the guard. WF-G76 resolved.

The GG-117 snapshot guard lives in `.git/hooks`, which git never clones. `npm install` now self-installs it, but nobody has confirmed the daily snapshot scheduler runs from a checkout where that happened.

- A: You run `npm run hooks:install` once on the scheduler checkout and say so; the row closes.
- B: An agent adds a pre-flight to the scheduler script that installs the hook itself (needs the scheduler's path).
- C: Leave it; accept an unguarded snapshot on a fresh checkout.

Recommendation: A now, B as the durable fix if you give the scheduler path.

## Q2. Seat roster mirror (WF-G141) - Answered: B (gitignored; daemon rebuilds from snapshot). Applied 2026-09-10.

`tools/agora/seat-roster.json` is untracked and un-ignored. The daemon rewrites it on every seat write. `git clean -fdx` deletes it; the daily whole-tree auto-commit would push live seat state.

- A: Commit it (seats become part of history; every seat write dirties the tree).
- B: Gitignore it and document the restore path (the daemon rebuilds it from its snapshot on start).
- C: Leave it.

Recommendation: B. The mirror is runtime state, and the snapshot already carries the seats.

## Q3. `git init` the operator dashboard (GG-231) - Answered: A. Applied 2026-09-10 (commit becf64d, 1567 files).

`F:\Repos\Aralia-operator-dashboard` is not a git repository. No history, diff, revert or blame exists for the Matrix control plane. The sweep found two changes there today (a test script and a doc note) with no way to review them.

- A: An agent runs `git init` plus a first commit of the tree as-is (you name the remote later).
- B: You initialize it yourself.
- C: Leave it.

Recommendation: A. This is a state change, so it waits for your yes.

## Q4. Dashboard pet atlas for fresh clones (GG-176) - Answered: A. Applied 2026-09-11 (README section "Pet pictures (local only)").

`tools/agora/dashboard/pets/**` (102 files) is gitignored and untracked by design. A fresh clone shows no pet avatars and the pet inspector test cannot run.

- A: Document a local install step (where the atlas comes from) in the dashboard README.
- B: Un-ignore and commit the atlas (about 100 media files enter history).
- C: Leave it.

Recommendation: A.

## Q5. Resistance and vulnerability order (GG-193) - Answered: A (2024 sequenced). Applied 2026-09-11 (ADR 0004, domain doc line, source cite).

Two committed tests asserted opposite results. The code now applies resistance, then vulnerability (2024 rules: 25 -> 12 -> 24). The 2014 rule cancels them (25 -> 25). No doc says which one Aralia follows.

- A: 2024 sequenced (current code). An agent writes the ADR and the domain doc line.
- B: 2014 cancel. An agent flips the code and the two tests.

Recommendation: A.

## Q6. Extend `Item.effect` (GG-218) - Pending

Six crafted items (alchemist's fire, blasting powder, antitoxin, potion of heroism, and two more) need an effect that carries a save, a condition, or several effects. The `ItemEffect` union has none, while spells and traps already do. The type is read by more than ten consumers.

- A: Extend the union now (an agent adds `save`, `condition` and `multi` variants and wires the six items).
- B: Defer until the crafted registry has a consumer (see Q7).

Recommendation: B, because `CRAFTED_ITEMS` is imported nowhere today.

## Q7. Crafted item cost curve (GG-220) - Pending

Costs are a flat rarity default. `CRAFTED_ITEMS` has no importer and sits on the orphan list.

- A: You give the numbers (per rarity or per item).
- B: Keep the flat default until the registry is wired.
- C: Delete the registry.

Recommendation: B.

## Q8. Four red worldforge goldens (GG-223) - Answered: C (bisect done 2026-09-10). Decision handed to a separate conversation 2026-09-11 (task chip "Decide the four red worldforge goldens").

`roofStyle.golden`, `generateLocal` and `generateTownRoster` goldens are red. Their closures hold no split module, only uncommitted edits under `worldforge/interior`, `town`, `erosion` and `seededRandom.ts`. The `.snap` files are tracked.

- A: The edits are intended: an agent regenerates the goldens and records the behavior reason.
- B: The edits are not intended: an agent reverts the interior/roofPlan change.
- C: You do not know who made the edits: an agent bisects them first and reports.

Recommendation: C, then A or B.

## Q9. Resync the Entity-Generator engine copy (GG-225) - Parked 2026-09-13 by Remy: the Entity Generator is on a sidetrack repo for now.

Seven engine files in Entity-Generator drifted behind Aralia; two ported suites cannot compile and four fail real assertions (marked PORTED-DRIFT).

- A: Resync the seven files from Aralia now, port the two suites, drop the markers.
- B: Keep the standalone divergent and mark it a fork.

Recommendation: A.

## Q10. Entity-Generator remote and visibility (da59 H10) - Parked 2026-09-13 by Remy: the Entity Generator is on a sidetrack repo for now.

The standalone has no remote.

- A: Private GitHub remote under your account; sync plan: Aralia is the source, the carve-out gate runs before each push.
- B: Public remote.
- C: No remote yet.

Recommendation: A.

## Q11. Skeleton canon (Rig Night q3) - Parked 2026-09-13 by Remy: the Entity Generator is on a sidetrack repo for now. The five gated tasks carry a PARKED reason on the board.

This one answer unblocks agora-9dbc (T11 canon freeze), agora-e457 (T8), agora-e891 (H4), agora-ae8c (H6) and agora-fa3d (T20).

- A: Use the pack 66-joint skeleton everywhere (renames bones across rigs, clips and the Part Lab).
- B: Keep the 39-bone biped as canon and retarget packs into it.

Recommendation: none from the orchestrator; the earlier rig-night sheet holds the trade-offs. Say A or B and the five tasks unblock.

## Q12. Finger trace with straightened chains (R1, sheet q1) - Pending. The work lives in the Entity Generator, which Remy parked 2026-09-13; the sheet asks once more whether it parks with the rest. Tasks e758 and ff56 carry a PARKED reason.

agora-e758 waits on this; agora-ff56 (banded digit weights) waits on e758.

- A: Go: straighten the finger chains and un-park centerlineFit --fingers.
- B: Keep the current bent chains.

Recommendation: A.

## Q13. Atlas Studio trial (T21, agora-e17e) - Parked 2026-09-13 with the Entity Generator work.

Needs your hands: drag `.agent/rigbench/atlas-stylized-a/intake.glb` onto the INPUT MESH node in the Atlas Studio web app and download the rigged GLB.

- A: You do it and drop the GLB where the task says.
- B: Drop the trial.

## Q14. MemPalace repair (agora-2e50.2) - Answered 2026-09-13: "Show me first". A read-only report is on the sheet; the repair waits for the next answer.

The documented HNSW recovery mutates `C:/Users/Gambit/.mempalace/palace`, your personal memory index.

- A: You run the documented repair yourself.
- B: You authorize an agent to run it (it backs the palace up first).
- C: Skip and close the task.

Recommendation: A or B with the backup.

## Q15. `src/report.py` split tasks (agora-139c, 97ea) - Pending

Both tasks name `src/report.py`, which has never existed in this checkout.

- A: Close both as invalid.
- B: Give the real path (another repo?) and they reopen there.

Recommendation: A.

## Q16. Staged quest type family (GG-173) - Pending

`src/types/quests.ts` carries a staged model (QuestDefinition, QuestStage, ...) with zero runtime consumers beside the flat shapes the game runs on. The two models already drifted once (items vs itemIds).

- A: Migration target: an agent writes the adapter and migration path.
- B: Future work: move it behind a marked section or its own module.
- C: Delete it.

Recommendation: B.

## Q17. Un-ignore two working-tree-only sources (GG-160, GG-145) - Answered: A. Applied 2026-09-10 (.gitignore negations; both untracked until the next commit).

The whole codebase visualizer (`misc/dev_hub/codebase-visualizer/`, mandated by AGENTS.md) and `PreviewTown3D.tsx` (the acceptance pane for two graded slices) exist only in this tree.

- A: Un-ignore both with narrow `.gitignore` negations and commit them.
- B: Un-ignore only the visualizer.
- C: Leave both local.

Recommendation: A.

## Q18. Entity-Generator adapter move and the review backlog (da59 H9, P1) - H9 parked 2026-09-13 with the Entity Generator work; P1 still pending.

H9 (move the recipeFrom* adapters out of the engine) is marked planned-not-ready pending your adapter decision. P1 lists four shipped changes that wait for your eye.

- A: Approve H9 as planned; an agent runs it after Q11.
- B: Hold H9.
- P1: reply with which of the four you want re-shot or changed, or "all fine".

Recommendation: A after Q11.
