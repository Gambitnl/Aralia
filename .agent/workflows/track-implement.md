---
description: Execute tasks from a track's implementation plan
---

# Track Implement Workflow

Execute tasks from a track's implementation plan.

---

## Instructions

### 1. Setup Check

Verify these exist:
- `conductor/product.md`
- `conductor/tech-stack.md`
- `conductor/workflow.md`
- `conductor/tracks.md`

If missing, halt: "Conductor is not set up. Please run `/conductor-setup` first."

### 2. Select Track

**If track name provided in `$ARGUMENTS`**:
- Search `conductor/tracks.md` for matching track (case-insensitive)
- Confirm with user: "Found track '<name>'. Is this correct?"

**If no track name provided**:
- Read `conductor/tracks.md`
- List all incomplete tracks (not marked `[x]`)
- Ask user: "Which track would you like to implement?"
  - Present options: A) Track 1, B) Track 2, etc.
- Wait for user selection before proceeding

**If no incomplete tracks found**:
- Announce: "All tracks are completed! Create a new track with `/conductor-newtrack`."
- Halt

### 3. Load Track Context

1. Get track folder path from the link in tracks.md
2. Read these files:
   - `conductor/tracks/<track_id>/spec.md` - what to build
   - `conductor/tracks/<track_id>/plan.md` - how to build it
   - `conductor/workflow.md` - development methodology

### 4. Update Track Status

Update `conductor/tracks.md` to mark track as in-progress:
- Change `- [ ] **Track:` to `- [~] **Track:`

Update `conductor/tracks/<track_id>/metadata.json`:
- Set `"status": "in_progress"`
- Update `"updated_at"` timestamp

### 5. Execute Tasks

For each task in `plan.md`:

1. **Announce the task** you're starting

2. **Mark task in-progress** in plan.md:
   - Change `- [ ] Task:` to `- [~] Task:`

3. **Implement the task** following the workflow:
   - Read the spec for requirements
   - Write code following tech-stack guidelines
   - If workflow specifies TDD, write tests first
   - Run tests to verify

4. **Verify completion**:
   - Run relevant tests
   - Check acceptance criteria from spec
   - Ensure code quality

5. **Mark task complete** in plan.md:
   - Change `- [~] Task:` to `- [x] Task:`

6. **Commit changes** (if workflow requires per-task commits):
   - Stage changed files
   - Commit with descriptive message referencing the task

7. **Move to next task**

### 6. Phase Completion

When all tasks in a phase are complete:
1. Announce phase completion
2. If workflow defines "Phase Completion Verification", ask user to verify
3. Proceed to next phase

### 7. Track Completion

When all phases are done:

1. **Update tracks.md**: Change `- [~] **Track:` to `- [x] **Track:`

2. **Update metadata.json**: Set `"status": "completed"`

3. **Sync documentation** (ask user approval for each):
   - Check if `conductor/product.md` needs updates based on new features
   - Check if `conductor/tech-stack.md` needs updates for new technologies
   - Present proposed changes and get confirmation before editing

4. **Offer cleanup**:
   > "Track complete! What would you like to do?
   > A) **Archive** - Move to conductor/archive/
   > B) **Delete** - Permanently remove
   > C) **Keep** - Leave in tracks file"

   Handle each option:
   - **Archive**: Move folder to `conductor/archive/<track_id>/`, remove from tracks.md
   - **Delete**: Confirm twice, then delete folder and remove from tracks.md
   - **Keep**: Do nothing

5. **Announce completion**: "Track '<name>' is complete!"

### 8. Error Handling

- If a task fails, stop and report the error clearly
- Ask user how to proceed:
  - Retry the task
  - Skip and continue
  - Abort implementation
- Never mark failed tasks as complete
- Log any blockers for the status report
