# Aralia Documentation Index

**Last Updated**: 2026-03-09  
**Purpose**: Provide a stable map of the maintained documentation system without turning every report or local README into a top-level hub.

## Start Here

- [`@PROJECT-OVERVIEW.README.md`](./@PROJECT-OVERVIEW.README.md): product and project orientation
- [`ARCHITECTURE.md`](./ARCHITECTURE.md): domain-level architecture map
- [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md): day-to-day development orientation
- [`@DOCUMENTATION-GUIDE.md`](./@DOCUMENTATION-GUIDE.md): documentation-system rules and scope
- [`@ACTIVE-DOCS.md`](./@ACTIVE-DOCS.md): current active work entry point

## Registries And Navigation

- [`@DOC-REGISTRY.md`](./@DOC-REGISTRY.md): numbered work-doc tracking
- [`@DOC-NAMING-CONVENTIONS.md`](./@DOC-NAMING-CONVENTIONS.md): naming and retirement rules for numbered docs
- [`@RETIRED-DOCS.md`](./@RETIRED-DOCS.md): retired-doc ledger
- [`@DOC-INVENTORY.md`](./@DOC-INVENTORY.md): broad inventory snapshot
- [`registry/@DOC-SCOPE.md`](./registry/@DOC-SCOPE.md): current in-scope vs excluded doc boundaries
- [`registry/@DOC-MIGRATION-LEDGER.md`](./registry/@DOC-MIGRATION-LEDGER.md): active migration decisions and canonicalization notes

## Primary Reference Areas

- [`architecture/`](./architecture/): system and domain references
- [`guides/`](./guides/): recurring workflows and contributor guidance
- [`features/`](./features/): feature explanations that still describe current systems
- [`spells/`](./spells/): spell references and spell-system tracking docs
- [`decision_logs/`](./decision_logs/): decision records
- [`blueprints/`](./blueprints/): design blueprints and structured proposals that still matter

## Active Work Areas

- [`tasks/`](./tasks/): active execution docs, project task trees, and investigations
- [`plans/`](./plans/): dated planning docs that remain in active scope
- [`projects/`](./projects/): project packages that mix specs, tasks, and quick-start docs
- [`improvements/`](./improvements/): active improvement planning that has not yet been archived
- [`FEATURES_TODO.md`](./FEATURES_TODO.md): feature backlog
- [`QOL_TODO.md`](./QOL_TODO.md): quality-of-life backlog
- [`SPELL_INTEGRATION_STATUS.md`](./SPELL_INTEGRATION_STATUS.md): live spell tracking board

## Secondary Reference Surface

Source-adjacent docs under [`../src/`](../src/) remain in scope, but they are a separate layer from the root documentation hubs.

Use them for local implementation context:
- directory `README.md` files
- file-adjacent `[Name].README.md` files

Do not treat them as replacements for the main project entry docs in [`docs/`](./).

## Archive And History

- [`archive/`](./archive/): preserved historical documents and completed work
- [`archive/reports/`](./archive/reports/): cleanup reports, audits, and prior overview snapshots that should no longer read as living authority
- [`changelogs/`](./changelogs/): historical change logs
- [`CHANGELOG.md`](./CHANGELOG.md): top-level historical changelog
- [`generated/`](./generated/): generated inventories and machine-produced doc outputs

## Notes

- `docs/AGENT.md` is now a compatibility pointer so older references do not break.
- Audit-style status reports were moved out of the root hub surface and into archive space.
- Some subtrees still mix reference docs and work docs internally. The migration ledger tracks those splits.
