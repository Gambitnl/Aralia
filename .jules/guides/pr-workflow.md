# PR Workflow Guide

How to create and manage pull requests in Aralia.

---

## Self-Check Prompts

Ask yourself before creating a PR:

> "Does this PR do ONE thing well, or am I bundling multiple changes?"
> "Have I run build and tests? Are they passing?"
> "Would a reviewer understand the *why* from my description?"
> "Is there anything I'm not confident about that I should flag?"

PRs are communication. Make them clear and focused.

---

## Before Creating PR

### Required Checks

```bash
npm run build    # Must pass - no TypeScript errors
npm test     # Must pass - no regressions
npm run lint     # Should pass - clean code
```

### Pre-PR Cleanup

- [ ] No `console.log` statements
- [ ] No commented-out code
- [ ] No `@ts-ignore` without explanation
- [ ] No TODO for work you just did (either do it or don't)
- [ ] Changes focused on one concern

---

## PR Size Guidelines

| Size | Lines | Guidance |
|------|-------|----------|
| Ideal | < 50 | Easy to review, quick to merge |
| Acceptable | 50-200 | Should have clear reason |
| Split it | > 200 | Break into smaller PRs |

**File count cap:** 10 files max per PR. If you exceed 10 files, split into multiple PRs or request a Coordinator exception.

**Exceptions:**
- Pure renames/moves can be larger
- Generated code (spell data, etc.)
- Necessary refactors that can't be split

---

## PR Title Format

```
[emoji] Persona: Brief description
```

### Examples

```
🔮 Oracle: Add return types to spell utilities
🎯 Hunter: Resolve TODO in damage calculation
🌿 Gardener: Remove unused character helpers
⚔️ Vanguard: Add tests for spell slot tracking
⚡ Bolt: Memoize expensive spell list filtering
🎨 Palette: Add keyboard navigation to spell picker
📜 Scribe: Document spell validation schema
🛡️ Sentinel: Sanitize user input in search
📐 Vector: Fix AC calculation for medium armor
🎭 Bard: Improve error messages for failed spell cast
```

---

## PR Description Template

```markdown
### 💡 What
[One sentence: what this PR changes]

### 🎯 Why
[The problem this solves, TODO this resolves, or improvement this makes]

### ✅ Verification
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Manual testing done (if UI change)

### 🔍 How to Test
[Steps a reviewer can follow to verify the change]

### 📎 Related
- Resolves TODO in `src/utils/spells.ts:42`
- Related to #123
- Part of spell system refactor
```

---

## PR Etiquette

### As Author

- **Respond to feedback** - Don't let comments linger
- **Be open to suggestions** - Code review is collaborative
- **Keep PRs updated** - Rebase if main has diverged significantly
- **Small iterations** - Multiple small PRs > one big PR

### As Reviewer

- **Be constructive** - Suggest improvements, don't just criticize
- **Ask questions** - "Why did you choose X?" not "X is wrong"
- **Approve when ready** - Don't block on nitpicks
- **Focus on behavior** - Style is handled by linting

---

## Branch Naming

```
[persona]/[brief-description]

Examples:
oracle/add-spell-types
hunter/resolve-todo-damage-calc
gardener/cleanup-unused-helpers
vanguard/test-spell-slots
```

---

## Commit Messages

```
[type]: Brief description

Types:
- feat: New feature
- fix: Bug fix
- refactor: Code restructure (no behavior change)
- test: Adding tests
- docs: Documentation
- chore: Maintenance (deps, config)
```

### Examples

```
feat: Add resistance calculation to damage
fix: Correct AC formula for medium armor
refactor: Extract spell slot logic to hook
test: Add coverage for cantrip scaling
docs: Update spell validation schema docs
chore: Update vitest to 1.2.0
```

---

## Handling Feedback

### When You Agree
```
Good catch! Fixed in [commit hash].
```

### When You Disagree
```
I see your point, but I chose X because [reason].
Happy to discuss if you think Y is better.
```

### When You're Unsure
```
Not sure about the best approach here.
Options I considered:
1. [Option A] - pros/cons
2. [Option B] - pros/cons
What do you think?
```

---

## Merging

### Squash Merge (Default)
- Combines all commits into one
- Clean history
- Use for most PRs

### Merge Commit
- Preserves individual commits
- Use for large PRs where history matters

### Rebase
- Linear history
- Use when history is already clean

---

## After Merge

- [ ] Delete the branch (GitHub does this automatically)
- [ ] Verify deploy/build succeeded
- [ ] If PR introduced TODO for follow-up, create it now
- [ ] Update any related documentation if needed

---

## When Blocked or Uncertain

Not every task should become a PR. Know when to stop:

| Situation | Action |
|-----------|--------|
| Ambiguous requirements | **Stop and ask** - Don't guess |
| Conflicting patterns in codebase | Document both, pick the more common |
| Changes cascading > 100 lines | Propose breakdown first |
| Missing context you can't find | Leave it for someone with more context |
| Outside your domain | Leave a `TODO(Persona)` and move on |

### It's Okay To

- Finish a run with no PR (if no suitable work found)
- Abandon a branch that grew too complex
- Ask for help or clarification
- Say "I don't know enough to do this safely"

### Don't

- Guess at requirements and hope you're right
- Make sweeping changes to "fix" unclear code
- Create a PR you're not confident in
- Force a solution that doesn't fit

---

*Back to [_METHODOLOGY.md](../_METHODOLOGY.md)*
