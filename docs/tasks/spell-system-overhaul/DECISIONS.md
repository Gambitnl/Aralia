# Structured Spell Execution Decision Log

Status: active
Last updated: 2026-05-31
Project display name: Structured Spell Execution
Legacy name / folder slug: Spell System Overhaul (`docs/tasks/spell-system-overhaul`)

## Decision Log

| Decision ID | Date | Decision point | Options considered | Decision | Rationale | Mutation | Resulting status | Next proof |
|---|---|---|---|---|---|---|---|---|---|
| DS-001 | 2026-05-31 | Where should project protocol docs live? | Create new `docs/projects/spell-system-overhaul` area | Keep existing owner folder `docs/tasks/spell-system-overhaul` | Existing project activity, evidence, and tasks already live there; migration would increase context loss risk | Updated/added missing protocol support docs in this folder | In-scope and preserved | Verify `NORTH_STAR.md` resume path points here |
| DS-002 | 2026-05-31 | Should this pass include runtime edits? | Fix source TODOs and close gaps | Expand only protocol surface in docs | Task intent requested protocol expansion; source edits require a separate execution slice to avoid widening scope | No source changes made | Done for this slice | Active tracker row remains on implementation gaps |
| DS-003 | 2026-05-31 | Which protocol artifacts must be added now? | Add only NORTH_STAR + tracker + gaps | Add full protocol support set needed for protocol continuity | Existing surface lacked `DECISIONS`, `AUDIT_OR_PROOF`, `RUNBOOK`, `TASK_SLICE`; this increases cold-start reliability | Added these support files and refreshed tracker pointers | Done | Confirm files are present and referenced in `NORTH_STAR.md` |
| DS-004 | 2026-05-31 | How to preserve historical gap files (`GAP_REGISTRY.md`, `gaps/`)? | Delete or overwrite with protocol `GAPS.md`; move into `tasks/` | Preserve legacy documents and build protocol files beside them | This project is expansion-first; unfinished docs can encode useful context and should not be pruned during protocol conversion | Left legacy files untouched and added protocol-facing files | Preserved | Future slices may consolidate references if required |
| DS-005 | 2026-05-31 | What should the living project be called? | Keep `Spell System Overhaul`; rename folder and registry immediately; use a clearer display name while preserving legacy path | Use `Structured Spell Execution` as the project display name and keep `spell-system-overhaul` as the legacy folder slug | The active work is no longer a generic overhaul; it is an evidence-first data/validation/runtime execution project. Renaming the folder now would risk breaking historical links and task references. | Updated living-project titles and alias notes; did not move files | Active naming clarified; continuity preserved | Future cleanup can decide whether a path migration is worth the link repair cost |

## Decision Discipline

- Do not shrink scope because files already exist but are incomplete.
- Track future cross-project gaps in `docs/projects/GLOBAL_GAPS.md` when relevant.
- Keep unresolved in-project behavior questions in the owning child lane `GAPS.md` under `docs/projects/spells/subprojects/` (this folder's `GAPS.md` was archived 2026-07-01 to `docs/archive/spell-system/SSO-GAPS-EVIDENCE-LOG.md`; `TRACKER.md` here is a historical index).

## DS-006 JSON schema part editing surface

Decision: JSON schema part files are the preferred manual editing surface for spell JSON schema definition changes.

Rationale:
- scripts/syncSpellJsonSchemaRegistry.ts documents src/systems/spells/schema/parts/ as the smaller reviewable editing surface and src/systems/spells/schema/spell.schema.json as the stable aggregate path consumed by existing tools.
- Broad schema work should edit the relevant part file first, then regenerate/check the aggregate with the schema registry script when verification is approved.

Boundary:
- This does not make JSON schema more canonical than src/systems/spells/validation/spellValidator.ts; the project still has multiple validation surfaces that need parity decisions.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-system-overhaul/DECISIONS.md","sha256WithoutMarker":"7b2a40b9d222b306c60a530cd4f1e88ee64ff470375b880d2d93015e252d1eb3","markedAtUtc":"2026-06-25T22:29:38.585Z"} -->
