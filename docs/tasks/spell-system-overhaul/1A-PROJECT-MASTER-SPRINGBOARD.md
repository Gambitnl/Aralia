# Spell System Project - Master Springboard

**Last Updated**: November 30, 2025
**Status**: Active Development - Phase 1 (Data Migration Focus)
**Current Priority**: Complete cantrip migration for Level 1 character testing

---

## 🎯 Project Mission Statement

**Transform Aralia's spell system from brittle regex-based parsing to a robust, data-driven component architecture that supports:**
1. Type-safe spell definitions in JSON
2. Mechanical spell execution (damage, healing, buffs, etc.)
3. AI DM arbitration for edge cases and narrative spells
4. Scalable spell migration workflow

**Immediate Goal**: Migrate all cantrips to new JSON format for first playtest with Level 1 characters.

---

## 📊 Current State (As of Nov 30, 2025)

### What's Built ✅

**Infrastructure (Code)**:
- ✅ **Type System** - Complete TypeScript interfaces (`src/types/spells.ts`)
- ✅ **Targeting System** - AoE calculations for all 5 shapes (sphere, cone, cube, cylinder, line)
- ✅ **Validation** - Spell validator with Zod schemas
- ✅ **JSON Schema** - For VSCode autocomplete

**Documentation**:
- ✅ **Spell JSON Examples** - 10 complete reference examples (`docs/spells/SPELL_JSON_EXAMPLES.md`)
- ✅ **Task Breakdown** - 27 tasks across 5 phases (`docs/tasks/spell-system-overhaul/00-TASK-INDEX.md`)
- ✅ **Agent Architecture** - 5-agent parallel plan (`docs/tasks/spell-system-overhaul/00-PARALLEL-ARCHITECTURE.md`)
- ✅ **Jules Workflow** - Spell conversion templates and prompts

**Spell Data**:
- ✅ **10 spells migrated** to new format (5 cantrips + 5 level 1)
  - Cantrips: acid-splash, blade-ward, booming-blade, chill-touch, create-bonfire
  - Level 1: absorb-elements, alarm, animal-friendship, armor-of-agathys, arms-of-hadar
- 📊 **375 total spell JSONs** exist (mostly old format)
- 📊 **38 cantrips** in database (33 need migration)

### What's NOT Built ❌

**Infrastructure (Code)**:
- ❌ **Command Pattern** - Spell execution commands not implemented
- ❌ **Mechanics System** - Dice rolling, saves, resistance calculations not built
- ❌ **AI Arbitration** - DM arbitrator service not implemented
- ❌ **Integration Layer** - SpellExecutor to tie everything together

**Spell Data**:
- ❌ **33 cantrips** still in old format
- ❌ **Integration testing** - Migrated spells not tested in-game
- ❌ **Glossary entries** - Markdown files for spell descriptions

### What Needs Verification ⚠️

One agent attempted to build Tasks 1-3 (Types, Targeting, Command Pattern) but likely used shortcuts/stubbing/mocking. Needs thorough code review to determine:
- What's actually functional vs. stubbed
- What tests pass vs. are mocked
- What can be trusted vs. needs rebuild

---

## 🗂️ Essential Documents (Read These)

### For ALL Agents - Read First

1. **[THIS FILE - 1A-PROJECT-MASTER-SPRINGBOARD.md]** - You are here
2. **[../../spells/SPELL_JSON_EXAMPLES.md]** - Complete spell format examples (READ THIS for spell conversion!)
3. **[./START-HERE.md]** - Original project overview

### For Spell Conversion (Jules)

4. **[1C-JULES-WORKFLOW-CONSOLIDATED.md]** (To be created) - Single source of truth for spell conversion workflow
5. **[../../spells/STATUS_LEVEL_0.md]** - Cantrip migration tracking
6. **[../../spells/STATUS_LEVEL_1.md]** - Level 1 spell migration tracking

### For Infrastructure Implementation

7. **[./00-TASK-INDEX.md]** - Master task list with dependencies
8. **[./00-PARALLEL-ARCHITECTURE.md]** - 5-agent parallel architecture
9. **[../../architecture/SPELL_SYSTEM_RESEARCH.md]** - Original architecture research

### For Specific Agent Tasks

