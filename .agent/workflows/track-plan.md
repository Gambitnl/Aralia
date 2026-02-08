---
description: Create a new development track with spec and plan for a feature or bug fix
---

# Track Plan Workflow

Start a new track (unit of work) by generating a specification and actionable plan.

---

## Prerequisites

- `.agent/conductor/` directory must exist with product, tech-stack, and workflow docs

---

## Steps

### 1. Gather Track Information

Ask the user (or accept as input):
- **Type**: `feature` or `bug`
- **Title**: Short descriptive name (e.g., "Dark mode toggle")
- **Description**: What should be built or fixed?

### 2. Generate Track ID

Create a unique ID using format: `<type>-<timestamp>`
- Example: `feature-20260129-141600`
- Example: `bug-20260129-152300`

### 3. Create Track Directory

```
.agent/conductor/tracks/<track-id>/
├── spec.md      # Detailed requirements
├── plan.md      # Actionable task checklist
└── metadata.json
```

### 4. Generate `spec.md`

Use `.agent/templates/conductor/spec-template.md` and fill in:

```markdown
# [Track Title]

## Overview
[Brief description of the feature/bug]

## Context
[Reference to project context from product.md, relevant existing code]

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2

## Acceptance Criteria
- [ ] AC1: User can...
- [ ] AC2: System should...

## Technical Considerations
[Architecture notes, dependencies, potential risks]

## Out of Scope
[Explicit boundaries - what this track does NOT include]
```

### 5. Generate `plan.md`

Break requirements into actionable tasks using `.agent/templates/conductor/plan-template.md`:

```markdown
# Implementation Plan: [Track Title]

## Phase 1: [Phase Name]

### Tasks
- [ ] Task 1.1: Description
- [ ] Task 1.2: Description

## Phase 2: [Phase Name]

### Tasks
- [ ] Task 2.1: Description

---

## Status Legend
- `[ ]` Pending
- `[~]` In Progress
- `[x]` Complete
- `[!]` Blocked
```

### 6. Create `metadata.json`

```json
{
  "id": "<track-id>",
  "type": "feature|bug",
  "title": "<title>",
  "status": "planning",
  "created": "<ISO timestamp>",
  "updated": "<ISO timestamp>"
}
```

### 7. Update `tracks.md`

Add a row to the tracks index:
```markdown
| <track-id> | <title> | 🟡 Planning | <date> |
```

### 8. Present for Review

**STOP** and present the spec and plan to the user:
- Summarize what was created
- Ask for approval before proceeding to implementation
- User may request changes to spec or plan

---

## After Approval

Once the user approves, they can run `/track-implement` to begin work.
