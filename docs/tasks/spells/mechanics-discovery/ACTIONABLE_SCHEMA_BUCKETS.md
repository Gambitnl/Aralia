# Actionable Schema Buckets

This report groups remaining `actionable_open` spell mechanics findings by mechanics bucket family, then lists the most common requested schema/template changes inside each family.

Generated: 2026-05-14T11:42:13.258Z
Actionable open findings: 1235
Grouped mechanics families: 24

## Buckets

### choice_or_mode

- Findings: 128
- Distinct spells: 113
- Levels: 1 (9), 2 (20), 3 (41), 4 (16), 5 (25), 6 (12), 7 (4), 9 (1)
- Common template/schema changes:
  - 16: Add a choice/mode bucket with option-specific targets/effects.
  - 2: Add multi-effect ward mode and immunity/password choice fields.
  - 2: Add spell-granted action direction/placement choice fields.
  - 1: Add a healing-pool distribution bucket with unlimited target count and player allocation rules.
  - 1: Add ability-check modifier fields for chosen ability and disadvantage.
  - 1: Add ability-choice fields linked to save-disadvantage riders.
  - 1: Add animate/reassert mode and slot-scaled undead form choice fields.
  - 1: Add area target-selection fields for chosen creatures in an area.
- Common JSON changes:
  - 16: Keep existing Utility Options or descriptions until mode schema propagation.
  - 1: Add runtime abilityCheckModifier data tied to the chosen ability instead of relying on generic controlOptions text.
  - 1: Add runtime abilityChoice data and allow one selected ability per target.
  - 1: Add runtime actionPlacementChoice data for cone direction.
  - 1: Add runtime actionPlacementChoice data for line direction.
  - 1: Add runtime alignmentMode data: good/neutral Radiant with angelic/fey appearance choice, evil Necrotic fiendish.
  - 1: Add runtime animatedObjectSelection data.
  - 1: Add runtime areaDirectionChoice data for the 30-foot line.
- Examples:
  - alarm / choice_or_mode: Alarm can ward a door, a window, or a 20-foot cube and lets the caster choose audible or mental alarm mode, but JSON keeps those choices in prose.
  - catapult / choice_or_mode: Catapult requires choosing an eligible object and a travel direction, then resolving a straight-line movement path; current data collapses this to an area line plus prose utility.
  - chromatic-orb / choice_or_mode: Chromatic Orb requires choosing one of six damage types and can leap to additional chosen targets when two or more damage dice match, but runtime JSON stores the damage types as a slash-delimited string and has no leap mechanic.
  - create-or-destroy-water / choice_or_mode: Create or Destroy Water has four utility modes with different targets, environmental effects, and scaling choices.
  - find-familiar / choice_or_mode: Find Familiar requires choosing a familiar form and creature type, and recasting changes the existing familiar's eligible form instead of creating another familiar.

### attack_or_save_modifier

- Findings: 123
- Distinct spells: 123
- Levels: 0 (4), 1 (17), 2 (23), 3 (21), 4 (15), 5 (24), 6 (5), 7 (6), 8 (2), 9 (6)
- Common template/schema changes:
  - 2: Add savingThrowAdvantage fields for ability lists.
  - 1: Add a D20 test modifier bucket covering attacks, saves, and ability checks together.
  - 1: Add a save auto-success/auto-failure bucket keyed by target filter.
  - 1: Add a time/turn-economy bucket for extra turns and frozen non-caster actors.
  - 1: Add ability-check disadvantage and shared-save rider fields.
  - 1: Add ability-check modifier fields for advantage/disadvantage, ability, skill, duration, and source option.
  - 1: Add ability-check modifier fields for advantage/disadvantage/bonus, chosen ability filter, and duration.
  - 1: Add ability-check modifier fields for skill-specific Advantage against a marked target.
- Common JSON changes:
  - 2: Add runtime rollModifier data for attack rolls and saving throws instead of relying on status-condition name semantics.
  - 1: Add on-end-turn wall damage and caster-action beam attack effects with shared scaling.
  - 1: Add runtime abilityCheckModifier and sharedSaveRiders; current attack-roll modifier is a partial schema-safe encoding.
  - 1: Add runtime abilityCheckModifier data and avoid duplicate-save attack modifier effects until shared-save riders are supported.
  - 1: Add runtime abilityCheckModifier data for Charisma (Intimidation) advantage while Booming Voice is active.
  - 1: Add runtime abilityCheckModifier data for disadvantage on checks made with the chosen ability.
  - 1: Add runtime abilityCheckModifier data for Wisdom (Perception) and Wisdom (Survival) checks made to find the target.
  - 1: Add runtime abilityCheckModifier data: type advantage, applies to chosen ability, duration while active.
- Examples:
  - guidance / attack_or_save_modifier: Guidance adds 1d4 to ability checks for the chosen skill, but runtime JSON only records a generic utility description.
  - mind-sliver / attack_or_save_modifier: Mind Sliver's damage and next-save 1d4 penalty share one failed Intelligence save, but runtime JSON stores them as separate effects that can drift.
  - thaumaturgy / attack_or_save_modifier: Booming Voice grants Advantage on Charisma (Intimidation) checks for 1 minute, but this ability-check modifier is prose-only.
  - vicious-mockery / attack_or_save_modifier: Vicious Mockery's damage and next-attack Disadvantage rider share one failed Wisdom save, but JSON stores damage and a generic utility effect separately.
  - bane / attack_or_save_modifier: Bane subtracts 1d4 from attack rolls and saving throws made by failed-save targets, but structured markdown and JSON only apply a generic Bane status; the save outcome was corrected to negates_condition.

### status_or_state_change

- Findings: 88
- Distinct spells: 79
- Levels: 1 (6), 2 (11), 3 (26), 4 (9), 5 (22), 6 (5), 7 (3), 8 (1), 9 (5)
- Common template/schema changes:
  - 9: Add state-change bucket fields for non-condition states.
  - 1: Add a condition-removal/restoration bucket for named condition endings.
  - 1: Add a condition-removal/restoration bucket for named conditions and optional reaction-based state ending.
  - 1: Add a form transformation state bucket.
  - 1: Add ability-score override, capability lockout, long-interval repeat save, and ending-spell-list fields.
  - 1: Add area status prevention, status application, possession suppression, and corpse-state protection fields.
  - 1: Add area-scoped condition fields for conditions that apply only while occupying an area.
  - 1: Add areaMembership condition fields such as fully_within_area.
- Common JSON changes:
  - 9: Use STATUS_CONDITION where possible and Utility Options elsewhere.
  - 1: Add runtime abilityCheckModifier/attackRollModifier shared-save rider data.
  - 1: Add runtime animatedObject.immunities data.
  - 1: Add runtime barrierRestriction data.
  - 1: Add runtime casterSpecificState data for noHiddenFromCaster and invisibleNoBenefitAgainstCaster.
  - 1: Add runtime Charmed STATUS_CONDITION and domination riders.
  - 1: Add runtime condition areaMembership=fully_within for Blinded.
  - 1: Add runtime conditional violationDamage data keyed to command noncompliance.
