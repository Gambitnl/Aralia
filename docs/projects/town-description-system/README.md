# Town Description System

## Overview

Implement a dynamic town description system that generates rich, contextual town details on-demand rather than pre-generating all town data for the entire world. This creates a more scalable and interesting world where towns feel alive and unique when discovered.

## Core Concept

- **Map Generation**: Towns get basic names and key traits during world generation
- **Lazy Loading**: Rich descriptions generate when players approach towns
- **Contextual Details**: Town descriptions adapt based on race, culture, biome, and player background
- **Performance**: Only nearby towns have detailed descriptions loaded

## Key Features

1. **Save State Integration** (CRITICAL - Prevents World Changes)
   - **Immediate Persistence**: All generated content saved to game save data instantly
   - **World Consistency**: Same towns, layouts, and descriptions across save/load cycles
   - **Integrity Validation**: Corrupted save data detected and handled gracefully
   - **Autosave Integration**: Content generation triggers automatic saves

2. **Basic Town Metadata** (always generated)
   - Town name (seeded generation, persists across sessions)
   - Population size and demographics
   - Primary industry/economy type
   - Governing style and leadership
   - Cultural alignment and traditions

3. **Coordinated Town Generation** (generated on approach, saved permanently)
   - **Town Layout**: Actual buildings, streets, and structures (layout-first generation)
   - **Rich Descriptions**: History, atmosphere informed by actual town composition
   - **NPC Population**: Inhabitants based on town characteristics
   - **Current Events**: Dynamic rumors and happenings
   - **Visual Details**: Architecture, landmarks, and sensory elements

4. **Session Persistence System**
   - **Complete State**: Layout, NPCs, events, and player interactions saved
   - **Deterministic Seeds**: Same master seed produces identical towns
   - **Cache Management**: LRU cache with configurable limits
   - **Background Loading**: Anticipated towns loaded asynchronously

5. **Dynamic Generation Triggers**
   - World tile entry (coarse proximity)
   - Proximity to town tiles (configurable tile range)
   - Town interaction attempts
   - Save state validation on game load

## Architecture Goals

- Memory efficient (don't load all towns)
- Contextually rich (adapt to player/region)
- Reproducible (same seed = same town details)
- Extensible (easy to add new town types)
