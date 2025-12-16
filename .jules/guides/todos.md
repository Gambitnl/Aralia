# TODO System Guide

How to create, route, and resolve TODOs in Aralia.

---

## Self-Check Prompts

Ask yourself when encountering or creating TODOs:

> "Is this actionable, or am I just venting into a comment?"
> "Does this belong to my domain, or should I route it to another persona?"
> "If I'm resolving this, have I actually done the work - or just deleted the comment?"
> "Is this TODO still relevant? Code might have changed since it was written."

These are prompts for reflection, not rigid rules.

---

## TODO Format

### Basic
```typescript
// TODO: Brief, actionable description
```

### With Persona Routing
```typescript
// TODO(Oracle): Add proper return type to this function
// TODO(Vanguard): Add test coverage for this edge case
// TODO(Gardener): This duplicates logic in utils/spellHelpers.ts
// TODO(Vector): Verify this matches 5e SRD rules
// TODO(Scribe): This function needs JSDoc
```

### With Priority (Optional)
```typescript
// TODO: [P0] Critical - blocks functionality
// TODO: [P1] Important - should fix soon
// TODO: [P2] Nice to have - when time permits
```

---

## Other Markers

```typescript
// FIXME: Something is broken and needs fixing NOW
// HACK: Temporary workaround - explain WHY it's needed
// XXX: Dangerous or problematic code - needs attention
// NOTE: Not a task, just context for future readers
```

---

## Creating TODOs

### Good TODOs
```typescript
// TODO: Handle empty spell list with EmptyState component
// TODO(Vector): Damage calculation doesn't account for resistance
// TODO: [P1] Add loading state while fetching spells
```

### Bad TODOs
```typescript
// TODO: Fix this (fix what?)
// TODO: Make better (how?)
// TODO: ??? (not actionable)
// TODO: Refactor everything (too vague, too big)
```

### When to Create
- You notice something outside your current scope
- You're making a tradeoff to ship now
- You want to flag something for another persona
- You find a bug but can't fix it right now

---

## Resolving TODOs

### The Process
1. **Understand** - Read the context, understand what's needed
2. **Verify** - Is this TODO still relevant? Code may have changed
3. **Implement** - Do the actual work
4. **Test** - Ensure functionality works
5. **Delete** - Remove the TODO comment entirely

### Important
```typescript
// WRONG: Deleting without doing work
// Before: // TODO: Add validation
// After: (comment deleted, no validation added)

// WRONG: Replacing with another TODO
// Before: // TODO: Implement this
// After: // TODO: Finish implementing this

// RIGHT: Do the work, then delete
// Before: // TODO: Add validation
// After: if (!isValid(input)) throw new Error('Invalid input');
```

---

## When You Think a TODO Is Already Done

Don't just delete it. Add a timestamped remark:

```typescript
// TODO: Add validation
// RESOLVED? [2025-12-16] - Oracle: Validation exists in parent component (CharacterForm.tsx:45)
```

The next persona to encounter this:
1. Verifies the claim
2. If truly resolved: deletes both lines
3. If not resolved: removes the RESOLVED? line, leaves TODO

---

## Finding TODOs

```bash
# All TODOs
grep -r "TODO\|FIXME\|HACK\|XXX" src/

# TODOs for a specific persona
grep -r "TODO(Oracle)" src/
grep -r "TODO(Vanguard)" src/

# TODOs with priority
grep -r "TODO:.*\[P0\]" src/
```

---

## Routing Guide

| Domain | Route To |
|--------|----------|
| Type errors, generics | `TODO(Oracle)` |
| Missing tests | `TODO(Vanguard)` |
| Documentation | `TODO(Scribe)` |
| Dead code, cleanup | `TODO(Gardener)` |
| Performance | `TODO(Bolt)` |
| Accessibility | `TODO(Palette)` |
| Security | `TODO(Sentinel)` |
| D&D rules accuracy | `TODO(Vector)` |
| Error handling | `TODO(Warden)` |
| State management | `TODO(Steward)` |
| Build/config | `TODO(Forge)` |

See [_ROSTER.md](../_ROSTER.md) for complete persona list.

---

## TODO Hygiene

- Don't leave TODOs in code you're actively working on
- If you create a TODO, it should be for *later* or *someone else*
- Stale TODOs (6+ months) should be evaluated: still relevant?
- Large TODOs should be broken down or moved to an issue

---

*Back to [_METHODOLOGY.md](../_METHODOLOGY.md)*
