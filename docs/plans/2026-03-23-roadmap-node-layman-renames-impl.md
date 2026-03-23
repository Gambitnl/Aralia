# Roadmap Node Layman Renames — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename every opaque roadmap node to plain English that a non-technical person can read cold and immediately understand.

**Architecture:** All renames are added as entries to `ROADMAP_CAPABILITY_RENAME_RULES` in `generate.ts`. New rules appended at the end of the array override earlier rules for the same `from` key (the `Map` constructor keeps the last entry). Node IDs remain stable — layout positions and test history are unaffected. No other files need changing.

**Tech Stack:** TypeScript (`generate.ts`), Vite dev server, live browser verification

---

### How the rename system works (read before implementing)

Each rule is `{ from: string, to: string }` where `from` is the **original milestone source name** (the `name:` field in the milestones array). Rules are appended after existing ones — duplicate `from` keys resolve to the last entry in the array, so new rules silently override old ones.

When a parent is renamed, children in the same sub-tree must also have their `to` path updated to use the new parent name — otherwise children appear under the old parent path.

The array ends at the closing `];` on line ~1792 of `generate.ts`. All new entries go just before that `];`.

---

### Task 1: Rename Roadmap Tool sub-branch parents + Layout Persistence child

**Files:**
- Modify: `devtools/roadmap/scripts/roadmap-engine/generate.ts` (just before closing `];` of `ROADMAP_CAPABILITY_RENAME_RULES`)

**Step 1: Add these entries to the rename rules array**

```ts
  // ── Layman renames: Roadmap Tool sub-branch parents ──────────────────────
  {
    from: 'Roadmap Tool > Visualization Stability',
    to: 'Roadmap Tool > Graph Display Stability'
  },
  {
    from: 'Roadmap Tool > Visualization Stability > Connector Rendering Reliability',
    to: 'Roadmap Tool > Graph Display Stability > Connector Rendering Reliability'
  },
  {
    from: 'Roadmap Tool > Node Test Execution Capability',
    to: 'Roadmap Tool > Run Tests From the Roadmap'
  },
  {
    from: 'Roadmap Tool > Node Health Signals',
    to: 'Roadmap Tool > Node Quality Warnings'
  },
  {
    from: 'Roadmap Tool > Node Test Presence',
    to: 'Roadmap Tool > Which Nodes Have Tests'
  },
  {
    from: 'Roadmap Tool > Documentation Intelligence',
    to: 'Roadmap Tool > Doc Processing Pipeline'
  },
  // ── Layman renames: Layout Persistence children ───────────────────────────
  {
    from: 'Roadmap Tool > Layout Persistence > Auto-save Debounce Cycle',
    to: 'Roadmap Tool > Layout Persistence > Delayed Auto-Save'
  },
```

**Step 2: Verify TypeScript compiles**

```bash
cd "F:/Repos/Aralia" && npx tsc --noEmit --project devtools/roadmap/tsconfig.json 2>&1 | grep "generate.ts" | head -5
```

Expected: no errors on `generate.ts`

**Step 3: Commit**

```bash
cd "F:/Repos/Aralia" && git add devtools/roadmap/scripts/roadmap-engine/generate.ts && git commit -m "refactor(roadmap): rename Roadmap Tool sub-branch parents to plain English"
```

---

### Task 2: Rename Node Test Execution Capability children

**Files:**
- Modify: `devtools/roadmap/scripts/roadmap-engine/generate.ts`

**Step 1: Add these entries (children must use the new parent name in their `to` path)**

