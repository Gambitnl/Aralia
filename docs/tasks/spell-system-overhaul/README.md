# Structured Spell Execution - Task Documentation

Project display name: Structured Spell Execution
Legacy name / folder slug: Spell System Overhaul (`docs/tasks/spell-system-overhaul`)

This directory keeps the historical `spell-system-overhaul` path because many older task files, status docs, and handoff notes already link here. The current living-project name is **Structured Spell Execution** because the active work is about proving and extending the data-to-validation-to-runtime spell pipeline, not just performing a broad "overhaul."

This directory contains detailed implementation tasks for the Component-Based Spell System overhaul.

---

## Directory Structure

```
spell-system-overhaul/
├── 00-TASK-INDEX.md           # Master index with dependency graph
├── TASK-TEMPLATE.md            # Template for creating new tasks
├── README.md                   # This file
├── 01-typescript-interfaces.md # Phase 1 tasks
├── 02-aoe-calculations.md
├── 03-command-pattern-base.md
├── 04-damage-healing-commands.md
├── [05-27 tasks...]
└── images/                     # Diagrams and screenshots (if needed)
```

---

## How to Use These Tasks

### For Project Managers / Orchestrators

1. **Start with [00-TASK-INDEX.md](00-TASK-INDEX.md)**
   - Review dependency graph
   - Understand critical path
   - Assign tasks to agents

2. **Track Progress**
   - Each task has clear acceptance criteria
   - Update task status in index as completed
   - Monitor for blockers

3. **Review Phase Completion**
   - Hold phase review before moving to next phase
   - Ensure all P0 tasks complete before phase transition

### For Implementation Agents

1. **Read the Task File**
   - Understand objective and context
   - Review requirements checklist
   - Check dependencies are complete

2. **Follow Implementation Details**
   - Use provided code examples as starting point
   - Maintain file structure conventions
   - Follow TypeScript/testing patterns

3. **Complete Acceptance Criteria**
   - Check off each criterion as completed
   - Run all tests
   - Ensure TypeScript compiles

4. **Report Completion**
   - Summarize changes made
   - Note any deviations from plan
   - Highlight potential issues for next tasks

---

## Task File Format

Each task file follows a standard format:

### Header
- Epic name
- Phase number and name
- Complexity rating (Low/Medium/High)
- Estimated effort in days
- Priority (P0 = Critical, P1 = High, P2 = Medium)
- Dependencies on other tasks

### Sections
1. **Objective** - What this task accomplishes
2. **Context** - Why it's needed, current state
3. **Requirements** - Detailed checklist of what to build
4. **Implementation Details** - Code examples, file structure
5. **Testing Requirements** - Unit and integration tests
6. **Acceptance Criteria** - Definition of "done"
7. **Files to Create/Modify** - Specific file changes
8. **References** - Links to architecture docs
9. **Estimated Breakdown** - Hour-by-hour plan

---

## Dependency Management

### Critical Path

The critical path (longest chain of dependent tasks) is:

```
01 -> 03 -> 04 -> 05 -> 07 -> 14 -> 19 -> 23 -> 27
```

**Total Critical Path Time:** ~22 days

### Parallel Work Streams

Tasks can be worked in parallel if dependencies allow:

**Week 1-2 (Phase 1):**
- Alpha: Task 01 -> 03
- Beta: Task 02 (parallel with 01)

**Week 3-4 (Phase 2):**
- Alpha: Task 04 -> 05 -> 06 -> 07
- Beta: Task 08 (parallel with 06-07)

**Week 5-6 (Phase 3):**
- Alpha: Task 14 -> 16 -> 17
- Beta: Task 10 -> 11 -> 12 -> 13
- Gamma: Task 15 (parallel with 10-13)

---

## Quality Standards

### Code Quality
- **TypeScript:** Strict mode enabled, no `any` types
- **Testing:** 80%+ coverage for new code
- **Documentation:** JSDoc for all public APIs
- **Linting:** Pass ESLint with project config

### Git Workflow
- **Branch Naming:** `task/XX-short-description`
- **Commit Messages:** `[Task XX] Description of change`
- **PR Title:** `Task XX: [Task Name]`
- **PR Description:** Link to task file, checklist of acceptance criteria

### Review Process
- **Code Review:** At least one approval required
- **Testing:** All tests must pass in CI
- **Documentation:** Update task file with any deviations
- **Demo:** Show working feature before merging

---

## Progress Tracking

### Task Statuses

- **Not Started** - Dependencies not yet complete
- **In Progress** - Agent actively working
- **Blocked** - Waiting on external dependency
- **In Review** - PR open, awaiting review
- **Complete** - Merged to main, acceptance criteria met

### Weekly Sync Format

