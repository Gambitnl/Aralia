Original prompt: Set a goal to make the start of the game playable. Think of core Concepts that should work first and the set the goal to run the game and try

## 2026-07-16 truthful and readable tactical elevation

- Direct user confusion exposed a semantic defect in the first elevation HUD: River Crossing displayed 22-50 ft while claiming the values were above a local low point. The source crop actually spans 28 ft, but its wider-world offset had never been removed from presentation.
- The battle map now derives its lowest sampled tile as map height 0 ft. Hovering separately labels the difference versus the selected/active creature and the tile's height above that map zero; directional badges replace bare plus/minus signs, and the contour legend says each line is a 5 ft rise.
- A 390x844 visual pass rejected the first revision because its explanation overlapped the zoom controls. Compact layouts now place the height panel above the zoom strip; desktop keeps the lower corner treatment.
- Permanent `combat-world-river-elevation` proof now requires a real zero-foot tile, non-flat relief, explicit comparison/map-zero/contour language, and no raw `Elev:` labels. Focused tests pass 27/27; touched lint has zero errors. G14 remains active only for unauthored cliff/slope, climb/fall, high-ground, and elevation-aware line-of-sight mechanics.

## 2026-07-16 WebGL 3D hostile-opening aftermath parity

- The resolved hostile-opening return now reaches WebGL 3D through one strict selector. It renders the exact saved terrain imprints, ecological traces, abandoned/disturbed activity site, heavy combat churn, and only the Goblin/Wolf outcomes that remain physically present; withdrawals never become static substitutes or initiative actors.
- Static remains were rejected as generic olive capsules. The accepted pass uses separate anatomy: the Wolf has a long quadruped chest, muzzle, ears, four splayed legs, and tail; the Goblin has a cloth torso, oversized green head/ears, four-limb spread, dark boots, and a detached salvage pack. Saved flattening, traffic, furrow, disturbance, and body zones suppress grass locally so the scene history is not buried by procedural blades.
- The first framebuffer was a severe false positive: a generic contrast probe accepted empty olive terrain because the deterministic camera aimed at `y=0` while the saved focus sampled `11.194`. The camera now supports explicit target height; the permanent scenario requires the ground-height fact, named Goblin/Wolf/site/disturbance roots, real pixel range, and different readbacks after camera movement.
- Ability mode no longer carries valid-movement fill underneath its own targeting layer. That removed the cyan wash which hid the Goblin/site cluster, while preserving faint grid and dedicated targeting decals.
- Harsh accepted-frame verdict: immediate 2D/WebGL outcome parity is now real and the two species are distinct, but this is not a living ecology. Grass is still globally uniform away from saved damage, churn remains diagrammatic, the grid dominates, active `CharacterActor` silhouettes are generic, WebGPU lacks the layer, and no later scavenger, weather, faction, or predator-pressure phase exists.
- Unusual next monster directions: make bodies and sites ecological clocks rather than static props; let carrion insects, silent birds, displaced herbivores, scavenger succession, faction retrieval, rain-washed transfer, and scent corridors evolve from saved time/weather. Let salvaged world props physically alter monster silhouettes and let feared predators create negative-space clearings before they are seen.
- Verification: 17/17 focused selector/3D parity/Vistest registry tests; permanent desktop framebuffer capture and ignored 1353x1272 constrained capture; full-page constrained browser review; Vistest named-mesh, pixel, and camera-motion gates; touched lint zero errors. Broad TypeScript still fails on the separate repository debt set and emitted no diagnostic in the touched aftermath files.
- Elevation review created G14: raw values such as `2`, `3`, or `4` are internal units, not player language. The planned replacement is selected-relative feet/levels plus contour bands, shaded relief, slope/cliff cues, and a waterline reference; raw units stay debugger-only.

## 2026-07-16 exact opening-combat outcome and adversarial aftermath proof

- Combat teardown now settles the exact saved hostile-opening scene before clearing combat state. Every final source enemy must match the receipt; the immutable result stores final HP, tactical/world position, downed/withdrew/holding-ground status, battle outcome, site condition, and combat disturbance. Missing, unrelated, mixed, or conflicting identities fail closed.
- A resolved receipt cannot restart the original fight. The explicit return projector removes withdrawals and keeps downed or holding creatures as physical map facts with no initiative, HP, targeting, or fallback enemy generation.
- The deterministic Opening Aftermath recipe proves one Goblin and the Wolf downed, two Goblins withdrawn, an abandoned disturbed cache, and heavy saved churn. Species-diverse outcomes deliberately replaced the weaker first-two-Goblins fixture; the Wolf uses a lateral collapse so it reads as a quadruped without diagnostics.
- Visual rejection log: enemy bodies left in initiative; one oversized brown puddle; bodies crushed into unreadable debris; a stale approach marker beside the party; movement overlay dominating the ecology; attack intent panel covering the site; two same-species bodies proving too little; and an upright Wolf that looked like a gray seed. The final 1600x1000 and 1353x1272 renders fix those failures, but are not flattering completion evidence.
- Harsh remaining verdict: the churn still looks diagrammatic, the Goblin competes with cache debris, the source terrain remains dark and checkerboard-heavy, and the constrained command/roster rails clip lower content. The scene needs consequences stranger than corpses: scavenger succession, faction retrieval, drag-off paths, insect or bird silence, rain-washed blood transfer, disturbed scent geometry, and avoidance halos that become saved world facts rather than decorative decals.
- Verification: 72/72 focused tests across seven files; permanent Vistest gate requires exact resolved facts, two physical bodies, no enemy roster roles, heavy disturbance, and abandoned site state; real-browser attack/cancel probe reports two bodies and zero console/page errors. Canonical Vistest capture is 1600x1000; the canonical runner now supports explicit `--width`/`--height` for the ignored 1353x1272 proof.
- Still open under G12-G13: broader WorldForge creature lifecycle, pursuit destinations, reinforcement and regrouping, pre-contact/weather/avoidance history, darkness readability, richer species/faction aftermath, and 3D body/terrain/outcome parity.

