# Task XX: [Task Name]

**Last Updated**: 2026-03-11  
**Purpose**: Template for creating historical or active spell-overhaul task docs without depending on the missing older spell-research reference.

**Epic:** Spell System Overhaul  
**Phase:** [1-5] - [Phase Name]  
**Complexity:** [Low/Medium/High]  
**Estimated Effort:** [X] days  
**Priority:** [P0/P1/P2]  
**Dependencies:** [Task ##, Task ##]

---

## Objective

[One paragraph describing what this task accomplishes]

---

## Context

[Why this task is needed, current state, pain points]

**Reference:** [SPELL_SYSTEM_ARCHITECTURE.md](../../architecture/SPELL_SYSTEM_ARCHITECTURE.md)

---

## Requirements

### 1. [Requirement Category]
- Template item: Specific requirement 1
- Template item: Specific requirement 2
- Template item: Specific requirement 3

### 2. [Requirement Category]
- Template item: Specific requirement 1
- Template item: Specific requirement 2

---

## Implementation Details

### File Structure

```text
src/
  [directory]/
    [file].ts
    __tests__/
      [file].test.ts
```

### Core Implementation

```typescript
// src/[path]/[file].ts

[Code example or interface definition]
```

---

## Testing Requirements

### Unit Tests

```typescript
describe('[Component]', () => {
  it('should [behavior]', () => {
    // Test implementation
  })
})
```

### Integration Tests (if applicable)

```typescript
describe('[Component] Integration', () => {
  it('should [end-to-end behavior]', () => {
    // Integration test
  })
})
```

---

## Acceptance Criteria

- Template item: Criterion 1
- Template item: Criterion 2
- Template item: All relevant tests pass
- Template item: TypeScript types are correct
- Template item: Documentation is updated where needed

---

## Files to Create

- `src/[path]/[file].ts`
- `src/[path]/__tests__/[file].test.ts`

---

## Files to Modify

- `src/[path]/[file].ts` - [What changes]

---

## References

- [SPELL_SYSTEM_ARCHITECTURE.md](../../architecture/SPELL_SYSTEM_ARCHITECTURE.md)
- [External Reference](https://example.com)

---

## Estimated Breakdown

- **Day 1:** [Scope] ([X]h)
- **Day 2:** [Scope] ([X]h)
- **Buffer:** [X]h for debugging

**Total:** [XX] hours over [X] days

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-system-overhaul/TASK-TEMPLATE.md","sha256WithoutMarker":"25a4627356d2749b5c9ee9fd8146e141b483d36d75ce690bb1351fd84a02731e","markedAtUtc":"2026-06-25T22:29:38.595Z"} -->
