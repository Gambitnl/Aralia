# GitHub CI and deployment

Verified: 2026-10-25 for shared composite Node/npm setup action (.github/actions/setup-node-env) and node_modules cache contract (H7, agora-9d53.7), production debt ratchet source, focused local CLI and gate tests, and the workflow audit below (gh run history and workflow states). Earlier pipeline and publication receipts below were verified 2026-10-04; this ratchet has no new hosted-run receipt.

Aralia checks pull requests and every push to master. GitHub Pages publishes the artifact from the same CI run only after every mandatory lane succeeds. Local recovery and deliberate public publication remain separate.

## Workflow responsibilities

| Workflow | Trigger | Behavior |
|---|---|---|
| `.github/workflows/ci.yml` | PRs targeting master, master pushes, manual dispatch | Required repository policy, TypeScript, build (with the first-load JS budget, C13), lint, data validation, application tests, Node tooling tests, and the production debt ratchet; broad quality scan remains advisory. |
| `.github/workflows/deploy.yml` | Reusable call from successful master CI only | Deploys that run's checked Pages artifact. Rejects the build if master has advanced. |
| `.github/workflows/ci-fix.yml` | Failed PR CI completion; manual inspect/apply | Uses trusted master code and Jules' documented API to request a separate review PR for a current internal PR. |
| `.github/workflows/scout-conflict-detection.yml` | Every four hours, master pushes, manual dispatch | Paginated PR/comment discovery, exact-tip verification, and native three-way Git merge analysis. Comments ask reviewers to preserve both implementations. |
| Five Gemini workflows | Their existing events | Intentionally remain manually disabled. This repair does not change their authority or enable them. |