## 2026-07-16 source-authored occupation imprints and quieter movement range

- Hostile-opening v2 scenes now persist four exact terrain-memory facts in tactical cells and WorldForge meters: flattened ground beneath the cache, a repeated cache-to-contact traffic run, dragged-salvage furrows, and a nearby refuse scatter. Early v2 receipts gain those imprints without moving their existing bodies, traces, or activity site; the reducer upgrades the same receipt id in place.
- The 2D battle map renders those source facts below actors and loose objects. Abstract wind/leaf field signs were replaced by alternating physical tracks, a territorial soil scrape, and broken stems; the claimed cache now sits inside disturbed ground and material debris rather than on neutral terrain.
- Reachable movement keeps exact per-cell interaction and a crisp outer perimeter, but the interior tint drops from 20% to 7%. The legend now reflects that boundary-led treatment instead of advertising a solid green fill.
- Visual pass 1 was rejected because the new ground layer read as a black puddle with ruler-straight spokes and the track trail remained an interface connector. Later passes softened and textured the ground, curved traffic/furrows, removed the connector, and raised footprint contrast. Accepted proof: permanent `.agent/vistest/captures/combat-world-hostile-opening.png` at 1600x1000 and ignored `.agent/scratch/world-battle-ecology-final-1353x1272.png`.
- Verification: 55/55 focused scene/reducer/scenario/tile/render/Vistest tests, including explicit fail-closed proof for partial terrain memory; permanent capture readiness requires all four imprint kinds and the territorial scrape after `saved-replay`; ESLint has 0 errors and 14 established warnings; broad TypeScript still exits on separate repository debt with no diagnostic in the exact touched-file filter; Plan Map validation is clean at 160 topics / 522 features; Battle Map project audit and sync-check pass.
- Harsh remaining verdict: darkness still suppresses some subtle evidence, the current terrain memory is a frozen contact tableau rather than a changed ecosystem, pre-contact/weather/avoidance history remains absent, combat outcomes cannot alter the group or site, and 3D consumes neither body nor terrain-imprint facts. G12-G13 remain active.

## 2026-07-16 source-authored monster bodies and visible turn overflow

- Opening bodies now freeze posture, carried profile, and normalized facing beside exact world-meter position in the saved scene. Legacy receipts remain loadable; newly authored and replayed scenes retain the physical body facts through combat source identity.
- The 2D map no longer draws new opening monsters as role-ring portrait pins. It composes top-down miniatures from the source facts: upright salvage pack, crouched long tool, crouched buckler, rear load, low scout, and scenting beast silhouettes.
- Same-species proof is no longer label-dependent: the canonical three Goblins have visibly different occupied shapes and carried edges, while the Wolf reads horizontally as an animal body. Portrait art remains only a small head detail.
- Visual pass 1 was rejected because bodies were distinct but too dark and the turn strip still hid later actors. Pass 2 increased body/gear contrast and added explicit earlier/later controls that keep the current actor centered.
- Accepted visual proof: permanent 1600x1000 `combat-world-hostile-opening` capture and ignored 1353x1272 constrained capture. Both keep all four source bodies separated; the constrained layout retains body readability and a navigable turn strip.
- Verification: 102/102 focused tests across 14 files; permanent Vistest readiness requires four distinct postures and pack/tool/buckler geometry after `saved-replay`; touched lint has zero errors; broad TypeScript still exits on separate repository debt with no touched-file diagnostic.
- Harsh remaining verdict: the cache still looks placed rather than inhabited, spoor remains symbolic, checkerboard terrain dominates the scene, combat outcomes do not alter bodies/site, and 3D actors ignore the new body-state contract. G12-G13 stay active.

## 2026-07-16 persistent hostile ecology and saved replay

