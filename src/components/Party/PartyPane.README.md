# PartyPane Component

Status: current
Last verified: 2026-06-08

## Purpose

`PartyPane.tsx` renders a vertical list of `PartyMemberCard` components for each party member. It is the main content area inside the `PartyOverlay` modal, displaying detailed combat stats, HP, spell slots, hit dice, and expendable abilities for every member.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `party` | `PlayerCharacter[]` | Yes | Array of party member characters to display. |
| `onViewCharacterSheet` | `(character: PlayerCharacter) => void` | Yes | Callback when a member's "more" button is clicked (opens character sheet). |
| `onFixMissingChoice` | `(character: PlayerCharacter, missing: MissingChoice) => void` | Yes | Callback when a missing-choice warning is clicked. |

## Core Functionality

1. **Empty state**: When `party.length === 0`, renders a centered message prompting character creation.
2. **Member card list**: Maps `party` to `PartyMemberCard` components keyed by `member.id || member.name`.
3. **Callback routing**: `onMoreClick` on each card routes to `onViewCharacterSheet(member)`. `onMissingChoiceClick` routes `onFixMissingChoice` directly.

## Sub-components (in `PartyPane/` subfolder)

### PartyMemberCard (active)

Information-dense card showing:
- **Portrait placeholder**: Circular with first-letter initial and level badge.
- **Missing-choice warning**: Animated red badge (top-right of portrait) with tooltip and fix-flow callback. Uses `validateCharacterChoices` from `@/utils/character`.
- **Stats row**: AC, Save DC (conditional, casters only), Movement speed, Initiative modifier. Each in a `StatBox` with tooltip.
- **Attack bonuses row**: Melee, Ranged, Spell Attack (conditional) with icons via `GlossaryIcon`.
- **HP bar**: Color-coded (red-700 at ≤25%, red-600 at ≤50%, red-500 otherwise) with numeric display and hit dice indicator.
- **Spell slots** (conditional): Pip display per spell level with current/max tooltip.
- **Expendable abilities** (conditional): Shows up to 2 limited-use abilities (Ki, Channel Divinity, Rage, etc.) with color-coded labels.
- **More button**: Opens the character sheet via `onMoreClick`.

### PartyCharacterButton (legacy / design preview only)

Older, simpler card variant showing name, AC shield, HP bar, race/class, and optional rich NPC data. **Not used by `PartyPane`**. Exists in the same subfolder and is referenced by `DesignPreview` and its own tests, but `PartyPane` renders `PartyMemberCard` exclusively.

## Integration

`PartyPane` is rendered inside `PartyOverlay.tsx`:

```tsx
<PartyPane
    party={party}
    onViewCharacterSheet={onViewCharacterSheet}
    onFixMissingChoice={onFixMissingChoice}
/>
```

`PartyOverlay` is mounted in `GameModals.tsx`. `PartyPane` is not rendered directly in `App.tsx` or outside the overlay.

## Accessibility

- `PartyMemberCard` more button has `aria-label` with character name.
- Missing-choice warning button has `aria-label="Fix missing character selection"`.
- `StatBox` and attack bonus displays use `Tooltip` wrappers with `cursor-help` for discoverability.
- HP bar uses percentage width with numeric text fallback.