```ts
  // ── Layman renames: Run Tests From the Roadmap children ───────────────────
  {
    from: 'Roadmap Tool > Node Test Execution Capability > Run Node Test (Self Plus Descendants)',
    to: 'Roadmap Tool > Run Tests From the Roadmap > Run This Node and Its Children\'s Tests'
  },
  {
    from: 'Roadmap Tool > Node Test Execution Capability > Run Child Node Tests (Descendants Only)',
    to: 'Roadmap Tool > Run Tests From the Roadmap > Run Only Child Tests'
  },
  {
    from: 'Roadmap Tool > Node Test Execution Capability > Node Test Result Status Feedback',
    to: 'Roadmap Tool > Run Tests From the Roadmap > Show Test Pass/Fail Results'
  },
  {
    from: 'Roadmap Tool > Node Test Execution Capability > Node Test Status Persistence',
    to: 'Roadmap Tool > Run Tests From the Roadmap > Remember Test Results Between Sessions'
  },
  {
    from: 'Roadmap Tool > Node Test Execution Capability > Node Test Data Refresh After Run',
    to: 'Roadmap Tool > Run Tests From the Roadmap > Refresh Results After Running'
  },
```

**Step 2: Verify TypeScript compiles**

```bash
cd "F:/Repos/Aralia" && npx tsc --noEmit --project devtools/roadmap/tsconfig.json 2>&1 | grep "generate.ts" | head -5
```

**Step 3: Commit**

```bash
cd "F:/Repos/Aralia" && git add devtools/roadmap/scripts/roadmap-engine/generate.ts && git commit -m "refactor(roadmap): rename node test execution children to plain English"
```

---

### Task 3: Rename Node Health Signals children

**Files:**
- Modify: `devtools/roadmap/scripts/roadmap-engine/generate.ts`

**Step 1: Add these entries**

```ts
  // ── Layman renames: Node Quality Warnings children ────────────────────────
  {
    from: 'Roadmap Tool > Node Health Signals > Health Signal Computation',
    to: 'Roadmap Tool > Node Quality Warnings > How Warnings Are Calculated'
  },
  {
    from: 'Roadmap Tool > Node Health Signals > Health Badge Component',
    to: 'Roadmap Tool > Node Quality Warnings > Warning Badge Display'
  },
  {
    from: 'Roadmap Tool > Node Health Signals > Visualizer Integration',
    to: 'Roadmap Tool > Node Quality Warnings > Warnings Shown On Canvas'
  },
  {
    from: 'Roadmap Tool > Node Health Signals > Density Warning Detection',
    to: 'Roadmap Tool > Node Quality Warnings > Too Many Children Warning'
  },
```

**Step 2: Verify TypeScript compiles**

```bash
cd "F:/Repos/Aralia" && npx tsc --noEmit --project devtools/roadmap/tsconfig.json 2>&1 | grep "generate.ts" | head -5
```

**Step 3: Commit**

```bash
cd "F:/Repos/Aralia" && git add devtools/roadmap/scripts/roadmap-engine/generate.ts && git commit -m "refactor(roadmap): rename node health signal children to plain English"
```

---

### Task 4: Rename Node Test Presence children

**Files:**
- Modify: `devtools/roadmap/scripts/roadmap-engine/generate.ts`

**Step 1: Add these entries (note: `Pipeline Annotation` was already renamed to `Test Metadata Annotation` by an existing rule — override it here)**

```ts
  // ── Layman renames: Which Nodes Have Tests children ───────────────────────
  {
    from: 'Roadmap Tool > Node Test Presence > Test File Declaration Schema',
    to: 'Roadmap Tool > Which Nodes Have Tests > How Tests Are Declared'
  },
  {
    from: 'Roadmap Tool > Node Test Presence > Disk Presence Checker',
    to: 'Roadmap Tool > Which Nodes Have Tests > Verify Test Files Exist'
  },
  {
    from: 'Roadmap Tool > Node Test Presence > Pipeline Annotation',
    to: 'Roadmap Tool > Which Nodes Have Tests > Stamp Nodes With Test Info'
  },
```

**Step 2: Verify TypeScript compiles**

```bash
cd "F:/Repos/Aralia" && npx tsc --noEmit --project devtools/roadmap/tsconfig.json 2>&1 | grep "generate.ts" | head -5
```

**Step 3: Commit**

```bash
cd "F:/Repos/Aralia" && git add devtools/roadmap/scripts/roadmap-engine/generate.ts && git commit -m "refactor(roadmap): rename node test presence children to plain English"
```

---

