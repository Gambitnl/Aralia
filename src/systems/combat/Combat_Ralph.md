# Combat Component Documentation (Ralph)

## Overview
This folder contains the core logic for the Combat System, handling attack resolution, conditional effects (Riders), and event emission for UI/Logs.

## Files
- **AttackRiderSystem.ts**: Manages "Riders" (conditional effects like Smite/Sneak Attack). Handles registration, validation filters (weapon type, target), and consumption logic (remove on hit vs. mark used per turn).
- **AttackEventEmitter.ts**: Handles the emission of attack-related events (pre/post attack) to allow other systems (UI, Logs) to react or intervene.
- **MovementEventEmitter.ts**: Handles movement events (pre/post movement) during combat, supporting cancellation and distance tracking.
- **SavePenaltySystem.ts**: Manages temporary penalties to saving throws (e.g., from Bane or conditions), similar to the Rider system but for saves.
- **SustainActionSystem.ts**: Logic for actions that must be sustained over multiple turns (e.g., Witch Bolt), managing costs and turn-end cleanup.

## Issues & Opportunities

### AttackRiderSystem.ts

**Issue 1: Unused `CombatCharacter` Import (Lint Warning)**
- **Status:** CONFIRMED - Import aliased as `_CombatCharacter` at line 4, never referenced
- **Also affects:** `SustainActionSystem.ts` (same pattern at line 4)
- **Root Cause:** Files use local type inference (`const caster = state.characters.find(...)`) without explicit type annotations
- **Fix:** Remove unused import. Files already contain TODO comments acknowledging this.

**Issue 2: High Coupling with `@/types/combat`**
- **Status:** CONFIRMED - Both `ActiveRider` and `CombatState` imported from 540-line monolithic types file
- **Current Impact:** Limited (2 types each), but creates dependency surface that scales poorly
- **Recommendation:** Local interface segregation or dedicated combat-types re-export file

**Issue 3: `getMatchingRiders` Complex Nested Filter Logic**
- **Status:** CONFIRMED - Lines 46-74 contain sequential if-checks for target matching, consumption limits, weapon type (with null guards), and attack type
- **Current Complexity:** O(n×m) where n=riders, m=filters; nested conditionals reduce readability
- **Recommendation:** Strategy pattern extraction for filter composition

### General

**Issue 4: Singleton Pattern Hinders Test Isolation**
- **Status:** CONFIRMED - HIGH PRIORITY
- **Affected Files:** 
  - `AttackEventEmitter.ts` (lines 99-105)
  - `MovementEventEmitter.ts` (lines 108-114)
  - `SustainActionSystem.ts` (lines 126-132)
- **Problem:** Static `getInstance()` prevents fresh instances per test; shared state leaks between tests
- **Recommendation:** Instance provider pattern with test injection helpers

---

## Implementation Plans

### Plan 1: Remove Dead Imports

**Files:** `AttackRiderSystem.ts`, `SustainActionSystem.ts`

**Changes:**
```typescript
// AttackRiderSystem.ts line 4
- import { ActiveRider, CombatState, CombatCharacter as _CombatCharacter } from '@/types/combat';
+ import { ActiveRider, CombatState } from '@/types/combat';

// SustainActionSystem.ts line 4  
- import { CombatState, CombatCharacter as _CombatCharacter } from '../../types/combat';
+ import { CombatState } from '../../types/combat';
```

**Verification:** Run linter to confirm no new warnings.

---

### Plan 2: Filter Strategy Pattern Refactor

**File:** `AttackRiderSystem.ts`

