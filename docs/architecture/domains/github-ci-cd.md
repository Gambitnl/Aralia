# GitHub CI and deployment

Verified: 2026-10-04 against workflow source, focused pipeline tests, actionlint, and local application checks. GitHub run receipts are recorded below after publication.

Aralia checks pull requests and every push to master. GitHub Pages publishes the artifact from the same CI run only after every mandatory lane succeeds. Local recovery and deliberate public publication remain separate.

## Workflow responsibilities

| Workflow | Trigger | Behavior |
|---|---|---|
| `.github/workflows/ci.yml` | PRs targeting master, master pushes, manual dispatch | Required repository policy, TypeScript, build, lint, data validation, application tests, and Node tooling tests; advisory quality scan. |
| `.github/workflows/deploy.yml` | Reusable call from successful master CI only | Deploys that run's checked Pages artifact. Rejects the build if master has advanced. |
| `.github/workflows/ci-fix.yml` | Failed PR CI completion; manual inspect/apply | Uses trusted master code and Jules' documented API to request a separate review PR for a current internal PR. |
| `.github/workflows/scout-conflict-detection.yml` | Every four hours, master pushes, manual dispatch | Paginated PR/comment discovery, exact-tip verification, and native three-way Git merge analysis. Comments ask reviewers to preserve both implementations. |
| Five Gemini workflows | Their existing events | Intentionally remain manually disabled. This repair does not change their authority or enable them. |

CI uses Node 22, npm 11, and npm ci. No API key enters the public build. The build checks canonical spell artifacts before regeneration and Vite. Lint errors block; existing lint warnings remain visible debt. The quality scan is advisory and does not replace a mandatory check.

## Publication gate

`CI Required` depends on all seven mandatory lanes and fails for failures, cancellations, or skipped lanes. Pages depends on both this gate and Build. Deployment has no standalone push or manual trigger. Its artifact comes from the caller's run; it does not rebuild a different commit. The Pages environment remains restricted to master.

The main workstation's [nightly save](nightly-git-save.md) performs recovery separately from public publication. Reviewed commits still pass the local secret scan, sync check, Git hygiene, and intent gate. Pipeline repair publication uses the reviewed commit path without creating another full recovery backup.

## Test ownership and dependency maintenance

`scripts/ci/node-test-inventory.mjs` identifies tests importing Node's test runner across the existing tooling roots. Both the Node runner and Vitest exclusions use this inventory, so each file belongs to one runner. Node tests have four-worker concurrency and a two-minute per-test bound. Recovery fixtures use a pinned, checksum-verified Gitleaks executable and a default fixture configuration.

Vitest retains the existing application and slow-test projects. Expensive terrain generation and mounted combat scenarios use the slow project's 60-second test timeout; ordinary tests retain their five-second limit. Application JSON results upload even after failure. Type-level tests also block the application lane.

The repository policy accepts intentional package and lockfile updates from any author. npm ci checks their consistency. Compiler cache artifacts remain forbidden. Repair prompts require consistent dependency manifests instead of forbidding necessary lockfile updates.

## Repair and Scout authority

Jules repair eligibility requires a failed application PR CI run, an open same-repository PR, and the exact current head SHA and branch. Missing workflow PR associations are resolved through a paginated branch lookup and the same checks. Forks, superseded tips, closed PRs, and repair PR loops are skipped. Credentials are only exposed to trusted master code. Requests create a separate review PR and do not authorize merging, deployment, force pushes, feature removal, or weaker assertions.

Session lookup is paginated and bounded. A repeated request for the same repository and SHA recovers its existing attributable session. HTTP failures are explicit; uncertain POST results are not retried. Manual dispatch defaults to inspection, which consumes no Jules quota. GitHub's JULES_API_KEY secret is configured; real repair generation is only exercised by an eligible failure.

Scout fetches exact branch tips and checks them against the API before analysis. Native git merge-tree compares both changes against their common base and includes renames, binaries, and large PRs. It does not change the worktree or index. Stable pair/SHA markers update only the bot's own comments and retire resolved conflict warnings. Unit fixtures cover more than 100 changed files, shifted hunks without conflicts, real conflicts, paginated comments, and repeated runs. Legacy overlap is not evidence that either entire file should be reverted.

## Baseline repair and remaining debt

The first fresh baseline exposed 337 TypeScript errors, four lint errors, 74 failed application tests, and two failed Node tests. Repairs restored native fixtures and receipt types while retaining game systems. They also fixed real behavior: nested Frostbite damage scaling, canonical Fireball area targeting, selected upcast levels, Bones of the Earth's currentHP field, granted-action source receipts, cantrip slot costs, stale HP during reaction replay, retreat settlement, and economy screen transactions.

Crossing tests preserve source-authored obstructions and the existing honest gap diagnostic; route-connectivity diagnostics are tracked in GG-379.

World goldens were refreshed against previously accepted larger floorplans and keep roof policy. Determinism, cross-style geometry, replay, and canonical source receipts remain asserted. The button audit manifest now records 17 reviewed existing paths and removes three resolved paths; its new-debt guard remains active. Button migration belongs to GG-378 in the [global gap tracker](../../projects/GLOBAL_GAPS.md), not to a CI assertion exemption.

GitHub branch enforcement and final same-SHA CI/deployment receipts are pending verification in this working repair.
