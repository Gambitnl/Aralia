# Level 1 Spell Migration - Combined Batches

**Scope:** All Level 1 spells migrated to structured schema, glossary, and manifest. Flat roots removed. Validator/integrity checks green.

## Batch 1
- Spells: alarm; animal-friendship; armor-of-agathys; arms-of-hadar; bane
- Notes: Alarm ritual ward; Animal Friendship beast-only charm; Armor of Agathys temp HP + reactive cold; Arms of Hadar necrotic AoE, suppress reactions on fail; Bane Cha save for -1d4 attacks/saves, scales targets.

## Batch 2
- Spells: bless; burning-hands; charm-person; chromatic-orb; color-spray
- Notes: Bless +1d4 to attacks/saves, scales targets; Burning Hands cone Dex save half; Charm Person Humanoid Wis save (adv if fighting); Chromatic Orb ranged attack 3d8 chosen type (50 gp diamond); Color Spray HP-pool blind 1 round.

## Batch 3
- Spells: absorb-elements; catapult; snare
- Notes: Absorb Elements reaction resist + stored dmg; Catapult hurl 1-5 lb object line Dex save 3d8 bludgeoning, +1d8/slot; Snare trap Dex save restrain, escape/dismantle checks.

## Batch 4
- Spells: command; compelled-duel; comprehend-languages; create-or-destroy-water; cure-wounds
- Notes: Command one-word control, scales targets; Compelled Duel taunt/leash with break conditions; Comprehend Languages ritual understand spoken/written; Create/Destroy Water cube/flames/fog; Cure Wounds touch heal 2d8+mod, +2d8/slot.

## Batch 5
- Spells: detect-evil-and-good; detect-magic; detect-poison-and-disease; disguise-self; dissonant-whispers
- Notes: Detect auras of types/Hallow; Detect Magic ritual auras/schools; Detect Poison/Disease ritual sense type; Disguise Self appearance illusion vs Investigation; Dissonant Whispers Wis save half + forced move on fail, +1d6/slot.

## Batch 6
- Spells: divine-favor; divine-smite; ensnaring-strike; entangle; expeditious-retreat
- Notes: Divine Favor radiant rider conc; Divine Smite paladin slot burn radiant (+ undead/fiend); Ensnaring Strike on-hit restrain with start-turn dmg, size adv; Entangle difficult terrain + restrain saves; Expeditious Retreat bonus-action Dash each turn.

## Batch 7
- Spells: faerie-fire; false-life; feather-fall; find-familiar; fog-cloud
- Notes: Faerie Fire Dex save outline/advantage; False Life temp HP 1d4+4 (+5/slot); Feather Fall reaction up to 5 targets; Find Familiar ritual persistent familiar forms, shared senses/delivery; Fog Cloud obscuring sphere scales size.

## Batch 8
- Spells: goodberry; grease; guiding-bolt; hail-of-thorns; healing-word
- Notes: Goodberry 10 berries heal 1 HP each; Grease 10-ft square prone save; Guiding Bolt ranged attack radiant + next attack advantage, +1d6/slot; Hail of Thorns next ranged attack AoE Dex half, +1d10/slot; Healing Word bonus-action ranged heal 1d4+mod, +1d4/slot.

## Batch 9
- Spells: hellish-rebuke; heroism; hex; hunters-mark; ice-knife
- Notes: Hellish Rebuke reaction Dex save 2d10 fire +1d10/slot; Heroism temp HP each turn + fear immunity; Hex bonus-action curse extra necrotic dmg + ability check disadvantage, duration scales; Hunter's Mark bonus-action mark extra weapon dmg + adv to track, duration scales; Ice Knife ranged attack pierce + burst Dex save cold scaling.

## Batch 10
- Spells: identify; illusory-script; inflict-wounds; jump; longstrider
- Notes: Identify ritual item/curse info; Illusory Script ritual hidden text readers; Inflict Wounds melee spell attack necrotic +1d10/slot; Jump triple jump distance; Longstrider +10 speed, scales targets.

## Batch 11
- Spells: mage-armor; magic-missile; protection-from-evil-and-good; purify-food-and-drink; ray-of-sickness
- Notes: Mage Armor set AC; Magic Missile auto-hit darts (scales +1 dart/slot); Protection vs listed types (disadv attacks, saves vs charm/fear/possess); Purify ritual cleans food/drink; Ray of Sickness ranged attack poison dmg + Con save poison, +1d8/slot.

## Batch 12
- Spells: sanctuary; searing-smite; shield; shield-of-faith; silent-image
- Notes: Sanctuary ward saves redirect; Searing Smite next melee hit fire + ongoing Con saves; Shield reaction +5 AC vs triggering, blocks magic missile; Shield of Faith +2 AC conc; Silent Image 15-ft cube illusion with action move/alter.

## Batch 13
- Spells: sleep; speak-with-animals; tashas-caustic-brew; tashas-hideous-laughter; tensers-floating-disk
- Notes: Sleep HP-pool slumber scaling; Speak with Animals (ritual) simple communication; Tasha's Caustic Brew line acid ongoing until washed, Dex save half, +1d4/slot; Tasha's Hideous Laughter prone/incapacitated Wis save, Int<4 immune; Tenser's Floating Disk ritual 3-ft disk carries 500 lb follows caster.

## Batch 14 (Final)
- Spells: thunderous-smite; thunderwave; unseen-servant; witch-bolt; wrathful-smite
- Notes: Thunderous Smite next melee hit thunder + push/prone save, conc; Thunderwave cube Con save 2d8 thunder push on fail, +1d8/slot; Unseen Servant ritual simple tasks 1h; Witch Bolt ranged attack lightning tether action 1d12/turn, +1d12/slot; Wrathful Smite next melee hit psychic + frightened, Wis save end.

## Commands Run (final)
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`
