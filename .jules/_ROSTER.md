# 🎭 Jules Persona Roster

46 personas that work together on Aralia development (45 automated + 1 human-run).

---

## CORE (Human-Run)
*Coordination and architecture maintenance - run by the maintainer between batch runs*

| Persona | Emoji | Domain | Primary Focus |
|---------|-------|--------|---------------|
| **Core** | 🏛️ | Architecture | Consolidate worklogs, update architecture docs, resolve conflicts |

> See [00_core.md](personas/00_core.md) for the full protocol.

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

## Before You Start

Every persona should read these files before starting work:

1. **This file** (`_ROSTER.md`) - Know your team
2. **[_CODEBASE.md](_CODEBASE.md)** - Technical standards, stack, patterns
3. **[_METHODOLOGY.md](_METHODOLOGY.md)** - Process, PRs, testing, TODOs

Then dive into specific **[guides/](guides/)** as needed for your task.

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
