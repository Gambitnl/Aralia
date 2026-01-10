# Race Hierarchy Blueprint

> **Status**: Planning
> **Created**: 2026-01-08
> **Last Updated**: 2026-01-09

This document defines the complete race structure for the Aralia character creator, including parent groups, subchoices, and standalone races.

---

## Architecture Overview

### Key Principles

1. **All races appear in accordions** - Even single-variant races use accordion UI for consistency
2. **Parent = Accordion only** - Parent entries are NOT selectable, only subchoices are
3. **Subchoices are complete entries** - Each subchoice is a fully-defined race with all traits
4. **Comparison table shows ALL traits** - Transposed format (traits as rows, variants as columns)
5. **Racial choices embedded in race card** - No separate creation steps for racial options
6. **Confirm button logic** - Shows "Choose [pending choice]" until all required selections made

### Folder Structure

```
src/data/races/
  _index.ts              # Auto-generated via import.meta.glob
  raceGroups.ts          # Parent group metadata

  aasimar/
    aasimar.ts           # 2024 PHB version
    protector_aasimar.ts
    scourge_aasimar.ts
    fallen_aasimar.ts

  beastfolk/
    aarakocra.ts
    giff.ts
    hadozee.ts
    harengon.ts
    kenku.ts
    leonin.ts
    lizardfolk.ts
    loxodon.ts
    minotaur.ts
    tabaxi.ts
    thri_kreen.ts
    tortle.ts
    yuan_ti.ts

  dragonborn/
    black_dragonborn.ts
    blue_dragonborn.ts
    brass_dragonborn.ts
    bronze_dragonborn.ts
    copper_dragonborn.ts
    gold_dragonborn.ts
    green_dragonborn.ts
    red_dragonborn.ts
    silver_dragonborn.ts
    white_dragonborn.ts
    # Critical Role (renamed)
    draconblood_dragonborn.ts  # CR: Draconblood
    ravenite_dragonborn.ts     # CR: Ravenite

  dwarf/
    dwarf.ts             # 2024 PHB version
    hill_dwarf.ts        # 2014 PHB
    mountain_dwarf.ts    # 2014 PHB
    duergar.ts           # Grey Dwarf
    mark_of_warding_dwarf.ts # Eberron Dragonmark

  eladrin/
    spring_eladrin.ts
    summer_eladrin.ts
    autumn_eladrin.ts
    winter_eladrin.ts

  elf/
    high_elf.ts          # 2024 lineage
    wood_elf.ts          # 2024 lineage
    drow.ts              # 2024 lineage
    sea_elf.ts           # MotM
    shadar_kai.ts        # MotM
    astral_elf.ts        # Spelljammer
    pallid_elf.ts        # CR: Pallid Elf (renamed)
    mark_of_shadow_elf.ts # Eberron Dragonmark

  genasi/
    air_genasi.ts
    earth_genasi.ts
    fire_genasi.ts
    water_genasi.ts

  gith/
    githyanki.ts
    githzerai.ts

  gnome/
    gnome.ts             # 2024 PHB version
    forest_gnome.ts      # 2014 PHB
    rock_gnome.ts        # 2014 PHB
    deep_gnome.ts        # Svirfneblin
    mark_of_scribing_gnome.ts # Eberron Dragonmark

  goliath/
    cloud_goliath.ts     # Cloud Giant ancestry
    fire_goliath.ts      # Fire Giant ancestry
    frost_goliath.ts     # Frost Giant ancestry
    hill_goliath.ts      # Hill Giant ancestry
    stone_goliath.ts     # Stone Giant ancestry
    storm_goliath.ts     # Storm Giant ancestry

  half_elf/
    half_elf.ts          # Base 2014
    half_elf_aquatic.ts  # Aquatic Elf
    half_elf_drow.ts     # Drow
    half_elf_high.ts     # High Elf
    half_elf_wood.ts     # Wood Elf
    mark_of_detection_half_elf.ts # Eberron Dragonmark
    mark_of_storm_half_elf.ts     # Eberron Dragonmark

  half_orc/
    half_orc.ts          # Base 2014
    exandrian_half_orc.ts # CR: Orc of Exandria (renamed)
    mark_of_finding_half_orc.ts # Eberron Dragonmark

  halfling/
    halfling.ts          # 2024 PHB version
    lightfoot_halfling.ts # 2014 PHB
    stout_halfling.ts    # 2014 PHB
    lotusden_halfling.ts # CR: Lotusden (renamed)
    mark_of_healing_halfling.ts # Eberron Dragonmark
    mark_of_hospitality_halfling.ts # Eberron Dragonmark

  human/
    human.ts             # 2024 PHB version
    human_diverse.ts     # 2014 PHB version (creative name TBD)
    mark_of_handling_human.ts  # Eberron Dragonmark
    mark_of_making_human.ts    # Eberron Dragonmark
    mark_of_passage_human.ts   # Eberron Dragonmark
    mark_of_sentinel_human.ts  # Eberron Dragonmark

  shifter/
    beasthide_shifter.ts
    longtooth_shifter.ts
    swiftstride_shifter.ts
    wildhunt_shifter.ts

  tiefling/
    abyssal_tiefling.ts
    chthonic_tiefling.ts
    infernal_tiefling.ts

  # Standalone races (single-item accordions)
  bugbear/
    bugbear.ts

  centaur/
    centaur.ts

  changeling/
    changeling.ts

  fairy/
    fairy.ts

  firbolg/
    firbolg.ts

  goblin/
    goblin.ts

  hobgoblin/
    hobgoblin.ts

  kalashtar/
    kalashtar.ts

  kender/
    kender.ts

  kobold/
    kobold.ts

  orc/
    orc.ts

  plasmoid/
    plasmoid.ts

  satyr/
    satyr.ts

  simic_hybrid/
    simic_hybrid.ts

  autognome/
    autognome.ts

  vedalken/
    vedalken.ts

  verdan/
    verdan.ts

  warforged/
    warforged.ts
```

