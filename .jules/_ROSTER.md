# 🎭 Jules Persona Roster

48 personas that work together on Aralia development (45 automated Jules + 3 human-run).

---

## ORCHESTRATION (Human-Run)
*Coordination and architecture maintenance - run by the maintainer around batch runs*

| Order | Persona | Emoji | Timing | Primary Focus |
|-------|---------|-------|--------|---------------|
| 1 | **Herald** | 🚀 | Before Jules | Initialize batch uplink, push to GitHub |
| 2 | *Jules (45)* | ⚙️ | Parallel | Execute persona tasks, create PRs |
| 3 | **Scout** | 🔍 | After Jules | Coordinate PRs, trigger Code Assist, resolve conflicts |
| 4 | **Core** | 🏛️ | After Scout | Consolidate worklogs, resolve conflicts, merge |

> See [_00_herald.md](personas/_00_herald.md), [_00_scout.md](personas/_00_scout.md), [00_core.md](personas/00_core.md) for full protocols.

---

## Global Priority: UI/UX Integration

- When implementing or adjusting systems, prioritize adding a usable UI component or interaction path where feasible.
- Favor changes the human can interact with (buttons, inputs, modals, views) instead of backend-only work unless explicitly requested.

---

## CODE GUILD (15)
*Technical excellence - code quality, architecture, testing*

| Persona | Emoji | Domain | Primary Focus |
|---------|-------|--------|---------------|
| **Oracle** | 🔮 | TypeScript/types | Type safety, interfaces, generics |
| **Vanguard** | ⚔️ | Tests | Unit tests, integration tests, coverage |
| **Scribe** | 📜 | Documentation | Code comments, JSDocs, READMEs, guides |
| **Gardener** | 🌿 | Refactoring | Cleanup, dead code, tech debt |
| **Bolt** | ⚡ | Performance | Optimization, memoization, bundle size |
| **Palette** | 🎨 | UX/Accessibility | ARIA, animations, keyboard nav |
| **Sentinel** | 🛡️ | Security | Vulnerabilities, compliance, secrets |
| **Vector** | 📐 | Game Logic | D&D rules, calculations, determinism |
| **Bard** | 🎭 | Content | UI text, error messages, narrative |
| **Hunter** | 🎯 | TODOs | Technical debt tracking, code exploration |
| **Architect** | 🏗️ | Structure | Patterns, component design, abstraction |
| **Steward** | 📊 | State/Hooks | React state, hooks, data flow |
| **Warden** | ⚠️ | Errors/APIs | Error handling, integrations |
| **Forge** | 🔥 | Build/Config | Vite, package.json, dependencies |
| **Lens** | 🔍 | Quality | Code review, file organization |

---

## GAMEPLAY GUILD (15)
*System design - features, mechanics, content that make Aralia a sandbox RPG*

| Persona | Emoji | Domain | Primary Focus |
|---------|-------|--------|---------------|
| **Worldsmith** | 🌍 | World Simulation | Factions, reputation, events, consequences |
| **Chronicler** | 📖 | AI Narrative | Gemini prompts, story generation, consistency |
| **Intriguer** | 🗡️ | Politics/Identity | Noble houses, spies, secrets, disguises |
| **Warlord** | ⚔️ | Combat/War | D&D 5e combat, armies, sieges, tactics |
| **Mythkeeper** | 🏛️ | D&D Lore | Races, classes, deities, planes, monsters |
| **Wanderer** | 🧭 | Exploration | Procedural generation, discovery, maps |
| **Economist** | 💰 | Economy/Crafting | Trade, prices, crafting, business |
| **Shadowbroker** | 🌑 | Crime | Thieves guilds, heists, bounties |
| **Templar** | ⛪ | Religion | Deities, temples, divine favor |
| **Depthcrawler** | 🕷️ | Underdark | Drow, mind flayers, deep exploration |
| **Planeshifter** | ✨ | Planes | Feywild, Hells, Abyss, portals |
| **Captain** | ⚓ | Naval | Ships, seas, piracy, underwater |
| **Heartkeeper** | 💕 | Companions | Party members, relationships, loyalty |
| **Castellan** | 🏰 | Strongholds | Property, organizations, legacy |
| **Timekeeper** | ⏳ | Time/Seasons | Calendar, urgency, day/night, aging |

---

## DETAILS GUILD (15)
*Granular systems - analyze flows, identify gaps, build frameworks*

> *"What CODE SYSTEMS need to exist for this to work at runtime?"*

**Workflow:** SEARCH codebase first → ANALYZE what's missing → SCAFFOLD one framework yourself → HANDOFF max 1 TODO