- Opening scenes now use a v2 receipt that freezes a claimed activity site, physical contents, age-banded traces, exact monster bodies, and the player crop anchor in WorldForge meters. Re-entry replays that receipt exactly or fails closed when geometry, roster, or identity drifts; matching v1 saves upgrade in place.
- The mounted production provider finds the latest matching saved scene. The Hostile Opening lab authors once, then deliberately re-enters through that production replay path and labels the result `saved-replay`; the permanent Vistest capture refuses an authored-only imitation.
- A strict replay test caught a real defect: disturbed vegetation had been authored on the blocking vegetation asset. The clue now occupies adjacent traversable ground, and replay failures identify the exact rejected ecological fact and reason.
- Visual iterations rejected a floating package icon, a dark and unreadable debris pile, role-badge clutter, and a constrained establishing frame that clipped the contact group. The accepted proof uses a physical crate/bedding/remains composition, fresh/recent/weathered trace opacity, badge-free role posture/crop/ring treatment, and a HUD-safe camera offset.
- Harsh verdict: the scene still is not visually convincing. Repeated Goblin portraits, pin-sized circular bodies, weak facing/watch direction, a context-poor cache, cryptic spoor, clipped turn order, and checkerboard terrain make it read as a tactical diagram instead of a lived monster territory.
- Unusual next directions must become source facts: downwind scent corridors, conspicuously untouched avoidance zones, carried salvage changing silhouettes, unilateral mud/blood transfer, silent wildlife ahead of a predator, lookout-height shadows, and feeding/resting poses that alter occupied space.
- Verification: 101/101 focused tests across 14 files; permanent 1600x1000 Vistest capture; adversarial 1353x1272 browser capture; ESLint 0 errors and 41 established warnings; broad TypeScript still fails on separate debt with no touched-file diagnostic.
- Still open: reconcile deaths, escape, pursuit, and reinforcements back into WorldForge; author pre-contact route history; integrate ecology into terrain; produce genuine same-species silhouettes without labels or colored outlines.

## 2026-07-16 opening threat entity scene and monster ecology

- Hostile openings now author one deterministic, save-backed WorldForge contact scene with exact monster world/tactical positions, a shared approach, contact-lead/left-screen/right-screen/scent-flanker roles, and source-positioned tracks, scent, and disturbed vegetation.
- Combat records that receipt before transition, binds source identities to the bestiary roster in stable order, consumes exact positions verbatim, and rejects stale/mismatched scene rosters instead of inventing a tactical formation.
- Screenshot pass 1 was rejected: Goblins were cloned green stamps, the Wolf was too dark, role letters looked like debug punctuation, clues looked like unrelated pins, and active-hero camera framing crowded the formation against the right edge.
- The accepted 1600x1000 and 1353x1272 passes use a brighter beast emblem, maneuver-ring/icon role choreography, source-role labels in roster and turn order, a connected track trail, distinct non-magical field-sign silhouettes, and a one-time establishing camera shot over party, monsters, and evidence.
- Permanent Vistest scenario `combat-world-hostile-opening` now blocks capture until the exact source-scene diagnostics, four role badges, four roster roles, ecological traces, and connected track trail are all rendered; its canonical 1600x1000 capture passes.
- Harsh review still rejects the presentation as complete: same-species faces repeat, badge clusters crowd the tokens, field-sign glyphs require interpretation, and checkerboard terrain dominates the physical story. The next pass should express monster intent through posture, watch arcs, wind, evidence age, and a persistent claimed-object/feeding/lair fact rather than another overlay color.
- Current proof: the final focused projection/provider/action/setup/reducer/scenario/UI/Vistest matrix passes 98/98 across 14 files; touched-file lint has 0 errors and 41 established warnings. Broad TypeScript still fails on separately tracked repository debt, with no remaining diagnostic in this slice's touched contracts.
- Still open: reconcile death/escape/pursuit/reinforcement outcomes back into WorldForge; author pre-contact route/evidence age; add persistent lair/feeding/burrow/trap or wounded-member facts; create true same-species silhouette/posture variation rather than relying only on shared portraits plus role overlays.

## 2026-07-15 generated-state patrol combat bridge

- The live GroundWorld can now emit a real `state-confrontation` when the player stands inside a generated settlement, that exact controlling-state standing is hostile, and WorldForge stationed a usable land regiment there.
- Event identity is deterministic by world seed, source cell, burg, state, and game day. A save-backed receipt prevents the same event from immediately replaying when 3D exploration remounts after combat; older saves load with an empty receipt list.
- State patrols have their own `settlement-state-patrol` encounter context, source faction, marker, and deployment label instead of masquerading as a local watch arrest. They still use the proven current-position party anchor and town-side interception formation.
- The World Battle Lab now includes `legium-state-patrol`, with a visibly labeled hostile-standing fixture and Vistest scenario `combat-world-state-patrol`.
- Screenshot pass 1 found two audit defects: the panel called a valid defending force a GAP because the live input was fixture-backed, and the tactical facts called the visible state-patrol frame None. Pass 2 separates force validity from live-input proof and reports State patrol explicitly; all three party tokens and four source defenders remain readable at 100%.
- Accepted proof: `.agent/scratch/state-patrol-pass2/combat-world-state-patrol.png` (ignored scratch path).
- Verification: focused union 58/58, legacy world-state load 2/2, Vistest registry 10/10, touched-file ESLint 0 errors (baseline warnings only), `git diff --check` clean, and touched-file TypeScript diagnostic filter clean. Broad `tsc -b` still exits 1 on unrelated repository debt.
- Open Plan Map decision: retain one patrol per settlement per day until combat outcomes can authoritatively change world standing/cooldowns, then consider an outcome-driven cadence.

