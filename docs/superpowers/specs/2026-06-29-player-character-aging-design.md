# Player-Character Aging — Design Spec

**Date:** 2026-06-29
**Status:** Design locked (grilled). Not yet implemented.
**Author:** Remy (decisions) + Claude (grilling/synthesis)
**Method:** Decisions reached via Matt Pocock `grilling` skill — one-branch-at-a-time
interrogation with recommended answers.

---

## 1. Goal

Track each character's age over the game's timeline and make age **mean something
mechanically as the campaign progresses** — gains *and* losses — rather than a frozen
number set once at creation.

This is **not** a death clock. Aging is a tradeoff axis with a non-lethal late-life
"frailty" floor that motivates seeking a cure.

---

## 2. What already exists (build-on points)

| Asset | Location | Role today |
|---|---|---|
| `PlayerCharacter.age` + `ageSizeOverride` | `src/types/character.ts:511` | Age set once at creation, then frozen |
| Per-race age bands + `statPenalty`/`sizeModifier` | `src/components/CharacterCreator/hooks/useCharacterAssembly.ts:75` | Classifies child→elderly; applies a **blanket penalty to ALL ability scores** at creation only |
| `getAgeAdjustmentSummary(raceId, age)` | `useCharacterAssembly.ts:304` | Maps any age → band → effect. **Reusable seam** for runtime aging |
| In-place stat mutation | `useCharacterAssembly.ts:636` | Overwrites ability scores destructively — **cannot be reused as-is** |
| `gameTime: Date` + `ADVANCE_TIME` daily loop | `src/types/state.ts:263`, `src/state/reducers/worldReducer.ts:221` | World clock advances in seconds; days accumulate |
| `PassTimeModal` (hours→years skip) | `src/components/Town/PassTimeModal.tsx` | Already lets players jump months/years — makes band transitions reachable |
| `lifespans.ts` — `maxAge`, `dailyDeathProbability`, child-bearing/marriage windows | `src/systems/worldforge/townsim/lifespans.ts` | Ages & kills **NPCs**; player currently exempt |

**Known conflict to fix:** creator says humans go "elderly" to 90; `lifespans.ts` says
humans die ~80. Two unsynced tables.

---

## 3. Locked decisions

### 3.1 Age model — derive from birthdate
- Assign a **random birth month/day** at creation; back-compute birth **year** from the
  chosen starting age.
- Age = whole years between birthdate and `gameTime`. Each **anniversary** triggers an
  effect recompute. Handles multi-year `PassTime` jumps naturally (it's derived, not ticked).

### 3.2 Effects are a derived layer (non-negotiable architecture)
- Store **base** ability scores. Age applies a recomputed **modifier layer** on top —
  never an in-place subtraction. Required for reversibility (de-aging, cures, frailty
  recovery) and to avoid compounding on repeated birthdays.
- Replaces the creator's current destructive mutation at `useCharacterAssembly.ts:636`.

### 3.3 Stat split — "mild mirror" (replaces blanket penalty)
Physical = STR/DEX/CON. Mental = INT/WIS/CHA.

| Band | Physical | Mental | Notes |
|---|---|---|---|
| Child | − | − | undeveloped on both; size override stays |
| Adolescent | − | − | smaller penalties |
| Adult | 0 | 0 | prime |
| Middle-aged | −1 | +1 | |
| Elderly | −2 | +2 | |

### 3.4 Band perks — the full bundle (on gain bands)
All four flavors, escalating Middle-aged → Elderly:
1. **Check bonus** — Seasoned (Insight/knowledge) → Sage (advantage on mental checks).
2. **Free age-themed feat** pick at Elderly (reuses the feats system).
3. **Renewable "Experience" token** — instinct reroll / inspiration-like resource.
4. **Social deference** — elder dialogue options, better prices, NPC respect.

### 3.5 Mortality — non-lethal frailty floor
The PC/companions **never die of old age**. Past natural `maxAge`:
- **Stat side (gentle & capped):** −1 physical every 2 years over span; each physical
  score **floored at 6** so HP/AC never collapse. Mental gains **plateau at +2**.
- **Non-stat costs (where frailty is felt):** reduced long-rest recovery, a recurring
  **"Weariness"** needing extra rest, occasional **age-event hooks** (e.g. a "bad back"
  day → disadvantage on Strength checks).
- Survivable indefinitely; visibly declining; strongly motivates a cure.

### 3.6 Cures — a few rare vectors
Rare **potions / quests / magical sites** that reduce age or extend `maxAge`. Frailty is
escapable but hard-won. (Implied-and-required because the floor must have an exit.)

### 3.7 Unified per-race age table (single source of truth)
Merge creator bands + `lifespans.ts` `maxAge` + frailty thresholds into **one per-race
dataset** consumed by: character creator, runtime aging, frailty, and the town-sim.
Fixes the 80-vs-90 conflict.

### 3.8 Scope — player + companions, can age out
PC **and recruited companions** get the full treatment (bands, split, perks, frailty) and
**can age out** (retire / become incapacitated) on a long enough campaign. Generic NPCs
remain on the town-sim path.

### 3.9 Creation — starting old is a surfaced tradeoff
Creator clearly shows: older start = begin with perks + mental bonus, but nearer frailty.
An informed roleplay choice, not a hidden trap.

### 3.10 Experience / UX
- Birthday → **journal entry**.
- Band change / perk gain → **toast notification**.
- Age shown on the **character sheet**.

---

## 4. Suggested build sequence

1. **Unify data** — one per-race age dataset (bands + `maxAge` + frailty thresholds);
   repoint creator and `lifespans.ts` at it.
2. **Derived-stat layer** — separate stored base scores from an age-modifier layer;
   refactor creator off destructive mutation; recompute HP/AC from the layered result.
3. **Birthdate model** — add birthdate to characters; migration assigns birthdates to
   existing saves from current age; age-from-birthdate helper.
4. **Birthday loop** — hook the daily/`PassTime` tick to detect anniversaries & band
   crossings; recompute effects; emit journal/toast.
5. **Perks** — Seasoned/Sage check bonuses, Elderly feat pick, Experience token, social
   deference.
6. **Frailty** — capped stat decline + non-stat costs (rest recovery, Weariness, event
   hooks).
7. **Cures** — a few de-aging/longevity vectors.
8. **Companions** — apply the same pipeline; add age-out / retirement path.
9. **Creator UX** — surface the start-old tradeoff.

---

## 5. Open implementation notes (not design blockers)

- Save/load migration must backfill birthdates for pre-feature characters.
- Multi-year `PassTime` jumps should apply all crossed bands + frailty in one recompute
  (free if age is derived from birthdate).
- Exact per-race numbers, the age-feat list, and the specific cure quests are deferred to
  implementation (flagged as sub-areas the grilling can revisit).
