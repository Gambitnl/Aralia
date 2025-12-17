# Spell Integration Status: Cantrips (Level 0)

This file tracks the migration of Cantrips (Level 0 spells) to the new component-based spell system defined in `src/types/spells.ts`.

> **See Also**: [Comprehensive Spell Integration Checklist](./SPELL_INTEGRATION_CHECKLIST.md) - Complete checklist for testing all integration points

**Legend:**
*   `[ ] Pending`: Not yet started
*   `[D] Data Only`: Spell JSON created and validated, but component integration not tested
*   `[T] Testing`: Data complete, running through integration test flow
*   `[x] Complete`: Data conversion AND all component integration verified

**Status Columns:**
- **Migration Status**: Data layer completion (JSON file + validation)
- **Integration Status**: Component integration testing (see [SPELL_INTEGRATION_CHECKLIST.md](./SPELL_INTEGRATION_CHECKLIST.md))
- **Jules Task ID**: Task tracking reference

| Spell Name | ID | Migration Status | Integration Status | Jules Task ID | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Acid Splash | acid-splash | [D] Data Only | [ ] Not Started | | Data: JSON file creation. Integration: Creator + Sheet + Combat + Glossary |
| Blade Ward | blade-ward | [D] Data Only | [ ] Not Started | | Defensive buff cantrip |
| Booming Blade | booming-blade | [D] Data Only | [ ] Not Started | | Melee weapon + spell attack |
| Chill Touch | chill-touch | [D] Data Only | [ ] Not Started | | Necrotic damage + healing prevention |
| Create Bonfire | create-bonfire | [D] Data Only | [ ] Not Started | | Concentration + area control |
| Dancing Lights | dancing-lights | [D] Data Only | [ ] Not Started | | Utility/light source |
| Druidcraft | druidcraft | [D] Data Only | [ ] Not Started | | Utility cantrip |
| Eldritch Blast | eldritch-blast | [D] Data Only | [ ] Not Started | | Warlock signature spell |
| Elementalism | elementalism | [D] Data Only | [ ] Not Started | | Utility cantrip |
| Fire Bolt | fire-bolt | [D] Data Only | [ ] Not Started | | Fire damage cantrip |
| Friends | friends | [D] Data Only | [ ] Not Started | | Social/charm cantrip |
| Frostbite | frostbite | [D] Data Only | [ ] Not Started | | Cold damage + disadvantage |
| Green-Flame Blade | green-flame-blade | [D] Data Only | [ ] Not Started | | Melee weapon + AoE |
| Guidance | guidance | [D] Data Only | [ ] Not Started | | Buff/skill bonus |
| Light | light | [D] Data Only | [ ] Not Started | | Utility/light source |
| Lightning Lure | lightning-lure | [D] Data Only | [ ] Not Started | | Lightning + pull effect |
| Mage Hand | mage-hand | [D] Data Only | [ ] Not Started | | Utility cantrip |
| Magic Stone | magic-stone | [D] Data Only | [ ] Not Started | | Ranged weapon buff |
| Mending | mending | [D] Data Only | [ ] Not Started | | Object repair utility |
| Message | message | [D] Data Only | [ ] Not Started | | Communication utility |
| Mind Sliver | mind-sliver | [D] Data Only | [ ] Not Started | | Psychic damage + save penalty |
| Minor Illusion | minor-illusion | [D] Data Only | [ ] Not Started | | Illusion utility |
| Mold Earth | mold-earth | [D] Data Only | [ ] Not Started | | Terrain manipulation utility |
| Poison Spray | poison-spray | [D] Data Only | [ ] Not Started | | Poison damage cantrip |
| Prestidigitation | prestidigitation | [D] Data Only | [ ] Not Started | | Utility cantrip |
| Primal Savagery | primal-savagery | [D] Data Only | [ ] Not Started | | Acid damage melee cantrip |
| Produce Flame | produce-flame | [D] Data Only | [ ] Not Started | | Fire damage + light |
| Ray of Frost | ray-of-frost | [D] Data Only | [ ] Not Started | | Cold damage + slow |
| Resistance | resistance | [D] Data Only | [ ] Not Started | | Buff/damage reduction |
| Sacred Flame | sacred-flame | [D] Data Only | [ ] Not Started | | Radiant damage (ignores cover) |
| Sapping Sting | sapping-sting | [D] Data Only | [ ] Not Started | | Necrotic damage + prone |
| Shape Water | shape-water | [D] Data Only | [ ] Not Started | | Water manipulation utility |
| Shillelagh | shillelagh | [D] Data Only | [ ] Not Started | | Weapon buff (Druid) |
| Shocking Grasp | shocking-grasp | [D] Data Only | [ ] Not Started | | Lightning + prevent reactions |
| Spare the Dying | spare-the-dying | [D] Data Only | [ ] Not Started | | Stabilize dying creature |
| Starry Wisp | starry-wisp | [D] Data Only | [ ] Not Started | | Radiant damage + reveal invisible |
| Sword Burst | sword-burst | [D] Data Only | [ ] Not Started | | Force damage AoE |
| Thaumaturgy | thaumaturgy | [D] Data Only | [ ] Not Started | | Utility cantrip |
| Thorn Whip | thorn-whip | [D] Data Only | [ ] Not Started | | Piercing damage + pull |
| Thunderclap | thunderclap | [D] Data Only | [ ] Not Started | | Thunder damage AoE |
| Toll the Dead | toll-the-dead | [D] Data Only | [ ] Not Started | | Necrotic damage (scales on HP) |
| True Strike | true-strike | [D] Data Only | [ ] Not Started | | Advantage on next attack |
| Vicious Mockery | vicious-mockery | [D] Data Only | [ ] Not Started | | Psychic damage + disadvantage |
| Word of Radiance | word-of-radiance | [D] Data Only | [ ] Not Started | | Radiant damage AoE |