# Death Saving Throws Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement D&D 5e death saving throws so downed player characters (HP = 0) roll a d20 on their turn instead of being skipped, stabilising at 3 successes or dying at 3 failures.

**Architecture:** `CombatCharacter` gains three new optional fields (`isDowned`, `deathSaveSuccesses`, `deathSaveFailures`). `handleDamage` in `useCombatEngine.ts` marks players as downed instead of simply logging "defeated". `advanceTurn` in `useTurnOrder.ts` includes downed-but-not-dead characters. `startTurnFor` in `useTurnManager.ts` auto-rolls the d20 and processes the result. Healing commands already reduce HP which is checked elsewhere; a simple guard in the healing path revives downed players to 1 HP.

**Tech Stack:** TypeScript, React hooks, existing combat state immutable-update pattern (`this.updateCharacter` / spread `CombatCharacter`)

---

## File Map

| File | Change |
|---|---|
| `src/types/combat.ts` | Add `isDowned?`, `deathSaveSuccesses?`, `deathSaveFailures?` to `CombatCharacter` |
| `src/hooks/combat/engine/useCombatEngine.ts` | `handleDamage`: set `isDowned=true` on player characters reaching 0 HP |
| `src/hooks/combat/useTurnOrder.ts` | `advanceTurn`: include downed players in the living check |
| `src/hooks/combat/useTurnManager.ts` | `startTurnFor`: roll d20 death save, process result, update character |
| `src/commands/effects/HealingCommand.ts` | Revive downed target to 1 HP before applying normal healing |
| `src/components/BattleMap/InitiativeTracker.tsx` | Show ☠/💀 indicator and save pip counts for downed characters |
| `src/components/BattleMap/PartyDisplay.tsx` | Show downed state and save progress on party HP bars |

---

## Task 1 — Type Changes

**Files:**
- Modify: `src/types/combat.ts` (around line 173 — the `CombatCharacter` interface)

- [ ] **Step 1: Add three fields to `CombatCharacter`**

Open `src/types/combat.ts` and add after the `tempHP?` field (~line 235):

```typescript
  /** True when this player character is at 0 HP but not yet dead (death save phase). */
  isDowned?: boolean;
  /** Number of successful death saving throws (0–3). Reaching 3 = stabilised at 1 HP. */
  deathSaveSuccesses?: number;
  /** Number of failed death saving throws (0–3). Reaching 3 = dead, removed from combat. */
  deathSaveFailures?: number;
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -30
```
Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/combat.ts
git commit -m "feat(combat): add isDowned and deathSave fields to CombatCharacter"
```

---

## Task 2 — handleDamage: Mark Players as Downed

**Files:**
- Modify: `src/hooks/combat/engine/useCombatEngine.ts` (~line 157, `handleDamage` callback)

Currently at line 170–176:
```typescript
updatedCharacter.currentHP = Math.max(0, updatedCharacter.currentHP - finalAmount);
updatedCharacter.damagedThisTurn = true;
const isDeath = updatedCharacter.currentHP === 0 && character.currentHP > 0;
// … logs "and is defeated!"
```

- [ ] **Step 1: Replace the HP/death block with downed logic**

Replace lines 170–192 with:
```typescript
updatedCharacter.currentHP = Math.max(0, updatedCharacter.currentHP - finalAmount);
updatedCharacter.damagedThisTurn = true;

const justHitZero = updatedCharacter.currentHP === 0 && character.currentHP > 0;

if (justHitZero) {
  if (character.team === 'player') {
    // D&D 5e: player characters are downed, not immediately dead.
    updatedCharacter.isDowned = true;
    updatedCharacter.deathSaveSuccesses = 0;
    updatedCharacter.deathSaveFailures = 0;
  }
}

const statusSuffix = justHitZero
  ? (character.team === 'player' ? ' and is downed!' : ' and is defeated!')
  : '';

