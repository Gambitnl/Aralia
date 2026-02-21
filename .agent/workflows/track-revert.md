---
description: Revert work at the track, phase, or task level using Git history
---

# Track Revert Workflow

Revert work at the track, phase, or task level using Git history.

---

## Instructions

### 1. Setup Check

Verify `conductor/tracks.md` exists and contains tracks.

If missing or empty: "The project has not been set up or has no tracks. Please run `/conductor-setup` first."

### 2. Select Revert Target

**If target provided in `$ARGUMENTS`:**
1. Search tracks.md and plan.md files for matching track/phase/task
2. Confirm: "You want to revert [Track/Phase/Task]: '<name>'. Is this correct? (yes/no)"
3. If confirmed, proceed. If not, ask for clarification.

**If no target provided:**
1. Scan all tracks and plans for:
   - Items marked `[~]` (in-progress) - prioritize these
   - If none, show 5 most recently completed `[x]` items

2. Present menu:
   ```
   I found these items. Which would you like to revert?

   Track: feature_auth_20260129
     A) [Phase] Backend API Implementation
     B) [Task] Create user authentication endpoint

   Track: ui_update_20260128
     C) [Task] Update login form styles

   D) Specify a different item
   ```

3. Process selection or ask for clarification

### 3. Git Reconciliation

Once target is confirmed:

1. **Find implementation commits:**
   - Search git log for commits related to the target's tasks
   - Look for commit messages matching task descriptions
   - Handle rewritten history (rebase/squash): if SHA not found, search for similar message

2. **Find plan-update commits:**
   - For each implementation commit, find the corresponding plan.md update commit

3. **For full track revert:**
   - Also find the track creation commit (first commit that added the track to tracks.md)

4. **Compile final list** of all SHAs to revert, newest first

### 4. Present Execution Plan

Show the user exactly what will happen:

```
## Revert Plan

**Target**: Revert Task 'Create user authentication endpoint'

**Commits to Revert** (2 total):
1. abc1234 - "feat: Add user authentication endpoint"
2. def5678 - "conductor(plan): Mark auth task complete"

**Action**: Will run `git revert` on these commits in reverse chronological order.

**Warning**: This will create new revert commits, preserving history.

Do you want to proceed? (yes/no)
```

### 5. Execute Revert

If user confirms:

1. **Run git revert** for each commit (newest first):
   ```
   git revert --no-edit <sha>
   ```

2. **Handle merge conflicts:**
   - If conflict occurs, halt and explain:
     ```
     Merge conflict detected in <file>.
     Please resolve manually:
     1. Edit the conflicted file
     2. Run: git add <file>
     3. Run: git revert --continue
     Or abort with: git revert --abort
     ```
   - Wait for user to resolve before continuing

3. **Verify plan state:**
   - Read the relevant plan.md file
   - Check that status markers are correctly reverted
   - If not correct, edit to fix and commit the correction

4. **Update metadata.json** if reverting entire track:
   - Set status back to appropriate state

### 6. Announce Completion

```
Revert complete!

- Reverted: [Task/Phase/Track] '<name>'
- Commits created: X revert commits
- Plan status: Updated to reflect reverted state

You can continue work with `/conductor-implement` or check status with `/conductor-status`.
```

### 7. Error Handling

- If no commits found for target: "Could not find Git commits for this item. It may have been created in a different session or the history was rewritten."
- If user cancels: "Revert cancelled. No changes were made."
- Always offer to abort if something goes wrong
