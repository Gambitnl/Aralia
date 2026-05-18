# Race Reconciliation Mechanic Buckets

This report separates race mechanics by the capability-backed status Aralia can prove today. Keyword matches suggest a family, but implementation claims come from aralia-mechanic-capability-matrix.json.

## Buckets By Status And Leverage

### darkvision

- Status counts: enforced_now 125
- Records: 125
- Aralia races touched: 63
- Example Aralia race IDs: abyssal_tiefling, astral_elf, autumn_eladrin, beasthide_shifter, black_dragonborn, blue_dragonborn, brass_dragonborn, bronze_dragonborn, bugbear, chthonic_tiefling
- Example vendor candidates: Tiefling, Half-Elf, Astral Elf, Eladrin, Shifter, Dragonborn
- Example traits: Vision, Darkvision (120ft), Darkvision, Superior Darkvision
- Recommended next step: Darkvision range is numeric only; lighting rules and magical-darkness exceptions are not modeled here.

### movement_walk_speed

- Status counts: enforced_now 118
- Records: 118
- Aralia races touched: 106
- Example Aralia race IDs: aarakocra, abyssal_tiefling, air_genasi, astral_elf, autognome, autumn_eladrin, beastborn_human, beasthide_shifter, black_dragonborn, blue_dragonborn
- Example vendor candidates: Shifter, Dwarf, Lizardfolk, Sea Elf, Tabaxi, Triton
- Example traits: Speed
- Recommended next step: Only the walking speed number is enforced; fly, swim, climb, and burrow text is not structured.

### damage_resistance

- Status counts: blocked_by_missing_mechanic_family 99
- Records: 99
- Aralia races touched: 39
- Example Aralia race IDs: abyssal_tiefling, air_genasi, autognome, black_dragonborn, blue_dragonborn, brass_dragonborn, bronze_dragonborn, chthonic_tiefling, copper_dragonborn, deep_gnome
- Example vendor candidates: Tiefling, Air, Autognome, Dragonborn, Deep Gnome, Aasimar
- Example traits: Abyssal Resistance, Lightning Resistance, Mechanical Nature, Damage Resistance, Chthonic Resistance, Celestial Resistance, Fire Resistance, Psychic Resilience
- Recommended next step: Damage resolution does not consume race-owned resistance fields.

### racial_spell_grant

- Status counts: enforced_now 45
- Records: 45
- Aralia races touched: 34
- Example Aralia race IDs: aarakocra, abyssal_tiefling, air_genasi, astral_elf, beastborn_human, chthonic_tiefling, draconblood_dragonborn, duergar, earth_genasi, fairy
- Example vendor candidates: none
- Example traits: Known Spells, Otherworldly Presence, Astral Fire, Spells of the Mark, Light Bearer, Natural Illusionist, Cantrip, Mask of the Wild
- Recommended next step: The spell grant is aggregated, but rest-limited casting uses and free cast tracking are not enforced.

### condition_save_advantage

- Status counts: blocked_by_missing_mechanic_family 41
- Records: 41
- Aralia races touched: 41
- Example Aralia race IDs: astral_elf, autumn_eladrin, bugbear, deep_gnome, drow, duergar, forest_gnome, githzerai, goblin, half_elf
- Example vendor candidates: none
- Example traits: Fey Ancestry, Gnome Cunning, Mental Discipline, Psionic Fortitude, Brave, Dual Mind, Fearless, Kobold Legacy
- Recommended next step: Saving throw logic does not consume race-owned conditional advantage traits.

### environmental_adaptation

- Status counts: blocked_by_missing_mechanic_family 36
- Records: 36
- Aralia races touched: 26
- Example Aralia race IDs: astral_elf, autognome, autumn_eladrin, beastborn_human, cloud_giant_goliath, draconblood_dragonborn, drow, firbolg, forgeborn_human, guardian_human
- Example vendor candidates: Autognome, Thri-kreen, Warforged, Yuan-Ti
- Example traits: Trance, Starlight Step, Sentry's Rest, Season Association, Resourceful, Cloud's Jaunt, Forceful Presence, Hidden Step
- Recommended next step: Travel, rest, poison, breathing, sleep, and survival systems do not consume these race traits.

