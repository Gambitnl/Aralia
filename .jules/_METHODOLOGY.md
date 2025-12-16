# Aralia Development Methodology

Process guidelines for all personas. Start here, dive into guides as needed.

---

## Verification Checklist

Before any PR:
- [ ] `pnpm build` passes
- [ ] `pnpm test` passes
- [ ] No `console.log` left behind
- [ ] Changes < 50 lines (or justified)

---

## Guides

### Code Workflow

| Topic | Guide | Summary |
|-------|-------|---------|
| Testing | [testing.md](guides/testing.md) | When to test, test structure, running tests |
| PR Workflow | [pr-workflow.md](guides/pr-workflow.md) | PR size, titles, descriptions, review process |
| Feature Discovery | [feature-discovery.md](guides/feature-discovery.md) | Finding work, claiming tasks, grep commands |

### Code Maintenance

| Topic | Guide | Summary |
|-------|-------|---------|
| TODOs | [todos.md](guides/todos.md) | TODO format, persona routing, lifecycle |
| Comments | [comments.md](guides/comments.md) | When to comment, JSDoc, inline comments |
| Refactoring | [refactoring.md](guides/refactoring.md) | Green/yellow/red light, steps, PR scope |
| Deprecation | [deprecation.md](guides/deprecation.md) | Marking deprecated, migration, removal |

---

## Quick TODO Reference

```typescript
// TODO: Brief description
// TODO(Persona): Routes to specific persona
// FIXME: Something broken
// HACK: Temporary workaround
```

See [todos.md](guides/todos.md) for full protocol.

---

## Quick PR Title Format

```
[emoji] Persona: Brief description

Examples:
🔮 Oracle: Add return types to spell utilities
🎯 Hunter: Resolve TODO in damage calculation
```

See [pr-workflow.md](guides/pr-workflow.md) for full guidelines.

---

*See [_CODEBASE.md](_CODEBASE.md) for technical standards.*
*See [_ROSTER.md](_ROSTER.md) for persona domains.*