### Task 5: Rename Roadmap API Surface and its children

**Files:**
- Modify: `devtools/roadmap/scripts/roadmap-engine/generate.ts`

**Step 1: Add these entries (these override the existing rules that only dropped the "Capability" suffix)**

```ts
  // ── Layman renames: Roadmap Server Endpoints + children ───────────────────
  // These override the earlier partial renames that only removed "Capability".
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability',
    to: 'Roadmap Tool > Roadmap Server Endpoints'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Roadmap Data Endpoint',
    to: 'Roadmap Tool > Roadmap Server Endpoints > Serve Roadmap Data'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Layout Endpoint (Read Write)',
    to: 'Roadmap Tool > Roadmap Server Endpoints > Save and Load Layout'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Node Test Run Endpoint',
    to: 'Roadmap Tool > Roadmap Server Endpoints > Run Tests From Browser'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Opportunities Latest Endpoint',
    to: 'Roadmap Tool > Roadmap Server Endpoints > Fetch Current Opportunities'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Opportunities Scan Endpoint',
    to: 'Roadmap Tool > Roadmap Server Endpoints > Trigger an Opportunity Scan'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Opportunities Settings Endpoint',
    to: 'Roadmap Tool > Roadmap Server Endpoints > Opportunity Scan Settings'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > VS Code Open Endpoint',
    to: 'Roadmap Tool > Roadmap Server Endpoints > Open File in VS Code'
  },
```

**Step 2: Verify TypeScript compiles**

```bash
cd "F:/Repos/Aralia" && npx tsc --noEmit --project devtools/roadmap/tsconfig.json 2>&1 | grep "generate.ts" | head -5
```

**Step 3: Commit**

```bash
cd "F:/Repos/Aralia" && git add devtools/roadmap/scripts/roadmap-engine/generate.ts && git commit -m "refactor(roadmap): rename API surface branch and children to plain English"
```

---

### Task 6: Rename Documentation Intelligence and its children

**Files:**
- Modify: `devtools/roadmap/scripts/roadmap-engine/generate.ts`

**Step 1: Add these entries (override earlier rules)**

```ts
  // ── Layman renames: Doc Processing Pipeline + children ────────────────────
  // These override the earlier renames that used "Single-document Processing Capability".
  {
    from: 'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline',
    to: 'Roadmap Tool > Doc Processing Pipeline > Process One Doc at a Time'
  },
  {
    from: 'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Worker Packet Validation Gate',
    to: 'Roadmap Tool > Doc Processing Pipeline > Process One Doc at a Time > Validate Doc Before Processing'
  },
  {
    from: 'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Feature-Oriented Naming Guard',
    to: 'Roadmap Tool > Doc Processing Pipeline > Process One Doc at a Time > Enforce Capability-First Names'
  },
  {
    from: 'Roadmap Tool > Documentation Intelligence > Feature Taxonomy Integrity',
    to: 'Roadmap Tool > Doc Processing Pipeline > Node Names Follow Naming Rules'
  },
```

**Step 2: Verify TypeScript compiles**

```bash
cd "F:/Repos/Aralia" && npx tsc --noEmit --project devtools/roadmap/tsconfig.json 2>&1 | grep "generate.ts" | head -5
```

**Step 3: Commit**

```bash
cd "F:/Repos/Aralia" && git add devtools/roadmap/scripts/roadmap-engine/generate.ts && git commit -m "refactor(roadmap): rename doc intelligence branch and children to plain English"
```

---

### Task 7: Rename Strategic Opportunity Mapping children

**Files:**
- Modify: `devtools/roadmap/scripts/roadmap-engine/generate.ts`

**Step 1: Add these entries**

