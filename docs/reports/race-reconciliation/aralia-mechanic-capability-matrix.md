# Aralia Race Mechanic Capability Matrix

This matrix records what Aralia can prove from current code paths. A race detail is only reported as enforced when a capability row names concrete enforcement code.

## walk_speed

- Support status: enforced
- Confidence: high
- Data fields: race.traits, PlayerCharacter.speed
- Enforcement paths: src/components/CharacterCreator/hooks/useCharacterAssembly.ts:calculateCharacterSpeed, src/utils/character/characterUtils.ts:calculateCharacterSpeedFromRace, src/utils/character/characterUtils.ts:normalizeCharacterRaceData
- Display paths: src/components/CharacterCreator/NameAndReview.tsx, src/components/CharacterSheet/Overview/CharacterOverview.tsx
- Example race IDs: human, wood_elf, air_genasi
- Limitations: Only the walking speed number is enforced; fly, swim, climb, and burrow text is not structured.

## darkvision

- Support status: enforced
- Confidence: high
- Data fields: race.traits, PlayerCharacter.darkvisionRange
- Enforcement paths: src/components/CharacterCreator/hooks/useCharacterAssembly.ts:calculateCharacterDarkvision, src/utils/character/characterUtils.ts:calculateCharacterDarkvisionFromRace, src/utils/character/characterUtils.ts:normalizeCharacterRaceData
- Display paths: src/components/CharacterSheet/Overview/CharacterOverview.tsx
- Example race IDs: drow, deep_gnome, half_orc
- Limitations: Darkvision range is numeric only; lighting rules and magical-darkness exceptions are not modeled here.

## fixed_ability_bonus

- Support status: enforced
- Confidence: high
- Data fields: race.abilityBonuses, PlayerCharacter.finalAbilityScores
- Enforcement paths: src/utils/character/statUtils.ts:calculateFixedRacialBonuses, src/utils/character/statUtils.ts:calculateFinalAbilityScores, src/components/CharacterCreator/state/characterCreatorState.ts
- Display paths: src/components/CharacterCreator/NameAndReview.tsx
- Example race IDs: half_orc, hill_dwarf
- Limitations: Flexible Any bonuses are intentionally skipped by the fixed-bonus calculator and handled by point-buy/choice flow.

## known_racial_spells

- Support status: enforced
- Confidence: high
- Data fields: race.knownSpells, PlayerCharacter.spellbook
- Enforcement paths: src/utils/character/spellUtils.ts:getCharacterSpells, src/utils/character/characterValidation.ts:validateCharacterChoices
- Display paths: src/components/CharacterCreator/NameAndReview.tsx
- Example race IDs: air_genasi, aarakocra, abyssal_tiefling
- Limitations: The spell grant is aggregated, but rest-limited casting uses and free cast tracking are not enforced.

## racial_spell_ability_choice

- Support status: represented_only
- Confidence: medium
- Data fields: race.racialSpellChoice, PlayerCharacter.racialSelections
- Enforcement paths: src/utils/character/characterValidation.ts:validateCharacterChoices
- Display paths: src/components/CharacterCreator/state/characterCreatorState.ts, src/components/CharacterCreator/config/sidebarSteps.ts
- Example race IDs: air_genasi, aarakocra
- Limitations: The choice is stored and validated, but the current spell utility does not use it to calculate save DC or attack bonuses.

## required_race_choice

- Support status: enforced
- Confidence: high
- Data fields: PlayerCharacter.racialSelections, RaceDataBundle
- Enforcement paths: src/utils/character/characterValidation.ts:validateCharacterChoices, src/components/CharacterCreator/state/characterCreatorState.ts
- Display paths: src/components/Party/PartyPane/PartyMemberCard.tsx
- Example race IDs: elf, tiefling, goliath
- Limitations: Only the known chooser families in validation are covered. Reflavored standalone races need their own explicit choice handling.

## fixed_or_selected_skill_proficiency

- Support status: enforced
- Confidence: medium
- Data fields: PlayerCharacter.skills, PlayerCharacter.racialSelections
- Enforcement paths: src/components/CharacterCreator/hooks/useCharacterAssembly.ts:assembleFinalSkills, src/components/CharacterCreator/utils/skillSelectionUtils.ts:buildSkillsForSubmit
- Display paths: src/components/CharacterCreator/SkillSelection.tsx
- Example race IDs: human, elf, bugbear, centaur, changeling
- Limitations: Only currently hardcoded race skill grants and choices are enforced; arbitrary trait text is not automatically converted.

## canonical_race_rehydration

- Support status: enforced
- Confidence: high
- Data fields: PlayerCharacter.race, ALL_RACES_DATA
- Enforcement paths: src/utils/character/characterUtils.ts:normalizeCharacterRaceData
- Display paths: src/services/premadeCharacterService.ts
- Example race IDs: human, half_orc
- Limitations: Rehydration restores canonical race data by ID; missing racialSelections remain validation work.

## race_derived_hp_ac_recalculation

- Support status: enforced
- Confidence: medium
- Data fields: PlayerCharacter.finalAbilityScores, PlayerCharacter.maxHp, PlayerCharacter.armorClass
- Enforcement paths: src/utils/character/characterUtils.ts:updateDerivedStats, src/utils/character/statUtils.ts:calculateFinalAbilityScores, src/utils/character/statUtils.ts:calculateArmorClass
- Display paths: src/components/CharacterSheet/Overview/CharacterOverview.tsx
- Example race IDs: half_orc, hill_dwarf
- Limitations: This enforces derived HP/AC from ability scores and equipment, not standalone race traits like natural armor unless encoded elsewhere.

