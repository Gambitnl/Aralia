# UI Modals And Floating Windows

Verified: 2026-08-27

## Purpose

This domain covers two related but separate UI systems:

1. floating windows, which can move, resize, maximize, close, and overlap; and
2. modal orchestration, which registers open overlays for Escape priority,
   background scroll locking, and focus handling.

They share product surfaces, but they do not have one all-purpose manager.
Keeping their owners explicit prevents another product from copying
`WindowFrame` and accidentally assuming it also owns open state, Escape, focus,
or stacking.

## Canonical Ownership

The current owner is layered:

- `src/components/DesignPreview/DesignPreviewPage.tsx` is the only current
  multi-window workspace owner. Its `steps` records register preview content;
  it renders open ids back-to-front and supplies the pointer boundary that asks
  a pressed window to come forward.
- `src/hooks/useWindowStack.ts` is the portable ordered-id behavior extracted
  from that owner. It opens, closes, queries, and brings stable ids to the front.
  It has no content, visual, geometry, storage, keyboard, or ARIA dependency.
- `src/components/ui/WindowFrame.tsx` is the shared floating-window shell. It
  binds a title and opaque children to the geometry hook and Aralia's current
  title-bar chrome.
- `src/hooks/useResizableWindow.ts` owns size, position, drag, resize,
  maximize/default restore, reset, viewport clamping, and size persistence.
- `src/components/layout/GameModals.tsx` owns main-game modal registration and
  render wiring. `src/hooks/useModalOrchestration.ts` consumes its ordered
  `ModalEntry[]` registry for Escape and background scroll behavior.
- `src/hooks/useFocusTrap.ts` owns Tab wrapping, initial focus, Escape when a
  caller supplies `onClose`, and focus restoration.
- `src/components/ui/ModalDialog.tsx` is the separate blocking-dialog shell. It
  portals above floating windows, dims the background, and always uses
  `useFocusTrap`; it is not the movable-window abstraction.

`GameModals.tsx` already contains unrelated in-progress work and was not edited
for this contract extraction.

## Portable Floating-Window Contract

The table below is the behavior Character Forge can adopt. It records only what
Aralia actually does today.

| Concern | Current Aralia behavior | Portable boundary |
| --- | --- | --- |
| Panel registration | The workspace owns stable ids and content descriptors. Design Preview uses its `steps` array. There is no global floating-window registry. | Keep product titles, permissions, and render functions in a Character Forge registry; pass only ids to `useWindowStack`. |
| Open | `openOrBringToFront(id)` appends an absent id, so its keyed component mounts last. | `useWindowStack` |
| Close | `closeWindow(id)` removes the id and unmounts that keyed window. Reopening mounts it again. | `useWindowStack`; content cleanup remains product-owned. |
| Float / dock | `WindowFrame` is a fixed-position floating shell. Aralia has no generic docked-panel mode and `useWindowStack` does not track a dock/float state. | Reuse floating behavior only. Character Forge must define docking as new product behavior if it needs it. |
| Minimize / restore | Aralia does **not** have a generic minimize state or taskbar. Closing and later reopening is not minimization because content unmounts. | Do not advertise minimization when copying this contract. Add it as new Character Forge behavior only after defining whether hidden content stays mounted. |
| Maximize / restore | `WindowFrame` starts maximized by default unless stored size exists. Its toggle switches between viewport-filling geometry and the shared 1024 by 800 default; it does not restore the exact pre-maximize rectangle. | `useResizableWindow.handleMaximize` |
| Reset | Reset exits maximized mode, returns to the clamped shared default, centers the frame, and removes its stored size. | `useResizableWindow.handleReset` |
| Drag / move | Primary-button drag starts on the title bar, except from buttons, links, form controls, or `[role="button"]`. Movement is clamped to the viewport and visible top-page chrome. | `useResizableWindow.handleDragStart`; the caller chooses the drag handle. |
| Resize | Eight pointer-only edge/corner zones resize within responsive minimum and workspace maximum bounds. | `useResizableWindow.handleResizeStart`; `ResizeHandles` is Aralia's visual/pointer adapter. |
| Stacking | Design Preview renders ids back-to-front. Every `WindowFrame` has the same z-index, so the final DOM sibling paints on top. A capture-phase pointer press calls `openOrBringToFront(id)`. Keyed reordering preserves the mounted panel instance. | `useWindowStack`; the workspace owns the event boundary and rendering order. |
| Focus | Bringing a floating window forward does **not** programmatically move DOM focus. `WindowFrame` itself does not trap focus. Main-game modal wrappers opt into `useFocusTrap`; blocking `ModalDialog` always does. | Choose focus behavior separately. Do not describe visual stacking as keyboard focus. |
| Geometry persistence | Only `{ width, height }` is written, under the caller's `storageKey`, when pointer resizing ends. Position, maximized state, open ids, and stack order are not persisted. A reopened stored-size window is centered and then clamped. | `SafeStorage` plus `safeJSONParse` inside `useResizableWindow` |
| Keyboard | `WindowFrame` buttons are ordinary keyboard buttons. Drag and resize have no keyboard equivalent. `WindowFrame` does not listen for Escape. `useModalOrchestration` handles fallback Escape in capture phase; `useFocusTrap` handles Tab and optional child-owned Escape. | Compose the hooks intentionally; do not add both Escape owners for one entry. |
| ARIA | `WindowFrame` exposes one `role="dialog"`, `aria-modal="true"`, and `aria-label={title}`. Resize hit zones are `aria-hidden`. `ModalDialog` also supports labelled and described blocking dialogs. | Reuse the semantics only if the Character Forge surface is truly modal. Multiple concurrent `aria-modal` windows need an accessibility decision rather than blind copying. |
| Responsive fallback | Geometry keeps a 20-pixel side/bottom margin and a 12-pixel gap below visible top headers. The normal minimum is 600 by 400, but the viewport wins on cramped screens; callers may request a larger desktop minimum. WindowFrame's title/actions wrap and current controls use 44-pixel targets. | Port the clamp policy independently from Aralia's Tailwind classes and visual tokens. |