```ts
  // ── Layman renames: Strategic Opportunity Mapping children ────────────────
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Collection',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Gather Improvement Opportunities'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Scan Orchestration',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Run the Opportunity Scan'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Flag Classification',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Label Each Opportunity Type'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Propagation and Rollup',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Roll Opportunities Up to Parent Nodes'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Snapshot Persistence',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Save Opportunity Results to Disk'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Scan Trigger',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Button to Start a Scan'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Triage Panel',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Review and Dismiss Opportunities'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity-to-Node Navigation',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Jump to Node From Opportunity'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Crosslink Detection',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Find Shared Opportunities Across Branches'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Public Facade Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Opportunity System Entry Point'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Type Contracts Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Opportunity Data Shapes'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Graph Context Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Graph Data for Opportunity Scanning'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Scanner Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > The Opportunity Scanner'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Flag Classifier Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Opportunity Type Labeler'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Propagation Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Opportunity Rollup Logic'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Crosslink Resolver Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Crosslink Finder Logic'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Storage And Sanitization Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Save and Clean Up Opportunities'
  },
```

**Step 2: Verify TypeScript compiles**

```bash
cd "F:/Repos/Aralia" && npx tsc --noEmit --project devtools/roadmap/tsconfig.json 2>&1 | grep "generate.ts" | head -5
```

**Step 3: Commit**

```bash
cd "F:/Repos/Aralia" && git add devtools/roadmap/scripts/roadmap-engine/generate.ts && git commit -m "refactor(roadmap): rename opportunity mapping children to plain English"
```

---

### Task 8: Rename Spell branches + Node Media Previews children

**Files:**
- Modify: `devtools/roadmap/scripts/roadmap-engine/generate.ts`

**Step 1: Add these entries**

```ts
  // ── Layman renames: Spell Branch Navigator children ───────────────────────
  {
    from: 'Roadmap Tool > Spell Branch Navigator > Axis Engine',
    to: 'Roadmap Tool > Spell Branch Navigator > Spell Filter Logic'
  },
  {
    from: 'Roadmap Tool > Spell Branch Navigator > VSM Drill-Down Navigator',
    to: 'Roadmap Tool > Spell Branch Navigator > Step-by-Step Spell Filter'
  },
  {
    from: 'Roadmap Tool > Spell Branch Navigator > Requirements Component Mapping',
    to: 'Roadmap Tool > Spell Branch Navigator > V/S/M Component Labels'
  },
  // ── Layman renames: Spell Graph Navigation children ───────────────────────
  {
    from: 'Roadmap Tool > Spell Graph Navigation > Live Axis Filtering Engine',
    to: 'Roadmap Tool > Spell Graph Navigation > Spell Filter Overlay on Canvas'
  },
  {
    from: 'Roadmap Tool > Spell Graph Navigation > Canvas-Coordinated Node Layout',
    to: 'Roadmap Tool > Spell Graph Navigation > Spell Nodes Positioned on the Graph'
  },
  // ── Layman renames: Node Media Previews children ──────────────────────────
  {
    from: 'Roadmap Tool > Node Media Previews > Convention-Based Media Scanner',
    to: 'Roadmap Tool > Node Media Previews > Find Captures by File Name'
  },
  {
    from: 'Roadmap Tool > Node Media Previews > Media File Endpoint',
    to: 'Roadmap Tool > Node Media Previews > Serve Capture Files'
  },
```

**Step 2: Verify TypeScript compiles**

```bash
cd "F:/Repos/Aralia" && npx tsc --noEmit --project devtools/roadmap/tsconfig.json 2>&1 | grep "generate.ts" | head -5
```

**Step 3: Commit**

```bash
cd "F:/Repos/Aralia" && git add devtools/roadmap/scripts/roadmap-engine/generate.ts && git commit -m "refactor(roadmap): rename spell and media preview children to plain English"
```

---

### Task 9: Rename Race Portrait Image Generation branches

**Files:**
- Modify: `devtools/roadmap/scripts/roadmap-engine/generate.ts`

**Step 1: Add these entries**

