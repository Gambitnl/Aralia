# Herald Persona - Batch Initializer

**Run by:** The human maintainer (you) BEFORE dispatching Jules agents  
**Execution:** Via Gemini CLI or manually

**Purpose:** Prepare the local communication infrastructure for a new Jules batch run by archiving previous data and initializing fresh channels.

---

## When to Run This

Run Herald **before** dispatching Jules agents:
1. At the start of each new batch run
2. After Core has finished consolidating the previous batch
3. Before any Jules personas are triggered

---

## Herald Workflow

### Step 1: Sync Latest State & Archive Previous Batch

```bash
# Sync repository
git checkout master
git pull origin master

# Archive previous batch chat data (prevents dashboard slowdown)
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveDir = ".uplink/archive"
if (!(Test-Path $archiveDir)) { New-Item -ItemType Directory -Path $archiveDir }

# Archive main chat log
if (Test-Path ".uplink/data/LOCAL_CHAT.json") {
    Move-Item ".uplink/data/LOCAL_CHAT.json" "$archiveDir/LOCAL_CHAT_$timestamp.json"
}

# Archive side channels
Get-ChildItem ".uplink/data/LOCAL_CHAT_*.json" | ForEach-Object {
    $channelName = $_.BaseName -replace '^LOCAL_CHAT_', ''
    Move-Item $_.FullName "$archiveDir/LOCAL_CHAT_${channelName}_$timestamp.json"
}

# Initialize fresh main channel
@() | ConvertTo-Json | Set-Content ".uplink/data/LOCAL_CHAT.json"

# Initialize fresh agent status
@{} | ConvertTo-Json | Set-Content ".uplink/data/AGENT_STATUS.json"
```

### Step 2: Start Local Chat Server

```bash
# Ensure the local chat server is running
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python .uplink/local_chat.py --server"

# Verify server is accessible
Start-Sleep -Seconds 2
curl http://localhost:8000/api/channels
```

### Step 3: Send Initialization Message

```bash
# Post INIT message to main channel
python .uplink/local_chat.py --send "#Herald [STATUS: initializing] INIT: Batch initialized. Dashboard running at http://localhost:8000. Dispatching 45 agents. Previous batch archived to .uplink/archive/LOCAL_CHAT_$timestamp.json"
```

### Step 4: Update _ROSTER.md (Optional)

If using batch tracking in _ROSTER.md, update with batch timestamp:

```bash
# Update batch timestamp in ROSTER
$rosterPath = ".jules/_ROSTER.md"
$batchId = "batch-$timestamp"
(Get-Content $rosterPath) -replace 'Current Batch: .*', "Current Batch: $batchId" | Set-Content $rosterPath

git add .jules/_ROSTER.md
git commit -m "🚀 Herald: Initialize batch $batchId"
git push origin master
```

### Step 5: Verify

- Open the dashboard: `http://localhost:8000`
- Verify the INIT message appears in the main channel
- Confirm AGENT_STATUS.json is empty (ready for fresh beacons)
- Check that archive directory contains previous batch data

---

## Data Hygiene: The "Ribbon Cutting" Process

Herald's archive rotation prevents the dashboard from choking on historical data during high-intensity batch runs:

1. **Before each batch**: Previous `LOCAL_CHAT.json` is timestamped and moved to `.uplink/archive/`
2. **Fresh start**: New batch begins with an empty chat log
3. **Side channels**: All channel files (e.g., `LOCAL_CHAT_lint-coordination.json`) are also archived
4. **Status reset**: `AGENT_STATUS.json` is cleared to track only active agents

This ensures O(1) performance for the dashboard regardless of project history.

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
│     ├─ Archive previous LOCAL_CHAT.json                │
│     ├─ Initialize fresh channels                       │
│     ├─ Start local chat server                         │
│     ├─ Send INIT message                               │
│     └─ Update _ROSTER.md (optional)                    │
│              ↓                                         │
│  ⚙️  JULES (45 agents in parallel)                     │
│     └─ Each agent reads LOCAL_CHAT, claims task, works │
│              ↓                                         │
│  🔍 SCOUT (After Jules, before Core)                   │
│     ├─ Scan PRs                                        │
│     ├─ Build manifest                                  │
│     ├─ Trigger /gemini review                          │
│     └─ Detect poison files                             │
│              ↓                                         │
│  🏛️  CORE (After)                                      │
│     ├─ Consolidate worklogs                            │
│     ├─ Resolve conflicts                               │
│     ├─ Merge PRs                                       │
│     └─ Run Herald for next batch                       │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Key Changes from NTFY Era

This Herald protocol has evolved from a "Cloud-Only Initializer" to a "Local-Hybrid Orchestrator":

1. **No NTFY dependency**: All coordination happens via LOCAL_CHAT.json
2. **Archive rotation**: Prevents dashboard performance degradation
3. **Server startup**: Local chat server must be running before agent dispatch
4. **Channel awareness**: Supports side channels for specialized coordination
5. **Branch correction**: Uses `master` instead of `main`
6. **Path updates**: All references now point to `.uplink/` instead of `.agent_tools/`

---

## Handover to Scout and Core

**Herald → Scout**: After batch initialization, Scout waits for Jules PRs to appear, then scans for conflicts and poison files.

**Scout → Core**: After Scout completes review triggers and conflict detection, Core takes over for consolidation and merge operations.

**Core → Herald**: After Core completes a batch merge, Herald is run again to prepare for the next cycle.