## Copy-Ready APIs

### Ordered multi-window state

`src/hooks/useWindowStack.ts` depends only on React. Its public controller is:

```ts
interface WindowStackController<WindowId extends string> {
  orderedOpenIds: readonly WindowId[];
  openOrBringToFront(windowId: WindowId): void;
  closeWindow(windowId: WindowId): void;
  isWindowOpen(windowId: WindowId): boolean;
}
```

The file also exports the pure `normalizeWindowStack`, `moveWindowToFront`, and
`removeWindowFromStack` transitions. Array order is back-to-front; the final id
must render last.

### Floating geometry

`src/hooks/useResizableWindow.ts` accepts a frame ref, a stable storage key, and:

```ts
interface ResizableWindowOptions {
  initialMaximized?: boolean;
  minimumSize?: Partial<{ width: number; height: number }>;
}
```

It returns `size`, `position`, `resizeState`, `dragState`, `isMaximized`,
`handleResizeStart`, `handleDragStart`, `handleMaximize`, and `handleReset`.
Its non-React dependencies are `SafeStorage` and `safeJSONParse` from
`src/utils/core`; it also uses browser viewport, document listener, header
measurement, `requestAnimationFrame`, and `getBoundingClientRect` APIs.

### Modal registration and keyboard ownership

`src/hooks/useModalOrchestration.ts` depends only on React and browser DOM APIs.
Its registry entry is:

```ts
interface ModalEntry {
  id: string;
  isOpen: boolean;
  close?: () => void;
  locksBackgroundScroll: boolean;
}
```

Array order here is **front-to-back for Escape**: index zero is the first open
entry dismissed. This is deliberately the opposite traversal convention from
`useWindowStack`, whose final id renders frontmost. Do not merge the two arrays
without an explicit conversion.

## Character Forge Adoption

Character Forge can adopt the behavior without importing Aralia's aesthetic:

1. Define a Character Forge-owned descriptor registry with stable ids, titles,
   permissions, and render functions. Keep all domain content there.
2. Copy or adapt `useWindowStack.ts` unchanged for ordered open ids. Render the
   ids in returned order with stable React keys, and call
   `openOrBringToFront(id)` from both launchers and the window pointer boundary.
3. Build a Character Forge shell component that accepts title, opaque children,
   close, maximize, and reset callbacks. Do not copy `WindowFrame` Tailwind
   classes, SVG icons, fonts, colors, borders, shadows, or z-index tokens.
4. If movable/resizable panels are wanted, port the state and clamp policy from
   `useResizableWindow.ts`, then inject Character Forge storage and workspace
   measurement boundaries. Keep the storage key unique per panel.
5. Compose Escape, scroll locking, and focus separately. Use a `ModalEntry[]`
   equivalent only for overlays that are actually modal; use a focus trap only
   when background interaction should be unavailable.
6. Add minimize only as a new, explicit state machine. Decide whether minimize
   preserves mounted content, geometry, focus return, and stack position before
   exposing the control.

## Migration Risks

- Equal z-index stacking works because the frames are sibling DOM nodes. A new
  stacking context, portal strategy, or per-window z-index policy changes the
  ordering rule.
- Pointer bring-to-front is not keyboard focus. Character Forge needs an
  explicit focus policy for keyboard and assistive-technology users.
- `aria-modal="true"` on several simultaneously visible windows is not a
  complete multi-window accessibility model. Preserve Aralia's current truth in
  the handoff, but reassess the role when Character Forge chooses its layout.
- Closing unmounts content. Unsaved component-local state disappears even
  though the stored size may return on reopen.
- Current persistence is size-only and write-on-resize-end. Drag position,
  maximize state, open state, and stacking do not survive remount or reload.
- Maximize restore means "shared default", not "previous rectangle". A desktop
  metaphor that promises exact restoration needs additional state.
- The geometry hook assumes `window` and `document`. Server rendering needs a
  client boundary or an injected environment adapter.
- Escape priority and visual stack order use opposite array conventions. Mixing
  them silently dismisses the wrong panel.
