# Herald Persona - Batch Initializer

**Run by:** The human maintainer (you) BEFORE dispatching Jules agents  
**Execution:** Via Gemini CLI or manually

**Purpose:** Prepare the communication infrastructure for a new Jules batch run by creating a fresh uplink topic and pushing it to GitHub.

---

## When to Run This

Run Herald **before** dispatching Jules agents:
1. At the start of each new batch run
2. After Core has finished consolidating the previous batch
3. Before any Jules personas are triggered

---

## Herald Workflow

### Step 1: Sync Latest State

```bash
git checkout main
git pull origin main
```

### Step 2: Generate New Batch Topic

```powershell
# PowerShell
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$random = -join ((65..90) + (97..122) | Get-Random -Count 5 | % {[char]$_})
$topic = "jules-batch-$timestamp-$random"
$topicUrl = "https://ntfy.sh/$topic"

Write-Host "New batch topic: $topicUrl"

# Update _ROSTER.md with the new topic URL
(Get-Content .jules/_ROSTER.md) -replace 'https://ntfy\.sh/[a-zA-Z0-9_-]+', $topicUrl | Set-Content .jules/_ROSTER.md
```

Or using the uplink script:

```bash
# Generate topic name
python .agent_tools/uplink.py --generate-topic
# Copy the output and manually update _ROSTER.md, or use sed:
# topic=$(python .agent_tools/uplink.py --generate-topic | grep "Generated topic" | cut -d' ' -f3)
# sed -i "s|https://ntfy.sh/[a-zA-Z0-9_-]*|https://ntfy.sh/$topic|g" .jules/_ROSTER.md
```

### Step 3: Commit and Push

```bash
git add .jules/_ROSTER.md
git commit -m "🚀 Herald: Initialize batch uplink topic"
git push origin main
```

### Step 4: Send Initialization Message

```bash
python .agent_tools/uplink.py --message "INIT: Herald — Batch initialized, dispatching 45 agents" --title "Herald" --tags "rocket"
```

### Step 5: Verify

- Open the topic URL in a browser: `https://ntfy.sh/<topic-name>`
- Run `python .agent_tools/uplink.py --read` to confirm the INIT message appears

---

## Post-Batch: Poison Detection (Scout's Job)

After Jules PRs are created, Scout should flag any PR containing forbidden files:

### Forbidden Files (Auto-Reject)
- `package-lock.json`
- `tsconfig.tsbuildinfo`
- `dist/` folder contents

### Scout Action
If a PR modifies these files, Scout posts:
```
⚠️ POISON DETECTED: This PR modifies forbidden files (package-lock.json, tsconfig.tsbuildinfo).

Please run:
git checkout HEAD -- package-lock.json tsconfig.tsbuildinfo
git commit --amend --no-edit
git push --force

Then request re-review.
```

---

## After Herald

Once Herald completes:

1. **Dispatch Jules agents** (all 45 personas)
2. Wait for Jules to complete
3. **Run Scout** (scan PRs, trigger reviews, **detect poison**)
4. **Run Core** (consolidate, merge)

---

## Workflow Position

```
┌────────────────────────────────────────────────────────┐
│                    BATCH LIFECYCLE                     │
├────────────────────────────────────────────────────────┤
│                                                        │
│  🚀 HERALD (Before)                                    │
│     ├─ Generate uplink topic                           │
│     ├─ Update _ROSTER.md                               │
│     ├─ Push to GitHub                                  │
│     └─ Send INIT message                               │
│              ↓                                         │
│  ⚙️  JULES (45 agents in parallel)                     │
│     └─ Each agent reads uplink, claims task, works     │
│              ↓                                         │
│  🔍 SCOUT (After Jules, before Core)                   │
│     ├─ Scan PRs                                        │
│     ├─ Build manifest                                  │
│     └─ Trigger /gemini review                          │
│              ↓                                         │
│  🏛️  CORE (After)                                      │
│     ├─ Consolidate worklogs                            │
│     ├─ Resolve conflicts                               │
│     └─ Merge PRs                                       │
│                                                        │
└────────────────────────────────────────────────────────┘
```
