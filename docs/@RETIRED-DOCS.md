# Retired Documentation Archive

**Last Updated**: 2026-03-11  
**Purpose**: Track the retired numbered work docs that have already been marked with `~`, while making clear that this ledger is manually curated and still being reconciled during the broader documentation overhaul.

## What This File Covers

This file is a retirement ledger for numbered work docs that have already been marked retired on disk.

It is not:
- a complete archive index for every historical document under `docs/archive/`
- proof that every historical work doc has already been renamed with `~`
- a substitute for the doc-review ledger or migration ledger

For the numbered families still under active registry tracking, see [@DOC-REGISTRY.md](./@DOC-REGISTRY.md).

## Retirement Convention

For the numbered work-doc families that use tilde retirement:

1. the identifier is preserved
2. the filename changes from `[NUMBER]-NAME.md` to `[NUMBER]~NAME.md`
3. the retired file stays available for historical context
4. the retirement should be reconciled with the relevant registry surfaces

Important note:
- a missing `~` does not prove that a numbered doc is still current
- some older task trees remain historically active-looking and must be reviewed manually

## Retired Numbered Docs Currently Verified On Disk

### Archived / Completed

| Identifier | Document | Location | Verified file-state note |
|------------|----------|----------|--------------------------|
| 1C | [Version Display & Package Fix](./tasks/spell-system-overhaul/1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md) | `docs/tasks/spell-system-overhaul/` | tilde-marked file present |
| 1A | [Inventory Local Spells](./tasks/spell-completeness-audit/1A~INVENTORY-LOCAL-SPELLS.md) | `docs/tasks/spell-completeness-audit/` | tilde-marked file present |
| 1B | [Research PHB 2024 Spell List](./tasks/spell-completeness-audit/1B~RESEARCH-PHB-2024-LIST.md) | `docs/tasks/spell-completeness-audit/` | tilde-marked file present |
| 1C | [Gap Analysis](./tasks/spell-completeness-audit/1C~GAP-ANALYSIS.md) | `docs/tasks/spell-completeness-audit/` | tilde-marked file present |

### Abandoned

No verified tilde-marked files in this category yet.

### Obsolete

No verified tilde-marked files in this category yet.

### Duplicate / Merged

No verified tilde-marked files in this category yet.

## Restoration Guidance

If a retired numbered work doc needs to become active again:

1. rename it back to the active local convention for that subtree
2. update [@DOC-REGISTRY.md](./@DOC-REGISTRY.md) if that family is still tracked there
3. update [@ACTIVE-DOCS.md](./@ACTIVE-DOCS.md) only if it should return to the current work-entry surface
4. add a short note explaining why the retired state was reversed

## Current Reconciliation Note

This ledger now matches the tilde-marked files currently verified in the tracked numbered families.

The broader overhaul still needs to decide, file by file, whether additional historical docs should:
- stay active-looking for now
- be retired with `~`
- move into archive space without using the tilde convention
