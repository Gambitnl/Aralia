# Feat System Implementation Gaps

**Last Updated:** 2025-12-11

This document tracks feats and feat features that require additional implementation beyond basic ability score increases and proficiencies. These gaps need to be addressed to fully support all 2024 PHB feats.

---

## Data Model Status

### Resolved in Types (src/types.ts)
The following fields are now available in the `Feat.benefits` type:
- `selectableAbilityScores` - For feats where player chooses which ability to increase
- `selectableSkillCount` - For feats where player chooses N skills
- `savingThrowLinkedToAbility` - For Resilient (save proficiency matches chosen ability)
- `selectableDamageTypes` - For Elemental Adept (choose damage type)
- `spellBenefits` - For spell-granting feats (grantedSpells, spellChoices, etc.)

### Still Needs UI Implementation
Even though the data model supports these features, the **character builder UI** still needs to:
- Present selection interfaces for these choices
- Store the player's selections
- Apply the selections when adding the feat to the character

---

## Feats with Spell Benefits (Data Complete, UI Needed)

These feats have complete `spellBenefits` data but need UI for spell selection.

| Feat | Data Status | UI Status |
|------|-------------|-----------|
| Magic Initiate | `spellChoices` defined | Needs class + spell selection UI |
| Fey-Touched | `grantedSpells` + `spellChoices` | Needs spell selection UI |
| Shadow-Touched | `grantedSpells` + `spellChoices` | Needs spell selection UI |
| Spell Sniper | `spellChoices` (attack cantrip) | Needs cantrip selection UI |
| Telekinetic | `grantedSpells` (mage-hand) | Needs UI for bonus action shove |
| Telepathic | `grantedSpells` (detect-thoughts) | Needs telepathy feature UI |
| Ritual Caster | No `spellBenefits` | Needs class + ritual spell selection |

---

## Feats with Selectable ASI (Data Complete, UI Needed)

These feats have `selectableAbilityScores` defined and work correctly in data.

| Feat | Selectable Abilities | Notes |
|------|---------------------|-------|
| Resilient | All 6 | Also grants matching save proficiency via `savingThrowLinkedToAbility` |
| Skill Expert | All 6 | Also needs skill + expertise selection |
| Heavily Armored | STR, CON | |
| Moderately Armored | STR, DEX | |
| Mounted Combatant | STR, DEX | |
| Piercer | STR, DEX | |
| Slasher | STR, DEX | |
| Tavern Brawler | STR, CON | |
| Weapon Master | STR, DEX | Also needs 4 weapon selections |
| Shield Master | STR, DEX | |
| Magic Initiate | INT, WIS, CHA | |
| Elemental Adept | INT, WIS, CHA | Also has `selectableDamageTypes` |
| Fey-Touched | INT, WIS, CHA | |
| Shadow-Touched | INT, WIS, CHA | |
| Spell Sniper | INT, WIS, CHA | |
| Telekinetic | INT, WIS, CHA | |
| Telepathic | INT, WIS, CHA | |

---

## Feats with Selection Fields (Data Complete, UI Needed)

| Feat | Field | Value | UI Needed |
|------|-------|-------|-----------|
| Skilled | `selectableSkillCount` | 3 | Select 3 skills |
| Elemental Adept | `selectableDamageTypes` | Acid, Cold, Fire, Lightning, Thunder | Select 1 damage type |

---

## Feats Requiring Tool/Weapon Selection (Data Incomplete)

These feats need new data model fields for selection.

### Crafter
- **Gap**: Player must choose one type of artisan's tools
- **Required**: Add `selectableTools` field or similar
- **Combat Mechanics**: Crafting speed bonus, purchase discount (out of scope)

### Musician
- **Gap**: Player must choose three musical instruments
- **Required**: Add `selectableInstrumentCount` field or similar
- **Combat Mechanics**: Inspiration-granting performance (out of scope)

### Weapon Master
- **Gap**: Player must choose four weapons for proficiency
- **Required**: Add `selectableWeaponCount` field
- **Current**: Has `selectableAbilityScores` but no weapon selection

### Skill Expert
- **Gap**: Also needs expertise selection (one skill with double proficiency)
- **Required**: Add `selectableExpertiseCount` field
- **Current**: Has `selectableAbilityScores` and `skillProficiencies: ['any']` placeholder

---

## Feats Requiring Combat System Integration

These feats have mechanics that require combat system support.

### High Priority (Common Feats)
| Feat | Mechanic | Status |
|------|----------|--------|
| Great Weapon Master | -5 hit/+10 damage, bonus attack on crit/kill | Not implemented |
| Sharpshooter | -5 hit/+10 damage, ignore cover, no long range disadvantage | Not implemented |
| Sentinel | Speed 0 on OA hit, OA on disengage, disadvantage on other targets | Not implemented |
| Polearm Master | Bonus action butt-end attack, OA on enter reach | Not implemented |
| War Caster | Advantage on concentration, spell as OA | Not implemented |

