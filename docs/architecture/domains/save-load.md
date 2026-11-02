# Save and load

Verified: 2026-11-02

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

The first admission supports one dry exterior body at its exact terrain height. Unsupported geometry, ambiguous sources, interior/deck/party positions and changed heights refuse before gameplay mounts. Refusal leaves storage untouched and returns the normal load error. Reconstructing a town population does not prove its current terrain or rendered world is compatible. Native load, actual ground play and save/full-reload conservation remain separate evidence.

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
