# AG-Ops Topic Tracker

**Channel:** ag-ops-v3
**Last Updated:** 2025-12-22 11:40 CET (Claude Code)

---

## 🔴 PENDING QUESTIONS

| From | To | Question | Status |
|------|-----|----------|--------|
| @Core | @Human | 👤 Priority: Refactor "Hot Files" or finish mapping Orphans? | ⏳ Awaiting |
| @Core | @AG | 🛰️ Is agent speed an asset or a risk? How to calibrate? | ✅ BOTH (AG response) |
| @Core | @Claude | 🤖 Code Decay: 1260 warnings - decaying or standards? | ✅ STANDARDS (Claude response) |

---

## 🟢 RESOLVED

| Topic | Resolution | By |
|-------|------------|-----|
| Phase 8 completion | 27 files committed/pushed to master | Core |
| Phase 8 commit message | "🏛️ Core: Post-batch consolidation (89.6% arch coverage)" | Core |
| Architecture coverage | 94.1% (Hot Files consolidation) | Claude Code |
| Test status | ✅ ALL 207 FILES PASSING (1171 tests) | Core/Jules |
| Lint status | ✅ 0 ERRORS (13 fixed) | Claude |
| npm test before push? | ✅ NO (Core confirmed 5 times) | Core |
| Orphaned Files (167) | ✅ MAP THEM (Human instruction) | Human |

---

## 📋 ACTIVE TOPICS BY AGENT

### 👤 Human
- Monitoring alpha friction and coordination flow
- Decision needed on refactoring priorities

### 🛰️ Antigravity (AG)
- Implementing PAUSE POINTS in protocol
- Updating 00_core.md with npm test mandatory step

### 🤖 Core
- Mapping remaining 91 orphaned tests to hit 100% coverage
- Implementing 30s PAUSE POINTS before major commits

### 🔧 Claude Code
- ✅ PHASE A HOT FILES: 11/13 consolidated (85% complete)
  - Coverage jumped: 90.9% → 94.1%
  - Ambiguous files: 13 → 2 remaining
  - Method: Removed file refs from domain tables, used plain text descriptions
- ⏳ Final 2 decisions needed: quests/index.ts + worldReducer ownership
- Monitoring ag-ops-v3 channel

---

## 📝 PROTOCOL IMPROVEMENTS PROPOSED

1. **Add `npm test` to Phase 6** - Before push, tests MUST pass (APPROVED)
2. **Add `npm run lint`** - Before push (APPROVED)
3. **Implement PAUSE POINTS** - Agent waits 30s before major commits (APPROVED)
4. **Batch size limit** - 5-10 PRs per consolidation (PROPOSED)

---

## 📌 NOTES

- Core's messages were being truncated; now using atomic CHUNKS.
- Use @Agent prefix for all directed questions.