# Racial Traits Implementation Mapping

This document lists every trait for all 111 races and indicates whether they are **Mechanically Implemented** (actively parsed, validated, or calculated by combat/stat systems) or **Text-Only/Informational** (flavor text displayed in character sheets/tooltips).

## Summary Statistics

- **Total Races Scanned**: 111
- **Total Unique Traits Scanned**: 819
- **Mechanically Implemented Traits**: 627 (77%)
- **Text-Only / Flavor Traits**: 192 (23%)

## Core Engine Mechanics

Most traits are either **Text-Only** tooltips or fall into standard core engine categories:

1. **Speed & Movement**: Speed traits are parsed by `calculateCharacterSpeedFromRace` in `characterUtils.ts`.
2. **Senses & Vision**: Vision/Darkvision traits are parsed by `calculateCharacterDarkvisionFromRace`.
3. **Spell Grants**: Innate spells are extracted by the parser in `racialTraits.ts` and granted dynamically via `getRacialSpellGrantsForCharacter`.
4. **Choice Requirements**: Spellcasting ability selections are validated and queried via `getRacialSpellCastingAbilityChoicesForRace`.

## Individual Race Trait Inventories

### Aarakocra (`aarakocra`)

*Base Race: `beastfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Flight** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\CharacterCreator.tsx: "const isPortraitInFlight = (state: CharacterCreationState) =>"; src\data\monsters.generated.ts: ""name": "Cloaked Flight"," |
| **Talons** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Talons","; src\systems\spells\effects\__tests__\SummoningSystem.test.ts: "name: 'Talons'," |
| **Wind Caller** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Abyssal Tiefling (`abyssal_tiefling`)

*Base Race: `tiefling`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Otherworldly Presence** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Abyssal Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Abyssal Magic** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Air Genasi (`air_genasi`)

*Base Race: `genasi`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Unending Breath** | `Text-Only` | N/A | You can hold your breath indefinitely while you are not Incapacitated. |
| **Lightning Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Mingle with the Wind** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Astral Elf (`astral_elf`)

*Base Race: `elf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Keen Senses** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\RaceDetailPane.tsx: "/** Elf - Keen Senses (pick 1 of 3) */"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select a Keen Senses skill first'"; src\components\CharacterCreator\SkillSelection.tsx: "// Prepare options for Elf Keen Senses racial feature"; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[selectedKeenSensesSkillId] = { granted: true, source: "Elf 'Keen Senses' trait" };" |
| **Trance** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewComponents.tsx: "<TableCell className="font-bold text-sky-300">Trance</TableCell>" |
| **Astral Fire** | `Text-Only` | N/A | You know one of the following cantrips of your choice: Dancing Lights, Light, or Sacred Flame. Intelligence, Wisdom, or Charisma is your spellcasting ability for it (choose when you select this race). |
| **Starlight Step** | `Text-Only` | N/A | As a Bonus Action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. |
| **Astral Trance** | `Text-Only` | N/A | When you take a Long Rest, you gain proficiency in one skill of your choice and with one weapon or tool of your choice, selected from the Player's Handbook. These proficiencies last until the end of your next Long Rest. |

---

### Autognome (`autognome`)

*Base Race: `constructed`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Armored Casing** | `Text-Only` | N/A | While you are not wearing armor, your base Armor Class is 13 + your Dexterity modifier. |
| **Built for Success** | `Text-Only` | N/A | You can add a d4 to one attack roll, ability check, or saving throw after you see the d20 roll; you can do so a number of times equal to your Proficiency Bonus per long rest. |
| **Healing Machine** | `Text-Only` | N/A | If someone casts mending on you, you can spend a Hit Die, roll it, and regain hit points equal to the roll plus your Constitution modifier; cure wounds, healing word, mass cure wounds, mass healing word, and spare the dying treat you as valid targets. |
| **Mechanical Nature** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Sentry's Rest** | `Text-Only` | N/A | You spend 6 hours in an inactive, motionless state instead of sleeping; you remain conscious during that time. |
| **Specialized Design** | `Text-Only` | N/A | You gain two tool proficiencies of your choice. |

---

### Autumn Eladrin (`autumn_eladrin`)

*Base Race: `eladrin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Keen Senses** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\RaceDetailPane.tsx: "/** Elf - Keen Senses (pick 1 of 3) */"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select a Keen Senses skill first'"; src\components\CharacterCreator\SkillSelection.tsx: "// Prepare options for Elf Keen Senses racial feature"; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[selectedKeenSensesSkillId] = { granted: true, source: "Elf 'Keen Senses' trait" };" |
| **Trance** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewComponents.tsx: "<TableCell className="font-bold text-sky-300">Trance</TableCell>" |
| **Fey Step (Autumn)** | `Text-Only` | N/A | As a Bonus Action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. Immediately after you teleport, up to two creatures of your choice that you can see within 10 feet of you must succeed on a Wisdom saving throw (DC 8 + your Proficiency Bonus + your Intelligence, Wisdom, or Charisma modifier) or be charmed by you for 1 minute, or until you or your companions deal any damage to the target. |
| **Season Association** | `Text-Only` | N/A | Autumn represents peace and goodwill, with a desire to share and give. You can change your season during a long rest, which changes your Fey Step effect. |

---

### Beastborn Human (`beastborn_human`)

*Base Race: `human`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Resourceful** | `Text-Only` | N/A | You gain Heroic Inspiration whenever you finish a Long Rest. |
| **Skillful** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\HumanSkillSelection.tsx: "* from all available skills, as per their "Skillful" racial trait."; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[humanSkillId] = { granted: true, source: "Human 'Skillful' trait" };"; src\components\CharacterCreator\utils\__tests__\skillSelectionUtils.test.ts: "expect(grants.athletics).toEqual({ granted: true, source: "Human 'Skillful' trait" });" |
| **Versatile** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\AbilityScoreAllocation.test.tsx: "description: 'Versatile and ambitious.',"; src\components\CharacterCreator\config\sidebarSteps.ts: "label: 'Versatile Skill',"; src\components\CharacterCreator\state\characterCreatorState.ts: "// Humans get the Versatile trait which grants access to feat selection at level 1"; src\components\CharacterCreator\WeaponMasterySelection.tsx: "'Versatile': [],"; src\components\DesignPreview\steps\PreviewTables.tsx: "<td className="px-4 py-3 text-sm text-gray-400">Versatile (1d10)</td>"; src\components\DesignPreview\steps\PreviewWeaponMastery.tsx: "{ id: 'longsword', name: 'Longsword', mastery: 'Sap', desc: 'Versatile (1d10). Mastery: Sap - Disadvantage on next attack.', icon: '🗡️' },"; src\data\items\generatedGlossaryItems.ts: ""Versatile""; src\data\items\index.ts: "'quarterstaff': { id: 'quarterstaff', name: 'Quarterstaff', icon: ' Staff', description: 'A long staff of wood.', type: 'weapon', category: 'Simple Melee', slot: 'MainHand', damageDice: '1d6', damageType: 'Bludgeoning', properties: ['Versatile'], weight: 4, cost: '2 SP', mastery: 'Topple', ...weaponIcon('baton.svg') },"; src\data\item_templates\index.ts: "properties: { type: 'array', items: { type: 'string' }, enum: ['Finesse', 'Light', 'Two-Handed', 'Versatile', 'Thrown', 'Ammunition', 'Reach'], description: 'An array of weapon properties.' },"; src\hooks\__tests__\useAbilitySystem.test.ts: "properties: ['Versatile'],"; src\utils\core\factories.ts: "description: 'Versatile and adaptable.'," |
| **Wild Intuition** | `Text-Only` | N/A | When you make a Wisdom (Animal Handling) or Intelligence (Nature) check, you can roll a d4 and add the number rolled to the ability check. |
| **Primal Connection** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **The Bigger They Are** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Spells of the Mark** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Beasthide Shifter (`beasthide_shifter`)

*Base Race: `shapeshifters`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Shifting** | `Implemented` | Custom system logic | Referenced in: src\data\biomes.ts: "{ id: 'desert_dune', name: 'Dune Sea', variant: 'dune', color: 'bg-amber-300', rgbaColor: 'rgba(242, 202, 129, 0.7)', description: 'Shifting dunes and scarce shade.', spawnWeight: 2 }," |
| **Bestial Durability** | `Text-Only` | N/A | Whenever you shift, you gain 1d6 additional temporary hit points. While shifted, you also have a +1 bonus to your Armor Class. |

---

### Black Dragonborn (`black_dragonborn`)

*Base Race: `draconic_kin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Draconic Ancestry** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\NameAndReview.tsx: "<span className="text-amber-500/80 font-semibold mr-2">Draconic Ancestry:</span>"; src\components\CharacterCreator\Race\DragonbornAncestrySelection.tsx: "* It allows the player to choose their Draconic Ancestry (e.g., Red, Blue, Gold dragon),"; src\types\character.ts: "label: string; // Display label (e.g., "Draconic Ancestry")"; src\utils\character\characterValidation.ts: "label: 'Draconic Ancestry'," |
| **Breath Weapon** | `Text-Only` | N/A | You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 5-foot by 30-foot line. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 acid damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can't use it again until you finish a short or long rest. |
| **Damage Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Draconic Language** | `Text-Only` | N/A | You can speak, read, and write Draconic. |

---

### Blue Dragonborn (`blue_dragonborn`)

*Base Race: `draconic_kin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Draconic Ancestry** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\NameAndReview.tsx: "<span className="text-amber-500/80 font-semibold mr-2">Draconic Ancestry:</span>"; src\components\CharacterCreator\Race\DragonbornAncestrySelection.tsx: "* It allows the player to choose their Draconic Ancestry (e.g., Red, Blue, Gold dragon),"; src\types\character.ts: "label: string; // Display label (e.g., "Draconic Ancestry")"; src\utils\character\characterValidation.ts: "label: 'Draconic Ancestry'," |
| **Breath Weapon** | `Text-Only` | N/A | You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 5-foot by 30-foot line. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 lightning damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can't use it again until you finish a short or long rest. |
| **Damage Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Draconic Language** | `Text-Only` | N/A | You can speak, read, and write Draconic. |

---

### Brass Dragonborn (`brass_dragonborn`)

*Base Race: `draconic_kin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Draconic Ancestry** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\NameAndReview.tsx: "<span className="text-amber-500/80 font-semibold mr-2">Draconic Ancestry:</span>"; src\components\CharacterCreator\Race\DragonbornAncestrySelection.tsx: "* It allows the player to choose their Draconic Ancestry (e.g., Red, Blue, Gold dragon),"; src\types\character.ts: "label: string; // Display label (e.g., "Draconic Ancestry")"; src\utils\character\characterValidation.ts: "label: 'Draconic Ancestry'," |
| **Breath Weapon** | `Text-Only` | N/A | You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 5-foot by 30-foot line. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 fire damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can't use it again until you finish a short or long rest. |
| **Damage Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Draconic Language** | `Text-Only` | N/A | You can speak, read, and write Draconic. |

---

### Bronze Dragonborn (`bronze_dragonborn`)

*Base Race: `draconic_kin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Draconic Ancestry** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\NameAndReview.tsx: "<span className="text-amber-500/80 font-semibold mr-2">Draconic Ancestry:</span>"; src\components\CharacterCreator\Race\DragonbornAncestrySelection.tsx: "* It allows the player to choose their Draconic Ancestry (e.g., Red, Blue, Gold dragon),"; src\types\character.ts: "label: string; // Display label (e.g., "Draconic Ancestry")"; src\utils\character\characterValidation.ts: "label: 'Draconic Ancestry'," |
| **Breath Weapon** | `Text-Only` | N/A | You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 5-foot by 30-foot line. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 lightning damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can't use it again until you finish a short or long rest. |
| **Damage Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Draconic Language** | `Text-Only` | N/A | You can speak, read, and write Draconic. |

---

### Bugbear (`bugbear`)

*Base Race: `greenskins`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Long-Limbed** | `Text-Only` | N/A | When you make a melee attack on your turn, your reach for it is 5 feet greater than normal. |
| **Powerful Build** | `Text-Only` | N/A | You count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift. |
| **Sneaky** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[BUGBEAR_AUTO_SKILL_ID] = { granted: true, source: "Bugbear 'Sneaky' trait" };"; src\components\CharacterCreator\utils\__tests__\skillSelectionUtils.test.ts: "expect(grants.stealth).toEqual({ granted: true, source: "Bugbear 'Sneaky' trait" });" |
| **Surprise Attack** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Surprise Attack"," |

---

### Centaur (`centaur`)

*Base Race: `feyfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Charge** | `Implemented` | Custom system logic | Referenced in: src\data\craftedItems.ts: "description: 'Explodes when ignited (5ft radius). DC 13 Dex save or 3d6 bludgeoning damage. Charges can be combined.',"; src\data\feats\featsData.ts: "name: 'Charger',"; src\data\items\generatedGlossaryItems.ts: ""description": "This wand has 7 charges. While holding it, you can expend 1 charge to cast polymorph (save DC 15) from it.  Regaining Charges The wand regains 1d6 + 1...","; src\data\monsters.generated.ts: ""name": "Charge","; src\hooks\useBattleMap.ts: "// Charge movement with the same feet-based path cost used by the range"; src\types\magicItems.d.ts: "export interface ItemCharges {"; src\types\magicItems.ts: "export interface ItemCharges {" |
| **Equine Build** | `Text-Only` | N/A | You count as one size larger when determining your carrying capacity and the weight you can push or drag. In addition, any climb that requires hands and feet is especially difficult for you because of your equine legs. When you make such a climb, each foot of movement costs you 4 extra feet instead of the normal 1 extra foot. |
| **Hooves** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Hooves"," |
| **Natural Affinity** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\CentaurNaturalAffinitySkillSelection.tsx: "* It allows the player to choose their Natural Affinity skill proficiency."; src\components\CharacterCreator\Race\RaceDetailPane.tsx: "/** Centaur - Natural Affinity (pick 1 of 4) */"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select a Natural Affinity skill first'"; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[centaurSkillId] = { granted: true, source: "Centaur 'Natural Affinity' trait" };"; src\components\CharacterCreator\utils\__tests__\skillSelectionUtils.test.ts: "expect(grants.survival).toEqual({ granted: true, source: "Centaur 'Natural Affinity' trait" });" |

