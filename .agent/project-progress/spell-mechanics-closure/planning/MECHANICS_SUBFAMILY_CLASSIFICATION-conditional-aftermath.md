# Mechanics Subfamily Classification: conditional-aftermath

Status: planning aid
Generated: 2026-05-14T11:04:07.938Z
Source report: .agent\roadmap-local\spell-validation\spell-mechanics-discovery.json
Bucket filter: conditional_ending, aftermath_or_memory

This report groups currently open mechanics findings by candidate runtime shape. It is a planning aid only: batch owners must still read the canonical prose and confirm that every row in a subfamily is genuinely compatible before editing schema, templates, or spell data.

Open findings classified: 82
Candidate subfamilies: 14

## Summary

| Subfamily | Findings | Closure Rule |
| --- | ---: | --- |
| Choice, Mode, Or Option Branch | 17 | The spell exposes mode selection, option-specific targeting/effects, allocation choices, or player/caster branch choices. |
| External Destruction Or Dispel | 10 | A named external spell, dispel effect, object destruction, movement break, or trigger consumption destroys or ends the created effect. |
| AI Arbitration Or Custom Resolution | 8 | The finding likely cannot be captured with current deterministic schema without custom or AI-arbitrated handling. |
| Transfer, Retarget, Or Reassignment | 8 | An effect ends on one target, moves to another target, or can be reassigned while the spell remains active. |
| Duration Progression Or Permanence | 8 | Repeated casting, full-duration concentration, elapsed days, or slot level changes duration, permanence, or concentration requirements. |
| Summon, Control, Possession, Or Soul Lifecycle | 8 | Summoned, animated, controlled, possessed, or soul/container states need lifecycle data distinct from ordinary spell ending. |
| End Cleanup: Fall, Descent, Or Prone Outcome | 6 | A spell or effect ending causes falling, controlled descent, landing prone, or another end-position consequence. |
| End Cleanup: Space Or Passage Ejection | 6 | Spell-created spaces, passages, or containers end and move their contents to an exit, anchor, nearest space, or other explicit destination. |
| Delivery Failure, Cooldown, Or Availability | 4 | A spell can fail delivery, create a later casting block, enforce a cooldown, or depend on target/soul availability. |
| Vision, Light, Sound, Or Sensory | 2 | Light, sound, visibility, senses, cover, heat, or sensory emission/suppression needs runtime data. |
| Save Counter Or Recurring End | 2 | Recurring saves, counted successes/failures, branch outcomes, or escape checks end or transform an ongoing effect. |
| Sustain, Range, Cover, Or Upkeep | 1 | A later action, range requirement, total-cover condition, or upkeep failure ends the spell or effect. |
| Needs Manual Subfamily | 1 | No confident keyword match; classify manually before editing. |
| Illusion, Disguise, Or Reveal | 1 | Illusion/disguise behavior, reveal conditions, study actions, physical interaction, or apparent state needs runtime data. |

## Choice, Mode, Or Option Branch

The spell exposes mode selection, option-specific targeting/effects, allocation choices, or player/caster branch choices.