onLogEntry({
  id: generateId(),
  timestamp: Date.now(),
  type: 'damage',
  message: `${character.name} takes ${amount} ${damageType || ''} damage from ${source}${statusSuffix}`,
  characterId: character.id,
  data: {
    damage: amount,
    damageType,
    source,
    isDeath: justHitZero && character.team === 'enemy',
    isDowned: justHitZero && character.team === 'player',
    targetTags: character.creatureTypes
  }
});
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/combat/engine/useCombatEngine.ts
git commit -m "feat(combat): mark player characters as downed at 0 HP instead of defeated"
```

---

## Task 3 — advanceTurn: Include Downed Players

**Files:**
- Modify: `src/hooks/combat/useTurnOrder.ts` (~line 108–115, `advanceTurn`)

Currently:
```typescript
if (char && char.currentHP > 0) {
  foundNext = true;
  break;
}
```

- [ ] **Step 1: Extend the living check to include downed players**

Replace that block with:
```typescript
// Include downed player characters so they can roll death saves on their turn.
// Dead enemies (currentHP === 0 AND not isDowned) are skipped.
const isAliveOrDowned = char && (char.currentHP > 0 || char.isDowned === true);
if (isAliveOrDowned) {
  foundNext = true;
  break;
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -30
```

- [ ] **Step 3: Run existing useTurnOrder tests (if any)**

```bash
npx vitest run --reporter=verbose 2>&1 | grep -E "PASS|FAIL|useTurnOrder" | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/combat/useTurnOrder.ts
git commit -m "feat(combat): include downed player characters in turn order"
```

---

## Task 4 — startTurnFor: Auto-Roll Death Saves

**Files:**
- Modify: `src/hooks/combat/useTurnManager.ts` (~line 112, `startTurnFor`)

- [ ] **Step 1: Add death save roll logic at the top of `startTurnFor`**

After `let updatedChar = resetEconomy(character);` (line 113), insert:

```typescript
// D&D 5e Death Saving Throws (PHB p.197)
// Only applies to downed player characters (HP === 0, isDowned === true).
if (character.isDowned && character.currentHP === 0) {
  const roll = Math.floor(Math.random() * 20) + 1;
  let successes = character.deathSaveSuccesses ?? 0;
  let failures = character.deathSaveFailures ?? 0;
  let logMessage = '';

  if (roll === 20) {
    // Natural 20: regain 1 HP, no longer downed.
    updatedChar = { ...updatedChar, currentHP: 1, isDowned: false, deathSaveSuccesses: 0, deathSaveFailures: 0 };
    logMessage = `${character.name} rolls a Natural 20 on their Death Save and regains 1 HP!`;
  } else if (roll === 1) {
    // Natural 1: counts as 2 failures.
    failures = Math.min(3, failures + 2);
    updatedChar = { ...updatedChar, deathSaveFailures: failures };
    logMessage = `${character.name} rolls a Natural 1 on their Death Save — 2 failures! (${failures}/3)`;
  } else if (roll >= 10) {
    successes = Math.min(3, successes + 1);
    updatedChar = { ...updatedChar, deathSaveSuccesses: successes };
    logMessage = `${character.name} rolls ${roll} — Death Save success! (${successes}/3)`;
    if (successes >= 3) {
      updatedChar = { ...updatedChar, currentHP: 1, isDowned: false, deathSaveSuccesses: 0, deathSaveFailures: 0 };
      logMessage += ` — ${character.name} stabilises!`;
    }
  } else {
    failures = Math.min(3, failures + 1);
    updatedChar = { ...updatedChar, deathSaveFailures: failures };
    logMessage = `${character.name} rolls ${roll} — Death Save failure! (${failures}/3)`;
  }

  onLogEntry({ id: generateId(), timestamp: Date.now(), type: 'status', message: logMessage, characterId: character.id });

  // 3 failures = dead. Remove from turn order by leaving isDowned true with HP 0 and setting a sentinel.
  // advanceTurn will stop including them once isDowned is cleared and HP is 0.
  if (failures >= 3 && updatedChar.currentHP === 0) {
    updatedChar = { ...updatedChar, isDowned: false }; // Stop including in turns
    onLogEntry({ id: generateId(), timestamp: Date.now(), type: 'status', message: `${character.name} has died.`, characterId: character.id });
  }

  onCharacterUpdate(updatedChar);
  // Do not log normal turn start for downed characters — their turn is just the save roll.
  return;
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/combat/useTurnManager.ts
git commit -m "feat(combat): auto-roll D&D 5e death saving throws on downed player turns"
```

---

## Task 5 — HealingCommand: Revive Downed Players

**Files:**
- Modify: `src/commands/effects/HealingCommand.ts`

- [ ] **Step 1: Locate the HP update in HealingCommand**

Find the line that sets `currentHP` (likely something like `newHP = Math.min(maxHP, currentHP + healAmount)`).

- [ ] **Step 2: Add downed-revival guard before applying healing**

Before computing `newHP`, add:

```typescript
// D&D 5e: any healing brings a downed character back from 0 HP.
// Floor the effective HP at 0 first, then add healing (PHB p.197).
const effectiveCurrentHP = target.isDowned ? 0 : target.currentHP;
const newHP = Math.min(target.maxHP, effectiveCurrentHP + healAmount);
const revivedFromDowned = target.isDowned === true;

// Clear downed state
const updates: Partial<CombatCharacter> = {
  currentHP: newHP,
  isDowned: false,
  deathSaveSuccesses: 0,
  deathSaveFailures: 0,
};
```

Then use `updates` in the `updateCharacter` call. If there was a revival, add a log entry: `"${healer.name} heals ${target.name} for ${healAmount} HP — ${target.name} regains consciousness!"`.

- [ ] **Step 3: Compile check**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/commands/effects/HealingCommand.ts
git commit -m "feat(combat): revive downed characters on any healing"
```

---

## Task 6 — UI: InitiativeTracker

**Files:**
- Modify: `src/components/BattleMap/InitiativeTracker.tsx`

- [ ] **Step 1: Find where HP is rendered per character in the tracker**

Search the component for `currentHP` or `maxHP` rendering.

- [ ] **Step 2: Add downed indicator and save pip count**

Where each character row is rendered, add:

```tsx
{char.isDowned && (
  <span className="text-yellow-400 text-xs ml-1" title="Downed — Death Saves">
    ⚠ {char.deathSaveSuccesses ?? 0}✓ {char.deathSaveFailures ?? 0}✗
  </span>
)}
```

Replace the normal HP display for downed characters with `💀 Downed` instead of `0 / maxHP`.

- [ ] **Step 3: Verify in the browser preview** (if dev server is running)

- [ ] **Step 4: Commit**

```bash
git add src/components/BattleMap/InitiativeTracker.tsx
git commit -m "feat(ui): show death save progress in InitiativeTracker"
```

---

## Task 7 — UI: PartyDisplay

**Files:**
- Modify: `src/components/BattleMap/PartyDisplay.tsx`

- [ ] **Step 1: Find HP bar rendering per party member**

- [ ] **Step 2: Replace HP bar with downed indicator when `isDowned`**

```tsx
{char.isDowned ? (
  <div className="text-center text-xs text-yellow-300">
    ⚠ Downed — {char.deathSaveSuccesses ?? 0}/3 saves, {char.deathSaveFailures ?? 0}/3 fails
  </div>
) : (
  // existing HP bar JSX
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BattleMap/PartyDisplay.tsx
git commit -m "feat(ui): show death save pips in PartyDisplay"
```

---

## Self-Review

**Spec coverage:**
- ✅ Type fields added (Task 1)
- ✅ Player downed at 0 HP, enemy dead (Task 2)
- ✅ Downed player gets turn (Task 3)
- ✅ d20 roll, Nat 1 = 2 failures, Nat 20 = revive, 3 successes = stabilise, 3 failures = dead (Task 4)
- ✅ Healing revives downed character (Task 5)
- ✅ InitiativeTracker shows state (Task 6)
- ✅ PartyDisplay shows state (Task 7)

**Spec gap:** The prompt says "3 successes = stable, regain 1 HP" and "Natural 20: regain 1 HP immediately". Both are handled in Task 4. Enemy characters die immediately at 0 HP — covered in Task 2 by the `team === 'player'` gate. A downed character receiving 0 damage from a natural 1 on a death save that reduces failures to 3 is correctly handled — `isDowned` is cleared and they stop appearing in turns.
