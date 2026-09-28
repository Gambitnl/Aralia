# Nightly Git Save

Verified: 2026-09-28 (read against `scripts/git/commit-msg-agora-guard.cjs`, `C:\Users\Gambit\.claude\scripts\aralia-daily-commit.ps1`, `.git/hooks/commit-msg`, `scripts/git/pre-push-aralia.sh` and the Windows task; the guard modes were proved 16/16 in a throwaway repo, `.agent/scratch/gg310-snapshot-fix/harness/run.cjs`)

## Purpose

The nightly save commits the whole working tree of `F:\Repos\Aralia` and pushes it to GitHub. It is the only copy of the work that is not on this disk. The commits read `auto: daily snapshot <date>`.

The GitHub repository `Gambitnl/Aralia` is **public**. A push also starts the public Pages deploy (`.github/workflows/deploy.yml`).

## The parts

| Part | Where | Tracked in git |
|---|---|---|
| The Windows task `\Aralia Daily Git Commit` | Task Scheduler, daily 02:00, runs only while Remy is logged on | no |
| The script the task runs | `C:\Users\Gambit\.claude\scripts\aralia-daily-commit.ps1` | no |
| The guard | `scripts/git/commit-msg-agora-guard.cjs` | yes |
| The hook that calls the guard | `.git/hooks/commit-msg` (installed by `npm run hooks:install` and by `npm install`) | no |
| The push checks | `scripts/git/pre-push-aralia.sh`, called by `.git/hooks/pre-push` | yes |
| The run log | `.agent\scratch\daily-snapshot.log` (ignored) | no |

Only Remy switches the Windows task on or off. Agents never change it.

## How one night runs

1. The script writes a plan-map drift receipt to `.agent\scratch\planmap-drift.txt`.
2. A clean tree stops the run: nothing to save.
3. The script copies the git index to a temp file.
4. `git add -A` stages the whole tree.
5. `guard --hold-back-locked <list>` asks the Agora daemon (`http://localhost:4319`) for live locks. It resets each staged path under a lock back to HEAD in the index. The file on disk does not change. It writes the held paths to `<list>`.
6. If nothing stays staged, the script restores the index and stops.
7. `git commit` runs the commit-msg hook. The guard checks the staged paths again and refuses the commit if a lock now covers one. That closes the gap where an agent locks a file after step 5. On a refusal the script restores the index.
8. `guard --restore-held <index copy> <list>` puts back each held path's own staging from before the run, so a `git mv` or `git rm --cached` on a locked file survives.
9. `git push` runs the three push checks: sync-check, git hygiene, and the intent gate.

Every line of output goes to the run log. Native output passes through `2>&1 | ForEach-Object { "$_" }`, because Windows PowerShell 5.1 leaves native output out of a transcript.

## What a lock covers

The guard uses the daemon's own `lockOverlap()` from `tools/agora/store.mjs`, so the save and the daemon agree. One addition: a plain path token also covers every path under it, in case it names a folder. Locks that name another repo (`repo` field) are ignored.

## Overrides and failure modes

- `ARALIA_SNAPSHOT_FORCE=1` saves everything: the hold-back step holds nothing back and the hook allows the commit.
- The daemon down means the advisory system is off: nothing is held back.
- A guard error stops the save. It never lets the save through.
- The git hygiene push check fails while an extra worktree is registered. The push then fails and the commit stays local. `ARALIA_GIT_HYGIENE_ALLOWED_WORKTREES=<path>` names a temporary exception.
- An agent that edits a file WITHOUT a lock is not protected. Lock-before-edit is the only defense.

## History

- 2026-08-26: the guard (GG-117) refused the whole save while any agent or lock was live.
- 2026-08-27 to 08-30: every save was refused; the old script still returned success.
- 2026-08-30T22:11Z: Codex session `01a0542f-b437-7803-89b5-167d85dfca03` disabled the task.
- 2026-09-28: the hold-back guard replaced the whole-save refusal (GG-310, Remy's sheet "Nightly Git Save - Your Calls" q1). The 14 character-atelier `.glb` models left git on the same day.
