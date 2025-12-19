# Level 2 Spell Migration - Combined Batches

**Scope:** All Level 2 spells migrated to structured schema, glossary, and manifest. Flat roots removed. Validator/integrity checks green.

## Batch 1
- Spells: aid; alter-self; animal-messenger; arcane-lock; augury  
- Notes: Aid +5 max/current HP to 3 targets (scales +5/slot); Alter Self (appearance reshape, natural weapon, or swim/breathe water, conc 1h); Animal Messenger ritual courier 25-50 mi/day, duration scales; Arcane Lock +10 DC lock with password/creature exception, 25 gp gold dust consumed; Augury ritual omen within 30 min (25 gp tokens consumed).

## Batch 2
- Spells: beast-sense; blindness-deafness; blur; calm-emotions; cloud-of-daggers; continual-flame; cordon-of-arrows; crown-of-madness; darkness; darkvision  
- Notes: Beast Sense ritual sensory link (action to swap senses, conc 1h); Blindness/Deafness Con save repeat each turn, scales +1 target; Blur gives attackers disadvantage unless they ignore sight; Calm Emotions (suppress charm/fear or force indifference, ends on harm); Cloud of Daggers 5-ft cube 4d4 slashing on enter/turn, scales +2d4/slot; Continual Flame permanent heatless torchlight, 50 gp ruby dust consumed; Cordon of Arrows ammo trap (ranged spell attack 1d6 per trigger, +2 ammo/slot); Crown of Madness charms, forces melee attack each turn, repeat Wis save end; Darkness 15-ft sphere blocks vision/nonmagical light, movable if on owned object; Darkvision 60 ft for 8h.

## Batch 3
- Spells: detect-thoughts; dragons-breath; enhance-ability; enlarge-reduce; enthrall; find-steed; find-traps; flame-blade; flaming-sphere; gentle-repose  
- Notes: Detect Thoughts surface read + action probe (Wis save end on success), blocked by materials; Dragon's Breath bonus action imbue 15-ft cone Dex save 3d6 chosen type, +1d6/slot; Enhance Ability six modes (adv checks, temp HP, no fall dmg, etc.), +1 target/slot; Enlarge/Reduce size ±1, Str checks/saves adv/disadv, weapon dmg ±1d4, repeat Con save end; Enthrall Perception disadvantage vs others while you speak, ends on harm; Find Steed persistent mount (form/type choice), share self-target spells; Find Traps senses presence/nature only, not trigger; Flame Blade bonus action conjure 3d6 fire melee spell attack, scales at slot 4/6; Flaming Sphere ram/end-turn Dex save 2d6 fire, +1d6/slot; Gentle Repose ritual 10 days vs decay/undeath, extends raise-dead window.

## Batch 4
- Spells: gust-of-wind; heat-metal; hold-person; invisibility; knock; lesser-restoration; levitate; locate-animals-or-plants; locate-object; magic-mouth  
- Notes: Gust of Wind 60x10 line Str save push 15 ft each turn, disperses gas/flames; Heat Metal initial + repeat bonus-action 2d8 fire, Con save to drop or suffer disadvantage on attacks/checks, +1d8/slot; Hold Person Wis save paralyze with end-of-turn saves, +1 humanoid/slot; Invisibility touch, ends on attack/spell, +1 target/slot; Knock audible 300 ft, unlocks or suppresses Arcane Lock 10 min (one lock); Lesser Restoration ends disease or blind/deaf/paralyze/poison; Levitate suspend up to 500 lb, adjust height 20 ft as action, Con save for unwilling; Locate Animals/Plants ritual sense nearest kind within 5 miles; Locate Object conc 10 min sense familiar/kind object within 1,000 ft unless lead blocks; Magic Mouth triggered spoken message, consumes 10 gp jade dust.

## Batch 5
- Spells: magic-weapon; melfs-acid-arrow; mind-spike; misty-step; moonbeam; pass-without-trace; phantasmal-force; prayer-of-healing; protection-from-poison; pyrotechnics  
- Notes: Magic Weapon conc +1 (slot 4th → +2, 6th → +3) attack/damage on touched weapon; Melf's Acid Arrow ranged attack 4d4 hit + 2d4 delayed, miss = half initial, both +1d4/slot; Mind Spike Wis save half 3d8 psychic, on fail know location for 1h, +1d8/slot; Misty Step bonus action teleport 30 ft; Moonbeam Con save 2d10 radiant on enter/turn start, shapechangers disadv/revert, +1d10/slot; Pass without Trace aura +10 Stealth, no nonmagical tracking, conc 1h; Phantasmal Force Int save or 10-ft illusion, Investigation ends, can deal 1d6 psychic/turn; Prayer of Healing 10-min cast heal up to 6 (2d8+mod, +1d8/slot), no effect on undead/constructs; Protection from Poison neutralize one poison, adv vs poison, resistance 1h; Pyrotechnics: fireworks Con save blind or smoke 20-ft cube heavily obscured; extinguishes source flame.

## Batch 6
- Spells: ray-of-enfeeblement; rope-trick; scorching-ray; see-invisibility; shatter; silence; skywrite; spider-climb; spike-growth; spiritual-weapon  
- Notes: Ray of Enfeeblement ranged attack halves Str-weapon dmg, Con save each turn to end, conc 1 min; Rope Trick 1h hidden extradimensional space via rope, holds 8 Medium, blocks spells/attacks through entrance; Scorching Ray three 2d6 fire rays (ranged spell attacks), +1 ray/slot; See Invisibility 1h see invisible + Ethereal; Shatter 10-ft sphere Con save 3d8 thunder (inorganic disadv), objects damaged, +1d8/slot; Silence ritual 20-ft sphere blocks sound, verbal casting, thunder dmg; Skywrite ritual 10 cloud-words visible up to 50 mi, dispersible by wind; Spider Climb conc 1h climb/ceiling, climb speed = walk; Spike Growth 20-ft damaging difficult terrain 2d4 per 5 ft moved, camouflaged; Spiritual Weapon bonus action force attack 1d8+mod, move 20 ft/BA, damage +1d8 every two slot levels.

## Batch 7 (Final)
- Spells: suggestion; warding-bond; web; zone-of-truth  
- Notes: Suggestion Wis save, immune if not charmable, follows reasonable course up to 8h, ends on harm; Warding Bond +1 AC/saves, resistance to all damage, caster takes mirrored damage within 60 ft (plat rings req); Web 20-ft cube difficult terrain, Dex save restrain with Str escape, flammable 2d4/turn burning cube; Zone of Truth Cha save or cannot speak lies in 15-ft sphere, caster knows saves.

## Commands Run (final)
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps
- None across Level 2 batches.