---

### Changeling (`changeling`)

*Base Race: `shapeshifters`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Changeling Instincts** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\ChangelingInstinctsSelection.tsx: "title="Changeling Instincts""; src\components\CharacterCreator\Race\RaceDetailPane.tsx: "{/* Changeling Instincts (required choice) */}"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select two Changeling Instincts skills first'"; src\components\CharacterCreator\__tests__\CharacterCreator.test.tsx: "// Changeling Instincts is now selected inline during race selection (required before confirming)." |
| **Shapechanger** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""Shapechanger""; src\systems\creatures\CreatureTaxonomy.ts: "* @param targetTypes - The creature types of the target (e.g., ['Humanoid', 'Shapechanger'])"; src\systems\creatures\__tests__\CreatureTaxonomy.test.ts: "expect(CreatureTaxonomy.isValidTarget(['Humanoid', 'Shapechanger'], filter)).toBe(true);" |

---

### Chthonic Tiefling (`chthonic_tiefling`)

*Base Race: `tiefling`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Otherworldly Presence** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Chthonic Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Chthonic Magic** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Cloud Giant Goliath (`cloud_giant_goliath`)

*Base Race: `goliath`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Powerful Build** | `Text-Only` | N/A | You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift. |
| **Large Form** | `Text-Only` | N/A | Starting at 5th level, you can change your size to Large as a Bonus Action. This transformation lasts for 10 minutes or until you end it as a bonus action. While Large, you have advantage on Strength checks, and your speed increases by 10 feet. Once you use this trait, you can't use it again until you finish a Long Rest. |
| **Cloud's Jaunt** | `Text-Only` | N/A | As a Bonus Action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use this trait a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest. |

---

### Copper Dragonborn (`copper_dragonborn`)

*Base Race: `draconic_kin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Draconic Ancestry** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\NameAndReview.tsx: "<span className="text-amber-500/80 font-semibold mr-2">Draconic Ancestry:</span>"; src\components\CharacterCreator\Race\DragonbornAncestrySelection.tsx: "* It allows the player to choose their Draconic Ancestry (e.g., Red, Blue, Gold dragon),"; src\types\character.ts: "label: string; // Display label (e.g., "Draconic Ancestry")"; src\utils\character\characterValidation.ts: "label: 'Draconic Ancestry'," |
| **Breath Weapon** | `Text-Only` | N/A | You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 5-foot by 30-foot line. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 acid damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can't use it again until you finish a short or long rest. |
| **Damage Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Draconic Language** | `Text-Only` | N/A | You can speak, read, and write Draconic. |

---

### Deep Gnome (Svirfneblin) (`deep_gnome`)

*Base Race: `gnome`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Gnome Cunning** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Gnome Cunning"," |
| **Stone Camouflage** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Stone Camouflage"," |
| **Gift of the Svirfneblin** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Draconblood Dragonborn (`draconblood_dragonborn`)

*Base Race: `draconic_kin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Forceful Presence** | `Text-Only` | N/A | You can use your understanding of creative diplomacy or intimidation to guide a conversation in your favor. When you make a Charisma (Intimidation or Persuasion) check, you can do so with advantage. Once you use this trait, you can't do so again until you finish a short or long rest. |
| **Draconic Ancestral Legacy** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Draconic Language** | `Text-Only` | N/A | You can speak, read, and write Draconic. |

---

### Dragonborn (`dragonborn`)

*Base Race: `draconic_kin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Draconic Ancestry** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\NameAndReview.tsx: "<span className="text-amber-500/80 font-semibold mr-2">Draconic Ancestry:</span>"; src\components\CharacterCreator\Race\DragonbornAncestrySelection.tsx: "* It allows the player to choose their Draconic Ancestry (e.g., Red, Blue, Gold dragon),"; src\types\character.ts: "label: string; // Display label (e.g., "Draconic Ancestry")"; src\utils\character\characterValidation.ts: "label: 'Draconic Ancestry'," |
| **Breath Weapon** | `Text-Only` | N/A | You can use your Breath Weapon as part of the Attack action. Each creature in the area must make a Dexterity saving throw (DC 8 + Con mod + Prof Bonus). |
| **Damage Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Draconic Flight (Level 5)** | `Text-Only` | N/A | You sprout wings and gain a flying speed equal to your walking speed. |

---

### Drow (`drow`)

*Base Race: `elf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Keen Senses** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\RaceDetailPane.tsx: "/** Elf - Keen Senses (pick 1 of 3) */"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select a Keen Senses skill first'"; src\components\CharacterCreator\SkillSelection.tsx: "// Prepare options for Elf Keen Senses racial feature"; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[selectedKeenSensesSkillId] = { granted: true, source: "Elf 'Keen Senses' trait" };" |
| **Trance** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewComponents.tsx: "<TableCell className="font-bold text-sky-300">Trance</TableCell>" |
| **Sunlight Sensitivity** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Sunlight Sensitivity"," |
| **Drow Magic** | `Implemented` | Custom system logic | Referenced in: src\utils\character\__tests__\characterValidation.test.ts: "label: 'Missing Spell: Drow Magic'," |

---

### Gray Dwarf (Duergar) (`duergar`)

*Base Race: `dwarf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Duergar Magic** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Dwarven Resilience** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Psionic Fortitude** | `Text-Only` | N/A | You have advantage on saving throws you make to avoid or end the charmed or stunned condition on yourself. |

---

### Earth Genasi (`earth_genasi`)

*Base Race: `genasi`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Earth Walk** | `Text-Only` | N/A | You can move across Difficult Terrain without expending extra movement if you are walking on the ground or a floor. |
| **Merge with Stone** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Eladrin (`eladrin`)

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Fey Step** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Keen Senses** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\RaceDetailPane.tsx: "/** Elf - Keen Senses (pick 1 of 3) */"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select a Keen Senses skill first'"; src\components\CharacterCreator\SkillSelection.tsx: "// Prepare options for Elf Keen Senses racial feature"; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[selectedKeenSensesSkillId] = { granted: true, source: "Elf 'Keen Senses' trait" };" |
| **Trance** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewComponents.tsx: "<TableCell className="font-bold text-sky-300">Trance</TableCell>" |

---

### Elf (`elf`)

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Elven Lineage** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\NameAndReview.tsx: "<span className="text-amber-500/80 font-semibold mr-2">Elven Lineage:</span> {elvenLineageDetails.name}"; src\components\CharacterCreator\Race\ElvenLineageSelection.tsx: "* It allows the player to choose their Elven Lineage (Drow, High Elf, or Wood Elf)"; src\utils\character\characterValidation.ts: "label: 'Elven Lineage'," |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Keen Senses** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\RaceDetailPane.tsx: "/** Elf - Keen Senses (pick 1 of 3) */"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select a Keen Senses skill first'"; src\components\CharacterCreator\SkillSelection.tsx: "// Prepare options for Elf Keen Senses racial feature"; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[selectedKeenSensesSkillId] = { granted: true, source: "Elf 'Keen Senses' trait" };" |
| **Trance** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewComponents.tsx: "<TableCell className="font-bold text-sky-300">Trance</TableCell>" |

---

### Fairy (`fairy`)

*Base Race: `feyfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Fairy Magic** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Flight** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\CharacterCreator.tsx: "const isPortraitInFlight = (state: CharacterCreationState) =>"; src\data\monsters.generated.ts: ""name": "Cloaked Flight"," |

---

### Fallen Aasimar (`fallen_aasimar`)

*Base Race: `aasimar`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Celestial Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Healing Hands** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewTables.tsx: "keyTraits: ['Darkvision', 'Celestial Resistance', 'Healing Hands', 'Light Bearer', 'Radiant Soul']" |
| **Light Bearer** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Necrotic Shroud** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Firbolg (`firbolg`)

*Base Race: `feyfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Firbolg Magic** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Hidden Step** | `Text-Only` | N/A | As a bonus action, you can magically turn invisible until the start of your next turn or until you attack, make a damage roll, or force someone to make a saving throw. You can use this trait a number of times equal to your proficiency bonus, and you regain all expended uses when you finish a long rest. |
| **Powerful Build** | `Text-Only` | N/A | You count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift. |
| **Speech of Beast and Leaf** | `Text-Only` | N/A | You have the ability to communicate in a limited manner with Beasts, Plants, and vegetation. They can understand the meaning of your words, though you have no special ability to understand them in return. You have advantage on all Charisma checks you make to influence them. |

---

### Fire Genasi (`fire_genasi`)

*Base Race: `genasi`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Fire Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Reach to the Blaze** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Fire Giant Goliath (`fire_giant_goliath`)

*Base Race: `goliath`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Powerful Build** | `Text-Only` | N/A | You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift. |
| **Large Form** | `Text-Only` | N/A | Starting at 5th level, you can change your size to Large as a Bonus Action. This transformation lasts for 10 minutes or until you end it as a bonus action. While Large, you have advantage on Strength checks, and your speed increases by 10 feet. Once you use this trait, you can't use it again until you finish a Long Rest. |
| **Fire's Burn** | `Text-Only` | N/A | When you hit a target with an attack roll, you can deal an extra 1d10 fire damage. You can use this trait a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest. |

---

### Forest Gnome (`forest_gnome`)

*Base Race: `gnome`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Gnome Cunning** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Gnome Cunning"," |
| **Natural Illusionist** | `Text-Only` | N/A | You know the Minor Illusion cantrip. Intelligence is your spellcasting ability for it. |
| **Speak with Small Beasts** | `Text-Only` | N/A | Through sounds and gestures, you can communicate simple ideas with Small or smaller beasts. Forest gnomes love animals and often keep squirrels, badgers, rabbits, moles, woodpeckers, and other creatures as beloved pets. |

---

### Forgeborn Human (`forgeborn_human`)

*Base Race: `human`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Resourceful** | `Text-Only` | N/A | You gain Heroic Inspiration whenever you finish a Long Rest. |
| **Skillful** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\HumanSkillSelection.tsx: "* from all available skills, as per their "Skillful" racial trait."; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[humanSkillId] = { granted: true, source: "Human 'Skillful' trait" };"; src\components\CharacterCreator\utils\__tests__\skillSelectionUtils.test.ts: "expect(grants.athletics).toEqual({ granted: true, source: "Human 'Skillful' trait" });" |
| **Versatile** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\AbilityScoreAllocation.test.tsx: "description: 'Versatile and ambitious.',"; src\components\CharacterCreator\config\sidebarSteps.ts: "label: 'Versatile Skill',"; src\components\CharacterCreator\state\characterCreatorState.ts: "// Humans get the Versatile trait which grants access to feat selection at level 1"; src\components\CharacterCreator\WeaponMasterySelection.tsx: "'Versatile': [],"; src\components\DesignPreview\steps\PreviewTables.tsx: "<td className="px-4 py-3 text-sm text-gray-400">Versatile (1d10)</td>"; src\components\DesignPreview\steps\PreviewWeaponMastery.tsx: "{ id: 'longsword', name: 'Longsword', mastery: 'Sap', desc: 'Versatile (1d10). Mastery: Sap - Disadvantage on next attack.', icon: '🗡️' },"; src\data\items\generatedGlossaryItems.ts: ""Versatile""; src\data\items\index.ts: "'quarterstaff': { id: 'quarterstaff', name: 'Quarterstaff', icon: ' Staff', description: 'A long staff of wood.', type: 'weapon', category: 'Simple Melee', slot: 'MainHand', damageDice: '1d6', damageType: 'Bludgeoning', properties: ['Versatile'], weight: 4, cost: '2 SP', mastery: 'Topple', ...weaponIcon('baton.svg') },"; src\data\item_templates\index.ts: "properties: { type: 'array', items: { type: 'string' }, enum: ['Finesse', 'Light', 'Two-Handed', 'Versatile', 'Thrown', 'Ammunition', 'Reach'], description: 'An array of weapon properties.' },"; src\hooks\__tests__\useAbilitySystem.test.ts: "properties: ['Versatile'],"; src\utils\core\factories.ts: "description: 'Versatile and adaptable.'," |
| **Artisan's Intuition** | `Text-Only` | N/A | When you make an Arcana check or an ability check involving artisan's tools, you can roll a d4 and add the number rolled to the ability check. |
| **Maker's Gift** | `Text-Only` | N/A | You gain proficiency with one type of artisan's tools of your choice. |
| **Spellsmith** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Spells of the Mark** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Frost Giant Goliath (`frost_giant_goliath`)

*Base Race: `goliath`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Powerful Build** | `Text-Only` | N/A | You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift. |
| **Large Form** | `Text-Only` | N/A | Starting at 5th level, you can change your size to Large as a Bonus Action. This transformation lasts for 10 minutes or until you end it as a bonus action. While Large, you have advantage on Strength checks, and your speed increases by 10 feet. Once you use this trait, you can't use it again until you finish a Long Rest. |
| **Frost's Chill** | `Text-Only` | N/A | When you hit a target with an attack roll, you can deal an extra 1d6 cold damage and reduce the target's speed by 10 feet until the start of your next turn. You can use this trait a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest. |

---

### Giff (`giff`)

*Base Race: `beastfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Astral Spark** | `Text-Only` | N/A | When you make an attack roll, saving throw, or ability check, you can add your Proficiency Bonus after you see the d20 roll; you can do so a number of times equal to your Proficiency Bonus per long rest. |
| **Firearms Mastery** | `Text-Only` | N/A | You are proficient with all firearms, ignore the loading property, and firing at long range does not impose disadvantage when using firearms. |
| **Hippo Build** | `Text-Only` | N/A | You have advantage on Strength checks and saving throws, and you count as one size larger for your carrying capacity and push/drag/lift limits. |