The Build job runs scripts/quality/bundle-budget.mjs on dist: it sums the gzip size of everything dist/index.html loads first (entry plus modulepreloads) and fails above scripts/quality/bundle-budget.json (950 KiB gzip; measured 875 KiB on 2026-10-24 after C13 moved drei's three-dependent helpers out of the eager vendor-others chunk, down from 1548 KiB). CI uses Node 22 and npm 11 via the composite action `.github/actions/setup-node-env`, with `node_modules` cached on `package-lock.json` hash to eliminate ~6 redundant full installs per run. No API key enters the public build. The build checks canonical spell artifacts before regeneration and Vite. Lint errors block; existing lint warnings remain visible debt. The quality lane requires the fast production debt ratchet. Its broad scan and report upload remain advisory steps. See the [baseline contract](technical-debt-scanner.md#production-debt-ratchet).

## Publication gate

`CI Required` depends on all eight mandatory lanes and fails for failures, cancellations, or skipped lanes. Pages depends on both this gate and Build. Deployment has no standalone push or manual trigger. Its artifact comes from the caller's run; it does not rebuild a different commit. The Pages environment remains restricted to master.

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

Master requires the GitHub Actions CI Required check and an up-to-date base. Force pushes and branch deletion are disabled. Owner administrators retain the reviewed direct-push sync path; Pages still requires the complete gate for those pushes. The branch-protection API was verified on 2026-10-04.

The [repair workflow dry run](https://github.com/Gambitnl/Aralia/actions/runs/37160628752) passed and skipped a closed historical PR without creating a Jules session. The first Linux run exposed clone-only dependencies: the small pet identity catalog and tracked preview modules' helpers were still ignored. Their source now joins history while artwork remains ignored, and the optional local portrait browser bridge resolves only when its endpoint is called. React fixtures use React.JSX, strict charset policy normalizes Windows paths, and the exact corrupt or nonconforming data findings were repaired without changing rule content.

The [full required CI and Pages publication](https://github.com/Gambitnl/Aralia/actions/runs/37162733343) passed for source commit 0ebd341a2e8fc073e0f2323f9e744388aad7487d. All seven mandatory lanes and CI Required succeeded, and Pages published the artifact built by that run. [Dependency PR 1150](https://github.com/Gambitnl/Aralia/pull/1150) was closed after refresh proved it had zero changed files and exactly the same tree as master. The tracked lockfile already has body-parser 2.3.0; no dependency change was discarded.

GitHub reported 13,698 passing application tests and 664 passing Linux tooling tests. One Windows-only launcher case was skipped on Linux; 669 Windows tooling tests passed locally. CodeQL passed on the same source commit.

The next [Dependabot batch, PR 1152](https://github.com/Gambitnl/Aralia/pull/1152), exposed a separate dependency incompatibility: Vitest 5.0.3 cannot satisfy coverage-v8 4.1.10's exact Vitest peer requirement. Its npm ci failure was correctly blocked. The [automatic repair run](https://github.com/Gambitnl/Aralia/actions/runs/37163758384) successfully created the attributable Jules session sessions/15816269456300844149. That receipt proves live request acceptance, not completed repair. GG-380 tracks review of that existing session and a compatible, fully checked dependency batch; no peer-validation bypass or automatic merge is authorized.

All six investigated CI/CD gaps, GG-372 through GG-377, are resolved. Existing lint warnings remain visible; GG-378 and GG-379 retain the separate button migration and crossing-connectivity work.

Session maintenance refreshed the changed application dependency headers in one named-file wave. The header tool does not support the optional server seam in .mjs and excludes the profile generator script. Targeted MemPalace mining covered scripts/ci, where this CLI recognizes the type declaration and skips .mjs sources; a full-repository mine was not run.

The [failed full Linux run](https://github.com/Gambitnl/Aralia/actions/runs/37161344067) verified the negative publication path: Application Tests failed, CI Required failed, and Publish Checked Build was skipped. Its remaining findings were clone inputs. CI now supplies Python and pinned Pillow for the native silhouette comparator; spell acceptance reads the generator's canonical corpus directly instead of an ignored cache; the explicit retired-canvas comparison source is tracked for its boundary audit. Those affected checks pass locally. CodeQL also passed for that source commit.

## Workflow audit (H8, agora-9d53.8)

Checked 2026-10-24 with `gh run list` (last 30 runs per workflow), `gh workflow list --all`, and `gh secret list` (names only). No workflow was enabled or disabled; a state change is a GitHub settings change and waits for Remy.

| Workflow | State | Last run | Last 30 runs | Reason |
|---|---|---|---|---|
| CI (`ci.yml`) | active | 2026-10-24 (Dependabot PR); master 2026-10-04 | 22 failed, 7 cancelled, 1 passed | Required gate. The last master run (b35ea0ff8) failed one flaky test, see below. |
| Deploy (`deploy.yml`) | active | 2026-10-03 | 25 passed, 5 failed | Runs only as a call from passing master CI, so the site has not been republished since 2026-10-03. |
| Auto-Fix (`ci-fix.yml`) | active | 2026-10-24 | 3 passed, 10 skipped, 17 failed | The failures are old: the last dates from 2026-08-01 (`jules-invoke@v1` no longer resolved), before the October repair. Recent runs pass or skip by design. Needs `JULES_API_KEY`, which exists. |
| Scout conflict detection | active | 2026-10-24 | 30 passed | Healthy; runs every four hours. Needs no secret. |
| Gemini dispatch, invoke, review, triage, scheduled triage | disabled by hand | 2026-07-13 at latest; three never ran in the window | n/a | Intentionally disabled (see above). They need `GEMINI_API_KEY`, `GOOGLE_API_KEY` and `APP_PRIVATE_KEY`; none of those secrets exists, so enabling them would fail at once. |

Dependabot, Dependency Graph and CodeQL are GitHub-managed and active.

**The stale site has two causes.** Nothing has been pushed to master since 2026-10-04, and that last push failed CI. 1,659 of 1,660 test files passed. The one failure was `AbilityCommandFactory.sneakAttack.test.ts` ("triggers Sneak Attack with an adjacent ally"). It set `attackBonus: 99` to force a hit, but a natural 1 always misses, so about 1 run in 20 skipped Sneak Attack. The four Sneak Attack tests now pin the d20 through the existing `attackRollRng` context option. Forcing a natural 1 reproduces the CI failure; the pinned roll passes 4/4. The next reviewed push should republish Pages, if CI is otherwise green.

## Shared Node setup and dependency cache (H7, agora-9d53.7)

Verified: 2026-10-25 against `.github/actions/setup-node-env/action.yml` and `.github/workflows/ci.yml`.

Previously, all 7 independent jobs in `.github/workflows/ci.yml` (`typecheck`, `build`, `lint`, `validate`, `test`, `node-tests`, `quality-scan`) repeated boilerplate Node 22 setup, `npm install -g npm@11`, and `npm ci` from scratch, re-extracting tarballs and rebuilding native dependencies ~7 times per workflow run (~10-15 minutes of cumulative redundant runner time).

The shared composite action `.github/actions/setup-node-env` consolidates this contract:
1. Sets up Node 22 via `actions/setup-node@v4` with `node-version: 22`.
2. Restores `node_modules` cache via `actions/cache@v4` keyed on `${{ runner.os }}-node-modules-${{ hashFiles('package-lock.json') }}` with fallback restore keys `${{ runner.os }}-node-modules-`.
3. If cache hits (`steps.cache-nodemodules.outputs.cache-hit == 'true'`), the full install is skipped entirely, saving ~60-70 seconds per job.
4. If cache misses, it runs `npm install -g npm@11` and `npm ci`.

All 7 jobs in `ci.yml` invoke this action via `uses: ./.github/actions/setup-node-env`.

