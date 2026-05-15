# Scribe's Journal

> **Instructions**: Before adding an entry, run `date` in terminal to get today's date.
> Only record CRITICAL learnings - patterns worth reusing, not routine work.

## Entry Templates

### Learning Entry
```
## YYYY-MM-DD - [Title]
**Learning:** [What insight did you gain?]
**Action:** [How to apply this next time]
```

### Future TODO
```
## TODO: [Brief Title]
**Context:** [Why is this needed?]
**Plan:** [Steps to implement]
**Status:** Pending
```

---

<!-- Add new entries below this line -->

## TODO: Link `@JULES-WORKFLOW-GUIDE.md` across Agent and Documentation Surfaces
**Context:** The `docs/@JULES-WORKFLOW-GUIDE.md` document exists to provide situational Jules-specific coordination notes, but it is currently unlinked from key agent-facing and documentation entry points. To improve discoverability without making it a universal workflow authority, it should be referenced where appropriate.
**Plan:**
1. In `docs/@AI-PROMPT-GUIDE.md`, append `[@JULES-WORKFLOW-GUIDE.md](./@JULES-WORKFLOW-GUIDE.md) for Jules-specific coordination patterns` to the "Related Docs" section.
2. In `AGENTS.md`, under "Good starting surfaces", add a bullet point linking to `docs/@JULES-WORKFLOW-GUIDE.md`.
3. In `docs/AGENT.md` (the compatibility pointer), add `[./@JULES-WORKFLOW-GUIDE.md](./@JULES-WORKFLOW-GUIDE.md) for historical Jules workflow context` to the "Use these docs instead" list.
4. In `.jules/_METHODOLOGY.md`, potentially link it under a "Coordination" or "Guides" section for personas to reference when dealing with parallel work and registry file conflicts.
**Status:** Pending
