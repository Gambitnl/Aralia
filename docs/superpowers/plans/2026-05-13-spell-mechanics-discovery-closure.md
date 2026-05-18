# Spell Mechanics Discovery Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every spell from canonical prose through structured markdown and runtime JSON, discover missed or flattened mechanics, create buckets, and close all actionable buckets through template, data, and validation updates.

**Architecture:** The work extends the existing spell-truth pipeline instead of replacing it. A new discovery ledger reads the same reference markdown and JSON files as the current parity audits, records per-spell mechanical findings, groups them into bucket reports, and then follow-up tasks update templates and data from those reports.

**Tech Stack:** TypeScript audit scripts run with `npx tsx`, JSON spell data under `public/data/spells`, spell reference markdown under `docs/spells/reference`, and Markdown/JSON reports under `docs/tasks/spells` plus `.agent/roadmap-local/spell-validation`.

---

### Task 1: Discovery Ledger Scaffold

**Files:**
- Create: `scripts/auditSpellMechanicsDiscovery.ts`
- Create: `docs/tasks/spells/mechanics-discovery/SPELL_MECHANICS_DISCOVERY_REPORT.md`
- Create: `.agent/roadmap-local/spell-validation/spell-mechanics-discovery.json`

- [ ] **Step 1: Build the read-only corpus loader**

  Add a TypeScript script that walks `docs/spells/reference/level-*/*.md`, pairs each file with `public/data/spells/level-*/*.json`, extracts structured markdown labels, canonical rules prose, canonical higher-level prose, referenced rules, and runtime JSON.

- [ ] **Step 2: Emit one ledger row per spell**

  The machine-readable report must contain exactly one row per spell with `spellId`, `spellName`, `level`, `markdownPath`, `jsonPath`, `canonicalText`, `structuredLabels`, `runtimeSummary`, `findings`, `deferredFlavor`, and `specialQuestions`.

- [ ] **Step 3: Run the scaffold**

  Run: `npx tsx scripts\auditSpellMechanicsDiscovery.ts`

  Expected: the script exits `0`, reports `459` spells scanned, and writes both report files.

### Task 2: Manual Mechanics Taxonomy

**Files:**
- Modify: `scripts/auditSpellMechanicsDiscovery.ts`
- Modify: `docs/tasks/spells/mechanics-discovery/SPELL_MECHANICS_DISCOVERY_REPORT.md`

- [ ] **Step 1: Add bucket taxonomy constants**

  Define explicit bucket ids for obvious mechanics and gray-zone mechanics: `choice_or_mode`, `repeat_save_or_recurring_check`, `sustain_or_recast_action`, `movement_or_repositioning`, `forced_movement`, `terrain_or_surface`, `vision_light_sound`, `illusion_or_disguise`, `sensor_or_remote_perception`, `message_or_communication`, `created_object_or_structure`, `summon_or_controlled_entity`, `ward_alarm_or_trigger`, `travel_or_planar_movement`, `resource_or_consumption`, `social_or_knowledge_effect`, `object_stats_or_damageability`, `environmental_change`, `conditional_ending`, `deferred_descriptive_flavor`, and `special_question`.

- [ ] **Step 2: Add manual review fields**

  Each finding must carry `canonicalEvidence`, `structuredState`, `jsonState`, `issue`, `recommendedTemplateChange`, `recommendedJsonChange`, and `resolutionStatus`.

- [ ] **Step 3: Seed the taxonomy with conservative detector hints**

  Add phrase detectors only to route human review, not to close buckets automatically. Examples: "choose", "repeat the saving throw", "as a Bonus Action", "difficult terrain", "illusion", "sensor", "message", "appears", "object has AC", "until the spell ends", "the spell ends", "teleport", "plane", "food", "water", "alarm", "triggered".

- [ ] **Step 4: Run and inspect the first generated bucket report**

  Run: `npx tsx scripts\auditSpellMechanicsDiscovery.ts`

  Expected: report shows bucket counts and per-spell evidence. It may contain false positives at this stage; every false positive must be either reclassified as `deferred_descriptive_flavor` or removed during the manual pass.

### Task 3: Full Spell-by-Spell Manual Pass

**Files:**
- Modify: `.agent/roadmap-local/spell-validation/spell-mechanics-discovery.json`
- Modify: `docs/tasks/spells/mechanics-discovery/SPELL_MECHANICS_DISCOVERY_REPORT.md`
- Create as needed: `docs/tasks/spells/mechanics-discovery/buckets/*.md`

