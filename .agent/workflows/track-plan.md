---
description: Create a new track (feature, bug fix, or chore) with specification and implementation plan
---

# Track Plan Workflow

Create a new track (feature, bug fix, or chore) with specification and implementation plan.

---

## Instructions

### 1. Setup Check

Verify these files exist:
- `conductor/product.md`
- `conductor/tech-stack.md`
- `conductor/workflow.md`

If missing, halt and say: "Conductor is not set up. Please run `/conductor-setup` first."

### 2. Get Track Description

- If `$ARGUMENTS` contains a description, use it
- If empty, ask: "Please provide a brief description of the track (feature, bug fix, chore) you want to create."

### 3. Load Project Context

Read and understand:
- `conductor/product.md` - product vision
- `conductor/tech-stack.md` - technologies used
- `conductor/workflow.md` - development workflow

### 4. Interactive Specification (spec.md)

Announce: "I'll guide you through creating a specification for this track."

Ask 3-5 questions sequentially (one at a time) to gather:
- Detailed requirements
- Acceptance criteria
- Edge cases
- Out of scope items

For each question, provide 2-3 suggested options plus "Type your own answer".

After gathering info, draft the spec.md with sections:
- **Overview**: Brief description
- **Functional Requirements**: What it must do
- **Non-Functional Requirements**: Performance, security, etc.
- **Acceptance Criteria**: How to verify completion
- **Out of Scope**: What this track does NOT include

Present draft and ask for approval. Revise if needed.

### 5. Generate Implementation Plan (plan.md)

Read `conductor/workflow.md` to understand the development methodology.

Generate plan.md with Phases, Tasks, and Sub-tasks using this format:

```markdown
# Implementation Plan: [Track Name]

## Phase 1: [Phase Name]
- [ ] Task: [Description]
    - [ ] Sub-task 1
    - [ ] Sub-task 2
- [ ] Task: [Next task]

## Phase 2: [Phase Name]
...
```

**CRITICAL**: Include `[ ]` status markers for EVERY task and sub-task.

If workflow specifies TDD, each feature task should have:
- [ ] Write tests
- [ ] Implement feature

Present draft and ask for approval.

### 6. Create Track Artifacts

1. **Generate Track ID**: `shortname_YYYYMMDD` (e.g., `auth_flow_20260129`)

2. **Check for duplicates**: List `conductor/tracks/` and ensure no duplicate short names exist

3. **Create directory**: `conductor/tracks/<track_id>/`

4. **Create metadata.json**:
```json
{
  "track_id": "<track_id>",
  "type": "feature",
  "status": "new",
  "created_at": "YYYY-MM-DDTHH:MM:SSZ",
  "updated_at": "YYYY-MM-DDTHH:MM:SSZ",
  "description": "<description>"
}
```

5. **Create index.md**:
```markdown
# Track <track_id> Context

- [Specification](./spec.md)
- [Implementation Plan](./plan.md)
- [Metadata](./metadata.json)
```

6. **Write spec.md and plan.md** with approved content

7. **Update tracks registry**: Append to `conductor/tracks.md`:
```markdown

---

- [ ] **Track: <Track Description>**
  *Link: [./tracks/<track_id>/](./tracks/<track_id>/)*
```

### 7. Announce Completion

"New track `<track_id>` has been created and added to the tracks file. You can now start implementation by running `/conductor-implement`."
