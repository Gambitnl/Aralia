# Agent Coordination Guide

**Purpose:** Ensure 5 parallel agents work without conflicts and integrate seamlessly.

---

## Quick Start

### For Orchestrator

1. **Read architecture docs:**
   - [00-PARALLEL-ARCHITECTURE.md](00-PARALLEL-ARCHITECTURE.md) - Module structure
   - [00-DATA-VALIDATION-STRATEGY.md](00-DATA-VALIDATION-STRATEGY.md) - Data validation

2. **Assign agents:**
   - Agent Alpha → [AGENT-ALPHA-TYPES.md](AGENT-ALPHA-TYPES.md)
   - Agent Beta → [AGENT-BETA-TARGETING.md](AGENT-BETA-TARGETING.md)
   - Agent Gamma → [AGENT-GAMMA-COMMANDS.md](AGENT-GAMMA-COMMANDS.md)
   - Agent Delta → [AGENT-DELTA-MECHANICS.md](AGENT-DELTA-MECHANICS.md)
   - Agent Epsilon → [AGENT-EPSILON-AI.md](AGENT-EPSILON-AI.md)

3. **Start daily standups** (see below)

4. **Monitor integration checkpoints** (Week 1 end, Week 2 mid, Week 2 end)

### For Agents

1. **Read your task file carefully**
2. **Check API contract section** - These exports are STRICT
3. **Reserve files before working** (announce in standup)
4. **Run validation before committing**
5. **Never modify files outside your module**

---

## Module Ownership Matrix

| Module | Owner | Directory | Can Import From |
|--------|-------|-----------|-----------------|
| **Types** | Alpha | `types/`, `schema/`, `validation/` | None (only `@/types`) |
| **Targeting** | Beta | `targeting/` | Alpha (types) |
| **Commands** | Gamma | `commands/` | Alpha (types), Beta (targeting), Delta (mechanics) |
| **Mechanics** | Delta | `mechanics/` | Alpha (types) |
| **AI** | Epsilon | `ai/` | Alpha (types) |

### Conflict Resolution Rules

**If two agents need the same file:**
1. Check if it's necessary - can you import a utility instead?
2. One agent owns it, the other submits interface request
3. Split into two files if truly overlapping

**If you need code from another agent:**
- ✅ Import from their module's `index.ts`
- ❌ DO NOT directly import internal files
- ❌ DO NOT copy-paste their code

---

## API Contracts (Cross-Reference)

### Alpha Exports → Everyone Uses

```typescript
// All agents import types from Alpha
import type {
  Spell,
  SpellEffect,
  DamageEffect,
  HealingEffect,
  SpellTargeting,
  AreaOfEffect,
  DamageType,
  SavingThrow,
  // ... etc
} from '@/systems/spells/types'

import { isDamageEffect, isHealingEffect } from '@/systems/spells/types'
```

### Beta Exports → Gamma Uses

```typescript
// Gamma imports from Beta
import { AoECalculator, TargetResolver } from '@/systems/spells/targeting'

// Usage
const affectedTiles = AoECalculator.getAffectedTiles(center, aoe, direction)
const validTargets = TargetResolver.getValidTargets(targeting, caster, gameState)
```

### Gamma Exports → Integration Uses

```typescript
// Integration layer imports from Gamma
import { SpellCommandFactory } from '@/systems/spells/commands'

// Usage
const commands = SpellCommandFactory.createCommands(spell, caster, targets, level, state)
commands.forEach(cmd => newState = cmd.execute(newState))
```

### Delta Exports → Gamma Uses

```typescript
// Gamma imports from Delta
import {
  ScalingEngine,
  SavingThrowResolver,
  ResistanceCalculator,
  ConcentrationTracker
} from '@/systems/spells/mechanics'

// Usage in DamageCommand
const scaledDice = ScalingEngine.scaleEffect(baseDice, scaling, level, casterLevel)
const saveResult = SavingThrowResolver.resolveSave(target, saveType, dc)
const finalDamage = ResistanceCalculator.applyResistances(baseDamage, damageType, target)
```

### Epsilon Exports → Integration Uses

```typescript
// Integration layer imports from Epsilon
import { AISpellArbitrator } from '@/systems/spells/ai'

// Usage
const result = await AISpellArbitrator.arbitrate(spell, caster, targets, gameState, playerInput)
if (!result.allowed) {
  // Spell denied
}
```

---

## Week-by-Week Execution Plan

### Week 1: Foundation (Parallel Work)

**Day 1-2:**