| Finding | Bucket | Issue | Recommended Template Change |
| --- | --- | --- | --- |
| `druidcraft::aftermath_or_memory` | `aftermath_or_memory` | Actionable open: Aftermath knowledge or later memory effects need a follow-up/aftermath schema. | Add aftermath/memory fields for post-spell knowledge and delayed consequences. |
| `elementalism::aftermath_or_memory` | `aftermath_or_memory` | Actionable open: Aftermath knowledge or later memory effects need a follow-up/aftermath schema. | Add aftermath/memory fields for post-spell knowledge and delayed consequences. |
| `friends::aftermath_or_memory` | `aftermath_or_memory` | Actionable open: Aftermath knowledge or later memory effects need a follow-up/aftermath schema. | Add aftermath/memory fields for post-spell knowledge and delayed consequences. |
| `calm-emotions::aftermath_or_memory` | `aftermath_or_memory` | When Calm Emotions ends, the creature's attitude returns to normal, but the restoration/aftermath state is not represented. | Add aftermath/restoration fields for temporary attitude changes. |
| `knock::conditional_ending` | `conditional_ending` | Arcane Lock suppression lasts 10 minutes while the spell itself is instantaneous; that temporary suppression duration is not modeled. | Add temporary suppression duration fields for other spell/effect suppression. |
| `mind-spike::conditional_ending` | `conditional_ending` | The tracking rider lasts until the spell ends but is only useful while both creatures are on the same plane; the same-plane limit is not modeled as an ongoing condition. | Add ongoing-condition fields for same-plane gating on duration-bound knowledge effects. |
| `haste::aftermath_or_memory` | `aftermath_or_memory` | Actionable open: Aftermath and memory effects need post-effect state fields. | Add aftermath/memory bucket fields. |
| `meld-into-stone::manual_leave_or_stone_damage_endings` | `conditional_ending` | Meld into Stone has several conditional endings and expulsion damage branches that are prose-only. | Add leaveCost, expulsion trigger, and branch damage fields. |
| `phantom-steed::aftermath_or_memory` | `aftermath_or_memory` | Actionable open: Aftermath and memory effects need post-effect state fields. | Add aftermath/memory bucket fields. |
| `control-water::conditional_ending` | `conditional_ending` | Each active mode lasts until the spell ends or the caster chooses a different effect, and Part Water then fills back over the next round; runtime lacks mode replacement and restoration timing. | Add mode-duration/replacement fields and restoration-after-mode fields. |
| `dream::conditional_ending` | `conditional_ending` | The messenger can emerge from the trance at any time to end the spell, and if the target is awake the messenger can end the trance/spell or wait for sleep; runtime lacks these ending choices. | Add dream ending choice fields. |
| `modify-memory::conditional_ending` | `conditional_ending` | Damage, another spell targeting the creature, or ending before the memory description is complete prevents memory alteration; runtime lacks those ending and success-condition branches. | Add memory modification conditional-ending fields. |
| `primordial-ward::conditional_ending` | `conditional_ending` | Using the reaction ends the resistances and then ends the spell at the end of the caster's next turn; runtime records this as utility options but lacks first-class conditional replacement/ending fields. | Add defense replacement and delayed conditional spell-end fields. |
| `tensers-transformation::conditional_ending` | `conditional_ending` | Cannot cast spells during the spell, temporary HP loss at end, and the exhaustion save immediately after ending are represented as options/status, but runtime lacks first-class spellcasting restriction and end-trigger aftermath fields. | Add spellcasting restriction, temporary-HP cleanup, and on-spell-end save fields. |
| `delayed-blast-fireball::conditional_ending` | `conditional_ending` | The bead explodes when the spell ends, when touch save fails, or when a thrown bead enters a creature space/collides with an object; runtime records this as options but lacks first-class object-triggered ending fields. | Add delayed projectile collision/touch/end triggers. |
| `dream-of-the-blue-veil::conditional_ending` | `conditional_ending` | Target-damage exclusion and caster-damage group cancellation are preserved in status aftermath and utility options, but runtime lacks first-class per-target cancellation versus caster-wide cancellation fields. | Add per-target and caster-wide cancellation fields for long-duration transport/setup spells. |
| `project-image::conditional_ending` | `conditional_ending` | The image disappears and the spell ends if it takes any damage; runtime preserves this in utility options but lacks a typed damage-to-illusion end trigger. | Add created illusion damage/end trigger fields. |

## External Destruction Or Dispel

A named external spell, dispel effect, object destruction, movement break, or trigger consumption destroys or ends the created effect.

