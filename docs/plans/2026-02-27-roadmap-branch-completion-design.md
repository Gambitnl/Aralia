# Design: Roadmap Branch Completion
**Date:** 2026-02-27
**Status:** Approved
**Branch:** Dev Tools > Roadmap (Capability-First)

---

## 1. Intent

The roadmap exists to break a recurring cycle: features get started, never finished, and new ideas pile on before old ones close. The roadmap tool itself fell into the same trap.

The goal of this work is to make the Roadmap (Capability-First) branch **honest and complete** — accurate statuses applied, missing capabilities built, and the tool functioning as a living dashboard for the whole codebase. Once the Roadmap branch is done, it becomes the instrument used to manage every other branch.

The roadmap's job is to surface five dimensions for any feature:
1. **Implementation status** — is it actually built?
2. **Test status** — is it covered and passing?
3. **TODO debt** — what's outstanding on it?
4. **Ideas** — what's parked against it for later?
5. **Atomization** — is it scoped tightly enough to reason about?

---

## 2. Scope

**In scope:** Roadmap (Capability-First) branch exclusively — ~63 nodes across 7 L2 capability groups:
- Documentation Intelligence
- Interaction UX
- Layout Persistence
- Node Test Execution Capability
- Roadmap API Surface Capability
- Strategic Opportunity Mapping
- Visualization Stability

**Out of scope:** All other Dev Tools child branches (Race Enrichment Pipeline, Race Portrait Image Generation, etc.)

**Pre-audit fix already shipped:** `windowsHide: true` added to `runBridge()` in `scripts/roadmap-server-logic.ts` — cmd prompt windows no longer appear on roadmap load.

---

## 3. Current Feature Inventory (Ground Truth)

A full code audit was run before writing this plan. Results are the baseline for all status corrections.

### 3.1 Fully Functional (as of 2026-02-27)

**UI / Visualizer** (`src/components/debug/roadmap/RoadmapVisualizer.tsx`):
- Data loading & rendering from `/api/roadmap/data`
- Pan/zoom (cursor-centric, 0.35x–2.6x)
- Node drag & drop with 36px grid snap, subtree drag for branch nodes
- Node selection + detail drawer (status, description, related docs with type badges)
- Expand/collapse per-node and global Expand All / Collapse All
- Manual save ("Save Layout Now") and auto-save with 420ms debounce
- Dark/light theme toggle (persisted in localStorage)
- Crosslinks toggle (show/hide dashed relationship edges)
- At-a-Glance widget (Done/Active/Planned counts, zoom %, progress %)
- VS Code integration ("Open in VS Code" via `/api/roadmap/open-in-vscode`)
- Node test execution: "Run Node Test" and "Run Child Node Tests" buttons
- Node test result display (pass/fail summary, first failure detail, auto-refresh after run)
- Opportunity collector drawer (Direct/Propagated modes, flag severity chips, "Go To Node")
- Opportunity scanner (manual trigger + configurable auto-scan interval)
- Layout help panel toggle
- Connector rendering with Bezier curves and glow filters