**Step 1 - Define Filter Interface:**
```typescript
interface RiderFilter {
  test(rider: ActiveRider, context: AttackContext): boolean;
}

const TargetFilter: RiderFilter = {
  test: (rider, ctx) => !rider.targetId || rider.targetId === ctx.targetId
};

const ConsumptionFilter: RiderFilter = {
  test: (rider) => !(rider.consumption === 'per_turn' && rider.usedThisTurn)
};

const WeaponTypeFilter: RiderFilter = {
  test: (rider, ctx) => {
    const wt = rider.attackFilter?.weaponType;
    if (!wt || wt === 'any') return true;
    if (!ctx.weaponType) return false;
    return wt === ctx.weaponType;
  }
};

const AttackTypeFilter: RiderFilter = {
  test: (rider, ctx) => {
    const at = rider.attackFilter?.attackType;
    return !at || at === 'any' || at === ctx.attackType;
  }
};
```

**Step 2 - Refactor `getMatchingRiders`:**
```typescript
getMatchingRiders(state: CombatState, context: AttackContext): ActiveRider[] {
  if (!context.isHit) return [];
  
  const attacker = state.characters.find(c => c.id === context.attackerId);
  if (!attacker?.riders?.length) return [];

  const filters = [TargetFilter, ConsumptionFilter, WeaponTypeFilter, AttackTypeFilter];
  
  return attacker.riders.filter(rider => 
    filters.every(f => f.test(rider, context))
  );
}
```

**Benefit:** New filter types become one-line registrations; unit testable in isolation.

---

### Plan 3: Singleton Testability Fix

**Files:** `AttackEventEmitter.ts`, `MovementEventEmitter.ts`, `SustainActionSystem.ts`

**Phase 1 - Add Instance Control (per file):**
```typescript
export class AttackEventEmitter {
  private static instance: AttackEventEmitter;
  
  // Existing singleton accessor
  static getInstance(): AttackEventEmitter { 
    if (!this.instance) this.instance = new AttackEventEmitter();
    return this.instance;
  }
  
  // NEW: Injection point for tests
  static setInstance(instance: AttackEventEmitter | null): void {
    this.instance = instance;
  }
  
  // NEW: Factory for fresh instances
  static createFresh(): AttackEventEmitter {
    return new AttackEventEmitter();
  }
  
  // Keep constructor accessible for createFresh
  constructor() { /* ... */ }
}
```

**Phase 2 - Test Helper (create `src/test-utils/combatEmitters.ts`):**
```typescript
export function isolateAttackEmitter<T>(fn: (emitter: AttackEventEmitter) => T): T {
  const fresh = AttackEventEmitter.createFresh();
  const original = AttackEventEmitter.getInstance();
  AttackEventEmitter.setInstance(fresh);
  try {
    return fn(fresh);
  } finally {
    AttackEventEmitter.setInstance(original);
  }
}

export function isolateMovementEmitter<T>(fn: (emitter: MovementEventEmitter) => T): T {
  const fresh = MovementEventEmitter.createFresh();
  const original = MovementEventEmitter.getInstance();
  MovementEventEmitter.setInstance(fresh);
  try {
    return fn(fresh);
  } finally {
    MovementEventEmitter.setInstance(original);
  }
}

export function isolateSustainSystem<T>(fn: (system: SustainActionSystem) => T): T {
  const fresh = SustainActionSystem.createFresh();
  const original = SustainActionSystem.getInstance();
  SustainActionSystem.setInstance(fresh);
  try {
    return fn(fresh);
  } finally {
    SustainActionSystem.setInstance(original);
  }
}
```

**Phase 3 - Usage Example:**
```typescript
test('pre-attack listeners can cancel attacks', () => {
  isolateAttackEmitter((emitter) => {
    let cancelled = false;
    emitter.onPreAttack((evt) => { evt.isCancelled = true; });
    
    const result = emitter.emitPreAttack('a', 't', 'weapon');
    expect(result.isCancelled).toBe(true);
  });
});
```

**Risk:** Low - backward compatible; existing `getInstance()` calls unchanged.

---

## Priority Order

1. **Issue 1 (Remove dead imports)** - 5 min, zero risk
2. **Issue 4 (Singleton testability)** - 2-3 hrs, enables proper unit testing
3. **Issue 3 (Filter strategy pattern)** - 1-2 hrs, improves maintainability
4. **Issue 2 (Type coupling)** - Deferred until type changes become painful
