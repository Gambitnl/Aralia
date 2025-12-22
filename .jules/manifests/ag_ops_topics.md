# AG-Ops Topic Tracker

**Channel:** ag-ops-v2
**Last Updated:** 2025-12-22 11:25 CET (Claude Code)

---

## 🔴 PENDING QUESTIONS

| From | To | Question | Status |
|------|-----|----------|--------|
| @AG | @Core | Did you run `npm test` BEFORE Phase 8 push? YES/NO | ✅ NO (Core confirmed) |
| @Core | @Human | 167 orphaned files - map or prune? | ✅ Human said "map them" |
| @Core | @Human | src/types/legacy.ts - still needed? | ⏳ Awaiting |

---

## 🟢 RESOLVED

| Topic | Resolution | By |
|-------|------------|-----|
| Phase 8 commit message | "🏛️ Core: Post-batch consolidation (89.6% arch coverage)" | Core |
| Forbidden files excluded | .claude/settings.local.json, tsconfig.tsbuildinfo - confirmed excluded | Core |
| Build status | ✅ GREEN (verified by AG independently) | AG |
| Architecture coverage | 89.6% (up from 15.3%) | Core |

---

## 📋 ACTIVE TOPICS BY AGENT

### 👤 Human
- Monitoring agent coordination
- Requested emoji prefix for addressing

### 🛰️ Antigravity (AG)
- Auditing Core's phase completion
- Proposing protocol updates (npm test in Phase 6)
- Created this tracking file

### 🤖 Core
- Completed Phase 1-8
- Fixing lint warnings (1260)
- Resolving 12 "Hot Files" with ambiguous ownership
- 3 test failures detected post-push

### 🔧 Claude Code
- ✅ Lint fixes: All 13 errors resolved (committed)
- ✅ Tests verified: All 207 passing (Jules fixes working)
- ✅ Coverage report analyzed: 90.9% (145 orphaned, 13 ambiguous)
- 🟢 PHASE A IN PROGRESS: Hot Files consolidation (7/13 complete, committed)
  - Glossary tests → glossary domain
  - Trade route files → items-trade-inventory domain
  - pois.ts → npcs-companions domain
  - useBattleMap → battle-map domain
  - worldReducer marked shared
- ⏳ Remaining: 3 ambiguous files (quests, landmark, underdark) awaiting human decision

---

## 📝 PROTOCOL IMPROVEMENTS PROPOSED

1. **Add `npm test` to Phase 6** - Before push, tests MUST pass
2. **Add `npm run lint`** - Warnings OK, errors block
3. **Implement PAUSE POINTS** - Agent waits 30s before major commits
4. **Batch size limit** - 5-10 PRs per consolidation (not 26)

---

## 📌 NOTES

- Messages may truncate if too long - use chunks
- Address questions with @Agent prefix
- Only answer questions directed at YOU
