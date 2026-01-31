# Crafting Component Documentation (Ralph)

## Overview
This folder contains the logic for Item Creation, divided into two primary engines: a "Standard" (Legacy?) system and an "Enhanced" engine with quality tiers and progression. It also includes an Experimental Alchemy system.

## Files
- **craftingEngine.ts**: The "Modern" crafting core. Features `checkRecipeCraftability` (validation) and `attemptCrafting` (execution). It includes logic for Quality Tiers (Ruined to Legendary), XP gain, and time consumption. It uses `rollDice` directly.
- **craftingSystem.ts**: A "Legacy" or "Lightweight" system. Features `attemptCraft`. It relies on a `crafter.rollSkill` callback injection pattern, making it distinct from the Engine. It supports "Quality Outcomes" tables.
- **alchemySystem.ts**: An experimental discovery-based system. Instead of selecting a recipe, players mix reagents (`attemptAlchemy`). The system analyzes the *properties* of ingredients (e.g., 'toxic', 'curative') to determine the result dynamically.

## Issues & Opportunities
- **Redundancy**: `craftingEngine.ts` and `craftingSystem.ts` seem to solve the same problem but with different architectures. `craftingEngine` appears more robust for a game loop (Progression, Time), while `craftingSystem` might be better for simple checks or NPC crafting.
- **Alchemy System**: `attemptAlchemy` uses a simple "First Match" recipe search. If a player adds ingredients that satisfy *multiple* recipes (e.g., a complex potion that also satisfies a simple poison), it will always pick the first one defined in the array, potentially masking the complex result.
- **Hardcoded Maps**: `checkRecipeCraftability` in `craftingEngine` uses a hardcoded `toolMap` string matching which is brittle if tool names change in the data layer.
