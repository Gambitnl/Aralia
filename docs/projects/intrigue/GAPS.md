# Intrigue System Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|
| G-001 | not_started | implementation | `src/types/identity.ts` defines `IntrigueCheckResult`; `src/systems/intrigue/IdentityManager.ts` imports `_IntrigueCheckResult` but never uses it. | There is no social check/failure/backfire path for alias or disguise actions, so consequence modeling is incomplete. | Decide whether to wire identity checks into action/reducer flow or delete the unused contract with replacement. | Add a reducer-level proof that `CREATE_ALIAS`, `EQUIP_DISGUISE`, and failure checks can produce explicit consequences. |
| G-002 | not_started | implementation | `src/systems/intrigue/TavernGossipSystem.ts` creates `PurchaseableRumor.type = 'lead'` but sets `payload: undefined` with TODO. | Players can read or buy lead text, but no engine transition can consume it. | Define lead payload schema and route to quest, map marker, or world objective generation. | Add a deterministic test that lead items or actions become persistent quest-like state. |
| G-003 | not_started | architecture | `src/systems/intrigue/SecretGenerator.ts` and `src/utils/secretGenerator.ts` both generate secrets with different interfaces/output assumptions. | Tooling and event sources can diverge on tags, ids, and subject targeting. | Choose canonical generator API and migrate callsites in a bounded pass. | Add a smoke check comparing generated secret schema for intrigue and world code paths. |
| G-004 | not_started | architecture | `src/systems/intrigue/NobleHouseGenerator.ts` and `src/utils/world/nobleHouseGenerator.ts` both create noble houses but with different rank/member/detail fields. | Faction generation may not be deterministic across systems or may produce unmerged fields in saves/debug traces. | Choose one generator source and document compatibility or keep dual path with explicit ownership notes. | Re-run targeted startup checks for `getAllFactions` output shape in `src/utils/world/factionUtils.ts` and debug views. |
| G-005 | not_started | implementation | `src/systems/intrigue/LeverageSystem.ts` defines full apply/resolve flow; production code only references it in tests. | Core intrigue economics has no in-game action path, so blackmail/leverage outcomes remain offline. | Define action/reducer entry points for leverage attempts and UI invocation points. | Add at least one integration test where a known secret leads to nontrivial `GameMessage` and faction/standing change. |
| G-006 | in_progress | workflow | `src/systems/world/WorldEventManager.ts`, `src/systems/world/NobleIntrigueManager.ts`, `src/systems/world/FactionManager.ts` contain meaningful TODO and placeholder comments around switch scope, rumor shape, and imported types. | Several production-risky branches remain intent-heavy without explicit ownership comments. | Convert TODO list into task-bound gap slices before adding deeper intrigue expansion. | Include TODO coverage in periodic scan for `src/systems/intrigue` and `src/systems/world` before each handoff. |
| G-007 | in_progress | integration | `src/components/Town/Intrigue/RumorMill.tsx` converts purchased rumor content into note items with `type: 'note'` and `item.id = rumor_...`. | Item typing and storage behavior works, but this path is a generic service item and has no dedicated intrigue receipt schema. | Decide whether to introduce explicit intrigue item/flag or keep note shim with parser rule. | Keep `RumorMill` behavior stable and add assertions for persistence of purchased note id/content. |

Current triage alignment
- `I2` still maps to `G-005` and remains the next leverage wiring decision.
- `I3` still maps to `G-002` and needs a lead payload contract before it can become actionable.
- `I4` still maps to `G-003` and should stay on hold until a canonical generator is chosen.

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
