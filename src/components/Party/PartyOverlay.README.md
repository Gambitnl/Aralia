# PartyOverlay Component

Status: current
Last verified: 2026-06-24

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
| `isCombatActive` | `boolean` | No | Disables both rest actions and shows the combat warning when active enemies are present. |

## Core Functionality

1. **WindowFrame host**: Uses `WindowFrame` with `storageKey={WINDOW_KEYS.PARTY_OVERLAY}` for persistent window position/size. Does not use `framer-motion` directly.
2. **Party content area**: Scrollable region rendering `PartyPane` with `party`, `onViewCharacterSheet`, and `onFixMissingChoice`.
3. **Rest footer**: Fixed footer with Long Rest and Short Rest `FooterButton` components. Short Rest shows a badge like `2/3` indicating remaining rests and disables when exhausted.
4. **Combat rest gate**: When `isCombatActive` is true, both rest buttons are disabled and the footer shows "Resting is unavailable during active combat." The same warning is used as button tooltip content.
5. **Short rest calculation**: `shortRestsRemaining = 3 - (shortRestTracker?.restsTakenToday ?? 0)`. Short Rest is disabled when no rests remain or when combat is active.

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
    isCombatActive={Boolean(gameState.currentEnemies?.length)}
/>
```

Visibility is toggled via `TOGGLE_PARTY_OVERLAY` action (routed from `SystemMenu`).

## Companion / party boundary

`PartyOverlay` accepts `party: PlayerCharacter[]` and optional companion context keyed by party-member id. Companion data enriches display only; it does not validate roster membership. See NORTH_STAR.md companion boundary section and G7 in GAPS.md.
