# Weapon Proficiency System Gaps

Status: active
Last updated: 2026-06-25

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Codex | Weapon Proficiency System tracker (`TRACKER.md`) | retired `11-combat-ui-warnings.md`; `src/components/BattleMap/AbilityButton.tsx`; `src/components/BattleMap/__tests__/AbilityButton.test.tsx` | Combat UI needed a dedicated warning cue when a weapon action uses no proficiency bonus or mastery. | Non-proficient combat actions can be visually ambiguous and easy to misplay. | Done 2026-06-25: ability buttons now show a warning marker and accessible/tooltip text for non-proficient weapon attacks. | `npx vitest run src/components/BattleMap/__tests__/AbilityButton.test.tsx src/commands/factory/__tests__/AbilityCommandFactory.test.ts src/hooks/combat/__tests__/useActionExecutor.test.ts src/utils/character/__tests__/weaponUtils.test.ts --reporter=dot` passed 51 tests. |
| G2 | active | support_needed_now | Codex | Weapon Proficiency System tracker (`TRACKER.md`) | `START-HERE.md`; retired `11-combat-ui-warnings.md`; `AbilityButton.tsx` warning marker | No fresh rendered verification cycle confirms warning text and penalty behavior together after the combat button warning change. | Source/tests prove the warning path exists, but rendered combat UX can still drift in layout, tooltip placement, action-selection flow, or copy. | Run a scoped rendered combat verification pass for warning marker, tooltip/accessibility text, and penalty behavior alignment. | Screenshot or Playwright/browser proof attached to tracker/audit artifact. |
| G3 | done | adjacent_follow_up | Codex | Weapon Proficiency System tracker (`TRACKER.md`) | retired `09-attack-roll-penalties.md`; `AbilityCommandFactory.ts`; `useActionExecutor.ts`; focused test run | Confirm there is no bypass path that applies proficiency bonus outside the tested command/opportunity paths. | A hidden bypass would undermine landed penalty logic. | Done 2026-06-25: source search found the command and opportunity attack proficiency gates, and focused regression tests cover both paths. | Same focused run passed 51 tests across ability button, command factory, action executor, and weapon helper suites. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Import Rules

- Keep only durable in-project unresolved findings here.
- Route cross-project or unrelated findings to `docs/projects/GLOBAL_GAPS.md`.
- Each durable gap must include next proof/check and owning tracker context.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/weapon-proficiency-system/GAPS.md","sha256WithoutMarker":"bffc5dddf047c81e144a030c8810182d746ecd9d337e1214cddf675a2297ad99","markedAtUtc":"2026-06-25T22:29:38.613Z"} -->
