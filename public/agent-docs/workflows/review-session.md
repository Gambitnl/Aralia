---
description: Review session work and propose inline TODO comments, then apply them on approval.
---

# Review Session Workflow

A two-phase workflow for reviewing the session's code changes and adding inline TODO comments.


---

## Phase 1: Review & Propose

**Goal**: Conduct a thorough review of the session's work and propose improvements without editing code.

### Steps

1.  **Identify Modified Files**
    - Scan the conversation for all code files that were edited.
    - Exclude: `.gitignore`d files, non-code files (`.md`, `.json` config, etc.).
    - Include: `.ts`, `.tsx`, `.py`, `.css`, `.html`, etc.

2.  **Re-read Each File**
    - Use `view_file` to confirm current state, line numbers, and logic.
    - Do NOT assume previous memory is accurate—always verify.

3.  **Analyze for Improvements**
    - Code quality (DRY violations, dead code, clarity)
    - Bugs/risks (edge cases, missing error handling)
    - Missing tests or documentation
    - Architectural concerns (coupling, patterns)
    - Performance issues

4.  **Apply Growth-First Philosophy**
    Propose **additive improvements**—extend, enhance, augment. Avoid "cleanup for cleanup's sake."
    
    | ❌ Avoid | ✅ Prefer |
    |----------|-----------|
    | "Delete this unused function" | "Add error handling here" |
    | "Remove this for cleanliness" | "Add a test for this case" |
    | "Stub/mock this out" | "Add documentation" |
    
    **Consolidation Exception**: If code is **superseded** by a newer implementation that does the same job (same feature, same purpose), mark the old code for cleanup. Don't keep duplicate/competing implementations—that causes bloat and confusion.
    
    *In short*: Grow outward, but don't hoard dead weight.

5.  **Draft Proposals**
    - Output up to **5 high-value proposals** as text blocks.
    - **At least 1 must be a creative idea**: A feature enhancement, gameplay improvement, aesthetic polish, or UI functionality idea. Something that says *"this could be great here."*
    ```
    📝 Proposal 1
    File: src/components/Foo.tsx
    Line: ~42 (above handleClick function)
    Comment: // TODO: Add error boundary for async state updates
    Rationale: If fetchData fails, the component silently swallows the error.
    ```

6.  **STOP. Do NOT apply edits.**
    - Present proposals as text only.
    - Wait for explicit user approval (e.g., "apply them").
    - **Do NOT fix the issues directly.** Phase 2 writes TODOs, not implementations.

---

## Phase 2: Apply TODOs

**Trigger**: User approves proposals (e.g., "apply them all").

### Steps

1.  **Review Before Action**
    - Before applying each comment, `view_file` to check the target location again.

2.  **Handle Existing Comments**
    - If an **equivalent comment already exists**: Skip it.
    - If a **similar but weaker comment exists**: Amend/replace with the more detailed version.
    - If **no comment exists**: Insert the TODO directly above the relevant line.

3.  **Execute Edits**
    - Use `replace_file_content` or `multi_replace_file_content` to apply.
    - Do NOT make concurrent edits to the same file—edit one file at a time.

4.  **Confirm Completion**
    - After all TODOs are applied, summarize what was added and where.
