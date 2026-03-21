# Improvement Note: Settings Menu

## Status

This remains a live feature plan.
A dedicated user-facing settings menu was not verified during the current pass.

## Verified Current State

- The main menu exists in src/components/layout/MainMenu.tsx.
- The main menu currently exposes New Game, World Generation, Save To Slot, Load Game, Glossary, and development-only actions.
- The current pass did not verify an existing dedicated Settings modal or Settings screen in the main menu flow.
- The current pass also did not verify a central user-facing settings panel wired through the in-game system surfaces.

## Verified Gap

A dedicated settings menu still appears to be missing as a first-class user-facing feature.
That means this note is still useful as a live plan, but its original wording should not be treated as proof that the target UI already exists.

## Rebased Improvement Direction

### 1. Start With One Real Preference

The safest first setting is still a small, high-value preference such as reduced motion or animation control.
That gives the menu a clear reason to exist without requiring a full options suite on day one.

### 2. Reuse Existing Menu And Modal Patterns

Any future settings flow should extend the existing menu and modal language already used in the app instead of inventing a disconnected UI pattern.

### 3. Separate Preference Storage From Menu Presence

The plan should answer two different questions:
- where preferences are stored in the current state/save model
- where the player opens and changes those preferences in the UI

### 4. Land One Vertical Slice First

A good first slice would be:
- one preference in state
- one modal or settings surface to edit it
- one existing UI behavior that actually changes based on that setting

## Preserved Historical Value

This note still captures a valid product need:
- comfort and accessibility settings matter
- a settings surface creates room for future preferences
- animation or motion controls are a sensible early option

What it should not be used for is claiming that the repo already contains the finished settings menu described here.