| Finding | Bucket | Issue | Recommended Template Change |
| --- | --- | --- | --- |
| `dispel-magic::conditional_ending` | `conditional_ending` | Ongoing spells end automatically up to the cast slot level and end on successful checks above that level; runtime has no typed dispel/ending data. | Add dispel fields for auto-ended spell level threshold and checked spell level threshold. |
| `glyph-of-warding::conditional_ending` | `conditional_ending` | Glyph of Warding has movement-break and trigger-consumption ending rules that are not typed. | Add conditionalEnding fields for moved distance and one-shot trigger consumption. |
| `swift-quiver::conditional_ending` | `conditional_ending` | Runtime has the attack grant and ammunition creation, but lacks typed ending if the quiver leaves possession and disintegration of created ammunition when the spell ends. | Add possession-based ending and created-ammunition cleanup fields. |
| `swift-quiver::aftermath_or_memory` | `aftermath_or_memory` | Created ammunition disintegrates when the spell ends; runtime lacks typed cleanup/aftermath data. | Add created-object cleanup fields. |
| `drawmijs-instant-summons::conditional_ending` | `conditional_ending` | The spell ends when the object is summoned, and the runtime prose also notes Dispel Magic or similar effects on the sapphire end the spell; these ending conditions are not typed. | Add linked-token destruction/use and dispel-on-token ending fields. |
| `druid-grove::conditional_ending` | `conditional_ending` | Individual ward effects can be removed by Dispel Magic, the whole spell ends only when all effects are gone, and animated trees lose magic/reroot when the spell ends; runtime lacks these ending conditions. | Add per-subeffect dispel and guardian ending fields. |
| `magic-jar::aftermath_or_memory` | `aftermath_or_memory` | The container is destroyed when the spell ends; runtime lacks on-spell-end object destruction data. | Add on-spell-end object aftermath fields. |
| `soul-cage::conditional_ending` | `conditional_ending` | The spell ends when the cage is destroyed or after the sixth exploit releases the soul; runtime records this as options but lacks first-class use-count and object-destruction end triggers. | Add use-count and object-destruction ending fields. |
| `sequester::conditional_ending` | `conditional_ending` | Damage-ending and custom early-ending conditions are preserved in status break triggers and utility options, but runtime lacks arbitrary visible-within-1-mile ending condition fields. | Add custom conditional ending fields. |
| `symbol::conditional_ending` | `conditional_ending` | The glyph can end without triggering if moved too far, and triggered light lasts 10 minutes before the spell ends; runtime lacks first-class moved-too-far break and triggered-duration ending fields. | Add object movement break and triggered duration ending fields. |

## AI Arbitration Or Custom Resolution

The finding likely cannot be captured with current deterministic schema without custom or AI-arbitrated handling.

| Finding | Bucket | Issue | Recommended Template Change |
| --- | --- | --- | --- |
| `charm-person::aftermath_or_memory` | `aftermath_or_memory` | When Charm Person ends, the target knows it was Charmed by the caster; this aftermath knowledge is not structured. | Add aftermath awareness fields for target knowledge after spell end. |
| `fast-friends::aftermath_or_memory` | `aftermath_or_memory` | When the spell ends, the creature knows it was Charmed by the caster; runtime has no aftermath awareness field. | Add aftermath awareness fields for knows_charmed_by_caster. |
| `flame-arrows::conditional_ending` | `conditional_ending` | The extra damage is now hit-triggered, but per-ammunition magic ending on hit or miss, the twelve-piece draw limit, and +2 ammunition per higher slot remain prose-only. | Add empowered ammunition fields for count, hit-or-miss consumption, draw limit, and slot scaling. |
| `haste::aftermath_or_memory` | `aftermath_or_memory` | Haste's end-of-spell lethargy is a delayed aftermath effect that needs first-class spell-end timing. | Add aftermath fields for spell-end effects, status, movement override, and end timing. |
| `leomunds-tiny-hut::manual_cast_failure_if_not_encapsulating` | `conditional_ending` | Tiny Hut has a casting failure precondition based on whether the area fully encapsulates creatures. | Add castFailureCondition fields for area encapsulation requirements. |
| `charm-monster::aftermath_or_memory` | `aftermath_or_memory` | When the spell ends, the target knows it was Charmed by the caster; runtime lacks post-spell awareness/memory data. | Add aftermath/memory fields for target awareness after enchantments. |
| `immolation::aftermath_or_memory` | `aftermath_or_memory` | The target-to-ash death aftermath is mechanically relevant for corpse/object state but remains prose-only. | Add death aftermath transformation fields for spell-kill outcomes. |
| `tensers-transformation::aftermath_or_memory` | `aftermath_or_memory` | Temporary HP loss and possible Exhaustion after the spell ends are represented, but runtime lacks first-class aftermath trigger data. | Add on-spell-end aftermath fields. |

