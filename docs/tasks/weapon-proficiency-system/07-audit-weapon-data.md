# Task 07: Audit Weapon Data for Proficiency Consistency

**Status**: 🔴 Not Started
**Phase**: 3 (Data Consistency Audit)
**Estimated Effort**: 1-2 hours
**Priority**: Medium
**Assigned To**: Unassigned
**Completed**: Not completed

---

## Objective

Create a comprehensive audit of all weapon definitions in the codebase, identifying inconsistencies in proficiency data (`isMartial`, `category`), and producing a report to guide Task 08 standardization.

---

## Context

### Why This Task Exists
During Phase 1 implementation, we discovered that weapon proficiency data is inconsistent:
- Some weapons have only `isMartial: true/false`
- Some weapons have only `category` (e.g., "Simple Melee")
- Some weapons have both, some have neither
- The `isWeaponProficient()` function handles this variability, but it's fragile

### How It Fits Into the Project
This is the first data quality task in Phase 3. The audit produces a report that:
1. Documents current state of all weapons
2. Identifies specific issues to fix in Task 08
3. Informs decisions about data structure standardization

### Related Files
- **Primary File**: `src/data/items/index.ts` (weapon definitions)
- **Reference**: 2024 D&D PHB weapon tables (Chapter 6)
- **Reference**: `src/data/weapons.json` (if exists)
- **Output**: `docs/tasks/weapon-proficiency-system/weapon-audit-report.md`

---

## Prerequisites

### Required Knowledge
- 2024 D&D weapon categories (Simple vs Martial)
- Structure of item definitions in the codebase
- Markdown report writing

### Dependencies
- None (can run in parallel with Phase 1-2)

### Before You Start
- [ ] Access 2024 D&D PHB weapon lists or use online reference
- [ ] Review items/index.ts to understand weapon structure
- [ ] Create the audit report file

---

## Detailed Requirements

### Functional Requirements

1. **Identify all weapon items** in src/data/items/

2. **For each weapon, record**:
   - Name
   - `isMartial` value (true/false/undefined)
   - `category` value (string/undefined)
   - Consistency status (matches D&D 2024 rules?)
   - Issues found

3. **Categorize issues**:
   - Missing `isMartial` flag
   - Missing `category` field
   - Mismatch between `isMartial` and `category`
   - Incorrect classification per D&D rules

4. **Produce audit report** in markdown format

5. **Make recommendation** on data standardization approach

### Non-Functional Requirements
- **Accuracy**: Reference official D&D 2024 source
- **Completeness**: Every weapon in the codebase
- **Clarity**: Report should be actionable for Task 08

---

## Implementation Guide

### Approach Overview
1. Extract list of all weapons from items/index.ts
2. Cross-reference with D&D 2024 weapon tables
3. Document each weapon's current data
4. Identify issues and inconsistencies
5. Write audit report with recommendations

### Step-by-Step Instructions

#### Step 1: List All Weapons
Using grep or code search, find all items with `type: 'weapon'`:

```bash
# In src/data/items/index.ts, find weapon definitions
grep -n "type: 'weapon'" src/data/items/index.ts
```

Or review the file manually and list all weapons.

#### Step 2: Create Weapon Data Table
For each weapon, extract:
- `id` / `name`
- `isMartial` (true/false/undefined)
- `category` (value or missing)
- `slot` (MainHand/OffHand/etc.)
- Any other proficiency-related fields

#### Step 3: Reference D&D 2024 Weapon Lists

**Simple Weapons**:
| Name | Category |
|------|----------|
| Club | Simple Melee |
| Dagger | Simple Melee |
| Greatclub | Simple Melee |
| Handaxe | Simple Melee |
| Javelin | Simple Melee |
| Light Hammer | Simple Melee |
| Mace | Simple Melee |
| Quarterstaff | Simple Melee |
| Sickle | Simple Melee |
| Spear | Simple Melee |
| Crossbow, Light | Simple Ranged |
| Dart | Simple Ranged |
| Shortbow | Simple Ranged |
| Sling | Simple Ranged |

**Martial Weapons**:
| Name | Category |
|------|----------|
| Battleaxe | Martial Melee |
| Flail | Martial Melee |
| Glaive | Martial Melee |
| Greataxe | Martial Melee |
| Greatsword | Martial Melee |
| Halberd | Martial Melee |
| Lance | Martial Melee |
| Longsword | Martial Melee |
| Maul | Martial Melee |
| Morningstar | Martial Melee |
| Pike | Martial Melee |
| Rapier | Martial Melee |
| Scimitar | Martial Melee |
| Shortsword | Martial Melee |
| Trident | Martial Melee |
| War Pick | Martial Melee |
| Warhammer | Martial Melee |
| Whip | Martial Melee |
| Blowgun | Martial Ranged |
| Crossbow, Hand | Martial Ranged |
| Crossbow, Heavy | Martial Ranged |
| Longbow | Martial Ranged |
| Musket | Martial Ranged |
| Pistol | Martial Ranged |

#### Step 4: Compare and Document Issues
For each weapon in codebase:
- Does it have `isMartial`?
- Does it have `category`?
- Do they match D&D 2024 classification?
- Is there a mismatch between the two fields?