- `src/components/DesignPreview/DesignPreviewPage.tsx` is present in the shared
  working checkout but remains local-only under the broad Design Preview ignore
  rule. Do not assume a fresh Aralia clone contains that owner. The extracted
  hook, focused test, and this domain contract are the Git-visible handoff.

## Orchestration Contract (GG-20)

Before 2026-08-17, `GameModals.tsx` carried three hand-maintained lists that had
to agree with each other by inspection:

1. the fallback Escape handler's topmost-first `if` chain,
2. the `shouldLockBackgroundScroll` boolean (`||` over ~23 flags),
3. the `backgroundLockKey` array (the same ~23 flags again).

A modal added to one list but not the others silently broke either Escape
dismissal or scroll locking. The contract is now single-sourced in
`src/hooks/useModalOrchestration.ts`:

- **`ModalEntry`** - a record of `{ id, isOpen, close?, locksBackgroundScroll }`.
  `id` must be stable across renders (it is the fragment in the scroll-lock key).
  `close` is omitted for modals that bind their own Escape via `useFocusTrap`;
  they still join the scroll lock.
- **`resolveTopmostOpenModal(entries)`** - the fallback Escape priority: index 0
  is topmost and dismissed first; entries without `close` are skipped.
- **`shouldLockBackgroundScroll(entries)`** / **`backgroundLockKey(entries)`** -
  the single source for whether the background is locked and the stable key over
  the set of open, scroll-locking modals.
- **`useModalOrchestration(entries)`** - drives both shared behaviors: a
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

- `src/hooks/useWindowStack.ts` - portable open, close, query, normalization,
  and back-to-front ordering over stable string ids.
- `src/components/DesignPreview/DesignPreviewPage.tsx` - owns the concrete
  descriptor registry, renders the ordered ids, and requests bring-to-front on
  pointer press without remounting keyed panel content.
- `src/components/ui/WindowFrame.tsx` - current Aralia floating-window chrome
  and the named dialog boundary.
- `src/hooks/useResizableWindow.ts` - pointer drag/resize, clamp, maximize,
  reset, and size-only persistence.
- `src/components/ui/ResizeHandles.tsx` - Aralia's pointer hit zones; deliberately
  absent from the keyboard and accessibility control order.
- `src/components/ui/ModalDialog.tsx` - separate blocking, portalled,
  focus-trapped dialog shell.
- `src/hooks/useModalOrchestration.ts` - the `ModalEntry` type, the three pure
  helpers, and the `useModalOrchestration` hook.
- `src/components/layout/GameModals.tsx` - builds the single ordered
  `modalEntries` registry (array order = Escape priority) and calls
  `useModalOrchestration(modalEntries)`; no longer defines
  `shouldLockBackgroundScroll`, `backgroundLockKey`, `handleFallbackEscape`, or
  the background scroll-lock refs.
- `src/components/layout/DebugModals.tsx` - the four debug/dev-tool modals
  extracted earlier (GG-20 first step), each with its own `useFocusTrap`.
- `src/hooks/useFocusTrap.ts` - per-modal focus trapping; child `useFocusTrap`
  instances receive `onClose` for their own Escape handling.

Focused proof lives in:

- `src/hooks/__tests__/useWindowStack.test.ts`
- `src/components/ui/__tests__/WindowFrame.test.tsx`
- `src/hooks/__tests__/useResizableWindow.test.tsx`
- `src/hooks/__tests__/useModalOrchestration.test.ts`
- `src/hooks/__tests__/useFocusTrap.test.tsx`

## Decomposition Plan (GG-86-GG-116)

Each remaining modal render block in `GameModals.tsx` is tracked as an individual
sub-gap in `docs/projects/GLOBAL_GAPS.md` (GG-86-GG-116). The rule for a manager
extraction is now simpler:

1. Move the render block verbatim into the categorized manager (SystemModals /
   GameplayModals / EconomyModals), preserving its focus trap, props, and
   dispatch wiring.
2. Export a `ModalEntry[]` fragment from the manager (its own open-state flags +
   close handlers).
3. The parent composes the fragments into one ordered list before calling
   `useModalOrchestration` - array order is the Escape priority.
4. `GameModals.test.tsx` stays green as the behavior proof.

GG-116 is done (2026-08-17): the dead `ThreeDModal` lazy import was removed
from `GameModals.tsx` and the orphaned `ThreeDModal.tsx` module (plus its `.d.ts`
sibling) was deleted after confirming zero references.

Re-verified 2026-08-26: nothing in `src/` imports `ThreeDModal/Scene3D` or any
remaining `ThreeDModal/` component. The earlier claim that "`Scene3D` feeds the
Battle Map 3D surface" was stale - the Battle Map 3D surface is fed by
`src/components/BattleMap/BattleMap3D.tsx` and its own `OpeningThreatScene3D`,
not by `ThreeDModal/`. The clock-capable sky pieces (`TakramSkySystem` +
`lighting.ts`) were extracted to `src/components/World3D/sky/` so the
stars/moon/volumetric-cloud capability survives for a future World3D night-sky
port; `Scene3D` imports them from the new home. The remainder of
`src/components/ThreeDModal/` (Scene3D included) is orphaned pending a
keep-or-delete decision.