### once_per_rest_spell

- Status counts: represented_not_enforced 36
- Records: 36
- Aralia races touched: 35
- Example Aralia race IDs: aarakocra, abyssal_tiefling, air_genasi, beastborn_human, chthonic_tiefling, deep_gnome, draconblood_dragonborn, drow, duergar, earth_genasi
- Example vendor candidates: none
- Example traits: Wind Caller, Abyssal Magic, Mingle with the Wind, Primal Connection, Chthonic Magic, Gift of the Svirfneblin, Draconic Ancestral Legacy, Drow Magic
- Recommended next step: The spell can be known/displayed, but free uses and rest reset limits are not tracked for racial spells.

### powerful_build

- Status counts: blocked_by_missing_mechanic_family 30
- Records: 30
- Aralia races touched: 21
- Example Aralia race IDs: black_dragonborn, blue_dragonborn, brass_dragonborn, bronze_dragonborn, bugbear, centaur, cloud_giant_goliath, copper_dragonborn, firbolg, fire_giant_goliath
- Example vendor candidates: Bugbear, Goliath, Firbolg, Loxodon
- Example traits: Draconic Ancestry, Powerful Build, Equine Build, Hippo Build, Trunk
- Recommended next step: Carrying capacity and size-based carry rules are not enforced from race data.

### breath_weapon

- Status counts: blocked_by_missing_mechanic_family 22
- Records: 22
- Aralia races touched: 12
- Example Aralia race IDs: black_dragonborn, blue_dragonborn, brass_dragonborn, bronze_dragonborn, copper_dragonborn, draconblood_dragonborn, gold_dragonborn, green_dragonborn, ravenite_dragonborn, red_dragonborn
- Example vendor candidates: Dragonborn
- Example traits: Breath Weapon
- Recommended next step: Breath weapon action, save DC, scaling, area, damage type, and rest reset are not structured.

### creature_communication

- Status counts: blocked_by_missing_mechanic_family 20
- Records: 20
- Aralia races touched: 16
- Example Aralia race IDs: beastborn_human, bugbear, fallen_aasimar, firbolg, forest_gnome, kalashtar, kenku, leonin, protector_aasimar, scourge_aasimar
- Example vendor candidates: Firbolg, Simic Hybrid, Thri-kreen, Verdan
- Example traits: Wild Intuition, The Bigger They Are, Surprise Attack, Healing Hands, Speech of Beast and Leaf, Speak with Small Beasts, Mind Link, Mimicry
- Recommended next step: Dialogue and creature interaction systems do not consume race communication traits.

### limited_use_reaction

- Status counts: blocked_by_missing_mechanic_family 20
- Records: 20
- Aralia races touched: 19
- Example Aralia race IDs: autumn_eladrin, fallen_aasimar, fire_giant_goliath, frost_giant_goliath, guardian_human, hadozee, half_orc, harengon, hill_giant_goliath, kender
- Example vendor candidates: none
- Example traits: Fey Step (Autumn), Necrotic Shroud, Fire's Burn, Frost's Chill, Vigilant Guardian, Glide, Hadozee Resilience, Savage Attacks
- Recommended next step: Combat reactions and rest-reset uses are not defined for race traits.

### skill_proficiency

- Status counts: blocked_by_missing_mechanic_family 18, enforced_now 1
- Records: 19
- Aralia races touched: 19
- Example Aralia race IDs: astral_elf, autumn_eladrin, bugbear, drow, harengon, high_elf, hill_dwarf, mountain_dwarf, pallid_elf, runeward_dwarf
- Example vendor candidates: none
- Example traits: Keen Senses, Sneaky, Leporine Senses, Stonecunning, Cat’s Talent, Persuasive
- Recommended next step: Add this race skill trait to character assembly before treating it as enforced.

### natural_weapon

- Status counts: blocked_by_missing_mechanic_family 18
- Records: 18
- Aralia races touched: 9
- Example Aralia race IDs: aarakocra, centaur, leonin, lizardfolk, longtooth_shifter, minotaur, satyr, tabaxi, tortle
- Example vendor candidates: Aarakocra, Leonin, Lizardfolk, Minotaur, Tabaxi, Tortle
- Example traits: Talons, Hooves, Claws, Bite, Hungry Jaws, Fangs, Horns, Goring Rush
- Recommended next step: Race-granted attacks are not converted into weapon, action, or unarmed strike options.