#### Step 5: Write Audit Report
Create `docs/tasks/weapon-proficiency-system/weapon-audit-report.md` with:

```markdown
# Weapon Proficiency Data Audit Report

**Date**: 2025-12-08
**Auditor**: [Agent Name]

## Summary
- Total weapons found: [X]
- Complete data (both fields): [X]
- Missing isMartial: [X]
- Missing category: [X]  
- Incorrect classification: [X]

## Detailed Findings

### Weapons with Complete Data
| Weapon | isMartial | Category | D&D 2024 Match |
|--------|-----------|----------|----------------|
| ... | ... | ... | ✓ |

### Weapons Missing isMartial
| Weapon | Category | Expected Value |
|--------|----------|----------------|
| ... | ... | false (Simple) |

### Weapons Missing Category
| Weapon | isMartial | Expected Category |
|--------|-----------|-------------------|
| ... | true | Martial Melee |

### Incorrect Classifications
| Weapon | Current | Expected | Issue |
|--------|---------|----------|-------|
| ... | ... | ... | ... |

## Recommendations

### Option A: Use Only `category` Field
- Pros: More descriptive (includes Melee/Ranged)
- Cons: Requires string parsing
- Decision: ...

### Option B: Use Only `isMartial` Field  
- Pros: Simple boolean check
- Cons: Loses Melee/Ranged info
- Decision: ...

### Option C: Keep Both (Current)
- Pros: Flexibility
- Cons: Inconsistency risk
- Decision: ...

## Recommended Approach
[Recommendation here]

## Actions for Task 08
1. [Specific fix 1]
2. [Specific fix 2]
...
```

---

## Acceptance Criteria

### Must Have (Required for task completion)
- [ ] All weapons in codebase identified
- [ ] Each weapon's proficiency data documented
- [ ] Comparison with D&D 2024 official data
- [ ] Issues categorized (missing/incorrect/inconsistent)
- [ ] Audit report markdown created
- [ ] Recommendation for standardization included

### Should Have (Important but not blocking)
- [ ] Summary statistics (X of Y weapons have issues)
- [ ] Actionable list for Task 08

### Could Have (If time permits)
- [ ] Visual chart or diagram of issues
- [ ] Reference links to D&D 2024 source

---

## Testing Requirements

### Verification
- [ ] Audit report covers every weapon in items/index.ts
- [ ] D&D classifications are accurate
- [ ] Report is readable and well-formatted
- [ ] Recommendations are clear and justified

---

## Files to Create

### docs/tasks/weapon-proficiency-system/weapon-audit-report.md
**Purpose**: Document findings from the audit

**Template**:
```markdown
# Weapon Proficiency Data Audit Report

## Summary
...

## Detailed Findings
...

## Recommendations
...

## Actions for Task 08
...
```

---

## 2024 D&D Reference

### Simple Weapons (isMartial: false)
- **Melee**: Club, Dagger, Greatclub, Handaxe, Javelin, Light Hammer, Mace, Quarterstaff, Sickle, Spear
- **Ranged**: Light Crossbow, Dart, Shortbow, Sling

### Martial Weapons (isMartial: true)
- **Melee**: Battleaxe, Flail, Glaive, Greataxe, Greatsword, Halberd, Lance, Longsword, Maul, Morningstar, Pike, Rapier, Scimitar, Shortsword, Trident, War Pick, Warhammer, Whip
- **Ranged**: Blowgun, Hand Crossbow, Heavy Crossbow, Longbow, Musket, Pistol

---

## Common Issues and Solutions

### Issue 1: Can't Find All Weapons
**Symptoms**: Unsure if list is complete
**Solution**:
- Search for `type: 'weapon'` in all data files
- Check for weapon imports from separate files
- Review any JSON weapon data files

### Issue 2: D&D 2024 Changes from 5e (2014)
**Symptoms**: Some weapons have different classifications
**Solution**:
- Use 2024 PHB as primary reference
- Note any 2014 vs 2024 differences in report
- Default to 2024 rules for standardization

---

## Related Documentation

- [START-HERE.md](START-HERE.md) - Section "Data Consistency Issues"
- [Task 08](08-fix-proficiency-flags.md) - Uses this audit's output
- [items/index.ts](../../../src/data/items/index.ts) - Source data

---

## Notes and Decisions

### Key Questions for Recommendation

1. **Should we keep both `isMartial` and `category`?**
   - Pro: More information available
   - Con: More to maintain, risk of inconsistency

2. **If we pick one, which?**
   - `category` is more descriptive but requires parsing
   - `isMartial` is simpler but loses Melee/Ranged info

3. **Should we add missing fields or remove redundant ones?**
   - Depends on how the data is used elsewhere

### Implementation Notes
- The audit should not modify any code
- Just gather information and document
- Task 08 will make the actual changes

---

## Definition of Done

This task is complete when:
- [x] Audit report created
- [x] All weapons documented
- [x] Issues categorized
- [x] D&D 2024 reference verified
- [x] Clear recommendations made
- [x] Task 08 has actionable list of fixes
- [x] Status updated in @PROJECT-INDEX.md

---

**Created**: 2025-12-08
**Last Updated**: 2025-12-08
**Completed By**: [Pending]
