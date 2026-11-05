# 0016: Retain historical foundation grids in saved source profiles

Date: 2026-11-04

Status: Implemented; explicit-source proposal validated. Regional choice and native recovery remain open.

## Decision

Extend the existing `worldforgeTerrainRevision` identity with complete regional
terrain and foundation-grid combinations. Do not create another save store or
infer a source from the town number, save age or a nearby matching point.

| Source | Regional generator | Building foundation grid |
|---|---|---|
| 1 | Retained regional reader 1 | Current height nodes |
| 2 | Current regional reader 2 | Current height nodes |
| 3 | Retained regional reader 1 | Retained cell centers |
| 4 | Current regional reader 2 | Retained cell centers |

Keep the meanings of sources 1 and 2 unchanged. New generation still defaults
to source 2. Sources 3 and 4 carry their identity on the transient Region so
the normal ground builder, worker, Atlas reconstruction and rest queries use
the same foundation recipe. Cache identities must distinguish all four sources
without changing generation seed paths. Existing source 1/2 Region artifacts
retain their prior shape.

Unversioned source admission compares the supported profiles independently.
If more than one complete profile qualifies, refuse selection. A matching
foundation does not select a regional history. Existing explicit source IDs
cannot be replaced during admission, and source receipts still require ordinary
saving before any metadata reaches storage.

## Evidence and limits

The retained `flattenBuildingTerrainPads` function at Git220b4db23 differs from
the current function only in its grid argument after comments and formatting
are removed. The source comparison and disposable one-argument experiment are
recorded in the dungeon domain. The retained grid reproduces Sana's saved
return height to 3.85e-13 meters without moving the body; the current grid is
7.28 centimeters lower. Both regional readers match at that point, so the
experiment does not authorize a regional source choice or campaign recovery.

No global pad rollback, height tolerance, old whole-save import, NPC identity
rewrite or reward migration follows from this decision. Source tests, actual
source qualification, rendered adoption, ordinary save and full reload remain
separate claims. The complete dungeon expedition goal remains open.

The affected checks pass 80 distinct cases across five test files; all 11
changed TypeScript files report zero errors and zero suppressed imported errors.
The normal source-loading service and real worker validate a disposable native
payload copy under explicit source 3. With the source absent, profiles 3 and 4
both qualify and admission correctly refuses an automatic selection. The copy
has not been loaded into gameplay or written to native storage.