## Transfer, Retarget, Or Reassignment

An effect ends on one target, moves to another target, or can be reassigned while the spell remains active.

| Finding | Bucket | Issue | Recommended Template Change |
| --- | --- | --- | --- |
| `hex::conditional_ending` | `conditional_ending` | If the cursed target drops to 0 Hit Points before the spell ends, the caster can move the curse to a new creature with a later Bonus Action; this transfer rule is prose-only. | Add conditional transfer fields for trigger target_drops_to_0_hp, later bonus-action retargeting, and new creature target. |
| `hunters-mark::conditional_ending` | `conditional_ending` | If the marked target drops to 0 Hit Points before the spell ends, the caster can move the mark to a new visible creature with a Bonus Action; duration also scales at higher slots. | Add conditional transfer fields and duration scaling fields for Hunter's Mark. |
| `remove-curse::conditional_ending` | `conditional_ending` | Remove Curse ends ordinary curses and has a different cursed-magic-item branch that breaks attunement without ending the item curse. | Add curseRemoval and cursedMagicItem attunement-break fields. |
| `speak-with-dead::conditional_ending` | `conditional_ending` | Speak with Dead has a 10-day retarget failure and a five-question limit. | Add priorTargetCooldown and maxQuestions fields. |
| `geas::conditional_ending` | `conditional_ending` | The spell ends on suicidal commands and can be ended by specific spells; runtime lacks typed conditional ending fields for both cases. | Add conditional-ending fields for forbidden command endings and external spell removal. |
| `modify-memory::aftermath_or_memory` | `aftermath_or_memory` | The modified memory takes hold when the spell ends only if the description is complete; runtime lacks typed memory aftermath/finalization data. | Add memory finalization fields. |
| `eyebite::conditional_ending` | `conditional_ending` | Wake-on-damage/shake, Panicked distance-and-sight ending, and cannot-retarget-a-creature-that-succeeded-against-this-casting are preserved in descriptions but not first-class ending/state fields. | Add per-option ending and per-casting target-immunity fields. |
| `clone::aftermath_or_memory` | `aftermath_or_memory` | Actionable open: Clone exposes identity, memories, soul location, and revival lockout mechanics that need a dedicated life-state schema. | Add life-state/identity transfer fields for soul transfer, memory/personality continuity, equipment exclusion, and revival lockout. |

## Duration Progression Or Permanence

Repeated casting, full-duration concentration, elapsed days, or slot level changes duration, permanence, or concentration requirements.