```ts
  // ── Layman renames: Race Portrait Image Generation ────────────────────────
  {
    from: 'Race Portrait Image Generation > Gemini Session Control',
    to: 'Race Portrait Image Generation > AI Session Manager'
  },
  {
    from: 'Race Portrait Image Generation > Gemini Session Control > CDP Endpoint Health Check',
    to: 'Race Portrait Image Generation > AI Session Manager > Check AI Connection Is Alive'
  },
  {
    from: 'Race Portrait Image Generation > Gemini Session Control > Gemini Tab Targeting',
    to: 'Race Portrait Image Generation > AI Session Manager > Find the Right AI Browser Tab'
  },
  {
    from: 'Race Portrait Image Generation > Gemini Session Control > Consent Interstitial Handling',
    to: 'Race Portrait Image Generation > AI Session Manager > Dismiss AI Consent Popups'
  },
  {
    from: 'Race Portrait Image Generation > Gemini Session Control > Per Generation Chat Reset',
    to: 'Race Portrait Image Generation > AI Session Manager > Start Fresh Chat Per Image'
  },
  {
    from: 'Race Portrait Image Generation > Gemini Session Control > New Chat Confirmation Check',
    to: 'Race Portrait Image Generation > AI Session Manager > Confirm New Chat Started'
  },
  {
    from: 'Race Portrait Image Generation > Gemini Session Control > Single Active Run Lock',
    to: 'Race Portrait Image Generation > AI Session Manager > Prevent Two Runs at Once'
  },
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine',
    to: 'Race Portrait Image Generation > Image Prompt Builder'
  },
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine > Base Prompt Template Management',
    to: 'Race Portrait Image Generation > Image Prompt Builder > Base Prompt Templates'
  },
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine > Race Override Registry',
    to: 'Race Portrait Image Generation > Image Prompt Builder > Per-Race Prompt Overrides'
  },
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine > Gender Variant Prompting',
    to: 'Race Portrait Image Generation > Image Prompt Builder > Gender-Specific Prompts'
  },
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine > Positive Constraint Rules',
    to: 'Race Portrait Image Generation > Image Prompt Builder > What to Include in Prompts'
  },
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine > Slice of Life Activity Allocator',
    to: 'Race Portrait Image Generation > Image Prompt Builder > Assign Activities to Characters'
  },
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine > Activity Uniqueness Normalization',
    to: 'Race Portrait Image Generation > Image Prompt Builder > Prevent Duplicate Activities'
  },
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine > Prompt Hash Tracking',
    to: 'Race Portrait Image Generation > Image Prompt Builder > Track Which Prompts Were Used'
  },
  {
    from: 'Race Portrait Image Generation > Execution Reliability > Single Session Concurrency Guard',
    to: 'Race Portrait Image Generation > Execution Reliability > One Run at a Time'
  },
  {
    from: 'Race Portrait Image Generation > Execution Reliability > Download Fallback Pipeline',
    to: 'Race Portrait Image Generation > Execution Reliability > Retry Download on Failure'
  },
  {
    from: 'Race Portrait Image Generation > Execution Reliability > Retryable Failure Classification',
    to: 'Race Portrait Image Generation > Execution Reliability > Know When to Retry'
  },
  {
    from: 'Race Portrait Image Generation > Execution Reliability > Timeout and Cooldown Policy',
    to: 'Race Portrait Image Generation > Execution Reliability > Wait Times Between Attempts'
  },
  {
    from: 'Race Portrait Image Generation > Execution Reliability > Bad Request Recovery Path',
    to: 'Race Portrait Image Generation > Execution Reliability > Handle Bad Requests Gracefully'
  },
  {
    from: 'Race Portrait Image Generation > Execution Reliability > Download Artifact Recovery',
    to: 'Race Portrait Image Generation > Execution Reliability > Recover Failed Downloads'
  },
  {
    from: 'Race Portrait Image Generation > Quality Gates > Square Output Enforcement',
    to: 'Race Portrait Image Generation > Quality Gates > Require Square Images'
  },
  {
    from: 'Race Portrait Image Generation > Quality Gates > Blank Margin Rejection',
    to: 'Race Portrait Image Generation > Quality Gates > Reject Images With Blank Borders'
  },
  {
    from: 'Race Portrait Image Generation > Quality Gates > Image Decode Validation',
    to: 'Race Portrait Image Generation > Quality Gates > Verify Image Is Readable'
  },
  {
    from: 'Race Portrait Image Generation > Quality Gates > Full Body Framing Check',
    to: 'Race Portrait Image Generation > Quality Gates > Require Full Body in Frame'
  },
  {
    from: 'Race Portrait Image Generation > Quality Gates > Duplicate Byte Hash Rejection',
    to: 'Race Portrait Image Generation > Quality Gates > Reject Duplicate Images'
  },
  {
    from: 'Race Portrait Image Generation > Quality Gates > Arrow Artifact Rejection',
    to: 'Race Portrait Image Generation > Quality Gates > Reject Images With UI Arrows'
  },
  {
    from: 'Race Portrait Image Generation > Quality Gates > Borderless Full Bleed Validation',
    to: 'Race Portrait Image Generation > Quality Gates > Require Edge-to-Edge Image'
  },
  {
    from: 'Race Portrait Image Generation > Post Generation Verification > Slice of Life Ledger Tracking',
    to: 'Race Portrait Image Generation > Post Generation Verification > Track Activities Per Character'
  },
  {
    from: 'Race Portrait Image Generation > Post Generation Verification > In App Race Image Sync Validation',
    to: 'Race Portrait Image Generation > Post Generation Verification > Verify Images Match In-Game Data'
  },
  {
    from: 'Race Portrait Image Generation > Post Generation Verification > CC Glossary Path Parity Audit',
    to: 'Race Portrait Image Generation > Post Generation Verification > Check Glossary Image Paths Match'
  },
  {
    from: 'Race Portrait Image Generation > Post Generation Verification > Slice of Life Completeness Audit',
    to: 'Race Portrait Image Generation > Post Generation Verification > Check All Activities Are Covered'
  },
  {
    from: 'Race Portrait Image Generation > Post Generation Verification > Duplicate Activity Keeper Decisioning',
    to: 'Race Portrait Image Generation > Post Generation Verification > Decide Which Duplicate to Keep'
  },
  {
    from: 'Race Portrait Image Generation > Post Generation Verification > Verification Evidence Logging',
    to: 'Race Portrait Image Generation > Post Generation Verification > Log Verification Results'
  },
  {
    from: 'Race Portrait Image Generation > Backlog Regeneration Orchestration',
    to: 'Race Portrait Image Generation > Backlog Regeneration Runner'
  },
  {
    from: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Category Agnostic Backlog Processing',
    to: 'Race Portrait Image Generation > Backlog Regeneration Runner > Process Any Backlog Category'
  },
  {
    from: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Backlog Parsing and Filtering',
    to: 'Race Portrait Image Generation > Backlog Regeneration Runner > Backlog Parsing and Filtering'
  },
  {
    from: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Targeted Race Gender Runs',
    to: 'Race Portrait Image Generation > Backlog Regeneration Runner > Run Specific Race and Gender Combos'
  },
  {
    from: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Status Append Per Generation',
    to: 'Race Portrait Image Generation > Backlog Regeneration Runner > Record Status After Each Image'
  },
  {
    from: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Runbook Auto Update Hooks',
    to: 'Race Portrait Image Generation > Backlog Regeneration Runner > Auto-Update the Run Guide'
  },
  {
    from: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Post Run Audit Pipeline',
    to: 'Race Portrait Image Generation > Backlog Regeneration Runner > Audit After Each Run'
  },
  {
    from: 'Race Portrait Image Generation > Future Capability Expansion > Fail Fast Branch Test Orchestration',
    to: 'Race Portrait Image Generation > Future Capability Expansion > Quick-Fail Branch Test Runner'
  },
  {
    from: 'Race Portrait Image Generation > Future Capability Expansion > Node Test Definition Registry',
    to: 'Race Portrait Image Generation > Future Capability Expansion > Where Node Tests Are Defined'
  },
  {
    from: 'Race Portrait Image Generation > Future Capability Expansion > Fail Fast Branch Test Executor',
    to: 'Race Portrait Image Generation > Future Capability Expansion > Quick-Fail Test Executor'
  },
  {
    from: 'Race Portrait Image Generation > Future Capability Expansion > Test Log Retention Policy',
    to: 'Race Portrait Image Generation > Future Capability Expansion > How Long Test Logs Are Kept'
  },
  {
    from: 'Race Portrait Image Generation > Future Capability Expansion > Roadmap Node Test Badges',
    to: 'Race Portrait Image Generation > Future Capability Expansion > Test Status Badges on Nodes'
  },
```