## 2026-07-15 3D vegetation culling repair

- Ground-mode bushes could disappear while the camera panned because their worker-loaded instance matrices changed after Three.js had lazily cached the batch's aggregate bounding sphere at its initial transforms.
- The shared vegetation matrix writer now recomputes the instanced mesh bounding sphere only when a new scatter payload actually rewrites matrices. This preserves per-chunk frustum culling and the existing cache fast path.
- Focused tests pass 2/2. Live Playwright proof at world seed 42 / cell 476 covers both +/-72-degree orbit and +/-80 m horizontal pan with the low bush layer remaining populated and no console or page errors.

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

### Real river-crossing tactical slice

- Region generation now owns a durable road/river crossing receipt after both final centerlines are smoothed and clipped. The receipt identifies the route, river, exact point, orientation, span, width, and bridge-versus-ford decision so downstream views do not infer independent crossings from overlapping paint.
- Ground projects the same receipt into source-indexed crossing facts and a physical masonry bridge deck consumed by World3D. Tactical extraction retains water as the base terrain, suppresses unbridged road-over-water overlap, makes authored bridges normal-cost and authored fords difficult-cost, and publishes exact crossing provenance on every affected referee cell.
- The canonical River Crossing recipe is seed 42, atlas cell 853: one 44-foot regional highway, one approximately 193-foot river, one bridge, 479 passable water-backed bridge cells, and no town geometry. Its encounter context deploys the party and enemies deterministically on opposite walkable banks.
- The World Battle Lab accepts `scenario=river-bridge-crossing`, reports source bridges/fords and tactical crossing/passability counts, exposes a capture-visible `7 pass / 0 warn / 1 gap` parity summary, and is registered as `combat-world-river-crossing` in the canonical visual-test runner.
- Screenshot critique drove four revisions rather than accepting green structural tests: the 120x90 crop became an inspectable 80x60 board; redundant diagnostics were condensed; a stepped tan cell strip became one oriented, flat masonry span consistent with World3D decks; and enemy camera/inspect controls moved out of the name area.
- Focused verification passed the Region, Ground bridge, real scenario, deployment, painter, roster-camera, and visual-registry suites. The canonical 1600x1000 capture is stored only under ignored `.agent/scratch/vistest/`; touched-file ESLint has zero errors. The repository-wide TypeScript check still reports established unrelated debt, while a touched-file filter is clean.
- The remaining visible parity gap is deliberate and actionable: WorldForge props/features still do not publish `TargetableMapObject` facts. Open owner choices are whether fords stay deterministic difficult terrain or gain Athletics risk, whether destroyed bridges persist as world deltas that invalidate traversal, and whether targetable source props should be the next canonical scenario before settlement edges.

### Source-object tactical parity slice

- GroundWorld natural features and authored props now project into deterministic `TargetableMapObject` facts with source kind, source id, world-meter position, tactical footprint, display name, and the mechanics the source can actually prove. The canonical Legium crop contains 98 natural-feature anchors and 298 prop footprints; source precedence leaves 51 feature targets visible while all 298 prop footprints receive tactical targets.
- Spell targeting is conservative at incomplete fact boundaries. General object targeting can use the projected props, but filters requiring a loose object or a known weight reject the 298 props whose catalog does not yet author attachment and weight instead of treating unknown as eligible.
- The World Battle Lab now includes an independently toggled object-facts overlay, source-versus-tactical counts, incomplete-fact warnings, and the full combat shell. Deterministic WorldForge initiative removes random active-turn drift from repeated captures, the command rail initializes at Turn Order, and the diagnostics layout moves below the board before it would compress the battlefield beyond useful inspection.
- Screenshot review caught and corrected three defects that structural tests did not: a 1353-pixel viewport devoted most of the frame to empty diagnostic width, the command rail opened with Turn Order clipped, and the critical incomplete-object warning sat below the initial viewport. Final 1600x1000 and 1353x1272 proofs are stored only under ignored `.agent/scratch/vistest/`.
- Focused verification passes 77/77 tests across extraction, object registration, spell filtering, initiative injection, combat rendering, scenario parity, and visual-registry contracts. A 7,316-test repository run initially found two older targeting fixtures that called objects loose without authoring `isFixedToSurface: false`; those fixtures now state the fact they intend to test. The remaining full-run failures are unrelated roadmap test-environment, raw-button debt, TownPlan golden-count drift, and loaded-suite timeout issues. Touched-file ESLint has zero errors, Plan Map validation is clean, and the repository-wide TypeScript check remains an established debt surface rather than proof for this slice.
- Recommended next scenario is a settlement edge with occupants so the harness has to prove structures, population provenance, encounter framing, and combat UI together. Before weight- or mobility-restricted object spells can claim parity, the prop catalog should explicitly author fixed/loose state and weight; stale natural features should be reconciled in shared Local/Ground facts rather than hidden only in Tactical.

