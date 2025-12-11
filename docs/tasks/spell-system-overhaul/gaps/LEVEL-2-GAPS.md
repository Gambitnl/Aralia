# Level 2 Gaps Summary

All Level 2 batches completed and validated. The gaps below reflect engine/integration work not covered by data/schema.

## Engine/Integration Gaps (inferred from spell notes)
- **Material costs/consumption enforcement**: Many Level 2 spells require costly/consumed components (Arcane Lock 25 gp, Continual Flame 50 gp consumed, Magic Mouth 10 gp consumed, Heat Metal needs a flame, Find Steed rings, etc.). The engine does not decrement inventory or gate casting by component cost/consumption.
- **Vision/sight rules**: Blur’s disadvantage unless ignoring sight, Darkness blocking darkvision, See Invisibility/Ethereal sight, and shapechanger disadvantage in Moonbeam assume a sight model that is only partially implemented. Obscurement from Web/Spike Growth/Cloud of Daggers is likewise not integrated into targeting/AI.
- **Emotional/deception modeling**: Calm Emotions (charm/fear suppression or indifference), Zone of Truth (lie prevention with save awareness), Suggestion (reasonableness and compliance), Enthrall (Perception disadvantage vs others) all presume behavioral state tracking beyond “made the save”.
- **Ongoing tick/area hazards**: Web (burning webs 2d4/turn), Spike Growth (2d4 per 5 ft moved), Cloud of Daggers/Moonbeam/Flaming Sphere (enter/turn-start/turn-end ticks with “first per turn”), Shatter inorganic disadvantage, and Strength/Dex escape checks need robust per-turn AoE processing.
- **Link/shared effects**: Warding Bond shared damage/AC/save buffs within 60 ft and link break on range/HP need explicit tracking.
- **Illusion adjudication**: Phantasmal Force (Investigation to disbelieve, per-turn 1d6 psychic) and Rope Trick visibility/targeting rules require engine support for illusion verification and extradimensional access blocking.
- **Scaling/multi-target UI**: Spells that add rays/targets with higher slots (Scorching Ray, Hold Person, Enhance Ability, Magic Weapon bonus increases) need UI affordances to spend higher slots and select multiple rays/targets with correct damage values.

## Commands Validated
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`
