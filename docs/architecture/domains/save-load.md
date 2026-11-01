# Save and load

Verified: 2026-10-28

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