### Settlement-edge occupant tactical slice

- The canonical `legium-settlement-edge` recipe now anchors an 80x60 tactical crop on Legium's real western gatehouse at 17:15. Forty-five source buildings and one of three source gatehouses touch the crop; the normalized gate-to-town heading drives party deployment outside the boundary and defender deployment inside it.
- The same live fractional-clock schedule used by the 3D ground scene now crosses the fight-in-place handoff. The fixture retains all 94 in-crop resident identities, including four moving residents, groups them into 38 visible tactical cells without deleting people, and freezes that snapshot for the encounter.
- Residents remain explicit ambient world facts rather than counterfeit player/enemy combatants. Their cells are reserved during source-aware and fallback deployment. Meter-to-grid rounding initially put 43 residents on walls or blocking props; screenshot diagnostics exposed that false state, and extraction now deterministically snaps only the tactical marker to the nearest walkable cell while retaining exact source meters.
- The World Battle Lab gives resident and object facts independent layer controls with scenario-specific defaults. A zoom-compensated gate receipt marks the exact source anchor and inward direction, resident parity and clock counts stay above the fold, and the canonical visual registry adds `combat-world-settlement-edge` with an explicit URL instead of relying on preset order.
- Screenshot review iterated across 1600x1000 and 1353x1272 captures: unrelated cyan/amber pins no longer bury residents, blocked placements fell from 43 to zero, the gate reason for the crop became visible, and the final receipt was lifted off the deployed tokens. The only browser console error remains the existing missing `favicon.ico` request.
- Focused verification passes 68/68 tests across Ground extraction, real scenario projection, source-aware deployment, resident/source-anchor DOM rendering, the 3D handoff, and visual-registry contracts; the post-snap Ground and scenario subset passes 38/38. Touched-file ESLint has zero errors. Repository and narrowed dependency-graph TypeScript checks remain blocked by established unrelated combat/spell and Vite-plugin debt, with no reported error in the files changed for this slice.
- Next steering choices are whether settlement defenders must come directly from generated guard/faction/hostility facts, and whether residents become inspect-only identity/activity markers before full neutral fleeing, harm, allegiance, and rescue semantics exist. Source-derived defenders and inspect-only residents are recommended.

### WorldForge regiment defender tactical slice

- Generated settlement-defense facts now cross the atlas-to-Ground boundary. Legium is retained as Turino's walled capital with a citadel, state alert 4.25, the 4,565-troop 1st (Legium) Regiment, and its separate 15-vessel fleet; the land regiment's exact 2,299 archers, 1,882 infantry, 323 cavalry, and 61 artillery remain inspectable.
- The named `gate-patrol-alert-sample-v1` policy makes the scale reduction explicit. Rounded state alert produces a four-actor budget, source proportions produce two archers and two infantry, and the standard Scout/Guard bestiary bridge supplies real combat mechanics. Every actor carries stable burg/state/regiment/unit provenance.
- Cavalry and artillery remain visible exclusions because mounted actors and siege-engine objects do not yet have honest tactical semantics. The scenario also labels hostility as recipe-authored: WorldForge proves the Turino force exists, but does not yet prove a hostile player-to-faction relationship or encounter trigger.
- Screenshot pass 1 was rejected despite passing data contracts. Every Turino defender inherited the generic enemy-orc emblem, and the initiative strip shortened all four to the identical label `Turino`, contradicting the source faction and erasing military role at the primary glance surface.
- Screenshot pass 2 replaces the false species portrait with a neutral regiment weapon emblem and uses `Archer 1`, `Archer 2`, `Infantry 1`, and `Infantry 2` in the turn strip while preserving full faction-bearing names in the roster and accessible labels. The diagnostics rail shows state, stationed troops, selected regiment, alert, tactical sample, exclusions, and the hostility gap above resident/object detail.
- Rendered review passes at 1600x1000 and 1353x1272. The narrower layout moves diagnostics below the battle shell rather than compressing the 80x60 board; no material overlap, clipping, unreadable role label, or source-marker/token collision remains. The only browser console error is the existing `/favicon.ico` 404.
- Next steering choices: require an explicit encounter trigger or player-to-faction relation before production can mark a generated regiment hostile; preserve residents as inspect-only ambient facts until neutral behavior exists; and build mounted/siege semantics before projecting cavalry or artillery tokens.

### Settlement defender hostility authority slice