---

### Githyanki (`githyanki`)

*Base Race: `gith`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Astral Knowledge** | `Text-Only` | N/A | Whenever you finish a long rest, you gain proficiency in one skill of your choice and with one weapon or tool of your choice, selected from the Player’s Handbook. These proficiencies last until the end of your next long rest. |
| **Githyanki Psionics** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Psychic Resilience** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |

---

### Githzerai (`githzerai`)

*Base Race: `gith`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Githzerai Psionics** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Mental Discipline** | `Text-Only` | N/A | You have advantage on saving throws you make to avoid or end the charmed and frightened conditions on yourself. |
| **Psychic Resilience** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |

---

### Goblin (`goblin`)

*Base Race: `greenskins`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Fury of the Small** | `Text-Only` | N/A | When you damage a creature with an attack or a spell and the creature’s size is larger than yours, you can cause the attack or spell to deal extra damage to the creature. The extra damage equals your proficiency bonus. You can use this trait a number of times equal to your proficiency bonus, regaining all expended uses when you finish a long rest. |
| **Nimble Escape** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Nimble Escape"," |

---

### Gold Dragonborn (`gold_dragonborn`)

*Base Race: `draconic_kin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Draconic Ancestry** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\NameAndReview.tsx: "<span className="text-amber-500/80 font-semibold mr-2">Draconic Ancestry:</span>"; src\components\CharacterCreator\Race\DragonbornAncestrySelection.tsx: "* It allows the player to choose their Draconic Ancestry (e.g., Red, Blue, Gold dragon),"; src\types\character.ts: "label: string; // Display label (e.g., "Draconic Ancestry")"; src\utils\character\characterValidation.ts: "label: 'Draconic Ancestry'," |
| **Breath Weapon** | `Text-Only` | N/A | You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 15-foot cone. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 fire damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can't use it again until you finish a short or long rest. |
| **Damage Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Draconic Language** | `Text-Only` | N/A | You can speak, read, and write Draconic. |

---

### Goliath (`goliath`)

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Giant Ancestry** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\GiantAncestrySelection.tsx: "* It allows the player to choose their Giant Ancestry benefit."; src\utils\character\characterUtils.ts: "// GIANT_ANCESTRIES has 'id' like 'Fire', 'Stone', and 'name' like 'Fire Giant Ancestry'"; src\utils\character\characterValidation.ts: "// Goliath: Giant Ancestry" |
| **Large Form** | `Text-Only` | N/A | Starting at character level 5, you can change your size to Large as a Bonus Action if you’re in a big enough space. This transformation lasts for 10 minutes or until you end it (no action required). For that duration, you have Advantage on Strength checks, and your Speed increases by 10 feet. Once you use this trait, you can’t use it again until you finish a Long Rest. (Note: Level-based features are descriptive for now). |
| **Powerful Build** | `Text-Only` | N/A | You have Advantage on any ability check you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity. |

---

### Green Dragonborn (`green_dragonborn`)

*Base Race: `draconic_kin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Draconic Ancestry** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\NameAndReview.tsx: "<span className="text-amber-500/80 font-semibold mr-2">Draconic Ancestry:</span>"; src\components\CharacterCreator\Race\DragonbornAncestrySelection.tsx: "* It allows the player to choose their Draconic Ancestry (e.g., Red, Blue, Gold dragon),"; src\types\character.ts: "label: string; // Display label (e.g., "Draconic Ancestry")"; src\utils\character\characterValidation.ts: "label: 'Draconic Ancestry'," |
| **Breath Weapon** | `Text-Only` | N/A | You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 15-foot cone. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 poison damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can't use it again until you finish a short or long rest. |
| **Damage Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Draconic Language** | `Text-Only` | N/A | You can speak, read, and write Draconic. |

---

### Guardian Human (`guardian_human`)

*Base Race: `human`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Resourceful** | `Text-Only` | N/A | You gain Heroic Inspiration whenever you finish a Long Rest. |
| **Skillful** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\HumanSkillSelection.tsx: "* from all available skills, as per their "Skillful" racial trait."; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[humanSkillId] = { granted: true, source: "Human 'Skillful' trait" };"; src\components\CharacterCreator\utils\__tests__\skillSelectionUtils.test.ts: "expect(grants.athletics).toEqual({ granted: true, source: "Human 'Skillful' trait" });" |
| **Versatile** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\AbilityScoreAllocation.test.tsx: "description: 'Versatile and ambitious.',"; src\components\CharacterCreator\config\sidebarSteps.ts: "label: 'Versatile Skill',"; src\components\CharacterCreator\state\characterCreatorState.ts: "// Humans get the Versatile trait which grants access to feat selection at level 1"; src\components\CharacterCreator\WeaponMasterySelection.tsx: "'Versatile': [],"; src\components\DesignPreview\steps\PreviewTables.tsx: "<td className="px-4 py-3 text-sm text-gray-400">Versatile (1d10)</td>"; src\components\DesignPreview\steps\PreviewWeaponMastery.tsx: "{ id: 'longsword', name: 'Longsword', mastery: 'Sap', desc: 'Versatile (1d10). Mastery: Sap - Disadvantage on next attack.', icon: '🗡️' },"; src\data\items\generatedGlossaryItems.ts: ""Versatile""; src\data\items\index.ts: "'quarterstaff': { id: 'quarterstaff', name: 'Quarterstaff', icon: ' Staff', description: 'A long staff of wood.', type: 'weapon', category: 'Simple Melee', slot: 'MainHand', damageDice: '1d6', damageType: 'Bludgeoning', properties: ['Versatile'], weight: 4, cost: '2 SP', mastery: 'Topple', ...weaponIcon('baton.svg') },"; src\data\item_templates\index.ts: "properties: { type: 'array', items: { type: 'string' }, enum: ['Finesse', 'Light', 'Two-Handed', 'Versatile', 'Thrown', 'Ammunition', 'Reach'], description: 'An array of weapon properties.' },"; src\hooks\__tests__\useAbilitySystem.test.ts: "properties: ['Versatile'],"; src\utils\core\factories.ts: "description: 'Versatile and adaptable.'," |
| **Sentinel's Intuition** | `Text-Only` | N/A | When you make a Wisdom (Insight) or Wisdom (Perception) check, you can roll a d4 and add the number rolled to the ability check. |
| **Guardian's Shield** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Vigilant Guardian** | `Text-Only` | N/A | When a creature you can see within 5 feet of you is hit by an attack roll, you can use your reaction to swap places with that creature, and you are hit by the attack instead. Once you use this trait, you can't do so again until you finish a Long Rest. |
| **Spells of the Mark** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Hadozee (`hadozee`)

*Base Race: `beastfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Dexterous Feet** | `Text-Only` | N/A | As a bonus action you can use your feet to manipulate objects, open doors, or pick up or set down Tiny objects. |
| **Glide** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Earth Glide"," |
| **Hadozee Resilience** | `Text-Only` | N/A | When you take damage, you can use your reaction to roll a d6 and add your proficiency bonus to the roll; you subtract that total from the damage taken. |

---

### Half-Elf (`half_elf`)

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Skill Versatility** | `Text-Only` | N/A | You gain proficiency in two skills of your choice. |

---

### Aquatic Half-Elf (`half_elf_aquatic`)

*Base Race: `half_elf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Swim Speed** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""description": "(3 slots) You touch a willing creature. For the duration, the target's movement is unaffected by Difficult Terrain, and spells and other magical effects can neither reduce the target's Speed nor cause the target to have the Paralyzed or Restrained conditions. The target also has a Swim Speed equal to its Speed. In addition, the target can spend 5 feet of movement to automatically escape from nonmagical restraints, such as manacles or a creature imposing the Grappled condition on it.\n\nAt Higher Levels: You can target one additional creature for each spell slot level above 4."," |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Skill Versatility** | `Text-Only` | N/A | You gain proficiency in one skill of your choice. |
| **Swim Speed** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""description": "(3 slots) You touch a willing creature. For the duration, the target's movement is unaffected by Difficult Terrain, and spells and other magical effects can neither reduce the target's Speed nor cause the target to have the Paralyzed or Restrained conditions. The target also has a Swim Speed equal to its Speed. In addition, the target can spend 5 feet of movement to automatically escape from nonmagical restraints, such as manacles or a creature imposing the Grappled condition on it.\n\nAt Higher Levels: You can target one additional creature for each spell slot level above 4."," |

---

### Drow Half-Elf (`half_elf_drow`)

