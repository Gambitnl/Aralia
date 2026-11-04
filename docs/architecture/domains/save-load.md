# Save and load

Verified: 2026-11-03

## Loaded player conversations

Before LOAD_GAME_SUCCESS clears transient activeConversation, appState archives any saved delivered transcript through the existing companion archive helper. Loading does not reopen the interaction or replay speech, semantic summarization, approval or consent effects. Unsent component-local drafts are outside that transcript and need separate preservation.

One original-campaign emergency recovery, cold startup and normal Continue Journey now reach the existing Memories view with the six delivered lines intact. This is actual load/display evidence. A fresh named save and second full reload, exact protected-state comparison and native End-summary behavior remain open. [NPCs and companions](npcs-companions.md#exact-player-conversation-transcripts) owns archive identity and future-recall rules; the [issue handoff](../../projects/gameplay-flow/ISSUE_HANDOFFS.md) owns played evidence and unresolved gates.

## Historical companion-party admission

An unversioned observed town is admitted only through independently matching retained layout and terrain recipes. Each joined companion must have a retained arrived journey, arrival memory and same-world current body. Every body then passes the same exact dry exterior support checks; membership never places an NPC beside the player. Interior/deck and unplaced-party cases remain explicit refusals. The optional producer observer reports independent source results without choosing one or mutating the save.

Load failures now set the existing persistent global error after the main-menu phase transition, which clears older errors. Retry clears that banner first. A short toast remains supporting feedback. Actual Sedanes return admission is still unresolved; it preserves all40 records and is not positive reload evidence. See gameplay-flow/TRACKER.md, Actual Sedanes return and preserved source refusal.

## Authority and storage

`src/services/saveLoadService.ts` is the public service entry point. Its
`saveLoad/` modules own payload I/O, storage startup, slot metadata and legacy
normalization. IndexedDB holds primary payloads when available. localStorage
remains the fallback and holds metadata and synchronous emergency saves.
The existing payload version, checksums, slot IDs and recovery policy remain
authoritative. See `src/services/saveLoad.README.md` for the service reference.

## Cold startup

`saveStorageInit.initializeStorage` shares an in-flight backend check and
emergency recovery/migration pass. `saveLoadCore` waits for that pass before
loading or saving. An unknown backend is still starting; it is not a decision
to read an older localStorage copy. A completed unavailable check retains
the established localStorage fallback.

The wait includes pending recovery after availability becomes known. Explicit
later initialization remains possible; the shared promise covers only a
currently running pass. Slot listing remains synchronous and does not replace
payload readiness.

## Evidence and limits

Actual travel play exposed immediate Continue loading Chernov at 40 GP while
the newer manual IndexedDB record retained Putivl at 16 GP. Explicit normal
manual loading recovered the earned journey. The controlled regression first
reproduced the premature legacy read and duplicate startup probes.
Five cold-start tests and 47 existing save-service tests pass after repair.
Actual normal Save Game, full reload and immediate Continue now retain Putivl,
16 GP, 10 HP, eight accounts and the exact accepted ground position while the
older localStorage copy still contains Chernov and 40 GP.
Gameplay replay and remaining travel continuity are recorded in
`docs/projects/gameplay-flow/TRACKER.md`.

This readiness fix does not alter save selection, terminal-outcome policy,
dungeon visit restoration or world geometry. Those owners must prove their
own persisted state and actual full-reload behavior.

## Historical town source admission

Before a played unversioned town loads, saveLoadCore asks the existing one-shot world-generation worker to qualify its source. Retained building observations or saved businesses in the current cell trigger this check. The producer compares independent layout readers, every founding identity and dated later birth, current homes, saved business and keeper joins, recorded doors, paid rooms and remembered building accounts. Observed foundations must still match exactly. An exterior save from before foundation capture can qualify by a unique complete population match plus the same joins; it does not acquire a fabricated building observation.

Reader4 preserves the earlier cell-affine road inputs alongside the retained town algorithm. Reader1 retains its separate protected recipe, reader2 remains the current default, and rural reader3 remains explicit. The selected revision is metadata in existing TownSim; it never regenerates saved people, purchases, history or accepted feet. All historical alternatives must participate, so omitting one cannot manufacture a unique match.

Historical admission supports a dry exterior party only when every saved companion has a same-world arrived journey, retained arrival memory and independent exact dry support. Unsupported geometry, ambiguous sources, interior/deck positions, missing/remote companion placement and changed heights refuse before gameplay mounts. Refusal leaves storage untouched and returns the normal load error. Reconstructing a town population does not prove its current terrain or rendered world is compatible. Native load, actual ground play and save/full-reload conservation remain separate evidence.

## Independent terrain identity

`worldforgeTerrainRevision` is independent of each town's layout identity.
New worlds record terrain2; terrain1 retains the recovered earlier Region
recipe. Unknown old terrain must qualify independently rather than inherit a
reader from its town or save date. Known identities cannot change during load.
Current dry historical-town admission requires exactly one terrain/layout join
covering the saved population, source observations, business/room joins and
exact physical support. Its transaction adds metadata only, persisted by an
ordinary subsequent save. Ground workers, Atlas/Local reconstruction, travel
and rest queries consume that same explicit terrain identity and cache it.

The original Kodok campaign now passes native manual admission and rendered
bank reentry with exact accepted feet. Its normal metadata save and full document reload now preserve all35 checked gameplay groups, source identities, message prefix, nonrolling saves and exact native feet. The first replay encountered pending emergency recovery during F: capacity exhaustion. A separate regression proves that an aborted save transaction must reject rather than leave startup pending; the writer now handles that event while retaining the original emergency payload on failure. The successful native replay does not prove abort caused the earlier wait. See the owning gameplay tracker and ADR0015. This admission does not qualify every old wilderness/interior save or
freeze all downstream architecture, household and water algorithms.

## Recorded destinations before a new arrival

The normal map-travel hook calls prepareHistoricalTownArrival before movement, time, provisions, fare or forced-march rolls. It reuses the historical layout, founder/birth, building, business, keeper and remembered-place checks for the destination. A saved village population is evidence even without a merchant or observed interior. Failure or an exception leaves the journey uncommitted and gives a visible message.

An arrival has no destination body yet. Its transient receipt binds the qualified layout and explicitly selected new-scene terrain to the existing town, people, businesses, clock and world. MOVE_PLAYER rechecks that receipt and commits only source metadata alongside ordinary movement. Normal ground entry then chooses supported arrival positions. No source receipt admits, migrates or repositions an already saved body. Existing load admission retains all exact-body checks.

The actual Sedanes replay records layout4/terrain2, preserves all319 people and survives a full document reload with32 checked gameplay groups exact. Its original mixed-source return remains protected and unsupported. Node and browser generation outputs differ for this world; a Node-only roster count cannot override native source evidence. The owning gameplay tracker records exact copy lineage, clocks, archive preservation and remaining gaps. Synchronous legacy-source preparation and other direct entry callers still need separate coverage.


## Rolling scheduler ownership

The exploration autosave hook keeps one ten-second interval while eligible and reads the latest state through a ref. A cancellable zero-delay first save is separate from that cadence. One-second clock updates no longer tear down and re-arm the rolling timer. The pre-combat transition checkpoint waits for an in-flight rolling save before writing its own captured transition. Recovery tiers keep their existing independent intervals and stable slot keys. Save serialization, manual/named saves, dice-counter policy and storage authority remain in the existing save service.

Seven focused scheduler tests and the parent scoped typecheck support this implementation. Four mocked rolling calls over 30 seconds are fixture evidence, not measured IndexedDB writes. Actual persistence cost, notices, transitions and full reload remain pending permitted native gameplay. See the companion ISSUE_HANDOFFS.md record for that evidence boundary.
