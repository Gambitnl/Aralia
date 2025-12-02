# Spell System Overhaul - START HERE

**Welcome!** This document is your entry point to the Component-Based Spell System implementation.

---

## What Is This?

This is a complete task breakdown for transitioning Aralia's spell system from a brittle regex-based parser to a robust, data-driven component architecture with AI DM arbitration.

**Timeline:** 2 weeks with 5 parallel agents
**Estimated Effort:** ~80 hours total (16 hours per agent)
**Current Status:** Ready for implementation

---

## Quick Links

### For Project Managers / Orchestrators

1. **[00-PARALLEL-ARCHITECTURE.md](00-PARALLEL-ARCHITECTURE.md)** ⭐ START HERE
   - Module structure and naming contracts
   - Zero-conflict parallel execution strategy
   - API contracts for all 5 modules

2. **[00-DATA-VALIDATION-STRATEGY.md](00-DATA-VALIDATION-STRATEGY.md)**
   - Four-layer data validation system
   - JSON Schema + Zod + TypeScript + CLI wizard
   - Ensures spell data correctness

3. **[00-AGENT-COORDINATION.md](00-AGENT-COORDINATION.md)**
   - Daily standup protocol
   - File reservation system
   - Conflict resolution strategies
   - Week-by-week execution plan

### For Implementation Agents

Read your assigned task file:

- **Agent Alpha:** [AGENT-ALPHA-TYPES.md](AGENT-ALPHA-TYPES.md) - Type Definitions & Validation (2 days)
- **Agent Beta:** [AGENT-BETA-TARGETING.md](AGENT-BETA-TARGETING.md) - Targeting & AoE (2 days)
- **Agent Gamma:** [AGENT-GAMMA-COMMANDS.md](AGENT-GAMMA-COMMANDS.md) - Command Pattern (3 days)
- **Agent Delta:** [AGENT-DELTA-MECHANICS.md](AGENT-DELTA-MECHANICS.md) - Game Mechanics (2 days)
- **Agent Epsilon:** [AGENT-EPSILON-AI.md](AGENT-EPSILON-AI.md) - AI Arbitration (3 days)

### Background / Architecture

- **[../../architecture/@SPELL-SYSTEM-RESEARCH.md](../../architecture/@SPELL-SYSTEM-RESEARCH.md)** - Original research document
  - Effect taxonomy (8 core types)
  - TypeScript schema design
  - Grid algorithms
  - AI arbitration tier system

---

## How This Works

### Module Isolation (Zero Conflicts)

Each agent works in a **completely separate directory**:

```
src/systems/spells/
├── types/          ← Agent Alpha (NO dependencies)
├── targeting/      ← Agent Beta (depends on Alpha only)
├── commands/       ← Agent Gamma (depends on Alpha, Beta, Delta)
├── mechanics/      ← Agent Delta (depends on Alpha only)
└── ai/             ← Agent Epsilon (depends on Alpha only)
```

**Key principle:** You ONLY touch files in your directory. This guarantees zero git conflicts.

### Strict API Contracts

Every module exports **exactly defined APIs**. Example:

```typescript
// Agent Delta MUST export this from mechanics/index.ts
export { ScalingEngine } from './ScalingEngine'
export { SavingThrowResolver } from './SavingThrowResolver'
export { ResistanceCalculator } from './ResistanceCalculator'

// Agent Gamma imports and uses it
import { ScalingEngine } from '@/systems/spells/mechanics'
const scaled = ScalingEngine.scaleEffect(dice, formula, level, casterLevel)
```

If you change export names → you break other agents. **Communication is critical.**

### Data Validation (Four Layers)

Spell JSON files are validated at **four different stages**:

1. **JSON Schema** (build-time) - Catches schema violations before code runs
2. **Zod** (load-time) - Runtime validation with helpful errors
3. **TypeScript** (compile-time) - Type safety in code
4. **CLI Wizard** (dev-time) - Interactive spell creation tool

**Why?** Prevents invalid spell data from causing runtime errors.

---

## Getting Started (5-Minute Onboarding)

### Step 1: Read Your Task File

Each agent task file contains:
- ✅ Exact files you'll create
- ✅ Complete code examples
- ✅ API contract you must follow
- ✅ Testing requirements
- ✅ Acceptance criteria
- ✅ Integration points

**Example:** If you're Agent Beta, read [AGENT-BETA-TARGETING.md](AGENT-BETA-TARGETING.md) thoroughly.

### Step 2: Review API Contracts

Check the **"API Contract (STRICT)"** section in your task file.

**This is non-negotiable.** If it says:

```typescript
export { AoECalculator } from './AoECalculator'
```

You MUST export exactly `AoECalculator` (not `AOECalculator` or `AreaCalculator`).

### Step 3: Check Dependencies

Look at **"Dependencies"** in your task file:

- **Agent Alpha:** None (you go first!)
- **Agent Beta:** Alpha (types only)
- **Agent Gamma:** Alpha (types), Beta (targeting), Delta (mechanics)
- **Agent Delta:** Alpha (types only)
- **Agent Epsilon:** Alpha (types only)

**Gamma depends on everyone** → Gamma starts after others have `index.ts` exports ready.

### Step 4: Reserve Your Files

Before starting work, announce in daily standup:

```
🔒 Agent Beta RESERVING:
   - src/systems/spells/targeting/AoECalculator.ts
   - src/systems/spells/targeting/gridAlgorithms/sphere.ts
   - ETA: Today
```

This prevents two agents from touching the same file.

### Step 5: Start Coding

Follow your task file's **Implementation Details** section. Code examples are provided.

**Important:**
- Use TypeScript strict mode (no `any` types)
- Write unit tests as you go
- Keep functions pure (no mutation)
- Add JSDoc comments