---

## Race Hierarchy

### Grouped Races (Multiple Subchoices)

| Parent Group | Subchoices | Count |
|--------------|------------|-------|
| **Aasimar** | Aasimar (2024), Protector, Scourge, Fallen | 4 |
| **Beastfolk** | Aarakocra, Giff, Hadozee, Harengon, Kenku, Leonin, Lizardfolk, Loxodon, Minotaur, Tabaxi, Thri-kreen, Tortle, Yuan-ti | 13 |
| **Dragonborn** | Black, Blue, Brass, Bronze, Copper, Gold, Green, Red, Silver, White, Draconblood*, Ravenite* | 12 |
| **Dwarf** | Dwarf (2024), Hill Dwarf, Mountain Dwarf, Duergar, Mark of Warding | 5 |
| **Eladrin** | Spring, Summer, Autumn, Winter | 4 |
| **Elf** | High Elf, Wood Elf, Drow, Sea Elf, Shadar-kai, Astral Elf, Pallid Elf*, Mark of Shadow | 8 |
| **Genasi** | Air, Earth, Fire, Water | 4 |
| **Gith** | Githyanki, Githzerai | 2 |
| **Gnome** | Gnome (2024), Forest Gnome, Rock Gnome, Deep Gnome, Mark of Scribing | 5 |
| **Goliath** | Cloud, Fire, Frost, Hill, Stone, Storm | 6 |
| **Half-Elf** | Half-Elf, Aquatic, Drow, High Elf, Wood Elf, Mark of Detection, Mark of Storm | 7 |
| **Half-Orc** | Half-Orc, Exandrian*, Mark of Finding | 3 |
| **Halfling** | Halfling (2024), Lightfoot, Stout, Lotusden*, Mark of Healing, Mark of Hospitality | 6 |
| **Human** | Human (2024), Human (2014 - name TBD), Mark of Handling, Mark of Making, Mark of Passage, Mark of Sentinel | 6 |
| **Shifter** | Beasthide, Longtooth, Swiftstride, Wildhunt | 4 |
| **Tiefling** | Abyssal, Chthonic, Infernal | 3 |

*\* = Critical Role origin, renamed*

**Grouped subtotal: 92 variants**

### Standalone Races (Single-Item Accordions)

| Race | Notes |
|------|-------|
| Bugbear | |
| Centaur | Has Natural Affinity skill choice |
| Changeling | Has Instincts choice |
| Fairy | |
| Firbolg | |
| Goblin | |
| Hobgoblin | |
| Kalashtar | Eberron |
| Kender | Dragonlance |
| Kobold | |
| Orc | |
| Plasmoid | Spelljammer |
| Satyr | |
| Simic Hybrid | Ravnica |
| Autognome | Spelljammer |
| Vedalken | Ravnica |
| Verdan | Acquisitions Inc |
| Warforged | Eberron |