- Examples:
  - command / status_or_state_change: The Grovel option applies the Prone condition, but that state change is flattened into option text.
  - ray-of-sickness / status_or_state_change: The Poisoned condition is represented, though the current duration model is still coarse for 'until the end of your next turn'.
  - sleep / status_or_state_change: Sleep has a two-stage status flow: failed first save gives Incapacitated until the end of the next turn, then failed second save gives Unconscious for the duration. Runtime JSON now carries both stages, but the relationship is still encoded with generic trigger/requiresStatus fields rather than a dedicated staged status model.
  - snare / status_or_state_change: Snare restrains and hoists the creature upside down 3 feet above the ground/floor; Restrained is represented, but the hoisted position and upside-down state are prose-only.
  - tashas-hideous-laughter / status_or_state_change: Prone and Incapacitated are now separate status effects, but the rule that the target cannot end Prone on itself while affected is prose-only.

### environmental_change

- Findings: 77
- Distinct spells: 68
- Levels: 0 (10), 1 (6), 2 (11), 3 (26), 4 (4), 5 (6), 6 (4), 7 (6), 8 (3), 9 (1)
- Common template/schema changes:
  - 9: Add environment/world-state bucket fields.
  - 5: Add environment/world-state fields for ignition, weather, sensory phenomena, and lasting environmental facts.
  - 2: Add ward environmental subeffect fields.
  - 1: Add an object ignition/burning bucket for flammable objects and ongoing burn state.
  - 1: Add apparentEnvironment fields for sensory-only smell/sound/temperature and explicit no-damage/no-condition limits.
  - 1: Add burning/ignition environmental state fields for objects.
  - 1: Add comprehensive water-control environmental state fields for mode-specific effects.
  - 1: Add contact-with-target-object condition fields.
- Common JSON changes:
  - 9: Use current terrain/damage/utility fields as interim data.
  - 5: Keep current utility/terrain/damage representation as interim data.
  - 1: Add runtime accumulatedDamage and objectIgnition data.
  - 1: Add runtime animatedNatureArea data.
  - 1: Add runtime burning state application for eligible objects.
  - 1: Add runtime cloudMovement and dispersalCondition data.
  - 1: Add runtime conditionalEnding dispersedByStrongWind.
  - 1: Add runtime contactCondition data for creatures in physical contact with the heated object.
- Examples:
  - create-bonfire / environmental_change: Actionable open: Ignition, weather, sensory, or cosmetic environmental change needs a reusable environment/world-state bucket.
  - druidcraft / environmental_change: Actionable open: Ignition, weather, sensory, or cosmetic environmental change needs a reusable environment/world-state bucket.
  - elementalism / environmental_change: Actionable open: Ignition, weather, sensory, or cosmetic environmental change needs a reusable environment/world-state bucket.
  - fire-bolt / environmental_change: Actionable open: Ignition, weather, sensory, or cosmetic environmental change needs a reusable environment/world-state bucket.
  - green-flame-blade / environmental_change: Actionable open: Ignition, weather, sensory, or cosmetic environmental change needs a reusable environment/world-state bucket.

### vision_light_sound

- Findings: 76
- Distinct spells: 68
- Levels: 0 (3), 1 (10), 2 (13), 3 (22), 4 (6), 5 (8), 6 (4), 7 (8), 8 (2)
- Common template/schema changes:
  - 8: Add sensory/vision/light/sound bucket fields.
  - 1: Add appearance-change fields for height, weight, facial features, voice, hair, coloration, and distinguishing characteristics.
  - 1: Add area light state and one-way visibility fields.
  - 1: Add area light/sound mode fields with magical-light level interactions and silence ingress/egress rules.
  - 1: Add audible alarm fields for sound type, sound duration, and audible radius.
  - 1: Add communication blocker fields for silence and material barriers.
  - 1: Add condition semantics mapping for Invisible or a visibility-state field if runtime needs it outside status name lookup.
  - 1: Add conditional light fields keyed to resource count.
- Common JSON changes:
  - 8: Use current light/terrain/utility representation as interim data.
  - 1: Add runtime appearanceChange data including voice.
  - 1: Add runtime communication blocker data for silence, one foot of stone/metal/wood, and thin lead.
  - 1: Add runtime condition requiresCanSeeEffect for the pattern.
  - 1: Add runtime condition requiring targets to see the caster/presented gem.
  - 1: Add runtime conditionalLightByResource data.
  - 1: Add runtime createdObjectVisibility data.
  - 1: Add runtime crossPlanePerception data.
- Examples:
  - message / vision_light_sound: Message is blocked by magical silence and by specific barrier materials/thicknesses, which are not represented structurally.
  - thaumaturgy / vision_light_sound: Thaumaturgy modifies voice volume, flames, and creates a point-originating sound, but these sensory mechanics are collapsed into one description.
  - vicious-mockery / vision_light_sound: Vicious Mockery can target a creature the caster can see or hear; current targeting only records lineOfSight=true and does not represent hearing as an alternate perception path.
  - alarm / vision_light_sound: The audible alarm creates a handbell sound for 10 seconds within 60 feet of the warded area, but sound duration and radius are not structured.
  - comprehend-languages / vision_light_sound: Comprehend Languages distinguishes heard language, seen signed language, and seen written language, but runtime JSON stores them in one prose description.

### target_filter_or_eligibility

- Findings: 75
- Distinct spells: 74
- Levels: 1 (5), 2 (14), 3 (17), 4 (9), 5 (13), 6 (9), 7 (6), 8 (2)
- Common template/schema changes:
  - 1: Add alternate target mode fields for point versus unattended object, including not-worn-or-carried object eligibility.
  - 1: Add area capacity fields by target size and auto-success size filters.
  - 1: Add area object eligibility fields for nonmagical and not worn/carried.
  - 1: Add arrival destination and fallback occupancy fields.
  - 1: Add cast-time excluded targets fields.
  - 1: Add corpse size/type and time-of-day casting eligibility fields.
  - 1: Add corpse/remains eligibility fields for source type, original creature type, and size.
  - 1: Add corpse/remains target values and not_applicable sentinel handling where target kind does not apply.
- Common JSON changes:
  - 2: Add runtime objectEligibility data for nonmagical unattended objects in the area.
  - 2: Add runtime objectIgnitionFilter data.
  - 1: Add runtime createdGuardian or auraHazard data for placement, enemy filtering, invulnerability, occupied space, and 60-damage depletion.
  - 1: Add runtime createdHound or wardGuardian data.
  - 1: Add runtime deathTriggeredRider data keyed to creature type and cause of death.
  - 1: Add runtime deathTriggerSoulCapture and rememberedPlaceEligibility data.
  - 1: Add runtime destinationFilter data.
  - 1: Add runtime environmental/object effect data that starts burning on eligible flammable objects in the cone.
