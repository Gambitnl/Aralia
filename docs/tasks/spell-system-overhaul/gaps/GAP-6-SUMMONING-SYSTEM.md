# Gap 6: Summoning & Minion System

**Created:** 2025-12-08 12:59 CET  
**Priority:** 🟢 FUTURE (Complex)  
**Status:** Not Started  
**Blocks:** find-familiar, unseen-servant, tenser's-floating-disk, conjure-animals, etc.

---

## Problem Statement

Spells that create **entities** (familiars, servants, constructs, summoned creatures) have no structured representation. Stats, command economy, special abilities, and persistence rules are all described in prose with no machine-readable contract.

---

## Affected Spells

| Spell | Entity | Key Features |
|-------|--------|--------------|
| `find-familiar` | Familiar spirit | Form options, telepathy 100 ft, touch spell delivery, pocket dimension |
| `unseen-servant` | Invisible force | HP 1, AC 10, Str 2, 30 lb carry, 15 ft speed, command per turn |
| `tenser's-floating-disk` | Force disk | Follows 20 ft behind, 500 lb capacity, hovers 3 ft, won't ascend |
| `conjure-animals` (L3) | Beasts | 8 CR 1/4, or 4 CR 1/2, or 2 CR 1, or 1 CR 2 |
| `animate-dead` (L3) | Undead | Creates skeleton/zombie, requires daily recast for control |

---

## Current State

- All entity details in `description` field
- No structured stat block
- No command economy (who controls, when, action cost)
- No form selection system (familiar forms)
- No special action definitions (touch delivery, senses)

---

## Required Schema Changes

```typescript
// New effect type in spellValidator.ts
{
  type: "SUMMONING",
  summon: z.object({
    entityType: z.enum([
      "familiar",       // Player-controlled, persistent
      "servant",        // Player-controlled, limited duration
      "construct",      // Object/vehicle
      "creature",       // Summoned beast/monster
      "undead"          // Raised dead
    ]),
    
    // Duration and persistence
    duration: DurationSchema,
    persistent: z.boolean().optional(),   // Survives rest? (familiar = true)
    dismissAction: z.enum(["action", "bonus_action", "free"]).optional(),
    
    // Stat block (optional for constructs)
    statBlock: z.object({
      hp: z.number().optional(),
      ac: z.number().optional(),
      speed: z.number().optional(),
      flySpeed: z.number().optional(),
      swimSpeed: z.number().optional(),
      abilities: z.object({
        str: z.number(),
        dex: z.number(),
        con: z.number(),
        int: z.number(),
        wis: z.number(),
        cha: z.number()
      }).optional(),
      senses: z.array(z.string()).optional(),  // ["darkvision 60 ft"]
      skills: z.record(z.number()).optional()  // { "perception": 3 }
    }).optional(),
    
    // Form options (familiar)
    formOptions: z.array(z.string()).optional(),  // ["Bat", "Cat", "Hawk", ...]
    
    // Capacity (disk, servant)
    carryCapacity: z.number().optional(),         // In pounds
    
    // Command economy
    commandCost: z.enum(["action", "bonus_action", "free", "none"]).optional(),
    commandsPerTurn: z.number().optional(),
    
    // Special abilities
    specialActions: z.array(z.object({
      name: z.string(),
      description: z.string(),
      cost: z.enum(["action", "bonus_action", "reaction"]).optional()
    })).optional(),
    
    // Telepathy/senses
    telepathyRange: z.number().optional(),        // In feet
    sharedSenses: z.boolean().optional(),         // Can see through its eyes
    sharedSensesCost: z.enum(["action", "bonus_action"]).optional(),
    
    // Following behavior (disk)
    followDistance: z.number().optional(),        // Feet behind caster
    hoverHeight: z.number().optional(),           // Feet off ground
    terrainRestrictions: z.array(z.string()).optional()  // ["cannot ascend"]
  })
}
```

---

## Implementation Tasks

### Schema Updates
- [ ] Add `SUMMONING` effect type to spell schema
- [ ] Define comprehensive `summon` object schema
- [ ] Handle form selection for familiars
- [ ] Document command economy rules

### Engine Implementation
- [ ] Create `SummonedEntityManager` service
  - [ ] Track all active summons per player
  - [ ] Handle summon creation/dismissal
  - [ ] Manage persistence across rests
- [ ] Implement command economy
  - [ ] Track commands issued per turn
  - [ ] Consume appropriate action cost
  - [ ] Default behavior when no command given
- [ ] Handle familiar special actions
  - [ ] Touch spell delivery (familiar uses reaction)
  - [ ] Shared senses (bonus action to see through eyes)
  - [ ] Pocket dimension (action to dismiss/resummon)
- [ ] Integrate with combat turn system
  - [ ] Summoned creatures act on caster's initiative
  - [ ] Or separate initiative for conjured beasts

### UI Implementation
- [ ] Summon management panel
  - [ ] Show active summons with stats
  - [ ] Command buttons (move, attack, defend, dismiss)
  - [ ] Form selector for familiar summoning
- [ ] Familiar senses toggle
- [ ] Disk inventory management

### Spell Migrations
- [ ] Create full `find-familiar.json` with summon schema
- [ ] Create full `unseen-servant.json` with stat block
- [ ] Create full `tenser's-floating-disk.json` with follow rules
- [ ] Template for `conjure-animals` (creature count by CR)

---

## Test Cases

1. **Familiar creation:** Cast `find-familiar` → choose Owl form → familiar appears with owl stats
2. **Touch delivery:** Cast `cure-wounds` → familiar adjacent to target → spell delivered
3. **Pocket dimension:** Dismiss familiar (action) → resummon later → same familiar returns
4. **Servant command:** Command unseen servant → verify action consumed, task begun
5. **Disk follow:** Move 60 ft → disk follows 20 ft behind at turn end
6. **Disk capacity:** Add 501 lb to disk → verify rejected (over capacity)

---

## Complexity Note

This is a **major system addition** requiring:
- Entity management system
- AI/behavior for summoned creatures
- Significant UI work
- Integration with action economy

**Recommend deferring** until core combat gaps (1–4) are resolved.

---

## Dependencies

- Action economy system (for command costs)
- Entity/creature data structures
- Combat turn system integration

---

## Estimated Effort

- Schema: 2 sessions
- Engine (entity manager): 3 sessions
- AI/behavior: 2 sessions
- UI: 3 sessions
- Migration: 1 session
- **Total: 11+ dev sessions**
