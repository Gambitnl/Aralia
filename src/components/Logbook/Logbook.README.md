# Logbook Components

The `src/components/Logbook` directory contains components related to the player's personal journals and history tracking. These are dynamic records that evolve as the player interacts with the world.

## Components

### [DossierPane.tsx](file:///c:/Users/gambi/Documents/Git/AraliaV4/Aralia/src/components/Logbook/DossierPane.tsx)
Displays the "Dossier" (formerly known as the LogbookPane), which tracks:
- **Met NPCs**: A list of characters the player has interacted with.
- **Disposition**: Visual feedback on how an NPC feels about the player (Friendly, Hostile, etc.).
- **Suspicion**: Tracks how suspicious or alert an NPC is.
- **Goals**: Displays the NPC's motivations and their current status (Active, Completed, Failed).
- **Chronicle**: A narrative history of facts learned and interactions shared with the NPC.

### [DiscoveryLogPane.tsx](file:///c:/Users/gambi/Documents/Git/AraliaV4/Aralia/src/components/Logbook/DiscoveryLogPane.tsx)
Displays the "Discovery Journal", which tracks:
- **Exploration History**: A log of locations and secrets discovered.
- **Consequences**: Shows which NPCs are aware of specific discoveries.
- **Filtering & Search**: Allows the player to browse their history by type, date, or specific keywords.

## Usage

These components are typically rendered as full-screen modal overlays via `src/components/layout/GameModals.tsx`.

```tsx
<DossierPane
  isOpen={gameState.isLogbookVisible}
  onClose={() => dispatch({ type: 'TOGGLE_LOGBOOK' })}
  metNpcIds={gameState.metNpcIds}
  npcMemory={gameState.npcMemory}
  allNpcs={NPCS}
/>
```
