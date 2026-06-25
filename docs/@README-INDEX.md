# Aralia Documentation Index & Active Inventory

**Last Updated**: 2026-05-17  
**Purpose**: Provide a stable map of the maintained documentation system and highlight the active work surfaces that are currently relevant to contributors.

## 1. Start Here (Canonical Root)

- [`PROJECT_PROJECT_ARCHITECTURE.md`](./PROJECT_PROJECT_ARCHITECTURE.md): Product and project orientation, domain-level architecture map
- [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md): Day-to-day development orientation, troubleshooting, and verification
- [`@DOCUMENTATION-GUIDE.md`](./@DOCUMENTATION-GUIDE.md): Documentation-system rules and scope

## 2. Active Work Surfaces

Start here when you need to re-enter active development or documentation work quickly.

- **Spell System Overhaul**: `docs/tasks/spell-system-overhaul/` (Start at `README.md` or `00-TASK-INDEX.md`)
- **Spell Completeness Audit**: `docs/tasks/spell-completeness-audit/`
- **3D Exploration**: `docs/tasks/3d-exploration/`
- **Project Gap Registries**: [`projects/PROJECT_TRACKER.md`](./projects/PROJECT_TRACKER.md) and [`projects/GLOBAL_GAPS.md`](./projects/GLOBAL_GAPS.md)
- **Live Spell Integration**: [`SPELL_INTEGRATION_STATUS.md`](./SPELL_INTEGRATION_STATUS.md)

*Note: There are other mixed active work areas under `docs/tasks/`, `docs/projects/`, and `docs/improvements/` that are pending normalization.*

## 3. Registries And Navigation

- [`@DOC-REGISTRY.md`](./@DOC-REGISTRY.md): Numbered work-doc tracking, naming rules, and retired doc ledger
- [`registry/@DOC-SCOPE.md`](./registry/@DOC-SCOPE.md): Current in-scope vs excluded doc boundaries
- [`registry/@DOC-REVIEW-LEDGER.md`](./registry/@DOC-REVIEW-LEDGER.md): Authoritative review queue for the current docs overhaul
- [`registry/@DOC-MIGRATION-LEDGER.md`](./registry/@DOC-MIGRATION-LEDGER.md): Active migration decisions and canonicalization notes

## 4. Primary Reference Areas

- [`architecture/`](./architecture/): System and domain references
- [`guides/`](./guides/): Recurring workflows and contributor guidance
- [`features/`](./features/): Feature explanations that still describe current systems
- [`spells/`](./spells/): Spell references and spell-system tracking docs
- [`decision_logs/`](./decision_logs/): Decision records
- [`blueprints/`](./blueprints/): Design blueprints and structured proposals that still matter

## 5. Secondary Reference Surface

Source-adjacent docs under `src/` remain in scope, but they are a separate layer from the root documentation hubs.

Use them for local implementation context:
- directory `README.md` files
- file-adjacent `[Name].README.md` files

Do not treat them as replacements for the main project entry docs in `docs/`.

## 6. Archive And History

- [`archive/`](./archive/): Preserved historical documents and completed work
- [`archive/reports/`](./archive/reports/): Cleanup reports, audits, and prior overview snapshots that should no longer read as living authority
- [`CHANGELOG.md`](./CHANGELOG.md): Top-level historical changelog
- [`generated/`](./generated/): Generated inventories and machine-produced doc outputs (e.g., `@ALL-MD-FILES.md`)
