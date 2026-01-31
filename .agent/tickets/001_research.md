---
id: 001_research
title: Audit System Tools & Scripts
status: Done
priority: High
project: Aralia
created: 2026-01-29
updated: 2026-01-29
links:
  - url: ./parent.md
    title: Parent Ticket
labels: [research, audit]
assignee: Pickle Rick
---

# Description

## Problem to solve
We don't know exactly which tools exist to be indexed.

## Solution
Scan `scripts/`, `.agent/workflows/`, and `package.json`. Produce a JSON list of tools with:
- Name
- Path/Command
- Description
- Category (Setup, Debug, Agent, etc.)
