# Nightly Git Save

Verified: 2026-10-02 (snapshot runner, private backup scripts, scanner fixture tests, live GitHub comparison, and Windows task settings)

## Purpose

The nightly save commits unlocked working changes in `F:\Repos\Aralia` and pushes them to GitHub. The commits read `auto: daily snapshot <date>`. A separate encrypted backup on G: preserves ignored source, assets, agent records, and scratch media. A private GitHub copy preserves eligible source and text records.

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

Task changes require the owner's instruction. On 2026-10-02 the owner asked to apply the reliability fixes, including enabling the task and missed-night catch-up.

## Reliability and review checks

`scripts/git/nightly-snapshot.mjs` owns the save. The external PowerShell script is a launcher. Local settings and the verified tools live in `G:\Users\Gambit\.codex\tools\nightly-save\`. The prior launcher and task XML are saved there for recovery.

- Fetch GitHub before saving. Stop if local master is behind; never merge or force-push automatically.
- Retry unpushed commits even when the working tree is clean. Verify GitHub's head after pushing.
- Preserve the prior index if staging, hold-back, review, or scanning fails before commit. Keep the existing Agora lock guard and commit hook.
- Stop publication at 100 deleted files, 20,000 removed lines, a binary addition of 10 MiB, or total binary additions of 50 MiB. Write the paths and counts to `.agent/scratch/nightly-save/change-review.json`.
- Review exceptions approve one fingerprint of the remote base and candidate tree. Any new change invalidates the approval. Run `node scripts/git/nightly-snapshot.mjs --config <local-config> --approve-anomalies <reviewed-fingerprint>` only after reviewing the receipt. An exception never bypasses secret scanning.
- Scan every outgoing commit with Gitleaks 8.30.1, including commits left after a failed push. Use a pinned rules file outside the working tree, redacted reports, and no working-tree allow comments or ignore list. Missing or failing scanner means no publication.
- The daily task catches up after a missed start. Its two-hour limit replaces the old 72-hour limit. It keeps the original login and battery settings.
- `Aralia Snapshot Health` checks hourly. Claude SessionStart also checks. Warn for a disabled task, failed run, unpushed commits, or a published snapshot older than 36 hours. The health check reads GitHub independently and does not infer success from a local commit. Private backup failures and stale receipts also warn.

The public review gate does not block the private backup. The current spell-data deletions need review before public publication.

## Private recovery copies

`scripts/git/private-backup.ps1` uses Restic 0.19.1 to write encrypted, deduplicated versions to `G:\Backups\Aralia\restic`. It backs up the Aralia tree, Claude project memory, skills and scripts, Codex capsules, Codex memory and skills, and local backup configuration. It includes ignored Design Preview source, assets, and scratch media. It excludes dependencies, Git internals, build/cache output, browser profiles, active backup logs, and password files. It does not delete old snapshots.

The Restic password is protected with Windows DPAPI for the current account. A recovery key is held at `D:\Backups\Aralia-Recovery\restic-recovery-key.txt`, with access limited to that account. Keep that key when moving to a different Windows installation. Never put it in Git or a proof log.

`scripts/git/private-backup.mjs` copies source and text to `G:\Backups\Aralia\aralia-private-source`, with its own Git metadata and private remote `Gambitnl/aralia-private-source-backup`. It checks remote identity and private visibility before every push. It excludes credentials, browser profiles, dependencies, runtime backup receipts and Agora client identities, media, and text files over 5 MiB. Flagged lines are redacted in the copy only; `REDACTIONS.json` identifies the affected paths and line numbers. A fresh secret scan must pass before a private commit. Exact originals remain in the encrypted backup where the full-backup exclusions allow them.

Restore a chosen file to an ignored scratch directory, then compare its hash with the original. Use `private-backup.ps1 -Verify` for the repository integrity check. A backup of files being edited is a sampled recovery copy; no application-wide consistency is implied.

## How one night runs

1. The runner checks branch and remote identity, fetches master, and checks for conflicts or a behind state.
2. A clean tree skips staging, then retries any unpushed commits.
3. The script copies the git index to a temp file.
4. `git add -A` stages the whole tree.
5. `guard --hold-back-locked <list>` asks the Agora daemon (`http://localhost:4319`) for live locks. It resets each staged path under a lock back to HEAD in the index. The file on disk does not change. It writes the held paths to `<list>`.
6. If nothing stays staged, the script restores the index and stops.
7. `git commit` runs the commit-msg hook. The guard checks the staged paths again and refuses the commit if a lock now covers one. That closes the gap where an agent locks a file after step 5. On a refusal the script restores the index.
8. `guard --restore-held <index copy> <list>` puts back each held path's own staging from before the run, so a `git mv` or `git rm --cached` on a locked file survives.
9. Change review and secret scanning must pass. `git push` runs the three existing push checks: sync-check, git hygiene, and the intent gate. The runner verifies the published head.

The launcher writes its output to the run log and saves a separate private backup even when public publication fails. The runner writes the latest success, blocked, or failed receipt to `.agent/scratch/nightly-save/last-run.json`.

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
- 2026-10-02: the owner authorized reliability, secret scanning, change review, catch-up, and private backup fixes.
