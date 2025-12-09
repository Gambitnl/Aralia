# Gap Task: Object Targeting Support

**Gap ID:** GAP-10
**Related Review:** [BETA_REVIEW.md](BETA_REVIEW.md)
**Priority:** P2 (Feature Gap)

---

## Findings

**What is missing?**
The system explicitly rejects object targeting.
*   `TargetResolver.isValidTarget` returns `false` if the filter is `'objects'`.
*   Spells like *Fire Bolt* or *Shatter* cannot target items or environmental objects.

**Source of Findings**
*   **Report:** `docs/tasks/spell-system-overhaul/gaps/BETA_REVIEW.md` (Section 3)
*   **Code:** `src/systems/spells/targeting/TargetResolver.ts`

```typescript
case 'objects':
  // TODO: Implement object targeting
  return false
```

---

## Affected Areas

*   **File:** `src/systems/spells/targeting/TargetResolver.ts`
*   **Types:** `CombatState` may need a list of `InteractiveObject`s distinct from `CombatCharacter`.

---

## Execution Plan

### 1. Define Interactive Objects
Ensure `CombatState` includes a collection of targetable objects (e.g., Barrels, Doors, Levers).
*   *Dependency check:* Does the map system support objects?

### 2. Update TargetResolver
Modify `matchesTargetFilter` to check against the object list.
*   If target is in `objects` list, return `true` for `'objects'` filter.
*   Update logic to handle mixed targeting (e.g. `['creatures', 'objects']` should match *either*).

### 3. Handle Object Properties
Ensure objects have necessary stats for combat:
*   `AC` (Armor Class)
*   `HP` (Hit Points)
*   `Immunities` (e.g. Objects are immune to Psychic/Poison damage).

### 4. Acceptance Criteria
*   [ ] `TargetResolver` accepts a valid `InteractiveObject` as a target.
*   [ ] Filters `['creatures', 'objects']` allow targeting both an Orc and a Door.
*   [ ] Filters `['creatures']` reject a Door.
