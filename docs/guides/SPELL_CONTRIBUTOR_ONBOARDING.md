# Spell System Contributor Onboarding Guide

**Last Updated:** 2025-12-13  
**Target Audience:** New contributors to the Aralia RPG spell system  
**Purpose:** Comprehensive onboarding resource for spell system development

## Welcome!

Welcome to the Aralia RPG spell system **development team**! This guide will help you get up to speed quickly and start **contributing to the spell system codebase** - creating and maintaining the magical abilities that drive combat, exploration, and narrative experiences for players.

## Overview

The spell system is the heart of Aralia's gameplay experience, enabling magical abilities that drive combat, exploration, and narrative experiences. As a **developer-contributor**, you'll be working on the **infrastructure and content creation** that powers this system, transforming it from a legacy text-parsing approach to a modern, component-based architecture.

### What You'll Be Working With

- **375 spells** across 10 levels (0-9)
- **Component-based architecture** with explicit effect definitions
- **Strict TypeScript interfaces** ensuring data quality
- **Comprehensive validation** preventing runtime errors
- **Rich integration** with character creation, combat, and UI systems

## Getting Started

### Prerequisites

Before diving in, ensure you have:

#### Technical Requirements
- **Node.js** (Version 18+ recommended)
- **npm** or **yarn** package manager
- **Git** for version control
- **Code Editor** (VS Code recommended with recommended extensions)

#### Knowledge Requirements
- **Basic TypeScript/JavaScript** understanding
- **JSON** data structure familiarity
- **Git workflow** basics (clone, commit, push, pull requests)
- **D&D 5e spell mechanics** (helpful but not required)

### Environment Setup

#### 1. Repository Setup
```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Aralia.git
cd Aralia

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/Aralia.git

# Install dependencies
npm install

# Verify setup
npm run dev
```

#### 2. Development Environment
```bash
# Run development server
npm run dev

# Open browser to http://localhost:5173
# You should see the Aralia RPG application
```

#### 3. Validation Tools
```bash
# Test spell validation
npm run validate:spells

# Run TypeScript check
npm run typecheck

# Run full test suite
npm test
```

## Understanding the Spell System

### Architecture Overview

The spell system follows a layered architecture:

```
┌─────────────────────────────────┐
│        Presentation Layer       │  (React Components)
│  Spellbook, Combat UI, Glossary │
├─────────────────────────────────┤
│        Business Logic           │  (Services & Hooks)
│  SpellService, useAbilitySystem │
├─────────────────────────────────┤
│        Data Access              │  (Validation & Loading)
│  JSON Schema, Manifest System   │
├─────────────────────────────────┤
│        Data Layer               │  (Persistent Storage)
│  Spell JSON Files, Manifest     │
└─────────────────────────────────┘
```

### Key Concepts

#### Spell Components
Each spell is composed of:
- **Metadata:** Name, level, school, classes
- **Mechanics:** Casting time, range, components, duration
- **Targeting:** Who/what can be affected
- **Effects:** What happens when cast (damage, healing, conditions, etc.)

#### Effect Types
- **DAMAGE:** Deals damage to targets
- **HEALING:** Restores hit points
- **STATUS_CONDITION:** Applies conditions (invisible, poisoned, etc.)
- **MOVEMENT:** Teleports or forces movement
- **UTILITY:** Various non-combat effects
- **DEFENSIVE:** Provides protection or buffs

#### Integration Points
- **Character Creation:** Spell selection and learning
- **Spellbook:** Viewing and managing known spells
- **Combat System:** Casting spells in battle
- **Glossary:** Reference and search functionality

## Your First Contribution

### Choosing Your First Spell

Start with a simple spell to get familiar with the process:

#### Recommended Beginner Spells
1. **Fire Bolt** (Cantrip) - Simple damage spell
2. **Cure Wounds** (Level 1) - Straightforward healing
3. **Mage Armor** (Level 1) - Basic buff application
4. **Shield** (Level 1) - Reactive defensive spell

#### Finding Available Spells
Check the status tracking files:
- `docs/spells/STATUS_LEVEL_0.md` (Cantrips)
- `docs/spells/STATUS_LEVEL_1.md` (Level 1 spells)
- Look for spells marked as `[ ] Pending` or `[D] Data Only`

### Step-by-Step Implementation

#### 1. Research Phase
```bash
# Check spell status
grep "fire-bolt" docs/spells/STATUS_LEVEL_0.md

# Look at existing implementation
cat public/data/spells/level-0/fire-bolt.json

# Review documentation
cat docs/spells/SPELL_JSON_EXAMPLES.md
```

