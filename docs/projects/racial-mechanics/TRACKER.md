# Racial Mechanics / Race Hierarchy Tracker

Last updated: 2026-05-31
Owner: Racial mechanics project agent

This tracker is the operational surface for this project.

Status vocabulary:
- `done`: completed with evidence linked in `AUDIT_OR_PROOF.md`, tests, or runtime files.
- `active`: currently being implemented.
- `in_progress`: accepted with clear next action.
- `blocked`: scope decision exists, and implementation waits.
- `deferred`: documented as adjacent and not required to finish baseline objectives.

## Completed baseline (core objective now active)

All rows below are required for the shared parser/materializer path and are complete:

- RM-001, RM-002, RM-003, RM-004, RM-005, RM-007, RM-008, RM-010,
  RM-011, RM-012, RM-015, RM-016, RM-017, RM-018, RM-019, RM-020, RM-021,
  RM-022, RM-023, RM-024, RM-025, RM-026, RM-027
- `scripts/audits/racialSpellParserAudit.ts` + `AUDIT_OR_PROOF.md` now provide
  repeatable baseline evidence for parser behavior.
- `traits-implementation-mapping.md` now shows 819 race traits (772 implemented, up from 765).
- RM-028 (Racial Traits Parser Gap): Materialized copiers repo-wide, making Leporine Senses, Hare-Trigger, Earth Walk, and Dwarven Combat/Armor Training fully active.
- RM-029 (Savage Attacks & Resourceful): Melee crit roll extra damage and long rest Heroic Inspiration states fully active.
- RM-030 (Racial Traits Mechanics Slice 2): Fully materialized and wired Satyr's Reveler, Tortle's Natural Armor, Thri-Kreen's Chameleon Carapace, and Wood Elf/Half-Elf's Fleet of Foot traits.

## Active and adjacent work queue

| Task ID | Status | Scope | Why it exists | Next action |
| --- | --- | --- | --- | --- |
| RM-032 | active | in_scope_now | The Character Creator may not present required choice steps (skills, spells, tools, etc.) for all races. | Audit the character creation flow against all races to ensure no choices are skipped. Add missing UI steps. |
| RM-032-A | done | in_scope_now | Kender, Kenku, Warforged, and Half-Elves lack skill choice UI steps. | Implement skill selection UI for these races in the Character Creator. |
| RM-032-B | active | in_scope_now | Autognome, Dwarves, and Warforged lack tool choice UI steps. | Implement tool selection UI for these races in the Character Creator. |
| RM-032-C | active | in_scope_now | Astral Elf, High Elf, and High Half-Elf lack cantrip choice UI steps. | Implement cantrip selection UI for these races in the Character Creator. |
| RM-032-D | done | in_scope_now | Changeling lacks size choice UI steps. | Implement size selection UI for Changeling in the Character Creator. |
| RM-031 | active | in_scope_now | Traits flagged as 'implemented' in data may lack reducer logic or UI visibility (e.g., Human Resourceful). | Audit all traits for mechanical and UI completeness. Fix gaps. |
| RM-013 | in_progress | adjacent-deferred | `Spells of the Mark` traits still require table/list-based list access into class spell lists. | Build a class spell-list source model and promote if scope allows. |
| RM-014 | in_progress | adjacent-deferred | Some traits use open spell choice text without concrete spell IDs (`...one cantrip ... of your choice...`). | Define race-choice schema and UI selection flow before implementation. |
| RM-006 | deferred | adjacent-deferred | Heuristic feature-type inference is brittle across multiple race text forms. | Replace with explicit schema tags only when parser touchpoints are stable. |
| RM-009 | deferred | adjacent-deferred | File naming cleanup is UI/docs hygiene and not required for mechanic parity. | Resume only if mechanical milestones are closed. |

## Current next check

1. Re-run race parser and trait-analyzer audit scripts after any parser or race-data changes.
2. Keep `docs/projects/racial-mechanics/traits-implementation-mapping.md` and `AUDIT_OR_PROOF.md` aligned with tracker scope.
3. Do not promote any adjacent task to `active` unless `TRACKER.md` records why it is required for current release scope.