## visual_metadata

- Support status: display_only
- Confidence: high
- Data fields: race.visual, race.imageUrl
- Enforcement paths: none
- Display paths: src/components/CharacterCreator/Race/RaceDetailModal.tsx, src/components/CharacterCreator/shared/CharacterCreatorTraitsTable.tsx
- Example race IDs: aarakocra, half_orc
- Limitations: Visual data supports selection/display, not gameplay.

## display_identity_text

- Support status: display_only
- Confidence: high
- Data fields: race.traits, race.description, glossary race JSON
- Enforcement paths: none
- Display paths: src/components/CharacterCreator/Race/RaceDetailModal.tsx
- Example race IDs: human, aarakocra
- Limitations: Creature type, size, culture, age, and lore text are shown but not used as mechanical gates.

## once_per_rest_spell

- Support status: represented_only
- Confidence: medium
- Data fields: race.knownSpells, race.racialSpellChoice, race.traits
- Enforcement paths: src/utils/character/spellUtils.ts:getCharacterSpells
- Display paths: src/components/CharacterCreator/NameAndReview.tsx
- Example race IDs: aarakocra, duergar, firbolg
- Limitations: The spell can be known/displayed, but free uses and rest reset limits are not tracked for racial spells.

## tool_weapon_language_proficiency

- Support status: display_only
- Confidence: medium
- Data fields: race.traits
- Enforcement paths: none
- Display paths: src/components/CharacterCreator/Race/RaceDetailModal.tsx
- Example race IDs: dragonborn, githyanki
- Limitations: Race has no structured language/tool/weapon proficiency fields in src/types/character.ts yet.

## alternate_movement_mode

- Support status: unsupported
- Confidence: high
- Data fields: race.traits
- Enforcement paths: none
- Display paths: none
- Example race IDs: aarakocra, sea_elf, tabaxi
- Limitations: Fly, swim, climb, and burrow speeds are not separate PlayerCharacter movement fields.

## damage_resistance

- Support status: unsupported
- Confidence: high
- Data fields: race.traits
- Enforcement paths: none
- Display paths: none
- Example race IDs: air_genasi, dragonborn, tiefling
- Limitations: Damage resolution does not consume race-owned resistance fields.

## breath_weapon

- Support status: unsupported
- Confidence: high
- Data fields: race.traits
- Enforcement paths: none
- Display paths: none
- Example race IDs: black_dragonborn, red_dragonborn
- Limitations: Breath weapon action, save DC, scaling, area, damage type, and rest reset are not structured.

## condition_save_advantage

- Support status: unsupported
- Confidence: high
- Data fields: race.traits
- Enforcement paths: none
- Display paths: none
- Example race IDs: drow, deep_gnome
- Limitations: Saving throw logic does not consume race-owned conditional advantage traits.

## death_prevention

- Support status: unsupported
- Confidence: high
- Data fields: race.traits
- Enforcement paths: none
- Display paths: none
- Example race IDs: half_orc
- Limitations: No trigger/reaction/rest-reset mechanic exists for dropping to 1 HP.

## natural_weapon

- Support status: unsupported
- Confidence: high
- Data fields: race.traits
- Enforcement paths: none
- Display paths: none
- Example race IDs: aarakocra, tabaxi, lizardfolk
- Limitations: Race-granted attacks are not converted into weapon, action, or unarmed strike options.

## limited_use_reaction

- Support status: unsupported
- Confidence: medium
- Data fields: race.traits
- Enforcement paths: none
- Display paths: none
- Example race IDs: goblin, hadozee
- Limitations: Combat reactions and rest-reset uses are not defined for race traits.

## reroll_or_luck

- Support status: unsupported
- Confidence: medium
- Data fields: race.traits
- Enforcement paths: none
- Display paths: none
- Example race IDs: halfling, autognome
- Limitations: Race-owned rerolls do not connect to the roll engine or limited-use tracking.

## powerful_build

- Support status: unsupported
- Confidence: high
- Data fields: race.traits
- Enforcement paths: none
- Display paths: none
- Example race IDs: goliath, firbolg, bugbear
- Limitations: Carrying capacity and size-based carry rules are not enforced from race data.

## creature_communication

- Support status: unsupported
- Confidence: medium
- Data fields: race.traits
- Enforcement paths: none
- Display paths: none
- Example race IDs: firbolg, forest_gnome
- Limitations: Dialogue and creature interaction systems do not consume race communication traits.

## environmental_adaptation

- Support status: unsupported
- Confidence: medium
- Data fields: race.traits
- Enforcement paths: none
- Display paths: none
- Example race IDs: air_genasi, autognome, warforged
- Limitations: Travel, rest, poison, breathing, sleep, and survival systems do not consume these race traits.

## shapeshifting_or_disguise

- Support status: unsupported
- Confidence: high
- Data fields: race.traits
- Enforcement paths: none
- Display paths: none
- Example race IDs: changeling
- Limitations: Identity-changing traits are not represented as actions, forms, or disguise state.

## innate_teleport

- Support status: unsupported
- Confidence: high
- Data fields: race.traits
- Enforcement paths: none
- Display paths: none
- Example race IDs: eladrin, shadar_kai
- Limitations: Teleport traits are not wired into movement, combat, map, or limited-use systems.

## ambiguous_unmapped_trait

- Support status: ambiguous
- Confidence: low
- Data fields: race.traits
- Enforcement paths: none
- Display paths: none
- Example race IDs: none
- Limitations: Trait text needs human review before it can be classified as display text or a mechanic family.

