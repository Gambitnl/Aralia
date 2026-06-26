# Weapon Proficiency System North Star

Status: active
Last updated: 2026-06-25

## Why This Project Exists

The feature has mostly landed in code, so this file now protects the current state, prevents accidental narrowing, and records the remaining gaps that still block complete weapon-proficiency completion.

## Intended Outcome

Provide a short cold-start map that preserves implemented behavior, known follow-through tasks, and the exact next checks for combat-facing proficiency work.

## Current State

What is implemented:
- Weapon helper and equip check are present in `src/utils/character/weaponUtils.ts` and `src/utils/character/characterUtils.ts`.
- Non-proficient weapons can still be equipped with warning reasons (`canEquipItem` permissive warning path).
- Character inventory and equipped-mannequin warning wiring is in `src/components/CharacterSheet/Overview/InventoryList.tsx` and `src/components/CharacterSheet/Overview/EquipmentMannequin.tsx`.
- Combat ability generation carries `isProficient` and gates mastery attachment in `src/utils/combat/combatUtils.ts`.
- Non-proficient attack penalty and opportunity-attack behavior are implemented in `src/commands/factory/AbilityCommandFactory.ts` and `src/hooks/combat/useActionExecutor.ts`, with regression tests in corresponding test files.
- Character progression math for proficiency bonus is in leveling logic (`src/utils/character/characterUtils.ts`).

What is still open:
- Combat-facing warning UI for non-proficient weapon actions exists on
  `AbilityButton.tsx`, with focused test coverage.
- Last rendered verification for warning UX and end-to-end penalty warning
  alignment is still stale.

File map in this project:
- `README.md`: folder-level summary.
- `START-HERE.md`: verified current-state read path.
- `@PROJECT-INDEX.md`: file-status map of what landed vs active gaps.
- `@WORKFLOW.md`: working order and verification-first rules.
- `09-attack-roll-penalties.md`: retired 2026-06-25 after focused source and
  regression proof confirmed command/opportunity attack penalty behavior.
- `10-weapon-mastery-integration.md`: retired 2026-06-25 into `GAPS.md` G1-G3 after focused tests confirmed the core mastery gate.
- `11-combat-ui-warnings.md`: retired 2026-06-25 after the combat ability button
  warning marker and accessible/tooltip copy were implemented.
- `weapon-audit-report.md`: preserved audit context with caveats.

## Active Task

| Field | Value |
|---|---|
| Task | Align living docs to current implementation state and register active gaps with explicit next checks. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` describe implementation status, active in-project gaps, required integrations, and next checks with test/code evidence. |
| Allowed boundaries | Docs-only updates under `docs/tasks/weapon-proficiency-system`. |
| Stop condition | Stop after docs align and gap records are explicit. |
| Verification | Evidence references in `src/utils/character/characterUtils.ts`, `src/utils/combat/combatUtils.ts`, `src/commands/factory/AbilityCommandFactory.ts`, `src/hooks/combat/useActionExecutor.ts`, and related test files. |
| Owner | Worker D |
| Next action | Continue from active tracker row `T2` once this docs pass is accepted. |

## Integrations

- Character mechanics: `src/utils/character/weaponUtils.ts`, `src/utils/character/characterUtils.ts`, `src/services/saveLoadService.ts`.
- Combat mechanics: `src/utils/combat/combatUtils.ts`, `src/commands/factory/AbilityCommandFactory.ts`, `src/hooks/combat/useActionExecutor.ts`.
- Character sheet UX: `src/components/CharacterSheet/Overview/InventoryList.tsx`, `src/components/CharacterSheet/Overview/EquipmentMannequin.tsx`.
- Tests: `src/utils/character/__tests__/weaponUtils.test.ts`, `src/commands/factory/__tests__/AbilityCommandFactory.test.ts`, `src/hooks/combat/__tests__/useActionExecutor.test.ts`.

## Scope Boundaries

In scope:
- Living-project records, in-project gap registry, and next-check planning.

Adjacent but not in this slice:
- Combat backend redesign.
- Persistence schema migration.

Out of scope:
- Broad code refactors not required to close the active gap rows.

## What Must Not Be Lost

- permissive equip model (non-proficient equip is allowed with warning),
- removal of proficiency bonus for non-proficient attack rolls,
- mastery gating for non-proficient weapons in combat ability generation,
- existing regression coverage for attack modifiers.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| G1: Add/verify a dedicated combat action warning surface for non-proficient weapon attacks. | done | Codex | `AbilityButton.tsx`; retired `11-combat-ui-warnings.md` | Done 2026-06-25 with focused component coverage; rendered sign-off remains under G2. |
| G2: Re-run rendered verification and end-to-end checks for warning display and penalty messaging alignment. | active | Codex | `START-HERE.md`; `AbilityButton.tsx`; focused test run | Run a focused UI + regression pass; record screenshot/browser proof in tracker/audit note. |

## Global Gap Imports

No cross-project gap rows were imported into this project in this pass.

## Evidence and Proof

| Evidence | What it proves | Location |
|---|---|---|
| Weapon helper, equip rule, and mastery gate | Core proficiency checks, warning reasons, and combat ability mastery gating are implemented. | `src/utils/character/weaponUtils.ts`; `src/utils/character/characterUtils.ts`; `src/utils/combat/combatUtils.ts` |
| Combat penalty behavior | Non-proficient attacks can drop proficiency bonus. | `src/commands/factory/AbilityCommandFactory.ts`; `src/hooks/combat/useActionExecutor.ts`; related tests |
| Living state references | Subtree truth is no longer a greenfield plan. | `START-HERE.md`; `@PROJECT-INDEX.md`; `@WORKFLOW.md` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Project registry link. | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project gap routing. | active |
| `TRACKER.md` | Active queue and blocker rows. | active |
| `GAPS.md` | Durable unresolved findings. | active |

## Artifact Boundary

Keep durable decisions, gap claims, and concise proof links here. Keep command output, screenshots, and temporary run state out unless a small excerpt is needed.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Which combat UI container should own the final non-proficient weapon warning (action panel vs tooltip vs inline)? | Prevents duplicate or inconsistent warning behavior. | Worker D | start of next in-project pass |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Confirm code/test evidence links.
5. Continue from tracker row `T2`.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/weapon-proficiency-system/NORTH_STAR.md","sha256WithoutMarker":"82eb902fea4c93718ebc29e1fd3d5dd6767616d481b7d7f0fe5ba5ec3f84444f","markedAtUtc":"2026-06-25T22:29:38.613Z"} -->
