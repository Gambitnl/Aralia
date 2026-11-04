# Developer environment

Verified: 2026-11-03 (Playwright launch hardening); immutable application verification copies last checked 2026-10-31; local service proxy recovery last checked 2026-10-29; other environment sections last checked 2026-10-25.

Aralia supports local Windows development and GitHub Codespaces. Both run the
same Vite application and dev-only Hero Lab API. Codespaces is an optional
development workspace. It does not replace GitHub Pages for public deployment
or Hugging Face for TRELLIS model generation.

## Browser automation security

Repository-owned Chromium launch sites explicitly select installed Chrome with
`channel: 'chrome'` and `chromiumSandbox: true`. The Playwright test configuration
sets the same policy through `use.channel` and `use.launchOptions`. This includes
capture tools, dashboard browser tests, account probes and the archived canonical
retrieval launcher. The visual-test capture helper stops with an actionable error
if sandboxed Chrome cannot launch; it no longer prefers bundled Chromium. Keep
Chrome updated separately from the Playwright package. A missing browser or
sandbox failure must not be worked around with `--no-sandbox`.

A tracked-source audit verified 42 direct Chromium launch sites plus the test
configuration. The six changed TypeScript files passed scoped typechecking, and
all 11 affected dashboard tests passed, including six browser cases against
disposable local servers. Playwright's test configuration also loaded and listed
its six application tests; those application journeys were not run. A fresh
Chrome process rendered a local smoke page;
`chrome://version` showed no sandbox-disabling flags and `chrome://sandbox`
reported renderer lockdown at untrusted integrity. This checks Chromium's process
sandbox, not VM/container isolation or every browser subsystem. Existing GPU
capture settings and intentional login profiles remain in place.

The local Codex Playwright MCP configuration is pinned to `@playwright/mcp@0.0.83`
with `--browser chrome --sandbox --isolated`; `codex mcp get playwright` confirms
the saved arguments. Its browsing profile is disposable and does not reuse the
previous persistent login directory. Saved configuration changes require restarting
the MCP server/client; this does not attest an already-running server. Profile
isolation is not operating-system isolation: untrusted open-web browsing still
needs a separately provisioned VM or non-root container without host credentials
or home-directory mounts. No such environment was provisioned by this change.

On this Windows host, the built-in Chrome update check staged version
`156.0.8078.80`, while fresh launches still reported `156.0.8078.74` and the update
page requested a relaunch. Existing user browser processes were not terminated.
Finish Chrome's relaunch and verify the running version before treating the
security update as active. The built-in updater was checked in a disposable
profile without accessing the user's signed-in profile.

## Local Design Preview and hot reload

Run `npm.cmd run dev` on Windows, then open
`http://localhost:3000/Aralia/misc/design.html`. Use the port printed by Vite if
another application already occupies 3000. The normal command retains file
watching and hot reload, including local-only Design Preview source files.

The watch exclusions in `vite.config.ts` include `.chrome-gemini-profile/`.
This is Gemini's local browser profile, created by the image-generation tooling,
and contains browser caches rather than application source. Git ignores alone
do not keep these files out of Vite's watcher.

A controlled included/excluded/included comparison reproduced document timeouts
with this profile watched, restored responses with only this profile excluded,
and reproduced the timeout again with an already-warm dependency cache. The
profile contained about 15,300 files; the normal watcher had reached 11,690
profile entries after 34 seconds and was still crawling. The excluded run had
no profile entries and reached a stable census of about 25,700 other entries.
This exclusion preserves the profile data and the existing source watch policy.

The repaired `npm.cmd run dev` serves the preview document and entry module on
port 3000. A disposable, self-accepting module under Design Preview verified a
real source change, a WebSocket JavaScript update in 10 ms, and the changed
module response. The fixture was removed. This is server and HMR transport
proof, not a claim that every preview scene or GPU feature was rendered.
Disposable diagnostic evidence is in `.agent/scratch/vite-watch-diagnosis/`.

`npm.cmd run dev:verification` is the separate no-watch capture mode on port
5192. It remains available for captures but is not the normal hot-reload command.

## Local dialogue service recovery

The Vite routes keep the configured local service targets and rewrites. The
shared helper is [localServiceProxy.ts](../../../scripts/vite-plugins/localServiceProxy.ts); it selects no
provider, model or credential and never downloads a model. An installed Ollama
service can be started with its existing 'ollama serve' command. A direct
successful /api/tags request and a successful game /api/ollama/tags request
are separate checks.

A refusal returns explicit502 JSON and logs one short diagnostic block. During
an outage, one subsequent incoming request may probe the same target every two
seconds. A real proxy response clears the outage state and re-arms diagnostics.
The helper does not automatically replay a failed request or a committed game
choice. Generation failures remain failures, not fabricated NPC speech.

