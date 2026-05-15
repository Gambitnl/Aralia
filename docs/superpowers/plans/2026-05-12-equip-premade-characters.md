# Equip Premade Characters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give all 13 premade characters appropriate starting gear and fix two bugs in `createPlayerCombatCharacter` that prevent AC and ranged weapon range from reaching the combat engine.

**Architecture:** Three tiers of work: (1) JSON data — populate `equippedItems.MainHand` (and `Armor` where needed) in each character file; (2) `combatUtils.ts` — two-line fix to map `player.armorClass` / `player.baseAC` into the constructed `CombatCharacter`; (3) `combatUtils.ts` — extend `createWeaponAbility` to read a `range:N` convention from a weapon's `properties` array so ranged weapons get sensible tile ranges. No new types, no new files.

**Tech Stack:** TypeScript, JSON, Vitest

---

## Context You Need

- `public/premade-characters/` — 13 JSON files, one per class. All currently have `"equippedItems": {}`.
- `src/utils/combat/combatUtils.ts` — `createPlayerCombatCharacter` (from ~line 603) converts `PlayerCharacter` → `CombatCharacter`. Nested `createWeaponAbility` function (~line 628) builds the combat ability from `equippedItems.MainHand`.
- `src/utils/character/weaponUtils.ts` — `isWeaponProficient` checks `weapon.type === 'weapon'` first, then checks `weapon.isMartial` against `class.weaponProficiencies`. **A weapon item must have `type: "weapon"` or proficiency will never return true.**
- `src/types/items.ts` — `Item` interface. Relevant fields: `id`, `name`, `description`, `type` (`"weapon"`), `category`, `damageDice`, `damageType`, `properties` (string[]), `isMartial`, `mastery`.
- `CombatCharacter.armorClass` is never set by `createPlayerCombatCharacter` (line 738–769) — the `player.armorClass` baked into each JSON is silently dropped. Fix is a one-liner.
- Ranged weapon range: `createWeaponAbility` line 641 sets `range: (reach) ? 2 : 1` — no path for ranged weapons. Fix: detect a `"range:N"` entry in `properties` and use it.

---

## File Map

| File | Change |
|---|---|
| `public/premade-characters/kael_ironvow.json` | Add longsword to `equippedItems.MainHand`; add chain mail to `equippedItems.Torso` |
| `public/premade-characters/brynna_ashward.json` | Add greataxe to `equippedItems.MainHand` |
| `public/premade-characters/oren_pathmark.json` | Add longbow to `equippedItems.MainHand` |
| `public/premade-characters/tavian_oathsteel.json` | Add longsword to `equippedItems.MainHand`; add shield to `equippedItems.OffHand` |
| `public/premade-characters/sera_dawnmantle.json` | Add mace to `equippedItems.MainHand` |
| `public/premade-characters/merrit_greenbough.json` | Add quarterstaff to `equippedItems.MainHand` |
| `public/premade-characters/lyris_songweaver.json` | Add rapier to `equippedItems.MainHand` |
| `public/premade-characters/nyx_velorin.json` | Add rapier to `equippedItems.MainHand` |
| `public/premade-characters/thalren_deeproot.json` | Add shortsword to `equippedItems.MainHand` |
| `public/premade-characters/pip_coppercoil.json` | Add light crossbow to `equippedItems.MainHand` |
| `src/utils/combat/combatUtils.ts` | (1) Map `armorClass`/`baseAC` into `CombatCharacter`; (2) parse `range:N` from weapon properties |
| `src/utils/combat/__tests__/combatUtils.test.ts` (or nearest test file) | Tests for AC mapping and ranged range |

---

## Task 1 — Fix: Map armorClass + baseAC into CombatCharacter

**Files:**
- Modify: `src/utils/combat/combatUtils.ts:738–769`
- Test: `src/utils/combat/__tests__/combatUtils.test.ts`

These two fields exist on `CombatCharacter` (`combat.ts:225–226`) but are never assigned in `createPlayerCombatCharacter`. Every player enters combat with `armorClass: undefined`.