### Step 6: Validate Before Committing

```bash
# TypeScript compilation
npm run build

# Unit tests
npm test

# Spell data validation (if you created JSONs)
npm run validate:spells
```

All three must pass before creating a PR.

---

## Week-by-Week Timeline

### Week 1: Foundation (Parallel Work)

**Day 1-2:**
- Alpha: Core types
- Beta: Grid algorithms
- Gamma: Command interface skeleton
- Delta: Dice roller, saving throws
- Epsilon: AI arbitrator skeleton

**Checkpoint:** All `index.ts` files exist with correct exports

**Day 3-5:**
- All agents complete their modules
- Unit tests passing
- No file conflicts

**Checkpoint:** All modules pass tests, build succeeds

### Week 2: Integration & Polish

**Day 6-7:**
- Alpha creates integration layer (`SpellExecutor`)
- Others fix integration issues

**Day 8-9:**
- All agents create spell JSON examples
- End-to-end testing

**Day 10:**
- Documentation
- Performance tuning
- Final PR review

**Final Checkpoint:** 5 spells execute correctly, ready to merge

---

## Daily Standup (15 minutes)

Every agent answers:

1. **Yesterday:** What did I complete?
2. **Today:** What am I working on?
3. **Blockers:** What's blocking me?
4. **API Changes:** Did I change any exports?

See [00-AGENT-COORDINATION.md](00-AGENT-COORDINATION.md#daily-standup-format) for details.

---

## Success Criteria

### For Each Agent

- [ ] All files in your module created
- [ ] Exports match API contract exactly
- [ ] Unit tests pass (>80% coverage)
- [ ] TypeScript compiles with zero errors
- [ ] JSDoc comments on all public APIs
- [ ] No files modified outside your module
- [ ] Integration tests pass (Week 2)

### For Overall Project

- [ ] 5 parallel agents worked without file conflicts
- [ ] SpellExecutor orchestrates all modules
- [ ] 5 test spells execute correctly
- [ ] Performance < 100ms per mechanical spell
- [ ] Data validation catches invalid spells at build time
- [ ] Documentation complete

---

## Common Questions

### Q: What if I need to modify a file outside my module?

**A:** You don't. If you think you need to, ask in standup first. Usually you can:
- Import from another module instead
- Request an interface change from the owning agent
- Extract shared code into a utility

### Q: What if another agent's API doesn't work for my use case?

**A:** Coordinate! Options:
1. Ask them to add a parameter to their function
2. Ask them to export a new utility
3. Adjust your approach to work with their API

**Never** copy-paste or work around their API.

### Q: What if I finish early?

**A:** Great! Help others:
1. Review another agent's PR
2. Write integration tests
3. Create spell JSON examples
4. Improve documentation

### Q: What if I'm blocked for >4 hours?

**A:** Announce in standup immediately. Don't wait. Orchestrator will:
1. Assign a helper agent to pair program
2. Redistribute work if needed
3. Schedule emergency coordination meeting

### Q: Can I change my API contract?

**A:** Only with coordination:
1. Announce in standup: "Considering changing X to Y"
2. Wait for confirmation from dependent agents
3. Update your task file documentation
4. Notify agents when pushed

---

## Tools & Commands

### Spell Creation

```bash
# Interactive wizard to create a spell
npm run spell:new

# Validate all spell JSON files
npm run validate:spells
```

### Development

```bash
# Build (runs TypeScript + validation)
npm run build

# Run tests
npm test

# Type check only
npm run type-check
```

### Git Workflow

```bash
# Create your branch
git checkout -b task/spell-system-[module]

# Before committing
npm run build && npm test

# Commit with module prefix
git commit -m "[Types] Add core Spell interface"

# Push and create PR
git push origin task/spell-system-[module]
```

---

## Emergency Contacts

- **Orchestrator:** @orchestrator (Discord)
- **Architecture Questions:** See [@SPELL-SYSTEM-RESEARCH.md](../../architecture/@SPELL-SYSTEM-RESEARCH.md)
- **Integration Issues:** #spell-system-coordination (Discord)
- **File Conflicts:** @orchestrator immediately

---

## What Happens After Week 2?

### Phase 1 Complete ✅

You've built:
- ✅ Type-safe spell system
- ✅ Working AoE calculations
- ✅ Command pattern execution
- ✅ Game mechanics (saves, resistances, scaling)
- ✅ AI arbitration foundation
- ✅ 5 working spells

### Phase 2: Core Mechanics (Weeks 3-4)

Next phase adds:
- Status conditions (Bless, Bane, Hold Person)
- Concentration tracking
- Full saving throw integration
- 20 core spells converted

### Phase 3: Advanced Features (Weeks 5-6)

- Movement/teleport commands
- Terrain/hazard effects
- Summoning system
- Hybrid spells (Ice Knife)
- 60 total spells

### Phase 4: AI Integration (Weeks 7-9)

- Connect AI arbitrator to real AI service
- Material tagging in game state
- 5 AI-dependent spells (Meld into Stone, Suggestion)

### Phase 5: Migration & Polish (Weeks 10-11)

- Migrate all existing spells
- Remove legacy parser
- Performance optimization
- End-to-end testing

---

## One More Thing

**This is a marathon, not a sprint.** Coordination and communication matter more than raw speed.

**Use the standup.** Even small questions can become big blockers if left unasked.

**Trust the architecture.** The module isolation and API contracts prevent 90% of integration issues.

**You've got this!** 🚀

---

**Ready to start?**

1. Read [00-PARALLEL-ARCHITECTURE.md](00-PARALLEL-ARCHITECTURE.md)
2. Read your agent task file
3. Ask questions in standup
4. Start coding!

**Last Updated:** November 28, 2025