The earlier permanent bypass prevented every request from reaching the target
after its first refusal, so its proxy-response recovery callback could never
run. Four focused cases now cover recovery, bounded retries, preserved routing
and truthful errors. A real disposable Vite/HTTP check observed502→502→200→200
without restarting the proxy. The actual game route then returned200 with a
body exactly equal to the direct local service's20-model response. These are
transport checks, not proof of a generated conversation.

Shared gameplay owners saved and parked before the configuration import was
changed. Verification mode alone must not be assumed to prevent every kind of
hot reload; coordinate a configuration change with active runtime owners.

## Codespaces setup

The repository configuration is in `.devcontainer/`. A new Codespace uses Node
22 and Python 3.11, installs dependencies from `package-lock.json`, installs the
pinned Gradio client, starts Vite on port 3000, and forwards that port privately.

Before creating the Codespace, add a Codespaces secret named `HF_TOKEN` and
grant it access to the Aralia repository. The secret must be a Hugging Face token
that can call the hosted `microsoft/TRELLIS.2` Space. The name does not start with
`VITE_`, so Vite does not copy it into browser code.

Create the Codespace from GitHub using **Code -> Codespaces -> New with options**.
The advanced creation screen shows the recommended `HF_TOKEN` secret when it is
not already associated with the repository. After startup, open forwarded port
3000 and navigate to `/Aralia/misc/design.html?step=herolab`.

GitHub reads this configuration from the branch used to create the Codespace.
Local configuration changes therefore become available only after they are
committed and pushed to that branch.

## Hero Lab execution boundary

Windows uses `tools/creatureHero/run-hero-job.ps1` and reads the token from
Windows Credential Manager. Linux and Codespaces use
`tools/creatureHero/run-hero-job.sh` and read GitHub's injected `HF_TOKEN`
environment variable. Both launch the same `convert.py` and `optimize.mjs`
pipeline, restrict candidate files to `.agent/scratch/hero-lab/jobs`, and leave
promotion as a separate confirmed action.

Codespaces does not need a GPU. It sends the reference image to the hosted
TRELLIS Space, downloads the master GLB, and performs Aralia's triangle-budget
optimization on the Codespaces CPU.

## Agent Skills Architecture & Discovery Roots

Skills provide structured capabilities, instructions, and workflows to coding agents across different harnesses (Claude Code, Google Antigravity, OpenAI Codex).

- **Canonical Tracked Home (`skills/`)**:
  All durable, version-controlled skills are maintained in [`skills/`](../../../skills/README.md). A fresh clone of the repository retains all essential agent capabilities, including the universal [`code_commentary`](../../../skills/code_commentary/SKILL.md) and [`manage_icons`](../../../skills/manage_icons/SKILL.md) standards.
- **Harness Discovery Roots**:
  - `skills/`: Root discovery location tracked by git and indexed by `skills-lock.json`.
  - `.agent/skills/`: Discovery root for Google Antigravity. Core skills are mirrored or linked here so Antigravity sessions activate them automatically.
  - `.agents/skills/`: Discovery root for multi-agent CLI tooling (e.g. `gemini-interactions-api`).
  - `.codex/skills/`: Discovery root for OpenAI Codex CLI (local patterns ignored by `.gitignore:86`).
  - `Claudeception/`: Machine-local Claude continuous-learning skill (ignored by `.gitignore:367`).
  - `AntiGravityCeption/`: Tracked at root and mirrored to `skills/antigravityception/` as the continuous-learning system for Antigravity/Gemini agents.

## Repository Layout and Root Directory Census

The root directory contains 27 dot-directories and 25 non-dot directories. All temporary outputs, agent caches, and machine-local IDE artifacts must be ignored by `.gitignore` so the daily snapshot does not commit untracked noise.

### Dot Directories (Tooling, Agents, and Workspaces)

