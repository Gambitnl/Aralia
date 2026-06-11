---
schema_version: 1
project: Layout Project
slug: layout
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: "UI Shell & Components"
status: active
last_updated: 2026-06-10
confidence: medium
evidence: docs/projects/layout
gap_signal: "G3/G4 decided 2026-06-10 (D7); implementation lane open"
protocol: living project doc set
next_step: "Implement the approved app-shell split: move provider composition out of App.tsx into a dedicated app-shell module with preservation tests (provider order, DataLoaderGate, GameProvider boundaries); keep isUIInteractive as a documented compatibility pass-through."
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Layout Project North Star

Status: active (decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-10

## Dashboard Card Schema

Project: Layout Project
Slug: layout
Category: Feature/UI Projects
Status: active (decision recorded 2026-06-10; implementation lane open)
Confidence: medium
Evidence: docs/projects/layout
Gap signal: G3/G4 decided 2026-06-10 (D7); implementation lane open
Protocol: living project doc set
Next step: Implement the approved app-shell split (provider composition moves to a dedicated app-shell module) with preservation tests for provider order, `DataLoaderGate`, and `GameProvider` boundaries; keep `isUIInteractive` as a documented compatibility pass-through.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08

This is a cold-start checkpoint for the Layout surface of Aralia's main app shell.
The goal is not implementation work; it is durable handoff clarity plus evidence-backed
state for the next phase of work.

## Purpose and Scope

- Define how Aralia's app shell is composed by phase:
  - menu phase uses `MainMenu`.
  - gameplay exploration phase uses `GameLayout`.
  - all UI overlays are rendered by `GameModals`.
- Preserve discovery intent from the existing code and style registries without shrinking
  existing optionality.

In scope:
- `src/components/layout/GameLayout.tsx`
- `src/components/layout/GameModals.tsx`
- `src/components/layout/MainMenu.tsx`
- `src/App.tsx` phase routing and shell boundary points
- modal and id registries in `src/styles/uiIds.ts` and `src/styles/zIndex.ts`

Out of scope:
- code edits outside `src/components/layout` and the above boundary files for this docs-only pass.

## File Map

| File | What it represents |
|---|---|
| `src/components/layout/GameLayout.tsx` | Main gameplay shell with left/right columns: compass + action on left, world text + minimap on right |
| `src/components/layout/GameModals.tsx` | Central modal manager with lazy-loaded overlays and `AnimatePresence` sequencing |
| `src/components/layout/MainMenu.tsx` | Main menu shell and entry-point actions |
| `src/App.tsx` | Phase switchboard and shell boundary that selects phase content and hosts overlays |
| `src/styles/uiIds.ts` | Canonical shell and modal ids used across layout and test targets |
| `src/styles/zIndex.ts` | Layer contracts for base UI, modals, window frames, notifications |

## Implemented State (Observed)

- `GameLayout` renders a full-screen two-column structure and tags it with `UI_ID.GAME_LAYOUT`,
  `UI_ID.LEFT_COLUMN`, and `UI_ID.RIGHT_COLUMN`.
- `CompassPane`, `ActionPane`, `WorldPane`, and `Minimap` are composed under `GameLayout`.
- `ErrorBoundary` wraps the key gameplay panes, so pane failure is isolated from shell collapse.
- `App.tsx` uses phase-based boundaries: `MAIN_MENU` renders `MainMenu`, `PLAYING` renders
  `GameLayout`, and other phases render other phase views.
- `GameModals` is rendered once in the root tree and is intended as the shared modal host for
  map/quest/log/sheet/dev/merchant/dialogue and specialist overlays.
- Modal layering follows the shared `UI_ID` and `Z_INDEX` registries; window-based overlays use
  `WINDOW_KEYS` with `windowId`.

## Integrations

- `GameLayout` props are fed by state-derived values from `App.tsx` (`processAction`, location, map,
  messages, NPCs, items, party, AI action payload, timers, flags).
- `GameModals` receives broad modal state via `gameState` plus explicit close/action callbacks from
  `App.tsx`.
- `DataLoaderGate` wraps most non-menu views and currently does not wrap the modal host.
- The minimap is in the layout shell and intentionally layered below modal layers.

## Ownership Decisions

- `ConversationPanel` is a PLAYING-only floating shell sibling rendered directly by `App.tsx` when
  `gameState.activeConversation` exists. It is not owned by `GameModals` and should not be folded
  into the modal host without a new interaction/focus policy.
- `GameModals` accepts `isUIInteractive` from `App.tsx` as a preserved compatibility hook, but the
  modal host does not consume it yet. The decision is review-required: either wire it into a modal-lock
  policy or retire the pass-through after the owner confirms the contract.

## Required Review Brief

Title: `GameModals.isUIInteractive` contract
Question: Should `GameModals` keep `isUIInteractive` as a compatibility-only pass-through, or should the prop be wired into a modal interaction-lock policy?
Issue: `App.tsx` computes `isUIInteractive` and passes it into `GameModals`, but `GameModals.tsx` renames it to `_isUIInteractive` and never reads it.
Current behavior: The App-level interaction flag already disables `GameLayout`, `TownCanvas`, and companion reactions when overlays or loading states are active; the modal host itself handles focus traps and Escape fallback without using the flag.
Why blocked: Removing the prop changes the App-to-modal contract, while wiring it now would commit Layout to a modal-lock policy that is not documented in the current project scope.
Option A: Keep the prop as compatibility only, document that `GameModals` currently ignores it, and wire it later only if a modal-lock policy is approved.
Option B: Retire the prop and remove the pass-through once the owner approves the App/layout interaction policy and the focused tests are updated.
Evidence: `src/App.tsx:899`, `src/App.tsx:1047`, `src/App.tsx:1090`, `src/App.tsx:1196`, `src/App.tsx:1220`; `src/components/layout/GameModals.tsx:101`, `src/components/layout/GameModals.tsx:139-142`; `src/components/layout/__tests__/GameModals.test.tsx:82`.
Decision owner: Human/product owner for the Layout interaction and focus policy.
Proof after decision: Either a focused App/GameModals test update that exercises the chosen modal-lock behavior, or a source-backed pass-through removal with matching call-site cleanup.

### Decision (2026-06-10)

Resolved by Remy (project owner) in the 2026-06-10 batched decision session (D7 in
`docs/projects/DECISION_BLITZ_2026-06-10.md`):

- **G3 — Option A.** `isUIInteractive` stays as a documented compatibility pass-through.
  `GameModals` continues to ignore it; wiring it into a modal-lock policy or retiring it
  is a later, separate decision.
- **G4 — App-shell split approved.** Provider composition moves out of `App.tsx` into a
  dedicated app-shell module, with explicit preservation tests covering provider order,
  `DataLoaderGate`, and `GameProvider` boundaries (joint decision with Providers / G5).

Status: decision recorded 2026-06-10; implementation lane open.

## Next Checks

1. Await the owner decision recorded in the Required Review Brief. (Done 2026-06-10 — see Decision subsection above; D7.)
2. Record exact modal ownership for each overlay and whether each one is window-frame based.
3. Verify responsive behavior and boundary coverage for non-playing phases after the interaction-lock rule is fixed.
4. If the owner keeps the compatibility hook, wire the flag into the chosen modal-lock surface and add focused tests.

## Next Handoff

1. Review this file.
2. Review `docs/projects/layout/TRACKER.md` and `docs/projects/layout/GAPS.md`.
3. Confirm shell boundaries and modal ownership in `src/App.tsx`, `src/components/layout/GameLayout.tsx`,
   and `src/components/layout/GameModals.tsx`.



## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- use the active tracker row as the work queue
- keep only real, evidence-backed gaps in `GAPS.md`
- route cross-project findings to `docs/projects/GLOBAL_GAPS.md`
- not invent gaps to satisfy a count
