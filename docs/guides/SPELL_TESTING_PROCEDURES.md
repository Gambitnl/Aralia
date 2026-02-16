# Spell Testing Procedures and Validation Workflows

**Last Updated:** 2025-12-13  
**Purpose:** Comprehensive guide for testing spell implementations and validation workflows

## Overview

This document outlines the complete testing strategy for the Aralia RPG spell system, covering automated validation, manual testing procedures, and quality assurance workflows.

## Validation Workflows

### Automated Validation Pipeline

#### 1. Schema Validation
**Command:** `npm run validate:spells`

**What it validates:**
- JSON structure compliance
- Required field presence
- Enum value correctness
- Type safety
- Effect component structure

**Process:**
```bash
# Run spell-specific validation
npm run validate:spells

# Or run full data validation (includes spells)
npm run validate
```

**Expected Output:**
```
✓ Spell validation passed
✓ All 375 spells conform to schema
✓ No missing required fields
✓ All enum values valid
```

**Failure Handling:**
- Review detailed error messages
- Fix reported schema violations
- Re-run validation until passing

#### 2. TypeScript Compilation
**Command:** `npm run typecheck`

**What it validates:**
- Type safety of spell data
- Interface compliance
- No type errors in spell-related code

**Process:**
```bash
npm run typecheck
```

**Expected Output:**
```
TS6000: No errors found.
```

**Failure Handling:**
- Address TypeScript errors
- Ensure spell data matches interfaces in `src/types/spells.ts`
- Check for missing or incorrect field types

#### 3. Build Validation
**Command:** `npm run build`

**What it validates:**
- Production build success
- Bundle compilation
- Asset optimization
- No runtime errors

**Process:**
```bash
npm run build
```

**Expected Output:**
```
✓ Built in 12.34s
✓ dist/index.html generated
✓ All assets compiled successfully
```

**Failure Handling:**
- Fix build errors
- Check for missing dependencies
- Verify import paths are correct

### Continuous Integration Validation

#### GitHub Actions Workflow
The repository includes automated CI that runs on every PR:

```yaml
# .github/workflows/ci.yml
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run validate
      - run: npm run typecheck
      - run: npm run build
```

**CI Validation Includes:**
- ✅ Schema validation
- ✅ TypeScript compilation
- ✅ Production build
- ✅ Test suite execution
- ✅ Linting checks

## Manual Testing Procedures

### Test Environment Setup

#### 1. Development Server
```bash
# Start development server
npm run dev

# Server should be available at http://localhost:5173
```

#### 2. Test Character Creation
Create test characters for different scenarios:
- **Low-level caster** (Level 1-3)
- **Mid-level caster** (Level 4-7)
- **High-level caster** (Level 8-20)
- **Different classes** (Wizard, Cleric, Druid, etc.)

### Testing Categories

#### 1. Data Integrity Testing

##### Manifest Verification
```bash
# Check spell manifest
cat public/data/spells_manifest.json | jq '. | keys | length'
# Should show total spell count (currently 375)
```

##### File Structure Validation
```bash
# Verify directory structure
find public/data/spells -name "*.json" | wc -l
# Should match manifest count

# Check level distribution
ls public/data/spells/level-* | xargs -I {} sh -c 'echo "{}: $(ls {} | wc -l) spells"'
```

##### Content Validation
Manual checks:
- [ ] All spell IDs are kebab-case
- [ ] Filenames match spell IDs exactly
- [ ] Required fields present in all spells
- [ ] Class names normalized correctly
- [ ] Effect arrays properly structured

#### 2. Character Creation Testing

##### Test Procedure
1. **Navigate to character creation**
2. **Select appropriate class** for the spell
3. **Proceed to spell selection step**
4. **Verify spell appears** in available options
5. **Select the spell** and complete creation
6. **Confirm spell in character sheet**

##### Test Cases
- **Class Access:** Spell available to correct classes
- **Level Requirements:** Spell available at appropriate levels
- **Subclass Access:** Subclass-specific spells appear correctly
- **Multiple Selection:** Can select multiple spells when allowed
- **Prerequisite Checks:** Required prerequisites enforced