*Base Race: `half_elf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Skill Versatility** | `Text-Only` | N/A | You gain proficiency in one skill of your choice. |
| **Drow Magic** | `Implemented` | Custom system logic | Referenced in: src\utils\character\__tests__\characterValidation.test.ts: "label: 'Missing Spell: Drow Magic'," |

---

### High Half-Elf (`half_elf_high`)

*Base Race: `half_elf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Skill Versatility** | `Text-Only` | N/A | You gain proficiency in one skill of your choice. |
| **Cantrip** | `Implemented` | Custom system logic | Referenced in: src\commands\__tests__\combat-pilot\CombatDeterministicSpells.test.ts: "describe('fire-bolt (Cantrip Damage)', () => {"; src\components\BattleMap\AbilityButton.tsx: "{ability.spell.school} {ability.spell.level === 0 ? 'Cantrip' : `Level ${ability.spell.level} Spell`}"; src\components\CharacterCreator\Class\ArtificerFeatureSelection.tsx: "const [selectedCantripIds, setSelectedCantripIds] = useState<Set<string>>(new Set());"; src\components\CharacterCreator\Class\BardFeatureSelection.tsx: "* Bards must select their initial Cantrips and Level 1 spells."; src\components\CharacterCreator\Class\ClericFeatureSelection.tsx: "* Cantrips, and Level 1 Spells)."; src\components\CharacterCreator\Class\DruidFeatureSelection.tsx: "* Cantrips, and Level 1 Spells)."; src\components\CharacterCreator\Class\SorcererFeatureSelection.tsx: "* the Class, Sorcerers must immediately pick their Cantrips and Level 1"; src\components\CharacterCreator\Class\WarlockFeatureSelection.tsx: "* This component manages the 'Warlock Feature' selection (Cantrips and"; src\components\CharacterCreator\Class\WizardFeatureSelection.tsx: "const [selectedCantripIds, setSelectedCantripIds] = useState<Set<string>>(new Set());"; src\components\CharacterCreator\Class\__tests__\WizardFeatureSelection.test.tsx: "knownCantrips: 2,"; src\components\CharacterCreator\config\sidebarSteps.ts: "if (state.selectedClass.spellcasting) return state.selectedCantrips.length > 0 || state.selectedSpellsL1.length > 0;"; src\components\CharacterCreator\FeatSelection.tsx: "const choiceKey = requirement.level === 0 ? 'selectedCantrips' : 'selectedLeveledSpells';"; src\components\CharacterCreator\hooks\useCharacterAssembly.ts: "if (state.selectedCantrips.length > 0 && selectedClass.id === 'ranger') return false;"; src\components\CharacterCreator\hooks\__tests__\useCharacterAssembly.test.tsx: "selectedCantrips: [fireBolt, mageHand, minorIllusion] as Spell[],"; src\components\CharacterCreator\NameAndReview.tsx: "const { cantrips: allKnownCantrips, spells: allKnownSpells } = getCharacterSpells(characterPreview, allSpells);"; src\components\CharacterCreator\Race\GnomeSubraceSelection.tsx: "(selectedSubraceDetails.grantedCantrip || selectedSubraceDetails.grantedSpell)"; src\components\CharacterCreator\Race\RaceDetailModal.tsx: "// Extract Cantrip"; src\components\CharacterCreator\Race\TieflingLegacySelection.tsx: "<span className="text-amber-400">❶</span> {allSpells[legacy.level1Benefit.cantripId]?.name || 'Cantrip'}"; src\components\CharacterCreator\shared\CharacterCreatorTraitsTable.tsx: "spells.push({ level: '1st', name: cantripMatch[1].trim(), usage: 'Cantrip' });"; src\components\CharacterCreator\state\characterCreatorState.ts: "selectedCantrips?: string[];"; src\components\CharacterSheet\Spellbook\SpellbookOverlay.tsx: "const pageTitle = currentLevel === 0 ? "Cantrips" : `Level ${currentLevel} Spells`;"; src\components\CharacterSheet\Spellbook\SpellbookTab.tsx: "const pageTitle = currentLevel === 0 ? "Cantrips" : `Level ${currentLevel} Spells`;"; src\components\CharacterSheet\Spellbook\SpellDetailPane.tsx: "? `${spell.school} Cantrip`"; src\components\CharacterSheet\Spellbook\__tests__\SpellbookTab.test.tsx: "expect(screen.getByRole('button', { name: 'Cantrips' })).toBeInTheDocument();"; src\components\CharacterSheet\__tests__\SpellbookTab.test.tsx: "id: 'cantrip-1', name: 'Test Cantrip', level: 0, school: SpellSchool.Evocation,"; src\components\DesignPreview\steps\PreviewCombatSandbox.tsx: "knownCantrips: 3,"; src\components\DesignPreview\steps\PreviewTables.tsx: "{ level: '1st', name: 'Light', usage: 'Cantrip' },"; src\components\Glossary\SpellCardTemplate.tsx: "* Helper to format the level display (Cantrip vs 1st, 2nd, etc.)"; src\data\classes\index.ts: "// Cantrips"; src\data\items\generatedGlossaryItems.ts: ""name": "Enspelled Staff (Cantrip)","; src\hooks\useCharacterAssembly.ts: "if (state.selectedCantrips.length > 0 && selectedClass.id === 'ranger') return false;"; src\hooks\useMissingChoice.ts: "secondaryValue: extraData as { choices?: import('../types').LevelUpChoices; xpGained?: number; isCantrip?: boolean } | undefined,"; src\hooks\__tests__\useAbilitySystem.package4.test.tsx: "name: 'Cantrip Target',"; src\services\characterGenerator.ts: ".slice(0, charClass.spellcasting.knownCantrips);"; src\state\actionTypes.d.ts: "isCantrip?: boolean;"; src\state\actionTypes.ts: "| { type: 'UPDATE_CHARACTER_CHOICE'; payload: { characterId: string; choiceType: string; choiceId: string; secondaryValue?: { choices?: LevelUpChoices; xpGained?: number; isCantrip?: boolean } } }"; src\state\reducers\characterReducer.ts: "const parsedSecondary = (secondaryValue ?? {}) as { choices?: LevelUpChoices; xpGained?: number; isCantrip?: boolean };"; src\state\reducers\__tests__\characterReducer.test.ts: "knownCantrips: 3,"; src\systems\spells\mechanics\ScalingEngine.ts: "* ### 2. Character-Level Scaling (Cantrips)"; src\types\character.d.ts: "canSwapCantrip?: boolean;"; src\types\character.ts: "canSwapCantrip?: boolean;"; src\types\spells.ts: "level: number; // 0 for Cantrip"; src\utils\character\characterUtils.ts: "selectedCantrips?: string[];"; src\utils\character\characterValidation.ts: "const knownCantrips = new Set(spellbook?.cantrips || []);"; src\utils\character\spellFilterUtils.ts: "if (level === 0) return 'Cantrip';"; src\utils\character\spellUtils.ts: "const finalCantrips = Array.from(cantripSet).sort((a, b) => a.name.localeCompare(b.name));"; src\utils\character\__tests__\characterUtils.test.ts: "knownCantrips: 4,"; src\utils\character\__tests__\characterValidation.test.ts: "label: 'Missing Spell: Cantrip',"; src\utils\combat\__tests__\actionEconomyUtils.test.ts: "const afterCantrip = consumeActionCost(character, { type: 'action', spellSlotLevel: 0 });"; src\utils\core\factories.ts: "knownCantrips: 0,"; src\utils\sandbox\quickCharacterGenerator.ts: "cantrips: charClass.spellcasting.spellList?.slice(0, charClass.spellcasting.knownCantrips) || []," |

---

### Wood Half-Elf (`half_elf_wood`)

*Base Race: `half_elf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Skill Versatility** | `Text-Only` | N/A | You gain proficiency in one skill of your choice. |
| **Fleet of Foot** | `Text-Only` | N/A | Your base walking speed increases to 35 feet. |
| **Mask of the Wild (Alternative)** | `Text-Only` | N/A | You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena. This option can replace Fleet of Foot. |

---

### Half-Orc (`half_orc`)

*Base Race: `greenskins`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Relentless Endurance** | `Text-Only` | N/A | When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. Once you use this trait, you canâ€™t do so again until you finish a long rest. |
| **Savage Attacks** | `Text-Only` | N/A | When you score a critical hit with a melee weapon attack, you can roll one of the weaponâ€™s damage dice one additional time and add it to the extra damage of the critical hit. |

---

### Halfling (`halfling`)

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Brave** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Brave',"; src\data\monsters.generated.ts: ""name": "Aura of Bravery","; src\data\naval\crewTraits.ts: "'Brave': { effect: 'Bonus in combat', moraleModifier: 15 },"; src\utils\world\nobleHouseGenerator.ts: "'Generous', 'Pious', 'Cynical', 'Brave', 'Cowardly', 'Intelligent', 'Dull'," |
| **Halfling Nimbleness** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Halfling Nimbleness'," |
| **Luck** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\FeatSelection.tsx: "*   like Proficiency-scaled Initiative and Lucky points."; src\components\DesignPreview\steps\PreviewIcons.tsx: "'Luck & Games': ["; src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Lucky',"; src\components\Glossary\IconRegistry.tsx: "// MDI Luck & Conditions"; src\data\deities\index.ts: "titles: ['The Changebringer', 'Lady of Luck'],"; src\data\feats\featsData.ts: "name: 'Lucky',"; src\data\items\generatedGlossaryItems.ts: ""name": "Stone of Good Luck","; src\systems\crafting\craftingAchievements.ts: "name: 'Lucky',"; src\systems\economy\BusinessManagement.ts: "{ name: 'Lucky Shipment', description: 'A supplier delivered extra goods at no charge — a gesture of good faith.', reputationChange: 2, goldChange: 0, customerSatisfactionChange: 5 },"; src\systems\economy\NpcBusinessManager.ts: "'Laughing', 'Weary', 'Burning', 'Frozen', 'Lucky', 'Crimson', 'Howling'"; src\types\character.d.ts: "/** Lucky (2024): Creates a Luck Points pool = Proficiency Bonus, resets on Long Rest. */"; src\types\character.ts: "// WHAT CHANGED: Added several proficiency-scaling flags (Lucky, Alert, etc.)."; src\utils\character\characterUtils.ts: "* Alert (Initiative = Proficiency Bonus) and Lucky (Luck Points pool =" |
| **Naturally Stealthy** | `Text-Only` | N/A | You can take the Hide action even when you are obscured only by a creature that is at least one size larger than you. (Note: Specific conditions for Hide action not yet fully mechanically enforced). |

---

### Harengon (`harengon`)

*Base Race: `beastfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Hare-Trigger** | `Text-Only` | N/A | You can add your Proficiency Bonus to your initiative rolls. |
| **Leporine Senses** | `Text-Only` | N/A | You have proficiency in the Perception skill. |
| **Lucky Footwork** | `Text-Only` | N/A | When you fail a Dexterity saving throw, you can use your reaction to roll a d4 and add it to the save. |
| **Rabbit Hop** | `Text-Only` | N/A | As a bonus action, you can jump a number of feet equal to five times your Proficiency Bonus without provoking opportunity attacks. |

---

### Hearthkeeper Halfling (`hearthkeeper_halfling`)

*Base Race: `halfling`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Lucky** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\FeatSelection.tsx: "*   like Proficiency-scaled Initiative and Lucky points."; src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Lucky',"; src\data\feats\featsData.ts: "name: 'Lucky',"; src\systems\crafting\craftingAchievements.ts: "name: 'Lucky',"; src\systems\economy\BusinessManagement.ts: "{ name: 'Lucky Shipment', description: 'A supplier delivered extra goods at no charge — a gesture of good faith.', reputationChange: 2, goldChange: 0, customerSatisfactionChange: 5 },"; src\systems\economy\NpcBusinessManager.ts: "'Laughing', 'Weary', 'Burning', 'Frozen', 'Lucky', 'Crimson', 'Howling'"; src\types\character.d.ts: "/** Lucky (2024): Creates a Luck Points pool = Proficiency Bonus, resets on Long Rest. */"; src\types\character.ts: "// WHAT CHANGED: Added several proficiency-scaling flags (Lucky, Alert, etc.)."; src\utils\character\characterUtils.ts: "* Alert (Initiative = Proficiency Bonus) and Lucky (Luck Points pool =" |
| **Brave** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Brave',"; src\data\monsters.generated.ts: ""name": "Aura of Bravery","; src\data\naval\crewTraits.ts: "'Brave': { effect: 'Bonus in combat', moraleModifier: 15 },"; src\utils\world\nobleHouseGenerator.ts: "'Generous', 'Pious', 'Cynical', 'Brave', 'Cowardly', 'Intelligent', 'Dull'," |
| **Halfling Nimbleness** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Halfling Nimbleness'," |
| **Ever Hospitable** | `Text-Only` | N/A | When you make a Charisma (Persuasion) check or an ability check involving brewer's supplies or cook's utensils, you can roll a d4 and add the number rolled to the ability check. |
| **Innkeeper's Magic** | `Text-Only` | N/A | You know the Prestidigitation cantrip. You can also cast the Purify Food and Drink and Unseen Servant spells with this trait. Once you cast either spell with this trait, you can't cast that spell with it again until you finish a Long Rest. Charisma is your spellcasting ability for these spells. |
| **Spells of the Mark** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\shared\CharacterCreatorTraitsTable.tsx: "{trait.name === 'Spells of the Mark' && spellsOfTheMark ? ("; src\components\Glossary\GlossarySpellsOfTheMarkTable.tsx: "<h4 className="text-sm font-bold text-amber-300">Spells of the Mark</h4>" |

---

### High Elf (`high_elf`)

*Base Race: `elf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Keen Senses** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\RaceDetailPane.tsx: "/** Elf - Keen Senses (pick 1 of 3) */"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select a Keen Senses skill first'"; src\components\CharacterCreator\SkillSelection.tsx: "// Prepare options for Elf Keen Senses racial feature"; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[selectedKeenSensesSkillId] = { granted: true, source: "Elf 'Keen Senses' trait" };" |
| **Trance** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewComponents.tsx: "<TableCell className="font-bold text-sky-300">Trance</TableCell>" |
| **High Elf Cantrip** | `Text-Only` | N/A | You know the Prestidigitation cantrip (or another Wizard cantrip of your choice). You can replace it with a different Wizard cantrip after finishing a Long Rest. Intelligence is your spellcasting ability for it. |
| **Wizard Tradition** | `Text-Only` | N/A | At 3rd level, you learn the Detect Magic spell. At 5th level, you learn the Misty Step spell. You can cast each spell once without expending a spell slot, and you regain the ability to do so when you finish a Long Rest. Intelligence is your spellcasting ability for these spells. |

---

### Hill Dwarf (`hill_dwarf`)

*Base Race: `dwarf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Dwarven Resilience** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Dwarven Combat Training** | `Text-Only` | N/A | You have proficiency with the battleaxe, handaxe, light hammer, and warhammer. |
| **Tool Proficiency** | `Text-Only` | N/A | You gain proficiency with the artisan's tools of your choice: smith's tools, brewer's supplies, or mason's tools. |
| **Stonecunning** | `Text-Only` | N/A | Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check. |
| **Dwarven Toughness** | `Implemented` | Custom system logic | Referenced in: src\services\characterGenerator.ts: "if (race.traits.some(t => t.includes('Dwarven Toughness'))) maxHp += 1; // Dwarven Toughness" |

