# Aralia RPG - Feature TODO List

This file tracks planned features, enhancements, and tasks for the Aralia RPG project.

## Core Gameplay Systems

*   **Saving and Loading Games**:
    *   **[DONE]** Implement functionality to save game progress (player state, inventory, world state including `mapData`, `subMapCoordinates`, game log, dynamic item states, `saveVersion`, `saveTimestamp`).
    *   **[DONE]** Implement functionality to load saved games from a default slot, including version checking and resetting transient UI states.
    *   **[DONE]** Add a "Continue Game" option on the main menu to load the most recent save.
    *   **[DONE]** Provide "Save Game" button in `ActionPane`.
    *   **[DONE]** Allow "Main Menu" button to save game before exiting (if not in dev dummy mode).
    *   **[TODO]** Implement multiple save slots.
*   **Character Sheet & Equipment**:
    *   **[DONE]** Display a Character Sheet modal when a party member is clicked.
    *   **[DONE]** Implement a visual Equipment Mannequin UI with slots.
    *   **[DONE]** Implement logic for equipping and unequipping items.
    *   **[DONE]** Update character stats (AC, etc.) based on equipped items.
*   **Combat System**:
    *   **[DONE]** Develop a turn-based tactical combat system on a procedural map.
    *   **[DONE]** Refactor combat system to use a D&D 5e-style action economy (Action, Bonus Action, Reaction, Movement).
    *   **[PARTIALLY DONE]** Implement a full range of abilities and spells. Basic attacks and some spells are supported via `spellAbilityFactory`.
    *   **[TODO]** Implement complex enemy AI for combat decisions.
    *   **[TODO]** Integrate visual feedback (damage numbers, effect icons) into the battle map.
*   **Quest System**:
    *   **[TODO]** Implement a robust quest system with objectives, tracking, and rewards.
    *   **[TODO]** Allow quests to be given by NPCs or discovered in the world.
*   **Character Progression**:
    *   **[TODO]** Leveling up system.
    *   **[TODO]** Gaining new abilities/spells upon level-up.
    *   **[TODO]** Improving stats or choosing feats.
*   **Feat System**:
    *   **[TODO]** Integrate feats as part of character creation and progression.
    *   *(Note: The 'Versatile' trait for Humans is currently descriptive; no mechanical feat system is implemented yet.)*
*   **Economy System**:
    *   **[DONE]** Introduce currency (PP, GP, EP, SP, CP).
    *   **[DONE]** Implement Merchant interface with buying/selling.
    *   **[DONE]** Dynamic merchant inventory generation based on village economy context.
*   **Rest Mechanics**:
    *   **[DONE]** Implement Short Rest and Long Rest mechanics for recovery of HP, spell slots, and feature uses.
*   **Secure Dice Roll Handling**:
    *   **[TODO]** Implement server-side or secure client-side dice rolls that are not vulnerable to client-side manipulation.
*   **Party Members**:
    *   **[DONE]** System supports multiple party members in state and combat.
    *   **[PARTIALLY DONE]** Implement in-game mechanics for NPCs to join or leave the party (Game Guide can generate sheets, but full recruitment flow is pending).
    *   **[TODO]** Basic AI for party members in combat.
*   **Character Age in Creation**:
    *   **[TODO]** Add Age selection to Character Creation.
    *   **[TODO]** Define and display logical age ranges for each race.

## World & Exploration

*   **Advanced World Map Features**:
    *   **[TODO]** Implement more sophisticated procedural generation algorithms for biome zones (e.g., Perlin noise, cellular automata).
    *   **[TODO]** Allow procedural generation of actual `Location` data for unkeyed map tiles.
    *   **[TODO]** Add map markers for POIs, discovered locations, quests.
    *   **[TODO]** Implement map panning and zooming.
*   **Points of Interest (POI) System**:
    *   **[TODO]** Define and distribute POIs (shrines, landmarks) across map tiles.
*   **Towns & Cities**:
    *   **[DONE]** Develop procedural village generation (`VillageScene`).
    *   **[DONE]** Implement interactive buildings (Inns, Shops) within villages.
*   **Living NPCs & Social System**:
    *   **[DONE]** NPC Memory System (Disposition, Known Facts, Goals).
    *   **[DONE]** Gossip System (Information spread between NPCs).
    *   **[DONE]** Suspicion & Plausibility System for social checks.
    *   **[DONE]** Logbook for tracking NPC relationships and history.
    *   **[TODO]** Develop NPC routines and faction affiliations.
*   **In-Game Time**:
    *   **[DONE]** Display current in-game time (Day, HH:MM).
    *   **[TODO]** Implement season-based mechanics.

## AI & Storytelling (Gemini Integration)

*   **DM (Storyteller) Consistency**:
    *   **[ONGOING]** Improve consistency of Gemini-powered storyteller.
*   **Logbook-Fueled Gemini Inference**:
    *   **[DONE]** Utilize NPC memory and active goals to provide context for AI dialogue generation.
*   **Gemini-Generated Custom Actions**:
    *   **[DONE]** Suggest context-aware actions (e.g., "Look Around").
    *   **[DONE]** Implement "Egregious Acts" detection and consequences.
*   **Tile Inspection**:
    *   **[DONE]** Immersive, jargon-free descriptions of submap terrain.
*   **Game Guide Chatbot**:
    *   **[DONE]** Implement an AI assistant for rules and character generation (`GameGuideModal`).

## UI/UX Enhancements

*   **Minimap**:
    *   **[TODO]** Implement a small, always-visible version of the main map.
*   **Map Tile Tooltips**:
    *   **[DONE]** Hover tooltips for biome, coordinates, and location names.
*   **Quest Indicators**:
    *   **[TODO]** Visual indicators on map for quest objectives.
*   **Inventory Management**:
    *   **[DONE]** Equipping items from inventory.
    *   **[DONE]** Displaying total inventory weight.
    *   **[TODO]** Implement item containers (bags) and comparison UI.
*   **Sound**:
    *   **[DONE]** TTS for NPC dialogue.
    *   **[TODO]** Ambient sounds and music.
*   **Accessibility**:
    *   **[ONGOING]** ARIA implementations, keyboard navigation.
*   **Scene Visuals**:
    *   **[PAUSED]** `ImagePane` component exists, but image generation is currently disabled to manage API quotas.
*   **Tooltips for Keywords**:
    *   **[DONE]** Implemented clickable/hoverable tooltips for game terms.
*   **Submap Display**:
    *   **[DONE]** Detailed local view (`SubmapPane`) with procedural visuals.
*   **Glossary**:
    *   **[DONE]** Comprehensive, searchable glossary for rules, spells, races, and classes.

## Technical & System

*   **Documentation**:
    *   **[ONGOING]** Maintain up-to-date READMEs.
*   **Error Handling**:
    *   **[DONE]** `ErrorBoundary` implementation.
*   **Code Quality**:
    *   **[DONE]** Centralized AI client.
    *   **[DONE]** Refactored state management (`useReducer` slices).
    *   **[DONE]** Modular action handlers.
    *   **[DONE]** Externalized CSS.
