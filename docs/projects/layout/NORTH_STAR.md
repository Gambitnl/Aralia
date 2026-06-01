# Layout Project North Star

Status: active
Last updated: 2026-05-31

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

- Shell boundary contract is partially implicit: `ConversationPanel` can appear alongside `GameLayout`
  when active conversation exists, and is not managed by `MainMenu`/`GameLayout`.
- `GameModals` still includes a currently unused `isUIInteractive` prop, which suggests either a missing
  wire or a planned contract.
- Main menu and gameplay shells likely should be explicitly documented as separate interaction regions
  and interaction-lock rules in one place.

## Next Checks

1. Validate whether `ConversationPanel` should remain an overlay outside `GameModals` or move into the layout contract.
2. Confirm intended source for `isUIInteractive` inside `GameModals`.
3. Record exact modal ownership for each overlay and whether each one is window-frame based.
4. Verify responsive behavior and boundary coverage for non-playing phases.

## Next Handoff

1. Review this file.
2. Review `docs/projects/layout/TRACKER.md` and `docs/projects/layout/GAPS.md`.
3. Confirm shell boundaries and modal ownership in `src/App.tsx`, `src/components/layout/GameLayout.tsx`,
   and `src/components/layout/GameModals.tsx`.