**Standalone subtotal: 18 races**

---

## Total Race Count

| Category | Count |
|----------|-------|
| Grouped variants | 92 |
| Standalone races | 18 |
| **Total race entries** | **110** |
| Parent groups (accordions) | 34 |

---

## Races with Embedded Choices

These races require inline selection UI in the RaceDetailPane:

| Race | Choice Type | Options |
|------|-------------|---------|
| Aarakocra | Spellcasting Ability | INT, WIS, CHA |
| Centaur | Natural Affinity Skill | Animal Handling, Medicine, Nature, Survival |
| Changeling | Instincts | 2 skills from: Deception, Insight, Intimidation, Performance, Persuasion |
| Human (2014) | Bonus Skill | Any skill |
| Tiefling variants | Spellcasting Ability | INT, WIS, CHA |
| Dragonborn variants | (none - ancestry is the choice) | - |
| Goliath variants | (none - ancestry is the choice) | - |

---

## Migration Plan

### Phase 1: Infrastructure
1. Create folder structure
2. Implement `import.meta.glob` auto-scan in index.ts
3. Update `raceGroups.ts` with all parent groups
4. Update comparison table to show ALL traits (transposed)
5. Update RaceSelection to always use accordions

### Phase 2: Migrate Existing Races
1. Move existing race files to new folder structure
2. Update `baseRace` properties to match folder names
3. Delete obsolete selection components after migration:
   - `DragonbornAncestrySelection.tsx`
   - `TieflingLegacySelection.tsx`
   - `GiantAncestrySelection.tsx`
   - `ElvenLineageSelection.tsx`
   - `GnomeSubraceSelection.tsx`
   - `RacialSpellAbilitySelection.tsx`
   - `HumanSkillSelection.tsx`
   - `CentaurNaturalAffinitySkillSelection.tsx`
   - `ChangelingInstinctsSelection.tsx`

### Phase 3: Add New Races
Priority order:
1. Complete existing groups (Mountain Dwarf, Forest/Rock Gnome, etc.)
2. Add popular missing races (Kobold, Lizardfolk, Half-Elf, Half-Orc)
3. Add Beastfolk group
4. Add remaining standalone races
5. Add Critical Role races (with renamed IDs)

### Phase 4: Documentation
1. Update `@RACE-ADDITION-DEV-GUIDE.md`
2. Update `RACE_ADDITION_GUIDE.md`
3. Update/create Character Creator READMEs
4. Add inline comments to auto-scan index.ts

---

## Excluded Races

Per project requirements, the following are NOT included:

- Variant Human (2014)
- Variant Aasimar (DMG 2014)
- Custom Lineage (Tasha's)

---

## Naming Conventions

### File Naming
- Snake_case matching race ID: `hill_dwarf.ts`
- Parent folder matches `baseRace` value

### Export Naming
```typescript
export const HILL_DWARF_DATA: Race = { ... }
```

### Creative Names for Duplicates
Decided during implementation. Examples:
- Human (2014) → "Human (Versatile)" or "Adaptable Human" or TBD
- Critical Role races → Flavor-appropriate renames TBD

---

## Architecture Notes

### Dragonborn Grouping
The Dragonborn group could potentially be subdivided into:
- **Chromatic Dragonborn**: Black, Blue, Green, Red, White
- **Metallic Dragonborn**: Brass, Bronze, Copper, Gold, Silver
- **Critical Role Variants**: Draconblood, Ravenite

This subdivision is not yet implemented but could be considered for the UI if the single accordion becomes too large.

### Half-Elf Naming
Half-Elf variants are named without "Descent" suffix (e.g., "Half-Elf (Aquatic)" not "Aquatic Descent").

## Open Questions

1. **Human (2014) name** - Decide during implementation
2. **Comparison table edge cases** - How to handle races with 10+ traits vs races with 3?
3. **Dragonborn subdivision** - Should chromatic/metallic be separate accordions?

---

## Related Documentation

- `docs/guides/@RACE-ADDITION-DEV-GUIDE.md`
- `docs/guides/RACE_ADDITION_GUIDE.md`
- `src/components/CharacterCreator/CharacterCreator.README.md`
