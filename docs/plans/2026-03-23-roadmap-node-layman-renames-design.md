# Roadmap Node Layman Renames — Design

**Date:** 2026-03-23
**Status:** Approved

## Problem

Roadmap node names across all branches use coding and roadmapping jargon that is opaque to anyone without technical background. Terms like "pipeline", "endpoint", "schema", "facade", "concurrency guard", "debounce", "artifact", and "CDP" are meaningless to a layman reading the roadmap.

## Goal

Every node name should be readable and understood by someone with no coding or roadmapping knowledge, reading it cold with no context.

## Approach

Use `ROADMAP_CAPABILITY_RENAME_RULES` in `generate.ts` — the existing rename table that maps old display names to new ones while keeping underlying node IDs stable (no layout breakage, no test history loss).

The rename rule format is:
```ts
{ from: 'Full > Path > Node Name', to: 'Full > Path > New Name' }
```

## Rename Table

All renames listed as `from → to`. Unmarked entries are kept as-is.

### Roadmap Tool — Sub-branch Parents

| From | To |
|------|-----|
| Roadmap Tool > Visualization Stability | Roadmap Tool > Graph Display Stability |
| Roadmap Tool > Node Test Execution Capability | Roadmap Tool > Run Tests From the Roadmap |
| Roadmap Tool > Node Health Signals | Roadmap Tool > Node Quality Warnings |
| Roadmap Tool > Node Test Presence | Roadmap Tool > Which Nodes Have Tests |
| Roadmap Tool > Roadmap API Surface Capability | Roadmap Tool > Roadmap Server Endpoints |
| Roadmap Tool > Documentation Intelligence | Roadmap Tool > Doc Processing Pipeline |

### Visualization Stability Children

| From | To |
|------|-----|
| Roadmap Tool > Visualization Stability > Connector Rendering Reliability | Roadmap Tool > Graph Display Stability > Connector Rendering Reliability |

*(name kept; path updated to match parent rename)*

### Layout Persistence Children

| From | To |
|------|-----|
| Roadmap Tool > Layout Persistence > Auto-save Debounce Cycle | Roadmap Tool > Layout Persistence > Delayed Auto-Save |

### Node Test Execution Capability Children

| From | To |
|------|-----|
| Roadmap Tool > Node Test Execution Capability > Run Node Test (Self Plus Descendants) | Roadmap Tool > Run Tests From the Roadmap > Run This Node and Its Children's Tests |
| Roadmap Tool > Node Test Execution Capability > Run Child Node Tests (Descendants Only) | Roadmap Tool > Run Tests From the Roadmap > Run Only Child Tests |
| Roadmap Tool > Node Test Execution Capability > Node Test Result Status Feedback | Roadmap Tool > Run Tests From the Roadmap > Show Test Pass/Fail Results |
| Roadmap Tool > Node Test Execution Capability > Node Test Status Persistence | Roadmap Tool > Run Tests From the Roadmap > Remember Test Results Between Sessions |
| Roadmap Tool > Node Test Execution Capability > Node Test Data Refresh After Run | Roadmap Tool > Run Tests From the Roadmap > Refresh Results After Running |

### Node Health Signals Children

| From | To |
|------|-----|
| Roadmap Tool > Node Health Signals > Health Signal Computation | Roadmap Tool > Node Quality Warnings > How Warnings Are Calculated |
| Roadmap Tool > Node Health Signals > Health Badge Component | Roadmap Tool > Node Quality Warnings > Warning Badge Display |
| Roadmap Tool > Node Health Signals > Visualizer Integration | Roadmap Tool > Node Quality Warnings > Warnings Shown On Canvas |
| Roadmap Tool > Node Health Signals > Density Warning Detection | Roadmap Tool > Node Quality Warnings > Too Many Children Warning |

### Node Test Presence Children

| From | To |
|------|-----|
| Roadmap Tool > Node Test Presence > Test File Declaration Schema | Roadmap Tool > Which Nodes Have Tests > How Tests Are Declared |
| Roadmap Tool > Node Test Presence > Disk Presence Checker | Roadmap Tool > Which Nodes Have Tests > Verify Test Files Exist |
| Roadmap Tool > Node Test Presence > Test Metadata Annotation | Roadmap Tool > Which Nodes Have Tests > Stamp Nodes With Test Info |

### Roadmap API Surface Capability Children