#### 2. Implementation Phase
```bash
# Create new spell file
cp public/data/spells/level-0/fire-bolt.json \
   public/data/spells/level-0/your-new-spell.json

# Edit the file with your spell data
# Use the examples and schema as reference
```

#### 3. Validation Phase
```bash
# Validate your spell
npm run validate:spells

# Check TypeScript compilation
npm run typecheck

# Test build
npm run build
```

#### 4. Testing Phase
1. **Start development server:** `npm run dev`
2. **Create test character** with appropriate class
3. **Test in character creation** - can you select the spell?
4. **Test in spellbook** - does it display correctly?
5. **Test in combat** - does it cast and produce effects?

#### 5. Documentation Phase
```bash
# Update status tracking
# Edit docs/spells/STATUS_LEVEL_N.md
# Change status from [ ] to [D] or [x] as appropriate
```

### Following Best Practices

#### Code Quality
- **Use the schema:** Follow the exact structure defined in `src/types/spells.ts`
- **Validate early:** Run validation commands frequently during development
- **Test thoroughly:** Verify in all integration points (creation, book, combat)
- **Document clearly:** Add notes about complex mechanics or edge cases

#### Collaboration
- **Communicate:** Join discussions about spell implementation approaches
- **Review:** Participate in code reviews for other spell contributions
- **Learn:** Study existing implementations to understand patterns
- **Share:** Document your learning to help future contributors

## Learning Resources

### Essential Documentation

#### Primary Guides
1. **[SPELL_ADDITION_WORKFLOW_GUIDE.md](../guides/SPELL_ADDITION_WORKFLOW_GUIDE.md)** - Complete workflow for adding spells
2. **[SPELL_DATA_CREATION_GUIDE.md](../guides/SPELL_DATA_CREATION_GUIDE.md)** - Detailed data structure reference
3. **[SPELL_IMPLEMENTATION_CHECKLIST.md](../guides/SPELL_IMPLEMENTATION_CHECKLIST.md)** - Step-by-step implementation guide
4. **[SPELL_TESTING_PROCEDURES.md](../guides/SPELL_TESTING_PROCEDURES.md)** - Comprehensive testing procedures

#### Reference Materials
1. **[SPELL_JSON_EXAMPLES.md](../spells/SPELL_JSON_EXAMPLES.md)** - Complete spell examples
2. **[SPELL_SYSTEM_ARCHITECTURE.md](../architecture/SPELL_SYSTEM_ARCHITECTURE.md)** - System architecture overview
3. **[SPELL_INTEGRATION_CHECKLIST.md](../spells/SPELL_INTEGRATION_CHECKLIST.md)** - Integration testing checklist
4. **[SPELL_TROUBLESHOOTING_GUIDE.md](../guides/SPELL_TROUBLESHOOTING_GUIDE.md)** - Common issue solutions

### Status Tracking
- **Overall Progress:** `docs/SPELL_INTEGRATION_STATUS.md`
- **Per-Level Status:** `docs/spells/STATUS_LEVEL_{N}.md`
- **Migration Path:** `docs/tasks/spell-system-overhaul/SPELL_MIGRATION_PATH.md`

### Tools and Scripts

#### Validation Tools
```bash
# Spell-specific validation
npm run validate:spells

# Full data validation
npm run validate

# TypeScript compilation
npm run typecheck

# Build test
npm run build
```

#### Development Scripts
```bash
# Development server
npm run dev

# Run tests
npm test

# Linting
npm run lint
```

## Common Workflows

### Adding a New Spell

1. **Research:** Check status files, study similar spells
2. **Setup:** Create file in correct directory structure
3. **Implement:** Follow schema and examples for data creation
4. **Validate:** Run all validation commands
5. **Test:** Verify in character creation, spellbook, and combat
6. **Document:** Update status tracking files
7. **Submit:** Create pull request with clear description

### Updating Existing Spell

1. **Identify:** Locate the spell file to modify
2. **Backup:** Optionally create backup before changes
3. **Modify:** Make targeted changes to specific fields
4. **Validate:** Ensure changes pass all validation
5. **Test:** Verify the updated spell still works correctly
6. **Document:** Note the changes in relevant files
7. **Submit:** Create pull request explaining the update

### Debugging Spell Issues

1. **Reproduce:** Identify consistent steps to reproduce the issue
2. **Isolate:** Determine if issue is data, logic, or integration related
3. **Investigate:** Use browser dev tools and console logging
4. **Fix:** Implement solution addressing root cause
5. **Verify:** Test fix resolves issue without introducing new problems
6. **Document:** Add notes about the issue and solution

