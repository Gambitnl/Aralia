---
description: View status of all tracks or a specific track
---

# Track Status Workflow

Display the current state of development tracks.

---

## Usage

- `/track-status` — Show all tracks
- `/track-status <track-id>` — Show details for a specific track

---

## Steps

### For All Tracks

1. Read `.agent/conductor/tracks.md`
2. Display as a formatted table:

```
# Track Status

| ID | Title | Status | Progress | Updated |
|----|-------|--------|----------|---------|
| feature-20260129-141600 | Dark Mode | 🟢 In Progress | 4/7 | Jan 29 |
| bug-20260128-093000 | Login fix | ✅ Complete | 3/3 | Jan 28 |
```

3. Show summary:
   - Total tracks
   - In progress
   - Complete
   - Blocked

### For Specific Track

1. Read `.agent/conductor/tracks/<track-id>/metadata.json`
2. Read `.agent/conductor/tracks/<track-id>/plan.md`
3. Display:

```
# Track: Dark Mode Toggle

**ID**: feature-20260129-141600
**Status**: 🟢 In Progress
**Created**: Jan 29, 2026

## Progress

### Phase 1: Setup ✅
- [x] Create theme context
- [x] Add toggle component

### Phase 2: Implementation 🟡
- [x] Implement dark theme CSS
- [~] Connect to user preferences
- [ ] Add transition animations

### Phase 3: Polish
- [ ] Keyboard shortcut
- [ ] Remember preference

**Overall**: 4/7 tasks (57%)
```

---

## Status Icons

| Icon | Status |
|------|--------|
| 🔵 | Planning |
| 🟢 | In Progress |
| 🟡 | Paused |
| 🔴 | Blocked |
| ✅ | Complete |