| Finding | Bucket | Issue | Recommended Template Change |
| --- | --- | --- | --- |
| `animal-messenger::conditional_ending` | `conditional_ending` | If the Beast does not reach the destination before the spell ends, the message is lost and the Beast returns to the casting location; duration also scales by slot. | Add delivery failure and duration scaling fields. |
| `galders-tower::manual_recast_maintenance_and_permanent_tower` | `conditional_ending` | Galder's Tower has recast maintenance and a same-location/same-configuration permanence rule that are prose-only. | Add recastMaintenance and permanenceCondition fields. |
| `glyph-of-warding::conditional_ending` | `conditional_ending` | Actionable open: Some ending conditions are represented in prose/options but need reusable break-condition fields. | Add conditional-ending bucket fields. |
| `leomunds-secret-chest::conditional_ending` | `conditional_ending` | The spell has a cumulative 5 percent daily ending chance after 60 days, ends if cast again, and ends if the Tiny replica is destroyed; runtime preserves these only in prose. | Add conditional ending fields for delayed cumulative chance, recast ending, and linked-object destruction. |
| `summon-greater-demon::conditional_ending` | `conditional_ending` | Control can end on a successful Charisma save while the summoned demon remains, and an uncontrolled demon can linger for 1d6 rounds after concentration ends if it still has Hit Points; runtime lacks these ending branches. | Add summon control-ending and post-concentration linger fields. |
| `contagion::conditional_ending` | `conditional_ending` | The spell can end on the target after three repeat-save successes, last 7 days after three failures, and resist later Poisoned-ending effects unless another Constitution save succeeds; runtime lacks those ending branches. | Add conditional status/spell ending fields for counted saves and condition-removal resistance. |
| `infernal-calling::conditional_ending` | `conditional_ending` | The devil disappears at 0 hit points or spell end, but if concentration ends after command immunity it remains for 3d6 minutes; runtime lacks those branch endings. | Add summoned-entity conditional ending/aftermath fields. |
| `flesh-to-stone::conditional_ending` | `conditional_ending` | Three successful repeat saves end the spell, three failed saves convert the state to Petrified, and full-duration concentration changes the ending/removal behavior; runtime lacks those conditional ending fields. | Add save-count and concentration-completion ending fields. |

## Summon, Control, Possession, Or Soul Lifecycle

Summoned, animated, controlled, possessed, or soul/container states need lifecycle data distinct from ordinary spell ending.

| Finding | Bucket | Issue | Recommended Template Change |
| --- | --- | --- | --- |
| `phantom-steed::aftermath_or_memory` | `aftermath_or_memory` | The one-minute dismount grace after the spell ends is not represented. | Add spell-end aftermath fields for summoned mount fade and dismount grace. |
| `summon-lesser-demons::conditional_ending` | `conditional_ending` | Actionable open: Some ending conditions are represented in prose/options but need reusable break-condition fields. | Add conditional-ending bucket fields. |
| `summon-lesser-demons::conditional_ending` | `conditional_ending` | Summon lifecycle endings and optional material consumption at spell end are not represented. | Add summon lifecycle and conditional component consumption fields. |
| `danse-macabre::conditional_ending` | `conditional_ending` | The created undead remain under control until the spell ends, then become inanimate; runtime lacks spell-end reversion/lifecycle data. | Add animated creature lifecycle ending fields. |
| `infernal-calling::aftermath_or_memory` | `aftermath_or_memory` | If concentration ends after command immunity, the devil acts freely for 3d6 minutes before disappearing; runtime lacks post-concentration aftermath behavior. | Add summon aftermath fields for post-control independent behavior and delayed disappearance. |
| `planar-binding::conditional_ending` | `conditional_ending` | Completion before spell end changes the creature's behavior, and another summon/creation spell's duration can be extended to match Planar Binding; runtime lacks those conditional duration/ending branches. | Add bound-service completion and linked-spell duration-extension fields. |
| `reincarnate::conditional_ending` | `conditional_ending` | The spell fails if the soul is not free or willing; runtime lacks this failure condition. | Add soul availability failure fields. |
| `druid-grove::aftermath_or_memory` | `aftermath_or_memory` | When the spell ends, animated trees take root again if possible; runtime lacks this aftermath state. | Add guardian reroot aftermath fields. |

## End Cleanup: Fall, Descent, Or Prone Outcome

A spell or effect ending causes falling, controlled descent, landing prone, or another end-position consequence.