## Community and Support

### Getting Help

#### Documentation First
Always check the documentation before asking questions:
1. Search existing guides and examples
2. Review similar spell implementations
3. Check troubleshooting guide for common issues

#### Communication Channels
- **GitHub Issues:** For bug reports and feature requests
- **Pull Request Comments:** For code-specific discussions
- **Discussion Forums:** For general questions and collaboration
- **Real-time Chat:** If available in your community platform

#### Mentorship Program
- **Find a Mentor:** Pair with experienced contributor
- **Code Reviews:** Request detailed feedback on your work
- **Knowledge Sharing:** Participate in learning sessions
- **Progress Tracking:** Regular check-ins on your development

### Contributing Guidelines

#### Code Standards
- **Follow existing patterns:** Study current implementations
- **Maintain consistency:** Use established naming and structure conventions
- **Write clean code:** Clear, readable, well-commented when necessary
- **Include tests:** Add validation for new functionality

#### Collaboration Etiquette
- **Be respectful:** Constructive criticism and positive communication
- **Give credit:** Acknowledge others' contributions and ideas
- **Stay engaged:** Respond to feedback and questions promptly
- **Help others:** Share knowledge and assist fellow contributors

#### Quality Expectations
- **Thorough testing:** Verify all integration points work correctly
- **Documentation:** Keep status files and guides up to date
- **Performance consideration:** Ensure implementations are efficient
- **Accessibility awareness:** Consider usability for all players

## Growth Path

### Beginner Level (0-10 spells)
**Goals:**
- Understand spell system architecture
- Implement simple spells correctly
- Learn validation and testing procedures
- Become familiar with contribution workflow

**Skills Developed:**
- JSON data structure creation
- Schema compliance
- Basic integration testing
- Git workflow fundamentals

### Intermediate Level (10-50 spells)
**Goals:**
- Handle moderate complexity spells
- Contribute to system improvements
- Mentor new contributors
- Participate in architectural discussions

**Skills Developed:**
- Complex effect implementation
- Performance optimization
- Code review participation
- Documentation improvement

### Advanced Level (50+ spells)
**Goals:**
- Lead complex spell implementations
- Contribute to system architecture
- Drive migration initiatives
- Mentor and coordinate teams

**Skills Developed:**
- System architecture understanding
- Leadership and coordination
- Advanced problem-solving
- Strategic planning

## Recognition and Rewards

### Contribution Tracking
- **Spell Implementation Count:** Track spells you've successfully contributed
- **Quality Metrics:** Monitor validation pass rates and integration success
- **Community Recognition:** Acknowledgment in release notes and contributor lists
- **Skill Development:** Personal growth in software engineering and game development

### Achievement Milestones
- **First Spell:** Successfully implement your first spell
- **Ten Spells:** Consistent contributor milestone
- **Specialization:** Become expert in specific spell types
- **Leadership:** Guide major system improvements or migrations

## Next Steps

### Immediate Actions
1. **Set up your development environment**
2. **Choose your first spell to implement**
3. **Join the community discussions**
4. **Start small and build confidence**

### Short-term Goals (1-3 months)
- **Implement 5-10 spells** of varying complexity
- **Participate in code reviews** for other contributions
- **Improve documentation** based on your learning experience
- **Connect with mentors** and experienced contributors

### Long-term Vision (6-12 months)
- **Become a recognized expert** in spell system development
- **Lead significant improvements** or migration efforts
- **Mentor new contributors** joining the project
- **Contribute to architectural evolution** of the system

## Final Words

Welcome to the **development team**! The spell system is both challenging and rewarding to work on. Every spell you **develop and implement** directly impacts players' enjoyment of the game. Take your time to learn, don't hesitate to ask questions, and remember that every expert was once a beginner.

Your contributions matter, and the community appreciates your effort to make Aralia RPG better for everyone. Happy spell crafting!

---

**Need Help?**
- Check the [TROUBLESHOOTING GUIDE](../guides/SPELL_TROUBLESHOOTING_GUIDE.md)
- Review [existing spell implementations](../../public/data/spells/)
- Join community discussions
- Reach out to project maintainers

**Ready to Start?**
1. Pick a simple spell from the status tracking files
2. Follow the [IMPLEMENTATION CHECKLIST](../guides/SPELL_IMPLEMENTATION_CHECKLIST.md)
3. Submit your first pull request
4. Celebrate your contribution!

**Last Updated:** December 13, 2025  
**Next Review:** March 13, 2026