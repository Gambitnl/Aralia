# GitHub Automation

This directory contains CI/CD workflows that automate code quality, conflict detection, and deployment.

---

## Workflows

### 🔒 CI (`ci.yml`)

**Triggers:** Every PR to `master`

**Jobs:**
| Job | Description |
|-----|-------------|
| 🚫 Poison Check | Blocks PRs that include forbidden files |
| 🔨 Build | TypeScript type check + Vite build |
| 🎨 Lint | ESLint code style |
| 🧪 Tests | Vitest test suite |

**Features:**
- Runs all jobs in parallel
- Cancels previous runs when new commits are pushed
- Blocks merge until all checks pass

---

### 🔧 Auto-Fix (`ci-fix.yml`)

**Triggers:** When CI workflow fails

**What it does:**
1. Detects the failure
2. Invokes Jules (AI coding agent) with the failure context
3. Jules analyzes the logs and pushes a fix
4. CI re-runs on the fixed code

**Requires:** `JULES_API_KEY` secret

---

### 🔍 Scout (`scout-conflict-detection.yml`)

**Triggers:** 
- Every 4 hours (scheduled)
- After every push to `master`
- Manual dispatch

**What it does:**
1. Gets all open PRs
2. Compares which files each PR modifies
3. Detects line-level overlaps between PRs
4. Posts comments with resolution instructions

**Why it exists:** Prevents merge conflicts before they happen by alerting PRs that are working on the same code.

---

### 🚀 Deploy (`deploy.yml`)

**Triggers:** Push to `master`

**What it does:**
1. Installs dependencies (`npm ci`)
2. Builds production bundle (`npm run build`)
3. Deploys to GitHub Pages

---

## Secrets

| Secret | Purpose |
|--------|---------|
| `GEMINI_API_KEY` | AI features in the game |
| `JULES_API_KEY` | Auto-fix workflow |

---

## Forbidden Files (Poison Files)

These files MUST NOT be committed - they cause merge conflicts:

- `package-lock.json`
- `pnpm-lock.yaml`
- `tsconfig.tsbuildinfo`
- `tsconfig.node.tsbuildinfo`
- `dist/`

The CI workflow will fail if any of these are in a PR.

---

## For Jules Personas

See `.jules/_ROSTER.md` for:
- Persona definitions
- Code signature requirements
- Deferred work process
- Full list of guides