- Examples:
  - burning-hands / target_filter_or_eligibility: Burning Hands ignites flammable objects in the cone that are not worn or carried, but targeting and effects only cover creatures.
  - find-familiar / target_filter_or_eligibility: The familiar appears and reappears only in unoccupied spaces, eligible forms are Beast CR 0 forms, and one familiar is allowed at a time.
  - hellish-rebuke / target_filter_or_eligibility: The spell can target only the creature that damaged the caster, and that relationship is not first-class target-filter data.
  - tensers-floating-disk / target_filter_or_eligibility: Tenser's Floating Disk must be created in an unoccupied visible space, but runtime targeting does not expose the unoccupied-space requirement.
  - unseen-servant / target_filter_or_eligibility: Unseen Servant appears in an unoccupied space on the ground, but runtime targeting does not expose unoccupied-space or ground placement constraints.

### terrain_or_surface

- Findings: 70
- Distinct spells: 61
- Levels: 0 (3), 1 (5), 2 (8), 3 (25), 4 (8), 5 (7), 6 (12), 7 (1), 8 (1)
- Common template/schema changes:
  - 9: Add terrain/surface bucket fields.
  - 1: Add anchored/fixed-object interaction fields for gravity and fall effects.
  - 1: Add area placement surface eligibility fields.
  - 1: Add conditional created-object terrain fields.
  - 1: Add enemy-only terrain modification fields.
  - 1: Add first-class wall/hemisphere/globe terrain effect shapes and solid-surface placement fields.
  - 1: Add first-class wall/ring terrain effect shapes and line-of-sight-blocking terrain fields.
  - 1: Add floor-area height and no-overlap fields.
- Common JSON changes:
  - 9: Use current terrain/utility representation as interim data.
  - 1: Add runtime anchoredObjectInteraction and grabSurfaceEligibility data.
  - 1: Add runtime bloodCircle option with protected area around caster.
  - 1: Add runtime cover data and extend terrain effect area support for Wall shapes.
  - 1: Add runtime druidGroveTerrain data.
  - 1: Add runtime enemyDifficultTerrain data.
  - 1: Add runtime environmentalChange extinguishUnprotectedFlames in area and within 30 feet, then vanish.
  - 1: Add runtime environmentalHazards/fissures/structureCollapse objects with random formulas, derived radius, and escape DC/action data.
- Examples:
  - mold-earth / terrain_or_surface: Mold Earth can excavate/move/deposit loose earth, make difficult terrain, or restore normal terrain; JSON has terrain/manipulation but needs review against all modes.
  - prestidigitation / terrain_or_surface: Magic Mark places color, mark, or symbol on an object or surface for 1 hour.
  - thaumaturgy / terrain_or_surface: Tremors causes harmless ground tremors for 1 minute; this gray-zone world-state effect is not structured.
  - catapult / terrain_or_surface: Catapult stops early on impact with a solid surface and then drops the object, but there is no surface collision or fall-state representation.
  - comprehend-languages / terrain_or_surface: Comprehend Languages requires touching the surface that contains written language, but this prerequisite is only stored in prose.

### social_or_knowledge_effect

- Findings: 68
- Distinct spells: 64
- Levels: 0 (1), 1 (11), 2 (13), 3 (11), 4 (6), 5 (16), 6 (5), 7 (4), 8 (1)
- Common template/schema changes:
  - 5: Add social/knowledge bucket fields.
  - 1: Add awareness and self-only casting permission fields for merged states.
  - 1: Add bargain/social constraint fields for service spells.
  - 1: Add bonded summon exclusivity fields across spell families.
  - 1: Add cognition/rationalization fields for mental illusions.
  - 1: Add communication knowledge-result fields.
  - 1: Add communication recipient eligibility fields such as requiresKnownLanguage and perceptionMode.
  - 1: Add communication through-barrier prerequisite fields for familiarity and known target location.
- Common JSON changes:
  - 5: Use current status/utility text as interim representation.
  - 1: Add runtime allegiance and languages data.
  - 1: Add runtime attitudeChange and postEffectAwareness data.
  - 1: Add runtime attitudeChange data for Indifferent toward chosen creatures plus damage/witness break conditions.
  - 1: Add runtime auraSpoof data for object detection results.
  - 1: Add runtime bargainConstraints data.
  - 1: Add runtime bondLimit data.
  - 1: Add runtime breakEnchantment data.
- Examples:
  - message / social_or_knowledge_effect: Message can pass through solid objects only if the caster is familiar with the target and knows it is beyond the barrier.
  - animal-friendship / social_or_knowledge_effect: Animal Friendship applies the Charmed condition to a Beast for 24 hours, but the status runtime includes inappropriate default repeat-save data that is not in the canonical prose.
  - charm-person / social_or_knowledge_effect: Charm Person makes the Charmed creature Friendly and later aware it was Charmed by the caster; the runtime has a generic utility description but no structured friendly-state or awareness payload.
  - detect-evil-and-good / social_or_knowledge_effect: The spell provides knowledge of whether Hallow is active and where it is, but that payload is prose-only.
  - detect-magic / social_or_knowledge_effect: Detect Magic teaches the spell school when the detected effect was created by a spell, but this knowledge payload is prose-only.

### object_stats_or_damageability

- Findings: 56
- Distinct spells: 52
- Levels: 0 (3), 1 (3), 2 (7), 3 (10), 4 (6), 5 (6), 6 (8), 7 (5), 9 (8)
- Common template/schema changes:
  - 5: Add object stat/damageability bucket fields.
  - 1: Add a separated-state bucket for mirrored forms whose damage/effects do not cross-apply.
  - 1: Add a threshold outcome bucket for hit-point-threshold instant death versus fallback damage.
  - 1: Add a transformation bucket for replacement and retained-stat lists.
  - 1: Add a transformation bucket for stat replacement, retained traits, form eligibility, and equipment melding.
  - 1: Add AC penalty under defensive/stat modifier fields, not object stats.
  - 1: Add animated object lifecycle and damage carryover fields.
  - 1: Add animated object stat-block, durability, and reversion fields.
- Common JSON changes:
  - 5: Use current spatial/utility fields until propagation.
  - 1: Add runtime AC penalty -2 in a debuff/stat modifier model.
  - 1: Add runtime animatedObject.statBlock, hp, damageCarryover, and reversion data.
  - 1: Add runtime bodyPartRestoration data.
  - 1: Add runtime conditionalDamage data for undamaged target d8 versus damaged target d12, including tier scaling for both dice.
  - 1: Add runtime copiedEntityStats and destructionOutcome data.
  - 1: Add runtime createdEntity.physicality and invulnerable data.
  - 1: Add runtime damage flag cannotBeReduced and caster self-damage target binding.
- Examples:
  - chill-touch / object_stats_or_damageability: Actionable open: Object or hit-point state needs object/stat fields that are not yet available on every affected low-level spell.
  - spare-the-dying / object_stats_or_damageability: Spare the Dying targets a creature with exactly 0 Hit Points that is not dead; current structured markdown and JSON only say creatures/allies.
  - toll-the-dead / object_stats_or_damageability: Toll the Dead switches from d8 to d12 damage when the target is missing any Hit Points; JSON only preserves this in scaling prose while damage.dice remains 1d8.
  - cure-wounds / object_stats_or_damageability: Cure Wounds heals 2d8 plus the caster's spellcasting ability modifier, but runtime healing only stores dice 2d8.
  - find-familiar / object_stats_or_damageability: The familiar uses the chosen form's statistics, disappears at 0 Hit Points, and leaves worn or carried objects behind when it disappears.