| From | To |
|------|-----|
| Roadmap Tool > Roadmap API Surface Capability > Roadmap Data Endpoint | Roadmap Tool > Roadmap Server Endpoints > Serve Roadmap Data |
| Roadmap Tool > Roadmap API Surface Capability > Layout Endpoint (Read Write) | Roadmap Tool > Roadmap Server Endpoints > Save and Load Layout |
| Roadmap Tool > Roadmap API Surface Capability > Node Test Run Endpoint | Roadmap Tool > Roadmap Server Endpoints > Run Tests From Browser |
| Roadmap Tool > Roadmap API Surface Capability > Opportunities Latest Endpoint | Roadmap Tool > Roadmap Server Endpoints > Fetch Current Opportunities |
| Roadmap Tool > Roadmap API Surface Capability > Opportunities Scan Endpoint | Roadmap Tool > Roadmap Server Endpoints > Trigger an Opportunity Scan |
| Roadmap Tool > Roadmap API Surface Capability > Opportunities Settings Endpoint | Roadmap Tool > Roadmap Server Endpoints > Opportunity Scan Settings |
| Roadmap Tool > Roadmap API Surface Capability > VS Code Open Endpoint | Roadmap Tool > Roadmap Server Endpoints > Open File in VS Code |

### Documentation Intelligence Children

| From | To |
|------|-----|
| Roadmap Tool > Documentation Intelligence > Single-document Processing Capability | Roadmap Tool > Doc Processing Pipeline > Process One Doc at a Time |
| Roadmap Tool > Documentation Intelligence > Single-document Processing Capability > Worker Packet Schema Validation | Roadmap Tool > Doc Processing Pipeline > Process One Doc at a Time > Validate Doc Before Processing |
| Roadmap Tool > Documentation Intelligence > Single-document Processing Capability > Feature Naming Validation | Roadmap Tool > Doc Processing Pipeline > Process One Doc at a Time > Enforce Capability-First Names |
| Roadmap Tool > Documentation Intelligence > Feature Taxonomy Integrity | Roadmap Tool > Doc Processing Pipeline > Node Names Follow Naming Rules |

### Strategic Opportunity Mapping Children

| From | To |
|------|-----|
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Collection | Roadmap Tool > Strategic Opportunity Mapping > Gather Improvement Opportunities |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Scan Orchestration | Roadmap Tool > Strategic Opportunity Mapping > Run the Opportunity Scan |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Flag Classification | Roadmap Tool > Strategic Opportunity Mapping > Label Each Opportunity Type |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Propagation and Rollup | Roadmap Tool > Strategic Opportunity Mapping > Roll Opportunities Up to Parent Nodes |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Snapshot Persistence | Roadmap Tool > Strategic Opportunity Mapping > Save Opportunity Results to Disk |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Scan Trigger | Roadmap Tool > Strategic Opportunity Mapping > Button to Start a Scan |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Triage Panel | Roadmap Tool > Strategic Opportunity Mapping > Review and Dismiss Opportunities |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity-to-Node Navigation | Roadmap Tool > Strategic Opportunity Mapping > Jump to Node From Opportunity |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Crosslink Detection | Roadmap Tool > Strategic Opportunity Mapping > Find Shared Opportunities Across Branches |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture | Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Public Facade Module | Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Opportunity System Entry Point |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Type Contracts Module | Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Opportunity Data Shapes |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Graph Context Module | Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Graph Data for Opportunity Scanning |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Scanner Module | Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > The Opportunity Scanner |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Flag Classifier Module | Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Opportunity Type Labeler |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Propagation Module | Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Opportunity Rollup Logic |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Crosslink Resolver Module | Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Crosslink Finder Logic |
| Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Storage And Sanitization Module | Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Save and Clean Up Opportunities |

### Spell Branch Navigator Children

| From | To |
|------|-----|
| Roadmap Tool > Spell Branch Navigator > Axis Engine | Roadmap Tool > Spell Branch Navigator > Spell Filter Logic |
| Roadmap Tool > Spell Branch Navigator > VSM Drill-Down Navigator | Roadmap Tool > Spell Branch Navigator > Step-by-Step Spell Filter |
| Roadmap Tool > Spell Branch Navigator > Requirements Component Mapping | Roadmap Tool > Spell Branch Navigator > V/S/M Component Labels |

### Spell Graph Navigation Children

| From | To |
|------|-----|
| Roadmap Tool > Spell Graph Navigation > Live Axis Filtering Engine | Roadmap Tool > Spell Graph Navigation > Spell Filter Overlay on Canvas |
| Roadmap Tool > Spell Graph Navigation > Canvas-Coordinated Node Layout | Roadmap Tool > Spell Graph Navigation > Spell Nodes Positioned on the Graph |