- Generated military presence is no longer sufficient to create enemy actors. The `explicit-trigger-plus-matching-relation-v1` rule requires a current watch/state confrontation plus either a witnessed crime in the matching canonical settlement location (`cell_829` for Legium) or a hostile player standing with the matching generated-state faction (`worldforge-state:14` for Turino).
- Missing triggers, hostile standing without a current confrontation, and wanted records from another atlas cell all return `withhold-combat`. The source regiment and patrol projection remain inspectable context, but `createWorldDefenderCombatants` refuses to promote them into the enemy team.
- Settlement-defense facts now expose the burg's canonical atlas cell directly, joining the WorldForge source record to the same cell-native identity used by player location and crime state instead of inferring location from a tactical token or display name.
- The deterministic Settlement Edge visual scenario opts into a clearly labeled witnessed-assault fixture so the real combat UI can exercise a hostile watch confrontation. Diagnostics show the trigger, player-state relation, verdict, authority rule, and a separate gap stating that production fight-in-place does not yet pass live crime/faction state; the fixture is not a fallback.
- Screenshot pass 1 was rejected because the Defending Force panel advertised a green `PASS` while its live player-state input still showed `GAP`, allowing the primary hierarchy to conceal the production hole. The panel summary now aggregates source, hostility-authority, and live-input checks and correctly reports `GAP`.
- Screenshot pass 2 passes at 1600x1000 and 1353x1272. The desktop rail keeps the full hostility receipt readable above resident facts; the narrower layout moves diagnostics below the unobscured combat shell while retaining the gap in both the parity summary and force header.
- Focused verification passes 79/79 across settlement source facts, hostility resolution, patrol projection, real bestiary combatants, WorldForge scenario parity, source-aware deployment, object/resident rendering, initiative identity, and Vistest registry contracts. The canonical Vistest capture waits for the hostile verdict, visual-harness trigger, matching witnessed crime, and real Turino actor roster before taking evidence.
- Next steering choices: wire the production fight-in-place caller to current `GameState` crime and generated-state standing inputs; preserve residents as inspect-only ambient facts until neutral behavior exists; and build mounted/siege semantics before projecting cavalry or artillery tokens.

### Live GameState settlement-watch handoff

- Wanted-watch dialogue now asks the mounted WorldForge GroundWorld to prepare combat at the player's exact current meters. The provider extracts the live terrain and occupant snapshot, matches the confrontation to the generated settlement defense, supplies current witnessed-crime records and the matching `worldforge-state:<id>` standing, and preserves the regiment-derived combatants through the normal encounter launcher.
- A new `settlement-watch` encounter frame distinguishes an arrest at the player's current position from the harness's gate-approach recipe. The lead party member stays on the nearest legal center cell, companions gather behind, and the watch intercepts from the settlement side without occupying ambient resident cells.
- The generic two-Guard encounter remains only for static authored towns or interactions with no applicable generated settlement. A mounted generated settlement that withholds hostility or lacks a defense bridge surfaces that gap instead of silently substituting unrelated enemies.
- The deterministic lab adds `scenario=legium-watch-interception` and canonical Vistest id `combat-world-live-watch`. Its crime evidence remains explicitly labeled `visual-harness`; the diagnostics correctly retain a live-input GAP even though the recipe exercises the production framing and deployment path.
- Screenshot pass 1 was rejected because 248 violet resident markers and 24% whole-map fit hid the engagement. Pass 2 removed resident clutter but still reduced the actors to tiny marks. Pass 3 opens the watch recipe at 100%, centers the active party, lifts the source receipt, and visibly shows all four Turino defenders approaching without overlap or clipping. Final paired captures also confirm the resident-focused Settlement Edge recipe did not regress.
- Focused verification passes 60/60 across the production projection, runtime provider lifecycle, wanted-watch routing, prepared combatant preservation, deployment, real scenario harness, World3D loader, and canonical Vistest registry. Touched-file ESLint has zero errors; its warnings are established raw-button/legacy World3D/type debt. Repository TypeScript still exits on unrelated baseline diagnostics, with no changed-file diagnostic after the provider-union fix.
- Remaining steering choices are unchanged: keep residents inspect-only until neutral combat semantics exist, and implement mounted/siege rules before cavalry or artillery become tactical representatives.

### Production battlefield authority boundary and encounter inventory

- Production `CombatView` no longer treats an absent extracted map as permission to call the legacy arena generator. `generateWorldBattleSetup` requires real `BattleMapData`; procedural construction is isolated behind `generateProceduralSandboxBattleSetup` and the explicit `?dev_combat=1` / BattleMapDemo developer surfaces.
- Encounters that provide actors but no WorldForge location now fail closed in a dedicated `BattlefieldSourceGap` state. The combat board and initiative do not mount, combat AI receives no actors, and the only command returns safely to the world. The `?dev_combat_source_gap=1` fixture exists solely to prove this boundary.
- Rendered inspection passed at 1600x1000 and 390x844: the missing WorldForge projection and withheld procedural fallback are readable above the fold, no combat affordance leaks through, the return action remains reachable, and there is no clipping or overlap. Captures remain under ignored `.agent/scratch/`; console noise is limited to the established favicon 404, missing local AI credential warnings, and generic dev-fixture monster warnings.
- The focused authority matrix passes 32/32 across world/procedural setup separation, source-gap rendering and safe return, encounter actor preparation, and reducer map preservation.
- `docs/projects/battle-map/WORLDFORGE_SOURCE_INVENTORY.md` now audits every known tactical entry path. Ground hostile proximity, generated-settlement wanted watch, and generated-state patrols are migrated. Land travel, hostile openings, static authored-town watch, sea encounters, and location-free encounter simulation are explicitly withheld rather than silently receiving terrain. Procedural combat, the source-gap fixture, fight-in-place probes, and the World Battle Lab are separately labeled developer paths.
- The next highest-value migration is the land-travel ambush: its destination atlas cell and deterministic actor receipt already exist, while the Road Ambush lab recipe already proves the desired source-route crop and deployment. Production still needs to assemble that exact destination through World -> Region -> Local -> Ground -> Tactical and attach the travel-event receipt before combat transition.