### conditional_ending

- Findings: 54
- Distinct spells: 53
- Levels: 1 (2), 2 (4), 3 (10), 4 (6), 5 (15), 6 (11), 7 (6)
- Common template/schema changes:
  - 1: Add animated creature lifecycle ending fields.
  - 1: Add aura early-ending fields tied to caster movement forcing blocked creatures through the barrier.
  - 1: Add bound-service completion and linked-spell duration-extension fields.
  - 1: Add branch-ending and sustain-ending fields for save success, action use, range loss, and total cover.
  - 1: Add castFailureCondition fields for area encapsulation requirements.
  - 1: Add conditional ending fields for delayed cumulative chance, recast ending, and linked-object destruction.
  - 1: Add conditional ending fields for no-return-on-full-duration with creature-type filters.
  - 1: Add conditional spell-ending and soul-return outcome fields.
- Common JSON changes:
  - 1: Add runtime ammunitionPool data for 12 pieces, +2 per slot above 3, and per-piece magic ending on hit or miss.
  - 1: Add runtime animatedUndead.lifecycle data.
  - 1: Add runtime cancellationRules data instead of relying only on statusCondition.aftermath/controlOptions.
  - 1: Add runtime castFailure data for not fully encapsulating all creatures in area.
  - 1: Add runtime castFailure if targetedWithinPastDays 10 and maxQuestions 5.
  - 1: Add runtime cleanupOnEnd data.
  - 1: Add runtime cleanupOnEnd sequence data.
  - 1: Add runtime conditionalEnding and conditionRemovalResistance data.
- Examples:
  - hex / conditional_ending: If the cursed target drops to 0 Hit Points before the spell ends, the caster can move the curse to a new creature with a later Bonus Action; this transfer rule is prose-only.
  - hunters-mark / conditional_ending: If the marked target drops to 0 Hit Points before the spell ends, the caster can move the mark to a new visible creature with a Bonus Action; duration also scales at higher slots.
  - animal-messenger / conditional_ending: If the Beast does not reach the destination before the spell ends, the message is lost and the Beast returns to the casting location; duration also scales by slot.
  - detect-thoughts / conditional_ending: Detect Thoughts can end on successful Wisdom save against deeper probe or on a target's action Intelligence (Arcana) check while attention remains shifted; only prose carries the Arcana escape and attention condition.
  - knock / conditional_ending: Arcane Lock suppression lasts 10 minutes while the spell itself is instantaneous; that temporary suppression duration is not modeled.

### message_or_communication

- Findings: 49
- Distinct spells: 46
- Levels: 0 (2), 1 (5), 2 (8), 3 (10), 4 (5), 5 (11), 6 (6), 7 (1), 8 (1)
- Common template/schema changes:
  - 5: Add communication bucket fields.
  - 2: Add ward password immunity fields.
  - 1: Add area communication mode fields for universal in-area communication.
  - 1: Add bound-entity command and report fields.
  - 1: Add command communication fields for verbal command content and target understanding requirement.
  - 1: Add command/communication fields for spoken one-word delivery and any language-understanding requirements or exclusions discovered across command-like spells.
  - 1: Add communication fields for creature type, verbal communication, and comprehension.
  - 1: Add communication fields for private target-only delivery and one-reply permission.
- Common JSON changes:
  - 5: Use existing Utility Options as interim data.
  - 2: Add runtime telepathyLink data.
  - 1: Add runtime alarmTrigger data for password-gated barking.
  - 1: Add runtime animatedObject.languages and commandChannel data.
  - 1: Add runtime bargainCommunication data.
  - 1: Add runtime boundEntityCommand data.
  - 1: Add runtime commandCommunication data.
  - 1: Add runtime commandDelivery data rather than leaving spoken one-word command only in prose.
- Examples:
  - message / message_or_communication: Message supports one-target private whisper plus target reply, but JSON only records a prose utility description.
  - mold-earth / message_or_communication: Mold Earth can spell out words on dirt or stone, which is a world-state communication/marking effect.
  - command / message_or_communication: Command requires the caster to speak a one-word command, but runtime JSON does not make the spoken-word delivery or language/understanding assumptions explicit.
  - comprehend-languages / message_or_communication: Comprehend Languages grants literal meaning only, reads about one page per minute, and does not decode symbols or secret messages; these communication limitations are prose-only.
  - find-familiar / message_or_communication: Find Familiar grants telepathic communication with the familiar within 100 feet, but telepathy is only a summon subfield and not connected to communication mechanics.

### created_object_or_structure

- Findings: 44
- Distinct spells: 40
- Levels: 0 (2), 1 (2), 2 (6), 3 (10), 4 (6), 5 (5), 6 (5), 7 (2), 8 (2), 9 (4)
- Common template/schema changes:
  - 3: Add created object/structure/entity bucket fields.
  - 1: Add a created containment/prison bucket for durable prisons with mode-specific boundaries and dispel targets.
  - 1: Add a created effect-origin or hazard-entity bucket for movable spell-created attackers.
  - 1: Add a layered object/barrier bucket for ordered layer destruction.
  - 1: Add a linked form/body state bucket that can model an astral form, a suspended physical body, copied stats/equipment, and lethal cord linkage.
  - 1: Add area width and height fields for cuboid/volume effects.
  - 1: Add barrier/enclosure fields for pass-through blocking, damage immunity, breathing exception, inside/outside damage prevention, and object/creature containment.
  - 1: Add conjured weapon/object fields for hand requirement, object shape, duration, and lifecycle.
- Common JSON changes:
  - 3: Use current summon/utility/terrain data as interim representation.
  - 1: Add a runtime createdEntity/lifecycle object with growth duration, activation trigger, soul-transfer prerequisites, and equipment/remains consequences.
  - 1: Add a structured linkedEntities or formSplit runtime object; current JSON keeps the facts in Utility Options and Unconscious status.
  - 1: Add runtime accessControl data for object categories, one mechanism affected, and Arcane Lock suppression 10 minutes.
  - 1: Add runtime area dimensions length 30, width 10, height 10.
  - 1: Add runtime barrierEnclosure data.
  - 1: Add runtime bladeWallStructureProperties data.
  - 1: Add runtime conjuredWeapon data for fiery blade in free hand.
- Examples:
  - elementalism / created_object_or_structure: Actionable open: Created objects/forms need object-state fields for durability, placement, dimensions, and disappearance.
  - shape-water / created_object_or_structure: Shape Water can form and animate simple water shapes for 1 hour, but the created/animated form is not represented structurally.
  - goodberry / created_object_or_structure: Goodberry creates a fixed count of ten magic berries, but count, item identity, and duration are not first-class created-object data.
  - unseen-servant / created_object_or_structure: The servant can interact with objects and perform simple tasks including fetching, cleaning, mending, folding, lighting fires, serving food, and pouring drinks, but allowed task categories are prose-only.
  - flame-blade / created_object_or_structure: Flame Blade creates a persistent conjured weapon-like object, but the created object is not modeled.

