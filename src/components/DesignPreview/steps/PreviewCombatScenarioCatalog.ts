// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 13/08/2026, 10:23:50
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarioSearch.tsx, components/DesignPreview/steps/PreviewCombatScenarioSections.ts, components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlTypes.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file is the scenario directory for the Tactical Sandbox preview.
 *
 * The combat scenario page uses these records to decide which cards appear in
 * the sidebar, what each card explains, and which rule bullets belong in the
 * verification panel. Keeping the list here prevents the scenario docs, tests,
 * and page UI from drifting into different ideas of what the sandbox contains.
 */

// ============================================================================
// Scenario Identity
// ============================================================================
// This section names every scenario lane that the preview page can route to.
// Existing lanes are already backed by bespoke boards; expanded lanes start as
// focused proving grounds and can grow deeper without changing the sidebar API.
// ============================================================================

export const BASE_SCENARIO_IDS = [
  'cover',
  'darkvision',
  'terrain',
  'concentration',
  'reaction',
  'resistance'
] as const;

export const EXPANDED_SCENARIO_IDS = [
  'line_of_sight',
  'area_effect',
  'forced_movement',
  'conditions',
  'stealth_hidden',
  'elevation_range',
  'hazards_zones',
  'summons_controlled',
  'object_interaction',
  'spell_target_restrictions',
  'death_saves',
  'action_economy',
  'grapple_escape',
  'shove_prone',
  'critical_hits',
  'healing_temp_hp',
  'saving_throws_half_damage',
  'multiattack_riders',
  'reach_creature_size',
  'spell_slots_upcasting',
  'counterspell_nested_reactions',
  'dispel_magic_cleanup',
  'repeat_saves_condition_expiry',
  'sustain_actions_ongoing_control',
  'teleportation_occupied_spaces',
  'falling_ground_impact',
  'flying_aerial_movement',
  'initiative_ties_shared_turns',
  'damage_over_time_scheduled_effects',
  'reactive_damage_retaliation',
  'taunt_forced_targeting',
  'companion_reactions'
] as const;

export const SCENARIO_IDS = [
  ...BASE_SCENARIO_IDS,
  ...EXPANDED_SCENARIO_IDS
] as const;

export type PreviewCombatScenarioId = typeof SCENARIO_IDS[number];
export type PreviewCombatScenarioGroup = 'current' | 'expanded';

export interface PreviewCombatScenarioDefinition {
  id: PreviewCombatScenarioId;
  label: string;
  summary: string;
  proofFocus: string;
  group: PreviewCombatScenarioGroup;
  accent: string;
  rules: string[];
}

// ============================================================================
// Scenario Catalog
// ============================================================================
// These records are written in player-facing terms because the sandbox is a
// teaching surface. The map builder reads the ids, while the sidebar and rules
// panel read the labels, summaries, and proof bullets.
// ============================================================================

