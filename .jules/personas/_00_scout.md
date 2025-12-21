# Scout Persona - PR Intelligence Gatherer

**Run by:** The human maintainer (you) BEFORE the Core persona  
**Execution:** Via Gemini CLI with GitHub MCP enabled

**Purpose:** Scan recent PRs, build a growing manifest of PR activity, and trigger Gemini Code Assist reviews on all open PRs.

---

## When to Run This

Run this **before** the Core persona workflow:
1. Before reviewing/merging persona batch PRs
2. At the start of each day when managing PR queues
3. Anytime you need an updated view of PR activity

---

## Prerequisites

- Gemini CLI installed and configured
- GitHub MCP enabled with valid PAT (`GITHUB_MCP_PAT`)
- Repository: `Gambitnl/Aralia`

---

## Execution Commands

### Option 1: Run via Gemini CLI Interactive

```bash
gemini
```

Then in the Gemini CLI session:

```
Scan the latest 50 PRs on Gambitnl/Aralia. For each PR:
1. Get the PR number, title, state (open/closed/merged), and author
2. Get the list of files modified by that PR
3. Append this information to .jules/manifests/pr_manifest.md
4. If the PR is still OPEN, post a comment "/gemini review" to trigger Gemini Code Assist

Format the manifest entry as:
## PR #<number>: <title>
- **State:** <state>
- **Author:** <author>
- **Files Modified:**
  - <file1>
  - <file2>
  - ...

Only add new PRs that aren't already in the manifest. Skip posting /gemini review if it was already posted.
```

### Option 2: Run via Gemini CLI One-Shot

```bash
gemini -p "Scan the latest 50 PRs on Gambitnl/Aralia. For each open PR, post a comment '/gemini review'. Then append PR details (number, title, files modified) to .jules/manifests/pr_manifest.md if not already present."
```

---

## Output: PR Manifest

The manifest grows over time at `.jules/manifests/pr_manifest.md`:

```markdown
# PR Manifest

This file tracks all PRs scanned by the Scout persona.
Last updated: [timestamp]

---

## PR #123: [Warlord] Combat reducer refactor
- **State:** merged
- **Author:** jules-app[bot]
- **Scanned:** 2025-12-21
- **Files Modified:**
  - src/state/combatReducer.ts
  - src/types/combat.ts

## PR #124: [Vector] Add targeting types
- **State:** open
- **Author:** jules-app[bot]
- **Scanned:** 2025-12-21
- **Gemini Review Triggered:** ✅
- **Files Modified:**
  - src/types/targeting.ts
  - src/systems/spells/targeting/TargetResolver.ts
```

---

## Conflict Detection (Future Enhancement)

Once the manifest is populated, use it to detect conflicts:

```bash
gemini -p "Analyze .jules/manifests/pr_manifest.md and identify any OPEN PRs that modify the same files. Report potential conflicts."
```

---

## Workflow Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    BATCH WORKFLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Dispatch 45 Jules personas (parallel)                   │
│        ↓                                                    │
│  2. PRs created by Jules                                    │
│        ↓                                                    │
│  3. 🔍 RUN SCOUT PERSONA ← You are here                     │
│     - Scans latest 50 PRs                                   │
│     - Updates pr_manifest.md                                │
│     - Posts /gemini review on open PRs                      │
│        ↓                                                    │
│  4. Gemini Code Assist reviews all open PRs                 │
│        ↓                                                    │
│  5. RUN CORE PERSONA                                        │
│     - Consolidates worklogs                                 │
│     - Checks for conflicts (using manifest)                 │
│     - Merges PRs                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Notes

- The `/gemini review` command triggers Gemini Code Assist to perform a code review pass
- Scout does NOT merge or close PRs — it only gathers intelligence
- The manifest is append-only; old PRs remain for historical reference
- Use the manifest to identify file overlap conflicts before merging
