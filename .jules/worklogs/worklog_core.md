# 🏛️ Core Worklog

## 🛠️ Best Practices & "How-To" Tips

### 1. Collaborative Lint Cleanup (The "Blitz")
- **Domain Split**: When multiple agents are cleaning lint, split by top-level directory (e.g., Core owns `src/services`, Codex owns `src/components`).
- **Communication**: Use the Uplink (`LOCAL_CHAT.json`) to "claim" domains or specific files to avoid merge collisions.
- **Verification**: Always run `npm run lint` or `npx eslint <file>` after a fix. For complex files, also run `npm run build` or `tsc` to verify type integrity.

### 2. God File Splitting (Surgical Split)
- **Identify**: Look for files >30KB or with mixed responsibilities.
- **Plan**: Define satellite generators/services before moving code.
- **Execution**: 
    1. Extract data/constants.
    2. Extract pure logic.
    3. Update orchestrator to delegate.
    4. Verify via Build/Test.

### 3. Progressive Disclosure (UI/UX)
- **Directive**: Complex features must be narrative-gated or unlocked.
- **Implementation**: Use "Unlock Hooks" in the state or character data to hide advanced UI components (e.g., Naval, Strongholds) until the player reaches the required milestone.

### 4. The "Architect Buddies" Vision (Local vs Cloud)
- **Local Elite (The Buddies)**: Core, Codex, Antigravity. High-level coordination, PR evaluation, conflict resolution, and architectural guardrails.
- **Cloud Legion (The Jules 45)**: Distributed parallel execution. Large-scale implementation of features across all 45 domains.
- **Core Role**: Act as the "Master of the Blueprint." Filter and orchestrate the flow of PRs from the Cloud Legion to ensure architectural coherence and prevent "Legion Bloat."

---

## 📅 Log: 2025-12-22

### 🏗️ Tasks Completed
- [x] Adopted Core Persona & Synced with Layer 2 Protocols.
- [x] Initialized `worklog_core.md`.
- [x] Verified `src/utils/characterUtils.ts` is clean of lint errors.
- [x] FINISHED the entire Services & Hooks & Utils lint cleanup (src/services, src/hooks, src/utils). Preservation protocol strictly followed.
- [x] Build is GREEN.
- [x] ACHIEVED 100% Architecture Coverage (1610/1610 files).
- [x] ACHIEVED 100% Test Coverage (22/22 domains have tests).
- [x] Resolved all Orphaned files from RealmSmith split and type split.

### 🚧 Tasks In-Progress
- **Architectural Maintenance**: 
    - [x] Update `docs/architecture/domains/` with new generators.
- **God File Modularization**:
    - [ ] Split `Glossary.tsx` (45KB).
    - [ ] Split `App.tsx` (31KB).

### 🔍 UNTRACKED FILES
*None remain.*

<!-- PERSONA IMPROVEMENT SUGGESTION -->
*Ensure the 'Core' persona is the final arbiter for all domain assignments in the architecture compendium.*