### choice_of_skill

- Status counts: blocked_by_missing_mechanic_family 14, enforced_now 3
- Records: 17
- Aralia races touched: 17
- Example Aralia race IDs: astral_elf, beastborn_human, centaur, changeling, forgeborn_human, githyanki, guardian_human, half_elf, half_elf_aquatic, half_elf_drow
- Example vendor candidates: none
- Example traits: Skill Versatility, Astral Trance, Skillful, Natural Affinity, Changeling Instincts, Astral Knowledge, Kender Curiosity, Kenku Recall
- Recommended next step: Add this race skill trait to character assembly before treating it as enforced.

### reroll_or_luck

- Status counts: blocked_by_missing_mechanic_family 17
- Records: 17
- Aralia races touched: 11
- Example Aralia race IDs: autognome, giff, halfling, harengon, hearthkeeper_halfling, hobgoblin, lightfoot_halfling, lotusden_halfling, mender_halfling, stout_halfling
- Example vendor candidates: Halfling, Harengon
- Example traits: Built for Success, Astral Spark, Luck, Lucky, Fortune from the Many, Tireless Precision, Lucky Footwork
- Recommended next step: Race-owned rerolls do not connect to the roll engine or limited-use tracking.

### ability_bonus

- Status counts: enforced_now 11
- Records: 11
- Aralia races touched: 11
- Example Aralia race IDs: half_elf, half_elf_aquatic, half_elf_drow, half_elf_high, half_elf_wood, half_orc, seersight_half_elf, stormborn_half_elf, vedalken, verdan
- Example vendor candidates: none
- Example traits: Ability Bonuses
- Recommended next step: Flexible Any bonuses are intentionally skipped by the fixed-bonus calculator and handled by point-buy/choice flow.

### alternate_movement_mode

- Status counts: blocked_by_missing_mechanic_family 10
- Records: 10
- Aralia races touched: 8
- Example Aralia race IDs: aarakocra, fairy, half_elf_aquatic, protector_aasimar, sea_elf, simic_hybrid, tabaxi, triton
- Example vendor candidates: none
- Example traits: Flight, Swim Speed, Radiant Soul, Child of the Sea, Friend of the Sea, Animal Enhancement (1st Level), Cat’s Claws, Emissary of the Sea
- Recommended next step: Fly, swim, climb, and burrow speeds are not separate PlayerCharacter movement fields.

### shapeshifting_or_disguise

- Status counts: blocked_by_missing_mechanic_family 10
- Records: 10
- Aralia races touched: 10
- Example Aralia race IDs: changeling, cloud_giant_goliath, fire_giant_goliath, frost_giant_goliath, hill_giant_goliath, plasmoid, satyr, shadowveil_elf, stone_giant_goliath, storm_giant_goliath
- Example vendor candidates: Changeling, Goliath
- Example traits: Shape Self, Reveler, Cunning Intuition, Shapechanger, Large Form
- Recommended next step: Identity-changing traits are not represented as actions, forms, or disguise state.

### innate_teleport

- Status counts: blocked_by_missing_mechanic_family 4
- Records: 4
- Aralia races touched: 4
- Example Aralia race IDs: autumn_eladrin, spring_eladrin, summer_eladrin, winter_eladrin
- Example vendor candidates: Eladrin
- Example traits: Fey Step
- Recommended next step: Teleport traits are not wired into movement, combat, map, or limited-use systems.

### death_prevention

- Status counts: blocked_by_missing_mechanic_family 3
- Records: 3
- Aralia races touched: 3
- Example Aralia race IDs: half_orc, orc, pathfinder_half_orc
- Example vendor candidates: none
- Example traits: Relentless Endurance
- Recommended next step: No trigger/reaction/rest-reset mechanic exists for dropping to 1 HP.

## Deferred Scope

Blocked buckets need the engine/system family named in their records before race data should be migrated into structured runtime mechanics.

