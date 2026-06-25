# Spell System - Feature Roadmap (Rebased)

**Last Updated**: 2026-03-12  
**Status**: Active / Rebased  
**Purpose**: Maintain a feature-first roadmap for spell data, runtime behavior, glossary integration, and migration completion criteria.

## Verified Current State

A 2026-03-12 repo check confirmed:
- Spell JSON files under public/data/spells/: 469
- Level-2 spell JSON files under public/data/spells/level-2/: 65
- The spell folder is levelized from level-0 through level-9
- No root-level spell JSON files remain directly under public/data/spells/
- npm run validate remains the active validation command
- public/data/glossary/index/spells.json exists

## Concrete Feature Tree

### Feature: Spell Data File Topology

**Goal:** Keep spell files in deterministic level-aware locations.

**Concrete capabilities**
- Level-Based Spell File Layout
- No Root-Level Spell JSON Drift
- Spell ID And Path Consistency

### Feature: Spell Manifest Integrity

**Goal:** Keep runtime spell discovery aligned with the spell file tree.

**Concrete capabilities**
- Spell Manifest Regeneration
- Spell Manifest Path Integrity
- Spell Manifest Entry Count Tracking

### Feature: Spell Description Glossary Linking

**Goal:** Link spell-detail prose to live glossary terms without inventing a dead template lane.

**Concrete capabilities**
- Glossary Index Spell Terms
- Spell Detail Term Linking
- Glossary Tooltip Deep Linking

**Current state:** Partial. Glossary loading and tooltip infrastructure exist, but SpellDetailPane.tsx still renders description text directly.

### Feature: Spell Migration Phase Gates

**Goal:** Distinguish dataset completeness from runtime verification completeness.

**Concrete capabilities**
- Dataset Coverage Gate
- Runtime Verification Gate
- Migration Completion Thresholds

### Feature: Level Rollup Coverage Metrics

**Goal:** Keep level rollup docs honest about inventory versus verified integration.

**Concrete capabilities**
- Level Rollup Inventory Counts
- Level Rollup Coverage Drift Detection
- Level Rollup Historical Batch Preservation

## Routed Concrete Tasks

The remaining actionable work from this roadmap was routed into durable project gap registries on 2026-06-26:

- Dataset Coverage Gate versus Runtime Verification Gate thresholds now belong to `docs/projects/spells/subprojects/spell-completeness-audit/GAPS.md` as `spell-completeness-audit-G4`.
- Deterministic roadmap node-ID conventions now belong to `docs/projects/roadmap-maintenance/GAPS.md` as `G6`.
- Spell Detail Term Linking now belongs to `docs/projects/glossary-ui/GAPS.md` as `G8`.
- Historical level-rollup drift now belongs to `docs/projects/spells/subprojects/spell-completeness-audit/GAPS.md` as part of `spell-completeness-audit-G2` and `spell-completeness-audit-G4`.

This file is now reference context, not an executable backlog.

## Historical Note

This roadmap no longer uses early migration-batch wording such as  33 cantrips remaining as its main organizing model.
The current repo has already moved beyond that stage, so the roadmap now tracks concrete capabilities and remaining integration gaps instead.
