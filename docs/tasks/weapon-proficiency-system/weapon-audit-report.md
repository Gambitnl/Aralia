# Weapon Proficiency Data Audit

## Overview
This report analyzes the consistency of weapon proficiency data in `src/data/items/index.ts`. The goal is to identify discrepancies between the `category` field and the `isMartial` flag to standardize the data model.

**Total Weapons Analyzed**: 32

## 1. Simple Melee Weapons
**Expectation**: `isMartial` should be `false` or `undefined` (implicit false). `category` should be 'Simple Melee'.

| Weapon ID | Name | Category | isMartial | Status |
|-----------|------|----------|-----------|--------|
| club | Club | Simple Melee | undefined | ⚠️ Implicit |
| dagger | Dagger | Simple Melee | undefined | ⚠️ Implicit |
| greatclub | Greatclub | Simple Melee | undefined | ⚠️ Implicit |
| handaxe | Handaxe | Simple Melee | undefined | ⚠️ Implicit |
| javelin | Javelin | Simple Melee | undefined | ⚠️ Implicit |
| light_hammer | Light Hammer | Simple Melee | undefined | ⚠️ Implicit |
| mace | Mace | Simple Melee | undefined | ⚠️ Implicit |
| quarterstaff | Quarterstaff | Simple Melee | undefined | ⚠️ Implicit |
| sickle | Sickle | Simple Melee | undefined | ⚠️ Implicit |
| spear | Spear | Simple Melee | undefined | ⚠️ Implicit |

**Finding**: All 10 simple melee weapons rely on the default behavior (undefined = false). None have explicit `isMartial: false`.

## 2. Simple Ranged Weapons
**Expectation**: `isMartial` should be `false` or `undefined`. `category` should be 'Simple Ranged'.

| Weapon ID | Name | Category | isMartial | Status |
|-----------|------|----------|-----------|--------|
| light_crossbow | Light Crossbow | Simple Ranged | false | ✅ Explicit |
| shortbow | Shortbow | Simple Ranged | false | ✅ Explicit |

**Finding**: Both simple ranged weapons clearly state `isMartial: false`. This creates a style inconsistency with Simple Melee weapons.

## 3. Martial Melee Weapons
**Expectation**: `isMartial` should be `true`. `category` should be 'Martial Melee'.

| Weapon ID | Name | Category | isMartial | Status |
|-----------|------|----------|-----------|--------|
| battleaxe | Battleaxe | Martial Melee | true | ✅ Explicit |
| flail | Flail | Martial Melee | true | ✅ Explicit |
| glaive | Glaive | Martial Melee | true | ✅ Explicit |
| greataxe | Greataxe | Martial Melee | true | ✅ Explicit |
| greatsword | Greatsword | Martial Melee | true | ✅ Explicit |
| halberd | Halberd | Martial Melee | true | ✅ Explicit |
| lance | Lance | Martial Melee | true | ✅ Explicit |
| longsword | Longsword | Martial Melee | true | ✅ Explicit |
| maul | Maul | Martial Melee | true | ✅ Explicit |
| morningstar | Morningstar | Martial Melee | true | ✅ Explicit |
| pike | Pike | Martial Melee | true | ✅ Explicit |
| rapier | Rapier | Martial Melee | true | ✅ Explicit |
| scimitar | Scimitar | Martial Melee | true | ✅ Explicit |
| shortsword | Shortsword | Martial Melee | true | ✅ Explicit |
| trident | Trident | Martial Melee | true | ✅ Explicit |
| warhammer | Warhammer | Martial Melee | true | ✅ Explicit |
| war_pick | War Pick | Martial Melee | true | ✅ Explicit |
| whip | Whip | Martial Melee | true | ✅ Explicit |
| rusty_sword | Rusty Sword | Martial Melee | true | ✅ Explicit |

**Finding**: All 19 martial melee weapons correctly use `isMartial: true`.

## 4. Martial Ranged Weapons
**Expectation**: `isMartial` should be `true`. `category` should be 'Martial Ranged'.

| Weapon ID | Name | Category | isMartial | Status |
|-----------|------|----------|-----------|--------|
| longbow | Longbow | Martial Ranged | true | ✅ Explicit |
| hand_crossbow | Hand Crossbow | Martial Ranged | true | ✅ Explicit |
| heavy_crossbow | Heavy Crossbow | Martial Ranged | true | ✅ Explicit |

**Finding**: All 3 martial ranged weapons correctly use `isMartial: true`.

## Summary & Recommendations

### Inconsistencies
1. **Mixed Explicitness**: Simple Melee weapons lack the `isMartial` flag (implicit), while Simple Ranged weapons include it (explicit).
2. **Redundancy**: The `category` field (`Simple Melee`, `Martial Ranged`, etc.) already contains the necessary information to derive proficiency. Maintaining both creates a risk of divergence (e.g., `category: 'Martial'`, `isMartial: false`).

### Recommendation for Task 08
**Option B (Recommended)**: Remove `isMartial` from the data entirely.
- **Why**: The `category` string is the primary source of truth in D&D (Simple/Martial + Melee/Ranged).
- **Action**: Update `src/utils/weaponUtils.ts` to rely SOLELY on `category` substring matching or a mapped lookup, and remove the `isMartial` boolean from `Item` interface and data files.
- **Alternative**: If strict typing is preferred, make `category` a union type (`'Simple Melee' | 'Simple Ranged' | ...`) instead of a string, or keep `isMartial` but enforce it on ALL weapons (adding it to Simple Melee).

Given the current implementation of `isWeaponMartial` already checks `category` first, removing `isMartial` cleans up the data without breaking logic, provided `category` is always present.