- [ ] **Step 1: Write the failing test**

Find or create `src/utils/combat/__tests__/combatUtils.test.ts`. Add:

```typescript
import { createPlayerCombatCharacter } from '../combatUtils';
import { createTestPlayer } from '../../core/factories'; // adjust import if needed

describe('createPlayerCombatCharacter — armorClass', () => {
  it('maps player.armorClass and player.baseAC into the CombatCharacter', () => {
    const player = createTestPlayer({ armorClass: 18, baseAC: 18 });
    const combatChar = createPlayerCombatCharacter(player, {});
    expect(combatChar.armorClass).toBe(18);
    expect(combatChar.baseAC).toBe(18);
  });

  it('uses armorClass when baseAC is absent', () => {
    const player = createTestPlayer({ armorClass: 14 });
    const combatChar = createPlayerCombatCharacter(player, {});
    expect(combatChar.armorClass).toBe(14);
    expect(combatChar.baseAC).toBe(14);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/utils/combat/__tests__/combatUtils.test.ts --reporter=verbose 2>&1 | tail -20
```
Expected: `FAIL — expect(received).toBe(expected): received undefined`

- [ ] **Step 3: Apply the fix in combatUtils.ts**

In `createPlayerCombatCharacter`, find the `const combatChar: CombatCharacter = {` block (~line 738). Directly after the `feats` line (~line 767), add:

```typescript
    armorClass: player.armorClass,
    baseAC: player.baseAC ?? player.armorClass,
```

The full tail of the object now ends:
```typescript
    feats: player.feats || [],
    resistances: (player.race as any).resistance as import('../../types').DamageType[] | undefined,
    armorClass: player.armorClass,
    baseAC: player.baseAC ?? player.armorClass,
  };
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/utils/combat/__tests__/combatUtils.test.ts --reporter=verbose 2>&1 | tail -20
```
Expected: `PASS`

