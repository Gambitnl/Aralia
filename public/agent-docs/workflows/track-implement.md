---
description: Execute the implementation plan for an active track
---

# Track Implement Workflow

Work through a track's `plan.md`, completing tasks in order with proper status updates.

---

## Prerequisites

- Track must exist at `.agent/conductor/tracks/<track-id>/`
- Track must have an approved `spec.md` and `plan.md`

---

## Steps

### 1. Load Track Context

1. Read the track's `spec.md` and `plan.md`
2. Read project context from `.agent/conductor/` (product, tech-stack, workflow)
3. Identify the next pending task (`[ ]`)

### 2. Task Execution Loop

For each pending task:

#### 2.1 Mark In Progress
Update `plan.md`: change `[ ]` to `[~]` for the current task

#### 2.2 Implement the Task
Follow the workflow defined in `.agent/conductor/workflow.md`:
- Write tests first (if TDD is enabled)
- Implement the code
- Run tests to verify
- Document any deviations

#### 2.3 Mark Complete
Update `plan.md`: change `[~]` to `[x]`

#### 2.4 Update Metadata
Update `metadata.json` with:
```json
{
  "status": "in-progress",
  "updated": "<ISO timestamp>",
  "currentPhase": "<phase name>",
  "completedTasks": <count>
}
```

### 3. Phase Completion Checkpoint

When all tasks in a phase are complete:

1. **Announce**: "Phase [X] complete. Starting verification checkpoint."
2. **Run Tests**: Execute the full test suite
3. **Propose Verification**: Give user specific steps to manually verify
4. **Await Approval**: STOP and wait for user confirmation
5. **Record**: Note the verification in `plan.md` with timestamp

### 4. Track Completion

When all phases are complete:

1. Update `metadata.json`:
   ```json
   {
     "status": "complete",
     "completed": "<ISO timestamp>"
   }
   ```

2. Update `tracks.md` index:
   Change status to `✅ Complete`

3. Summarize:
   - What was built
   - Files changed
   - Tests added
   - Any deviations from the original plan

---

## Handling Blockers

If a task cannot be completed:

1. Mark as `[!]` in `plan.md`
2. Add a blocker note: `<!-- BLOCKED: reason -->`
3. Notify the user with specifics
4. Move to next unblocked task (if any)

---

## Pausing Work

To pause mid-track:
1. Ensure current task is marked `[~]` (not left as `[ ]`)
2. Update `metadata.json` status to `"paused"`
3. Add a note in `plan.md`: `<!-- PAUSED: <timestamp> - reason -->`

Resume by running `/track-implement` again.
