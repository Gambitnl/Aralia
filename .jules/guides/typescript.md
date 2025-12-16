# TypeScript Standards

Type safety patterns for Aralia.

---

## Core Principles

1. **Strict types** - Avoid `any`, use `unknown` and narrow
2. **Compile-time safety** - Catch errors before runtime
3. **Self-documenting** - Types are documentation that compiles

---

## Strict Types

```typescript
// GOOD: Explicit, narrow types
type SpellSchool = 'evocation' | 'abjuration' | 'necromancy' | 'conjuration';

// BAD: Loose types
type SpellSchool = string;
```

```typescript
// GOOD: Constrained generics
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// BAD: Unconstrained
function getProperty<T>(obj: T, key: string): any {
  return obj[key as keyof T];
}
```

---

## Discriminated Unions

Use for state machines and result types:

```typescript
type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

// Usage
function renderState(state: LoadState<Spell[]>) {
  switch (state.status) {
    case 'idle':
      return null;
    case 'loading':
      return <Spinner />;
    case 'success':
      return <SpellList spells={state.data} />;
    case 'error':
      return <ErrorMessage error={state.error} />;
  }
}
```

---

## Type Guards

Runtime type narrowing with compile-time safety:

```typescript
// Type predicate
function isSpell(item: Item): item is Spell {
  return 'castingTime' in item && 'level' in item;
}

// Usage
function processItem(item: Item) {
  if (isSpell(item)) {
    // TypeScript knows item is Spell here
    console.log(item.castingTime);
  }
}
```

```typescript
// Assertion function
function assertNonNull<T>(value: T | null | undefined, message: string): asserts value is T {
  if (value == null) {
    throw new Error(message);
  }
}

// Usage
const spell = spellMap.get(id);
assertNonNull(spell, `Spell ${id} not found`);
// TypeScript knows spell is non-null here
```

---

## Interfaces vs Types

```typescript
// Use INTERFACE for object shapes (extendable)
interface Character {
  name: string;
  level: number;
  class: CharacterClass;
}

interface Wizard extends Character {
  spellbook: Spell[];
}

// Use TYPE for unions, primitives, computed types
type DamageType = 'fire' | 'cold' | 'lightning' | 'acid';
type SpellLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type CharacterStats = Pick<Character, 'name' | 'level'>;
```

---

## Utility Types

Common patterns in Aralia:

```typescript
// Partial - all properties optional
type SpellUpdate = Partial<Spell>;

// Required - all properties required
type CompleteCharacter = Required<Character>;

// Pick - subset of properties
type SpellSummary = Pick<Spell, 'name' | 'level' | 'school'>;

// Omit - exclude properties
type NewSpell = Omit<Spell, 'id'>;

// Record - typed object
type SpellsBySchool = Record<SpellSchool, Spell[]>;
```

---

## Avoid These

### `any`
```typescript
// BAD
const data: any = fetchData();
data.whatever(); // No type checking

// GOOD
const data: unknown = fetchData();
if (isValidResponse(data)) {
  data.expectedProperty; // Type-safe
}
```

### Type Assertions Without Validation
```typescript
// BAD
const user = response.data as User; // What if it's null?

// GOOD
const user = validateUser(response.data);
```

### `@ts-ignore`
```typescript
// BAD
// @ts-ignore
brokenFunction();

// GOOD
// Fix the actual type issue, or use @ts-expect-error with explanation
// @ts-expect-error - Legacy API returns string instead of number (tracked in #123)
legacyFunction();
```

### Optional Chaining to Mask Bad Types
```typescript
// BAD - hiding undefined possibility
const name = user?.profile?.name?.first ?? 'Unknown';

// GOOD - proper null handling at boundaries
function getDisplayName(user: User): string {
  if (!user.profile) return 'Anonymous';
  return user.profile.name.first;
}
```

---

## Type Exports

```typescript
// In types/spell.ts
export interface Spell {
  id: string;
  name: string;
  level: SpellLevel;
  school: SpellSchool;
}

export type SpellLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type SpellSchool = 'evocation' | 'abjuration' | /* ... */;

// Re-export from types/index.ts for clean imports
export * from './spell';
export * from './character';
```

---

*Back to [_CODEBASE.md](../_CODEBASE.md)*
