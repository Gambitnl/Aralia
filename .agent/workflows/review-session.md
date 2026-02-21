---
description: Review session work and propose inline TODO comments, then apply them on approval.
chain: tidy-up
chain_via: session-ritual
---

# Review Session Workflow

A two-phase workflow for reviewing code changes and adding inline TODO comments.

---

## Phase 1: Review & Propose

**Goal**: Review the session's work and propose improvements without editing code.

### Steps

1.  **Identify Modified Files**
    - Scan the conversation for all code files that were edited.
    - Exclude: `.gitignore`d files, non-code files (`.md`, `.json` config, etc.).
    - Include: `.ts`, `.tsx`, `.css`, `.html`, etc.

2.  **Re-read Each File**
    - Read each modified file to confirm current state.
    - Do NOT assume previous memory is accurate — always verify.

3.  **Analyze for Quality Issues**

    Use the **Red Flags Checklist** from `.agent/skills/code_commentary/SKILL.md` as the
    primary scan. Then check for these additional quality concerns in priority order:

    **Quality concerns:**
    - Code quality (DRY violations, dead code, clarity)
    - Bugs/risks (edge cases, missing error handling)
    - Missing tests or documentation
    - Architectural concerns (coupling, patterns)
    - Performance issues

    **Vision alignment:**
    - Does this serve the game's vision? (see `docs/VISION.md`)
    - Is it consistent with D&D principles?
    - Does it add mechanical weight, not just description?

4.  **Apply Growth-First Philosophy**

    Propose **additive improvements** — extend, enhance, augment. Avoid cleanup for cleanup's sake.

    | Avoid | Prefer |
    |-------|--------|
    | "Delete this unused function" | "Add error handling here" |
    | "Remove this for cleanliness" | "Add a test for this case" |
    | "Stub/mock this out" | "Add documentation" |

    **Consolidation Exception**: If code is **superseded** by a newer implementation doing the same job, mark the old code for cleanup. Don't keep duplicate implementations.

5.  **Draft Proposals**
    - Output up to **5 high-value proposals** as text blocks.
    - **At least 1 must be a creative idea**: A feature enhancement, gameplay improvement, or UI idea.
    ```
    Proposal 1
    File: src/components/Foo.tsx
    Line: ~42 (above handleClick function)
    Comment: // TODO: Add error boundary for async state updates
    Rationale: If fetchData fails, the component silently swallows the error.
    ```

6.  **STOP. Do NOT apply edits.**
    - Present proposals as text only.
    - Wait for explicit user approval.
    - Phase 2 writes TODOs, not implementations.

---

## Phase 2: Apply TODOs

**Trigger**: User approves proposals (e.g., "apply them all").

### Steps

1.  **Verify Before Editing**
    - Before applying each comment, re-read the target file to check the location is still correct.

2.  **Handle Existing Comments**
    - If an equivalent comment already exists: Skip it.
    - If a similar but weaker comment exists: Replace with the more detailed version.
    - If no comment exists: Insert the TODO directly above the relevant line.

3.  **Apply Edits**
    - Edit one file at a time.
    - Do NOT make other changes — only insert the approved TODO comments.

4.  **Confirm Completion**
    - Summarize what was added and where.