### WorldForge-backed land-travel ambush handoff

- Committed land-travel encounters now retain their encounter kind and exact route-cell receipt. On arrival, `App` rebuilds the destination GroundWorld from the saved world seed, game time, and WorldForge deltas through the complete Stage-B worker result before it starts combat.
- `createTravelAmbushBattlefield` selects the nearest real road in that destination cell, extracts the existing 80x60 road-ambush projection, verifies exact cell and road-anchor provenance, and appends the travel-event route receipt to the generation path. Missing seed, destination, complete GroundWorld, or source road returns an explicit source gap; none of those cases receives a center crop or procedural arena.
- The one-shot WorldForge loader now resolves only the complete Stage-B world, disposes its worker after success or failure, and forwards worker crashes to active callers before teardown. Focused lifecycle tests cover completion, source rejection, and worker failure.
- `?dev_travel_ambush=1` is a deterministic source-backed trigger, not a second implementation. It sends seed 42, destination cell 373, route cells 112/201/373, and three Bandits through the same loader, projector, encounter action, reducer, and production `CombatView` used by committed travel.
- Rendered review at 1600x1000 and 1353x1272 shows the diagonal source road as the encounter spine, the party gathered on-route, and three enemies split across source terrain on both flanks. The desktop composition stays balanced; the narrower/taller viewport retains readable rails, board controls, token separation, and the route-heading receipt without overlap or clipping. Its larger open foreground is source-authored terrain rather than a synthetic fill. Browser console output has no application/runtime error; only the established missing `favicon.ico` request and local AI-key warnings remain.
- Focused verification passes 61/61 across complete GroundWorld loading, travel projection/refusal, land and sea travel metadata routing, encounter setup, combat source boundaries, responsive rendering, and reducer persistence. Touched-file ESLint has zero errors; the new hook dependency warning was removed by passing only the canonical seed/time/delta fields. The repository-wide TypeScript check still exits on the separate known debt surface, while its output contains no diagnostic for the touched battlefield/travel files.
- The production inventory now counts road-backed land travel as the fourth migrated class and keeps roadless land travel visibly withheld. Hostile openings, static authored-town watch, sea encounters, and location-free encounter simulation remain the next audited source gaps.

### Player-readable tactical elevation

- River Crossing exposed 4,800 raw floating-point `elevation` values ranging from `22.843...` to `51.063...`. Audit traced the real contract: the tactical patch stores WorldForge relief metres divided by `0.3`, while WebGL multiplies by `0.3` to recover vertical metres. One shared config constant now drives extraction, 3D terrain, and the 2D player conversion.
- Tile labels no longer show renderer units. They state rounded whole feet above, below, or level with the active creature and retain rounded relief above the generated local low point. Hovering any tile leaves an unscaled terrain HUD visible outside the fitted board; raw values remain absent from player titles and accessibility labels.
- The ground painter adds smoothed directional hillshade and interpolated five-foot contour segments. Relief renders beneath source roads, water, bridge decks, props, bodies, fog, and interaction overlays, preserving tactical and WorldForge hierarchy instead of drawing a debug layer over combat.
- Visual pass 1 was rejected because contours were too quiet and the deterministic probe selected an off-edge tile. Pass 2 increases contour/hillshade contrast and chooses a visible interior raised tile. Accepted 1600x1000 and ignored 1353x1272 River Crossing captures keep the bridge dominant, the readout legible, and controls/legend unobstructed.
- Focused elevation, tile, painter, and Vistest suites pass 32/32. A real-browser proof reports 4,800 semantic tiles, zero raw `Elev:` titles, the five-foot contour legend, a raised relative readout, and zero console/page errors. Touched ESLint has zero errors; repository TypeScript still exits on the established unrelated debt set.
- G14 remains active rather than overstated: source-backed cliff edges, slope direction/risk, climb cost, and elevation-aware line of sight still need referee semantics and a steep deterministic WorldForge proof scenario.

### Static authored-town watch source-gap closure

- The legacy wanted-watch fallback no longer creates two generic Guards when no mounted generated-settlement provider applies. It starts a structured authored-town source gap containing the encounter, requested authored location, and missing WorldForge cell, settlement-site, and tactical-projection facts, with no monsters, combatants, source identities, or map.
- `handleStartBattleMapEncounter` treats a declared source gap as a strict state contract and rejects any payload that also carries actors or terrain. `CombatView` presents the exact reason, explicitly reports `Enemy roster: Not fabricated`, withholds the board and combat rails, gives combat AI an empty actor list, and exposes only safe return.
- Permanent Vistest `combat-world-authored-town-watch-gap` sends the fixture through the real application action, reducer, and production `CombatView`, not a component-only mock. Its readiness gate requires the exact source-gap code, all missing facts, no Turn Order, and no End Turn.
- Focused verification passes 51/51 across launcher, action, rendered boundary, and Vistest registry contracts. Adversarial 1600x1000 and 390x844 screenshots keep every fact readable and the return action above the fold with no board, roster, combat affordance, overlap, or clipping.
- G9 is complete under its explicit alternative: authored towns are still unmapped and therefore unsupported, but the application no longer invents a roster or arena.

