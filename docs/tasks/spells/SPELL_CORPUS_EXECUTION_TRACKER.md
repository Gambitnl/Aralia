# Spell Corpus Execution Tracker

Generated: 2026-03-29T22:23:22.548Z
Total Spells In Corpus: 459

This tracker is the corpus-wide execution surface for the spell-truth lane.

## Status Note

This file is now best read as the historical corpus inventory plus the original
level-by-level execution scaffold.

Last reviewed: `2026-04-09`

It is not the current truth surface for spell completion state anymore.
The live spell-truth state now lives in:
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_TRACKER.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_FLAGS.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_DESCRIPTION_SUBBUCKET_REPORT.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_HIGHER_LEVEL_DESCRIPTION_COVERAGE_REPORT.md`

Reason:
- canonical retrieval is complete
- the manual structured/canonical sync lane has already happened
- the active remaining work is now review of residue buckets and runtime JSON lag,
  not checking these per-spell boxes one by one

A spell should only be checked off when its current intended review scope is complete. For now, that means the checkbox is a strict gate rather than a loose progress marker.

## Execution Plan

1. Run corpus-wide structural validation and keep it green.
2. Review spells level by level so the corpus can be completed end-to-end without losing track of coverage.
3. For each spell, verify canon-facing top-level facts first, then preserve JSON/markdown alignment.
4. Surface grouped mismatches for arbitration instead of silently inventing fixes.
5. Check a spell off only when the current review scope for that spell is complete.

## Completion Rule

- `[ ]` means the spell still needs corpus-lane review or still has unresolved spell-truth work.
- `[x]` means the spell has completed the current intended spell-truth review scope and should not re-enter the queue unless a new mismatch is discovered later.

## Spell Checklist

### Level 0 (43)

- [ ] Acid Splash `level-0/acid-splash`
- [ ] Blade Ward `level-0/blade-ward`
- [ ] Booming Blade `level-0/booming-blade`
- [ ] Chill Touch `level-0/chill-touch`
- [ ] Create Bonfire `level-0/create-bonfire`
- [ ] Dancing Lights `level-0/dancing-lights`
- [ ] Druidcraft `level-0/druidcraft`
- [ ] Eldritch Blast `level-0/eldritch-blast`
- [ ] Elementalism `level-0/elementalism`
- [ ] Fire Bolt `level-0/fire-bolt`
- [ ] Friends `level-0/friends`
- [ ] Frostbite `level-0/frostbite`
- [ ] Green-Flame Blade `level-0/green-flame-blade`
- [ ] Guidance `level-0/guidance`
- [ ] Light `level-0/light`
- [ ] Lightning Lure `level-0/lightning-lure`
- [ ] Mage Hand `level-0/mage-hand`
- [ ] Magic Stone `level-0/magic-stone`
- [ ] Mending `level-0/mending`
- [ ] Message `level-0/message`
- [ ] Mind Sliver `level-0/mind-sliver`
- [ ] Minor Illusion `level-0/minor-illusion`
- [ ] Mold Earth `level-0/mold-earth`
- [ ] Poison Spray `level-0/poison-spray`
- [ ] Prestidigitation `level-0/prestidigitation`
- [ ] Primal Savagery `level-0/primal-savagery`
- [ ] Produce Flame `level-0/produce-flame`
- [ ] Ray of Frost `level-0/ray-of-frost`
- [ ] Resistance `level-0/resistance`
- [ ] Sacred Flame `level-0/sacred-flame`
- [ ] Shape Water `level-0/shape-water`
- [ ] Shillelagh `level-0/shillelagh`
- [ ] Shocking Grasp `level-0/shocking-grasp`
- [ ] Spare the Dying `level-0/spare-the-dying`
- [ ] Starry Wisp `level-0/starry-wisp`
- [ ] Sword Burst `level-0/sword-burst`
- [ ] Thaumaturgy `level-0/thaumaturgy`
- [ ] Thorn Whip `level-0/thorn-whip`
- [ ] Thunderclap `level-0/thunderclap`
- [ ] Toll the Dead `level-0/toll-the-dead`
- [ ] True Strike `level-0/true-strike`
- [ ] Vicious Mockery `level-0/vicious-mockery`
- [ ] Word of Radiance `level-0/word-of-radiance`

### Level 1 (68)

- [ ] Absorb Elements `level-1/absorb-elements`
- [ ] Alarm `level-1/alarm`
- [ ] Animal Friendship `level-1/animal-friendship`
- [ ] Armor of Agathys `level-1/armor-of-agathys`
- [ ] Arms of Hadar `level-1/arms-of-hadar`
- [ ] Bane `level-1/bane`
- [ ] Bless `level-1/bless`
- [ ] Burning Hands `level-1/burning-hands`
- [ ] Catapult `level-1/catapult`
- [ ] Charm Person `level-1/charm-person`
- [ ] Chromatic Orb `level-1/chromatic-orb`
- [ ] Color Spray `level-1/color-spray`
- [ ] Command `level-1/command`
- [ ] Compelled Duel `level-1/compelled-duel`
- [ ] Comprehend Languages `level-1/comprehend-languages`
- [ ] Create or Destroy Water `level-1/create-or-destroy-water`
- [ ] Cure Wounds `level-1/cure-wounds`
- [ ] Detect Evil and Good `level-1/detect-evil-and-good`
- [ ] Detect Magic `level-1/detect-magic`
- [ ] Detect Poison and Disease `level-1/detect-poison-and-disease`
- [ ] Disguise Self `level-1/disguise-self`
- [ ] Dissonant Whispers `level-1/dissonant-whispers`
- [ ] Divine Favor `level-1/divine-favor`
- [ ] Divine Smite `level-1/divine-smite`
- [ ] Ensnaring Strike `level-1/ensnaring-strike`
- [ ] Entangle `level-1/entangle`
- [ ] Expeditious Retreat `level-1/expeditious-retreat`
- [ ] Faerie Fire `level-1/faerie-fire`
- [ ] False Life `level-1/false-life`
- [ ] Feather Fall `level-1/feather-fall`
- [ ] Find Familiar `level-1/find-familiar`
- [ ] Fog Cloud `level-1/fog-cloud`
- [ ] Goodberry `level-1/goodberry`
- [ ] Grease `level-1/grease`
- [ ] Guiding Bolt `level-1/guiding-bolt`
- [ ] Hail of Thorns `level-1/hail-of-thorns`
- [ ] Healing Word `level-1/healing-word`
- [ ] Hellish Rebuke `level-1/hellish-rebuke`
- [ ] Heroism `level-1/heroism`
- [ ] Hex `level-1/hex`
- [ ] Hunter's Mark `level-1/hunters-mark`
- [ ] Ice Knife `level-1/ice-knife`
- [ ] Identify `level-1/identify`
- [ ] Illusory Script `level-1/illusory-script`
- [ ] Inflict Wounds `level-1/inflict-wounds`
- [ ] Jump `level-1/jump`
- [ ] Longstrider `level-1/longstrider`
- [ ] Mage Armor `level-1/mage-armor`
- [ ] Magic Missile `level-1/magic-missile`
- [ ] Protection from Evil and Good `level-1/protection-from-evil-and-good`
- [ ] Purify Food and Drink `level-1/purify-food-and-drink`
- [ ] Ray of Sickness `level-1/ray-of-sickness`
- [ ] Sanctuary `level-1/sanctuary`
- [ ] Searing Smite `level-1/searing-smite`
- [ ] Shield of Faith `level-1/shield-of-faith`
- [ ] Shield `level-1/shield`
- [ ] Silent Image `level-1/silent-image`
- [ ] Sleep `level-1/sleep`
- [ ] Snare `level-1/snare`
- [ ] Speak with Animals `level-1/speak-with-animals`
- [ ] Tasha's Caustic Brew `level-1/tashas-caustic-brew`
- [ ] Tasha's Hideous Laughter `level-1/tashas-hideous-laughter`
- [ ] Tenser's Floating Disk `level-1/tensers-floating-disk`
- [ ] Thunderous Smite `level-1/thunderous-smite`
- [ ] Thunderwave `level-1/thunderwave`
- [ ] Unseen Servant `level-1/unseen-servant`
- [ ] Witch Bolt `level-1/witch-bolt`
- [ ] Wrathful Smite `level-1/wrathful-smite`

### Level 2 (65)

- [ ] Aid `level-2/aid`
- [ ] Alter Self `level-2/alter-self`
- [ ] Animal Messenger `level-2/animal-messenger`
- [ ] Arcane Lock `level-2/arcane-lock`
- [ ] Arcane Vigor `level-2/arcane-vigor`
- [ ] Augury `level-2/augury`
- [ ] Barkskin `level-2/barkskin`
- [ ] Beast Sense `level-2/beast-sense`
- [ ] Blindness/Deafness `level-2/blindness-deafness`
- [ ] Blur `level-2/blur`
- [ ] Calm Emotions `level-2/calm-emotions`
- [ ] Cloud of Daggers `level-2/cloud-of-daggers`
- [ ] Continual Flame `level-2/continual-flame`
- [ ] Cordon of Arrows `level-2/cordon-of-arrows`
- [ ] Crown of Madness `level-2/crown-of-madness`
- [ ] Darkness `level-2/darkness`
- [ ] Darkvision `level-2/darkvision`
- [ ] Detect Thoughts `level-2/detect-thoughts`
- [ ] Dragon's Breath `level-2/dragons-breath`
- [ ] Enhance Ability `level-2/enhance-ability`
- [ ] Enlarge/Reduce `level-2/enlarge-reduce`
- [ ] Enthrall `level-2/enthrall`
- [ ] Find Steed `level-2/find-steed`
- [ ] Find Traps `level-2/find-traps`
- [ ] Flame Blade `level-2/flame-blade`
- [ ] Flaming Sphere `level-2/flaming-sphere`
- [ ] Gentle Repose `level-2/gentle-repose`
- [ ] Gust of Wind `level-2/gust-of-wind`
- [ ] Heat Metal `level-2/heat-metal`
- [ ] Hold Person `level-2/hold-person`
- [ ] Invisibility `level-2/invisibility`
- [ ] Knock `level-2/knock`
- [ ] Lesser Restoration `level-2/lesser-restoration`
- [ ] Levitate `level-2/levitate`
- [ ] Locate Animals or Plants `level-2/locate-animals-or-plants`
- [ ] Locate Object `level-2/locate-object`
- [ ] Magic Mouth `level-2/magic-mouth`
- [ ] Magic Weapon `level-2/magic-weapon`
- [ ] Melf's Acid Arrow `level-2/melfs-acid-arrow`
- [ ] Mind Spike `level-2/mind-spike`
- [ ] Mirror Image `level-2/mirror-image`
- [ ] Misty Step `level-2/misty-step`
- [ ] Moonbeam `level-2/moonbeam`
- [ ] Nystul's Magic Aura `level-2/nystuls-magic-aura`
- [ ] Pass without Trace `level-2/pass-without-trace`
- [ ] Phantasmal Force `level-2/phantasmal-force`
- [ ] Prayer of Healing `level-2/prayer-of-healing`
- [ ] Protection from Poison `level-2/protection-from-poison`
- [ ] Pyrotechnics `level-2/pyrotechnics`
- [ ] Ray of Enfeeblement `level-2/ray-of-enfeeblement`
- [ ] Rope Trick `level-2/rope-trick`
- [ ] Scorching Ray `level-2/scorching-ray`
- [ ] See Invisibility `level-2/see-invisibility`
- [ ] Shatter `level-2/shatter`
- [ ] Shining Smite `level-2/shining-smite`
- [ ] Silence `level-2/silence`
- [ ] Skywrite `level-2/skywrite`
- [ ] Spider Climb `level-2/spider-climb`
- [ ] Spike Growth `level-2/spike-growth`
- [ ] Spiritual Weapon `level-2/spiritual-weapon`
- [ ] Suggestion `level-2/suggestion`
- [ ] Summon Beast `level-2/summon-beast`
- [ ] Warding Bond `level-2/warding-bond`
- [ ] Web `level-2/web`
- [ ] Zone of Truth `level-2/zone-of-truth`

### Level 3 (67)

- [ ] Animate Dead `level-3/animate-dead`
- [ ] Aura of Vitality `level-3/aura-of-vitality`
- [ ] Beacon of Hope `level-3/beacon-of-hope`
- [ ] Bestow Curse `level-3/bestow-curse`
- [ ] Blinding Smite `level-3/blinding-smite`
- [ ] Blink `level-3/blink`
- [ ] Call Lightning `level-3/call-lightning`
- [ ] Catnap `level-3/catnap`
- [ ] Clairvoyance `level-3/clairvoyance`
- [ ] Conjure Animals `level-3/conjure-animals`
- [ ] Conjure Barrage `level-3/conjure-barrage`
- [ ] Counterspell `level-3/counterspell`
- [ ] Create Food and Water `level-3/create-food-and-water`
- [ ] Crusader's Mantle `level-3/crusaders-mantle`
- [ ] Daylight `level-3/daylight`
- [ ] Dispel Magic `level-3/dispel-magic`
- [ ] Elemental Weapon `level-3/elemental-weapon`
- [ ] Enemies Abound `level-3/enemies-abound`
- [ ] Erupting Earth `level-3/erupting-earth`
- [ ] Fast Friends `level-3/fast-friends`
- [ ] Fear `level-3/fear`
- [ ] Feign Death `level-3/feign-death`
- [ ] Fireball `level-3/fireball`
- [ ] Flame Arrows `level-3/flame-arrows`
- [ ] Fly `level-3/fly`
- [ ] Galder's Tower `level-3/galders-tower`
- [ ] Gaseous Form `level-3/gaseous-form`
- [ ] Glyph of Warding `level-3/glyph-of-warding`
- [ ] Haste `level-3/haste`
- [ ] Hunger of Hadar `level-3/hunger-of-hadar`
- [ ] Hypnotic Pattern `level-3/hypnotic-pattern`
- [ ] Incite Greed `level-3/incite-greed`
- [ ] Intellect Fortress `level-3/intellect-fortress`
- [ ] Leomund's Tiny Hut `level-3/leomunds-tiny-hut`
- [ ] Life Transference `level-3/life-transference`
- [ ] Lightning Arrow `level-3/lightning-arrow`
- [ ] Lightning Bolt `level-3/lightning-bolt`
- [ ] Magic Circle `level-3/magic-circle`
- [ ] Major Image `level-3/major-image`
- [ ] Mass Healing Word `level-3/mass-healing-word`
- [ ] Meld into Stone `level-3/meld-into-stone`
- [ ] Melf's Minute Meteors `level-3/melfs-minute-meteors`
- [ ] Motivational Speech `level-3/motivational-speech`
- [ ] Nondetection `level-3/nondetection`
- [ ] Phantom Steed `level-3/phantom-steed`
- [ ] Plant Growth `level-3/plant-growth`
- [ ] Protection from Energy `level-3/protection-from-energy`
- [ ] Remove Curse `level-3/remove-curse`
- [ ] Revivify `level-3/revivify`
- [ ] Sending `level-3/sending`
- [ ] Sleet Storm `level-3/sleet-storm`
- [ ] Slow `level-3/slow`
- [ ] Speak with Dead `level-3/speak-with-dead`
- [ ] Speak with Plants `level-3/speak-with-plants`
- [ ] Spirit Guardians `level-3/spirit-guardians`
- [ ] Stinking Cloud `level-3/stinking-cloud`
- [ ] Summon Lesser Demons `level-3/summon-lesser-demons`
- [ ] Thunder Step `level-3/thunder-step`
- [ ] Tidal Wave `level-3/tidal-wave`
- [ ] Tiny Servant `level-3/tiny-servant`
- [ ] Tongues `level-3/tongues`
- [ ] Vampiric Touch `level-3/vampiric-touch`
- [ ] Wall of Sand `level-3/wall-of-sand`
- [ ] Wall of Water `level-3/wall-of-water`
- [ ] Water Breathing `level-3/water-breathing`
- [ ] Water Walk `level-3/water-walk`
- [ ] Wind Wall `level-3/wind-wall`

### Level 4 (46)

- [ ] Arcane Eye `level-4/arcane-eye`
- [ ] Aura of Life `level-4/aura-of-life`
- [ ] Aura of Purity `level-4/aura-of-purity`
- [ ] Banishment `level-4/banishment`
- [ ] Blight `level-4/blight`
- [ ] Charm Monster `level-4/charm-monster`
- [ ] Compulsion `level-4/compulsion`
- [ ] Confusion `level-4/confusion`
- [ ] Conjure Minor Elementals `level-4/conjure-minor-elementals`
- [ ] Conjure Woodland Beings `level-4/conjure-woodland-beings`
- [ ] Control Water `level-4/control-water`
- [ ] Death Ward `level-4/death-ward`
- [ ] Dimension Door `level-4/dimension-door`
- [ ] Divination `level-4/divination`
- [ ] Dominate Beast `level-4/dominate-beast`
- [ ] Elemental Bane `level-4/elemental-bane`
- [ ] Evard's Black Tentacles `level-4/evards-black-tentacles`
- [ ] Fabricate `level-4/fabricate`
- [ ] Find Greater Steed `level-4/find-greater-steed`
- [ ] Fire Shield `level-4/fire-shield`
- [ ] Freedom of Movement `level-4/freedom-of-movement`
- [ ] Galders Speedy Courier `level-4/galders-speedy-courier`
- [ ] Giant Insect `level-4/giant-insect`
- [ ] Grasping Vine `level-4/grasping-vine`
- [ ] Greater Invisibility `level-4/greater-invisibility`
- [ ] Guardian of Faith `level-4/guardian-of-faith`
- [ ] Guardian Of Nature `level-4/guardian-of-nature`
- [ ] Hallucinatory Terrain `level-4/hallucinatory-terrain`
- [ ] Ice Storm `level-4/ice-storm`
- [ ] Leomund's Secret Chest `level-4/leomunds-secret-chest`
- [ ] Locate Creature `level-4/locate-creature`
- [ ] Mordenkainen's Faithful Hound `level-4/mordenkainens-faithful-hound`
- [ ] Mordenkainen's Private Sanctum `level-4/mordenkainens-private-sanctum`
- [ ] Otiluke's Resilient Sphere `level-4/otilukes-resilient-sphere`
- [ ] Phantasmal Killer `level-4/phantasmal-killer`
- [ ] Polymorph `level-4/polymorph`
- [ ] Shadow Of Moil `level-4/shadow-of-moil`
- [ ] Sickening Radiance `level-4/sickening-radiance`
- [ ] Staggering Smite `level-4/staggering-smite`
- [ ] Stone Shape `level-4/stone-shape`
- [ ] Stoneskin `level-4/stoneskin`
- [ ] Storm Sphere `level-4/storm-sphere`
- [ ] Summon Greater Demon `level-4/summon-greater-demon`
- [ ] Vitriolic Sphere `level-4/vitriolic-sphere`
- [ ] Wall of Fire `level-4/wall-of-fire`
- [ ] Watery Sphere `level-4/watery-sphere`

### Level 5 (58)

- [ ] Animate Objects `level-5/animate-objects`
- [ ] Antilife Shell `level-5/antilife-shell`
- [ ] Awaken `level-5/awaken`
- [ ] Banishing Smite `level-5/banishing-smite`
- [ ] Bigby's Hand `level-5/bigbys-hand`
- [ ] Circle of Power `level-5/circle-of-power`
- [ ] Cloudkill `level-5/cloudkill`
- [ ] Commune with Nature `level-5/commune-with-nature`
- [ ] Commune `level-5/commune`
- [ ] Cone of Cold `level-5/cone-of-cold`
- [ ] Conjure Elemental `level-5/conjure-elemental`
- [ ] Conjure Volley `level-5/conjure-volley`
- [ ] Contact Other Plane `level-5/contact-other-plane`
- [ ] Contagion `level-5/contagion`
- [ ] Control Winds `level-5/control-winds`
- [ ] Creation `level-5/creation`
- [ ] Danse Macabre `level-5/danse-macabre`
- [ ] Dawn `level-5/dawn`
- [ ] Destructive Wave `level-5/destructive-wave`
- [ ] Dispel Evil and Good `level-5/dispel-evil-and-good`
- [ ] Dominate Person `level-5/dominate-person`
- [ ] Dream `level-5/dream`
- [ ] Enervation `level-5/enervation`
- [ ] Far Step `level-5/far-step`
- [ ] Flame Strike `level-5/flame-strike`
- [ ] Geas `level-5/geas`
- [ ] Greater Restoration `level-5/greater-restoration`
- [ ] Hallow `level-5/hallow`
- [ ] Hold Monster `level-5/hold-monster`
- [ ] Holy Weapon `level-5/holy-weapon`
- [ ] Immolation `level-5/immolation`
- [ ] Infernal Calling `level-5/infernal-calling`
- [ ] Insect Plague `level-5/insect-plague`
- [ ] Legend Lore `level-5/legend-lore`
- [ ] Maelstrom `level-5/maelstrom`
- [ ] Mass Cure Wounds `level-5/mass-cure-wounds`
- [ ] Mislead `level-5/mislead`
- [ ] Modify Memory `level-5/modify-memory`
- [ ] Negative Energy Flood `level-5/negative-energy-flood`
- [ ] Passwall `level-5/passwall`
- [ ] Planar Binding `level-5/planar-binding`
- [ ] Raise Dead `level-5/raise-dead`
- [ ] Rary's Telepathic Bond `level-5/rarys-telepathic-bond`
- [ ] Reincarnate `level-5/reincarnate`
- [ ] Scrying `level-5/scrying`
- [ ] Seeming `level-5/seeming`
- [ ] Skill Empowerment `level-5/skill-empowerment`
- [ ] Steel Wind Strike `level-5/steel-wind-strike`
- [ ] Swift Quiver `level-5/swift-quiver`
- [ ] Synaptic Static `level-5/synaptic-static`
- [ ] Telekinesis `level-5/telekinesis`
- [ ] Teleportation Circle `level-5/teleportation-circle`
- [ ] Transmute Rock `level-5/transmute-rock`
- [ ] Tree Stride `level-5/tree-stride`
- [ ] Wall of Force `level-5/wall-of-force`
- [ ] Wall of Light `level-5/wall-of-light`
- [ ] Wall of Stone `level-5/wall-of-stone`
- [ ] Wrath of Nature `level-5/wrath-of-nature`

### Level 6 (44)

- [ ] Arcane Gate `level-6/arcane-gate`
- [ ] Blade Barrier `level-6/blade-barrier`
- [ ] Bones of the Earth `level-6/bones-of-the-earth`
- [ ] Chain Lightning `level-6/chain-lightning`
- [ ] Circle of Death `level-6/circle-of-death`
- [ ] Conjure Fey `level-6/conjure-fey`
- [ ] Contingency `level-6/contingency`
- [ ] Create Homunculus `level-6/create-homunculus`
- [ ] Create Undead `level-6/create-undead`
- [ ] Disintegrate `level-6/disintegrate`
- [ ] Drawmij's Instant Summons `level-6/drawmijs-instant-summons`
- [ ] Druid Grove `level-6/druid-grove`
- [ ] Eyebite `level-6/eyebite`
- [ ] Find the Path `level-6/find-the-path`
- [ ] Flesh to Stone `level-6/flesh-to-stone`
- [ ] Forbiddance `level-6/forbiddance`
- [ ] Globe of Invulnerability `level-6/globe-of-invulnerability`
- [ ] Guards and Wards `level-6/guards-and-wards`
- [ ] Harm `level-6/harm`
- [ ] Heal `level-6/heal`
- [ ] Heroes' Feast `level-6/heroes-feast`
- [ ] Investiture of Flame `level-6/investiture-of-flame`
- [ ] Investiture of Ice `level-6/investiture-of-ice`
- [ ] Investiture of Stone `level-6/investiture-of-stone`
- [ ] Investiture of Wind `level-6/investiture-of-wind`
- [ ] Magic Jar `level-6/magic-jar`
- [ ] Mass Suggestion `level-6/mass-suggestion`
- [ ] Mental Prison `level-6/mental-prison`
- [ ] Move Earth `level-6/move-earth`
- [ ] Otiluke's Freezing Sphere `level-6/otilukes-freezing-sphere`
- [ ] Otto's Irresistible Dance `level-6/ottos-irresistible-dance`
- [ ] Planar Ally `level-6/planar-ally`
- [ ] Primordial Ward `level-6/primordial-ward`
- [ ] Programmed Illusion `level-6/programmed-illusion`
- [ ] Scatter `level-6/scatter`
- [ ] Soul Cage `level-6/soul-cage`
- [ ] Sunbeam `level-6/sunbeam`
- [ ] Tenser's Transformation `level-6/tensers-transformation`
- [ ] Transport via Plants `level-6/transport-via-plants`
- [ ] True Seeing `level-6/true-seeing`
- [ ] Wall of Ice `level-6/wall-of-ice`
- [ ] Wall of Thorns `level-6/wall-of-thorns`
- [ ] Wind Walk `level-6/wind-walk`
- [ ] Word of Recall `level-6/word-of-recall`

### Level 7 (26)

- [ ] Arcane Sword `level-7/arcane-sword`
- [ ] Conjure Celestial `level-7/conjure-celestial`
- [ ] Crown of Stars `level-7/crown-of-stars`
- [ ] Delayed Blast Fireball `level-7/delayed-blast-fireball`
- [ ] Divine Word `level-7/divine-word`
- [ ] Draconic Transformation `level-7/draconic-transformation`
- [ ] Dream of the Blue Veil `level-7/dream-of-the-blue-veil`
- [ ] Etherealness `level-7/etherealness`
- [ ] Finger of Death `level-7/finger-of-death`
- [ ] Fire Storm `level-7/fire-storm`
- [ ] Forcecage `level-7/forcecage`
- [ ] Mirage Arcane `level-7/mirage-arcane`
- [ ] Mordenkainen's Magnificent Mansion `level-7/mordenkainens-magnificent-mansion`
- [ ] Plane Shift `level-7/plane-shift`
- [ ] Power Word Pain `level-7/power-word-pain`
- [ ] Prismatic Spray `level-7/prismatic-spray`
- [ ] Project Image `level-7/project-image`
- [ ] Regenerate `level-7/regenerate`
- [ ] Resurrection `level-7/resurrection`
- [ ] Reverse Gravity `level-7/reverse-gravity`
- [ ] Sequester `level-7/sequester`
- [ ] Simulacrum `level-7/simulacrum`
- [ ] Symbol `level-7/symbol`
- [ ] Teleport `level-7/teleport`
- [ ] Temple of the Gods `level-7/temple-of-the-gods`
- [ ] Whirlwind `level-7/whirlwind`

### Level 8 (22)

- [ ] Abi-Dalzim's Horrid Wilting `level-8/abi-dalzims-horrid-wilting`
- [ ] Animal Shapes `level-8/animal-shapes`
- [ ] Antimagic Field `level-8/antimagic-field`
- [ ] Antipathy/Sympathy `level-8/antipathy-sympathy`
- [ ] Clone `level-8/clone`
- [ ] Control Weather `level-8/control-weather`
- [ ] Demiplane `level-8/demiplane`
- [ ] Dominate Monster `level-8/dominate-monster`
- [ ] Earthquake `level-8/earthquake`
- [ ] Feeblemind `level-8/feeblemind`
- [ ] Glibness `level-8/glibness`
- [ ] Holy Aura `level-8/holy-aura`
- [ ] Illusory Dragon `level-8/illusory-dragon`
- [ ] Incendiary Cloud `level-8/incendiary-cloud`
- [ ] Maddening Darkness `level-8/maddening-darkness`
- [ ] Maze `level-8/maze`
- [ ] Mighty Fortress `level-8/mighty-fortress`
- [ ] Mind Blank `level-8/mind-blank`
- [ ] Power Word Stun `level-8/power-word-stun`
- [ ] Sunburst `level-8/sunburst`
- [ ] Telepathy `level-8/telepathy`
- [ ] Tsunami `level-8/tsunami`

### Level 9 (20)

- [ ] Astral Projection `level-9/astral-projection`
- [ ] Blade of Disaster `level-9/blade-of-disaster`
- [ ] Foresight `level-9/foresight`
- [ ] Gate `level-9/gate`
- [ ] Imprisonment `level-9/imprisonment`
- [ ] Invulnerability `level-9/invulnerability`
- [ ] Mass Heal `level-9/mass-heal`
- [ ] Mass Polymorph `level-9/mass-polymorph`
- [ ] Meteor Swarm `level-9/meteor-swarm`
- [ ] Power Word Heal `level-9/power-word-heal`
- [ ] Power Word Kill `level-9/power-word-kill`
- [ ] Prismatic Wall `level-9/prismatic-wall`
- [ ] Psychic Scream `level-9/psychic-scream`
- [ ] Shapechange `level-9/shapechange`
- [ ] Storm of Vengeance `level-9/storm-of-vengeance`
- [ ] Time Stop `level-9/time-stop`
- [ ] True Polymorph `level-9/true-polymorph`
- [ ] True Resurrection `level-9/true-resurrection`
- [ ] Weird `level-9/weird`
- [ ] Wish `level-9/wish`