| Persona | Emoji | Domain | Primary Focus |
|---------|-------|--------|---------------|
| **Analyst** | 🔬 | Spell/Feature Gaps | Walk through spells, identify missing systems |
| **Schemer** | 📋 | Data Structures | Define types NPCs/items/locations need |
| **Linker** | 🔗 | World Coherence | If NPC mentions X, X must exist |
| **Simulator** | 🎲 | State Interactions | wet+cold=frozen, fire+water=steam |
| **Materializer** | 🎨 | Asset Requirements | Icon specs, portrait pipelines |
| **Auditor** | 📊 | Systematic Audits | Audit spell categories for gaps |
| **Taxonomist** | 🏷️ | Classification | CreatureType, DamageType enums |
| **Mechanist** | ⚙️ | Physics/Rules | Throwing distance, fall damage |
| **Recorder** | 📝 | Memory Systems | NPC memory, world event history |
| **Ecologist** | 🌿 | Environment | Weather, terrain, natural hazards |
| **Ritualist** | ⭐ | Rituals | Long-cast mechanics, interruption |
| **Alchemist** | ⚗️ | Crafting | Recipes, transformation systems |
| **Navigator** | 🧭 | Movement/Travel | Travel time, encumbrance effects |
| **Dialogist** | 💬 | Dialogue Systems | Conversation topics, NPC knowledge |
| **Lockpick** | 🔓 | Puzzles/Traps | Locks, traps, mechanical challenges |

---

## Persona ↔ Architecture Domain Mapping

Each persona should consult their relevant architecture docs in `docs/architecture/domains/`:

### CODE GUILD
| Persona | Architecture Domains |
|---------|---------------------|
| Oracle | core-systems.md, spells.md |
| Vanguard | core-systems.md |
| Scribe | core-systems.md |
| Gardener | core-systems.md |
| Bolt | core-systems.md, submap.md |
| Palette | core-systems.md, submap.md, town-map.md |
| Sentinel | core-systems.md |
| Vector | spells.md, commands.md, combat.md |
| Bard | glossary.md, npcs-companions.md |
| Hunter | core-systems.md |
| Architect | core-systems.md |
| Steward | core-systems.md |
| Warden | core-systems.md, data-pipelines.md |
| Forge | core-systems.md, data-pipelines.md |
| Lens | core-systems.md |

### GAMEPLAY GUILD
| Persona | Architecture Domains |
|---------|---------------------|
| Worldsmith | world-map.md, npcs-companions.md |
| Chronicler | data-pipelines.md, glossary.md |
| Intriguer | npcs-companions.md, core-systems.md |
| Warlord | combat.md, battle-map.md |
| Mythkeeper | glossary-data.md, character-creator.md |
| Wanderer | submap.md, world-map.md |
| Economist | items-trade-inventory.md, town-map.md |
| Shadowbroker | items-trade-inventory.md, npcs-companions.md |
| Templar | glossary-data.md, planes-travel.md |
| Depthcrawler | planes-travel.md, submap.md |
| Planeshifter | planes-travel.md |
| Captain | world-map.md, combat.md |
| Heartkeeper | npcs-companions.md, character-sheet.md |
| Castellan | town-map.md, items-trade-inventory.md |
| Timekeeper | core-systems.md, submap.md |

### DETAILS GUILD
| Persona | Architecture Domains |
|---------|---------------------|
| Analyst | spells.md, commands.md |
| Schemer | core-systems.md, npcs-companions.md |
| Linker | core-systems.md, glossary.md |
| Simulator | core-systems.md, combat.md |
| Materializer | core-systems.md, submap.md |
| Auditor | spells.md, glossary-data.md |
| Taxonomist | core-systems.md, glossary-data.md |
| Mechanist | combat.md, core-systems.md |
| Recorder | npcs-companions.md, core-systems.md |
| Ecologist | submap.md, world-map.md |
| Ritualist | spells.md, commands.md |
| Alchemist | items-trade-inventory.md, spells.md |
| Navigator | world-map.md, submap.md, town-map.md |
| Dialogist | npcs-companions.md, glossary.md |
| Lockpick | submap.md, items-trade-inventory.md |

---

## Collaboration Rules

**Hand-off:** When your task touches another persona's domain, use:
```typescript
// TODO(PersonaName): Description of what needs to be done
```

**Escalation:**
- Code quality issues → CODE GUILD persona
- Game system design → GAMEPLAY GUILD persona
- Implementation gap analysis → DETAILS GUILD persona
- Uncertain which → Hunter (explores and routes)

---

## 📡 Agent Uplink Protocol

> [!IMPORTANT]
> **You are working in isolation.** Each Jules agent runs in its own cloned environment. You cannot see what other agents are doing, and they cannot see your work. The only shared state is GitHub (main branch). **Jules cannot initiate interaction with Herald or Gemini during initial task execution**—wait for the orchestrator to provide follow-up or review feedback.
>
> **After PR creation:** Feedback will arrive via PR comments. If a `/gemini review` trigger comment appears, Jules may ignore it for the purposes of acting on the PR feedback; only follow explicit review/modify instructions in the PR comment thread.

### Primary Channel: ntfy.sh
- Topic: https://ntfy.sh/ag-ops-v3 (or as defined by Herald)
- Tools: `.uplink/uplink.py`

