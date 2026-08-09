---
name: aralia-roadmap-node-authoring
description: Use when adding, updating, or auditing Aralia roadmap branches and nodes after a coding session — covers the full capability-doc → manifest → generator → UI pipeline and its common silent failure modes.
---

# Aralia Roadmap Node Authoring

## Overview

Roadmap nodes are **not edited directly** in the roadmap tool UI or its data files.
They are derived from capability docs via a generator pipeline with multiple gates.
Skipping any gate causes nodes to silently disappear or land in the wrong place.

## The Four-Gate Pipeline

```
docs/tasks/...              ← 1. Capability doc (source of truth)
    ↓
processing_manifest.json    ← 2. Registration (tells the loader what to ingest)
    ↓
generate.ts allowlists      ← 3. Generator gate (labels must be explicitly allowed)
    ↓
text.ts normalization       ← 4. Name normalization (rewrites labels before ID generation)
    ↓
/api/roadmap/data           ← verify here, not the browser
    ↓
Browser UI                  ← verify last, stale server causes false negatives
```

## Gate 1 — Capability Doc

- Lives under `docs/tasks/...` (any subdirectory is fine)
- Describes **what the feature does**, not implementation steps
- Only game/app systems belong here — roadmap-tool work goes under `docs/tasks/roadmap/`
- If a doc already exists for this system, extend it instead of creating a new one

## Gate 2 — Processing Manifest

File: `.agent/roadmap-local/processing_manifest.json`

Each entry needs:
```json
{
  "sourcePath": "docs/tasks/your-feature/your-doc.md",
  "featureGroup": "kebab-case-group-name",
  "feature": "Display Name Of Feature",
  "subFeatures": [
    { "name": "Sub Feature Label", "state": "active" }
  ]
}
```

- `sourcePath` **must** be under `docs/tasks/` — the loader ignores other paths
- `featureGroup` is used by `inferPillarForFeature()` to assign the node to a roadmap pillar
- `subFeatures[].name` must **exactly match** what you register in Gate 3

Also mirror into:
- `.agent/roadmap-local/doc_library.json` (add a doc entry)
- `.agent/roadmap-local/path_provenance.json` (add a path entry)

## Gate 3 — Generator Allowlist

File: `devtools/roadmap/scripts/roadmap-engine/generate.ts`

Three allowlist objects control what the generator emits:

| Object | Purpose |
|--------|---------|
| `CURATED_SUBFEATURES` | keyed by `feature.toLowerCase()` → Set of allowed subfeature label strings |
| `CURATED_SUBFEATURE_DETAILS` | keyed by subfeature label → `{ layman, canonicalDocs }` |
| `CURATED_REQUIRED_SUBFEATURES` | keyed by `feature.toLowerCase()` → array of always-shown labels |

**If your subfeature label is not in `CURATED_SUBFEATURES[featureKey]`, the node is silently dropped.**

To add a new subfeature:
1. Add the label string to `CURATED_SUBFEATURES['your feature name']`
2. Add a `CURATED_SUBFEATURE_DETAILS` entry with a `layman` description
3. Optionally add to `CURATED_REQUIRED_SUBFEATURES` if it should always appear

## Gate 4 — Name Normalization

File: `devtools/roadmap/scripts/roadmap-engine/text.ts`

The generator rewrites labels through `toFeatureDrivenSubfeatureName()` before generating node IDs.
If normalization turns two different labels into the same string → **duplicate ID crash**.

Common traps:
- Acronyms (`URL`, `NPC`, `AI`, `UI`, `API`) may be title-cased away unless explicitly preserved
- Minor label variants (`Spell Graph` vs `Spell-Graph`) can collide after normalization
- Verify by calling `toFeatureDrivenSubfeatureName(yourLabel)` directly if uncertain

## Label Naming Rules

Labels you write in `subFeatures[].name` (Gate 2) and `CURATED_SUBFEATURES` (Gate 3) pass
through `text.ts` before becoming node IDs. Write labels that survive normalization cleanly.

### What `text.ts` actually does to your label

