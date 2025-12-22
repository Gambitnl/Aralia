# Core Persona - Architecture Maintainer

**Run by:** The human maintainer (you) between agent batch runs

**Purpose:** Consolidate persona work, maintain architecture documentation, resolve conflicts, and keep the codebase coherent across parallel agent runs.

---

## When to Run This

Run this prompt after completing a batch of Jules agent runs:
1. After merging/squashing all persona PRs from a batch
2. Before kicking off the next batch
3. Approximately: daily or every few days

---

## Core Workflow

### Phase 1: Sync from GitHub

```bash
# Ensure you have the latest merged state
# Note: Default branch may be 'main' or 'master' depending on repo setup
git checkout main  # or 'master'
git pull origin main  # or 'master'
```

### Phase 2: Check Persona Worklogs

Review each worklog in `.jules/worklogs/`:

```bash
# Find UNTRACKED files that need to be added to architecture
grep -r "UNTRACKED FILES" .jules/worklogs/ --include="*.md" -A 5

# Find date discovery attempts (for troubleshooting)
grep -r "DATE DISCOVERY ATTEMPT" .jules/worklogs/ --include="*.md" -A 3
```

**For UNTRACKED files found:**
1. Verify the file exists in the codebase
2. Add it to the appropriate domain document in `docs/architecture/domains/`

**For DATE DISCOVERY attempts:**
1. Review what commands were tried and what happened
2. If a method worked, update `_METHODOLOGY.md` to recommend that method
3. If all methods failed, document findings so personas don't repeat failed attempts
4. Consider updating the "Reference Date" in `_METHODOLOGY.md`

### Phase 3: Regenerate Architecture Artifacts

```bash
# Regenerate dependency graph and file inventory
npx tsx scripts/generate-architecture-compendium.ts

# Check coverage - how many files are still orphaned?
npx tsx scripts/verify-architecture-coverage.ts
```

Review the output:
- **Orphaned files**: New files that need to be assigned to domains
- **Missing files**: Files claimed in docs but deleted from codebase
- **Ambiguous files**: Files claimed by multiple domains (resolve ownership)

### Phase 4: Update Architecture Domain Docs

For orphaned files:
1. Determine which domain they belong to
2. Add them to the appropriate `docs/architecture/domains/*.md` file
3. If a file doesn't fit existing domains, consider:
   - Creating a new domain
   - Creating a sub-subcomponent within an existing domain

### Phase 5: Check for Merge Conflicts

Review recent PRs for:
- Same file modified by multiple personas
- Logic changes that might conflict semantically (even if git auto-merged)
- New files with overlapping purposes

### Phase 6: Regenerate Lockfiles & Build Artifacts

> [!IMPORTANT]
> Jules personas are forbidden from committing `package-lock.json` and `tsconfig.tsbuildinfo`. Core is responsible for regenerating these after all PRs are merged.

```bash
# Step 1: Reinstall dependencies to regenerate lockfile
rm -rf node_modules package-lock.json
npm install

# Step 2: Clean and rebuild
npm run build
```

> [!CAUTION]
> **MANDATORY GATES** — Do NOT proceed to commit if these fail.

```bash
# Step 3: Lint check (MUST PASS - 0 errors, warnings OK)
npm run lint

# Step 4: Test verification (MUST PASS - all tests green)
npm test
```

If Step 3 or 4 fails:
1. Fix the errors before proceeding
2. Document what failed in the uplink channel
3. Do NOT push broken code to master

> [!TIP]
> **PAUSE POINT** — Before committing, wait 30 seconds and check the uplink channel for any objections from other agents or the human.

```bash
# Step 5: Commit the canonical lockfile (only after gates pass)
git add package-lock.json
git commit -m "🏛️ Core: Regenerate lockfile post-batch"
git push origin main
```

```bash
# See which files were modified across recent commits
git log --oneline --name-only -20
```

### Phase 6: Collect Persona Improvement Suggestions

Personas may have appended improvement suggestions to their persona files:

```bash
# Find all persona improvement suggestions
grep -r "PERSONA IMPROVEMENT SUGGESTION" .jules/personas/ --include="*.md" -A 4
```

For suggestions found:
1. Review each suggestion
2. Aggregate into `.jules/PERSONA_IMPROVEMENTS.md` for review
3. After applying changes, remove the suggestion comments from persona files

**Suggested format for aggregation file:**

```markdown
# Persona Improvement Suggestions

## Batch: [Date]

### From Warlord
**Issue:** [...]
**Suggestion:** [...]
**Status:** Pending / Approved / Rejected

### From Vector
...
```

### Phase 7: Update VISION.md (Optional)

If significant new domains or features were added:
1. Update `docs/VISION.md` with new sections
2. Ensure cross-references to architecture docs are current

### Phase 8: Commit and Push

```bash
git add docs/architecture/
git add .jules/worklogs/
git add .jules/personas/
git commit -m "🏛️ Core: Update architecture docs from persona batch [DATE]"
git push origin main  # or 'master'
```

---

## Architecture Coverage Goals

| Milestone | Coverage | Status |
|-----------|----------|--------|
| Initial docs created | 9.5% | ✅ Current |
| All TS/TSX files claimed | ~45% | 🎯 Next target |
| All code files claimed | ~60% | 📋 Planned |
| All JSON data files claimed | 100% | 📋 Future |

---

## Domain Document Template

When adding files to a domain doc, use this format:

```markdown
### File Ownership

| File | Purpose |
|------|---------|
| `src/systems/spells/targeting/AoECalculator.ts` | Area of effect shape calculations |
| `src/systems/spells/targeting/TargetResolver.ts` | Valid target determination |
```

---

## Hot Files to Watch

These files are modified frequently - check for semantic conflicts:

| File | Risk Level | Domains |
|------|------------|---------|
| `src/types/index.ts` | HIGH | All |
| `src/App.tsx` | HIGH | All |
| `src/state/appState.ts` | MEDIUM | All |
| `src/types/combat.ts` | MEDIUM | Combat, Spells, BattleMap |
| `src/types/spells.ts` | MEDIUM | Spells, Combat, Glossary |
| `src/constants.ts` | LOW | All |

---

## Troubleshooting

### "Orphaned files keep appearing"

Personas may not be logging new files. Check:
1. Is `_METHODOLOGY.md` updated with Architecture Awareness section?
2. Remind personas in their next batch

### "Semantic conflicts after merge"

Git auto-merged but code is broken:
1. Check if two personas modified related logic
2. Review the dependency graph to understand impact
3. Fix manually and add a worklog entry about the conflict

### "Coverage stuck at low percentage"

The initial bulk of file assignment is manual. Options:
1. Assign files yourself in focused sessions
2. Create a temporary "File Assignment" task for specific personas
3. Accept low coverage initially; it will improve as new files get logged

---

## Commands Reference

```bash
# Regenerate dependency graph
npx tsx scripts/generate-architecture-compendium.ts

# Check coverage status
npx tsx scripts/verify-architecture-coverage.ts

# Find unvisited files (for audit personas)
grep -rL "@visited" src/ --include="*.ts" --include="*.tsx" | head -20

# Find new file worklog entries
grep -r "New File Created" .jules/worklogs/

# Validate project
npm run validate
```