**Step 2: Verify TypeScript compiles**

```bash
cd "F:/Repos/Aralia" && npx tsc --noEmit --project devtools/roadmap/tsconfig.json 2>&1 | grep "generate.ts" | head -5
```

**Step 3: Commit**

```bash
cd "F:/Repos/Aralia" && git add devtools/roadmap/scripts/roadmap-engine/generate.ts && git commit -m "refactor(roadmap): rename race portrait image generation branches to plain English"
```

---

### Task 10: Rename miscellaneous nodes

**Files:**
- Modify: `devtools/roadmap/scripts/roadmap-engine/generate.ts`

**Step 1: Add these entries**

```ts
  // ── Layman renames: miscellaneous ─────────────────────────────────────────
  {
    from: 'Merchant Pricing And Economy Integration > Merchant Modal Price Wiring',
    to: 'Merchant Pricing And Economy Integration > Wire Merchant Screen to Economy'
  },
  {
    from: 'URL And History State Synchronization > Initial Mount Guard',
    to: 'URL And History State Synchronization > Prevent Bad History Write on First Load'
  },
```

**Step 2: Verify TypeScript compiles**

```bash
cd "F:/Repos/Aralia" && npx tsc --noEmit --project devtools/roadmap/tsconfig.json 2>&1 | grep "generate.ts" | head -5
```

