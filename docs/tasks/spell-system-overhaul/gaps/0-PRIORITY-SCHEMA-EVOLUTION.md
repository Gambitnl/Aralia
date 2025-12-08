# Schema Evolution Priority Index

**Created:** 2025-12-08 12:36 CET  
**Updated:** 2025-12-08 12:59 CET  

---

## Overview

This index tracks 7 critical schema gaps identified during the Level 1 and Cantrip spell migrations. Each gap has its own detailed task file with implementation requirements.

---

## Gap Priority Summary

| # | Gap | Priority | Est. Effort | Status | Task File |
|---|-----|----------|-------------|--------|-----------|
| 1 | Per-Hit Damage Riders | 🔴 Critical | 4 sessions | Not Started | [GAP-1-PER-HIT-RIDERS.md](./GAP-1-PER-HIT-RIDERS.md) |
| 2 | Reactive/Event Triggers | 🔴 Critical | 4–5 sessions | Not Started | [GAP-2-REACTIVE-TRIGGERS.md](./GAP-2-REACTIVE-TRIGGERS.md) |
| 3 | Area Entry/Exit Triggers | 🟠 High | 4 sessions | Not Started | [GAP-3-AREA-ENTRY-TRIGGERS.md](./GAP-3-AREA-ENTRY-TRIGGERS.md) |
| 4 | Repeat Saves & Modifiers | 🟠 High | 4 sessions | Not Started | [GAP-4-REPEAT-SAVES.md](./GAP-4-REPEAT-SAVES.md) |
| 5 | Creature Type Filtering | 🟡 Medium | 2.5 sessions | Not Started | [GAP-5-CREATURE-TYPE-FILTERS.md](./GAP-5-CREATURE-TYPE-FILTERS.md) |
| 6 | Summoning & Minion System | 🟢 Future | 11+ sessions | Not Started | [GAP-6-SUMMONING-SYSTEM.md](./GAP-6-SUMMONING-SYSTEM.md) |
| 7 | Defensive AC Mechanics | 🟡 Medium | 3 sessions | Not Started | [GAP-7-AC-MECHANICS.md](./GAP-7-AC-MECHANICS.md) |

---

## Implementation Roadmap

### Phase 1: Attack & Event Triggers (Gaps 1 + 2)
**Unblocks:** All smites, marks, booming-blade, sanctuary, witch-bolt  
**Shared Work:** AttackEventEmitter serves both gaps

### Phase 2: Area & Save Mechanics (Gaps 3 + 4)
**Unblocks:** Zone spells, laughter/hold effects  
**Shared Work:** Turn-phase hooks

### Phase 3: Filters & Defenses (Gaps 5 + 7)
**Unblocks:** Type-conditional effects, AC spells  
**Minimal Dependencies:** Can be done in parallel with earlier phases

### Phase 4: Summoning System (Gap 6)
**Unblocks:** Familiar, servant, disk, higher-level summons  
**Note:** Major feature, defer until core gaps resolved

---

## Spells Blocked by Gaps

### 🔴 Critical (Gaps 1 + 2)
- `divine-favor`, `hex`, `hunter's-mark`
- `searing-smite`, `thunderous-smite`, `wrathful-smite`
- `hail-of-thorns`, `booming-blade`, `compelled-duel`
- `sanctuary`, `witch-bolt`

### 🟠 High (Gaps 3 + 4)
- `create-bonfire`, `grease`, `fog-cloud`, `entangle`
- `tasha's-hideous-laughter`, `ensnaring-strike`
- Many Level 2+ concentration spells

### 🟡 Medium (Gaps 5 + 7)
- `chill-touch`, `protection-from-evil-and-good`
- `mage-armor`, `shield`, `shield-of-faith`

### 🟢 Future (Gap 6)
- `find-familiar`, `unseen-servant`, `tenser's-floating-disk`
- All conjuration/summoning spells
