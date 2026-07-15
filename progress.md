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

## 2026-07-11 combat-map shell continuation

- The design preview and playable combat screen now share independent roster and command-rail visibility controls.
- Collapsing the command rail keeps a compact turn strip beside the battlefield with the active actor, action/bonus/reaction state, movement remaining, a restore-panel control, and End Turn.
- The battlemap planmap shell node records the resolved turn-strip policy and asks whether map-focus mode should stay status-only or gain a compact favorite-ability affordance.
- Rendered proof now covers an enemy turn, a player turn, the wide one-row HUD, the narrow two-row HUD, and restoring the command rail. Both widths keep the strip inside the battlefield without horizontal or vertical overflow.
- Focused verification passes: CombatView responsive tests (5/5), compact-strip lint, planmap derivation tests, JSON parsing, dependency sync, and the repository sync check.
- Rail visibility now uses one shared, schema-validated preference. First use and invalid saved data show both rails; deliberate choices survive later combats; storage failures still update the current screen without crashing.
- Live proof hid the command rail, reloaded into the saved map-focus layout with the compact turn HUD intact, restored commands, and reloaded into the restored full layout with no console errors.
- Persistence verification passes: shared hook tests (4/4) and CombatView responsive tests (6/6), including a full CombatView unmount/remount.
- Desktop roster and command rails now have bounded, remembered widths. Mouse dragging, arrow keys, Home/End, per-rail double-click reset, and the toolbar's full panel reset share one layout contract.
- Responsive caps reserve the battlefield's share at desktop widths; below the desktop breakpoint the rails remain stacked and both resize handles disappear.
- Live proof dragged the roster from 230px to 294px without grid overflow, reloaded with 294px restored, resized commands from the keyboard, reset both widths to 230/300px, and found no errors on a clean page load.
- Resize verification passes: handle interactions (2/2), layout/persistence hook (7/7), and CombatView responsive behavior (7/7).
- Next: the owner can steer whether map-focus mode stays status-only or gains a favorite-ability affordance.

### Shared combat targeting intent

- The design-preview and playable combat shells now share one targeting HUD across 2D, 3D, and popped-out map modes. It names the armed ability, action cost, required target, range, caster, follow-up, and description without changing combat resolution.
- Targeting now has an explicit icon cancel action and a universal Escape path. Escape deliberately yields to focused inputs, textareas, selects, and content-editable prompts so combat cancellation cannot discard in-progress text interaction.
- Rendered proof armed Unarmed Strike in 2D, verified the HUD clears the zoom controls, switched to 3D without losing the armed intent, and confirmed the HUD remains mounted within the compact 390px composition.
- Focused verification passes: intent HUD tests (2/2), CombatView responsive tests (8/8), touched-file lint with no errors, dependency sync for all three shared consumers, and the repository sync check.
- Next targeting decision: invalid target clicks currently leave the ability armed and show the validation reason. The owner can keep that forgiving retry behavior or make invalid attempts cancel; automatic nearest-target snapping is not recommended because it can attack a creature the player did not choose.

### Armed ability command feedback

- The command tile that started targeting now remains visibly pressed with a crosshair and high-contrast ring, in both embedded and popped-out ability palettes.
- Pressing that same tile again cancels targeting. The map HUD cancel button and Escape remain available, so cancellation is reachable from both the command origin and the target surface.
- The large hover tooltip unmounts while its tile is armed because the map HUD now owns those details; this prevents two floating panels from covering the battlefield after a click.
- Both playable combat and the design-preview battle map return stacked layouts to the battlefield after a command is armed, keeping the target surface and intent HUD together on compact screens.
- The existing Plan Map targeting node records this as a completed interaction contract. Invalid-target retry versus immediate cancellation remains the only open targeting decision in this pass.

### Truthful map command toolbar

