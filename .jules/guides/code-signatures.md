# Code Signatures Guide

**All personas MUST sign their code changes.** This enables automated conflict detection and resolution.

---

## How to Sign Your Code

### For Single Lines or Small Changes

```typescript
// [PERSONA_NAME] Brief description of what this does
export const myNewFeature = true;
```

### For Functions or Blocks

```typescript
/**
 * @persona PERSONA_NAME
 * @intent What you're trying to accomplish
 */
export function myFunction() {
  // implementation
}
```

### For Type Definitions

```typescript
// [PERSONA_NAME] Added for ritual interruption support
export interface RitualState {
  interrupted: boolean;    // [RITUALIST]
  interruptedAt?: number;  // [RITUALIST]
}
```

---

## Examples by Persona

| Persona | Signature |
|---------|-----------|
| Ritualist | `// [RITUALIST]` |
| Warlord | `// [WARLORD]` |
| Oracle | `// [ORACLE]` |
| Chronicler | `// [CHRONICLER]` |

Use your persona name in **UPPERCASE** inside square brackets.

---

## Why This Matters

When two personas edit the same file, the automated conflict detection:

1. **Reads the signatures** to know who made each change
2. **Assigns priority** (lower PR number wins by default)
3. **Posts resolution instructions** to the "losing" PR
4. **Preserves intent** via worklog entries

Without signatures, the system can't identify who to notify or what the intent was.

---

## What Happens in a Conflict

If your code conflicts with another persona's:

1. You'll receive a comment on your PR with:
   - The other persona's name
   - Their code changes
   - Instructions to revert and defer

2. You should:
   - Revert your changes to the conflicting file
   - Add a worklog entry documenting your intent
   - Push the reverted changes

3. Your work is NOT lost:
   - The worklog preserves what you wanted to do
   - You can pick it up in the next batch after the conflict resolves

---

## Signing Checklist

Before pushing your PR:

- [ ] Every new function has a `@persona` JSDoc tag or `// [NAME]` comment
- [ ] Every modified line in shared files has a trailing `// [NAME]` comment
- [ ] Complex changes have a block comment explaining intent

---

## Anti-Patterns

❌ **Don't do this:**
```typescript
// Added new feature
export const feature = true;
```

✅ **Do this instead:**
```typescript
// [WARLORD] Added combat pause feature for tactical retreats
export const feature = true;
```