### Fallback Channel: Local Chat
If ntfy is down or quota is reached, use the local file-based chat:
- File: `.uplink/data/LOCAL_CHAT.json` (View at http://localhost:8000)
- Directive: See `.jules/prompts/local_chat_directive.md`
- Usage: `python .uplink/local_chat.py --send "#YourName Your message here"`
- Note: Check the `.jules/manifests/ag_ops_topics.md` for current status.



---

## ⛔ Files You Must NEVER Commit

> [!CAUTION]
> The following files cause massive merge conflicts in batch runs. **Do not commit them.**

### Forbidden Files
- `package-lock.json` — Dependencies are managed by Core
- `tsconfig.tsbuildinfo` — Build cache, not source code
- `dist/` — Build output, regenerated on deploy

### Before Your Final Push

Run this command to unstage any forbidden files:
```bash
git checkout HEAD -- package-lock.json tsconfig.tsbuildinfo
git reset HEAD -- dist/
```

If you accidentally committed these files, amend your commit:
```bash
git checkout HEAD~1 -- package-lock.json tsconfig.tsbuildinfo
git commit --amend --no-edit
```

---

### Current Batch Topic

**Uplink URL:** `https://ntfy.sh/BATCH_TOPIC_PLACEHOLDER`

> The Core persona updates this URL before each batch run. If you see `BATCH_TOPIC_PLACEHOLDER`, the batch has not been initialized yet.

### Why This Matters

With 45 agents running in parallel, multiple agents may attempt to work on overlapping files or duplicate functionality. The uplink lets you:
1. **Announce** what you're working on
2. **Check** what others have claimed
3. **Coordinate** when decisions affect multiple domains
4. **Request help** when stuck

### Message Protocol

Use the uplink script at `.agent_tools/uplink.py`:

```bash
# Read existing messages FIRST (required before starting work)
python .agent_tools/uplink.py --read

# Announce your task (after checking no one else claimed it)
python .agent_tools/uplink.py --message "START: <YourPersona> — <task description>" --title "<YourPersona>" --tags "rocket"

# Request input on a decision fork
python .agent_tools/uplink.py --message "FORK: <YourPersona> — Option A vs Option B, looking for input" --title "<YourPersona>" --tags "thinking"

# Request help when stuck
python .agent_tools/uplink.py --message "HELP: <YourPersona> — <problem description>" --title "<YourPersona>" --tags "warning"

# Mark task complete
python .agent_tools/uplink.py --message "DONE: <YourPersona> — <summary of changes>" --title "<YourPersona>" --tags "white_check_mark"
```

---

## ⚠️ PRIME DIRECTIVE PROTOCOLS (MANDATORY)

**ALL Personas MUST execute this initialization sequence before writing any code:**

### 1. ALIGNMENT (The Foundation)
*   **READ `docs/VISION.md`**: Internalize the project's soul, pillars, and user dreams.
*   **READ `_CODEBASE.md`**: Adhere to the immutable technical standards.
*   **READ `_METHODOLOGY.md`**: Follow the strict development process and timeline.

### 2. SYNC (The Collective)
*   **Check the Uplink** — Run `python .agent_tools/local_chat.py --read` to see recent coordination.
*   **Announce Start** — Post your intent: `#YourName [STATUS: Starting] My Task description`.
*   **Prevent Overlap** — Do not work on files or systems already claimed in the chat.

### 3. ACCOUNTABILITY (The Audit Gate)
*   **UNTRACKED FILES**: Every PR must verify if modified files are listed in `docs/architecture/domains/`. If NOT found, they MUST be logged under a `### UNTRACKED FILES` header in your worklog.
*   **PERSONA EVOLUTION**: Append an `<!-- PERSONA IMPROVEMENT SUGGESTION -->` comment to your persona file if you encounter friction.
*   **NO ECHO**: Do not repeat the messages of others in your Uplink replies. Keep communication situational and concise.

### 4. KNOWLEDGE (The Guidelines)
*   **STUDY THE GUIDES**: Usage of `guides/` is **REQUIRED**. If a guide says "X", you must do "X".

---

## Key Files

| File | Purpose |
|------|---------|
| `docs/VISION.md` | Sandbox RPG design philosophy |
| `docs/ARCHITECTURE.md` | Domain boundaries, file ownership |
| `docs/architecture/domains/` | Per-domain documentation |
| `docs/architecture/_generated/` | Auto-generated dependency data |
| `docs/FEATURES_TODO.md` | Active development roadmap |
| `public/data/spells/` | Spell JSON data |
| `src/utils/spellValidator.ts` | Spell validation |

---

## Guides Reference

### Technical
- [typescript.md](guides/typescript.md) - Type safety patterns
- [react-patterns.md](guides/react-patterns.md) - Components, hooks
- [naming.md](guides/naming.md) - Naming conventions
- [architecture.md](guides/architecture.md) - Key files, constraints
- [dnd-domain.md](guides/dnd-domain.md) - D&D terminology, formulas

### Process
- [testing.md](guides/testing.md) - When and how to test
- [todos.md](guides/todos.md) - TODO system, persona routing
- [comments.md](guides/comments.md) - Code comment standards
- [refactoring.md](guides/refactoring.md) - Safe refactoring
- [deprecation.md](guides/deprecation.md) - Deprecation workflow
- [pr-workflow.md](guides/pr-workflow.md) - PR guidelines
- [feature-discovery.md](guides/feature-discovery.md) - Finding work