```markdown
## Week X Progress Report

### Completed This Week
- [x] Task 01: TypeScript Interfaces
- [x] Task 02: AoE Calculations

### In Progress
- Task 03: Command Pattern (60% complete)

### Blockers
- Task 04 blocked waiting for Task 03 completion

### Next Week Plan
- Complete Task 03
- Start Tasks 04, 05, 08 in parallel

### Risks / Concerns
- Scaling logic more complex than estimated
- May need extra day for Task 03
```

---

## Common Patterns

### Naming Conventions

**Files:**
- Services: `PascalCase` (e.g., `SpellCommandFactory.ts`)
- Utilities: `camelCase` (e.g., `diceRoller.ts`)
- Types: `PascalCase` (e.g., `spells.ts` containing `Spell` interface)
- Tests: `[filename].test.ts`

**Variables:**
- Constants: `UPPER_SNAKE_CASE`
- Functions: `camelCase`
- Classes: `PascalCase`
- Interfaces: `PascalCase` (no `I` prefix)
- Types: `PascalCase`

### Testing Patterns

**Unit Test Example:**
```typescript
describe('SpellCommandFactory', () => {
  describe('createCommands', () => {
    it('should create damage command for fireball', () => {
      // Arrange
      const spell = createMockSpell('fireball')
      const caster = createMockCharacter()
      const target = createMockCharacter()

      // Act
      const commands = SpellCommandFactory.createCommands(
        spell, caster, [target], 3, mockState
      )

      // Assert
      expect(commands).toHaveLength(1)
      expect(commands[0]).toBeInstanceOf(DamageCommand)
    })
  })
})
```

**Integration Test Example:**
```typescript
describe('Spell Execution Flow', () => {
  it('should execute fireball end-to-end', async () => {
    // Setup
    const gameState = createGameState()
    const spell = getSpell('fireball')

    // Execute
    const result = await executeSpell(spell, caster, targets, gameState)

    // Verify
    expect(result.success).toBe(true)
    expect(targets.every(t => t.stats.currentHP < initialHP)).toBe(true)
  })
})
```

---

## Troubleshooting

### Common Issues

**Issue:** TypeScript compilation errors after merging
**Solution:** Run `npm run type-check` before creating PR

**Issue:** Tests passing locally but failing in CI
**Solution:** Check for hardcoded paths, timezone issues, or missing env vars

**Issue:** Task blocked by incomplete dependency
**Solution:** Check 00-TASK-INDEX.md for alternate parallel tasks

### Getting Help

1. **Check Architecture Docs:** [@SPELL-SYSTEM-RESEARCH.md](../../architecture/@SPELL-SYSTEM-RESEARCH.md)
2. **Review Similar Tasks:** Look at completed task files for patterns
3. **Ask in Standups:** Raise blockers early
4. **Update Task File:** Document deviations and learnings

---

## Architecture References

- **Main Research:** [@SPELL-SYSTEM-RESEARCH.md](../../architecture/@SPELL-SYSTEM-RESEARCH.md)
- **Current System:** [SPELL_SYSTEM_ARCHITECTURE.md](../../architecture/SPELL_SYSTEM_ARCHITECTURE.md)
- **Migration Status:** [SPELL_INTEGRATION_STATUS.md](../../SPELL_INTEGRATION_STATUS.md)

---

## Success Metrics

### Current Routing

The phase metrics below are historical acceptance targets from the original spell-overhaul plan.
They are preserved as context, but they are no longer standalone backlog checkboxes.
Route current work through the active Spells child lanes:

- Foundation, command execution, concentration, saves, resistances, defensive timing, and runtime performance: `docs/projects/spells/subprojects/structured-spell-execution/GAPS.md`.
- AoE calculations, targeting, map objects, cover, line of sight, terrain, and 2D/3D proof: `docs/projects/spells/subprojects/targeting-object-area/GAPS.md`.
- Corpus migration counts, level rollups, canonical recapture, and dataset/runtime completion thresholds: `docs/projects/spells/subprojects/spell-completeness-audit/GAPS.md`.
- Effect/schema validation and integration check automation: `docs/projects/spells/subprojects/validator-data-integrity/GAPS.md`.
- AI arbitration and complex mechanics discovery packages: `docs/projects/spells/subprojects/mechanics-discovery-packages/GAPS.md`.

Do not mark the historical phase list done directly. Close the owning gap row only after linked evidence proves the relevant behavior.

---

## Contributing

When creating new tasks using TASK-TEMPLATE.md:

1. Copy template to new file: `XX-task-name.md`
2. Fill in all sections with specific details
3. Add to 00-TASK-INDEX.md dependency graph
4. Ensure estimated effort is realistic
5. Include code examples where helpful
6. Define clear, testable acceptance criteria

---

**Last Updated:** November 27, 2025
**Maintainer:** Architecture Team
**Status:** Active Development
