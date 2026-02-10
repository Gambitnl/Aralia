---
description: Initialize Conductor-style context files for the project (run once per project)
---

# Track Setup Workflow

One-time setup to establish project context files that guide all future development tracks.

---

## Steps

### 1. Check for Existing Context

First, verify if `.agent/conductor/` already exists:
- If it exists and has content, inform the user and ask if they want to regenerate
- If missing, proceed to create

### 2. Create Context Directory

```
.agent/conductor/
├── product.md          # Project goals, users, high-level features
├── tech-stack.md       # Languages, frameworks, database choices
├── workflow.md         # Team preferences (TDD, commit strategy, etc.)
├── tracks.md           # Index of all tracks (features/bugs)
└── styleguides/        # Code style rules by language
```

### 3. Generate `product.md`

Ask the user or infer from existing documentation:
- What is this project?
- Who are the users?
- What are the core features?
- What are the product goals?

Write to `.agent/conductor/product.md`.

### 4. Generate `tech-stack.md`

Analyze the codebase and document:
- Primary language(s)
- Framework(s)
- Build tools
- Testing tools
- Database (if any)
- Key dependencies

Write to `.agent/conductor/tech-stack.md`.

### 5. Generate `workflow.md`

Define the development workflow:
- Task lifecycle (`[ ]` → `[~]` → `[x]`)
- Testing requirements (TDD optional)
- Commit message format
- Code review process
- Definition of done

Use `.agent/templates/conductor/workflow-template.md` as a starting point.

### 6. Initialize `tracks.md`

Create an empty tracks index:
```markdown
# Tracks

| ID | Name | Status | Created |
|----|------|--------|---------|
```

### 7. Confirm Completion

Report to the user what was created and remind them:
- These files guide all future `/track-plan` work
- Update `tech-stack.md` if adding new dependencies
- Update `workflow.md` to customize the development process
