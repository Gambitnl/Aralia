---
description: Display the current progress of all tracks in this project
---

# Track Status Workflow

Display the current progress of all tracks in this project.

---

## Instructions

### 1. Verify Setup

Check that these files exist:
- `conductor/tracks.md`
- `conductor/product.md`
- `conductor/tech-stack.md`
- `conductor/workflow.md`

If any are missing, inform the user: "Conductor is not set up. Please run `/conductor-setup` first."

### 2. Read Tracks Registry

Read `conductor/tracks.md` and parse all tracks. Look for entries in format:
- `- [ ] **Track: <Description>**` (pending)
- `- [~] **Track: <Description>**` (in progress)
- `- [x] **Track: <Description>**` (completed)

### 3. Read Each Track's Plan

For each track found, read its `conductor/tracks/<track_id>/plan.md` file.

### 4. Parse and Count Tasks

For each plan, count:
- Tasks marked `[ ]` = pending
- Tasks marked `[~]` = in progress
- Tasks marked `[x]` = completed

### 5. Present Status Report

Present the status in this format:

```
## Conductor Status Report
**Date**: [current date/time]

### Overall Progress
- **Tracks**: X total (Y completed, Z in progress, W pending)
- **Tasks**: X total (Y completed, Z in progress, W pending)
- **Progress**: XX%

### Current Work
- **Active Track**: [track name or "None"]
- **Current Task**: [task name or "None"]
- **Next Action**: [next pending task]

### Track Details
1. [x] **Track: <name>** - Completed
2. [~] **Track: <name>** - In Progress (X/Y tasks done)
3. [ ] **Track: <name>** - Pending
```

### 6. Highlight Blockers

If any tasks mention blockers, list them separately.