- [ ] **Step 1: Review spells level by level**

  Read every canonical prose block and compare it to the structured markdown fields and runtime JSON. Do not rely on detector hints as proof. Use the hints only as a checklist so hidden mechanics are less likely to be skipped.

- [ ] **Step 2: Record actionable findings**

  For every missed, flattened, or under-specified mechanic, add a finding with the smallest accurate bucket id and a concrete expected field/value change.

- [ ] **Step 3: Record deferred flavor**

  Put purely descriptive prose into `deferred_descriptive_flavor` with enough evidence to revisit later. These rows are intentionally outside the closure requirement for this goal.

- [ ] **Step 4: Record special questions**

  Put only genuinely ambiguous mechanics into `special_question`. The note must explain what decision is needed and why automatic resolution would risk encoding the wrong game rule.

### Task 4: Template And Schema Updates

**Files:**
- Modify: `docs/tasks/spells/templates/spell-structured-template.json`
- Modify: `docs/tasks/spells/templates/spell-json-template.json`
- Modify as needed: `src/systems/spells/schema/spell.schema.json`
- Modify as needed: `src/types/spells.ts`
- Modify: `scripts/validateSpellTemplateContracts.ts`
- Modify: `scripts/auditSpellRuntimeTemplate.ts`

- [ ] **Step 1: Add fields for each actionable bucket**

  Every new mechanic bucket must have structured markdown fields, mapped runtime JSON fields, accepted values, and an explicit `not_applicable` or bucket-specific non-applicable sentinel value.

- [ ] **Step 2: Preserve old intent while splitting flattened values**

  Existing fields may be renamed, split, or expanded only when the discovery report shows they hide a mechanical distinction. Keep compatibility notes in field logs.

- [ ] **Step 3: Extend validation**

  Update template validation and runtime-template audits so every new field family is checked for presence, accepted values, and structured-to-runtime mapping.

### Task 5: Corpus Propagation

**Files:**
- Modify: `docs/spells/reference/level-*/*.md`
- Modify: `public/data/spells/level-*/*.json`
- Modify as needed: `scripts/update-spell-json-from-references.ts`

- [ ] **Step 1: Apply all actionable bucket fixes**

  For each bucket, update the structured markdown and runtime JSON for every affected spell. Fields that do not apply must still be present with the agreed non-applicable sentinel.

- [ ] **Step 2: Propagate non-applicable values to the whole corpus**

  Ensure every spell carries the complete relevant template surface. Runtime code should be able to ignore sentinel values instead of guessing from missing fields.

- [ ] **Step 3: Keep unresolved rows out of propagation**

  Do not encode `special_question` or `deferred_descriptive_flavor` rows as real mechanics. They remain documented review queues.

### Task 6: Reports And Closure Gates

**Files:**
- Modify: `docs/tasks/spells/mechanics-discovery/SPELL_MECHANICS_DISCOVERY_REPORT.md`
- Modify: `docs/tasks/spells/mechanics-discovery/buckets/*.md`
- Modify generated reports under `docs/tasks/spells`
- Modify generated JSON reports under `.agent/roadmap-local/spell-validation`

- [ ] **Step 1: Rerun discovery**

  Run: `npx tsx scripts\auditSpellMechanicsDiscovery.ts`

  Expected: all actionable findings have `resolutionStatus: "closed"`, while deferred flavor and special questions are explicitly listed as non-blocking queues.

- [ ] **Step 2: Rerun spell gates**

  Run:
  - `npx tsx scripts\validateSpellTemplateContracts.ts`
  - `npx tsx scripts\auditSpellStructuredAgainstCanonical.ts`
  - `npx tsx scripts\auditSpellStructuredAgainstJson.ts`
  - `npx tsx scripts\auditSpellRuntimeTemplate.ts`
  - `npx tsx scripts\validateSpellJsons.ts`
  - `npx tsx scripts\auditSpellMechanicsContract.ts`

  Expected: no parity, template, runtime, JSON validation, or type-gap failures remain for actionable mechanics.

- [ ] **Step 3: Completion audit**

  Restate the goal as deliverables, map each requirement to the report or command that proves it, inspect the evidence, and mark the active goal complete only if all actionable discovery buckets are closed or intentionally deferred.