- [ ] **Step 5: Compile check**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/combat/combatUtils.ts src/utils/combat/__tests__/combatUtils.test.ts
git commit -m "fix(combat): map player armorClass and baseAC into CombatCharacter"
```

---

## Task 2 — Fix: Ranged Weapon Range in createWeaponAbility

**Files:**
- Modify: `src/utils/combat/combatUtils.ts:628–660` (`createWeaponAbility` inner function)
- Test: same test file as Task 1

Convention: any weapon JSON that is ranged includes `"range:N"` in its `properties` array (e.g. `"range:30"` for a longbow where 30 = 150 ft / 5). `createWeaponAbility` reads this and uses it.

- [ ] **Step 1: Write the failing test**

Add to the same test file:

```typescript
describe('createPlayerCombatCharacter — ranged weapon range', () => {
  it('assigns range from the range:N property on a ranged weapon', () => {
    const longbow: Item = {
      id: 'longbow',
      name: 'Longbow',
      description: 'A martial ranged weapon.',
      type: 'weapon',
      category: 'Martial Ranged Weapon',
      damageDice: '1d8',
      damageType: 'piercing',
      properties: ['ranged', 'ammunition', 'two-handed', 'range:30'],
      isMartial: true,
    };
    const player = createTestPlayer({ equippedItems: { MainHand: longbow } });
    const combatChar = createPlayerCombatCharacter(player, {});
    const attackAbility = combatChar.abilities.find(a => a.id === 'attack_main');
    expect(attackAbility?.range).toBe(30);
  });

  it('keeps range 1 for a melee weapon with no range property', () => {
    const longsword: Item = {
      id: 'longsword',
      name: 'Longsword',
      description: 'A martial melee weapon.',
      type: 'weapon',
      category: 'Martial Melee Weapon',
      damageDice: '1d8',
      damageType: 'slashing',
      properties: ['versatile'],
      isMartial: true,
    };
    const player = createTestPlayer({ equippedItems: { MainHand: longsword } });
    const combatChar = createPlayerCombatCharacter(player, {});
    const attackAbility = combatChar.abilities.find(a => a.id === 'attack_main');
    expect(attackAbility?.range).toBe(1);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/utils/combat/__tests__/combatUtils.test.ts --reporter=verbose 2>&1 | tail -20
```
Expected: `FAIL — expect(received).toBe(30): received 1`

- [ ] **Step 3: Apply the fix in createWeaponAbility (~line 641)**

Find the current range assignment:
```typescript
range: (weapon.properties?.some((p) => p === 'reach')) ? 2 : 1, // Simple reach check
```

Replace it with:
```typescript
range: (() => {
  if (weapon.properties?.some(p => p === 'reach')) return 2;
  const rangeEntry = weapon.properties?.find(p => /^range:\d+$/.test(p));
  if (rangeEntry) return parseInt(rangeEntry.split(':')[1], 10);
  return 1;
})(),
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/utils/combat/__tests__/combatUtils.test.ts --reporter=verbose 2>&1 | tail -20
```
Expected: `PASS`

- [ ] **Step 5: Compile check**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/combat/combatUtils.ts src/utils/combat/__tests__/combatUtils.test.ts
git commit -m "fix(combat): read range:N property from weapons for ranged attack range"
```

---

## Task 3 — Equip Fighter: Kael Ironvow

**Files:**
- Modify: `public/premade-characters/kael_ironvow.json`

Kael's `armorClass: 11` in the JSON represents bare skin (no armor equipped). A level-1 Fighter with Dueling style should have Chain Mail (AC 16). His selected masteries include `"longsword"`.

- [ ] **Step 1: Replace the `equippedItems` block**

In `kael_ironvow.json`, replace `"equippedItems": {}` with:

```json
"equippedItems": {
    "MainHand": {
        "id": "longsword",
        "name": "Longsword",
        "description": "A standard military longsword. Versatile — can be used one or two-handed.",
        "type": "weapon",
        "category": "Martial Melee Weapon",
        "damageDice": "1d8",
        "damageType": "slashing",
        "properties": ["versatile"],
        "isMartial": true,
        "mastery": "Sap",
        "rarity": "Common"
    },
    "Torso": {
        "id": "chain_mail",
        "name": "Chain Mail",
        "description": "Interlocking metal rings. AC 16. Disadvantage on Stealth checks.",
        "type": "armor",
        "category": "Heavy Armor",
        "baseArmorClass": 16,
        "stealthDisadvantage": true,
        "properties": [],
        "rarity": "Common"
    }
}
```

Also update `"armorClass": 11` → `"armorClass": 16` and `"baseAC": 16` (add the field) to reflect the chain mail.

- [ ] **Step 2: Validate JSON is parseable**

```bash
npx tsx -e "import d from './public/premade-characters/kael_ironvow.json' assert { type: 'json' }; console.log(d.equippedItems.MainHand.name);"
```
Expected: `Longsword`

- [ ] **Step 3: Commit**

```bash
git add public/premade-characters/kael_ironvow.json
git commit -m "feat(premade): equip Kael Ironvow with longsword and chain mail"
```

---

## Task 4 — Equip Barbarian: Brynna Ashward

**Files:**
- Modify: `public/premade-characters/brynna_ashward.json`

Brynna's `armorClass: 14` = 10 + DEX mod(2) + CON mod(2). That's Unarmored Defense — correct for Barbarian, no Torso item needed.

- [ ] **Step 1: Replace the `equippedItems` block**

```json
"equippedItems": {
    "MainHand": {
        "id": "greataxe",
        "name": "Greataxe",
        "description": "A heavy two-handed axe. The signature weapon of the barbarian.",
        "type": "weapon",
        "category": "Martial Melee Weapon",
        "damageDice": "1d12",
        "damageType": "slashing",
        "properties": ["heavy", "two-handed"],
        "isMartial": true,
        "mastery": "Cleave",
        "rarity": "Common"
    }
}
```

- [ ] **Step 2: Validate**

```bash
npx tsx -e "import d from './public/premade-characters/brynna_ashward.json' assert { type: 'json' }; console.log(d.equippedItems.MainHand.name);"
```
Expected: `Greataxe`

- [ ] **Step 3: Commit**

```bash
git add public/premade-characters/brynna_ashward.json
git commit -m "feat(premade): equip Brynna Ashward with a greataxe"
```

---

## Task 5 — Equip Ranger: Oren Pathmark

**Files:**
- Modify: `public/premade-characters/oren_pathmark.json`

Oren's `armorClass: 15` = 12 (studded leather base) + DEX mod(3). No Torso needed, the AC baked in is reasonable.

- [ ] **Step 1: Replace the `equippedItems` block**

```json
"equippedItems": {
    "MainHand": {
        "id": "longbow",
        "name": "Longbow",
        "description": "A tall bow requiring two hands. Normal range 150 ft (30 tiles), long range 600 ft.",
        "type": "weapon",
        "category": "Martial Ranged Weapon",
        "damageDice": "1d8",
        "damageType": "piercing",
        "properties": ["ranged", "ammunition", "two-handed", "range:30"],
        "isMartial": true,
        "mastery": "Slow",
        "rarity": "Common"
    }
}
```

- [ ] **Step 2: Validate**

```bash
npx tsx -e "import d from './public/premade-characters/oren_pathmark.json' assert { type: 'json' }; console.log(d.equippedItems.MainHand.properties);"
```
Expected: `[ 'ranged', 'ammunition', 'two-handed', 'range:30' ]`

- [ ] **Step 3: Commit**

```bash
git add public/premade-characters/oren_pathmark.json
git commit -m "feat(premade): equip Oren Pathmark with a longbow"
```

---

## Task 6 — Equip Paladin: Tavian Oathsteel

**Files:**
- Modify: `public/premade-characters/tavian_oathsteel.json`

Tavian's `armorClass: 18` = Chain Mail(16) + Shield(+2). He needs both MainHand longsword and OffHand shield.

- [ ] **Step 1: Replace the `equippedItems` block**

```json
"equippedItems": {
    "MainHand": {
        "id": "longsword",
        "name": "Longsword",
        "description": "A standard military longsword.",
        "type": "weapon",
        "category": "Martial Melee Weapon",
        "damageDice": "1d8",
        "damageType": "slashing",
        "properties": ["versatile"],
        "isMartial": true,
        "mastery": "Sap",
        "rarity": "Common"
    },
    "OffHand": {
        "id": "shield",
        "name": "Shield",
        "description": "A wooden or metal shield. +2 AC.",
        "type": "armor",
        "category": "Shield",
        "armorClassBonus": 2,
        "properties": [],
        "rarity": "Common"
    },
    "Torso": {
        "id": "chain_mail",
        "name": "Chain Mail",
        "description": "Interlocking metal rings. AC 16.",
        "type": "armor",
        "category": "Heavy Armor",
        "baseArmorClass": 16,
        "stealthDisadvantage": true,
        "properties": [],
        "rarity": "Common"
    }
}
```

Also add `"baseAC": 18` beside the existing `"armorClass": 18`.

- [ ] **Step 2: Validate**

```bash
npx tsx -e "import d from './public/premade-characters/tavian_oathsteel.json' assert { type: 'json' }; console.log(d.equippedItems.MainHand.name, d.equippedItems.OffHand.name);"
```
Expected: `Longsword Shield`

- [ ] **Step 3: Commit**

```bash
git add public/premade-characters/tavian_oathsteel.json
git commit -m "feat(premade): equip Tavian Oathsteel with longsword, shield, and chain mail"
```

---

## Task 7 — Equip Cleric: Sera Dawnmantle

**Files:**
- Modify: `public/premade-characters/sera_dawnmantle.json`

Sera's `armorClass: 16` = Chain Mail(16). She has the Protector divine order (proficient with martial weapons and heavy armor). A mace is a simple weapon — correct for base Cleric proficiency.

- [ ] **Step 1: Replace the `equippedItems` block**

```json
"equippedItems": {
    "MainHand": {
        "id": "mace",
        "name": "Mace",
        "description": "A simple weapon with a heavy head. Standard Cleric weapon.",
        "type": "weapon",
        "category": "Simple Melee Weapon",
        "damageDice": "1d6",
        "damageType": "bludgeoning",
        "properties": [],
        "isMartial": false,
        "mastery": "Sap",
        "rarity": "Common"
    },
    "OffHand": {
        "id": "shield",
        "name": "Shield",
        "description": "A wooden or metal shield. +2 AC.",
        "type": "armor",
        "category": "Shield",
        "armorClassBonus": 2,
        "properties": [],
        "rarity": "Common"
    },
    "Torso": {
        "id": "chain_mail",
        "name": "Chain Mail",
        "description": "Interlocking metal rings. AC 16.",
        "type": "armor",
        "category": "Heavy Armor",
        "baseArmorClass": 16,
        "stealthDisadvantage": true,
        "properties": [],
        "rarity": "Common"
    }
}
```

Add `"baseAC": 16` beside `"armorClass": 16`.

- [ ] **Step 2: Validate**

```bash
npx tsx -e "import d from './public/premade-characters/sera_dawnmantle.json' assert { type: 'json' }; console.log(d.equippedItems.MainHand.name);"
```
Expected: `Mace`

- [ ] **Step 3: Commit**

```bash
git add public/premade-characters/sera_dawnmantle.json
git commit -m "feat(premade): equip Sera Dawnmantle with mace, shield, and chain mail"
```

---

## Task 8 — Equip Druid: Merrit Greenbough

**Files:**
- Modify: `public/premade-characters/merrit_greenbough.json`

Merrit's `armorClass: 14` = 12 (leather) + DEX mod(2). A quarterstaff is a simple weapon — valid for Druids. No metal armor per Druid restriction.

- [ ] **Step 1: Replace the `equippedItems` block**

```json
"equippedItems": {
    "MainHand": {
        "id": "quarterstaff",
        "name": "Quarterstaff",
        "description": "A sturdy wooden staff. Versatile — can be used one or two-handed.",
        "type": "weapon",
        "category": "Simple Melee Weapon",
        "damageDice": "1d6",
        "damageType": "bludgeoning",
        "properties": ["versatile"],
        "isMartial": false,
        "mastery": "Topple",
        "rarity": "Common"
    }
}
```

- [ ] **Step 2: Validate**

```bash
npx tsx -e "import d from './public/premade-characters/merrit_greenbough.json' assert { type: 'json' }; console.log(d.equippedItems.MainHand.name);"
```
Expected: `Quarterstaff`

- [ ] **Step 3: Commit**

```bash
git add public/premade-characters/merrit_greenbough.json
git commit -m "feat(premade): equip Merrit Greenbough with a quarterstaff"
```

---

## Task 9 — Equip Bard: Lyris Songweaver

**Files:**
- Modify: `public/premade-characters/lyris_songweaver.json`

Lyris's `armorClass: 13` = 11 (leather base) + DEX mod(2). A rapier is a simple weapon via Bard proficiency and suits her finesse build (DEX 14).

- [ ] **Step 1: Replace the `equippedItems` block**

```json
"equippedItems": {
    "MainHand": {
        "id": "rapier",
        "name": "Rapier",
        "description": "A slender thrusting sword with a sharp point. Uses finesse — can use STR or DEX.",
        "type": "weapon",
        "category": "Martial Melee Weapon",
        "damageDice": "1d8",
        "damageType": "piercing",
        "properties": ["finesse"],
        "isMartial": true,
        "mastery": "Vex",
        "rarity": "Common"
    }
}
```

**Note:** Bards only have proficiency in Simple weapons by default. A rapier is Martial. Lyris's `class.weaponProficiencies` only lists `"Simple weapons"` — this means `isWeaponProficient` will return `false` and she won't add proficiency bonus to her attack roll. This is correct D&D 5e behaviour for a Bard without College of Valor. For testing purposes this is acceptable. If she should be proficient, add `"Rapiers"` to her `class.weaponProficiencies` array.

- [ ] **Step 2: Validate**

```bash
npx tsx -e "import d from './public/premade-characters/lyris_songweaver.json' assert { type: 'json' }; console.log(d.equippedItems.MainHand.name);"
```
Expected: `Rapier`

- [ ] **Step 3: Commit**

```bash
git add public/premade-characters/lyris_songweaver.json
git commit -m "feat(premade): equip Lyris Songweaver with a rapier"
```

---

## Task 10 — Equip Rogue: Nyx Velorin

**Files:**
- Modify: `public/premade-characters/nyx_velorin.json`

Nyx's `armorClass: 14` = 11 (leather) + DEX mod(3). The Rogue's class explicitly lists `"Rapiers"` in `weaponProficiencies` — proficiency confirmed. A rapier is also a finesse weapon, which is the prerequisite for Sneak Attack.

- [ ] **Step 1: Replace the `equippedItems` block**

```json
"equippedItems": {
    "MainHand": {
        "id": "rapier",
        "name": "Rapier",
        "description": "A slender thrusting sword. Uses finesse — can use STR or DEX for attacks.",
        "type": "weapon",
        "category": "Martial Melee Weapon",
        "damageDice": "1d8",
        "damageType": "piercing",
        "properties": ["finesse"],
        "isMartial": true,
        "mastery": "Vex",
        "rarity": "Common"
    }
}
```

- [ ] **Step 2: Validate**

```bash
npx tsx -e "import d from './public/premade-characters/nyx_velorin.json' assert { type: 'json' }; console.log(d.equippedItems.MainHand.properties);"
```
Expected: `[ 'finesse' ]`

- [ ] **Step 3: Commit**

```bash
git add public/premade-characters/nyx_velorin.json
git commit -m "feat(premade): equip Nyx Velorin with a finesse rapier"
```

---

## Task 11 — Equip Monk: Thalren Deeproot

**Files:**
- Modify: `public/premade-characters/thalren_deeproot.json`

Thalren's `armorClass: 15` = 10 + DEX mod(3) + WIS mod(2) — Monk Unarmored Defense. No armor item needed. Shortswords are monk weapons (Monks are proficient with shortswords). Adding a shortsword gives a 1d6 piercing finesse weapon — better than Unarmed Strike's flat-value fallback.

- [ ] **Step 1: Replace the `equippedItems` block**

```json
"equippedItems": {
    "MainHand": {
        "id": "shortsword",
        "name": "Shortsword",
        "description": "A light, agile blade. Finesse — uses STR or DEX.",
        "type": "weapon",
        "category": "Martial Melee Weapon",
        "damageDice": "1d6",
        "damageType": "piercing",
        "properties": ["finesse", "light"],
        "isMartial": true,
        "mastery": "Nick",
        "rarity": "Common"
    }
}
```

- [ ] **Step 2: Validate**

```bash
npx tsx -e "import d from './public/premade-characters/thalren_deeproot.json' assert { type: 'json' }; console.log(d.equippedItems.MainHand.name);"
```
Expected: `Shortsword`

- [ ] **Step 3: Commit**

```bash
git add public/premade-characters/thalren_deeproot.json
git commit -m "feat(premade): equip Thalren Deeproot with a shortsword"
```

---

## Task 12 — Equip Artificer: Pip Coppercoil

**Files:**
- Modify: `public/premade-characters/pip_coppercoil.json`

Pip's `armorClass: 15` = 12 (studded leather) + DEX mod(2) + 1 from shield or light armor. Artificers have light, medium armor, and shield proficiency plus simple weapons. A light crossbow is a simple ranged weapon.

- [ ] **Step 1: Replace the `equippedItems` block**

```json
"equippedItems": {
    "MainHand": {
        "id": "light_crossbow",
        "name": "Light Crossbow",
        "description": "A simple ranged weapon. Normal range 80 ft (16 tiles).",
        "type": "weapon",
        "category": "Simple Ranged Weapon",
        "damageDice": "1d8",
        "damageType": "piercing",
        "properties": ["ranged", "ammunition", "two-handed", "loading", "range:16"],
        "isMartial": false,
        "mastery": "Slow",
        "rarity": "Common"
    }
}
```

- [ ] **Step 2: Validate**

```bash
npx tsx -e "import d from './public/premade-characters/pip_coppercoil.json' assert { type: 'json' }; console.log(d.equippedItems.MainHand.name, 'range:', d.equippedItems.MainHand.properties.find(p => p.startsWith('range:')));"
```
Expected: `Light Crossbow range: range:16`

- [ ] **Step 3: Commit**

```bash
git add public/premade-characters/pip_coppercoil.json
git commit -m "feat(premade): equip Pip Coppercoil with a light crossbow"
```

---

## Task 13 — Integration Smoke Test

Run the full test suite and verify no regressions. The three pure-caster characters (Sorcerer, Warlock, Wizard) need no changes — confirm their `equippedItems: {}` is intentional (they are fine as-is, relying on cantrips for damage).

- [ ] **Step 1: Run all tests**

```bash
npx vitest run --reporter=verbose 2>&1 | grep -E "FAIL|PASS|ERROR" | grep -v "No test suite found" | head -50
```

Expected: same pass/fail baseline as before this plan — only new tests added (Tasks 1 and 2) show PASS; no regressions.

- [ ] **Step 2: Full TypeScript compile**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | grep -v "node_modules" | head -30
```

Expected: zero new errors.

- [ ] **Step 3: Confirm all 10 weapon slots are now populated**

```bash
npx tsx -e "
const chars = ['kael_ironvow','brynna_ashward','oren_pathmark','tavian_oathsteel','sera_dawnmantle','merrit_greenbough','lyris_songweaver','nyx_velorin','thalren_deeproot','pip_coppercoil'];
for (const c of chars) {
  const d = await import('./public/premade-characters/' + c + '.json', { assert: { type: 'json' } });
  const weapon = d.default.equippedItems?.MainHand;
  console.log(c.padEnd(25), weapon ? weapon.name : 'MISSING');
}
"
```

Expected output (all 10 show a weapon name):
```
kael_ironvow              Longsword
brynna_ashward            Greataxe
oren_pathmark             Longbow
tavian_oathsteel          Longsword
sera_dawnmantle           Mace
merrit_greenbough         Quarterstaff
lyris_songweaver          Rapier
nyx_velorin               Rapier
thalren_deeproot          Shortsword
pip_coppercoil            Light Crossbow
```

- [ ] **Step 4: Final commit if any loose files remain**

```bash
git status
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| All 10 non-caster characters get appropriate weapons | Tasks 3–12 |
| Fighter gets Chain Mail (AC 16) | Task 3 |
| Paladin gets shield + chain mail | Task 6 |
| Cleric gets shield + chain mail | Task 7 |
| Ranger longbow has ranged range (30 tiles) | Tasks 2 + 5 |
| Artificer light crossbow has ranged range (16 tiles) | Tasks 2 + 12 |
| armorClass/baseAC reaches CombatCharacter | Task 1 |
| Sorcerer/Warlock/Wizard left as-is | Task 13 note |

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:** `equippedItems.MainHand` accepts `Item` (confirmed in `character.ts:479`). All weapon objects include mandatory `id`, `name`, `description`, `type`. `armorClass` and `baseAC` are both `number | undefined` on `CombatCharacter` — assignment from `player.armorClass` (also `number`) is type-safe. The `range:N` parsing uses `parseInt` which is always a `number`.

**Known gaps not addressed in this plan (see Plan 2):**
- Rage (Barbarian) — needs spellbook + ResistanceCalculator fix
- Sneak Attack (Rogue) — needs auto-trigger in AbilityCommandFactory
- Bardic Inspiration — needs hardcoded ability in createPlayerCombatCharacter
- Flurry of Blows (Monk) — needs hardcoded ability
- Divine Smite (Paladin) — needs spell JSON + rider registration
- Shillelagh (Druid) — needs cantrip addition + WIS attack override in spellAbilityFactory
- Death Saving Throws — see `docs/superpowers/plans/2026-05-11-death-saving-throws.md`