export const PREVIEW_COMBAT_SCENARIOS: PreviewCombatScenarioDefinition[] = [
  {
    id: 'cover',
    label: 'Cover Mechanics',
    summary: 'Verify Half (+2 AC), Three-Quarters (+5 AC), and Total Cover lines of sight in combat formulas.',
    proofFocus: 'Cover labels, attack legality, AC modifiers, total-cover blocking, and movable torch visibility.',
    group: 'current',
    accent: 'amber',
    rules: [
      'HC low cover grants Half Cover (+2 AC).',
      '3/4 pillars grant Three-Quarters Cover (+5 AC).',
      'TC high walls impose Total Cover and block target selection.'
    ]
  },
  {
    id: 'darkvision',
    label: 'Darkvision & Senses',
    summary: 'Test darkness obscurity penalties against blindsight and darkvision ranges.',
    proofFocus: 'Ambient darkness, bright and dim light, observer senses, and target visibility.',
    group: 'current',
    accent: 'indigo',
    rules: [
      'Normal vision struggles to target creatures in darkness.',
      'Darkvision treats darkness inside its range as dim light.',
      'Blindsight can locate nearby targets without relying on light.'
    ]
  },
  {
    id: 'terrain',
    label: 'Difficult Terrain',
    summary: 'Verify pathfinding detours and double movement cost through expensive tiles.',
    proofFocus: 'Movement budget depletion, route choice, and tile cost explanation.',
    group: 'current',
    accent: 'emerald',
    rules: [
      'Normal ground costs 5 feet of movement per tile.',
      'Difficult terrain costs 10 feet of movement per tile.',
      'Pathing should prefer an efficient route when a detour saves speed.'
    ]
  },
  {
    id: 'concentration',
    label: 'Spell Concentration',
    summary: 'Verify one-effect ownership, replacement, damage saves, source loss, and once-only delivery.',
    proofFocus: 'Owned spell/effect, Action and slot payment, final-damage DC, keep/break cleanup, source loss, stable event id, and Reset.',
    group: 'current',
    accent: 'violet',
    rules: [
      'A caster maintains only one concentration spell; a new accepted concentration cast ends only that caster\'s prior owned effect.',
      'A concentrating caster rolls a Constitution save after taking final damage.',
      'The save DC is 10 or half the damage taken, whichever is higher.',
      'A failed save or Incapacitation ends the exact linked effect once; unrelated actors and non-concentration effects remain.',
      'Accepted stable events pay their Action and slot once; invalid, declined, and repeated ids are atomic no-ops.'
    ]
  },
  {
    id: 'reaction',
    label: 'Opportunity Attacks',
    summary: 'Verify reactions triggered by leaving enemy reach and prevented by Disengage.',
    proofFocus: 'Threatened reach, reaction spending, movement timing, and Disengage prevention.',
    group: 'current',
    accent: 'rose',
    rules: [
      'Leaving a hostile creature reach can trigger an opportunity attack.',
      'The attacker spends its reaction when the attack fires.',
      'Disengage prevents opportunity attacks for the turn.'
    ]
  },
  {
    id: 'resistance',
    label: 'Resistance & Vulnerability',
    summary: 'Verify resistance, vulnerability, and immunity damage scaling.',
    proofFocus: 'Half damage, double damage, zero damage, and clear combat-log feedback.',
    group: 'current',
    accent: 'red',
    rules: [
      'Resistance halves matching damage, rounded down.',
      'Vulnerability doubles matching damage.',
      'Immunity reduces matching damage to zero.',
      'Each typed damage component resolves its own defense before temporary HP, current HP, and downing update.',
      'Repeated instances of the same resistance, vulnerability, or immunity count only once.',
      'When resistance and vulnerability both match under the project’s 2024 rules, resistance rounds down first and vulnerability doubles the remaining damage.',
      'One accepted proof event spends one Action; replaying its stable id is an atomic no-op until Reset Board starts a new delivery epoch.'
    ]
  },
  {
    id: 'line_of_sight',
    label: 'Line of Sight & Targeting',
    summary: 'Prove range, sight, corners, endpoints, cover, visibility, and atomic target attempts.',
    proofFocus: 'Positions, target eligibility, Action, cover-modified roll, reasoned log, HP, replay, and exact Reset.',
    group: 'expanded',
    accent: 'sky',
    rules: [
      'Range, sealed corners, opaque endpoints, and Total Cover reject before a roll or Action payment.',
      'Half and Three-Quarters Cover remain targetable and modify the production attack roll instead of becoming Total Cover.',
      'Light, Darkvision, Blindsight, and Invisible use production visibility and attack modifiers.',
      'A repeated stable attempt is an atomic no-op; Reset restores the exact authored positions, resources, HP, light, and event epoch.'
    ]
  },
  {
    id: 'area_effect',
    label: 'Area of Effect',
    summary: 'Prove canonical area geometry, membership, saves, defenses, payment, rejection, replay, and Reset.',
    proofFocus: 'Shape, origin, orientation, boundary cells, included/excluded creatures, damage, resources, event id, and exact Reset.',
    group: 'expanded',
    accent: 'orange',
    rules: [
      'Canonical shape, origin, orientation, and dimensions own the highlighted footprint and exact boundary membership.',
      'Each included creature resolves once through saves, full or half damage, defenses, temporary HP, downing, and conditions; excluded creatures remain untouched.',
      'Sight applies from caster to placement when spell data requires it; internal blockers do not invent blast-propagation cover rules.',
      'A valid event spends one Action and slot once; invalid placement and replay are atomic no-ops, and Reset restores every authored fact.'
    ]
  },
  {
    id: 'forced_movement',
    label: 'Forced Movement',
    summary: 'Test push, pull, shove, drag, collision, and hazard interactions.',
    proofFocus: 'Forced destination, blocked movement, collisions, and hazard entry.',
    group: 'expanded',
    accent: 'cyan',
    rules: [
      'Forced movement can move a creature without spending its speed.',
      'Walls and occupied spaces should stop illegal destinations.',
      'Hazards should react when forced movement enters them.'
    ]
  },
  {
    id: 'conditions',
    label: 'Conditions',
    summary: 'Demonstrate prone, grappled, restrained, blinded, invisible, poisoned, and frightened states.',
    proofFocus: 'Condition badges, mechanical penalties, allowed actions, and removal timing.',
    group: 'expanded',
    accent: 'fuchsia',
    rules: [
      'Condition tokens should be visible on affected creatures.',
      'Each condition should explain its tactical impact.',
      'The log should record when a condition is applied or removed.'
    ]
  },
  {
    id: 'stealth_hidden',
    label: 'Stealth & Hidden',
    summary: 'Test Hide, passive perception, revealed-on-attack, and unseen attacker advantage.',
    proofFocus: 'Hidden state, observer perception, reveal triggers, and advantage/disadvantage notes.',
    group: 'expanded',
    accent: 'slate',
    rules: [
      'A hidden creature should not be equally visible to every observer.',
      'Attacking should reveal the hidden creature when rules require it.',
      'Unseen attacker advantage should be visible before the roll.'
    ]
  },
  {
    id: 'elevation_range',
    label: 'Elevation & Range',
    summary: 'Test cliffs, high ground, low ground, vertical distance, ladders, and flying targets.',
    proofFocus: '3D distance, elevation labels, range validity, and movement between heights.',
    group: 'expanded',
    accent: 'lime',
    rules: [
      'Vertical distance should count when range is measured.',
      'Elevated terrain should be visibly distinct from flat ground.',
      'Flying or raised targets need clear targetability feedback.'
    ]
  },
  {
    id: 'hazards_zones',
    label: 'Hazards & Zones',
    summary: 'Test burning ground, spike growth, fog, magical darkness, and aura timing.',
    proofFocus: 'Zone footprint, enter/start/end triggers, lingering effects, and duration.',
    group: 'expanded',
    accent: 'yellow',
    rules: [
      'Hazard zones should show their active footprint.',
      'Entering or starting in a zone should trigger the right effect.',
      'Zone duration and ownership should be inspectable.'
    ]
  },
  {
    id: 'summons_controlled',
    label: 'Summons & Controlled Allies',
    summary: 'Test summoned creatures, companions, control ownership, and turn order.',
    proofFocus: 'Summon identity, controller, initiative placement, and allowed commands.',
    group: 'expanded',
    accent: 'teal',
    rules: [
      'Summons should identify who controls them.',
      'Controlled allies need a clear turn-order relationship.',
      'Commands should show whether the player can direct the creature.'
    ]
  },
  {
    id: 'object_interaction',
    label: 'Object Interaction',
    summary: 'Test doors, torches, crates, levers, breakable objects, and carried map objects.',
    proofFocus: 'Selectable objects, object movement, object targeting, and object state changes.',
    group: 'expanded',
    accent: 'stone',
    rules: [
      'Objects should be selectable when they matter tactically.',
      'Object state changes should be visible on the map.',
      'Targetable objects should share the normal targeting rules.'
    ]
  },
  {
    id: 'spell_target_restrictions',
    label: 'Spell Target Restrictions',
    summary: 'Test creature-only, object-only, willing, enemy-only, visible-target, and empty-space targeting.',
    proofFocus: 'Allowed targets, rejected targets, rejection reasons, and spell metadata parity.',
    group: 'expanded',
    accent: 'purple',
    rules: [
      'Spell metadata should define who or what can be targeted.',
      'Invalid targets should be visibly rejected before casting.',
      'The rejection reason should be readable without checking code.'
    ]
  },
  {
    id: 'death_saves',
    label: 'Death Saves & Downed State',
    summary: 'Test dropping to 0 HP, unconscious state, stabilization, healing from 0, and death saves.',
    proofFocus: 'Downed token state, death-save pips, stabilization, and recovery feedback.',
    group: 'expanded',
    accent: 'neutral',
    rules: [
      'A creature at 0 HP should show a distinct downed state.',
      'Death-save successes and failures should be visible.',
      'Healing should clearly return the creature to action.'
    ]
  },
  {
    id: 'action_economy',
    label: 'Action Economy Stress Test',
    summary: 'Exercise action, bonus action, reaction, movement, free interaction, and Ready timing.',
    proofFocus: 'Used resources, blocked actions, reset timing, and turn-end state.',
    group: 'expanded',
    accent: 'green',
    rules: [
      'The turn UI should show which resources are still available.',
      'Unaffordable actions should be blocked with a reason.',
      'Ending the turn should reset only the resources that should reset.'
    ]
  },
  {
    id: 'grapple_escape',
    label: 'Grapple & Escape',
    summary: 'Prove Grappled movement, voluntary release, an escape check, and automatic release when the hold cannot continue.',
    proofFocus: 'Paired Grappled state, the sand 5-foot reach ring, speed 0, action-spending escape, and maintenance release.',
    group: 'expanded',
    accent: 'amber',
    rules: [
      'The sand-colored cells around the Grappler mark its normal 5-foot reach.',
      'Grappled sets the Escape Target movement pool to 0 feet until the hold ends.',
      'A successful Athletics or Acrobatics action check ends Grappled.',
      'The hold ends automatically if the Grappler is incapacitated or leaves reach.'
    ]
  },
  {
    id: 'shove_prone',
    label: 'Shove & Knock Prone',
    summary: 'Prove a save-backed Unarmed Strike can push a legal target or knock it Prone without crossing blocked space.',
    proofFocus: 'Live-turn Attack spending, defender-selected save, push-versus-Prone choice, persistent Prone, size eligibility, and wall collision.',
    group: 'expanded',
    accent: 'orange',
    rules: [
      'Only the live turn owner can Shove, and each attempt spends one available attack from its Attack action.',
      'The target makes a Strength or Dexterity saving throw against the shover\'s Strength-based DC.',
      'On a failed save, the shover chooses a five-foot push or the Prone condition.',
      'Prone persists across turns until the target spends half its Speed to Stand Up.',
      'A target more than one size larger than the shover is ineligible.',
      'A blocked destination prevents the push even after a failed save.'
    ]
  },
  {
    id: 'critical_hits',
    label: 'Critical Hits & Natural 1s',
    summary: 'Prove turn-owned attacks, natural-roll overrides, ordinary Armor Class checks, and critical dice through the production damage pipeline.',
    proofFocus: 'Raw d20, live Action 1/1 payment, target AC, 2d8 + 3 base damage, a doubled Fire rider, resistance, downing, and repeat rejection before another roll.',
    group: 'expanded',
    accent: 'yellow',
    rules: [
      'A natural 20 automatically hits and is a critical hit even when its total is below the target Armor Class.',
      'A natural 1 automatically misses even when its total exceeds the target Armor Class.',
      'Ordinary rolls hit when the attack total meets or exceeds Armor Class and miss below it.',
      'A critical hit doubles the Longbow and hit-rider damage dice but adds the flat +3 only once.',
      'The live turn owner spends one finite Attack action; off-turn and exhausted repeats reject before rolls, riders, or damage.',
      'Fire resistance and the ordinary downing transition apply after the critical dice resolve.'
    ]
  },
  {
    id: 'healing_temp_hp',
    label: 'Healing & Temporary HP',
    summary: 'Prove current-HP healing, the maximum-HP cap, separate non-stacking temporary HP, and buffer-first damage.',
    proofFocus: 'Live turn owner, Action/Bonus Action, level-1 slots, wounded-ally HP bar, cyan temporary-HP cue, rejection reason, damage absorption, and combat log.',
    group: 'expanded',
    accent: 'cyan',
    rules: [
      'Healing raises current HP but never above the creature\'s maximum HP.',
      'Target and live-turn validation happen before finite Action, Bonus Action, and spell-slot payment; rejected attempts change neither health nor resources.',
      'Temporary HP is a separate pool and does not count as healing.',
      'Temporary-HP offers do not stack: a smaller offer keeps the current pool, while a larger offer replaces it.',
      'Incoming damage consumes temporary HP before reducing current HP.',
      'Healing a downed player above 0 HP clears death saves and Unconscious through the shared health transition.'
    ]
  },
  {
    id: 'saving_throws_half_damage',
    label: 'Saving Throws & Half Damage',
    summary: 'Prove visible Dexterity-save math, full or half damage, defense ordering, immunity, and the canonical downing boundary.',
    proofFocus: 'Caster DC, raw d20, target modifier, exact-DC success, 4d6 damage, defenses, HP/death saves, fire area cue, and reasoned combat log.',
    group: 'expanded',
    accent: 'red',
    rules: [
      'A saving throw succeeds when its d20 plus modifier meets or exceeds the caster\'s save DC.',
      'A failed save takes the full 15 Fire damage on this board.',
      'A successful save takes half damage, with odd totals rounded down from 15 to 7.',
      'Damage resistance applies after the save reduction, so 15 becomes 7 and then 3.',
      'Fire immunity applies after the save reduction and reduces the remaining damage to 0.',
      'A player target reduced from 15 HP to 0 starts at 0 successes and 0 failures and gains Unconscious through the shared HP transition.',
      'These Test Controls are isolated deterministic rule probes, not turn-owned spell casts, so they do not spend Actions or spell slots.',
      'Evasion remains outside this scenario because no reusable production Evasion resolution is currently supported.'
    ]
  },
  {
    id: 'multiattack_riders',
    label: 'Multiattack & Attack Riders',
    summary: 'Prove one isolated one-action Multiattack transaction, independent hit and miss rolls, per-attack targets, hit-gated venom, and poison immunity.',
    proofFocus: 'One spent Action, Bite and Claw roll math, separate target HP, poison cue, rider trigger or miss gate, immunity boundary, and reasoned combat log.',
    group: 'expanded',
    accent: 'lime',
    rules: [
      'Multiattack spends one Action while resolving each authored attack separately.',
      'Bite and Claw each roll against their own target Armor Class, so either attack can hit while the other misses.',
      'The Venom Rider is target-bound and applies only after its triggering Bite hits.',
      'Poison immunity reduces the venom rider to 0 without preventing the Bite\'s Piercing damage.',
      'This deterministic sandbox transaction does not claim that normal monster abilities already dispatch multiattackCount or subAttackIds automatically.',
    ]
  },
  {
    id: 'reach_creature_size',
    label: 'Reach & Creature Size',
    summary: 'Prove normal versus extended melee reach, nearest-footprint distance, size transitions, and complete-footprint placement.',
    proofFocus: 'Large, Medium, and Small actors; 5-foot and 10-foot reach rings; nearest footprint and center distances; valid strike; blocked 2-by-2 gate; reasoned combat log.',
    group: 'expanded',
    accent: 'sky',
    rules: [
      'Melee range is measured from the nearest occupied footprint squares, not only from actor anchors or token centers.',
      'The Large lancer can reach the target at 10 feet but not at 5 feet from the same position.',
      'Shrinking the lancer to Medium removes its near footprint edge and puts the same target 15 feet away.',
      'A Large placement is illegal when any square of its 2-by-2 footprint crosses blocked terrain.'
    ]
  },
  {
    id: 'spell_slots_upcasting',
    label: 'Spell Slots & Upcasting',
    summary: 'Prove cumulative live spell state, exact slot payment, higher-slot scaling, invalid-cast rejection, and scoped reset behavior.',
    proofFocus: 'Fireball caster and target, live level-3 and level-4 inventory, Action state, 8d6 to 9d6 scaling, repeat and slot-boundary failures, HP, and combat log.',
    group: 'expanded',
    accent: 'violet',
    rules: [
      'A base Fireball cast spends the level-3 slot and the caster\'s Action.',
      'A level-4 Fireball spends the level-4 slot and scales its damage from 8d6 to 9d6.',
      'Repeated, off-turn, exhausted, and missing-slot casts fail against mounted state before a roll, payment, or effect.',
      'Fireball cannot use a slot below level 3, and cantrips cannot be upcast with spell slots.',
      'Reset restores only the authored CS26 actors, both slots, a ready Action, positions, and target HP.'
    ]
  },
  {
    id: 'counterspell_nested_reactions',
    label: 'Counterspell & Nested Reactions',
    summary: 'Prove 2024 Counterspell saves, reaction and slot payment, visibility/range/decline rejection, and last-in-first-out counter-Counterspell resolution.',
    proofFocus: 'Three visible casters, Fireball and Counterspell cues, Action and Reaction state, level-3 and level-4 slots, Constitution save math, visibility and distance facts, target HP, and reasoned stack order.',
    group: 'expanded',
    accent: 'indigo',
    rules: [
      'Counterspell spends its caster\'s Reaction and level-3 slot before the triggering caster makes the 2024 Constitution save.',
      'A failed save stops the spell and wastes its casting Action or Reaction, but restores the interrupted spell slot.',
      'The live 2024 Counterspell does not automatically stop a lower- or equal-level spell and gains no automatic-success upcast rule.',
      'A Counterspell can itself be counterspelled once; the newest response resolves first, and unavailable reactions or slots cannot enter the stack.',
      'An unseen or more-than-60-foot caster is rejected before payment, and a player may decline an eligible reaction without creating a Counterspell transaction.',
      'Reset restores only the three authored CS27 actors, their positions, HP, Action, Reactions, slots, visibility state, and empty reaction stack.'
    ]
  },
  {
    id: 'dispel_magic_cleanup',
    label: 'Dispel Magic & Effect Cleanup',
    summary: 'Prove automatic lower-level cleanup, checked higher-level cleanup, strict effect ownership, and invalid-target rejection.',
    proofFocus: 'Bless and Greater Invisibility status cues, Mage Armor preservation, Action and level-3 slot payment, spellcasting-ability check math, concentration links, and reasoned rejection logs.',
    group: 'expanded',
    accent: 'cyan',
    rules: [
      'A spell no higher than the Dispel Magic slot ends automatically after the Action and slot are paid.',
      'A higher-level spell ends only when the spellcasting-ability check meets DC 10 plus that spell level.',
      'Cleanup removes mechanical status, visible condition cues, and concentration ownership without deleting unrelated ongoing spells.',
      'Instantaneous spell aftermath and targets with no ongoing spell are rejected before payment.'
    ]
  },
  {
    id: 'repeat_saves_condition_expiry',
    label: 'Repeat Saves & Condition Expiry',
    summary: 'Prove Hold Person turn-end saves, retained penalties, selective source cleanup, and duration expiry.',
    proofFocus: 'Caster ownership, Wisdom save timing and math, Paralyzed speed/action penalties, one-round duration cue, unrelated effects, and reasoned logs.',
    group: 'expanded',
    accent: 'fuchsia',
    rules: [
      'Hold Person grants its affected Humanoid a Wisdom save at the end of each of that target\'s turns.',
      'A failed repeat save retains Paralyzed, speed 0, blocked actions, and the source link.',
      'A successful repeat save removes the Hold Person status and condition at turn end while unrelated effects remain.',
      'The final remaining duration can expire at turn start even when no repeat save has ended the condition.'
    ]
  },
  {
    id: 'sustain_actions_ongoing_control',
    label: 'Sustain Actions & Ongoing Control',
    summary: 'Prove Witch Bolt establishment, later-turn Bonus Action damage, optional skipping, arc maintenance, and selective cleanup.',
    proofFocus: 'Controller and target link, Action and level-1 slot payment, later-turn Bonus Action, 2d12 and 1d12 HP changes, range, Total Cover, concentration, duration, and unrelated Mage Armor.',
    group: 'expanded',
    accent: 'sky',
    rules: [
      'The initial Witch Bolt cast spends an Action and level-1 slot, resolves its ranged spell attack, and establishes a concentration-owned arc.',
      'On a later turn, the caster may spend a Bonus Action to deal 1d12 Lightning damage automatically without another attack roll.',
      'Skipping the optional later-turn Bonus Action spends nothing and deals no damage, but does not end the 2024 spell.',
      'The arc ends beyond 60 feet, through Total Cover, after concentration loss, or when its one-minute duration expires; cleanup leaves unrelated effects intact.'
    ]
  },
  {
    id: 'teleportation_occupied_spaces',
    label: 'Teleportation & Occupied Spaces',
    summary: 'Prove exact Misty Step placement, complete creature footprints, pre-payment rejection, and traversal exclusion.',
    proofFocus: 'Large source and destination footprints, occupied and blocked far squares, board edges, sight, range, Bonus Action and slot payment, zero movement cost, teleport afterimages, and no opportunity attack.',
    group: 'expanded',
    accent: 'violet',
    rules: [
      'Misty Step spends a Bonus Action and level-2 slot only after the complete visible destination footprint is legal within 30 feet.',
      'An occupied, blocked, or off-board square anywhere in the Large 2-by-2 footprint rejects the chosen destination without payment or movement.',
      'A hidden destination or one beyond 30 feet rejects with a precise reason before any spell cost or visual effect.',
      'Teleportation changes position directly: intervening difficult terrain and path blockers cost no movement and leaving reach does not trigger an opportunity attack.'
    ]
  },
  {
    id: 'falling_ground_impact',
    label: 'Falling & Ground Impact',
    summary: 'Prove fall thresholds and cap, defended/downing impact, exact landing legality, Prone, and a paid Feather Fall reaction.',
    proofFocus: 'Source elevation, distance and 20d6 cap, landing tile, raw/defended damage, temp HP, HP/death state, Prone, atomic endpoint rejection, Feather Fall choice/resources, repeat safety, and impact cues.',
    group: 'expanded',
    accent: 'orange',
    rules: [
      'A fall shorter than 10 feet rolls 0d6, deals no damage, and does not make the creature Prone.',
      'Each complete 10 feet adds 1d6 Bludgeoning damage to a maximum of 20d6; damage defenses, temporary HP, HP, downing, death state, and Prone resolve through the shared combat transaction.',
      'An occupied, blocked, or off-board landing is rejected before movement, damage, Prone, Reaction, spell slot, or impact cue changes.',
      'An eligible accepted Feather Fall targets a visible falling creature within 60 feet, pays one Reaction and level-1 slot once, and prevents landing damage and Prone; decline or rejection pays nothing and gravity proceeds.'
    ]
  },
  {
    id: 'flying_aerial_movement',
    label: 'Flying & Aerial Movement',
    summary: 'Prove persisted altitude, horizontal-plus-vertical Fly Speed cost, ground-terrain bypass, legal airspace, and atomic rejection boundaries.',
    proofFocus: 'Fly Speed budget, start and destination altitude, 3D route cost, difficult ground and obstacle clearance, occupied/blocked/off-board/insufficient-speed reasons, aerial badges, route cues, and support-loss boundary.',
    group: 'expanded',
    accent: 'sky',
    rules: [
      'The legal route moves 25 feet horizontally and climbs 10 feet, spending 35 of the Aerial Scout’s 40-foot Fly Speed.',
      'Mud and ground obstacles do not add aerial movement cost when the chosen airspace clears them, while destination bounds and complete footprints still apply.',
      'Occupied, blocked, off-board, and insufficient-speed destinations reject before any position, altitude, movement cost, landing, or result cue changes.',
      'A non-hovering creature must fall when its Fly Speed becomes 0; the sandbox reports the exact unsupported landing/fall runtime boundary instead of simulating one.'
    ]
  },
  {
    id: 'initiative_ties_shared_turns',
    label: 'Initiative Ties & Shared Turns',
    summary: 'Prove Aralia’s deterministic house tie policy and a production shared-initiative group with independently owned member turns.',
    proofFocus: 'Initiative totals, house-policy tie facts, active group/member, group completion, independent Action/Reaction/movement, member effect boundaries, Incapacitated/missing/removal behavior, repeat no-op, Reset, and logs.',
    group: 'expanded',
    accent: 'amber',
    rules: [
      'Aralia house policy: initiative total sorts first; equal totals use Dexterity, then initiative bonus, then stable authored order. This deterministic ladder is not a canonical 5e tie rule.',
      'Shared Echo uses production shared-initiative metadata to join Tie Captain’s initiative-15 group. The group selects one active member at a time and completes only after every eligible member boundary resolves.',
      'Actions, movement, Reactions, and effects remain member-owned. End Member expires only that member’s Own-Turn Marker and resets only the next member’s economy.',
      'Incapacitated members retain start/end timing, missing members are skipped, active removal advances once without reinitializing, repeated requests are no-ops, and Reset restores the authored group.'
    ]
  },
  {
    id: 'damage_over_time_scheduled_effects',
    label: 'Damage Over Time & Scheduled Effects',
    summary: 'Prove canonical defended start/end-turn damage, damage-then-save cleanup, stable independent schedules, and exact expiry.',
    proofFocus: 'Schedule owner/source/target, round and actor, canonical 1d6 Fire and 2d4 Acid, resistance/immunity/temp HP/downing, Constitution save, ten-round expiry, removal, idempotence, and ordered logs.',
    group: 'expanded',
    accent: 'rose',
    rules: [
      'Searing Smite deals its recurring 1d6 Fire damage at the start of the marked target turn, resolves resistance, immunity, temporary HP, and downing, then makes its captured-DC Constitution save.',
      'Melf\'s Acid Arrow deals 2d4 Acid damage once at the end of the target\'s next turn, then its schedule is consumed without a second fire.',
      'A successful Searing Smite save removes exactly its owned schedule, Ignited status, structured condition, and active source link; failure preserves them. Source loss does not end these non-concentration delayed payloads, while target loss prunes them.',
      'The live queue preserves authored order and same-phase idempotence. Searing Smite lasts at most one minute (ten rounds) and expires before a round-11 tick; Acid removal remains selective.'
    ]
  },
  {
    id: 'reactive_damage_retaliation',
    label: 'Reactive Damage & Retaliation',
    summary: 'Prove one ordered damaging-hit response, exact Reaction and slot payment, targeting rejection, canonical defenses, and attacker downing.',
    proofFocus: 'Trigger event identity, hit and damage qualification, 60-foot range, line of sight, retaliator state, Reaction and level-1 slot, Dexterity save, Fire defense, both HP totals, downing, and ordered logs.',
    group: 'expanded',
    accent: 'red',
    rules: [
      'The triggering hit resolves its Slashing damage first; only a still-active retaliator damaged by that event can answer with Hellish Rebuke.',
      'A legal Hellish Rebuke response requires the visible triggering creature within 60 feet, an unspent Reaction, and an available level-1 spell slot.',
      'The attacker makes the canonical Dexterity save before Fire Resistance or Immunity changes the retaliatory damage, and final damage can down the attacker.',
      'One event id can resolve only once; the remaining live damage-event-to-reaction prompt integration is reported explicitly instead of simulated by hidden UI state.'
    ]
  },
  {
    id: 'taunt_forced_targeting',
    label: 'Taunt & Forced Targeting',
    summary: 'Prove save-backed taunt application, turn-owned attacks, willing-movement restraint, source-owned forced movement, and source-linked cleanup.',
    proofFocus: 'Compelled Duel targeting and cost; turn owner; Action and roll/no-roll; normal versus disadvantaged d20; position and movement ledger; forced destination validation; source loss and Reset.',
    group: 'expanded',
    accent: 'amber',
    rules: [
      'The board reads Compelled Duel\'s live 30-foot range, line of sight, Wisdom save, Bonus Action, level-1 slot, one-minute duration, concentration, disadvantage, and leash facts.',
      'A valid successful save spends the cast but applies no restriction; forced-targeting immunity, out-of-range, Total Cover, and this arena\'s explicit hostile-only gate reject before payment or effect.',
      'The compelled creature can attack only on its live turn with an available Action: the Challenge Knight is a normal roll, the Protected Ally has Disadvantage, and off-turn or repeated attempts reject before any d20.',
      'Willing movement cannot cross the 30-foot leash, while a source-owned forced effect validates distance, bounds, blocking terrain, and occupancy before moving only the target without spending its movement.',
      'Expiry, exact removal, or a missing, downed, or Incapacitated source removes the targeting penalty and matching concentration without disturbing unrelated actor state.'
    ]
  },
  {
    id: 'companion_reactions',
    label: 'Companion Reactions',
    summary: 'Prove an owned companion can intercept damage to a nearby ally while keeping its Reaction economy independent from its owner.',
    proofFocus: 'Normal pre-damage discovery, stable hit claim, accept/decline, deterministic multi-responder selection, attacker sight, HP delta, independent Reaction ledgers, and actor-local reset.',
    group: 'expanded',
    accent: 'teal',
    rules: [
      'The guardian uses the existing controlled-ally ownership seam: its summon metadata names the Ranger Owner as caster/controller and keeps shared initiative placement explicit.',
      'Canonical Interception requires a distinct allied target within 5 feet, a weapon or shield, an active protector who can see the attacker, and that protector\'s unspent Reaction.',
      'A qualifying 14 Slashing hit is reduced by the deterministic 1d10 face 6 plus level-5 proficiency 3, so only 5 damage reaches the protected ally.',
      'Miss, zero damage, range, attacker sight, Incapacitated, equipment, feature, spent-Reaction, and non-hostile failures reject the reaction atomically while a valid hit still follows normal HP damage.',
      'Every hit has one stable claim. Eligible responders sort by initiative then id, the player selects one or declines, and duplicate delivery cannot prompt, reduce, pay, or damage twice.',
      'Starting an owner or protector turn resets only that actor; unselected protectors and the protected ally retain their independent economies.'
    ]
  }
];

// ============================================================================
// Lookup Helpers
// ============================================================================
// The runtime router calls this helper when it needs the active scenario record.
// Unknown ids fall back to cover so a malformed query or stale link still lands
// on a safe, existing board.
// ============================================================================

export function getPreviewCombatScenario(id: PreviewCombatScenarioId): PreviewCombatScenarioDefinition {
  return PREVIEW_COMBAT_SCENARIOS.find(scenario => scenario.id === id) ?? PREVIEW_COMBAT_SCENARIOS[0];
}