### summon_or_controlled_entity

- Findings: 44
- Distinct spells: 38
- Levels: 0 (2), 1 (2), 2 (3), 3 (14), 4 (6), 5 (10), 6 (3), 7 (2), 9 (2)
- Common template/schema changes:
  - 6: Add summon/controlled-entity bucket fields.
  - 2: Add aura-spirit manifestation fields for non-commanded conjured spirits.
  - 1: Add a transformed controlled entity bucket with command, initiative, friendliness, and control-expiry fields.
  - 1: Add animated controlled-entity fields for entity type, control, initiative, command economy, default behavior, stat block, allegiance, and lifecycle.
  - 1: Add animated object summon fields for stat block, control, command behavior, default defend behavior, and persistent order.
  - 1: Add animated tree guardian entity and command fields.
  - 1: Add animated undead fields for corpse eligibility, count, size, form choice, stat block reference, command economy, default behavior, task persistence, and slot scaling.
  - 1: Add animated-environment source fields.
- Common JSON changes:
  - 6: Use existing SUMMONING/Utility Options as interim data.
  - 1: Add runtime animatedEntity data.
  - 1: Add runtime animatedEnvironmentSources data.
  - 1: Add runtime animatedUndead data.
  - 1: Add runtime animatedUndeadControl data.
  - 1: Add runtime auraManifestation data for Elemental spirits.
  - 1: Add runtime auraManifestation data for nature spirits.
  - 1: Add runtime bondedMount summon data.
- Examples:
  - druidcraft / summon_or_controlled_entity: Actionable open: Created sensory effects or minor entities need summon/created-entity fields if they become independently addressable.
  - mage-hand / summon_or_controlled_entity: Mage Hand creates a persistent controllable entity, but the entity is not modeled with actions, movement, or limits.
  - find-familiar / summon_or_controlled_entity: The summon is represented, but independent initiative, ally status, no-attack restriction, allowed normal actions, chosen-form statistics, disappearance at 0 HP, item drop, pocket dimension, and active-instance limit are not first-class data.
  - unseen-servant / summon_or_controlled_entity: Unseen Servant is represented as a summon, but size, invisibility, mindless/shapeless force traits, AC, HP, Strength, no-attack rule, task completion/wait behavior, command range ending, and 0-HP ending are not first-class fields.
  - find-steed / summon_or_controlled_entity: Find Steed has persistent summon lifecycle, replacement on recast, controlled mount behavior while ridden, independent behavior if caster is Incapacitated, and leave-behind carried gear; runtime summon data is too shallow.

### travel_or_planar_movement

- Findings: 36
- Distinct spells: 35
- Levels: 1 (1), 2 (7), 3 (4), 4 (3), 5 (6), 6 (9), 7 (3), 8 (2), 9 (1)
- Common template/schema changes:
  - 1: Add a portal/travel topology bucket for two-ended portals, one-way sides, ruler/domain vetoes, and nearest-space placement.
  - 1: Add area travel-block fields for teleportation and interplanar travel.
  - 1: Add banishment destination, escape action/check/DC, and return-space fields.
  - 1: Add bidirectional linked portal travel fields with open-side entry restrictions.
  - 1: Add blocked travel mode fields with save outcomes.
  - 1: Add completion travel/report fields with same-plane branching.
  - 1: Add created-object follow fields for follow threshold, desired distance, immobile-near-caster rule, and obstacle limitations.
  - 1: Add cross-planar communication and failure chance fields.
- Common JSON changes:
  - 2: Add runtime planarTravelBlock data.
  - 1: Add runtime banishment/escapeCheck/returnLocation objects.
  - 1: Add runtime banishmentTransport and returnPlacement data.
  - 1: Add runtime blockedTravel data for teleportation, interplanar travel, and ethereal travel.
  - 1: Add runtime blockedTravel data.
  - 1: Add runtime boundEntityCompletionTravel data.
  - 1: Add runtime deliveryRange anyDistance, crossPlaneAllowed true, crossPlaneFailureChance 5 percent.
  - 1: Add runtime demiplane/location object with id/owner/known-contents/connect mode and contents persistence.
- Examples:
  - tensers-floating-disk / travel_or_planar_movement: The disk follows the caster when the caster moves more than 20 feet away and remains within 20 feet, but follow movement behavior is only summarized in objectDescription and spatial notes.
  - animal-messenger / travel_or_planar_movement: The Beast travels toward the specified location at about 25 miles per 24 hours, or 50 miles if it can fly, but runtime JSON only stores this in description text.
  - cloud-of-daggers / travel_or_planar_movement: Cloud of Daggers lets the caster use a later-turn Magic action to teleport the Cube up to 30 feet, and creatures take damage if the Cube moves into their space; runtime now has initial/enter/end-turn damage but lacks movable-area data and an area-moves-into-target trigger.
  - find-steed / travel_or_planar_movement: Fey Step teleports the steed and rider up to 60 feet to an unoccupied space and recharges after Long Rest, but type-gated teleport action data is not represented.
  - mind-spike / travel_or_planar_movement: The location tracking works only while caster and target are on the same plane of existence, but same-plane gating is not first-class.

### sustain_or_recast_action

- Findings: 34
- Distinct spells: 32
- Levels: 0 (3), 1 (4), 2 (5), 3 (8), 4 (5), 5 (8), 6 (1)
- Common template/schema changes:
  - 2: Add sustain/recast action bucket fields.
  - 1: Add active effect cap and dismiss action fields.
  - 1: Add bonded summon lifecycle fields for dismiss, release, recast restore, and temporary/permanent disappearance.
  - 1: Add conjured-object persistence fields for disappears_on_release and reevoke action cost.
  - 1: Add controlled entity command fields for frequency, action cost, mental command, movement distance, and object interaction.
  - 1: Add controlled-creature command fields for bonus action, mental command, same-command multi-control, and range.
  - 1: Add controlled-summon command action and recast-to-maintain-control fields.
  - 1: Add follow-up action fields for conditional retargeting after target_drops_to_0_hp.
- Common JSON changes:
  - 2: Use Utility Options/grantedActions as interim representation.
  - 1: Add grantedActions entry for changing portal facing.
  - 1: Add grantedActions entry for the rock launch action.
  - 1: Add runtime activeAreaUpdate action cost bonus_action for direction change.
  - 1: Add runtime activeEffectLimit and dismissAction data.
  - 1: Add runtime activeEffectLimit=2 for non-instantaneous modes and dismissAction=action.
  - 1: Add runtime bondedSummon lifecycle data.
  - 1: Add runtime commandAction and reassertControl data.
- Examples:
  - dancing-lights / sustain_or_recast_action: Actionable open: Repeat action and sustain behavior needs a stronger granted-action/sustain schema for low-level utility cantrips.
  - mold-earth / sustain_or_recast_action: Mold Earth limits non-instantaneous active effects to two and allows dismissing one as an action.
  - shape-water / sustain_or_recast_action: Shape Water limits non-instantaneous effects to two active instances and lets the caster dismiss one as an action; this is not structured.
  - expeditious-retreat / sustain_or_recast_action: Expeditious Retreat immediately grants Dash and then grants Dash again as a Bonus Action until the spell ends, but runtime JSON keeps this in a generic utility description with grantedActions empty.
  - find-familiar / sustain_or_recast_action: Find Familiar uses a Bonus Action for shared senses, Magic actions for dismiss/reappear, and recasting changes the familiar's form.

