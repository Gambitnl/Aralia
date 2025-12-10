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
| Friends | friends | [ ] Pending | [ ] Not Started | | Social/charm cantrip |
| Frostbite | frostbite | [ ] Pending | [ ] Not Started | | Cold damage + disadvantage |
| Green-Flame Blade | green-flame-blade | [ ] Pending | [ ] Not Started | | Melee weapon + AoE |
| Guidance | guidance | [ ] Pending | [ ] Not Started | | Buff/skill bonus |
| Light | light | [D] Data Only | [ ] Not Started | | Utility/light source. Reference created. |
| Lightning Lure | lightning-lure | [ ] Pending | [ ] Not Started | | Lightning + pull effect |
| Mage Hand | mage-hand | [ ] Pending | [ ] Not Started | | Utility cantrip |
| Magic Stone | magic-stone | [ ] Pending | [ ] Not Started | | Ranged weapon buff |
| Mending | mending | [ ] Pending | [ ] Not Started | | Object repair utility |
| Message | message | [ ] Pending | [ ] Not Started | | Communication utility |
| Minor Illusion | minor-illusion | [ ] Pending | [ ] Not Started | | Illusion utility |
| Poison Spray | poison-spray | [ ] Pending | [ ] Not Started | | Poison damage cantrip |
| Prestidigitation | prestidigitation | [ ] Pending | [ ] Not Started | | Utility cantrip |
| Produce Flame | produce-flame | [ ] Pending | [ ] Not Started | | Fire damage + light |
| Ray of Frost | ray-of-frost | [ ] Pending | [ ] Not Started | | Cold damage + slow |
| Resistance | resistance | [ ] Pending | [ ] Not Started | | Buff/damage reduction |
| Sacred Flame | sacred-flame | [ ] Pending | [ ] Not Started | | Radiant damage (ignores cover) |
| Shillelagh | shillelagh | [ ] Pending | [ ] Not Started | | Weapon buff (Druid) |
| Shocking Grasp | shocking-grasp | [ ] Pending | [ ] Not Started | | Lightning + prevent reactions |
| Spare the Dying | spare-the-dying | [ ] Pending | [ ] Not Started | | Stabilize dying creature |
| Starry Wisp | starry-wisp | [ ] Pending | [ ] Not Started | | Radiant damage + reveal invisible |
| Thaumaturgy | thaumaturgy | [ ] Pending | [ ] Not Started | | Utility cantrip |
| Thorn Whip | thorn-whip | [ ] Pending | [ ] Not Started | | Piercing damage + pull |
| Thunderclap | thunderclap | [ ] Pending | [ ] Not Started | | Thunder damage AoE |
| Toll the Dead | toll-the-dead | [ ] Pending | [ ] Not Started | | Necrotic damage (scales on HP) |
| True Strike | true-strike | [ ] Pending | [ ] Not Started | | Advantage on next attack |
| Vicious Mockery | vicious-mockery | [ ] Pending | [ ] Not Started | | Psychic damage + disadvantage |
| Word of Radiance | word-of-radiance | [ ] Pending | [ ] Not Started | | Radiant damage AoE |