### Remaining unsupported production launcher closure

- `useSeaEncounter` still consumes each hostile voyage event exactly once, but it now sends only `sea-encounter-no-worldforge-battlefield`. The proposed naval roster never becomes combat state; the diagnosis names the absent sea surface, vessel deck, relative headings, weather, and boarding context.
- EncounterModal still lets players build AI-generated, custom, and bestiary proposals, but `Simulate Battle` now sends only `location-free-simulation-no-worldforge-location` until a canonical cell, crop anchor, and encounter-to-location receipt are explicitly selected. The current game location is not silently assumed.
- Both launchers share production reason builders with deterministic application fixtures and cross the normal action, reducer, and `CombatView`. The strict source-gap boundary continues to reject any payload that combines a diagnosis with monsters, combatants, source identities, or terrain.
- Permanent Vistests `combat-world-sea-encounter-gap` and `combat-world-location-free-encounter-gap` require exact reason codes and omitted facts, `Enemy roster: Not fabricated`, no proposed enemy names, no Turn Order, and no End Turn before capture.
- Focused verification passes 46/46. Adversarial 1600x1000 and 390x844 captures for both states retain readable hierarchy, every missing fact, and safe return above the fold without a board, combat rail, overlap, or clipping.
- G10 and G11 close as deliberately unsupported rather than falsely migrated. The production encounter inventory now has no open or unaudited launcher class: each known class is source-backed or has deterministic fail-closed proof. The broader goal remains active for G12-G14 monster-world lifecycle, renderer parity, and steep-terrain semantics.

### Elevation comprehension rework after direct user confusion

- The prior River Crossing HUD was truthful but still failed comprehension: it showed a tile-relative value and a map-zero value as separate prose rows, leaving the player to infer why one tile could be both `19 ft` and `8 ft higher`.
- The inspector now places `This tile`, the selected creature, and `Map floor 0 ft` on one visible ruler, then states the relative result. Relative feet are calculated from the two displayed whole-foot heights so rounding can never make the shown subtraction disagree.
- The first new visual pass was rejected because translucent water contaminated the panel and the explanation line was too faint. The accepted pass uses an opaque background, stronger type, and the shorter persistent legend `Elevation: floor 0 ft | contour step 5 ft`.
- Focused elevation/tile/Vistest coverage passes 29/29. Permanent `combat-world-river-elevation` captures pass at 1600x1000 and 1353x1272 with no panel/control/legend collision; direct 989x1032 inspection also remains coherent. The browser console reports zero errors.
- A separate 390x844 audit invalidated the earlier mobile claim: the workbench and lab headers reduce the map-bearing combat grid to an approximately 90px nested scroller. The elevation panel itself fits its width, but the whole harness cannot provide honest mobile visual proof. This is now G15 and needs a compact full-canvas lab mode.

#### Pause handoff - 2026-07-16

- Paused at the user's request after the elevation comprehension slice was implemented, documented, and visually accepted. Do not redo this slice on resume.
- Proven now: 29/29 focused tests; permanent `combat-world-river-elevation` Vistest passes at 1600x1000 and 1353x1272; direct 989x1032 inspection passes; browser console has zero errors; touched ESLint has zero errors and seven established raw-button warnings; Plan Map validation, living-project audit, sync-check, and diff-check pass.
- The full repository TypeScript check still fails on the separately routed debt set. A second narrowed run intended to prove zero diagnostics in the touched elevation/Vistest files was explicitly terminated when the pause request arrived, so that narrow proof remains the first verification step on resume.
- Current goal remains active. G14 still owns source-authored cliff/slope mechanics, G15 now owns the collapsed 390px World Battle Lab viewport, and the previously planned G13 active-WebGL monster body-state parity slice has not been implemented in this elevation turn.

### Terrain-aware 3D camera spawn

- The World Battle Lab 3D camera had retained its original flat-board assumptions: it looked at `y = 0` and spawned at a fixed `y = 10`, even though WorldForge terrain can be substantially above that plane. Elevated scenarios could therefore begin with the target, and sometimes the camera itself, inside the ground mesh.
- Both WebGL and WebGPU now sample the shared terrain heightfield at the map anchor and at the physical spawn coordinate, then start ten world units above the higher surface. Camera focus, cinematic framing, and deterministic capture poses use that same sampler, so later camera actions cannot reintroduce the below-ground aim point.
- Focused BattleMap3D/WebGPU tests pass 4/4. A live Legium Watch 3D first-frame inspection is visibly above the terrain and road surface; the only browser console error is the existing missing favicon request. Touched-file ESLint has no errors and `git diff --check` passes; its 20 warnings are established legacy warnings in these renderer/test files.
