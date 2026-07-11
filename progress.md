Original prompt: Set a goal to make the start of the game playable. Think of core Concepts that should work first and the set the goal to run the game and try

## 2026-07-10 playable-start pass

- Active objective: identify the intended opening loop, run it from the current checkout, repair concrete blockers, and exercise the opening flow end to end.
- Existing intended loop found: Main Menu -> Character Creation -> Start Point Selection -> generated opening situation -> peaceful conversation or hostile skill/attack resolution -> exploration/combat.
- Ollama is reachable at `localhost:11434`; current live verification can use the real generation path.
- Durable prior handover reports hostile openings as live-verified and leaves peaceful-opening verification plus repeated pre-fight dialogue after combat as open observations.
- Next: launch the current Vite app, play from the menu, inspect screenshots and browser errors, then classify any blocker before editing runtime code.

### Runtime proof and repair

- Peaceful run completed through the normal player path: Begin Legend -> Auto-Fill character -> Begin Adventure -> choose starting town -> generated opening conversation.
- The player action "I step between them and ask Therion what survival costs here" received the generated reply: "Survival costs lives, and you have no idea how many I've lost already."
- Ending the peaceful opening completed the generated quest and returned to exploration.
- Visual proof found the collapsed Agent sim and Town history developer inspectors covering the conversation Send button. Enter worked, but pointer submission was obstructed.
- `src/components/layout/GameModals.tsx` now hides those two dev inspectors while `activeConversation` owns the interaction area. They reappear after the conversation ends, so the developer tools are preserved.
- A fresh hostile QA run reached a tense generated opening with four suggested replies, free text, and an Attack action. DOM proof showed neither developer inspector mounted during that conversation.
- Focused verification: `npx vitest run src/components/layout/__tests__/GameModals.test.tsx --maxWorkers=2` passed 28/28.

### Remaining gaps observed

- Optional opening-scene illustration generation returned HTTP 500 in both runs. The player-facing text loop handled this honestly with "Scene illustration unavailable" and remained playable.
- Full-page Playwright screenshots can hang on the live 3D/WebGL surface. Element-scoped capture succeeded for the peaceful conversation and exposed the overlap defect; DOM snapshots were used for the hostile run.
- The hostile run reached the choice/attack surface, but browser automation became unresponsive while the live world scene was continuously rendering, so this pass did not supersede the prior nine-run live proof for dice/combat resolution.

## 2026-07-11 whole-game audit W01 continuation

- A real persisted run resumed through Continue Journey and displayed the expected named welcome transition for Emongotua Knom.
- After transition, the save restored the prior exploration log, generated world, player context, transport choices, and the World Map overlay that had been open when the save was written.
- The map rendered correctly and was visually inspected. Once the live map had rendered for several seconds, the browser controller stalled on all title-bar interactions, including Maximize and element-rectangle reads. This matches the existing WebGL automation limitation and is not registered as a product defect without independent interactive proof.
- Next W01 proof: abandon confirmation, checkpoint history presentation, IndexedDB migration/corruption recovery, and manual character-creation branches.

### Checkpoint history and shared window repair

- Live eligible exploration produced a real `1 Minute Checkpoint` after 63 seconds, proving the scheduler, save service, metadata index, and Resume Journey UI together.
- Resume Journey now separates Waystones (checkpoints), Echoes (rapid autosaves), and Chronicles (manual records). Load IDs and delete confirmation are covered by focused tests; the live deletion flow was cancelled with Keep Memory so the proof checkpoint remains available.
- Independent Playwright identified why Resume Journey Close was inert: the touch-sized top-right resize zone intercepted pointer events over the shared Close button. WindowFrame now layers title actions above resize zones. Unit, independent browser, and live close proofs pass.
- Next W01 proof: longer-tier retention, IndexedDB migration/corruption recovery, abandon confirmation, and manual character-creation branches.

### IndexedDB-first recovery proof

- The older Tiered Autosave GAP-005 wording was partly stale: one-time migration, migration-flag, and emergency-save recovery tests already existed.
- Five missing initialized-storage cases now prove primary IDB writes, IDB precedence over stale local data, valid local fallback when the IDB record is absent, corrupt IDB rejection, and deletion from both stores plus metadata.
- The fallback case exposed inaccurate diagnostics: load logs named IndexedDB based on availability even when localStorage supplied the payload. SaveLoad G8 now tracks and reports the actual source, with assertions for both paths.
- The focused save/load service suite passes 42/42. Tiered Autosave has no remaining open owner gaps, although W01 still owes longer elapsed-tier retention proof before the campaign row is fully verified.

### Active-run abandonment proof

- Returning from exploration exposed Abandon Run only while an in-memory party existed and showed a clear warning that unsaved progress would be lost.
- Cancel restored the Abandon Run action without clearing state. A second pass confirmed the action, removed Return/Abandon from the menu, and left persistent Continue/Resume recovery available.
- A focused MainMenu regression now proves the warning is non-destructive, Cancel is safe, and only explicit Confirm invokes the abandon callback. The complete MainMenu suite passes 13/13.
- The previously observed one-minute checkpoint was not present when this new browser run began, so this pass does not attribute its absence to Abandon Run. Longer-tier/cross-session checkpoint retention remains deliberately unverified.

### All checkpoint horizons

- The checkpoint hook now has deterministic proof through a full hour for every service-defined horizon: 1, 5, 15, 30, and 60 minutes.
- Each horizon fires at the expected repeated cadence and always uses its stable slot key, proving bounded overwrite behavior rather than unbounded save accumulation.
- A state update halfway to the first checkpoint did not reset the timer, and the eventual snapshot contained the latest state. Disabled autosave and leaving exploration still cancel all checkpoint work.
- Together with the live one-minute Waystone creation and rendered history proof, the W01 Autosave tiers row is now verified. Browser-profile lifetime behavior remains part of broader resilience testing rather than this timer contract.