##### Expected Results
- ✅ Spell appears in class spell list
- ✅ Spell selection works without errors
- ✅ Spell added to character spellbook
- ✅ No duplicate or missing spells

#### 3. Spellbook Interface Testing

##### Test Procedure
1. **Create character with test spell**
2. **Open character sheet**
3. **Access spellbook overlay**
4. **Navigate spell levels/tabs**
5. **View spell details**
6. **Test prepared/unprepared functionality**

##### Test Cases
- **Spell Display:** All known spells visible
- **Level Filtering:** Spells organized by level correctly
- **Detail View:** Spell information complete and accurate
- **Preparation:** Prepared spell indicators work
- **Search/Filter:** Search functionality (if implemented)

##### Expected Results
- ✅ All character spells displayed
- ✅ Correct level organization
- ✅ Accurate spell details
- ✅ Proper preparation states
- ✅ Responsive interface

#### 4. Combat Integration Testing

##### Test Procedure
1. **Enter combat scenario**
2. **Access spell abilities**
3. **Select test spell**
4. **Test targeting system**
5. **Cast spell**
6. **Verify effects and outcomes**

##### Core Functionality Tests

###### Basic Casting
- [ ] Spell appears in combat abilities list
- [ ] Spell icon/name displays correctly
- [ ] Action cost shown accurately
- [ ] Spell available when conditions met
- [ ] Spell greyed out when unavailable

###### Targeting System
- [ ] Range display accurate
- [ ] Target selection works
- [ ] Area of effect visualization (if applicable)
- [ ] Invalid target rejection
- [ ] Line of sight checking (if implemented)

###### Effect Execution
- [ ] Damage calculation correct
- [ ] Healing amounts accurate
- [ ] Status conditions applied properly
- [ ] Duration tracking works
- [ ] Concentration mechanics function

##### Advanced Scenario Tests

###### Multi-target Spells
- [ ] Can select multiple targets
- [ ] Effects apply to all targets
- [ ] Individual target saves/resistance respected

###### Concentration Spells
- [ ] Concentration maintained during combat
- [ ] Concentration breaks on damage correctly
- [ ] Multiple concentration spells handled

###### Higher-level Casting
- [ ] Increased damage/healing at higher levels
- [ ] Additional targets for multi-target spells
- [ ] Extended durations
- [ ] Enhanced effects

###### Saving Throws
- [ ] Save DC calculated correctly
- [ ] Saving throw prompts appear
- [ ] Success/failure outcomes correct
- [ ] Half damage on successful save (when applicable)

#### 5. Edge Case Testing

##### Boundary Conditions
- **Minimum Values:** Level 0 (cantrips), 1 range, etc.
- **Maximum Values:** Level 9 spells, maximum range, etc.
- **Empty States:** No spells known, no spell slots, etc.

##### Error Conditions
- **Invalid Targets:** Self-target only spells on others
- **Insufficient Resources:** No spell slots remaining
- **Out of Range:** Targets beyond spell range
- **Concentration Conflicts:** Trying to concentrate on multiple spells

##### Performance Testing
- **Large Spell Lists:** Characters with many known spells
- **Complex Effects:** Spells with multiple effect components
- **High-frequency Casting:** Rapid spell casting in combat
- **Memory Usage:** Long sessions with extensive spell use

### Integration Testing

#### Cross-system Interactions

##### Character System Integration
- [ ] Spell slots calculated correctly based on level/class
- [ ] Spellcasting ability modifier applied
- [ ] Spell save DC calculated properly
- [ ] Attack bonuses for spell attacks correct

##### Item System Integration
- [ ] Spell scrolls function correctly
- [ ] Magical items with spell properties work
- [ ] Component pouch/foci substitutions handled

##### Combat System Integration
- [ ] Action economy respected
- [ ] Turn-based timing correct
- [ ] Initiative order maintained
- [ ] Environmental factors considered

## Quality Assurance Matrix

### Test Coverage Requirements

| Test Area | Minimum Coverage | Target Coverage | Critical Path |
|-----------|------------------|-----------------|---------------|
| Schema Validation | 100% | 100% | ✅ Required |
| Character Creation | 80% of spells | 100% | ✅ Required |
| Spellbook Interface | 80% of spells | 100% | ✅ Required |
| Combat Integration | 50% of spells | 80% | ✅ Required |
| Edge Cases | 30% of scenarios | 70% | Recommended |
| Performance | 20% of load cases | 50% | Recommended |