### healing_or_restoration

- Findings: 33
- Distinct spells: 29
- Levels: 0 (1), 1 (4), 2 (2), 3 (11), 4 (1), 5 (6), 6 (1), 9 (7)
- Common template/schema changes:
  - 4: Add restoration/condition-removal/healing-transfer bucket fields.
  - 3: Add restoration, condition-removal, and healing-prevention buckets.
  - 1: Add a condition-removal/restoration bucket for ending named conditions without applying a new condition.
  - 1: Add a condition-removal/restoration bucket for named condition endings.
  - 1: Add a form-derived temporary hit point bucket with replacement restrictions.
  - 1: Add a form-derived temporary hit point bucket.
  - 1: Add condition removal override fields keyed to ending spells.
  - 1: Add condition removal-source fields.
- Common JSON changes:
  - 4: Use current HEALING/UTILITY effects until propagation.
  - 3: Use existing healing/status/utility effects until those buckets are propagated.
  - 1: Add runtime environmentalChange extinguishExposedFlamesInArea.
  - 1: Add runtime environmentalChange heavilyObscured in area.
  - 1: Add runtime healing data for each berry restoring 1 HP on bonus-action consumption.
  - 1: Add runtime HEALING effect with formula twice actual self-damage taken.
  - 1: Add runtime healingModifier data for maximum healing received.
  - 1: Add runtime Life Bond healing mirror and Healing Touch action data.
- Examples:
  - chill-touch / healing_or_restoration: Actionable open: Healing prevention, stabilization, or condition/restoration removal needs explicit restoration/prevention schema beyond generic utility text.
  - armor-of-agathys / healing_or_restoration: Actionable open: Healing prevention, stabilization, or condition/restoration removal needs explicit restoration/prevention schema beyond generic utility text.
  - fog-cloud / healing_or_restoration: Actionable open: Healing prevention, stabilization, or condition/restoration removal needs explicit restoration/prevention schema beyond generic utility text.
  - goodberry / healing_or_restoration: Each Goodberry restores 1 Hit Point when eaten, but the runtime JSON has no healing effect tied to berry consumption.
  - heroism / healing_or_restoration: Heroism grants recurring Temporary Hit Points, but runtime JSON does not represent them as healing or temporary HP data.

### ward_alarm_or_trigger

- Findings: 30
- Distinct spells: 26
- Levels: 1 (5), 2 (3), 3 (11), 4 (1), 5 (1), 6 (7), 7 (2)
- Common template/schema changes:
  - 4: Add ward/trigger bucket fields.
  - 1: Add answerTruthfulness condition fields.
  - 1: Add barrier fields for initial occupants/objects, barred entrants, blocked spell levels, and blocked spell effects.
  - 1: Add blocked-by-spell/effect fields for possession and similar mechanics.
  - 1: Add configurable ward trigger, trigger refinement, and exclusion fields.
  - 1: Add contingent trigger, firing, replacement, self-targeting, and component-dependency fields.
  - 1: Add damage-trigger filters for reaction defenses.
  - 1: Add death-triggered rider timing fields.
- Common JSON changes:
  - 4: Use current Utility Options as interim data.
  - 1: Add runtime alarm/ward data instead of prose-only utility.
  - 1: Add runtime answerBehavior data for no truth compulsion when antagonistic or enemy-recognized.
  - 1: Add runtime apparentState data for indistinguishable from death.
  - 1: Add runtime areaTrigger enters_first_time_on_turn or turn_start.
  - 1: Add runtime barrier data for initial allowed creatures/objects, outside barred creatures/objects, and level <=3 spell/effect blocking.
  - 1: Add runtime blockedBySpellEffects data.
  - 1: Add runtime contingencyTrigger data.
- Examples:
  - alarm / ward_alarm_or_trigger: Alarm's core ward trigger, intrusion conditions, exempt creatures, audible/mental delivery, mental one-mile range, and sleep wake-up are flattened into one utility description.
  - sanctuary / ward_alarm_or_trigger: Sanctuary is a ward with incoming targeting triggers and area-effect bypass; current utility effects preserve some behavior but flatten trigger scope and failed-save options.
  - shield / ward_alarm_or_trigger: Shield's reaction trigger includes being hit by an attack or being targeted by Magic Missile; runtime represents both effects, but the +5 AC effect's reactionTrigger only records when_hit and does not explicitly model 'including against the triggering attack'.
  - snare / ward_alarm_or_trigger: Snare triggers only when a Small, Medium, or Large creature moves onto the ground or floor in the radius. Runtime now filters sizes and records the no-restrained cleanup ending, but the ground/floor movement trigger is not fully first-class.
  - witch-bolt / ward_alarm_or_trigger: The sustained lightning arc is a maintained link between caster and target, but runtime JSON represents it only as concentration plus a later action damage effect.

### resource_or_consumption

- Findings: 27
- Distinct spells: 23
- Levels: 0 (3), 1 (1), 2 (3), 3 (11), 4 (1), 6 (4), 7 (3), 9 (1)
- Common template/schema changes:
  - 4: Add resource/cost/spell-storage bucket fields.
  - 2: Add resource/prevention fields where this is not ordinary spell components.
  - 1: Add component usage fields for must_be_worn_by_caster_and_target.
  - 1: Add component-gated spell failure chance fields.
  - 1: Add conditional material consumption fields tied to optional sub-effects.
  - 1: Add conditional material consumption fields.
  - 1: Add consumable resource fields for nourishment, hydration, quantities, and spoilage.
  - 1: Add created provisions/capacity fields.
- Common JSON changes:
  - 4: Use current component/utility fields as interim data.
  - 2: Keep existing component fields or Utility Options as interim representation.
  - 1: Add runtime componentConsumption conditional on bloodCircleUsed at spell end.
  - 1: Add runtime componentRequirement data for paired rings worn during the effect.
  - 1: Add runtime conditionalComponentConsumption data.
  - 1: Add runtime conditionalConsumption data for using the blood to form the circle.
  - 1: Add runtime consumableResource data for food/water and spoilage.
  - 1: Add runtime contingentSpellResourceCost data.
- Examples:
  - chill-touch / resource_or_consumption: Actionable open: This row identifies resource-like prevention or component behavior that is not fully represented as a runtime resource rule.
  - elementalism / resource_or_consumption: Actionable open: This row identifies resource-like prevention or component behavior that is not fully represented as a runtime resource rule.
  - prestidigitation / resource_or_consumption: The created trinket can deal no damage and has no monetary worth, which is a created-object restriction.
  - purify-food-and-drink / resource_or_consumption: Purify Food and Drink removes poison and rot from nonmagical food and drink in an area, but runtime JSON only stores a generic creation utility description.
  - augury / resource_or_consumption: Augury has a repeated-casting risk that accumulates until Long Rest, but it is prose-only.