10. **[./AGENT-ALPHA-TYPES.md]** - Type system and validation
11. **[./AGENT-BETA-TARGETING.md]** - Targeting and AoE calculations
12. **[./AGENT-GAMMA-COMMANDS.md]** - Command pattern implementation
13. **[./AGENT-DELTA-MECHANICS.md]** - Game mechanics (saves, resistance, scaling)
14. **[./AGENT-EPSILON-AI.md]** - AI arbitration service

---

## 🎯 Current Phase: Cantrip Migration

**Why cantrips first?**
- Level 1 characters only have access to cantrips
- Cantrips are needed for first playtest phase
- Simpler than leveled spells (no upcasting in most cases)
- Establishes pattern for future migrations

**Completion Criteria**:
- [ ] All 38 cantrips migrated to new JSON format
- [ ] All cantrips pass validation (`npm run validate`)
- [ ] Glossary entries created for all cantrips
- [ ] Integration testing completed (Creator + Sheet + Combat)

**Current Progress**: 5/38 cantrips migrated (13%)

---

## 🔄 Active Workflows

### Workflow 1: Spell Conversion (Jules)

**Owner**: Jules (AI agent)
**Status**: Active - Ready for new batch
**Document**: [1C-JULES-WORKFLOW-CONSOLIDATED.md] (To be created)

**Process**:
1. Jules receives task: "Migrate 5 cantrips to new JSON format"
2. Jules reads SPELL_JSON_EXAMPLES.md for templates
3. Jules converts 5 spells using proper BaseEffect structure
4. Jules runs validation: `npm run validate`
5. Jules creates glossary markdown files
6. Jules updates STATUS_LEVEL_0.md
7. Jules creates PR with title: "feat: Migrate 5 cantrips to new JSON format"

**Next Batch**:
- Dancing Lights
- Druidcraft
- Eldritch Blast
- Elementalism
- Fire Bolt

### Workflow 2: Infrastructure Implementation (Pending)

**Status**: On hold until cantrip migration completes
**Reason**: Need stable spell data format before building execution engine

**When resumed**:
- Review existing targeting/validation code for quality
- Build command pattern (Task 3)
- Build mechanics system (Task 4)
- Create integration layer

---

## 📋 Immediate Action Items (Next 2 Weeks)

### Week 1: Complete Cantrips (Priority P0)

**Jules Tasks**:
- [ ] Batch 2: Migrate 5 cantrips (Dancing Lights → Fire Bolt)
- [ ] Batch 3: Migrate 5 cantrips (Friends → Guidance)
- [ ] Batch 4: Migrate 5 cantrips (Light → Magic Stone)
- [ ] Batch 5: Migrate 5 cantrips (Mending → Minor Illusion)
- [ ] Batch 6: Migrate 5 cantrips (Poison Spray → Produce Flame)
- [ ] Batch 7: Migrate 5 cantrips (Ray of Frost → Resistance)
- [ ] Batch 8: Migrate 3 cantrips (Sacred Flame → Shillelagh)

**Total**: 33 cantrips remaining, 7 batches

### Week 2: Verification & Integration Testing

**Verification Tasks**:
- [ ] Run full validation suite on all cantrips
- [ ] Verify BaseEffect fields present in all effects
- [ ] Check for UTILITY overuse (should be DAMAGE, HEALING, etc.)
- [ ] Ensure glossary entries exist

**Integration Testing**:
- [ ] Load cantrips in spell creator UI
- [ ] Verify cantrips appear in character sheets
- [ ] Test combat execution for 5 sample cantrips
- [ ] Verify combat log outputs

---

## 🚧 Known Issues & Blockers

### Issue 1: Absorb Elements UTILITY Effect

**Problem**: Absorb Elements uses UTILITY type for damage effect instead of DAMAGE type
**File**: `public/data/spells/absorb-elements.json` line 60-70
**Impact**: Won't execute damage properly when command system is built
**Fix Needed**: Convert UTILITY effect to proper DAMAGE effect with trigger: "turn_start"

### Issue 2: Validation Script Requires tsx

**Problem**: `npm run validate` fails with "tsx: not found"
**Impact**: Can't validate spell JSONs during conversion
**Fix Needed**: Install tsx or update script to use different runner

### Issue 3: Inconsistent Class Name Format

**Problem**: Some spells use "Wizard", others use "WIZARD"
**Examples**:
- acid-splash.json: `"classes": ["Artificer", "Sorcerer", "Wizard"]`
- fire-bolt.json: `"classes": ["ARTIFICER", "SORCERER", "WIZARD"]`
**Impact**: Schema validation may fail, filtering won't work
**Fix Needed**: Standardize to one format (recommend Title Case: "Wizard")

