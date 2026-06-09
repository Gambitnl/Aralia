# PartyOverlay Component

Status: current
Last verified: 2026-06-08

## Purpose

`PartyOverlay.tsx` renders the party roster inside a `WindowFrame` modal (draggable, resizable). It displays party member cards via `PartyPane` and provides a footer with Short Rest and Long Rest actions.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | Controls overlay visibility. Early-returns `null` when false. |
| `onClose` | `() => void` | Yes | Callback to close the overlay (delegated to `WindowFrame.onClose`). |
| `party` | `PlayerCharacter[]` | Yes | Party member array passed to `PartyPane` for rendering. |
| `onViewCharacterSheet` | `(character: PlayerCharacter) => void` | Yes | Opens the character sheet for a given party member. |
| `onFixMissingChoice` | `(character: PlayerCharacter, missing: MissingChoice) => void` | Yes | Routes a missing-choice warning click to the fix flow. |
| `onLongRest` | `() => void` | No | Callback to initiate a long rest. Button hidden when not provided. |
| `onShortRest` | `() => void` | No | Callback to initiate a short rest. Button hidden when not provided. |
| `shortRestTracker` | `ShortRestTracker` | No | Used to compute remaining short rests for the day (max 3). |

## Core Functionality

1. **WindowFrame host**: Uses `WindowFrame` with `storageKey={WINDOW_KEYS.PARTY_OVERLAY}` for persistent window position/size. Does not use `framer-motion` directly.
2. **Party content area**: Scrollable region rendering `PartyPane` with `party`, `onViewCharacterSheet`, and `onFixMissingChoice`.
3. **Rest footer**: Fixed footer with Long Rest and Short Rest `FooterButton` components. Short Rest shows a badge like `2/3` indicating remaining rests and disables when exhausted.
4. **Short rest calculation**: `shortRestsRemaining = 3 - (shortRestTracker?.restsTakenToday ?? 0)`. Disabled when zero.

## Sub-components

- **`FooterButton`**: Internal helper rendering an icon (via `GlossaryIcon`), label, optional badge, and optional `Tooltip`. Supports `primary` (amber) and `secondary` (ghost) variants.

## Integration

Mounted in `GameModals.tsx` inside a lazy `Suspense` + `ErrorBoundary` wrapper:

```tsx
<PartyOverlay
    isOpen={gameState.isPartyOverlayVisible}
    onClose={handleClosePartyOverlay}
    party={gameState.party}
    onViewCharacterSheet={handleOpenCharacterSheet}
    onFixMissingChoice={onFixMissingChoice}
    onLongRest={() => onAction({ type: 'TOGGLE_LONG_REST_MODAL', label: 'Long Rest' })}
    onShortRest={() => onAction({ type: 'SHORT_REST', label: 'Short Rest' })}
    shortRestTracker={gameState.shortRestTracker}
/>
```

Visibility is toggled via `TOGGLE_PARTY_OVERLAY` action (routed from `SystemMenu`).

## Companion / party boundary

`PartyOverlay` accepts `party: PlayerCharacter[]` only. Companion data (`gameState.companions`) is not threaded to the overlay. See NORTH_STAR.md companion boundary section and G7 in GAPS.md.