| Directory | Git Status | Category | Purpose and Ownership |
|---|---|---|---|
| `.agent/` | Ignored (`.gitignore:107`) | Agent Scratch | Primary local scratch directory for all AI agents. Holds Agora locks, local run state, throwaway test captures, and testkits. |
| `.agent_tools/` | Ignored (`.gitignore:84`) | Tooling | Local agent tool scripts and helper hooks. |
| `.agents/` | Tracked (2 files) | Agent Skills | Versioned agent skills (e.g. Gemini interactions API skill definition). |
| `.antigravitycli/` | Ignored (`.gitignore:85`) | Agent Cache | Local state and cached metadata generated by the Antigravity CLI. |
| `.chrome-gemini-profile/` | Ignored (`.gitignore:244`) | Tool Cache | Isolated Chrome automation profile used by the image generation MCP (excluded from Vite watcher). |
| `.claude/` | Ignored (`.gitignore:85`) | IDE / Tool | Claude Code local settings, conversation history, and local MCP configurations. |
| `.cline/` | Ignored (`.gitignore:87`) | IDE / Tool | Cline IDE local storage, workspace tasks, and kanban state. |
| `.codex/` | Ignored (`.gitignore:86-88`) | IDE / Tool | OpenAI Codex CLI local configuration (`config.toml`), steer notes, and skills. |
| `.cursor/` | Ignored (`.gitignore:27`) | IDE / Tool | Cursor editor workspace rules and local indexing cache. |
| `.devcontainer/` | Tracked (4 files) | Infrastructure | GitHub Codespaces devcontainer specification (Node 22, Python 3.11, port forwarding). |
| `.freebuff/` | Ignored (`.gitignore:425`) | Tool Cache | Local 3D/graphics asset buffer scratch. |
| `.gemini/` | Ignored (`.gitignore:236`) | Agent Cache | Local Gemini agent logs, conversation state, and sidecars. |
| `.git/` | Internal | Version Control | Git internal object store, branches, and worktrees. |
| `.github/` | Tracked (14 files) | CI/CD | GitHub Actions workflow definitions (`ci.yml`, `deploy.yml`, `gemini-dispatch.yml`). |
| `.jules/` | Tracked (164 files) | Agent State | Durable task handoff packets, prompts, and execution receipts for Jules agents. |
| `.local/` | Ignored (`.gitignore:282`) | Machine Local | Machine-specific scratch files, temporary logs, and local operator overrides. |
| `.pi/` | Ignored (`.gitignore:426`) | Tool Cache | Procedural math and physics computation scratch buffers. |
| `.playwright/` | Tracked (1 file) | Testing | Playwright testing setup and guidelines README. |
| `.playwright-cli/` | Ignored (`.gitignore:427`) | Testing Cache | Playwright CLI execution logs and browser traces. |
| `.playwright-mcp/` | Ignored (`.gitignore:428`) | Tool Cache | Playwright Model Context Protocol server cache. |
| `.project-map/` | Ignored (`.gitignore:418`) | Tool Cache | Codebase visualizer dependency graph cache (excluded from Vite watcher). |
| `.qoder/` | Tracked (3 files) | Legacy State | Legacy test harness reports (scheduled for H1 cleanup). |
| `.superpowers/` | Ignored (`.gitignore:429`) | Tool Cache | Brainstorming and specification generation scratch. |
| `.symphony/` | Ignored (`.gitignore:305`) | Orchestrator | Symphony runtime task state, dashboard caches, and operator click receipts. |
| `.tmp/` | Tracked (1 file) | Legacy Scratch | Scratch research file (scheduled for H1 cleanup). |
| `.understand-anything/`| Ignored (`.gitignore:430`) | Tool Cache | Codebase exploration and symbol relationship cache. |
| `.vscode/` | Tracked (`extensions.json`) | IDE / Tool | Recommended workspace extensions; user settings and state are ignored (`.gitignore:24`). |

### Non-Dot Directories (Application, Assets, and Tooling)

| Directory | Git Status | Category | Purpose and Ownership |
|---|---|---|---|
| `AntiGravityCeption/` | Tracked (1 file) | Agent Skills | Self-reflective meta-skill definition (`SKILL.md`) for Antigravity agents. |
| `Aralia/` | Ignored (`.gitignore:387`) | Scratch Artifact | Transient local scratch folder generated by tools expecting an `/Aralia/` path prefix; kept empty. |
| `Claudeception/` | Ignored (`.gitignore:367`) | Agent Skills | Machine-local meta-skill configuration for Claude. |
| `artifacts/` | Ignored (`.gitignore:257`) | Test Artifacts | Historical test and Playwright roadmap audit reports (`roadmap-playwright-audit-*`). |
| `coverage/` | Ignored (`.gitignore:16`) | Test Artifacts | Vitest / c8 test coverage reports. |
| `deprecated/` | Tracked (3 files) | Legacy Code | Deprecated registry variants (scheduled for H1 retirement). |
| `devtools/` | Tracked (28 files) | Developer Tools | Building identity lab, performance overlays, and diagnostic harnesses. |
| `dist/` | Ignored (`.gitignore:15`) | Build Output | Production Vite build bundle for GitHub Pages. |
| `docs/` | Tracked (1,408 files) | Documentation | Canonical documentation repository (living domain docs, ADRs, tasks). |
| `docs-site/` | Tracked (20 files) | Documentation | TypeDoc documentation site generation configuration. |
| `misc/` | Tracked (27 files) | UI Entries | Standalone HTML entry points (DesignPreview `design.html`) and Dev Hub visualizer. |
| `node_modules/` | Ignored (`.gitignore:14`) | Dependencies | NPM package dependencies. |
| `output/` | Ignored (`.gitignore:431`) | Build Output | Generic script outputs and test exports. |
| `playwright-report/` | Ignored (`.gitignore:432`) | Test Artifacts | Generated HTML reports from Playwright e2e runs. |
| `public/` | Tracked (4,687 files) | Static Assets | Browser-served assets, static JSON datasets (spells, glossary), and Planmap app. |
| `scripts/` | Tracked (336 files) | Tooling | Repository automation, data validation, test suites, and nightly git snapshot tooling. |
| `skills/` | Tracked (9 files) | Agent Skills | Shared agent skills available to all coding agents. |
| `src/` | Tracked (4,626 files) | Application | Core application codebase (React 19, TypeScript, Three.js). |
| `test-reports/` | Ignored (`.gitignore:433`) | Test Artifacts | Automated test execution XML and HTML reports. |
| `test-results/` | Ignored (`.gitignore:17`) | Test Artifacts | Test failure artifacts, browser traces, and screenshot diffs. |
| `tests/` | Tracked (5 files) | Testing | Top-level integration and end-to-end test suites. |
| `tmp/` | Tracked (6 files) | Legacy Scratch | Scratch scripts (scheduled for H1 retirement). |
| `tools/` | Tracked (205 files) | Infrastructure | Agora coordination daemon/client, creatureHero pipeline, and vistest harness. |
| `vendor/` | Tracked (26 files) | Vendored Code | Third-party non-NPM libraries and browser bundles. |
| `verification/` | Ignored (`.gitignore:434`) | Test Artifacts | Isolated verification test runs and proof captures. |