### Node Media Previews Children

| From | To |
|------|-----|
| Roadmap Tool > Node Media Previews > Convention-Based Media Scanner | Roadmap Tool > Node Media Previews > Find Captures by File Name |
| Roadmap Tool > Node Media Previews > Media File Endpoint | Roadmap Tool > Node Media Previews > Serve Capture Files |

---

### Race Portrait Image Generation

| From | To |
|------|-----|
| Race Portrait Image Generation > Gemini Session Control | Race Portrait Image Generation > AI Session Manager |
| Race Portrait Image Generation > Gemini Session Control > CDP Endpoint Health Check | Race Portrait Image Generation > AI Session Manager > Check AI Connection Is Alive |
| Race Portrait Image Generation > Gemini Session Control > Gemini Tab Targeting | Race Portrait Image Generation > AI Session Manager > Find the Right AI Browser Tab |
| Race Portrait Image Generation > Gemini Session Control > Consent Interstitial Handling | Race Portrait Image Generation > AI Session Manager > Dismiss AI Consent Popups |
| Race Portrait Image Generation > Gemini Session Control > Per Generation Chat Reset | Race Portrait Image Generation > AI Session Manager > Start Fresh Chat Per Image |
| Race Portrait Image Generation > Gemini Session Control > New Chat Confirmation Check | Race Portrait Image Generation > AI Session Manager > Confirm New Chat Started |
| Race Portrait Image Generation > Gemini Session Control > Single Active Run Lock | Race Portrait Image Generation > AI Session Manager > Prevent Two Runs at Once |
| Race Portrait Image Generation > Prompt Construction Engine | Race Portrait Image Generation > Image Prompt Builder |
| Race Portrait Image Generation > Prompt Construction Engine > Base Prompt Template Management | Race Portrait Image Generation > Image Prompt Builder > Base Prompt Templates |
| Race Portrait Image Generation > Prompt Construction Engine > Race Override Registry | Race Portrait Image Generation > Image Prompt Builder > Per-Race Prompt Overrides |
| Race Portrait Image Generation > Prompt Construction Engine > Gender Variant Prompting | Race Portrait Image Generation > Image Prompt Builder > Gender-Specific Prompts |
| Race Portrait Image Generation > Prompt Construction Engine > Positive Constraint Rules | Race Portrait Image Generation > Image Prompt Builder > What to Include in Prompts |
| Race Portrait Image Generation > Prompt Construction Engine > Slice of Life Activity Allocator | Race Portrait Image Generation > Image Prompt Builder > Assign Activities to Characters |
| Race Portrait Image Generation > Prompt Construction Engine > Activity Uniqueness Normalization | Race Portrait Image Generation > Image Prompt Builder > Prevent Duplicate Activities |
| Race Portrait Image Generation > Prompt Construction Engine > Prompt Hash Tracking | Race Portrait Image Generation > Image Prompt Builder > Track Which Prompts Were Used |
| Race Portrait Image Generation > Execution Reliability > Single Session Concurrency Guard | Race Portrait Image Generation > Execution Reliability > One Run at a Time |
| Race Portrait Image Generation > Execution Reliability > Download Fallback Pipeline | Race Portrait Image Generation > Execution Reliability > Retry Download on Failure |
| Race Portrait Image Generation > Execution Reliability > Retryable Failure Classification | Race Portrait Image Generation > Execution Reliability > Know When to Retry |
| Race Portrait Image Generation > Execution Reliability > Timeout and Cooldown Policy | Race Portrait Image Generation > Execution Reliability > Wait Times Between Attempts |
| Race Portrait Image Generation > Execution Reliability > Bad Request Recovery Path | Race Portrait Image Generation > Execution Reliability > Handle Bad Requests Gracefully |
| Race Portrait Image Generation > Execution Reliability > Download Artifact Recovery | Race Portrait Image Generation > Execution Reliability > Recover Failed Downloads |
| Race Portrait Image Generation > Quality Gates > Square Output Enforcement | Race Portrait Image Generation > Quality Gates > Require Square Images |
| Race Portrait Image Generation > Quality Gates > Blank Margin Rejection | Race Portrait Image Generation > Quality Gates > Reject Images With Blank Borders |
| Race Portrait Image Generation > Quality Gates > Image Decode Validation | Race Portrait Image Generation > Quality Gates > Verify Image Is Readable |
| Race Portrait Image Generation > Quality Gates > Full Body Framing Check | Race Portrait Image Generation > Quality Gates > Require Full Body in Frame |
| Race Portrait Image Generation > Quality Gates > Duplicate Byte Hash Rejection | Race Portrait Image Generation > Quality Gates > Reject Duplicate Images |
| Race Portrait Image Generation > Quality Gates > Arrow Artifact Rejection | Race Portrait Image Generation > Quality Gates > Reject Images With UI Arrows |
| Race Portrait Image Generation > Quality Gates > Borderless Full Bleed Validation | Race Portrait Image Generation > Quality Gates > Require Edge-to-Edge Image |
| Race Portrait Image Generation > Post Generation Verification > Slice of Life Ledger Tracking | Race Portrait Image Generation > Post Generation Verification > Track Activities Per Character |
| Race Portrait Image Generation > Post Generation Verification > In App Race Image Sync Validation | Race Portrait Image Generation > Post Generation Verification > Verify Images Match In-Game Data |
| Race Portrait Image Generation > Post Generation Verification > CC Glossary Path Parity Audit | Race Portrait Image Generation > Post Generation Verification > Check Glossary Image Paths Match |
| Race Portrait Image Generation > Post Generation Verification > Slice of Life Completeness Audit | Race Portrait Image Generation > Post Generation Verification > Check All Activities Are Covered |
| Race Portrait Image Generation > Post Generation Verification > Duplicate Activity Keeper Decisioning | Race Portrait Image Generation > Post Generation Verification > Decide Which Duplicate to Keep |
| Race Portrait Image Generation > Post Generation Verification > Verification Evidence Logging | Race Portrait Image Generation > Post Generation Verification > Log Verification Results |
| Race Portrait Image Generation > Backlog Regeneration Orchestration | Race Portrait Image Generation > Backlog Regeneration Runner |
| Race Portrait Image Generation > Backlog Regeneration Orchestration > Category Agnostic Backlog Processing | Race Portrait Image Generation > Backlog Regeneration Runner > Process Any Backlog Category |
| Race Portrait Image Generation > Backlog Regeneration Orchestration > Targeted Race Gender Runs | Race Portrait Image Generation > Backlog Regeneration Runner > Run Specific Race and Gender Combos |
| Race Portrait Image Generation > Backlog Regeneration Orchestration > Status Append Per Generation | Race Portrait Image Generation > Backlog Regeneration Runner > Record Status After Each Image |
| Race Portrait Image Generation > Backlog Regeneration Orchestration > Runbook Auto Update Hooks | Race Portrait Image Generation > Backlog Regeneration Runner > Auto-Update the Run Guide |
| Race Portrait Image Generation > Backlog Regeneration Orchestration > Post Run Audit Pipeline | Race Portrait Image Generation > Backlog Regeneration Runner > Audit After Each Run |
| Race Portrait Image Generation > Future Capability Expansion > Fail Fast Branch Test Orchestration | Race Portrait Image Generation > Future Capability Expansion > Quick-Fail Branch Test Runner |
| Race Portrait Image Generation > Future Capability Expansion > Node Test Definition Registry | Race Portrait Image Generation > Future Capability Expansion > Where Node Tests Are Defined |
| Race Portrait Image Generation > Future Capability Expansion > Fail Fast Branch Test Executor | Race Portrait Image Generation > Future Capability Expansion > Quick-Fail Test Executor |
| Race Portrait Image Generation > Future Capability Expansion > Test Log Retention Policy | Race Portrait Image Generation > Future Capability Expansion > How Long Test Logs Are Kept |
| Race Portrait Image Generation > Future Capability Expansion > Roadmap Node Test Badges | Race Portrait Image Generation > Future Capability Expansion > Test Status Badges on Nodes |

---

### Other Feature Branches (minimal changes needed)

| From | To |
|------|-----|
| Merchant Pricing And Economy Integration > Merchant Modal Price Wiring | Merchant Pricing And Economy Integration > Wire Merchant Screen to Economy |
| URL And History State Synchronization > Initial Mount Guard | URL And History State Synchronization > Prevent Bad History Write on First Load |

## Implementation Notes

- All renames go into `ROADMAP_CAPABILITY_RENAME_RULES` array in `generate.ts`
- Child renames must also update their parent path segment to match the parent's new name
- The rename rules system handles ID stability — no layout positions will break
- After adding rules, verify in browser that nodes show new names and tree structure is intact
- The `CURATED_SUBFEATURES` allowlist and `CURATED_SUBFEATURE_DETAILS` descriptions do NOT need updating — they use the original names as keys and the rename rules apply on top