| Agent | Task | Deliverable | Blocks |
|-------|------|-------------|--------|
| Alpha | Core types (Spell, SpellEffect, SpellTargeting) | `types/` complete | Everyone |
| Beta | Grid algorithms (Sphere, Line, Cone) | `gridAlgorithms/` complete | Gamma |
| Gamma | SpellCommand interface, Factory skeleton | `SpellCommand.ts` complete | Integration |
| Delta | DiceRoller, SavingThrowResolver | `DiceRoller.ts`, `SavingThrowResolver.ts` | Gamma |
| Epsilon | AISpellArbitrator skeleton, prompts | `AISpellArbitrator.ts` | Integration |

**Checkpoint (End of Day 2):**
- ✅ All `index.ts` files exist with correct exports
- ✅ TypeScript compiles (may have stub implementations)
- ✅ Alpha's types can be imported by everyone

**Day 3-5:**

| Agent | Task | Deliverable |
|-------|------|-------------|
| Alpha | JSON Schema, Zod validators, type guards | Validation complete |
| Beta | AoECalculator, TargetResolver, all algorithms | Module complete |
| Gamma | DamageCommand, HealingCommand | Working commands |
| Delta | ScalingEngine, ResistanceCalculator | Mechanics complete |
| Epsilon | MaterialTagService, ArbitrationCache | AI module complete |

**Checkpoint (End of Week 1):**
- ✅ All modules pass unit tests
- ✅ API exports match contracts
- ✅ No file conflicts
- ✅ Build passes

---

### Week 2: Integration & Testing

**Day 6-7: Integration Sprint**

Agent Alpha creates integration layer:
- File: `src/systems/spells/integration/SpellExecutor.ts`
- Orchestrates: Targeting → AI Arbitration → Commands → Execution
- Integration tests calling all modules

**Other agents:**
- Fix any integration issues discovered
- Improve error handling
- Add edge case tests

**Day 8-9: Spell Definitions**

All agents contribute spell JSONs:
- Beta: Create 5 spell JSONs (Fireball, Burning Hands, etc.)
- Use `npm run spell:new` wizard
- Validate with `npm run validate:spells`

**Day 10: Polish & Documentation**

- All agents: Write JSDoc comments
- Update CHANGELOG
- Create migration guide
- Performance testing

**Final Checkpoint (End of Week 2):**
- ✅ SpellExecutor works end-to-end
- ✅ 5 test spells execute correctly
- ✅ All tests pass (>80% coverage)
- ✅ Documentation complete
- ✅ Ready to merge

---

## Daily Standup Format

**Time:** 15 minutes
**Schedule:** Every day at 9 AM

### Template

Each agent answers 3 questions:

**1. Yesterday:**
```
Agent Alpha:
- Created Spell.ts, SpellEffect.ts, SpellTargeting.ts
- All exports working
- Tests: 12/15 passing
```

**2. Today:**
```
Agent Alpha:
- Finish type guards
- Create JSON Schema
- Fix failing tests
- ETA: End of day
```

**3. Blockers:**
```
Agent Gamma:
- BLOCKED: Waiting for Delta's ScalingEngine to integrate with DamageCommand
- Need API clarification from Beta on AoECalculator.getAffectedTiles() return type
```

**4. API Changes:**
```
Agent Beta:
- BREAKING CHANGE: Renamed getAoETiles() → getAffectedTiles()
- Updated: AGENT-BETA-TARGETING.md (line 42)
- Affected: Gamma (notified)
```

---

## File Reservation Protocol

Before modifying a file, announce in standup or Discord:

```
🔒 Agent Gamma RESERVING:
   - src/systems/spells/commands/DamageCommand.ts
   - ETA: 4 hours
   - Reason: Implementing damage execution logic
```

Other agents acknowledge:
```
✅ Agent Delta: Acknowledged. No conflicts with my work.
```

If conflict:
```
⚠️ Agent Delta: I also need DamageCommand to call my ScalingEngine.
   Can you export an interface I can implement?
```

---

## Integration Checkpoints

### Checkpoint 1: End of Week 1

**Orchestrator verifies:**
- [ ] All `index.ts` files exist
- [ ] `npm run build` passes
- [ ] All exports match API contracts
- [ ] No file conflicts in git
- [ ] Unit tests pass for each module

**Actions if failing:**
- Daily standup → 30 min coordination meeting
- Identify bottleneck agent
- Redistribute work if needed

### Checkpoint 2: Mid Week 2

**Integration test:**
```typescript
// Test: Can we execute a simple spell end-to-end?
import { SpellExecutor } from '@/systems/spells/integration'

test('Execute Fireball spell', async () => {
  const result = await SpellExecutor.executeSpell(
    fireballSpell,
    wizard,
    [goblin1, goblin2],
    3,
    gameState
  )

  expect(result.success).toBe(true)
  expect(result.newState.enemies[0].stats.currentHP).toBeLessThan(initialHP)
})
```

