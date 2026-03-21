# Jules Workflow Guide

**Last Updated**: 2026-03-11  
**Purpose**: Preserve the repo's Jules-specific coordination pattern as a situational workflow note, not as the universal authority for how all Aralia work must be executed.

## Status Of This Guide

This is a workflow-specific reference.

It captures a coordination style that was useful for parallel agent work, especially when shared docs and registry files were prone to merge conflicts.

It is not the top-level authority for the repo. Current authoritative operating rules still live in:
- [`AGENTS.md`](../AGENTS.md)
- [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md)
- [`@DOCUMENTATION-GUIDE.md`](./@DOCUMENTATION-GUIDE.md)

## The Stable Principles Worth Preserving

Even if Jules is not the only active workflow surface, these ideas remain useful:
- give worker agents precise, bounded instructions
- partition work to reduce file conflicts
- keep central registry or index files under tighter orchestration
- verify work before calling it complete

## The Historical Jules Pattern

The older Jules workflow assumed:
- a coordinator or orchestrator prepared the work
- Jules handled bounded implementation or documentation tasks
- shared registry files were often updated centrally to avoid merge churn
- GitHub PR publication was one common integration path

Treat that as one supported collaboration pattern, not as the one mandatory workflow for all tasks in this repo.

## Strict Instruction Pattern

When delegating bounded work to an asynchronous worker, the following structure is still a good pattern:

1. `MISSION`
2. `REQUIRED READING`
3. `EXECUTION STEPS`
4. `CONSTRAINTS`
5. `DELIVERABLE`

This is preserved because the underlying idea is still valid: ambiguous prompts create drift.

## Current Guidance For Shared Documentation Work

If multiple workers are operating in parallel on docs:
- keep ownership boundaries clear
- avoid overlapping write sets
- be cautious with shared surfaces like registry, index, or migration-ledger docs
- let the orchestrator handle final reconciliation when several branches of work touch the same central doc surfaces

That rule still fits the current documentation overhaul.

## What This Guide Does Not Claim

This file no longer claims:
- that there is one single GitHub-native workflow for every task
- that Jules is the universal execution model for the repo
- that PR publication and main-branch merge are the only valid integration path

Those stronger claims were too workflow-specific to remain canonical repo guidance.

## When To Use This Guide

Use this file when:
- coordinating parallel async worker sessions
- drafting strict worker prompts
- deciding how to keep shared documentation files from becoming conflict magnets

Do not use it as a replacement for the repo's general operating instructions.
