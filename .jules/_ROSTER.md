# 🎭 Jules Persona Roster

All 45 personas that work together on Aralia development.

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
