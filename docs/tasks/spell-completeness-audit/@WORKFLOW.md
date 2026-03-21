# Spell Completeness Audit Workflow

**Status:** Preserved workflow surface / partially historical
**Last Reviewed:** 2026-03-11

## Purpose

Preserve how the Dec 2025 completeness-audit project was executed without overstating those procedures as the current universal spell workflow.

## Verified Current State

- The audit outputs still exist at output/LOCAL-INVENTORY.md, output/PHB-2024-REFERENCE.md, and @SPELL-COMPLETENESS-REPORT.md.
- The later migration handoff still exists at ../spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md.
- docs/spells/reference/ is populated with per-spell reference docs, but the older LEVEL-*.md summary files were not found during this pass.
- public/data/glossary/entries/spells/ does not exist, so that older spell-glossary markdown lane is not the current storage shape.

## Historical Procedures That Still Make Sense

### Inventory Collection
1. Scan public/data/spells/ for JSON spell files.
2. Extract level and id from each file; ignore cantrips (level: 0).
3. Aggregate counts per level and capture filenames or ids.
4. Save results to output/LOCAL-INVENTORY.md.

### PHB 2024 Research
1. Capture the 2024 PHB spell list for levels 1-9.
2. Record normalized spell IDs plus citations.
3. Save the result to output/PHB-2024-REFERENCE.md.

### Gap Analysis
1. Align local spell IDs against the PHB list.
2. Categorize each spell as present, missing, or extra.
3. Publish the comparison snapshot to @SPELL-COMPLETENESS-REPORT.md.

## Preserved But Not Current Authority

### Description Extraction
- The extraction plan here is still useful as context for what the audit project intended to produce.
- The external-source note from Dec 2025 is historical guidance, not a currently re-verified dependency contract.
- During this pass, the reference lane was present as per-spell docs under docs/spells/reference/level-*, not as the older LEVEL-*.md summary files described by this brief.

### Migration And Validation (Levels 1-9)
- Treat this section as the historical bridge into the later spell-overhaul migration effort.
- The current maintained migration authority is ../spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md.
- Do not assume every path or command preserved in the older workflow is still the live implementation lane.

## Current Use

Use this file to understand how the completeness-audit project was performed and how it handed off into the spell-overhaul migration stream. Do not treat it as the only current spell workflow authority.
