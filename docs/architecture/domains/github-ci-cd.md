# GitHub CI and deployment

Verified: 2026-10-03 against the workflow files, GitHub workflow states, Actions logs, branch settings, and Pages environment settings.

Aralia publishes a public static site from `master`. Publication currently checks that the site builds, but does not require the pull request CI workflow to pass. Local push hooks and the reviewed publication runner add safeguards on the main workstation; GitHub does not enforce those local checks.

## Workflow responsibilities

| Workflow | Trigger | Current behavior |
|---|---|---|
| `.github/workflows/ci.yml` | Pull requests targeting `master` | Checks forbidden files, TypeScript, build, lint, data validation, an advisory quality scan, type-level tests, and the bounded Vitest suite. It does not run on direct pushes to `master`. |
| `.github/workflows/deploy.yml` | Pushes to `master` and manual dispatch | Installs dependencies, runs `npm run build`, uploads `dist`, and deploys it to GitHub Pages. The deploy job depends on its build job only. |
| `.github/workflows/ci-fix.yml` | Completion of the CI workflow | On failure, attempts to invoke Jules with the failing branch and commit. Its action reference currently cannot resolve. |
| `.github/workflows/scout-conflict-detection.yml` | Every four hours, pushes to `master`, and manual dispatch | Compares changed files and patch ranges in open pull requests and posts overlap comments. It does not run tests or prove that a merge will conflict. |
| Five `gemini-*.yml` workflows | Various issue, review, comment, reusable-workflow, and scheduled events | All five are manually disabled in GitHub. Their presence in the checkout does not mean they execute. |

GitHub also lists CodeQL, Dependabot Updates, and Dependency Graph workflows. CodeQL and Dependabot runs were observed after the product sync. These checks serve separate purposes and do not replace application CI.

Both application CI and deployment use Node 22 and install npm 11 before `npm ci`. Deployment deliberately receives no Gemini API key. The build first runs `spells:check`, then prepares other data and runs Vite. Vite's production build is not the separate `tsc --noEmit` check used by PR CI.

## GitHub enforcement

The checked repository configuration has no protection on `master` and no repository rulesets. The CI file's comment that it blocks merges is therefore not enforced by branch settings.

The `github-pages` environment allows deployment from `master` only. It has no required reviewer or wait timer. This restricts the source branch, but does not require test, lint, or typecheck success. Deployment concurrency uses the shared `pages` group with cancellation disabled; it serializes deployment runs without linking them to CI.

The workstation's [nightly save](nightly-git-save.md) now keeps recovery separate from publication. Public changes require deliberate commits and review. This improves publication intent, but leaves GitHub's CI enforcement gap unchanged.

The product sync at `0183d871a` completed its [Pages build and deployment](https://github.com/Gambitnl/Aralia/actions/runs/37153158208) successfully. Scout and the triggered Dependabot jobs also passed. No application CI run was triggered for that direct push.

## Verified issues and evidence

- **Application CI does not cover direct master publication.** The product sync at `0183d871a` triggered deployment and Scout, but no application CI run. Route: GG-372 in the [global gap tracker](../../projects/GLOBAL_GAPS.md).
- **The latest application CI evidence is old and failing.** The latest [PR CI run](https://github.com/Gambitnl/Aralia/actions/runs/30705324121), from August 1, failed typecheck and tests. Its typecheck reported missing modules and JSX/type mismatches; its test summary reported 20 failed files and 25 failed tests. The open [Dependabot PR 1150](https://github.com/Gambitnl/Aralia/pull/1150) also has failed build, lint, and test checks from July 24. These historical runs do not establish the current master's full failure inventory. Route: GG-373.
- **Automatic repair fails before invoking Jules.** The latest [repair run](https://github.com/Gambitnl/Aralia/actions/runs/30705841182) reports that `google-labs-code/jules-invoke@v1` cannot be resolved. The reference still exists in the current workflow. A live lookup confirms that tag `v1` is absent; the repository redirects to `google-labs-code/jules-action`. Choosing another tag also requires checking its inputs and intended repair authority. Route: GG-374.
- **Some Node tests are discovered by Vitest, while excluded Node tests lack a CI lane.** A focused Vitest invocation of `scripts/idea-board/organization.test.mjs` fails to bundle its `node:test` import. The same file passes all eight tests with `node --test`. Other scripts also use Node's test runner. Agora and recovery tests are excluded from Vitest, and `ci.yml` contains no separate Node test step. Route: GG-375.
- **The forbidden-file policy conflicts with ordinary dependency maintenance.** The PR gate rejects human lockfile changes unless the actor or branch matches its special cases. The automatic repair prompt forbids lockfile changes even for dependency failures. Preserve the original concern about batch conflicts while deciding which dependency changes need their lockfile committed. Route: GG-376.
- **Scout's analysis is partial and its suggested action can discard useful work.** It requests only one page each of pull requests, files, and comments. It compares ranges in each branch's new-file coordinates, which are not a shared base coordinate. Its comment recommends reverting the entire overlapping file based on this heuristic alone. Treat overlap as a request for review, not sufficient evidence to discard an implementation. Route: GG-377.

## Investigation boundary

This investigation committed the pending product changes and repaired one affected test's obsolete spell evidence path. It did not change workflow triggers, branch protections, disabled workflow states, repair authority, or the application quality backlog.

The scoped checks passed 644 Vitest tests and eight Node tests, the spell artifact check, sync check, Git hygiene, and typechecking of eight selected files. One extra suite in the initial Vitest selection was a Node test and failed collection; it passed under its correct runner. Thirty-three errors in seven imported files were suppressed by the scoped typecheck. These results are focused proof, not a claim that full application CI is green. No new rendered UI acceptance was performed during the sync.

A repair should first decide how GitHub must gate publication. Then restore the repair action deliberately, give Node tests an explicit runner, and establish a fresh application CI baseline. Do not enable autonomous code repair merely to make the workflow list look healthy.