- The 2D map's Move / Attack toolbar was present in the DOM but painted underneath terrain tiles because its CSS-variable z-index resolved to `auto`. It now uses the shared numeric combat-overlay layer, and live hit-testing lands on the command button rather than the terrain beneath it.
- The validation-reason banner uses the same explicit combat layer and begins below the command cluster, so an invalid target explanation cannot disappear behind the board or overlap the controls it is explaining.
- Quick Attack no longer assumes `abilities[0]` is an attack. It preserves authored loadout order while selecting the first affordable direct main-Action attack, skipping spells, movement, area/bonus attacks, cooldowns, and depleted uses; it disables when no truthful shortcut exists.
- Move and Attack now use familiar icons and accessible pressed states. Quick Attack announces the exact attack it will arm, and pressing the armed shortcut again cancels targeting consistently with the ability palette.
- Focused verification passes 12/12 across the new selection and toolbar regressions plus existing 2D parity, visibility, and object-interaction coverage. Live 2D proof confirms z-index 400, topmost hit ownership, exact `Attack with Unarmed Strike` naming, and pressed-to-cancel behavior.
- Next command decision: keep the shortcut on the first ready direct attack in authored loadout order, remember the character's last explicitly used direct attack, or let the player configure a favorite. Remembering the last explicit direct attack is recommended; automatic highest-damage selection would make the command less predictable.

### Manual creator backtracking

- The resumed W01 pass reproduced a contradictory draft after Human -> Age -> Back: the sidebar retained Human while the detail pane and primary action reset to Fallen Aasimar.
- `RaceSelection.tsx` now initializes its viewed race from the parent creator draft. A focused regression passes 1/1, and live reload/backtracking restores both Human indicators consistently.
- Character Creator G24 is resolved. Continue the representative Human martial completion, then a spellcaster and a race with additional required choices before closing the manual-creation inventory row.

### Manual creator representative matrix

- Human/Soldier/Fighter completed with recommended point buy, Perception, replacement class skills, Defense, three weapon masteries, Savage Attacker, Tough, and a named start-town handoff.
- Fallen Aasimar/Sage/Wizard completed with three class cantrips, six spellbook entries, racial Light, configured Magic Initiate Intelligence/Wizard choices, duplicate filtering, and a named start-town handoff.
- Changeling/Criminal/Rogue completed with required Deception/Insight/Small choices preserved through Back, combined provenance badges, four replacement Rogue skills, two masteries, Alert, visible final size review, and a named start-town handoff.
- Character Creator G25-G28 are resolved. The manual creation inventory row is verified; next W01 work is game-over and not-found recovery.

## 2026-07-11 W02 dense-world and travel continuity

- The user-reported rounded `1 FPS` was reproduced on the populated opening/town path: a cold full-cast scene ran at 8.12 FPS, and a competing active 3D tab reduced delivered frames to 0.85 FPS.
- Player/cast/generated-body fields now use bounded resolution and update cadence; overview residents are nearest-first and capped; distant building shells skip inert frame work; normal-height play uses the near shadow cascade and aerial views restore the far cascade; ground DPR is bounded.
- Cold full-cast proof improved to 33.12 FPS with the intended three live generated bodies, town geometry, near shadows, and aerial far shadows intact. Focused World3D/entity coverage passes 23/23. World3D W3D-G30 is resolved.
- Cell discovery now persists exact IDs and dedupes. Live `[2497,2499,2498]` survived an explicit save and full Continue reload; later hostile routes added exact 2761 and 2371. Travel G7 is genuinely resolved after correcting its earlier read-only false closure.
- Direct cell-native travel opened Wolf combat at 2761. A one-day underprovisioned route toward 2370 stopped at the exact time-affordable cell 2371 after 1396.11 of 1670.54 minutes and opened two-Bandit combat. Travel G18/G20 are resolved.
- Ferry mode rejects water-lane endpoints without changing the player cell, accepts land/port endpoints, and no longer snaps identity ashore. Foot-only parties expose only walking; a mounted party adds horse travel. Travel G19/G21 are resolved.
- The Classic SVG atlas now supports named focus, real-neighbor arrow navigation, Enter/Space activation, and guarded pointer/touch pan-versus-pick handling. The 29-test AtlasSvgView suite and a live keyboard-only route selection/commit resolve Worldforge WF-G12.
- The hostile encounter also exposed missing Elara/Kaelen placeholder portraits. Canonical data now omits them, and both companion render boundaries filter the two retired paths from legacy saves while preserving real future URLs. Eleven focused tests and a live stale-Elara injection produced no avatar request or console error; Companions G9 is resolved.
- The owner registries, whole-game proof ledger, coverage inventory, tracker, and Planmap now agree. The focused W02 atlas/travel matrix currently passes 98/98; project-doc audit validates the touched Travel, Worldforge, Companions, World3D, and audit registries.
- Next W02 continuity targets are cardinal/out-of-bounds movement, legacy Submap reachability, exploration commands, and exact 2D-to-3D-to-2D geography return.

