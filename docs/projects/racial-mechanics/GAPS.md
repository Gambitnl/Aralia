# Racial Mechanics / Race Hierarchy Gaps

Status: active
Last updated: 2026-05-31

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| RM-016 | open | in_scope_now | Codex | TRACKER.md | 2026-06-01 | The Character Creator does not comprehensively support all racial trait choices across all races; some choices may be bypassed or unsupported in the UI flow. | Missing Origin feat selection for humans prior to the recent fix; other races may have un-prompted skill, tool, or spell choices. | Players may create characters with incomplete mechanical profiles if the UI fails to prompt them for all their granted racial choices. | Audit the character creator flow against all choice-bearing traits across all races and implement missing selection steps. | Run a dummy-character creation script for all races to verify completeness. |
| RM-032-A | closed | in_scope_now | Codex | TRACKER.md | 2026-06-01 | Kender, Kenku, Warforged, and Half-Elves lack skill choice UI steps. | `traits-implementation-mapping.json` | Players cannot select required racial skills. | Implement skill selection UI for these races in the Character Creator. | Verify skill selection in UI. |
| RM-032-B | open | in_scope_now | Codex | TRACKER.md | 2026-06-01 | Autognome, Dwarves, and Warforged lack tool choice UI steps. | `traits-implementation-mapping.json` | Players cannot select required racial tools. | Implement tool selection UI for these races in the Character Creator. | Verify tool selection in UI. |
| RM-032-C | open | in_scope_now | Codex | TRACKER.md | 2026-06-01 | Astral Elf, High Elf, and High Half-Elf lack cantrip choice UI steps. | `traits-implementation-mapping.json` | Players cannot select required racial cantrips. | Implement cantrip selection UI for these races in the Character Creator. | Verify cantrip selection in UI. |
| RM-032-D | closed | in_scope_now | Codex | TRACKER.md | 2026-06-01 | Changeling lacks size choice UI steps. | `traits-implementation-mapping.json` | Players cannot choose their size. | Implement size selection UI for Changeling in the Character Creator. | Verify size selection in UI. |
| RM-015 | open | in_scope_now | Codex | TRACKER.md | 2026-06-01 | Racial traits lack comprehensive mechanical verification; traits exist in data but may be missing backend reducer logic or frontend UI representation (e.g., Character Sheet). | Human 'Resourceful' trait had reducer logic but no UI display; missing 'Versatile' feat logic. | Traits appear "implemented" in data but are not actually playable or visible to the user, creating a false sense of completeness. | Create an audit task to review all racial traits, ensuring each has corresponding state logic and UI rendering. | Add a checklist to `TRACKER.md` or a new audit script to verify end-to-end integration. |
| RM-013 | open | adjacent_follow_up | Codex | TRACKER.md | 2026-05-31 | Table-driven spell-list trait grants (`Spells of the Mark`) do not map into the current trait schema. | `AUDIT_OR_PROOF.md`, `TRACKER.md`, `traits-implementation-mapping.md` | Needs separate class spell-list source integration before the claim "all race spell access is parser complete" is true. | Define spell-list source schema for mark tables and integrate into spell availability checks. | Re-run `scripts/audits/racialSpellParserAudit.ts` after schema work. |
| RM-014 | open | adjacent_follow_up | Codex | TRACKER.md | 2026-05-31 | Open spell-choice traits use non-concrete selection text (for example, "one cantrip of your choice"). | `AUDIT_OR_PROOF.md`, `traits-implementation-mapping.md`, `scripts/audits/racialSpellParserAudit.ts` | Current parser cannot represent an unbounded allowed list + ability-based source choice correctly. | Define choice-source model and requirement path in race parser/state before auto-claiming these traits as done. | Add/extend parser tests and `characterUtils` race-choice fixtures. |
| RM-006 | open | adjacent_follow_up | Codex | TRACKER.md | 2026-05-31 | `inferRacialFeatureType` still relies on heuristics and can misclassify cross-race trait text. | `TRACKER.md` | Brittle inference can create silent drift as new races or edited race text lands. | Replace with explicit feature tags during a bounded parser refactor pass. | Add targeted fixture coverage for misclassification cases. |
| RM-HIER-001 | open | support_needed_now | Codex | TRACKER.md | 2026-05-31 | Project still carries `docs/blueprints/RACE_HIERARCHY_BLUEPRINT.md` as planned architecture, but runtime remains mostly flat. | `docs/blueprints/RACE_HIERARCHY_BLUEPRINT.md` | UI and data contributors may assume hierarchy is live and route tasks incorrectly. | Keep docs clearly labeled as blueprint and avoid planning changes as mandatory runtime refactor. | Add a periodic alignment check against `src/data/races/index.ts` and current selection components. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Required for the current objective. |
| `support_needed_now` | Needed to continue safely even if not core mechanics. |
| `adjacent_follow_up` | Useful adjacent work that should remain tracked without blocking current slice. |
| `out_of_scope` | Real but not part of the current project objective. |
| `blocked_human_decision` | Requires user/operator policy choice. |
| `blocked_external_state` | Requires another team, system, or external dependency. |