| Transform | Rule |
|-----------|------|
| `toTitleCase` | Capitalises each word; **preserves these acronyms as-is**: `UI`, `UX`, `API`, `URL`, `AI`, `NPC`, `VS`, `TS`, `TSX`, `JSON`, `PHB`, `D&D`, `3D`, `2D`, `RPG`. All other all-caps words get title-cased. |
| `sanitizeSubfeatureName` | Strips markdown (links `[text](url)`, bold `**`, inline code `` ` ``), list prefixes (`- `, `1. `), trailing punctuation (`.,:;`). |
| `isGenericSubfeature` | Rejects section-header words like *Overview, Summary, Status, Notes, Dependencies, Verification, Requirements, Goals, Objectives, Architecture, Core Components* — these become a `"… Scope"` suffix or are dropped entirely. |
| `isWeakSubfeatureLabel` | Flags labels with **≤ 2 tokens**, labels ending in *"scope"*, labels starting with *"Phase N"*, labels starting with a bare number. Weak labels are still included but risk collision and ambiguity. |
| Feature-name stripping | If your label starts with the feature name (e.g. `"Roadmap Tool > …"`), that prefix is stripped. Don't include it. |
| `slug` truncation | Node IDs are slugged to max **120 characters**. |

### Rules for writing good labels

1. **Use at least 3 words.** Two-word labels are "weak" and often ambiguous.
   - ✅ `"Spell Graph Navigation"`
   - ❌ `"Spell Graph"` (2 tokens — weak)

2. **Name the capability, not the task.** Describe what the feature *does*, not what you *did*.
   - ✅ `"Server-Side Roadmap Endpoints"`
   - ❌ `"Implement Server Endpoints"` (`implement` is a task verb, not a capability)

3. **Don't use generic section words** — they are stripped or mangled.
   - ❌ `"Overview"`, `"Summary"`, `"Status"`, `"Notes"`, `"Verification"`, `"Architecture"`

4. **Don't start with phase numbers or bare numbers.**
   - ❌ `"Phase 1 Data Pipeline"` → flagged as weak
   - ❌ `"1 Step Execution"` → flagged as weak

5. **Use `>` to express hierarchy** within a single label. The pipeline treats `>` as a depth separator.
   - ✅ `"Spell Graph Navigation > Axis Filter Engine"`

6. **Acronyms outside the preserved list will be title-cased.** If your label contains an acronym not in the list (`UI`, `UX`, `API`, `URL`, `AI`, `NPC`, `VS`, `TS`, `TSX`, `JSON`, `PHB`, `D&D`, `3D`, `2D`, `RPG`), expect it to be title-cased. Either add it to `text.ts` or don't rely on all-caps.

7. **Keep labels distinct before and after normalization.** `"Spell-Graph Navigation"` and `"Spell Graph Navigation"` collide after sanitization (hyphen stripped) → duplicate ID crash. Make labels distinguishable by meaning, not punctuation.

8. **Don't prefix with the feature name.** `toFeatureDrivenSubfeatureName` strips the leading feature name automatically.
   - ❌ `"Roadmap Tool > Graph Display Stability"` → becomes just `"Graph Display Stability"` anyway

## Verification Sequence

Run in this order — earlier gates explain later failures:

```bash
# 1. Check manifest was parsed correctly
curl http://127.0.0.1:3010/api/roadmap/data | grep "Your Label"

# 2. Run the full audit
npm run roadmap:audit-all
# Reports: both | programOnly | docsOnly | neither | moduleLeavesMissingTestDefinitions

# 3. Confirm node is under the right pillar
curl http://127.0.0.1:3010/api/roadmap/data | jq '.nodes[] | select(.label == "Your Label") | .pillar'

# 4. Restart the roadmap dev server before trusting the browser
# (stale server serves pre-patch generator code)
```

Do not mark roadmap work complete until all five conditions are true:
- [ ] Capability doc exists in `docs/tasks/`
- [ ] Manifest entry present with correct `sourcePath`
- [ ] Generator emits label in `/api/roadmap/data`
- [ ] Node is under the intended pillar
- [ ] Live UI can navigate to the branch

## Common Silent Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| Node never appears | Manifest exists but label missing from `CURATED_SUBFEATURES` | Add to allowlist in `generate.ts` |
| Gameplay node under "Roadmap Tool" | `featureGroup` too weak for pillar inference | Strengthen `featureGroup` signal in manifest |
| Duplicate node-id crash | Normalization rewrote two labels to the same string | Check `text.ts`; rename one label |
| API correct, browser shows nothing | Stale roadmap dev server | Restart `dev:roadmap` server |
| Node appears but in wrong pillar | `featureGroup` maps to wrong pillar | Adjust `featureGroup` and check `inferPillarForFeature()` |

## Atomization & Test Linkage (required in tidy-up)

For each touched implementation file, classify as:
- `atomized` — single concern/component
- `acceptable-orchestrator` — intentionally coordinates multiple modules
- `needs-split` — multiple unrelated concerns (add follow-up node)

For every module leaf without a test definition route, mark as a defect and add a follow-up.