**API Endpoints** (all in `vite.config.ts`):
- `GET /api/roadmap/data` — roadmap node/edge graph
- `GET /api/roadmap/layout` — saved position overrides
- `POST /api/roadmap/layout` — persist positions to `.agent/roadmap-local/layout.json`
- `POST /api/roadmap/open-in-vscode` — spawn `code -r <path>`
- `POST /api/roadmap/tests/run-nodes` — execute node tests, return pass/fail
- `GET /api/roadmap/opportunities` — latest cached scan or on-demand scan
- `POST /api/roadmap/opportunities/scan` — fresh scan with trigger mode
- `GET /api/roadmap/opportunities/settings` — read scanner config
- `POST /api/roadmap/opportunities/settings` — write scanner config (endpoint works; UI doesn't expose a form yet)

**Backend scripts:**
- `scripts/roadmap-server-logic.ts` — fallback wrapper, all public-build functions work
- `scripts/roadmap-local-bridge.ts` — subprocess CLI bridge to local engine
- `scripts/roadmap-node-test.ts` — node test runner (structure validation + isolated command execution)
- `scripts/roadmap-packet-validation.ts` — AJV schema validation for run artifacts

### 3.2 Partially Functional

| Feature | Gap |
|---------|-----|
| Node test status persistence | Results stored in roadmap-engine only (gitignored); not exposed via public API |
| Layout restore on load | Save/load works; occasional sync edge cases on initial load |
| Opportunity settings UI | POST endpoint works; no UI form to edit settings |
| Snapshot persistence | Read works; write partially covered |

### 3.3 Stub / Fallback Only (Requires Local Engine)

These features return safe empty responses in public build (CI/GitHub) and only function with the private `scripts/roadmap-engine/` files:
- Real roadmap data generation (from docs/@DOC-REGISTRY.md processing)
- Real opportunity flag detection and scoring
- Node test definitions and persistent results
- Feature extraction and synthesis
- Session closing and doc processing (roadmap-session-close.ts — partial)
- Run orchestration (roadmap-orchestrate-one-doc.ts — partial)

---

## 4. Phase 1 — Audit + Corrective Action

### 4.1 Approach

The audit does not stop at producing a report. After the correction table is reviewed and approved, the agent applies all corrections directly to the roadmap branch's source data.

**For each of the ~63 nodes:**
1. Compare node description against inventory ground truth (Section 3)
2. Propose status correction (done / active / planned)
3. Flag nodes that should be removed (dead scope), merged (duplicate), or restructured (excessive siblings)
4. After user approval — apply corrections, add missing nodes, prune dead ones

### 4.2 Known Corrections from Inventory

The following are already known before the detailed audit runs:

**Should move to `done`** (fully functional per inventory):

*Interaction UX:*
- Canvas Pan Drag Navigation (`active` → `done`)
- Expand All And Collapse All Controls (`active` → `done`)
- Node Detail Drawer (`active` → `done`)
- Node Drag Repositioning (`active` → `done`)
- Open Related Docs In VS Code (`active` → `done`)
- Single Node Expand Collapse (`active` → `done`)
- View Reset Control (`active` → `done`)
- Wheel Zoom Around Cursor (`active` → `done`)

*Layout Persistence:*
- Auto-save And Manual Save Clarity (`active` → `done`)
- Auto-save Debounce Cycle (`active` → `done`)
- Manual Save Trigger (`active` → `done`)

*Node Test Execution Capability:*
- Node Test Data Refresh After Run (`active` → `done`)
- Node Test Result Status Feedback (`active` → `done`)
- Run Child Node Tests (`active` → `done`)
- Run Node Test Self Plus Descendants (`active` → `done`)

*Roadmap API Surface:*
- Layout Endpoint Read Write (`active` → `done`)
- Node Test Run Endpoint (`active` → `done`)
- Opportunities Latest Endpoint (`active` → `done`)
- Opportunities Scan Endpoint (`active` → `done`)
- Roadmap Data Endpoint (`active` → `done`)
- VS Code Open Endpoint (`active` → `done`)

*Strategic Opportunity Mapping:*
- Crosslink Detection (`active` → `done`) — module exists and functional
- Flag Classification (`active` → `done`) — module exists and functional
- Propagation And Rollup (`active` → `done`) — module exists and functional
- Scan Orchestration (`active` → `done`) — module exists and functional
- Node Navigation (`active` → `done`)
- Opportunity Collection (`active` → `done`)
- Scan Trigger (`active` → `done`)
- Triage Panel (`active` → `done`)

*Visualization Stability:*
- Connector Rendering Reliability (`active` → `done`) — glow filters shipping

**Remain `active`** (partial/gaps remain):
- Layout Restore On Load (sync edge cases)
- Node Test Status Persistence (local-engine only)
- Opportunities Settings Endpoint / UI (write endpoint exists, UI form missing)
- Snapshot Persistence (partial)
- Documentation Intelligence nodes (orchestrator partially implemented)
- Feature Taxonomy Integrity (partially implemented)

**Remain `planned`** (nothing built):
- Filters And Sorts (opportunity drawer)
- Historical Development Traceability
- Multi-product Portfolio Branching (future)

### 4.3 Corrective Action Scope

After approval, the agent must:
1. Apply all status corrections to the roadmap source data
2. Add new nodes for capabilities being built in Phase 2 (health signals, node test presence check)
3. Prune or restructure any nodes where sibling count is excessive relative to tree depth
4. Verify node density: no flat list of siblings should be disproportionately wide for its depth level

### 4.4 Correction Table Output

**File:** `docs/plans/2026-02-27-roadmap-audit-corrections.md`

Format:
| Node | Current | Proposed | Evidence | Action |
|------|---------|----------|----------|--------|
| Canvas Pan Drag Navigation | active | done | Pan verified in UI | Update status |
| Node Test Status Persistence | active | active | Local-engine only, not in public build | No change |

**Parking Lot** section at bottom of corrections doc for any ideas triggered during audit.
**Zero code changes during audit phase.**

---

## 5. Phase 2 — Build Missing Capabilities

After audit corrections are applied, build in this order:

### 5.1 Priority Order

1. **Node Health Signal System** (foundational — gates health indicators)
2. **Node Test Presence Check** (new capability — depends on health signals)
3. **Opportunity Settings UI Form** (small gap — write endpoint already exists)
4. **Node Test Status Persistence** (wire public API to results)
5. **Remaining `active` nodes** (audit results determine exact list)

### 5.2 Node Health Signal System

Three visual warning indicators displayed on nodes:

| Indicator | Condition | Display |
|-----------|-----------|---------|
| No test attached | Node has no `testFile` field | Amber warning badge |
| Test not run | `testFile` exists but no `lastTestRun` result | Clock/stale badge (distinct from no-test) |
| Not atomized | Node links to more than 1 component file | Fragmentation badge |
| Density warning | Node has a disproportionately large flat sibling count | Scope smell badge on parent |

Indicators are **visual only** — they surface problems, they don't auto-fix.

### 5.3 Node Test Presence Check (New Capability)

Nodes need to declare which test file covers them. This field does not currently exist.

**What to build:**
- `testFile` field added to node data schema (path to associated test)
- `lastTestRun` field: `{ timestamp, status: 'pass' | 'fail' | 'unverified' }`
- Pipeline check: does the declared `testFile` path exist on disk?
- Health signal renderer reads these fields to decide badge
- Wires into existing Node Test Status Persistence infrastructure

This is new scope but **load-bearing** — without it, the health signal system is missing its primary pillar.

### 5.4 Architectural Principles (Apply Throughout Build)

**Feature-name-driven folder structure:**
New files must live under named feature directories. Do not add flat siblings to `scripts/roadmap-*.ts`.

Example target structure for new code:
```
scripts/roadmap/
  health-signals/      ← new: health signal logic
  node-test-presence/  ← new: test presence checker

src/components/debug/roadmap/
  health-signals/      ← new: badge components
  node-test-presence/  ← new: presence UI
```

**Existing file reorganization** is a separate dedicated step — do not reorganize current `scripts/roadmap-*.ts` files mid-feature-build. Do it as its own step with full reference sweeps.

**Node density principle:**
When adding nodes to the roadmap branch, prefer grouping over long flat lists. A disproportionately wide sibling list at any depth level is a signal to introduce a grouping node. No hard number — it's proportional to tree depth and semantic coherence.

---

## 6. Parking Lot

Ideas captured during design — not in scope for this work:

- **Code atomization**: Splitting large feature files into single-responsibility files. Major architectural direction, needs its own design session. Excludes vendor code.
- **At-a-Glance info bubble**: The widget counts all expanded nodes (not a single branch). Needs tooltip explaining this. Small UX fix — defer to post-completion.
- **TIDY UP flow re-surfacing**: The `/tidy-up` session ritual is now just a minor listing on the tooling page. Should be more discoverable. Defer.
- **Roadmap full file reorganization**: Consolidating `scripts/roadmap-*.ts` flat files into feature-name folders. Separate step after capabilities stabilize.

---

## 7. Success Criteria

The Roadmap (Capability-First) branch is **done** when:

1. All ~63 nodes reflect accurate statuses (corrections applied)
2. Known `active` → `done` promotions from Section 4.2 are reflected
3. Node health signals are visible in the UI (no-test, test-not-run, not-atomized, density badges)
4. Node test presence check is implemented and wired into the health signal system
5. New capabilities built during Phase 2 have corresponding roadmap nodes with correct statuses
6. No flat sibling lists that are disproportionately wide for their depth
7. New files created follow feature-name-driven folder conventions

---

## 8. Out of Scope (Explicit)

- Other Dev Tools branches (Race Enrichment, Race Portrait, etc.)
- World Exploration branch work
- Code atomization / file splitting
- TIDY UP flow changes
- At-a-Glance box tooltip
- Full roadmap file reorganization (separate step)
- Any game feature work (combat, economy, character systems, etc.)