### Long Rest action continuity

- The live Long Rest modal described an eight-hour recovery but confirmed by dispatching the reducer directly, bypassing planar checks, overnight simulation, journal rollover, messages, and the explicit time advance owned by `handleLongRest`.
- Confirmation now travels through the same `processAction` pipeline as other Action Pane commands. Modal-authored racial choices survive that route and are merged with any planar-rest denials in the one mechanical rest action.
- Focused ActionPane, GameModals, and resource-action coverage passes 48/48. Live confirmation advanced the clock from 10:40 to 18:40, emitted the settle/world/awake messages, closed the modal once, and produced zero console errors.
- Action Pane G1 is registered, resolved, and linked in the whole-game audit and Planmap.

## 2026-07-14 world-derived battlefield north star

- The battle-map goal is now explicitly world-first: combat terrain, roads, water, vegetation, structures, props, occupants, and encounter framing should be a tactical projection of the same WorldForge facts that define the explored location. The context-free battle-map generator remains available only as an explicit developer sandbox.
- A first visual debugging harness is available at `misc/design.html?step=battlemaplab`. It deterministically rebuilds a real boreal cell and a generated settlement through the existing off-thread WorldForge worker, extracts the production five-foot referee grid, mounts the full combat shell, and shows source-world counts beside tactical counts and parity findings.
- `BattleMapData` can now retain WorldForge provenance. Both the lab and production fight-in-place handoffs attach World -> Region -> Local -> Ground -> Tactical lineage plus the seed, optional atlas cell, and world-meter crop anchor.
- The painted renderer keeps continuous texture, terrain treatment, lighting, and tactical readability, but WorldForge-provenance maps no longer receive a synthetic road, shoreline bushes/reeds, lily pads, rare landmarks, or random object-like tile scatter. Explicit GroundWorld-derived tile decorations still render normally.
- Deterministic projection and painter-policy coverage pass. The first lab scenarios expose real bridge gaps instead of disguising them: WorldForge roads do not yet have combat terrain/movement semantics, and visible world props/features do not yet publish spell-targetable object facts.
- The Plan Map now carries the scenario-lab goal, its first completed slice, the road reactivation, and three owner decisions: first proving-ground scenario, the discrete-object truth boundary, and production parity-gate strictness.
- A concurrent canonical visual-test-harness registry/runner is landing under `src/devtools/vistest` and `tools/vistest`. The battle-map lab remains the specialized semantic debugger and is explicitly routed into that shared registry instead of growing a second general-purpose capture framework.

### Road ambush tactical slice

- The earlier road-semantics gap is now bridged for regional routes and town streets. A source route segment crossing the local window survives even when both endpoints lie outside that window, and each intersected five-foot cell retains road role, run index, and authored width.
- Roads are layered surfaces over base terrain. Natural obstacles are cleared from source road footprints, structures and explicit props still override them, and water remains blocked until a source ford or bridge proves a crossing.
- The painter now draws only source-backed road cells. The canonical seed-42, cell-373 Road Ambush fixture contains one regional route, zero town streets, 469 road cells, and 469 traversable road cells.
- `BattleMapData.encounterContext` now carries the selected route anchor and normalized heading. The live combat setup realizes that context as a party traveling on the route with enemies split across off-road flanks and biased toward source cover; maps without a frame preserve procedural formations or use the true center of their extracted dimensions.
- The World Battle Lab is the rendered proof surface for this work. It now defaults to Road Ambush, fits the full board for review, reports the encounter frame and route counts, and shows a passing source-derived framing check beside the real combat UI.
- Focused verification passes 44/44 tests across extraction, projection, deployment, and painting. The canonical visual-test registry adds 10/10 passing contract tests plus a successful `combat-world-road-ambush` capture. Touched-file ESLint has zero errors, Plan Map validation is clean, and both 1920x1080 headed proof and 1600x1000 canonical capture show the diagonal route, three party tokens on-route, and four enemy tokens on both flanks. The only headed-browser console error is the existing missing `favicon.ico` request.
- Remaining bridge work is explicit: source props/features still lack `TargetableMapObject` facts; roads need an owner decision on movement cost; the visible road edge can be smoothed without changing exact referee cells; and river crossings, settlement edges, occupants, and encounter-world deltas remain future scenarios.