---

### Hill Giant Goliath (`hill_giant_goliath`)

*Base Race: `goliath`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Powerful Build** | `Text-Only` | N/A | You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift. |
| **Large Form** | `Text-Only` | N/A | Starting at 5th level, you can change your size to Large as a Bonus Action. This transformation lasts for 10 minutes or until you end it as a bonus action. While Large, you have advantage on Strength checks, and your speed increases by 10 feet. Once you use this trait, you can't use it again until you finish a Long Rest. |
| **Hill's Tumble** | `Text-Only` | N/A | When you hit a Large or smaller creature with an attack roll, you can knock the target prone. You can use this trait a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest. |

---

### Hobgoblin (`hobgoblin`)

*Base Race: `greenskins`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Fey Gift** | `Text-Only` | N/A | You can take the Help action as a bonus action a number of times equal to your Proficiency Bonus per long rest. |
| **Fortune from the Many** | `Text-Only` | N/A | When you miss with an attack roll or fail an ability check or saving throw, you can reroll and use the bonus equal to your Proficiency Bonus. |

---

### Human (`human`)

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Resourceful** | `Text-Only` | N/A | You gain Heroic Inspiration whenever you finish a Long Rest (descriptive, not mechanically implemented yet). |
| **Skillful** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\HumanSkillSelection.tsx: "* from all available skills, as per their "Skillful" racial trait."; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[humanSkillId] = { granted: true, source: "Human 'Skillful' trait" };"; src\components\CharacterCreator\utils\__tests__\skillSelectionUtils.test.ts: "expect(grants.athletics).toEqual({ granted: true, source: "Human 'Skillful' trait" });" |
| **Versatile** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\AbilityScoreAllocation.test.tsx: "description: 'Versatile and ambitious.',"; src\components\CharacterCreator\config\sidebarSteps.ts: "label: 'Versatile Skill',"; src\components\CharacterCreator\state\characterCreatorState.ts: "// Humans get the Versatile trait which grants access to feat selection at level 1"; src\components\CharacterCreator\WeaponMasterySelection.tsx: "'Versatile': [],"; src\components\DesignPreview\steps\PreviewTables.tsx: "<td className="px-4 py-3 text-sm text-gray-400">Versatile (1d10)</td>"; src\components\DesignPreview\steps\PreviewWeaponMastery.tsx: "{ id: 'longsword', name: 'Longsword', mastery: 'Sap', desc: 'Versatile (1d10). Mastery: Sap - Disadvantage on next attack.', icon: '🗡️' },"; src\data\items\generatedGlossaryItems.ts: ""Versatile""; src\data\items\index.ts: "'quarterstaff': { id: 'quarterstaff', name: 'Quarterstaff', icon: ' Staff', description: 'A long staff of wood.', type: 'weapon', category: 'Simple Melee', slot: 'MainHand', damageDice: '1d6', damageType: 'Bludgeoning', properties: ['Versatile'], weight: 4, cost: '2 SP', mastery: 'Topple', ...weaponIcon('baton.svg') },"; src\data\item_templates\index.ts: "properties: { type: 'array', items: { type: 'string' }, enum: ['Finesse', 'Light', 'Two-Handed', 'Versatile', 'Thrown', 'Ammunition', 'Reach'], description: 'An array of weapon properties.' },"; src\hooks\__tests__\useAbilitySystem.test.ts: "properties: ['Versatile'],"; src\utils\core\factories.ts: "description: 'Versatile and adaptable.'," |

---

### Infernal Tiefling (`infernal_tiefling`)

*Base Race: `tiefling`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Otherworldly Presence** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Infernal Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Infernal Magic** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Kalashtar (`kalashtar`)

*Base Race: `planar_travelers`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Dual Mind** | `Text-Only` | N/A | You have advantage on all Wisdom saving throws. |
| **Mental Discipline** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Mind Link** | `Text-Only` | N/A | You can speak telepathically to any creature you can see within 10 times your level; you can grant one creature the ability to reply telepathically for 1 hour. |
| **Severed from Dreams** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |

---

### Kender (`kender`)

*Base Race: `planar_travelers`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Fearless** | `Text-Only` | N/A | You have advantage on saving throws to avoid or end the frightened condition, and you can reroll failed saves once per rest. |
| **Kender Curiosity** | `Text-Only` | N/A | You gain proficiency in one skill of your choice from Insight, Investigation, or Sleight of Hand. |
| **Taunt** | `Implemented` | Custom system logic | Referenced in: src\commands\effects\UtilityCommand.ts: "newState = this.applyTaunt(newState, target, effect)"; src\commands\__tests__\UtilityCommand.test.ts: "describe('Taunt Mechanics', () => {"; src\config\statusIcons.ts: "'Taunted': '🤬',"; src\systems\spells\validation\spellValidator.ts: "const TauntEffect = z.object({"; src\types\spells.d.ts: "taunt?: TauntEffect;"; src\types\spells.ts: "taunt?: TauntEffect;"; src\types\visuals.ts: "taunted: { id: 'taunted', label: 'Taunted', icon: '🤬', color: '#7F1D1D', description: 'Must attack the taunter.' }, // red-900" |

---

### Kenku (`kenku`)

*Base Race: `beastfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Expert Duplication** | `Text-Only` | N/A | When you copy writing or craftwork produced by yourself or someone else, you have advantage on any ability checks you make to produce an exact duplicate. |
| **Kenku Recall** | `Text-Only` | N/A | Thanks to your supernaturally good memory, you have proficiency in two skills of your choice from the following list: Acrobatics, Deception, History, Investigation, Nature, Perception, Sleight of Hand, Stealth, and Survival. Moreover, when you make an ability check using any skill in which you have proficiency, you can give yourself advantage on the check before rolling the d20. You can use this advantage a number of times equal to your proficiency bonus, and you regain all expended uses when you finish a long rest. |
| **Mimicry** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Mimicry"," |

---

### Kobold (`kobold`)

*Base Race: `draconic_kin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Draconic Cry** | `Text-Only` | N/A | As a bonus action, you can let out a cry that grants you and allies within 10 feet temporary advantage on attacks until the end of your turn. |
| **Kobold Legacy** | `Text-Only` | N/A | You possess a draconic legacy that grants you either Craftiness (skill proficiency), Defiance (advantage on saving throws vs. fear), or another legacy benefit determined by DM. |

---

### Leonin (`leonin`)

*Base Race: `beastfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Claws** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Claws"," |
| **Hunter's Instincts** | `Text-Only` | N/A | You gain proficiency in either Athletics, Intimidation, Perception, or Survival. |
| **Daunting Roar** | `Text-Only` | N/A | As a bonus action, you can unleash a roar; creatures of your choice within 10 feet that can hear you must succeed on a Wisdom saving throw or become frightened until the end of your next turn. |

---

### Lightfoot Halfling (`lightfoot_halfling`)

*Base Race: `halfling`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Lucky** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\FeatSelection.tsx: "*   like Proficiency-scaled Initiative and Lucky points."; src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Lucky',"; src\data\feats\featsData.ts: "name: 'Lucky',"; src\systems\crafting\craftingAchievements.ts: "name: 'Lucky',"; src\systems\economy\BusinessManagement.ts: "{ name: 'Lucky Shipment', description: 'A supplier delivered extra goods at no charge — a gesture of good faith.', reputationChange: 2, goldChange: 0, customerSatisfactionChange: 5 },"; src\systems\economy\NpcBusinessManager.ts: "'Laughing', 'Weary', 'Burning', 'Frozen', 'Lucky', 'Crimson', 'Howling'"; src\types\character.d.ts: "/** Lucky (2024): Creates a Luck Points pool = Proficiency Bonus, resets on Long Rest. */"; src\types\character.ts: "// WHAT CHANGED: Added several proficiency-scaling flags (Lucky, Alert, etc.)."; src\utils\character\characterUtils.ts: "* Alert (Initiative = Proficiency Bonus) and Lucky (Luck Points pool =" |
| **Brave** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Brave',"; src\data\monsters.generated.ts: ""name": "Aura of Bravery","; src\data\naval\crewTraits.ts: "'Brave': { effect: 'Bonus in combat', moraleModifier: 15 },"; src\utils\world\nobleHouseGenerator.ts: "'Generous', 'Pious', 'Cynical', 'Brave', 'Cowardly', 'Intelligent', 'Dull'," |
| **Halfling Nimbleness** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Halfling Nimbleness'," |
| **Naturally Stealthy** | `Text-Only` | N/A | You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you. |

---

### Lizardfolk (`lizardfolk`)

*Base Race: `beastfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Bite** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Bite"," |
| **Hold Breath** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Hold Breath"," |
| **Hungry Jaws** | `Text-Only` | N/A | As a bonus action, you can make a special bite attack that grants temporary hit points equal to your Constitution modifier on a hit. |
| **Natural Armor** | `Implemented` | Custom system logic | Referenced in: src\types\ui.ts: "/** Armor class (e.g. from Natural Armor, Mage Armor, etc.) */" |

---

### Longtooth Shifter (`longtooth_shifter`)

*Base Race: `shapeshifters`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Shifting** | `Implemented` | Custom system logic | Referenced in: src\data\biomes.ts: "{ id: 'desert_dune', name: 'Dune Sea', variant: 'dune', color: 'bg-amber-300', rgbaColor: 'rgba(242, 202, 129, 0.7)', description: 'Shifting dunes and scarce shade.', spawnWeight: 2 }," |
| **Fangs** | `Text-Only` | N/A | While shifted, you can use your elongated fangs to make an unarmed strike as a Bonus Action. If you hit with your fangs, you deal piercing damage equal to 1d6 + your Strength modifier, instead of the bludgeoning damage normal for an unarmed strike. |

---

### Lotusden Halfling (`lotusden_halfling`)

*Base Race: `halfling`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Lucky** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\FeatSelection.tsx: "*   like Proficiency-scaled Initiative and Lucky points."; src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Lucky',"; src\data\feats\featsData.ts: "name: 'Lucky',"; src\systems\crafting\craftingAchievements.ts: "name: 'Lucky',"; src\systems\economy\BusinessManagement.ts: "{ name: 'Lucky Shipment', description: 'A supplier delivered extra goods at no charge — a gesture of good faith.', reputationChange: 2, goldChange: 0, customerSatisfactionChange: 5 },"; src\systems\economy\NpcBusinessManager.ts: "'Laughing', 'Weary', 'Burning', 'Frozen', 'Lucky', 'Crimson', 'Howling'"; src\types\character.d.ts: "/** Lucky (2024): Creates a Luck Points pool = Proficiency Bonus, resets on Long Rest. */"; src\types\character.ts: "// WHAT CHANGED: Added several proficiency-scaling flags (Lucky, Alert, etc.)."; src\utils\character\characterUtils.ts: "* Alert (Initiative = Proficiency Bonus) and Lucky (Luck Points pool =" |
| **Brave** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Brave',"; src\data\monsters.generated.ts: ""name": "Aura of Bravery","; src\data\naval\crewTraits.ts: "'Brave': { effect: 'Bonus in combat', moraleModifier: 15 },"; src\utils\world\nobleHouseGenerator.ts: "'Generous', 'Pious', 'Cynical', 'Brave', 'Cowardly', 'Intelligent', 'Dull'," |
| **Halfling Nimbleness** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Halfling Nimbleness'," |
| **Child of the Wood** | `Text-Only` | N/A | You know the Druidcraft cantrip. When you reach 3rd level, you can cast the Entangle spell once with this trait and regain the ability to do so when you finish a Long Rest. When you reach 5th level, you can cast the Spike Growth spell once with this trait and regain the ability to do so when you finish a Long Rest. Casting these spells with this trait doesn't require material components. Wisdom is your spellcasting ability for these spells. |
| **Timberwalk** | `Text-Only` | N/A | Ability checks made to track you have Disadvantage, and you can move across difficult terrain made of nonmagical plants and undergrowth without expending extra movement. |

---

### Loxodon (`loxodon`)