| Finding | Bucket | Issue | Recommended Template Change |
| --- | --- | --- | --- |
| `levitate::aftermath_or_memory` | `aftermath_or_memory` | The gentle float to the ground after the spell ends is an aftermath behavior rather than ordinary duration text. | Add aftermath behavior fields for movement effects. |
| `watery-sphere::aftermath_or_memory` | `aftermath_or_memory` | After the spell ends, restrained creatures are left prone where the sphere falls and normal flames within 30 feet have been extinguished; runtime lacks typed post-end state outcomes. | Add aftermath fields for spell-end prone placement and extinguished normal flames. |
| `telekinesis::conditional_ending` | `conditional_ending` | Switching targets ends the previous target's effect and a lifted creature falls unless reapplied; runtime lacks these ending conditions. | Add target-switch and reapply-or-fall ending fields. |
| `wall-of-stone::aftermath_or_memory` | `aftermath_or_memory` | The post-duration permanent wall, non-dispellable state, disappearance fallback, and possible panel-collapse aftermath are not typed. | Add structure aftermath fields. |
| `magic-jar::conditional_ending` | `conditional_ending` | Soul return, caster death, host death, body distance, body dead, and container destruction outcomes are too specific for current duration fields. | Add conditional spell-ending and soul-return outcome fields. |
| `wind-walk::conditional_ending` | `conditional_ending` | Reverting to cloud form and the end-of-effect safe descent/fall sequence are represented as utility options but need first-class transformation and on-end movement consequence fields. | Add transformation state and on-spell-end descent/fall fields. |

## End Cleanup: Space Or Passage Ejection

Spell-created spaces, passages, or containers end and move their contents to an exit, anchor, nearest space, or other explicit destination.

| Finding | Bucket | Issue | Recommended Template Change |
| --- | --- | --- | --- |
| `banishment::conditional_ending` | `conditional_ending` | Aberration, Celestial, Elemental, Fey, and Fiend targets do not return if the spell lasts for 1 minute; runtime has no typed duration-completion branch by creature type. | Add conditional ending fields for no-return-on-full-duration with creature-type filters. |
| `banishment::aftermath_or_memory` | `aftermath_or_memory` | When the spell ends, the target reappears in its original space or nearest unoccupied space, unless the creature-type full-duration branch prevents return; runtime lacks return placement. | Add post-spell return placement fields for original space and nearest unoccupied fallback. |
| `watery-sphere::conditional_ending` | `conditional_ending` | The spell-end sequence makes the sphere fall, extinguishes normal flames within 30 feet, knocks restrained creatures prone where it falls, and then makes the water vanish; runtime lacks typed spell-end cleanup sequence fields. | Add ordered spell-end cleanup fields for created areas with occupant and environmental effects. |
| `banishing-smite::conditional_ending` | `conditional_ending` | When the spell ends, the target reappears in its original space or nearest unoccupied fallback; runtime lacks typed spell-end return placement. | Add spell-end return placement fields for banishment effects. |
| `banishing-smite::aftermath_or_memory` | `aftermath_or_memory` | The spell-end return leaves the target in its original or nearest unoccupied space, but runtime lacks typed post-effect placement state. | Add aftermath placement fields for post-banishment return. |
| `investiture-of-stone::conditional_ending` | `conditional_ending` | The ordinary 'Until the spell ends' duration is represented, but the special ending when the caster ends movement inside earth or stone is only described in prose. | Add conditional spell-ending triggers tied to invalid end positions. |

## Delivery Failure, Cooldown, Or Availability

A spell can fail delivery, create a later casting block, enforce a cooldown, or depend on target/soul availability.

