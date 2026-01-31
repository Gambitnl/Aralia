# Religion System Documentation (Ralph)

## Overview
This folder manages the player's relationship with the Pantheon. It handles Divine Favor (reputation with gods), Temple services (Healing, Blessings), and the application of magical effects resulting from prayer or offerings.

## Files
- **TempleSystem.ts**: The Interaction Handler. Validates `validateServiceRequest` (checking both gold and favor standing) and resolves the effects of rituals (e.g. `grant_blessing_minor`).
- **CombatReligionAdapter.ts**: (Not yet commented) Bridges religious buffs into the combat engine.

## Issues & Opportunities
- **Hardcoded Effects**: `resolveServiceEffect` uses a switch-case with hardcoded string effects (e.g. `heal_20_hp`). This logic should be moved to a data-driven effect system (similar to Spells) to allow for easier expansion of temple services.
- **Favor Storage**: Standings are stored in `gameState.divineFavor`. There is some legacy drift noted in `appState.ts` regarding flat maps vs nested objects for favor.
