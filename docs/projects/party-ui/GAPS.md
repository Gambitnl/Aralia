# Party UI Gap Registry

Status: active
Last updated: 2026-06-10

Use this for durable unresolved findings that remain in Party UI scope.

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G4 | in_progress | adjacent_follow_up | Worker B | Party UI overlay/card UX | NORTH_STAR gap carried forward | Decide which missing-choice warnings should appear in the overlay path versus compact cards if richer card variants are introduced later | `docs/projects/party-ui/NORTH_STAR.md` (Gaps carried forward), `docs/projects/party-ui/TRACKER.md` (T2) | Warning placement needs a single source of truth before new card variants expand | Add explicit display rule text in NORTH_STAR and keep tracker acceptance notes aligned | Visual or acceptance check on overlay/cards once the rule is defined |
| G5 | open | blocked_human_decision | Worker B | Party roster acceptance rule | NORTH_STAR next checks | Decide whether party roster membership can include non-companion NPC party entities and document the acceptance rule | `docs/projects/party-ui/NORTH_STAR.md` (G5 decision 2026-06-10); `docs/projects/DECISION_BLITZ_2026-06-10.md` D15 | Roster composition affects membership model, sheet context, and save/load semantics | Decided 2026-06-10 (Remy, D15): roster MAY include non-companion NPCs under an explicit acceptance rule; define the rule (membership model, sheet context, save/load semantics) as step one of the implementation slice â€” that unblocks G7 | Acceptance rule text recorded in NORTH_STAR; G7 work resumes against it |
| G6 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G10 | Code modularization audit routing | Central state/save/load modularization may touch party/rest defaults and character reducer assumptions. | `src/state/appState.ts`; `src/state/reducers/characterReducer.ts`; `src/state/reducers/__tests__/worldReducer.test.ts`; `src/state/__tests__/worldViewModeLegacy3d.test.ts` | Party UI depends on stable load defaults such as `shortRestTracker`; broad state splits can regress continuity. | Keep party-owned load/rest proof named in any state/save split plan. | Party/rest continuity tests remain green after any state/save modularization |
| G7 | not_started | adjacent_follow_up | Codex | Party UI overlay/companion data threading | T2 companion-party boundary analysis (2026-06-08) | `PartyOverlay` accepts `party: PlayerCharacter[]` but does not thread `companions` data; `RelationshipsPane` is standalone and not mounted in the overlay; companion approval/relationship/banter context is invisible from the party roster | `src/components/Party/PartyOverlay.tsx` (props interface); `src/components/Party/RelationshipsPane.tsx`; `src/components/layout/GameModals.tsx` (PartyOverlay mount) | Party roster cannot show companion relationship status, approval, or banter context; the two surfaces are visually and architecturally disconnected | G5 decided 2026-06-10 (D15): write the explicit acceptance rule first (step one of the slice), then wire companion data into PartyOverlay; consider a tabbed or sectioned overlay | Visual check that companion relationship data renders in party overlay |

| G9 | open | support_needed_now | Qoder | Party UI test coverage | Iteration 5 gap sweep (2026-06-08) | `PartyMemberCard` (the active card component rendered by `PartyPane`) has no test file; `PartyCharacterButton` (legacy, not used by `PartyPane`) has tests. Card stat rendering, HP bar, spell slots, missing-choice warning, and expendable abilities are untested in the active component. | `src/components/Party/PartyPane/PartyMemberCard.tsx` (no test); `src/components/Party/PartyPane/__tests__/PartyCharacterButton.test.tsx` (legacy test exists) | Active card component lacks regression protection; legacy test provides false coverage confidence | Add `PartyMemberCard.test.tsx` covering stat row, HP bar, spell slots, missing-choice warning, and more-button callback | `npx vitest run src/components/Party/PartyPane/__tests__/PartyMemberCard.test.tsx` green |
| G10 | open | adjacent_follow_up | Qoder | Party UI rest flow parity | Iteration 5 gap sweep (2026-06-08) | Long Rest button opens `LongRestModal` (`TOGGLE_LONG_REST_MODAL`) allowing racial rest choices before confirming. Short Rest button dispatches `SHORT_REST` directly with no modal, bypassing any choice flow. If D&D 2024 short rest should support Hit Dice spending choices or racial rest options, the UX is inconsistent. | `src/components/layout/GameModals.tsx` (line 372: `onShortRest` dispatches directly; line 385: Long Rest opens `LongRestModal`); `src/components/Party/PartyOverlay.tsx` (footer buttons) | Rest UX inconsistency: long rest has a choice modal, short rest fires immediately | Decide whether short rest needs a modal for Hit Dice spending or racial rest choices; if yes, create a `ShortRestModal` analogous to `LongRestModal` | Short rest flow matches long rest modal pattern or explicit decision that immediate dispatch is correct |

## Classification

- `in_scope_now`: blocks current implementation tasks.
- `support_needed_now`: must be verified to prevent regressions.
- `adjacent_follow_up`: meaningful but not required for this project slice.
- `blocked_human_decision`: owner choice required to close.
- `blocked_external_state`: dependent on external subsystem or API evolution.
- `out_of_scope`: keep in other project trackers.

## Update Rules

- Keep active gaps in this file if they affect party UI behavior, correctness, or handoff.
- Move global or unrelated gaps to `docs/projects/GLOBAL_GAPS.md` before closing this project.

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |
