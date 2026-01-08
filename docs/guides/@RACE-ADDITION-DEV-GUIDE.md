# Race Addition Guide (Developer)

Adding a new race (or subrace) to Aralia involves updating several data layers to ensure it is selectable in the character creator, usable by the NPC generator, and searchable in the glossary.

---

## 🏗️ Step 1: Define Mechanical Data

Create a new file in `src/data/races/[race_id].ts`. This defines the stats and traits shown during character creation.

### Key Fields (Race Interface)
- **`id`**: Unique kebab-case ID (e.g., `hill_dwarf`).
- **`baseRace`**: (Optional) The parent group ID. If omitted, the race is its own group.
- **`traits`**: An array of strings. Follow the pattern `Name: Description`.
  - **CRITICAL**: Use the exact prefixes `Creature Type:`, `Size:`, `Speed:`, and `Darkvision:` for core stats. The UI parser relies on these.
- **`visual`**: Define the icon, color, and illustration paths for both male and female characters.

```typescript
export const MY_RACE_DATA: Race = {
  id: 'my_race',
  name: 'My Race',
  baseRace: 'human', // Groups it under Human in the UI
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'My Special Trait: You can do cool things.',
  ],
  visual: {
    id: 'my_race',
    icon: '👤',
    color: '#ACBCAF',
    maleIllustrationPath: 'assets/images/races/my_race_male.png',
    femaleIllustrationPath: 'assets/images/races/my_race_female.png',
  }
};
```

### Race Images
Place character illustrations in `public/assets/images/races/` with the naming convention:
- `[race_id]_male.png` - Male character illustration
- `[race_id]_female.png` - Female character illustration

Images should depict middle-aged characters in everyday clothes appropriate to the race, engaged in a daily activity within their typical living environment (village, forge, forest, etc.).

---

## 🔗 Step 2: Register the Race

### Central Registry
Add your export to [src/data/races/index.ts](file:///c:/Users/gambi/Documents/Git/AraliaV4/Aralia/src/data/races/index.ts).
- Import the data object.
- Add it to `ALL_RACES_DATA`.

### Groups (Character Creator UI)
If this is a new "parent" race, add an entry to [src/data/races/raceGroups.ts](file:///c:/Users/gambi/Documents/Git/AraliaV4/Aralia/src/data/races/raceGroups.ts). This controls the accordion headers in the character creator.

---

## 🤖 Step 3: NPC Generation Data

To allow the game to generate NPCs of this race, you MUST update two files:

1.  **Names**: Add an entry to [src/data/names/raceNames.ts](file:///c:/Users/gambi/Documents/Git/AraliaV4/Aralia/src/data/names/raceNames.ts) with `male`, `female`, and `surnames`.
2.  **Traits**: Add constraints to [src/data/names/physicalTraits.ts](file:///c:/Users/gambi/Documents/Git/AraliaV4/Aralia/src/data/names/physicalTraits.ts). This defines valid hair colors, age ranges, and height/weight modifiers.

---

## 📘 Step 4: Glossary Integration

Adding a race to the code makes it "playable," but it also needs to be "readable" in the encyclopedia.

1.  **Create Entry**: Add a JSON file to `public/data/glossary/entries/races/[race_id].json`.
    - Follow the format in [@GLOSSARY-CONTRIBUTOR-GUIDE.md](file:///c:/Users/gambi/Documents/Git/AraliaV4/Aralia/docs/guides/@GLOSSARY-CONTRIBUTOR-GUIDE.md).
    - Use the `markdown` field to create a sleek trait table.
2.  **Regenerate Index**:
    ```bash
    npm run glossary:index
    ```

---

## ✅ Checklist
- [ ] `src/data/races/my_race.ts` created with `visual` spec.
- [ ] `src/data/races/index.ts` updated.
- [ ] Race images added to `public/assets/images/races/` (male + female).
- [ ] `src/data/names/raceNames.ts` updated.
- [ ] `src/data/names/physicalTraits.ts` updated.
- [ ] `public/data/glossary/entries/races/my_race.json` created.
- [ ] (If Subrace) Entry manually nested in `character_races.json`.
- [ ] Index regenerated.
