# Package 9 Stale PR Replacement Decision

## Scope

Package 9 remains the active Spell Phase 1 implementation target: provide legal higher-level caster fixtures so the combat simulator can test representative level 2 and level 3 spell behavior without changing the normal level 1 starting party semantics.

This decision only files stale PR #1030 and chooses the next routing path. It does not accept, merge, or locally port the stale PR implementation.

## Evidence

- Jules session `236577711126494484` opened PR #1030 for Package 9.
- Codex posted bounded repair requests after the original PR and two repair heads.
- The last GitHub PR head stayed `dc8b412fb72d8dcdcd4caf92250c03b7ab4ca3d8`.
- GitHub reported PR #1030 as conflicting after repeated checks.
- The last reviewable PR still failed Package 9 acceptance because the manifest-discoverability test used a mocked two-character manifest instead of proving the real manifest keeps the level 1 roster while exposing both level 5 dev fixtures.
- A visible Jules inspection later showed `Ready for review`, but GitHub still showed the same conflicting head.
- Codex posted a publish-mismatch request at `https://github.com/Gambitnl/Aralia/pull/1030#issuecomment-4533863135`; no newer PR commit or explicit Jules answer appeared before filing.

## Options

| Option | Meaning | Decision |
|---|---|---|
| A | Keep waiting on PR #1030. | Rejected for now. The session is no longer visibly working, the PR head did not change, and waiting has already produced repeated tracker-only wait rows. |
| B | Close PR #1030 as stale/unaccepted and start a replacement Jules path from current `origin/master`. | Selected. This keeps implementation ownership with Jules while avoiding a conflicting, stale branch. |
| C | Locally port and repair the useful Package 9 implementation from PR #1030. | Rejected for now. The user preference is to offload as much as possible to Jules, and Package 9 can still be retried through a clean replacement dispatch. |

## Selected Path

Close PR #1030 as stale/unaccepted, keep Package 9 active, and prepare a replacement Jules dispatch from current `origin/master`.

The replacement path should reuse the existing Package 9 acceptance criteria, but its handoff should explicitly warn that the prior PR failed because:

- the branch stayed conflicting against current `master`;
- tracker rows drifted behind foreman status rows;
- manifest proof must assert against the real `public/premade-characters/manifest.json`;
- combat conversion proof must call `createPlayerCombatCharacter` for representative level 2 and level 3 spells;
- no UI files, Symphony runtime files, or temporary helper scripts belong in the final PR.

## Next Action

Refresh `PACKAGE_9_CASTER_FIXTURE_COVERAGE_JULES_TASK.md` and `PACKAGE_9_CASTER_FIXTURE_COVERAGE_JULES_PROMPT.md` for a replacement handoff if needed, then launch the replacement through the visible Symphony/Jules dashboard path from a clean current `origin/master` worktree.