### sensor_or_remote_perception

- Findings: 25
- Distinct spells: 23
- Levels: 0 (1), 1 (3), 2 (6), 3 (6), 5 (2), 6 (2), 7 (5)
- Common template/schema changes:
  - 2: Add sensor/remote perception bucket fields.
  - 1: Add attacker perception exception fields for attack modifiers bypassed by specific senses.
  - 1: Add detection fields for detected creature types, detected spell/effect names, location payload, radius, and blocker materials.
  - 1: Add detection fields for poisons, poisonous/venomous creatures, magical contagions, location payload, radius, and blocker materials.
  - 1: Add divination sensor and targeting block fields.
  - 1: Add divinationProtection and scryingSensorBlock fields.
  - 1: Add illusionDisbelief perception-result fields.
  - 1: Add one-way portal perception fields for inside-to-outside sight.
- Common JSON changes:
  - 3: Add runtime remoteSensor data.
  - 2: Use existing Utility Options as interim data.
  - 1: Add runtime alternatePerceptionOrigin data.
  - 1: Add runtime antiDivination data for cannotBeTargetedByDivination and cannotBePerceivedByMagicalScryingSensors.
  - 1: Add runtime attackerSenseException data for Blindsight and Truesight bypassing Blur's disadvantage.
  - 1: Add runtime detection data for creature-type and Hallow sensing instead of prose-only utility.
  - 1: Add runtime detection data for poison, poisonous/venomous creature, and magical contagion sensing.
  - 1: Add runtime divinationProtection data.
- Examples:
  - druidcraft / sensor_or_remote_perception: Actionable open: Sensory prediction/detection effects need a sensor/information schema when they are more than plain description.
  - detect-evil-and-good / sensor_or_remote_perception: The spell's detected creature types, Hallow detection, location payload, and blocker materials are not represented as first-class detection fields.
  - detect-poison-and-disease / sensor_or_remote_perception: The spell detects several poison/disease categories and their locations, but the categories and location payload are prose-only.
  - find-familiar / sensor_or_remote_perception: The caster can remotely see and hear through the familiar and gains its special senses, but the runtime only stores sharedSenses as a coarse boolean.
  - beast-sense / sensor_or_remote_perception: Beast Sense's canonical shared perception and special-senses benefit are now reflected in runtime description, but there is still no first-class shared-senses mechanic.

### illusion_or_disguise

- Findings: 24
- Distinct spells: 24
- Levels: 0 (3), 1 (3), 2 (4), 3 (2), 4 (2), 5 (3), 6 (3), 7 (3), 8 (1)
- Common template/schema changes:
  - 1: Add appearance-change utility fields for altered body feature, duration, and cosmetic-only scope.
  - 1: Add disguise/appearance fields for species appearance, no stat change, same size, and same basic shape restrictions.
  - 1: Add door illusion/disguise fields.
  - 1: Add dream environment shaping fields.
  - 1: Add hostile illusion fields for visible-to-target-only, fear manifestation, and linked damage/rider effects.
  - 1: Add illusion duplicate fields for count, location, follows caster, mimics actions, and indistinguishable behavior.
  - 1: Add illusion enclosure and breach-trigger fields.
  - 1: Add illusion fields for image kind, max cube size, movement action, appearance adjustment, physical interaction reveal, Study/Investigation reveal, and discerned-state behavior.
- Common JSON changes:
  - 1: Add runtime appearanceChange data for Altered Eyes.
  - 1: Add runtime disguise data for the Change Appearance option.
  - 1: Add runtime disguise/illusion reveal data.
  - 1: Add runtime doorIllusion data.
  - 1: Add runtime dreamEnvironment data.
  - 1: Add runtime hostileIllusion data.
  - 1: Add runtime illusion data for creation, movement, reveal rules, and post-reveal transparency.
  - 1: Add runtime illusion data with max 20-foot cube, Magic action move/update, physical interaction reveal, and Study Intelligence (Investigation) vs spell DC.
- Examples:
  - mold-earth / illusion_or_disguise: Mold Earth can create shapes, colors, words, images, and patterns on dirt or stone for 1 hour.
  - prestidigitation / illusion_or_disguise: Minor Creation can create a nonmagical trinket or illusory image that fits in the caster's hand and lasts until the end of the next turn.
  - thaumaturgy / illusion_or_disguise: Altered Eyes changes the caster's eye appearance for 1 minute, which is a visible body/appearance change not represented structurally.
  - disguise-self / illusion_or_disguise: Disguise Self has physical-inspection failure and Study action Intelligence (Investigation) reveal rules, but these reveal mechanics are only prose.
  - illusory-script / illusion_or_disguise: Illusory Script creates an illusion over writing with designated viewers, alternate meaning/handwriting/language, dispel cleanup, and Truesight bypass rules, but JSON keeps all of that in description text.

### aftermath_or_memory

- Findings: 23
- Distinct spells: 21
- Levels: 0 (3), 1 (1), 2 (2), 3 (5), 4 (3), 5 (6), 6 (2), 8 (1)
- Common template/schema changes:
  - 3: Add aftermath/memory fields for post-spell knowledge and delayed consequences.
  - 2: Add aftermath/memory bucket fields.
  - 1: Add aftermath awareness fields for knows_charmed_by_caster.
  - 1: Add aftermath awareness fields for target knowledge after spell end.
  - 1: Add aftermath behavior fields for movement effects.
  - 1: Add aftermath fields for spell-end effects, status, movement override, and end timing.
  - 1: Add aftermath fields for spell-end prone placement and extinguished normal flames.
  - 1: Add aftermath placement fields for post-banishment return.
- Common JSON changes:
  - 3: Keep aftermath text in Utility Options/description until schema propagation.
  - 2: Use Utility Options/description as interim representation.
  - 1: Add runtime aftermath data matching the conditional-ending finding.
  - 1: Add runtime aftermath data recording that the target knows it was Charmed by the caster.
  - 1: Add runtime aftermath fadeOut with riderDismountWindow 1 minute.
  - 1: Add runtime aftermath/spellEndEffect data instead of immediate status.
  - 1: Add runtime aftermathAwareness data.
  - 1: Add runtime deathAftermath data for ash transformation.
- Examples:
  - druidcraft / aftermath_or_memory: Actionable open: Aftermath knowledge or later memory effects need a follow-up/aftermath schema.
  - elementalism / aftermath_or_memory: Actionable open: Aftermath knowledge or later memory effects need a follow-up/aftermath schema.
  - friends / aftermath_or_memory: Actionable open: Aftermath knowledge or later memory effects need a follow-up/aftermath schema.
  - charm-person / aftermath_or_memory: When Charm Person ends, the target knows it was Charmed by the caster; this aftermath knowledge is not structured.
  - calm-emotions / aftermath_or_memory: When Calm Emotions ends, the creature's attitude returns to normal, but the restoration/aftermath state is not represented.

### reaction_or_opportunity_restriction