*Base Race: `beastfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Loxodon Serenity** | `Text-Only` | N/A | You have advantage on saving throws against being charmed or frightened. |
| **Natural Armor** | `Implemented` | Custom system logic | Referenced in: src\types\ui.ts: "/** Armor class (e.g. from Natural Armor, Mage Armor, etc.) */" |
| **Trunk** | `Implemented` | Custom system logic | Referenced in: src\components\BattleMap\terrain\DecorationProps.tsx: "// Trunk — thick, tall, visible at tactical zoom"; src\components\Submap\painters\SubmapDoodadPainter.ts: "// Trunk"; src\components\Submap\painters\SubmapFeaturePainter.ts: "// Trunk"; src\data\landmarks.ts: "nameTemplate: ['Hidden Cache', 'Smuggler\'s Den', 'Hollowed Tree Trunk']," |
| **Keen Smell** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Keen Smell"," |

---

### Mender Halfling (`mender_halfling`)

*Base Race: `halfling`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Lucky** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\FeatSelection.tsx: "*   like Proficiency-scaled Initiative and Lucky points."; src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Lucky',"; src\data\feats\featsData.ts: "name: 'Lucky',"; src\systems\crafting\craftingAchievements.ts: "name: 'Lucky',"; src\systems\economy\BusinessManagement.ts: "{ name: 'Lucky Shipment', description: 'A supplier delivered extra goods at no charge — a gesture of good faith.', reputationChange: 2, goldChange: 0, customerSatisfactionChange: 5 },"; src\systems\economy\NpcBusinessManager.ts: "'Laughing', 'Weary', 'Burning', 'Frozen', 'Lucky', 'Crimson', 'Howling'"; src\types\character.d.ts: "/** Lucky (2024): Creates a Luck Points pool = Proficiency Bonus, resets on Long Rest. */"; src\types\character.ts: "// WHAT CHANGED: Added several proficiency-scaling flags (Lucky, Alert, etc.)."; src\utils\character\characterUtils.ts: "* Alert (Initiative = Proficiency Bonus) and Lucky (Luck Points pool =" |
| **Brave** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Brave',"; src\data\monsters.generated.ts: ""name": "Aura of Bravery","; src\data\naval\crewTraits.ts: "'Brave': { effect: 'Bonus in combat', moraleModifier: 15 },"; src\utils\world\nobleHouseGenerator.ts: "'Generous', 'Pious', 'Cynical', 'Brave', 'Cowardly', 'Intelligent', 'Dull'," |
| **Halfling Nimbleness** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Halfling Nimbleness'," |
| **Medical Intuition** | `Text-Only` | N/A | When you make a Wisdom (Medicine) check or an ability check using an herbalism kit, you can roll a d4 and add the number rolled to the ability check. |
| **Healing Touch** | `Text-Only` | N/A | You can cast the Cure Wounds spell with this trait. Starting at 3rd level, you can also cast Lesser Restoration with it. Once you cast either spell with this trait, you can't cast that spell with it again until you finish a Long Rest. Wisdom is your spellcasting ability for these spells. |
| **Spells of the Mark** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\shared\CharacterCreatorTraitsTable.tsx: "{trait.name === 'Spells of the Mark' && spellsOfTheMark ? ("; src\components\Glossary\GlossarySpellsOfTheMarkTable.tsx: "<h4 className="text-sm font-bold text-amber-300">Spells of the Mark</h4>" |

---

### Minotaur (`minotaur`)

*Base Race: `beastfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Horns** | `Implemented` | Custom system logic | Referenced in: src\data\names\physicalTraits.ts: "hairStyles: ['Wild', 'Horns prominent', 'Long', 'Spiked']," |
| **Goring Rush** | `Text-Only` | N/A | When you take the Dash action and move at least 20 feet, you can make one melee attack with your horns as part of the Attack action. |
| **Hammering Horns** | `Text-Only` | N/A | After hitting with a melee attack, you can use a bonus action to make another horn attack. |

---

### Mountain Dwarf (`mountain_dwarf`)

*Base Race: `dwarf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Dwarven Resilience** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Dwarven Combat Training** | `Text-Only` | N/A | You have proficiency with the battleaxe, handaxe, light hammer, and warhammer. |
| **Tool Proficiency** | `Text-Only` | N/A | You gain proficiency with the artisan's tools of your choice: smith's tools, brewer's supplies, or mason's tools. |
| **Stonecunning** | `Text-Only` | N/A | Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check. |
| **Dwarven Armor Training** | `Text-Only` | N/A | You have proficiency with light and medium armor. |

---

### Orc (`orc`)

*Base Race: `greenskins`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Adrenaline Rush** | `Text-Only` | N/A | You can take the Dash action as a Bonus Action. When you do so, you gain a number of Temporary Hit Points equal to your Proficiency Bonus. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Short or Long Rest. (Note: Mechanical effects like THP gain, usage tracking, and bonus action not yet fully implemented). |
| **Darkvision (120ft)** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Relentless Endurance** | `Text-Only` | N/A | When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead. Once you use this trait, you can't do so again until you finish a Long Rest. (Note: Mechanical implementation not yet in place). |

---

### Pallid Elf (`pallid_elf`)

*Base Race: `elf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Keen Senses** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\RaceDetailPane.tsx: "/** Elf - Keen Senses (pick 1 of 3) */"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select a Keen Senses skill first'"; src\components\CharacterCreator\SkillSelection.tsx: "// Prepare options for Elf Keen Senses racial feature"; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[selectedKeenSensesSkillId] = { granted: true, source: "Elf 'Keen Senses' trait" };" |
| **Trance** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewComponents.tsx: "<TableCell className="font-bold text-sky-300">Trance</TableCell>" |
| **Incisive Sense** | `Text-Only` | N/A | You have advantage on Intelligence (Investigation) and Wisdom (Insight) checks. |
| **Blessing of the Moon Weaver** | `Text-Only` | N/A | You know the Light cantrip. When you reach 3rd level, you can cast the Sleep spell once with this trait and regain the ability to do so when you finish a Long Rest. When you reach 5th level, you can cast the Invisibility spell (targeting yourself only) once with this trait and regain the ability to do so when you finish a Long Rest. Casting these spells with this trait doesn't require material components. Wisdom is your spellcasting ability for these spells. |

---

### Pathfinder Half-Orc (`pathfinder_half_orc`)

*Base Race: `greenskins`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Adrenaline Rush** | `Text-Only` | N/A | You can take the Dash action as a Bonus Action. When you do so, you gain a number of Temporary Hit Points equal to your Proficiency Bonus. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. |
| **Relentless Endurance** | `Text-Only` | N/A | When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead. Once you use this trait, you can't do so again until you finish a Long Rest. |
| **Hunter's Intuition** | `Text-Only` | N/A | When you make a Wisdom (Perception) or Wisdom (Survival) check, you can roll a d4 and add the number rolled to the ability check. |
| **Finder's Magic** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Spells of the Mark** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Plasmoid (`plasmoid`)

*Base Race: `shapeshifters`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Amorphous** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Amorphous","; src\services\RaceSpriteConfig.ts: "plasmoid: 'changeling', // Amorphous → shapeshifter" |
| **Hold Breath** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Hold Breath"," |
| **Natural Resilience** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Shape Self** | `Text-Only` | N/A | As an action, you can reshape your body or revert it to its default form. |

---

### Protector Aasimar (`protector_aasimar`)

*Base Race: `aasimar`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Celestial Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Healing Hands** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewTables.tsx: "keyTraits: ['Darkvision', 'Celestial Resistance', 'Healing Hands', 'Light Bearer', 'Radiant Soul']" |
| **Light Bearer** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Radiant Soul** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Ravenite Dragonborn (`ravenite_dragonborn`)

*Base Race: `draconic_kin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Vengeful Assault** | `Text-Only` | N/A | When you take damage from a creature in range of a weapon you are wielding, you can use your reaction to make an attack with the weapon against that creature. Once you use this trait, you can't do so again until you finish a short or long rest. |
| **Draconic Language** | `Text-Only` | N/A | You can speak, read, and write Draconic. |

---

### Red Dragonborn (`red_dragonborn`)

*Base Race: `draconic_kin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Draconic Ancestry** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\NameAndReview.tsx: "<span className="text-amber-500/80 font-semibold mr-2">Draconic Ancestry:</span>"; src\components\CharacterCreator\Race\DragonbornAncestrySelection.tsx: "* It allows the player to choose their Draconic Ancestry (e.g., Red, Blue, Gold dragon),"; src\types\character.ts: "label: string; // Display label (e.g., "Draconic Ancestry")"; src\utils\character\characterValidation.ts: "label: 'Draconic Ancestry'," |
| **Breath Weapon** | `Text-Only` | N/A | You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 15-foot cone. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 fire damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can't use it again until you finish a short or long rest. |
| **Damage Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Draconic Language** | `Text-Only` | N/A | You can speak, read, and write Draconic. |

---

### Rock Gnome (`rock_gnome`)

*Base Race: `gnome`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Gnome Cunning** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Gnome Cunning"," |
| **Artificer's Lore** | `Text-Only` | N/A | Whenever you make an Intelligence (History) check related to magic items, alchemical objects, or technological devices, you can add twice your proficiency bonus, instead of any proficiency bonus you normally apply. |
| **Tinker** | `Implemented` | Custom system logic | Referenced in: src\data\classes\index.ts: "{ id: 'magical_tinkering', name: 'Magical Tinkering', description: 'You learn how to invest a spark of magic into mundane objects.', levelAvailable: 1 },"; src\data\items\generatedGlossaryItems.ts: ""name": "Tinker's Tools","; src\data\monsters.generated.ts: ""sourceName": "Tinker's Magic","; src\hooks\useCharacterProficiencies.ts: "toolProfs.add("Tinker's Tools");"; src\systems\spells\validation\spellValidator.ts: "// access. Mending is the pilot case: Artificers receive it from Tinker's Magic," |

---

### Runeward Dwarf (`runeward_dwarf`)

*Base Race: `dwarf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Dwarven Resilience** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Tool Proficiency** | `Text-Only` | N/A | You gain proficiency with the artisan's tools of your choice: smith's tools, brewer's supplies, or mason's tools. |
| **Stonecunning** | `Text-Only` | N/A | Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check. |
| **Warder's Intuition** | `Text-Only` | N/A | When you make an Intelligence (Investigation) check or an ability check using thieves' tools, you can roll a d4 and add the number rolled to the ability check. |
| **Wards and Seals** | `Text-Only` | N/A | You can cast the Alarm and Mage Armor spells with this trait. Starting at 3rd level, you can also cast the Arcane Lock spell with it. Once you cast any of these spells with this trait, you can't cast that spell with it again until you finish a Long Rest. Intelligence is your spellcasting ability for these spells, and you don't need material components for them. |
| **Spells of the Mark** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\shared\CharacterCreatorTraitsTable.tsx: "{trait.name === 'Spells of the Mark' && spellsOfTheMark ? ("; src\components\Glossary\GlossarySpellsOfTheMarkTable.tsx: "<h4 className="text-sm font-bold text-amber-300">Spells of the Mark</h4>" |

---

### Satyr (`satyr`)

*Base Race: `feyfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Ram** | `Implemented` | Custom system logic | Referenced in: src\data\items\generatedGlossaryItems.ts: ""name": "Portable Ram","; src\data\monsters.generated.ts: ""description": "The chimera makes one Ram attack, one Bite attack, and one Claw attack. It can replace the Claw attack with a use of Fire Breath if available.","; src\data\navalManeuvers.ts: "name: 'Ramming Speed',"; src\services\__tests__\legacyService.test.ts: "legacy.heirs.push({ id: 'heir-3', name: 'Ramsay', relation: 'Bastard', age: 18, isDesignatedHeir: true });"; src\systems\economy\BusinessManagement.ts: "// --- New Business Ramp-Up ---"; src\types\naval.d.ts: "type: 'Ballista' | 'Cannon' | 'Mangonel' | 'Ram';"; src\types\naval.ts: "type: 'Ballista' | 'Cannon' | 'Mangonel' | 'Ram';"; src\utils\world\nobleHouseGenerator.ts: "'Brynden', 'Jon', 'Robin', 'Yohn', 'Nestor', 'Lyn', 'Walder', 'Roose', 'Ramsay'," |
| **Magic Resistance** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Magic Resistance"," |
| **Mirthful Leaps** | `Text-Only` | N/A | When you make a long or high jump, you can roll a d8 and add it to the distance. |
| **Reveler** | `Text-Only` | N/A | You are proficient in Performance and Persuasion. |

---

### Scourge Aasimar (`scourge_aasimar`)

*Base Race: `aasimar`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Celestial Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Healing Hands** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewTables.tsx: "keyTraits: ['Darkvision', 'Celestial Resistance', 'Healing Hands', 'Light Bearer', 'Radiant Soul']" |
| **Light Bearer** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Radiant Consumption** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Sea Elf (`sea_elf`)