### Medium Priority
| Feat | Mechanic | Status |
|------|----------|--------|
| Crossbow Expert | Ignore loading, no close range disadvantage, bonus attack | Not implemented |
| Defensive Duelist | Reaction: +proficiency to AC | Not implemented |
| Dual Wielder | +1 AC, draw/stow two, non-light two-weapon fighting | Not implemented |
| Mage Slayer | Disadvantage on concentration, advantage on adjacent spell saves | Not implemented |
| Medium Armor Master | +3 DEX to AC, no stealth disadvantage | Not implemented |
| Shield Master | Shield bonus to DEX saves, evasion, bonus action shove | Not implemented |

### Lower Priority
| Feat | Mechanic | Status |
|------|----------|--------|
| Grappler | Advantage vs grappled, restrain option | Needs grapple system |
| Heavy Armor Master | Reduce nonmagical physical damage by 3 | Not implemented |
| Inspiring Leader | Grant temp HP to 6 creatures | Not implemented |
| Mounted Combatant | Various mounted benefits | Needs mount system |
| Piercer | Reroll piercing die, extra die on crit | Not implemented |
| Poisoner | Craft poisons, ignore resistance | Needs crafting system |
| Skulker | Hide in light obscurement, no reveal on miss | Needs stealth system |
| Slasher | Reduce speed 10, disadvantage on crit | Not implemented |
| Speedy | Ignore difficult terrain on Dash | Partially implemented (speed bonus) |
| Tavern Brawler | Improvised proficiency, better unarmed, bonus grapple | Needs unarmed system |

---

## Fighting Style Feats

### Prerequisite Issue
- **Gap**: Fighting style feats should only be available to classes with Fighting Style feature
- **Current**: `requiresFightingStyle: true` in prerequisites, but **not enforced**
- **Required**: Update prerequisite checking to verify class has `fightingStyles`

### Fighting Style Mechanics (Not Implemented)
| Style | Effect | Status |
|-------|--------|--------|
| Archery | +2 attack with ranged weapons | Not implemented |
| Defense | +1 AC while wearing armor | Not implemented |
| Dueling | +2 damage with one-handed melee | Not implemented |
| Great Weapon Fighting | Reroll 1s and 2s on damage | Not implemented |
| Two-Weapon Fighting | Add ability mod to off-hand damage | Not implemented |
| Protection | Reaction: disadvantage on attack vs ally | Not implemented |
| Interception | Reaction: reduce damage to ally by 1d10+prof | Not implemented |
| Unarmed Fighting | Improved unarmed damage, grapple damage | Not implemented |
| Blind Fighting | Blindsight 10 feet | Not implemented |
| Thrown Weapon Fighting | Draw as attack, +2 damage | Not implemented |

---

## Summary by Priority

### Completed (Data Model)
- Resilient - selectable ability + linked save proficiency
- Skilled - selectable skill count
- Tavern Brawler - selectable ASI (STR or CON)
- Slasher - selectable ASI (STR or DEX)
- Elemental Adept - selectable damage type + ASI
- All spell-granting feats - `spellBenefits` structure

### High Priority (UI Implementation)
1. ASI selection UI for all feats with `selectableAbilityScores`
   - Resilient feat: Ability selection and logic to apply matching save proficiency
   - Tavern Brawler feat: Ability selection (STR or CON)
   - Slasher feat: Ability selection (STR or DEX)
   - Elemental Adept feat: Ability selection (INT, WIS, or CHA)
2. Skill selection UI for Skilled and Skill Expert
   - Skilled feat: Selecting 3 skills from the full skill list
   - Skill Expert feat: Skill selection and expertise selection
3. Damage type selection UI for Elemental Adept
   - Elemental Adept feat: Select damage type (Acid, Cold, Fire, Lightning, Thunder)
4. Spell selection UI for Magic Initiate, Fey-Touched, Shadow-Touched, Spell Sniper
5. Create FeatSelection.tsx component for character creation to surface eligible feats
6. Add feat slots to PlayerCharacter type and integrate feat effects into character assembly

### Medium Priority (Data Model Additions)
1. Tool selection for Crafter
2. Instrument selection for Musician
3. Weapon selection for Weapon Master
4. Expertise selection for Skill Expert

### Low Priority (Combat System)
1. Great Weapon Master / Sharpshooter power attack
2. Sentinel / Polearm Master opportunity attack modifications
3. Fighting style mechanics
4. Reaction-based feats (Defensive Duelist, Shield Master, etc.)

### Future Work
1. Epic Boon feats (level 19+)
2. Full combat system integration
3. Crafting system for Crafter/Poisoner
4. Mounted combat system
