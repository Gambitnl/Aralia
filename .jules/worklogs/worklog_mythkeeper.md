# Mythkeeper's Worklog

## 2024-05-23 - Lore Authenticity & Data Structures **Learning:** The codebase previously contained a "MYTHKEEPER PROPOSAL" file (`src/data/deities/index.ts`) that was actually the active source of truth, yet it contained tentative domain assignments (e.g., Avandra having 'Freedom'). This highlights the need to finalize "proposals" into "standards" promptly to avoid technical debt where temporary lore becomes permanent. **Action:** I finalized the deity data, removing the proposal header and standardizing domains to 5e (2014/2024) norms (e.g., Avandra getting 'Trickery' and 'Peace'). I also noticed `Dragonborn` data was a mix of PHB 2014 and 2024; I standardized it towards the 2024 philosophy in flavor but retained the 2014 Ability Score Increases to ensure mechanical stability until the Background system handles stats globally.

## 2024-05-24 - Missing Races & Future Implementation Plan **Learning:** A review of `src/data/races/` revealed significant gaps in official race coverage compared to *Mordenkainen's Monsters of the Multiverse* and *Volo's Guide to Monsters*. Specifically, **Tabaxi**, **Triton**, **Kenku**, and **Tortle** are missing. **Action:** Created this TODO entry to document the implementation plan for **Tabaxi** that was prepared but deferred.

### TODO: Implement Tabaxi Race
**Source:** *Mordenkainen's Monsters of the Multiverse* (p. 26) / *Volo's Guide to Monsters* (p. 113)

**Proposed File Structure:**
- Create `src/data/races/tabaxi.ts`

**Data Structure Draft:**
```typescript
import { Race } from '../../types';

export const TABAXI_DATA: Race = {
  id: 'tabaxi',
  name: 'Tabaxi',
  description: 'Hailing from a strange and distant land, wandering tabaxi are catlike humanoids driven by curiosity to collect interesting artifacts, gather tales and stories, and lay eyes on all the world’s wonders.',
  abilityBonuses: [], // Follow 2024 PHB style (Background-based ASIs)
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
    'Cat’s Claws: You can use your claws to make unarmed strikes (1d6 + Strength slashing damage). You also have a climbing speed equal to your walking speed.',
    'Cat’s Talent: You have proficiency in the Perception and Stealth skills.',
    'Feline Agility: Your reflexes and agility allow you to move with a burst of speed. When you move on your turn in combat, you can double your speed until the end of the turn. Once you use this trait, you can’t use it again until you move 0 feet on one of your turns.',
  ],
  imageUrl: 'https://i.ibb.co/Placeholder/Tabaxi.png', // Needs asset
};
```

**Integration Steps:**
1.  Create the file above.
2.  Update `src/data/races/index.ts` to export `TABAXI_DATA`.
3.  Verify integration with Character Creator UI (ensure traits display correctly).
4.  (Future) Implement mechanical hooks for `Feline Agility` (requires a status effect or movement tracker reset trigger).