### Priority-Based Testing

#### P0 - Critical (Must Pass)
- Schema validation passes
- TypeScript compilation succeeds
- Production build completes
- Basic character creation works
- Core spell casting functions

#### P1 - High Priority (Should Pass)
- Spell appears in correct class lists
- Spellbook displays properly
- Basic combat effects work
- Saving throws function
- Concentration mechanics

#### P2 - Medium Priority (Nice to Have)
- Advanced targeting features
- Complex multi-effect spells
- Performance optimizations
- Edge case handling
- User experience refinements

## Reporting and Documentation

### Test Result Documentation

#### Test Execution Log
```markdown
## Test Execution: [Spell Name]
**Date:** 2025-12-13
**Tester:** [Your Name]
**Environment:** Development/Production

### Validation Results
- [x] Schema Validation: PASSED
- [x] TypeScript Check: PASSED
- [x] Build Test: PASSED

### Manual Testing
#### Character Creation
- [x] Spell appears for correct classes
- [x] Level requirements met
- [x] Successfully added to character

#### Spellbook
- [x] Spell displays correctly
- [x] Details accurate
- [x] Preparation functionality works

#### Combat
- [x] Spell available in combat
- [x] Targeting works correctly
- [x] Effects apply as expected
- [x] Resource consumption correct

### Issues Found
- None

### Notes
- Spell functions as expected
- All test cases passed
- Ready for production
```

#### Bug Report Template
```markdown
## Bug Report: [Spell Name] - [Brief Description]

**Severity:** Critical/High/Medium/Low
**Environment:** Development/Production
**Affected Versions:** [Version numbers]

### Description
[Detailed description of the issue]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Screenshots/Logs
[Attach relevant screenshots or console logs]

### Additional Context
[Any other relevant information]
```

## Automation Opportunities

### Test Script Development

#### Spell Validation Script
```javascript
// scripts/test-spell-integration.js
const { execSync } = require('child_process');

function validateSpell(spellId) {
  // Run validation commands
  const schemaResult = execSync('npm run validate:spells').toString();
  const typeResult = execSync('npm run typecheck').toString();
  const buildResult = execSync('npm run build').toString();
  
  return {
    schema: schemaResult.includes('passed'),
    types: typeResult.includes('No errors'),
    build: buildResult.includes('Built')
  };
}
```

#### Automated Test Runner
```bash
#!/bin/bash
# scripts/run-spell-tests.sh

echo "Running spell validation tests..."
npm run validate:spells

echo "Checking TypeScript compilation..."
npm run typecheck

echo "Testing build process..."
npm run build

echo "All automated tests completed!"
```

### Continuous Testing

#### Local Development Hooks
```json
// package.json
{
  "scripts": {
    "pre-commit": "npm run validate && npm run typecheck",
    "pre-push": "npm run build && npm test"
  }
}
```

#### Scheduled Validation
Set up cron jobs or GitHub Actions to regularly:
- Validate all spell data
- Check for schema drift
- Monitor performance metrics
- Run regression tests

## Maintenance and Updates

### Regular Testing Schedule

#### Daily
- [ ] Run validation on changed spells
- [ ] Test recently modified functionality
- [ ] Check CI pipeline status

#### Weekly
- [ ] Full spell system validation
- [ ] Performance benchmarking
- [ ] Review test coverage reports

#### Monthly
- [ ] Comprehensive integration testing
- [ ] Update test documentation
- [ ] Review and refine test procedures

### Test Suite Evolution

As the spell system evolves:
- Add new test cases for enhanced features
- Update existing tests for changed mechanics
- Remove obsolete test scenarios
- Expand edge case coverage
- Improve automation coverage

## Conclusion

This testing framework ensures spell system reliability through:
- **Automated validation** catching structural issues early
- **Comprehensive manual testing** verifying functionality
- **Clear documentation** enabling consistent execution
- **Regular maintenance** keeping tests current
- **Quality gates** preventing faulty implementations

Following these procedures will maintain the high quality and reliability that players expect from the Aralia RPG spell system.