- Findings: 18
- Distinct spells: 17
- Levels: 0 (1), 1 (3), 2 (2), 3 (6), 4 (3), 5 (2), 6 (1)
- Common template/schema changes:
  - 2: Add casting trigger fields for after-hit smite-style spells, including allowed attack sources and target binding.
  - 1: Add action restriction fields for no Bonus Actions and no Reactions.
  - 1: Add action/reaction restriction fields with allowed action exceptions.
  - 1: Add controlled-target reaction command fields with caster reaction cost.
  - 1: Add controlled-target reaction command fields with controller reaction cost.
  - 1: Add pending attack-trigger fields for next attack hit_or_miss.
  - 1: Add reaction availability and safest-route forced movement fields.
  - 1: Add reaction behavior fields for must_take_opportunity_attack_if_able.
- Common JSON changes:
  - 2: Add runtime commandReaction data.
  - 1: Add runtime actionRestrictions data to Confused.
  - 1: Add runtime actionRestrictions data.
  - 1: Add runtime castingTrigger data for immediately after hitting a creature with a melee weapon or Unarmed Strike.
  - 1: Add runtime castingTrigger data for immediately after hitting a creature with a weapon or Unarmed Strike.
  - 1: Add runtime forcedMovement routeConstraint=safest_route and reactionRequiredIfAvailable data.
  - 1: Add runtime opportunityAttackBehavior data.
  - 1: Add runtime opportunityAttackSuppression data or narrow status condition metadata; clear inappropriate repeatSave/escapeCheck defaults once not-applicable sentinels exist.
- Examples:
  - shocking-grasp / reaction_or_opportunity_restriction: The core mechanic is specifically Opportunity Attack suppression until the start of the target's next turn; the current status condition name is broader than the prose and carries inappropriate default escape/repeat-save data.
  - arms-of-hadar / reaction_or_opportunity_restriction: Arms of Hadar suppresses all reactions until the start of the target's next turn on a failed Strength save; the status rider now uses negates_condition, but still relies on a broad Reactions Suppressed status with inappropriate default repeat-save/escape sentinels.
  - dissonant-whispers / reaction_or_opportunity_restriction: Dissonant Whispers represents reaction-using forced movement away from the caster, but 'if available' and 'safest route' are only stored in prose/custom formula.
  - find-familiar / reaction_or_opportunity_restriction: A familiar can deliver a touch spell only by taking its Reaction while within 100 feet, but this is only partly represented as a named special action.
  - shining-smite / reaction_or_opportunity_restriction: Shining Smite is cast after a triggering weapon or unarmed hit, but runtime timing does not preserve that trigger.

### forced_movement

- Findings: 17
- Distinct spells: 16
- Levels: 0 (2), 1 (1), 2 (3), 4 (3), 5 (6), 6 (2)
- Common template/schema changes:
  - 2: Add wall-creation displacement fields.
  - 1: Add a post-movement damage gate field for distance-from-caster checks.
  - 1: Add enclosed-object movement fields for internal push action, half-speed cap, and external pickup/move.
  - 1: Add environmental forced movement fields for pull distance, radius, medium requirement, and escape action/check.
  - 1: Add failed-save forced movement fields for creatures and unsecured object push fields.
  - 1: Add flying-target failed-save Prone fields.
  - 1: Add forced movement direction qualifiers for along_line/away_from_caster and trigger timing.
  - 1: Add forced placement/ejection fields for success ejection, overflow ejection, carried movement, and spell-end prone placement.
- Common JSON changes:
  - 2: Add runtime wallDisplacement data.
  - 1: Add runtime condition data that gates the damage effect on target distance after forced movement.
  - 1: Add runtime downdraftProne data.
  - 1: Add runtime forcedMovement.origin=center_of_area and direction=away_from_origin.
  - 1: Add runtime forcedPlacement and ejectionProne data.
  - 1: Add runtime forcefulHand movement data.
  - 1: Add runtime invalidEndPositionRelocation data.
  - 1: Add runtime MOVEMENT effect for failed-save creature push and objectMovement data for unsecured objects entirely within the cube.
- Examples:
  - lightning-lure / forced_movement: The pull is represented, but the damage only applies if the target is within 5 feet after the pull; that post-movement gate is prose-only.
  - thorn-whip / forced_movement: Thorn Whip's size-gated pull is partially represented, and the runtime direction was corrected to toward_caster, but the optional 'can pull' choice remains flattened.
  - thunderwave / forced_movement: Thunderwave pushes failed-save creatures and unsecured objects 10 feet away, but runtime JSON keeps both pushes in a generic utility description instead of MOVEMENT/object movement data.
  - gust-of-wind / forced_movement: The 15-foot push away following the Line is partially represented, but trigger timing and line-following direction need more precise data.
  - gust-of-wind / forced_movement: Gust of Wind changes movement cost directionally, but the cost is prose-only.

### movement_or_repositioning

- Findings: 16
- Distinct spells: 15
- Levels: 0 (1), 1 (3), 2 (2), 3 (5), 4 (2), 5 (1), 6 (2)
- Common template/schema changes:
  - 1: Add controlled entity movement fields for commanded movement distance.
  - 1: Add created-area movement/hover fields for height cap, drop-off descent, carried occupants, and spell-end fall.
  - 1: Add movable created-effect fields for distance, leash, and action cost.
  - 1: Add movement grant fields for fly speed and hover.
  - 1: Add movement mode fields for walking/flying/swimming/climbing/burrowing speed grants.
  - 1: Add movement mode, hover, transformation duration, safe descent, and fall aftermath fields.
  - 1: Add movement option fields for jump distance, movement cost, frequency, and duration.
  - 1: Add movement outcome fields linked to enclosure saves.
- Common JSON changes:
  - 1: Add runtime controlledMovement data with maxDistance 15 feet per command.
  - 1: Add runtime enclosureEscapeMovement data.
  - 1: Add runtime levitation data for vertical rise 20 feet, suspended duration, altitude adjustment 20 feet, and 500-pound object limit.
  - 1: Add runtime movementGrant data for flySpeed 60 and hover true.
  - 1: Add runtime movementModeSpeed data.
  - 1: Add runtime movementModeSpeed, hover, transformationState, and onEndDescent data.
  - 1: Add runtime movementModifier speed x2 and extraAction allowedActions Attack/Dash/Disengage/Hide/Utilize with oneAttackOnly.
  - 1: Add runtime movementOption data for jump up to 30 feet by spending 10 feet of movement once per turn.
- Examples:
  - dancing-lights / movement_or_repositioning: Actionable open: Moving created lights/forms needs an owned movable effect schema rather than simple target movement.
  - jump / movement_or_repositioning: Jump grants a specific once-per-turn movement option with a fixed jump distance and movement cost, but this is not modeled as movement data.
  - longstrider / movement_or_repositioning: Longstrider increases the target's Speed by 10 feet, but runtime JSON stores this as generic utility prose instead of a movement/speed modifier.
  - unseen-servant / movement_or_repositioning: The servant can be commanded to move up to 15 feet, but movement is only in objectDescription prose.
  - levitate / movement_or_repositioning: Levitate raises and suspends a creature or loose object and later changes altitude by up to 20 feet, but the current movement model has no vertical suspension/altitude-change type and is forced to use teleport.