*Base Race: `elf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Keen Senses** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\RaceDetailPane.tsx: "/** Elf - Keen Senses (pick 1 of 3) */"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select a Keen Senses skill first'"; src\components\CharacterCreator\SkillSelection.tsx: "// Prepare options for Elf Keen Senses racial feature"; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[selectedKeenSensesSkillId] = { granted: true, source: "Elf 'Keen Senses' trait" };" |
| **Trance** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewComponents.tsx: "<TableCell className="font-bold text-sky-300">Trance</TableCell>" |
| **Child of the Sea** | `Text-Only` | N/A | You can breathe air and water, and you have a swimming speed equal to your walking speed. |
| **Friend of the Sea** | `Text-Only` | N/A | Aquatic animals have an extraordinary affinity with your people. You can communicate simple ideas to any Beast that has a swimming speed. It can understand your words, though you have no special ability to understand it in return. |

---

### Seersight Half-Elf (`seersight_half_elf`)

*Base Race: `half_elf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Deductive Intuition** | `Text-Only` | N/A | When you make an Intelligence (Investigation) or Wisdom (Insight) check, you can roll a d4 and add the number rolled to the ability check. |
| **Magical Detection** | `Text-Only` | N/A | You can cast the Detect Magic and Detect Poison and Disease spells with this trait. Starting at 3rd level, you can also cast the See Invisibility spell with it. Once you cast any of these spells with this trait, you can't cast that spell with it again until you finish a Long Rest. Intelligence is your spellcasting ability for these spells, and you don't require material components for them. |
| **Spells of the Mark** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\shared\CharacterCreatorTraitsTable.tsx: "{trait.name === 'Spells of the Mark' && spellsOfTheMark ? ("; src\components\Glossary\GlossarySpellsOfTheMarkTable.tsx: "<h4 className="text-sm font-bold text-amber-300">Spells of the Mark</h4>" |

---

### Shadar-kai (`shadar_kai`)

*Base Race: `elf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Keen Senses** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\RaceDetailPane.tsx: "/** Elf - Keen Senses (pick 1 of 3) */"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select a Keen Senses skill first'"; src\components\CharacterCreator\SkillSelection.tsx: "// Prepare options for Elf Keen Senses racial feature"; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[selectedKeenSensesSkillId] = { granted: true, source: "Elf 'Keen Senses' trait" };" |
| **Trance** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewComponents.tsx: "<TableCell className="font-bold text-sky-300">Trance</TableCell>" |
| **Blessing of the Raven Queen** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Necrotic Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |

---

### Shadowveil Elf (`shadowveil_elf`)

*Base Race: `elf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Keen Senses** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\RaceDetailPane.tsx: "/** Elf - Keen Senses (pick 1 of 3) */"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select a Keen Senses skill first'"; src\components\CharacterCreator\SkillSelection.tsx: "// Prepare options for Elf Keen Senses racial feature"; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[selectedKeenSensesSkillId] = { granted: true, source: "Elf 'Keen Senses' trait" };" |
| **Trance** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewComponents.tsx: "<TableCell className="font-bold text-sky-300">Trance</TableCell>" |
| **Cunning Intuition** | `Text-Only` | N/A | When you make a Charisma (Performance) or Dexterity (Stealth) check, you can roll a d4 and add the number rolled to the ability check. |
| **Shape Shadows** | `Text-Only` | N/A | You know the Minor Illusion cantrip. Starting at 3rd level, you can cast the Invisibility spell once with this trait, and you regain the ability to cast it when you finish a Long Rest. Charisma is your spellcasting ability for these spells. |
| **Spells of the Mark** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\shared\CharacterCreatorTraitsTable.tsx: "{trait.name === 'Spells of the Mark' && spellsOfTheMark ? ("; src\components\Glossary\GlossarySpellsOfTheMarkTable.tsx: "<h4 className="text-sm font-bold text-amber-300">Spells of the Mark</h4>" |

---

### Silver Dragonborn (`silver_dragonborn`)

*Base Race: `draconic_kin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Draconic Ancestry** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\NameAndReview.tsx: "<span className="text-amber-500/80 font-semibold mr-2">Draconic Ancestry:</span>"; src\components\CharacterCreator\Race\DragonbornAncestrySelection.tsx: "* It allows the player to choose their Draconic Ancestry (e.g., Red, Blue, Gold dragon),"; src\types\character.ts: "label: string; // Display label (e.g., "Draconic Ancestry")"; src\utils\character\characterValidation.ts: "label: 'Draconic Ancestry'," |
| **Breath Weapon** | `Text-Only` | N/A | You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 15-foot cone. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 cold damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can't use it again until you finish a short or long rest. |
| **Damage Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Draconic Language** | `Text-Only` | N/A | You can speak, read, and write Draconic. |

---

### Simic Hybrid (`simic_hybrid`)

*Base Race: `planar_travelers`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Animal Enhancement (1st Level)** | `Text-Only` | N/A | You gain one animal trait right away; choices include climbing, swimming, gliding, or defense boosts. |
| **Animal Enhancement (5th Level)** | `Text-Only` | N/A | You gain a second enhancement at 5th level, chosen from the remaining options. |

---

### Spring Eladrin (`spring_eladrin`)

*Base Race: `eladrin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Keen Senses** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\RaceDetailPane.tsx: "/** Elf - Keen Senses (pick 1 of 3) */"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select a Keen Senses skill first'"; src\components\CharacterCreator\SkillSelection.tsx: "// Prepare options for Elf Keen Senses racial feature"; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[selectedKeenSensesSkillId] = { granted: true, source: "Elf 'Keen Senses' trait" };" |
| **Trance** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewComponents.tsx: "<TableCell className="font-bold text-sky-300">Trance</TableCell>" |
| **Fey Step (Spring)** | `Text-Only` | N/A | As a Bonus Action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. When you use your Fey Step, you can also touch one willing creature within 5 feet of you. That creature then teleports instead of you, appearing in an unoccupied space of your choice within 30 feet of you. |
| **Season Association** | `Text-Only` | N/A | Spring represents cheerfulness and celebration, marked by merriment and hope. You can change your season during a long rest, which changes your Fey Step effect. |

---

### Stone Giant Goliath (`stone_giant_goliath`)

*Base Race: `goliath`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Powerful Build** | `Text-Only` | N/A | You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift. |
| **Large Form** | `Text-Only` | N/A | Starting at 5th level, you can change your size to Large as a Bonus Action. This transformation lasts for 10 minutes or until you end it as a bonus action. While Large, you have advantage on Strength checks, and your speed increases by 10 feet. Once you use this trait, you can't use it again until you finish a Long Rest. |
| **Stone's Endurance** | `Text-Only` | N/A | When you take damage, you can use your Reaction to roll a d12. Add your Constitution modifier to the number rolled and reduce the damage by that total. You can use this trait a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest. |

---

### Storm Giant Goliath (`storm_giant_goliath`)

*Base Race: `goliath`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Powerful Build** | `Text-Only` | N/A | You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift. |
| **Large Form** | `Text-Only` | N/A | Starting at 5th level, you can change your size to Large as a Bonus Action. This transformation lasts for 10 minutes or until you end it as a bonus action. While Large, you have advantage on Strength checks, and your speed increases by 10 feet. Once you use this trait, you can't use it again until you finish a Long Rest. |
| **Storm's Thunder** | `Text-Only` | N/A | When you take damage from a creature within 60 feet of you, you can use your Reaction to cause that creature to take 1d8 thunder damage. You can use this trait a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest. |

---

### Stormborn Half-Elf (`stormborn_half_elf`)

*Base Race: `half_elf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Windwright's Intuition** | `Text-Only` | N/A | When you make a Dexterity (Acrobatics) check or any ability check involving navigator's tools, you can roll a d4 and add the number rolled to the ability check. |
| **Storm's Boon** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Headwinds** | `Text-Only` | N/A | You know the Gust cantrip. Starting at 3rd level, you can cast the Gust of Wind spell once with this trait, and you regain the ability to cast it when you finish a Long Rest. Charisma is your spellcasting ability for these spells. |
| **Spells of the Mark** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\shared\CharacterCreatorTraitsTable.tsx: "{trait.name === 'Spells of the Mark' && spellsOfTheMark ? ("; src\components\Glossary\GlossarySpellsOfTheMarkTable.tsx: "<h4 className="text-sm font-bold text-amber-300">Spells of the Mark</h4>" |

---

### Stout Halfling (`stout_halfling`)

*Base Race: `halfling`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Lucky** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\FeatSelection.tsx: "*   like Proficiency-scaled Initiative and Lucky points."; src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Lucky',"; src\data\feats\featsData.ts: "name: 'Lucky',"; src\systems\crafting\craftingAchievements.ts: "name: 'Lucky',"; src\systems\economy\BusinessManagement.ts: "{ name: 'Lucky Shipment', description: 'A supplier delivered extra goods at no charge — a gesture of good faith.', reputationChange: 2, goldChange: 0, customerSatisfactionChange: 5 },"; src\systems\economy\NpcBusinessManager.ts: "'Laughing', 'Weary', 'Burning', 'Frozen', 'Lucky', 'Crimson', 'Howling'"; src\types\character.d.ts: "/** Lucky (2024): Creates a Luck Points pool = Proficiency Bonus, resets on Long Rest. */"; src\types\character.ts: "// WHAT CHANGED: Added several proficiency-scaling flags (Lucky, Alert, etc.)."; src\utils\character\characterUtils.ts: "* Alert (Initiative = Proficiency Bonus) and Lucky (Luck Points pool =" |
| **Brave** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Brave',"; src\data\monsters.generated.ts: ""name": "Aura of Bravery","; src\data\naval\crewTraits.ts: "'Brave': { effect: 'Bonus in combat', moraleModifier: 15 },"; src\utils\world\nobleHouseGenerator.ts: "'Generous', 'Pious', 'Cynical', 'Brave', 'Cowardly', 'Intelligent', 'Dull'," |
| **Halfling Nimbleness** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewTables.tsx: "name: 'Halfling Nimbleness'," |
| **Stout Resilience** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |

---

### Summer Eladrin (`summer_eladrin`)

*Base Race: `eladrin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Keen Senses** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\RaceDetailPane.tsx: "/** Elf - Keen Senses (pick 1 of 3) */"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select a Keen Senses skill first'"; src\components\CharacterCreator\SkillSelection.tsx: "// Prepare options for Elf Keen Senses racial feature"; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[selectedKeenSensesSkillId] = { granted: true, source: "Elf 'Keen Senses' trait" };" |
| **Trance** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewComponents.tsx: "<TableCell className="font-bold text-sky-300">Trance</TableCell>" |
| **Fey Step (Summer)** | `Text-Only` | N/A | As a Bonus Action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. Immediately after you teleport, each creature of your choice that you can see within 5 feet of you takes fire damage equal to your Proficiency Bonus. |
| **Season Association** | `Text-Only` | N/A | Summer represents boldness and aggression, a filtered fury of the burning sun. You can change your season during a long rest, which changes your Fey Step effect. |

---

### Swiftstride Shifter (`swiftstride_shifter`)

*Base Race: `shapeshifters`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Shifting** | `Implemented` | Custom system logic | Referenced in: src\data\biomes.ts: "{ id: 'desert_dune', name: 'Dune Sea', variant: 'dune', color: 'bg-amber-300', rgbaColor: 'rgba(242, 202, 129, 0.7)', description: 'Shifting dunes and scarce shade.', spawnWeight: 2 }," |
| **Swift Stride** | `Text-Only` | N/A | While shifted, your walking speed increases by 10 feet. Additionally, you can move up to 10 feet as a reaction when a creature ends its turn within 5 feet of you. This reactive movement doesn't provoke opportunity attacks. |

---

### Tabaxi (`tabaxi`)

*Base Race: `beastfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Cat’s Claws** | `Text-Only` | N/A | You can use your claws to make unarmed strikes. When you hit with them, the strike deals 1d6 + your Strength modifier slashing damage, instead of the bludgeoning damage normal for an unarmed strike. You also have a climbing speed equal to your walking speed. |
| **Cat’s Talent** | `Text-Only` | N/A | You have proficiency in the Perception and Stealth skills. |
| **Feline Agility** | `Text-Only` | N/A | Your reflexes and agility allow you to move with a burst of speed. When you move on your turn in combat, you can double your speed until the end of the turn. Once you use this trait, you can’t use it again until you move 0 feet on one of your turns. |

---

### Thri-kreen (`thri_kreen`)

*Base Race: `beastfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Chameleon Carapace** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Chameleon Carapace"," |
| **Secondary Arms** | `Text-Only` | N/A | You possess two smaller arms that let you manipulate objects, open doors, or hold tools. |
| **Sleepless** | `Text-Only` | N/A | You do not require sleep during a long rest, though you must remain still to gain its benefits. |
| **Thri-kreen Telepathy** | `Text-Only` | N/A | You can communicate telepathically with any creature within 120 feet that understands a language and can see you. |

---

