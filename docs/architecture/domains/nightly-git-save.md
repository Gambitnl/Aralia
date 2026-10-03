# Nightly Git Save

Verified: 2026-10-03

## Purpose

Keep recoverable copies of unfinished work without publishing it automatically. Nightly recovery writes an encrypted, deduplicated backup on G: and a separate private GitHub source copy. The public Aralia repository receives a review receipt; its master branch is published only through an explicit reviewed-commit command.

The repository Gambitnl/Aralia is public. A push to master triggers its Pages deployment. Recovery and deployment have different acceptance boundaries.

## Parts and ownership

| Part | Location |
| --- | --- |
| Daily Windows task | Aralia Daily Git Commit, 02:00 local time |
| Small external delegate | C:\Users\Gambit\.claude\scripts\aralia-daily-commit.ps1 |
| Tracked launcher | scripts/git/nightly-launcher.ps1 |
| Review runner | scripts/git/nightly-snapshot.mjs |
| Coordination guard | scripts/git/commit-msg-agora-guard.cjs |
| Encrypted backup | scripts/git/private-backup.ps1 |
| Private source copy | scripts/git/private-backup.mjs |
| Storage policy and restore proof | scripts/git/backup-policy.mjs, scripts/git/verify-backup.mjs |
| Local configuration and tools | G:\Users\Gambit\.codex\tools\nightly-save |
| Receipts and disposable logs | .agent/scratch/nightly-save, .agent/scratch/daily-snapshot.log |

The installer preserves login and battery preferences. The task catches up after missed starts, does not wake the computer, has a two-hour limit, and retries failed runs twice at 15-minute intervals. It ignores overlapping instances. Each launcher step has two retries with ten-second spacing and a timeout: three minutes for review, fifteen for encrypted backup, and ten for private GitHub. Failures in one step do not skip later steps. Logs rotate at 10 MiB, retaining four prior transcripts.

## Public review and deliberate publication

The runner checks master, the expected origin, and unresolved conflicts. It fetches origin/master and refuses automatic reconciliation when local master is behind.

All staging happens in a temporary index. The real staging index, working files, and master remain unchanged. The runner holds back Agora-locked paths and scans the candidate with pinned Gitleaks rules outside the checkout. Unavailable Agora or a missing scanner fails closed. Ordinary owner commits retain the existing hook policy. Edits made without locks cannot be recognized as in-progress work.

The receipt groups changed paths and flags 100 deleted files, 20,000 removed lines, a 10 MiB binary, or 50 MiB total binary additions. These are review signals; they do not block private recovery. Unchanged checks create no commits and do not publish.

To publish, first make a deliberate scoped commit through the ordinary human/agent workflow. Review the committed tree:

```text
node scripts/git/nightly-snapshot.mjs --config <local-config> --review-committed
```

Inspect change-review.json and then explicitly publish its exact fingerprint:

```text
node scripts/git/nightly-snapshot.mjs --config <local-config> --publish-reviewed <fingerprint>
```

That command publishes existing commits only. It checks the fingerprint, scans outgoing history, checks locks again, runs the installed push checks, and verifies the remote head. Any changed remote base or committed tree invalidates the fingerprint. No force push or automatic merge is used. A failed push leaves the existing local commits available for a reviewed retry.

## Encrypted recovery and storage

Restic preserves source, ignored assets and tools, scratch media, Claude memory/skills/scripts, Codex capsules/memory/skills, and local backup configuration. Dependencies, Git metadata, build/cache output, browser profiles, backup receipts/logs, and password files are excluded. Unchanged backups skip creating another snapshot.

The local configuration sets a combined encrypted/private-copy budget of 30 GiB, a private-copy budget of 3 GiB, and a drive free-space reserve of 20 GiB. Checks before and after writes prevent continued unattended growth when a threshold is reached. These are pause thresholds rather than filesystem quotas: one changed backup or Git pack can cross a threshold before the post-write check detects it. Protected recovery versions are never sacrificed to meet the byte budget.

Weekly retention keeps the latest four snapshots plus seven daily, four weekly, and three monthly versions, grouped by host and source paths and restricted to aralia-full. Integrity checks run before and after retention. Repacking is limited to 1 GiB per maintenance operation. The initial four snapshots are protected during this rollout. Use private-backup.ps1 -Maintenance for an explicit maintenance pass.

Each successful backup restores the tracked review runner from the encrypted snapshot into memory and compares its exact hash with the source checked before backup. A probe changed during the backup causes a retry rather than a false recovery claim. Restic integrity checking also remains available through private-backup.ps1 -Verify. This proves file recovery, not application-wide consistency during concurrent editing.

The password is protected with Windows DPAPI. The recovery key at D:\Backups\Aralia-Recovery\restic-recovery-key.txt is required after moving to another Windows installation. Never commit or print it.

## Private GitHub source recovery

The separate copy under G:\Backups\Aralia\aralia-private-source targets Gambitnl/aralia-private-source-backup. Every run checks repository identity and private visibility. It copies eligible text under 5 MiB and excludes credentials, browser profiles, dependencies, runtime backup state, and binary media. Scanner-flagged lines are redacted in the copy only and scanned again. REDACTIONS.json records affected paths and lines; originals remain in the encrypted backup where exclusions permit them.

Only changed source content creates commits. Weekly Git compaction preserves reachable history. Source and encrypted backups are never pruned through Git cleanup. The cloud step runs even if encrypted backup or public review fails. Local process locks prevent overlapping cloud copies and recover only demonstrably dead owners.

## Health reporting

Aralia Snapshot Health checks hourly; Claude SessionStart checks too. Health tracks the latest successful review or no-change check, rather than the age of a snapshot commit. It reports genuine failed/stale runs, disabled scheduling, storage thresholds, backup failures, and stale cloud receipts. It verifies public state and the private GitHub head against the recovery receipt. Public changes awaiting review are reported as pending information and do not make a successful recovery run a failure. Notifications repeat only when the problem changes or after a day.

```text
powershell -NoLogo -File scripts/git/install-nightly-snapshot.ps1
```

The installer needs the existing external tools/configuration and preserves the Windows task's identity and daily trigger. Recovery of the entire machine requires those encrypted files and the separate recovery key.

## History

- 2026-08-26: the guard (GG-117) refused the whole save while any agent or lock was live.
- 2026-08-27 to 08-30: every save was refused; the old script still returned success.
- 2026-08-30T22:11Z: Codex session `01a0542f-b437-7803-89b5-167d85dfca03` disabled the task.
- 2026-09-28: the hold-back guard replaced the whole-save refusal (GG-310, Remy's sheet "Nightly Git Save - Your Calls" q1). The 14 character-atelier `.glb` models left git on the same day.
- 2026-10-02: the owner authorized reliability, secret scanning, change review, catch-up, and private backup fixes.

- 2026-10-03: the owner authorized separation of recovery/publication, storage limits, retention, strict coordination, isolated staging, bounded retries, and health corrections.
