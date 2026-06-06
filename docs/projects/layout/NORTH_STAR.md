# Layout Project North Star

Status: active
Last updated: 2026-06-05

## Dashboard Card Schema

Project: Layout Project
Slug: layout
Category: Feature/UI Projects
Status: active
Confidence: medium
Evidence: docs/projects/layout
Gap signal: 2 open gaps (G2, G3)
Protocol: living project doc set
Next step: Decide whether `ConversationPanel` belongs to the shell, the modal host, or a persistent side panel, then align `GameModals` and the handoff with that rule.
Required verification: docs_consistency
Completed verification: none yet
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

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

## Unknowns and Gaps

- `ConversationPanel` ownership is still not explicit in the docs: the open question is whether it is
  a persistent side panel, a shell-level overlay, or a modal-host sibling.
- `GameModals` still includes a currently unused `isUIInteractive` prop, which suggests either a stale
  contract or a missing interaction-lock wire.

## Next Checks

1. Decide the `ConversationPanel` ownership rule and record it once in `NORTH_STAR.md`.
2. Confirm the intended source for `isUIInteractive` inside `GameModals`.
3. Record exact modal ownership for each overlay and whether each one is window-frame based.
4. Verify responsive behavior and boundary coverage for non-playing phases after the ownership rule is fixed.

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