## Styling stack and Tailwind policy (H9, agora-9d53.9)

Aralia styles components primarily through Tailwind CSS (`tailwindcss ^3.4.17`), PostCSS (`postcss.config.js`), and `@tailwindcss/typography`.

- **Configuration**: `tailwind.config.js` sets the content roots to `index.html` and `src/**/*.{js,ts,jsx,tsx}`, and defines Aralia's core dark-mode palette (`primary: #EAB308`, `background-dark: #0B0E14`, `sidebar-dark: #11141D`, `card-dark: #161B22`, `border-dark: #21262D`, `gray-850`) and subtle keyframe animations (`bounce-subtle`, `pulseInspectHighlight`).
- **Global Styles**: `src/index.css` defines base fonts, Design Preview overlay guards, and shared `.btn` component classes.
- **Tailwind v4 Upgrade Evaluation**: Evaluated in [ADR 0007](../../adr/0007-tailwind-v4-evaluation.md) as **NO-GO (Parked)**. Upgrading to Tailwind v4 carries high visual regression risk across 438 consuming component files (notably due to breaking changes to default border colors from `gray-200` to `currentColor` in dark mode) while offering negligible gameplay or performance benefit.




## Immutable application copies for gameplay verification

Verified: 2026-10-31. No-watch mode prevents automatic reloads but cannot prevent an uncached module from reading a later checkout edit. Use [sourceCut.mjs](../../../scripts/verification/sourceCut.mjs) for a fixed application copy before native gameplay in the shared checkout. The version3 contract copies src, public, the root bootstrap, style/package/configuration files, vendor/ez-tree and the four raw-imported preview documents. A complete inventory, hashes and metadata fence must agree before publication. Existing cuts are never overwritten. No .env or save data is copied.

Capture with node scripts/verification/sourceCut.mjs capture .agent/scratch/<new-cut>. Serve with node scripts/verification/sourceCut.mjs serve .agent/scratch/<cut> <port>. The existing Vite verification-no-watch mode uses the copy's root, aliases, styles, public directory and private optimizer cache. A guard rejects live application imports. Configuration and package contracts are checked before serving. Installed dependencies and dev-only configuration plugins remain part of the existing environment; this is not a container or deployment guarantee. Use a separate fresh origin for a new world. A source copy does not establish existing-campaign compatibility.

If a published copy lacks a required input, use node scripts/verification/sourceCut.mjs complete .agent/scratch/<base> .agent/scratch/<new-cut> <missing-input>. Completion verifies and preserves every base file and adds only missing declared dependencies. It refuses replacement of any base file. This avoids adopting later town-source changes while repairing an incomplete verification copy.

Nine bounded Node tests pass with node --test scripts/verification/sourceCut.test.mjs. They cover immutable mechanics/public data, refused overwrite, altered or added files, ignored destinations, missing bootstrap, live-source imports and append-only dependency completion. Version1 omitted root bootstrap/styles and is unqualified. Version2 served the creator but failed the actual 3D lazy import because vendor/ez-tree was absent. The prepared-defense-03 version3 completion preserves all11022 version2 files byte-for-byte and adds26 vendor files. Parent inspected its actual desktop town rendering. Rendering performance, encounter mechanics and save continuity require separate evidence; transport or helper tests do not qualify those outcomes.
