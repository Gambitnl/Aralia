# Deprecation Guide

How to deprecate and remove code in Aralia.

---

## Self-Check Prompts

Ask yourself when deprecating:

> "Have I provided a clear migration path to the replacement?"
> "Is there any external code (or other personas) that might still use this?"
> "Am I deprecating because it's unused, or because there's something better?"
> "How long should the deprecation period be? Is there urgency?"

Deprecation is a kindness - it gives time to migrate. Don't skip it for shared code.

---

## When to Deprecate vs Delete

### Just Delete

- Truly unused code (no callers anywhere)
- Private/internal functions only used in one file
- Dead code from a previous feature that was removed
- Commented-out code (git has history)

```bash
# Verify no usages before deleting
grep -r "functionName" src/
```

### Deprecate First

- Exported/public functions
- Utilities used across multiple files
- Hooks used by components
- Types used in multiple places
- Anything another persona might be using

---

## Deprecation Process

### Step 1: Mark with JSDoc

```typescript
/**
 * @deprecated Use `calculateSpellSaveDC` instead. Will be removed in next major release.
 *
 * Migration:
 * - Old: getSpellDC(caster)
 * - New: calculateSpellSaveDC(caster, spell)
 */
export function getSpellDC(caster: Character): number {
  // Keep working implementation
  return calculateSpellSaveDC(caster, defaultSpell);
}
```

### Step 2: Add Console Warning (Optional)

For heavily used functions, add runtime warning:

```typescript
/**
 * @deprecated Use `calculateSpellSaveDC` instead.
 */
export function getSpellDC(caster: Character): number {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      'getSpellDC is deprecated. Use calculateSpellSaveDC instead. ' +
      'See migration guide: .jules/guides/deprecation.md'
    );
  }
  return calculateSpellSaveDC(caster, defaultSpell);
}
```

### Step 3: Migrate Internal Usages

Update all usages within the codebase to use the new API:

```bash
# Find all usages
grep -r "getSpellDC" src/

# Update each one
# Old: const dc = getSpellDC(caster);
# New: const dc = calculateSpellSaveDC(caster, spell);
```

### Step 4: Wait

- **Internal code**: 1-2 weeks minimum
- **Shared utilities**: 1 release cycle
- **Public API**: Announce in changelog, wait for next major version

### Step 5: Remove

After deprecation period:
1. Delete the deprecated code
2. Remove from exports
3. Update changelog
4. Search for any remaining usages (should be none)

---

## Deprecation JSDoc Template

```typescript
/**
 * @deprecated [Since version X.Y.Z] Use `newFunction` instead.
 *
 * Reason: [Why is this being deprecated]
 *
 * Migration:
 * ```typescript
 * // Before
 * oldFunction(arg1, arg2);
 *
 * // After
 * newFunction({ param1: arg1, param2: arg2 });
 * ```
 *
 * Removal: Scheduled for [version/date]
 */
```

---

## Deprecating Types

```typescript
/**
 * @deprecated Use `Spell` type instead. This type lacks required fields.
 */
export interface LegacySpell {
  name: string;
  level: number;
}

// Provide migration utility if helpful
export function migrateToSpell(legacy: LegacySpell): Spell {
  return {
    ...legacy,
    id: generateId(),
    school: 'evocation', // default
    // ... other required fields
  };
}
```

---

## Deprecating Components

```typescript
/**
 * @deprecated Use `<SpellCard />` instead. This component will be removed.
 *
 * Migration:
 * - `<OldSpellDisplay spell={s} />` → `<SpellCard spell={s} variant="compact" />`
 */
export function OldSpellDisplay(props: OldSpellDisplayProps) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('OldSpellDisplay is deprecated. Use SpellCard instead.');
  }

  // Wrapper that uses new component
  return <SpellCard {...props} variant="compact" />;
}
```

---

## Communicating Deprecations

### In Code
- `@deprecated` JSDoc tag
- Console warnings in development
- TypeScript `@deprecated` triggers IDE strikethrough

### In PR
```markdown
## Deprecation Notice

This PR deprecates `getSpellDC` in favor of `calculateSpellSaveDC`.

**Why:** The old function didn't account for spell-specific modifiers.

**Migration:** See updated JSDoc on the function.

**Removal:** Planned for v2.0.0 or 2025-02-01, whichever is later.
```

### In Changelog
```markdown
### Deprecated
- `getSpellDC()` - Use `calculateSpellSaveDC()` instead (#123)
```

---

## Don't Do This

```typescript
// BAD: Delete without deprecation period
// (breaks anyone using the old API)

// BAD: Deprecate without replacement
/** @deprecated Don't use this anymore */
// (use WHAT instead?)

// BAD: Silent deprecation
// (no JSDoc, no console warning, just suddenly removed)

// BAD: Eternal deprecation
/** @deprecated Since 2019 */
// (if nothing uses it, just remove it)
```

---

*Back to [_METHODOLOGY.md](../_METHODOLOGY.md)*
