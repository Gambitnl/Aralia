# Spell System - High-Level Roadmap

**Last Updated**: November 30, 2025
**Status**: Draft for review

---

## Current State (Quick Summary)

- **375 spell JSON files** exist (mostly old format)
- **10 spells migrated** to new format (5 cantrips + 5 level 1)
- **33 cantrips remaining** to migrate
- **Goal**: All cantrips migrated for Level 1 character testing

---

## PHASE 0: Foundation Setup (Do First)

**Purpose**: Prevent chaos before Jules starts migrating spells in batches

| # | Task | Why It Matters |
|---|------|----------------|
| 0.1 | Archive OLD format documentation | Prevent confusion - old docs use wrong format |
| 0.2 | Consolidate Jules workflow document | Single source of truth for spell conversion |
| 0.3 | Audit spell scope (PHB 2024 comparison) | Know how many spells we need to migrate total |

**Deliverable**: Clear path forward, no conflicting docs

---

## PHASE 1: File & Template Infrastructure (Before Mass Migration)

**Purpose**: Set up proper structure so Jules puts files in the right place

| # | Task | What It Does |
|---|------|--------------|
| 1.1 | Reorganize 375 spell files into level folders | `public/data/spells/level-0/`, `level-1/`, etc. |
| 1.2 | Update spell manifest/loader | Find spells in new folder structure |
| 1.3 | Create spell glossary template | Single template for all spell glossary entries |
| 1.4 | Build runtime glossary renderer | Lazy-load spell JSON when user clicks glossary entry |
| 1.5 | Update Jules workflow for new folders | Tell Jules where to put new spell files |

**Deliverable**: Organized file structure, working glossary system

---

## PHASE 2: Cantrip Migration (Jules + Gemini3 Review Loop)

**Purpose**: Migrate all 33 remaining cantrips to new format

| # | Task | Process |
|---|------|---------|
| 2.1 | Jules migrates 5 cantrips | Follow template, create JSON + glossary |
| 2.2 | Jules validates | Run `npm run validate` |
| 2.3 | Jules creates PR | After validation passes |
| 2.4 | You review & approve PR creation | Manual gate |
| 2.5 | Gemini3 critical review | Check against review checklist (TBD) |
| 2.6 | Jules iterates on feedback | Until Gemini3 approves |
| 2.7 | Merge PR | Move to next batch |
| 2.8 | Jules cleans up old glossary files | Remove duplicate `.md` files for migrated spells |

**Repeat**: 7 batches total (33 cantrips ÷ 5 per batch)

**Deliverable**: All 38 cantrips in new format, validated, tested

---

## PHASE 3: Infrastructure Audit (Parallel Track)

**Purpose**: Understand what infrastructure is stubbed vs. complete

| # | Task | Output |
|---|------|--------|
| 3.1 | Create infrastructure task board | Track stubbed commands, mechanics, etc. |
| 3.2 | Jules scans components | Report state of DamageCommand, HealingCommand, etc. |
| 3.3 | Gemini3 reviews scan results | Validate Jules findings |

**Deliverable**: Clear picture of what needs to be built for spell execution

---

## PHASE 4: Level 1 Spells (After Cantrips Complete)

**Purpose**: Migrate essential Level 1 spells for testing

| # | Task | Notes |
|---|------|-------|
| 4.1 | Define "essential" Level 1 spell list | TBD - how many? Which ones? |
| 4.2 | Same process as Phase 2 | Jules batches, Gemini3 review |

**Deliverable**: Level 1 character has full spell loadout for testing

---

## FUTURE PHASES (Not Scoped Yet)

- **Phase 5**: Complete stubbed infrastructure (commands, mechanics)
- **Phase 6**: Higher level spells (2-9)
- **Phase 7**: AI arbitration system
- **Phase 8**: Integration testing & polish

---

## Next Steps

1. **Review this roadmap** - Does the order make sense?
2. **Pick ONE task from Phase 0** to define in detail
3. **Define it properly** - scope, acceptance criteria, steps
4. **Execute that one task**
5. **Repeat** - pick next task, define, execute

---

## Questions to Resolve

- **0.3**: Do you have PHB 2024 spell list access?
- **1.2**: Where should manifest/loader update happen in sequence?
- **2.5**: What should Gemini3's review checklist include?
- **4.1**: How many Level 1 spells are "essential"?

---

**This is a living document. Update as we learn more.**
