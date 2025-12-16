# Code Comments Guide

When and how to write comments in Aralia.

---

## Self-Check Prompts

Ask yourself when commenting:

> "Am I explaining *why* or just restating *what* the code does?"
> "Would a developer unfamiliar with D&D understand this without the comment?"
> "Is this comment going to become stale when the code changes?"
> "Could I make the code clearer instead of adding a comment?"

Comments should add value, not noise. Use judgment.

---

## Philosophy

> Good code explains *what*. Good comments explain *why*.

Code should be self-documenting through clear naming and structure. Comments fill gaps that code can't express: business logic, design decisions, D&D rules, workarounds.

---

## When to Comment

### Do Comment

**Why, not what:**
```typescript
// 5e PHB p.205: Fireball ignores cover for damage calculation
const damage = rollDamage(8, 6);

// Gemini sometimes returns incomplete JSON when rate-limited
// Retry logic handles this gracefully
const response = await fetchWithRetry(prompt);
```

**Non-obvious business logic:**
```typescript
// Cantrips scale at levels 5, 11, and 17 (not every level)
const diceCount = getCantriplScaling(characterLevel);
```

**Workarounds with context:**
```typescript
// WORKAROUND: React 19 strict mode causes double-mount
// This guard prevents duplicate API calls
// Remove when upgrading to React 20 (tracked in #234)
if (hasFetched.current) return;
```

**Complex algorithms (high-level):**
```typescript
// Dijkstra's algorithm for pathfinding on hex grid
// Nodes are hex cells, edges weighted by terrain cost
function findPath(start: Hex, end: Hex): Hex[] {
```

### Don't Comment

**The obvious:**
```typescript
// BAD: Increment the counter
counter++;

// BAD: Return the user
return user;

// BAD: Check if spell is null
if (spell === null) {
```

**What the code says:**
```typescript
// BAD: Loop through all spells and filter by school
const evocationSpells = spells.filter(s => s.school === 'evocation');
```

**Every function:**
```typescript
// BAD: This function adds two numbers
function add(a: number, b: number): number {
  return a + b;
}
```

---

## JSDoc for Public APIs

Use JSDoc for exported functions, especially:
- Utility functions used across modules
- Hook return values and parameters
- Complex type definitions

```typescript
/**
 * Calculates spell save DC based on caster's abilities.
 *
 * @param caster - The character casting the spell
 * @param spell - The spell being cast
 * @returns Save DC (8 + proficiency + ability modifier)
 * @see https://5e.tools/... for 5e SRD reference
 *
 * @example
 * const dc = calculateSpellSaveDC(wizard, fireball);
 * // dc = 8 + 4 (prof) + 5 (INT) = 17
 */
export function calculateSpellSaveDC(caster: Character, spell: Spell): number {
  // ...
}
```

### JSDoc Tags

| Tag | Use For |
|-----|---------|
| `@param` | Function parameters |
| `@returns` | Return value description |
| `@throws` | Exceptions that may be thrown |
| `@example` | Usage examples |
| `@see` | Related documentation |
| `@deprecated` | Mark deprecated with migration path |

---

## Inline Comments

Short, contextual notes within code:

```typescript
function resolveDamage(attack: Attack, target: Creature): number {
  let damage = attack.damage;

  // Resistance halves damage (rounded down per 5e rules)
  if (target.resistances.includes(attack.damageType)) {
    damage = Math.floor(damage / 2);
  }

  // Vulnerability doubles damage (applied after resistance)
  if (target.vulnerabilities.includes(attack.damageType)) {
    damage *= 2;
  }

  return damage;
}
```

---

## D&D Rule References

Always cite source for non-obvious rules:

```typescript
// 5e PHB p.196: Two-weapon fighting requires light weapons
// 5e SRD: Sneak attack requires finesse or ranged weapon
// House rule: We allow INT-based warlocks (see VISION.md)
```

---

## Comment Maintenance

Comments can become lies when code changes.

**When updating code:**
1. Read nearby comments
2. Update or delete if no longer accurate
3. Don't leave stale comments

**Red flags (stale comments):**
```typescript
// Returns the user's name  ← but function now returns full user object
function getUser() { ... }

// This is a temporary fix  ← from 2 years ago
```

---

## Section Comments

For long files, use section headers:

```typescript
// =============================================================================
// SPELL SLOT MANAGEMENT
// =============================================================================

function useSpellSlot(level: number) { ... }
function restoreSpellSlots() { ... }

// =============================================================================
// SPELL CASTING
// =============================================================================

function castSpell(spell: Spell) { ... }
```

Use sparingly. If a file needs many sections, consider splitting it.

---

## What Not to Do

```typescript
// DON'T: Comment out code (delete it, git has history)
// const oldImplementation = ...

// DON'T: Personal notes
// I think this is wrong but whatever - John

// DON'T: Venting
// This API is garbage

// DON'T: Timestamps (git handles this)
// Modified by Alice on 2024-03-15
```

---

*Back to [_METHODOLOGY.md](../_METHODOLOGY.md)*