| Finding | Bucket | Issue | Recommended Template Change |
| --- | --- | --- | --- |
| `detect-thoughts::conditional_ending` | `conditional_ending` | Detect Thoughts can end on successful Wisdom save against deeper probe or on a target's action Intelligence (Arcana) check while attention remains shifted; only prose carries the Arcana escape and attention condition. | Add conditional-ending and escape-check fields for successful probe save, target Arcana action, and shift-attention-away condition. |
| `sending::conditional_ending` | `conditional_ending` | Sending has delivery failure and recipient-created block conditions that can cause later casts to fail. | Add delivery failure and recipient block/cooldown fields. |
| `antilife-shell::conditional_ending` | `conditional_ending` | If caster movement would force an affected creature through the barrier, the spell ends; runtime lacks movement-forced early-ending fields. | Add aura early-ending fields tied to caster movement forcing blocked creatures through the barrier. |
| `wall-of-light::conditional_ending` | `conditional_ending` | Beam use reduces the wall length by 10 feet whether the attack hits or misses, and the spell ends when the length reaches 0 feet; runtime lacks this ending condition. | Add mutable dimension and zero-length ending fields. |

## Vision, Light, Sound, Or Sensory

Light, sound, visibility, senses, cover, heat, or sensory emission/suppression needs runtime data.

| Finding | Bucket | Issue | Recommended Template Change |
| --- | --- | --- | --- |
| `sickening-radiance::conditional_ending` | `conditional_ending` | The spell explicitly removes the emitted light and any Exhaustion levels it caused when the spell ends, but runtime lacks typed cleanup of caused conditions/riders. | Add spell-end cleanup fields for caused conditions and light riders. |
| `conjure-celestial::conditional_ending` | `conditional_ending` | Moving the Cylinder when the caster moves and applying effects when creatures enter/end turn/move into it are represented, but runtime lacks first-class moving area and once-per-turn affected tracking. | Add moving area and once-per-turn affected fields. |

## Save Counter Or Recurring End

Recurring saves, counted successes/failures, branch outcomes, or escape checks end or transform an ongoing effect.

| Finding | Bucket | Issue | Recommended Template Change |
| --- | --- | --- | --- |
| `immolation::conditional_ending` | `conditional_ending` | Runtime represents successful repeat save ending, but it still lacks typed data for the flames being impossible to extinguish by nonmagical means. | Add extinguishability or ending-prevention fields for magical ongoing effects. |
| `power-word-pain::conditional_ending` | `conditional_ending` | The pain ends on a successful end-of-turn Constitution save, but runtime currently stores that in status aftermath/utility options rather than a typed recurring end condition. | Add recurring save end-condition fields. |

## Sustain, Range, Cover, Or Upkeep

A later action, range requirement, total-cover condition, or upkeep failure ends the spell or effect.

| Finding | Bucket | Issue | Recommended Template Change |
| --- | --- | --- | --- |
| `enervation::conditional_ending` | `conditional_ending` | The spell ends on successful initial save, on caster using an action for anything else, when target leaves range, or when target has total cover; runtime lacks these branch and ending conditions. | Add branch-ending and sustain-ending fields for save success, action use, range loss, and total cover. |

## Needs Manual Subfamily

No confident keyword match; classify manually before editing.

| Finding | Bucket | Issue | Recommended Template Change |
| --- | --- | --- | --- |
| `negative-energy-flood::aftermath_or_memory` | `aftermath_or_memory` | The target's death aftermath happens at the start of the caster's next turn and needs a typed aftermath/timing surface. | Add start-of-next-turn death aftermath fields. |

## Illusion, Disguise, Or Reveal

Illusion/disguise behavior, reveal conditions, study actions, physical interaction, or apparent state needs runtime data.

| Finding | Bucket | Issue | Recommended Template Change |
| --- | --- | --- | --- |
| `mental-prison::conditional_ending` | `conditional_ending` | The spell ends on successful initial save and after breach-trigger damage; runtime records the damage but lacks first-class conditional spell-ending triggers. | Add conditional spell-ending triggers for save success and breach events. |
