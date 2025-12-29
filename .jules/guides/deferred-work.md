# Deferred Work Log Format

When a conflict requires you to revert your changes, document your intent here for future follow-up.

---

## Template

```markdown
## YYYY-MM-DD - Deferred: [Brief Title]

**Conflict with:** [PERSONA_NAME] (PR #XXX)
**File:** path/to/file.ts
**Lines:** XX-YY

**My Intent:**
[Describe what you were trying to accomplish]

**Code I Intended to Add:**
```typescript
// Your code here
```

**Deferred to:** Next batch after PR #XXX merges

**Follow-up Notes:**
[Any additional context for when you pick this up later]
```

---

## Example Entry

```markdown
## 2025-12-29 - Deferred: Ritual Pause Status

**Conflict with:** RITUALIST (PR #851)
**File:** src/types/rituals.ts
**Lines:** 65-72

**My Intent:**
Add a 'paused' status to RitualState for tactical combat situations where a ritual is temporarily suspended but not cancelled.

**Code I Intended to Add:**
```typescript
export type RitualStatus = 'active' | 'completed' | 'interrupted' | 'paused';

export interface RitualState {
  status: RitualStatus;
  pausedAt?: number;
  pauseReason?: string;
}
```

**Deferred to:** Next batch after PR #851 merges

**Follow-up Notes:**
- RITUALIST is adding 'interrupted' status which is similar but different
- Consider merging 'paused' and 'interrupted' into one concept
- May need to coordinate with RITUALIST on the final design
```

---

## Where to Log

Add deferred work entries to your persona's worklog:

`.jules/worklogs/worklog_[persona].md`

Example: `.jules/worklogs/worklog_warlord.md`

---

## Picking Up Deferred Work

In your next batch run:

1. Check your worklog for "Deferred" entries
2. Verify the blocking PR has merged
3. Implement your deferred changes (with awareness of what changed)
4. Remove the "Deferred" entry once done (or mark as "Completed")
