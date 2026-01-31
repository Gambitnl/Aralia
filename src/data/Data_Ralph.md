# Data Component Documentation (Ralph)

## Overview
This folder contains the Static Blueprint of the game world. It defines the "Laws" and "Entities" that exist before the player starts their journey. It includes everything from Biome definitions to Faction ideologies and Trade Route networks.

## Files
- **biomes.ts**: The Climate and Ecology rules. Uses an inheritance model (Family -> Variant) to define spawn weights, colors, and hazards for different regions.
- **factions.ts**: The Socio-Political landscape. Defines faction types (Guild, Noble House, Syndicate), their core values (used by AI for dialogue), and initial standing.
- **tradeRoutes.ts**: The Economic Network. Defines major connection points between regions, their risk levels, and the goods they transport.
- **glossaryData.ts**: The Visual Legend. Maps submap emojis to descriptive labels for use in UI tooltips and AI environmental descriptions.
- **backgrounds.ts**: (Not yet commented) Character origin options.
- **items/**: (Directory) Templates for weapons, armor, and consumables.

## Issues & Opportunities
- **Inheritance Merging**: `biomes.ts` merging logic is additive only. If a base family has a "Hazard", a variant cannot currently "Remove" it, only add more.
- **Magic Strings**: `glossaryData.ts` relies on emojis as keys. If the submap generation logic changes an emoji (e.g. 🌲 to 🌳), the legend will break silently unless updated.
- **Object Duplication**: `biomes.ts` contains `LEGACY_ALIASES` which duplicates large objects for backward compatibility. This should be refactored into a mapping function to save memory.