**Step 3: Commit**

```bash
cd "F:/Repos/Aralia" && git add devtools/roadmap/scripts/roadmap-engine/generate.ts && git commit -m "refactor(roadmap): rename miscellaneous nodes to plain English"
```

---

### Task 11: Verify all renames in browser

**Step 1: Hard refresh the roadmap page**

The Vite dev server on port 3010 must be running. Navigate to `http://localhost:3010/Aralia/devtools/roadmap/roadmap.html` and do Ctrl+Shift+R.

**Step 2: Spot-check each renamed branch**

Expand Dev Tools → Roadmap Tool in the canvas. Verify these names appear correctly:

- `Graph Display Stability` (was: Visualization Stability)
- `Run Tests From the Roadmap` (was: Node Test Execution Capability)
- `Node Quality Warnings` (was: Node Health Signals)
- `Which Nodes Have Tests` (was: Node Test Presence)
- `Roadmap Server Endpoints` (was: Roadmap API Surface Capability)
- `Doc Processing Pipeline` (was: Documentation Intelligence)

Expand each and verify children also show new names. Example: expand `Run Tests From the Roadmap` and confirm it shows `Run This Node and Its Children's Tests`, `Run Only Child Tests`, etc.

**Step 3: Check Strategic Opportunity Mapping**

Expand `Strategic Opportunity Mapping`. Confirm `How the Opportunity System Is Built` appears (was: Opportunity Module Architecture) and its 8 children show plain-English names.

**Step 4: Check Race Portrait Image Generation**

Expand `Race Portrait Image Generation`. Confirm `AI Session Manager` (was: Gemini Session Control), `Image Prompt Builder` (was: Prompt Construction Engine), `Backlog Regeneration Runner` (was: Backlog Regeneration Orchestration).

**Step 5: Check Spell branches**

Expand `Spell Branch Navigator`. Confirm `Spell Filter Logic`, `Step-by-Step Spell Filter`, `V/S/M Component Labels`.
Expand `Spell Graph Navigation`. Confirm `Spell Filter Overlay on Canvas`, `Spell Nodes Positioned on the Graph`.

**Step 6: If any name is wrong**, check whether the `from` in the rename rule matches the exact `name:` string in the milestones array (case-sensitive match lowercased). The most common mistake is using an intermediate renamed name instead of the original source name.
