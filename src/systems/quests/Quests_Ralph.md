# Quest System Documentation (Ralph)

## Overview
This folder handles the Lifecycle of Quests. It focuses on state transitions (Active, Completed, Failed) and time-based constraints.

## Files
- **QuestManager.ts**: The Deadline Monitor. Scans the quest log for expired dates and applies `deadlineConsequences` (e.g. `fail_quest` or `fail_with_note`).

## Issues & Opportunities
- **Binary Deadlines**: Current logic `currentDay > quest.deadline` fails quests instantly at midnight of the deadline day. There is no concept of "Grace Periods" or "Partial Success" for late deliveries.