**If test fails:**
- Debug together in pair programming session
- Identify which module is failing
- Agent fixes issue within 24h

### Checkpoint 3: End of Week 2

**Full system validation:**
- [ ] 5 spells execute correctly
- [ ] Combat log shows spell effects
- [ ] AI arbitration works (even if stubbed)
- [ ] Performance < 100ms per spell
- [ ] No memory leaks
- [ ] Documentation complete

---

## Communication Channels

### Discord Channels

**#spell-system-standup**
- Daily standup updates
- File reservations
- Quick questions

**#spell-system-coordination**
- API contract discussions
- Breaking changes
- Integration issues

**#spell-system-pr-reviews**
- PR notifications
- Code review requests
- Merge conflicts

### GitHub

**Branch Strategy:**
- `task/spell-system-types` (Alpha)
- `task/spell-system-targeting` (Beta)
- `task/spell-system-commands` (Gamma)
- `task/spell-system-mechanics` (Delta)
- `task/spell-system-ai` (Epsilon)
- `task/spell-system-integration` (Alpha, Week 2)

**PR Naming:**
```
[Module] Brief description

Examples:
[Types] Add core Spell and SpellEffect interfaces
[Targeting] Implement Sphere and Cone algorithms
[Commands] Add DamageCommand with scaling support
```

**PR Template:**
```markdown
## Module: [Types/Targeting/Commands/Mechanics/AI]

## Changes
- Added X
- Modified Y
- Fixed Z

## API Contract Compliance
- [x] Exports match AGENT-X.md specification
- [x] No modifications outside my module
- [x] Unit tests pass
- [x] Build passes

## Integration Points
- Beta can now import AoECalculator
- Gamma needs to wait for Delta's ScalingEngine

## Testing
- Unit tests: 15/15 passing
- Coverage: 87%

## Breaking Changes
- None / Renamed X → Y (notified agents A, B)
```

---

## Conflict Resolution

### File Conflicts (Git)

**Prevention:**
- Never work outside your module
- Use file reservation protocol
- Pull from main daily

**If conflict occurs:**
1. Identify overlapping changes
2. Coordinate in Discord
3. One agent rebases, other reviews
4. Merge together in pair session

### API Conflicts

**Example:**
```
Gamma expects: AoECalculator.getAffectedTiles(center, aoe)
Beta implemented: AoECalculator.getAffectedTiles(center, aoe, direction)
```

**Resolution:**
1. Beta announces breaking change in standup
2. Gamma updates DamageCommand to pass direction
3. Both test integration
4. Update API contract docs

### Dependency Deadlocks

**Example:**
```
Gamma needs Delta's ScalingEngine
Delta needs Gamma's DamageCommand to test ScalingEngine
```

**Resolution:**
1. Delta creates ScalingEngine with stub test
2. Gamma integrates ScalingEngine
3. Delta updates test with real DamageCommand
4. Both verify integration

---

## Emergency Protocols

### Agent Blocked >24h

1. Orchestrator assigns helper agent
2. Pair programming session scheduled
3. If still blocked, work redistributed

### Integration Test Failing

1. All agents stop new work
2. Debug session within 4h
3. Fix identified and assigned
4. Resume once fixed

### Breaking Change Discovered Late

1. Agent announces immediately
2. Affected agents notified
3. Emergency coordination meeting
4. Rollback or coordinated fix

---

## Success Metrics

### Code Quality
- [ ] TypeScript strict mode, zero `any` types
- [ ] 80%+ test coverage per module
- [ ] All ESLint rules passing
- [ ] JSDoc on all public APIs

### Integration
- [ ] All modules import correctly
- [ ] Zero circular dependencies
- [ ] SpellExecutor works end-to-end
- [ ] 5 test spells execute

### Performance
- [ ] Mechanical spells < 100ms
- [ ] AI-assisted spells < 2s (with cache)
- [ ] No memory leaks after 100 spell casts
- [ ] Build time < 30s

### Documentation
- [ ] All API contracts documented
- [ ] README updated
- [ ] Migration guide written
- [ ] Examples for each module

---

## Post-Merge Checklist

1. [ ] All branches merged to `task/spell-system-integration`
2. [ ] Integration branch merged to `master`
3. [ ] Git tags created: `v0.4.0-spell-system`
4. [ ] CHANGELOG updated
5. [ ] Announce in #announcements
6. [ ] Retrospective meeting scheduled
7. [ ] Phase 2 tasks created

---

**Questions?** Ask @orchestrator in Discord.

**Last Updated:** November 28, 2025