---

## 🧭 Long-Term Roadmap

### Phase 1: Data Migration (Current - 4 weeks)
- **Week 1-2**: Migrate all 38 cantrips ← **WE ARE HERE**
- **Week 3-4**: Migrate essential Level 1 spells (20 spells)
- **Deliverable**: Spell data ready for Level 1 character testing

### Phase 2: Core Infrastructure (4 weeks)
- Build command pattern execution
- Implement mechanics system (saves, resistance, dice)
- Create integration layer (SpellExecutor)
- **Deliverable**: Mechanical spells execute in combat

### Phase 3: Advanced Features (4 weeks)
- Implement all 8 effect types
- Add concentration tracking
- Build upscaling system
- **Deliverable**: Complex spells work (Hex, Bless, etc.)

### Phase 4: AI Integration (3 weeks)
- Build AI arbitrator service
- Implement material tagging
- Create fallback behaviors
- **Deliverable**: Narrative spells work (Speak with Animals, etc.)

### Phase 5: Migration & Polish (2 weeks)
- Migrate remaining spells
- Remove legacy parser
- Performance optimization
- **Deliverable**: Production-ready spell system

**Total Timeline**: ~17 weeks (4 months)

---

## 🆘 Quick Reference

### Commands

```bash
# Validate all spell JSONs
npm run validate

# Run tests
npm test

# Type check
npm run type-check

# Create new spell (wizard)
npm run spell:new
```

### File Locations

```
Key Directories:
- Spell JSONs:          public/data/spells/
- Type definitions:     src/types/spells.ts
- Targeting system:     src/systems/spells/targeting/
- Validation:           src/systems/spells/validation/
- Documentation:        docs/tasks/spell-system-overhaul/
- Spell docs:           docs/spells/
- Glossary entries:     public/data/glossary/entries/spells/
```

### Getting Help

1. **For spell format questions**: Read `docs/spells/SPELL_JSON_EXAMPLES.md`
2. **For task questions**: Check `docs/tasks/spell-system-overhaul/00-TASK-INDEX.md`
3. **For workflow questions**: Read `JULES-WORKFLOW-CONSOLIDATED.md`
4. **For architecture questions**: See `docs/architecture/SPELL_SYSTEM_RESEARCH.md`

---

## 🎓 Onboarding Checklist

**For new agents joining the project:**

- [ ] Read this springboard document completely
- [ ] Read `docs/spells/SPELL_JSON_EXAMPLES.md` (essential!)
- [ ] Review your assigned workflow document
- [ ] Check current phase and priorities
- [ ] Review known issues section
- [ ] Ask questions before starting work

**For Jules (spell conversion)**:
- [ ] Read `JULES-WORKFLOW-CONSOLIDATED.md`
- [ ] Review `docs/spells/SPELL_JSON_EXAMPLES.md` thoroughly
- [ ] Understand BaseEffect fields requirement
- [ ] Know how to run validation
- [ ] Understand batch workflow (5 spells per task)

**For infrastructure agents**:
- [ ] Read `docs/tasks/spell-system-overhaul/00-PARALLEL-ARCHITECTURE.md`
- [ ] Review your specific agent task file (AGENT-[ROLE].md)
- [ ] Understand API contracts
- [ ] Check dependencies are complete
- [ ] Review module isolation rules

---

## 📝 Document Status

**This document is the MASTER ENTRY POINT for all spell system work.**

If you find conflicting information:
1. This document takes precedence for current priorities
2. Specific workflow documents (JULES-WORKFLOW) take precedence for process details
3. Architecture documents (SPELL_SYSTEM_RESEARCH) take precedence for design decisions
4. Task files (AGENT-*.md) take precedence for implementation details

**Maintenance**:
- Update this document when phase changes
- Update when major milestones complete
- Update when new blockers discovered
- Update weekly with progress

**Owner**: Project orchestrator
**Last Review**: November 30, 2025
**Next Review**: December 7, 2025

---

**Ready to start? Pick your role:**
- **Spell Conversion**: Read [1C-JULES-WORKFLOW-CONSOLIDATED.md] (To be created)
- **Infrastructure**: Read [./00-PARALLEL-ARCHITECTURE.md]
- **Project Management**: Read [./00-TASK-INDEX.md]
