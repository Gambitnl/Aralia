# UI Modals Domain

Verified: 2026-08-17

## Purpose

This domain covers the overlay/modal layer of the app: the shared orchestration
contract that governs how modals stack, dismiss on Escape, and lock background
page scroll, plus the ownership plan for decomposing the monolithic
`GameModals.tsx` manager into categorized managers.

## Orchestration Contract (GG-20)

Before 2026-08-17, `GameModals.tsx` carried three hand-maintained lists that had
to agree with each other by inspection:

1. the fallback Escape handler's topmost-first `if` chain,
2. the `shouldLockBackgroundScroll` boolean (`||` over ~23 flags),
3. the `backgroundLockKey` array (the same ~23 flags again).

A modal added to one list but not the others silently broke either Escape
dismissal or scroll locking. The contract is now single-sourced in
`src/hooks/useModalOrchestration.ts`:

- **`ModalEntry`** — a record of `{ id, isOpen, close?, locksBackgroundScroll }`.
  `id` must be stable across renders (it is the fragment in the scroll-lock key).
  `close` is omitted for modals that bind their own Escape via `useFocusTrap`;
  they still join the scroll lock.
- **`resolveTopmostOpenModal(entries)`** — the fallback Escape priority: index 0
  is topmost and dismissed first; entries without `close` are skipped.
- **`shouldLockBackgroundScroll(entries)`** / **`backgroundLockKey(entries)`** —
  the single source for whether the background is locked and the stable key over
  the set of open, scroll-locking modals.
- **`useModalOrchestration(entries)`** — drives both shared behaviors: a
  capture-phase `document` `keydown` listener (topmost-first, deferring to any
  child that already called `preventDefault()`), and the background scroll lock +
  scroll-position restore.

## Behaviors Preserved

- Escape is capture-phase and topmost-first.
- Opening any scroll-locking modal sets `body.overflow: hidden` and
  `documentElement.overscrollBehavior: contain`, restoring both on close.
- The background scroll position is captured when the lock activates and
  re-applied when the set of open, scroll-locking modals changes.

## Verified Entry Points

- `src/hooks/useModalOrchestration.ts` — the `ModalEntry` type, the three pure
  helpers, and the `useModalOrchestration` hook.
- `src/components/layout/GameModals.tsx` — builds the single 27-entry
  `modalEntries` registry (array order = Escape priority) and calls
  `useModalOrchestration(modalEntries)`; no longer defines
  `shouldLockBackgroundScroll`, `backgroundLockKey`, `handleFallbackEscape`, or
  the background scroll-lock refs.
- `src/components/layout/DebugModals.tsx` — the four debug/dev-tool modals
  extracted earlier (GG-20 first step), each with its own `useFocusTrap`.
- `src/hooks/useFocusTrap.ts` — per-modal focus trapping; child `useFocusTrap`
  instances receive `onClose` for their own Escape handling.

## Decomposition Plan (GG-86–GG-116)

Each remaining modal render block in `GameModals.tsx` is tracked as an individual
sub-gap in `docs/projects/GLOBAL_GAPS.md` (GG-86–GG-116). The rule for a manager
extraction is now simpler:

1. Move the render block verbatim into the categorized manager (SystemModals /
   GameplayModals / EconomyModals), preserving its focus trap, props, and
   dispatch wiring.
2. Export a `ModalEntry[]` fragment from the manager (its own open-state flags +
   close handlers).
3. The parent composes the fragments into one ordered list before calling
   `useModalOrchestration` — array order is the Escape priority.
4. `GameModals.test.tsx` stays green as the behavior proof.

GG-116 is done (2026-08-17): the dead `ThreeDModal` lazy import was removed
from `GameModals.tsx` and the orphaned `ThreeDModal.tsx` module (plus its `.d.ts`
sibling) was deleted after confirming zero references. `Scene3D` and the other
`ThreeDModal/` components remain — `Scene3D` feeds the Battle Map 3D surface.
