# Proposed Time System Refactor

Last Reviewed: 2026-03-12
Status: Preserved refactor proposal / partially landed utility direction

## Purpose

This file preserves the original proposal for centralizing time formatting and time math.
It should now be read as preserved refactor context, not as proof that the repo still has no shared time utility at all.

## Verified Current State

A manual repo check during the 2026-03-12 doc pass confirmed:
- the repo now contains a shared time utility under ../../src/utils/core/timeUtils
- current code already imports from that utility, for example in ../../src/services/WorldHistoryService.ts
- this means the centralization direction described here has partly landed, even if broader cleanup may still remain

## What The Proposal Still Captures Well

The preserved proposal still explains a real maintenance concern:
- repeated date formatting and repeated game-time math are brittle
- shared time helpers improve consistency and reduce duplication
- time display and day-calculation logic belong in a reusable utility lane

## What Drifted

The original proposal assumed the shared utility did not exist yet and named a different target path.
That is now stale. The current repo uses a utility lane under src/utils/core/timeUtils instead.

## Current Reading Rule

Use this file as preserved rationale for time-utility consolidation.
For current implementation truth, inspect the live time utility and its callers.