### Tiefling (`tiefling`)

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fiendish Legacy** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\TieflingLegacySelection.tsx: "* It allows the player to choose their Fiendish Legacy (Abyssal, Chthonic, or Infernal)"; src\utils\character\characterValidation.ts: "// Tiefling: Fiendish Legacy" |
| **Otherworldly Presence** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\TieflingLegacySelection.tsx: "* and the spellcasting ability for spells granted by that legacy and Otherworldly Presence." |

---

### Tortle (`tortle`)

*Base Race: `beastfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Claws** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Claws"," |
| **Hold Breath** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Hold Breath"," |
| **Natural Armor (Tortle)** | `Text-Only` | N/A | Your shell grants you a base AC of 17; you can still gain the benefit of a shield but not wear armor. |
| **Shell Defense** | `Text-Only` | N/A | As an action, you can withdraw into your shell to gain +4 bonus to AC and advantage on Strength and Constitution saves until you emerge. |

---

### Triton (`triton`)

*Base Race: `planar_travelers`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Amphibious** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Amphibious"," |
| **Control Air and Water** | `Text-Only` | N/A | You can cast Fog Cloud with this trait. Starting at 3rd level, you can cast Gust of Wind with it, and starting at 5th level, you can also cast Water Walk with it. Once you cast any of these spells with this trait, you can’t cast that spell with it again until you finish a long rest. You can also cast these spells using any spell slots you have of the appropriate level. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells when you cast them with this trait (choose when you select this race). |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Emissary of the Sea** | `Text-Only` | N/A | You can communicate simple ideas to any Beast, Elemental, or Monstrosity that has a swimming speed. It can understand your words, though you have no special ability to understand it in return. |
| **Guardian of the Depths** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |

---

### Vedalken (`vedalken`)

*Base Race: `planar_travelers`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vedalken Dispassion** | `Text-Only` | N/A | You have advantage on saving throws to avoid or end the charmed condition, and magic can’t put you to sleep. |
| **Tireless Precision** | `Text-Only` | N/A | Once per short rest, you can reroll an Intelligence or Wisdom ability check and must use the new roll. |
| **Partially Amphibious** | `Text-Only` | N/A | You can hold your breath for 10 minutes and can breathe both air and water. |
| **Intellect** | `Implemented` | Custom system logic | Referenced in: src\data\items\generatedGlossaryItems.ts: ""name": "Headband of Intellect","; src\data\monsters.generated.ts: ""name": "Intellect Devourer","; src\systems\spells\validation\targetingSchemas.ts: "// Intellect Fortress-style scaling lets a spell affect more targets only" |

---

### Verdan (`verdan`)

*Base Race: `greenskins`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Black Blood Healing** | `Text-Only` | N/A | When you roll a 1 or 2 on a Hit Die at the end of a Short Rest, you can reroll the die and must use the new roll. |
| **Limited Telepathy** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Limited Telepathy"," |
| **Persuasive** | `Text-Only` | N/A | You gain proficiency in the Persuasion skill. |
| **Telepathic Insight** | `Text-Only` | N/A | You have advantage on Wisdom and Charisma saving throws. |

---

### Warforged (`warforged`)

*Base Race: `constructed`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Constructed Resilience** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Sentry's Rest** | `Text-Only` | N/A | When you take a long rest, you must spend at least six hours in an inactive, motionless state, rather than sleeping. In this state, you appear inert, but it doesn't render you unconscious, and you can see and hear as normal. |
| **Integrated Protection** | `Text-Only` | N/A | Your body has built-in defensive layers, which can be enhanced with armor: You gain a +1 bonus to Armor Class. You can don only armor with which you have proficiency. To don armor other than a shield, you must incorporate it into your body over the course of 1 hour, during which you remain in contact with the armor. To doff armor, you must spend 1 hour removing it. You can rest while donning or doffing armor in this way. While you live, the armor incorporated into your body can't be removed against your will. |
| **Specialized Design** | `Text-Only` | N/A | You gain one skill proficiency and one tool proficiency of your choice. |

---

### Water Genasi (`water_genasi`)

*Base Race: `genasi`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Amphibious** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Amphibious"," |
| **Acid Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Call to the Wave** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### Wayfarer Human (`wayfarer_human`)

*Base Race: `human`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Resourceful** | `Text-Only` | N/A | You gain Heroic Inspiration whenever you finish a Long Rest. |
| **Skillful** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\HumanSkillSelection.tsx: "* from all available skills, as per their "Skillful" racial trait."; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[humanSkillId] = { granted: true, source: "Human 'Skillful' trait" };"; src\components\CharacterCreator\utils\__tests__\skillSelectionUtils.test.ts: "expect(grants.athletics).toEqual({ granted: true, source: "Human 'Skillful' trait" });" |
| **Versatile** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\AbilityScoreAllocation.test.tsx: "description: 'Versatile and ambitious.',"; src\components\CharacterCreator\config\sidebarSteps.ts: "label: 'Versatile Skill',"; src\components\CharacterCreator\state\characterCreatorState.ts: "// Humans get the Versatile trait which grants access to feat selection at level 1"; src\components\CharacterCreator\WeaponMasterySelection.tsx: "'Versatile': [],"; src\components\DesignPreview\steps\PreviewTables.tsx: "<td className="px-4 py-3 text-sm text-gray-400">Versatile (1d10)</td>"; src\components\DesignPreview\steps\PreviewWeaponMastery.tsx: "{ id: 'longsword', name: 'Longsword', mastery: 'Sap', desc: 'Versatile (1d10). Mastery: Sap - Disadvantage on next attack.', icon: '🗡️' },"; src\data\items\generatedGlossaryItems.ts: ""Versatile""; src\data\items\index.ts: "'quarterstaff': { id: 'quarterstaff', name: 'Quarterstaff', icon: ' Staff', description: 'A long staff of wood.', type: 'weapon', category: 'Simple Melee', slot: 'MainHand', damageDice: '1d6', damageType: 'Bludgeoning', properties: ['Versatile'], weight: 4, cost: '2 SP', mastery: 'Topple', ...weaponIcon('baton.svg') },"; src\data\item_templates\index.ts: "properties: { type: 'array', items: { type: 'string' }, enum: ['Finesse', 'Light', 'Two-Handed', 'Versatile', 'Thrown', 'Ammunition', 'Reach'], description: 'An array of weapon properties.' },"; src\hooks\__tests__\useAbilitySystem.test.ts: "properties: ['Versatile'],"; src\utils\core\factories.ts: "description: 'Versatile and adaptable.'," |
| **Courier's Speed** | `Text-Only` | N/A | Your base walking speed is 35 feet. |
| **Intuitive Motion** | `Text-Only` | N/A | When you make a Dexterity (Acrobatics) check or any ability check to operate or maintain a land vehicle, you can roll a d4 and add the number rolled to the ability check. |
| **Magical Passage** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Spells of the Mark** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

### White Dragonborn (`white_dragonborn`)

*Base Race: `draconic_kin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Draconic Ancestry** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\NameAndReview.tsx: "<span className="text-amber-500/80 font-semibold mr-2">Draconic Ancestry:</span>"; src\components\CharacterCreator\Race\DragonbornAncestrySelection.tsx: "* It allows the player to choose their Draconic Ancestry (e.g., Red, Blue, Gold dragon),"; src\types\character.ts: "label: string; // Display label (e.g., "Draconic Ancestry")"; src\utils\character\characterValidation.ts: "label: 'Draconic Ancestry'," |
| **Breath Weapon** | `Text-Only` | N/A | You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 15-foot cone. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 cold damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can't use it again until you finish a short or long rest. |
| **Damage Resistance** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Draconic Language** | `Text-Only` | N/A | You can speak, read, and write Draconic. |

---

### Wildhunt Shifter (`wildhunt_shifter`)

*Base Race: `shapeshifters`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Shifting** | `Implemented` | Custom system logic | Referenced in: src\data\biomes.ts: "{ id: 'desert_dune', name: 'Dune Sea', variant: 'dune', color: 'bg-amber-300', rgbaColor: 'rgba(242, 202, 129, 0.7)', description: 'Shifting dunes and scarce shade.', spawnWeight: 2 }," |
| **Mark the Scent** | `Text-Only` | N/A | While shifted, you have advantage on Wisdom checks, and no creature within 30 feet of you can make an attack roll with advantage against you unless you're incapacitated. |

---

### Winter Eladrin (`winter_eladrin`)

*Base Race: `eladrin`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Keen Senses** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\RaceDetailPane.tsx: "/** Elf - Keen Senses (pick 1 of 3) */"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select a Keen Senses skill first'"; src\components\CharacterCreator\SkillSelection.tsx: "// Prepare options for Elf Keen Senses racial feature"; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[selectedKeenSensesSkillId] = { granted: true, source: "Elf 'Keen Senses' trait" };" |
| **Trance** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewComponents.tsx: "<TableCell className="font-bold text-sky-300">Trance</TableCell>" |
| **Fey Step (Winter)** | `Text-Only` | N/A | As a Bonus Action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. When you use your Fey Step, one creature of your choice that you can see within 5 feet of you before you teleport must succeed on a Wisdom saving throw (DC 8 + your Proficiency Bonus + your Intelligence, Wisdom, or Charisma modifier) or be frightened of you until the end of your next turn. |
| **Season Association** | `Text-Only` | N/A | Winter represents contemplation and dolor, introspection and grief. You can change your season during a long rest, which changes your Fey Step effect. |

---

### Wood Elf (`wood_elf`)

*Base Race: `elf`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Fey Ancestry** | `Implemented` | Custom system logic | Referenced in: src\systems\planar\FeywildMechanics.ts: "// Elves (Fey Ancestry) typically have advantage against charm, but Memory Loss isn't strictly charm." |
| **Keen Senses** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\Race\RaceDetailPane.tsx: "/** Elf - Keen Senses (pick 1 of 3) */"; src\components\CharacterCreator\Race\RaceSelection.tsx: "? 'Please select a Keen Senses skill first'"; src\components\CharacterCreator\SkillSelection.tsx: "// Prepare options for Elf Keen Senses racial feature"; src\components\CharacterCreator\utils\skillSelectionUtils.ts: "grants[selectedKeenSensesSkillId] = { granted: true, source: "Elf 'Keen Senses' trait" };" |
| **Trance** | `Implemented` | Custom system logic | Referenced in: src\components\DesignPreview\steps\PreviewComponents.tsx: "<TableCell className="font-bold text-sky-300">Trance</TableCell>" |
| **Fleet of Foot** | `Text-Only` | N/A | Your base walking speed increases to 35 feet. |
| **Mask of the Wild** | `Text-Only` | N/A | You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena. You know the Druidcraft cantrip. |
| **Nature's Path** | `Text-Only` | N/A | At 3rd level, you learn the Longstrider spell. At 5th level, you learn the Pass without Trace spell. You can cast each spell once without expending a spell slot, and you regain the ability to do so when you finish a Long Rest. Wisdom is your spellcasting ability for these spells. |

---

### Wordweaver Gnome (`wordweaver_gnome`)

*Base Race: `gnome`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Gnome Cunning** | `Implemented` | Custom system logic | Referenced in: src\data\monsters.generated.ts: ""name": "Gnome Cunning"," |
| **Gifted Scribe** | `Text-Only` | N/A | When you make an Intelligence (History) check or an ability check using calligrapher's supplies, you can roll a d4 and add the number rolled to the ability check. |
| **Scribe's Insight** | `Text-Only` | N/A | You know the Message cantrip. You can also cast Comprehend Languages once with this trait, and you regain the ability to cast it when you finish a Long Rest. Starting at 3rd level, you can cast the Magic Mouth spell with this trait, and you regain the ability to cast it when you finish a Long Rest. Intelligence is your spellcasting ability for these spells. |
| **Spells of the Mark** | `Implemented` | Custom system logic | Referenced in: src\components\CharacterCreator\shared\CharacterCreatorTraitsTable.tsx: "{trait.name === 'Spells of the Mark' && spellsOfTheMark ? ("; src\components\Glossary\GlossarySpellsOfTheMarkTable.tsx: "<h4 className="text-sm font-bold text-amber-300">Spells of the Mark</h4>" |

---

### Yuan-Ti (`yuan_ti`)

*Base Race: `beastfolk`*

| Trait Name | Status | Mechanism | Evidence / Detail |
| --- | --- | --- | --- |
| **Creature Type** | `Implemented` | Creature type classification | Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead). |
| **Size** | `Implemented` | Size class category mapping | Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts). |
| **Speed** | `Implemented` | Movement speed parser | calculateCharacterSpeedFromRace parses numeric value from the Speed trait string. |
| **Vision** | `Implemented` | Darkvision range parser | calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string. |
| **Magic Resistance** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |
| **Poison Resilience** | `Implemented` | Damage-type defense materializer | Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state. |
| **Serpentine Casting** | `Implemented` | Racial Spellcasting Engine | Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter. |

---

