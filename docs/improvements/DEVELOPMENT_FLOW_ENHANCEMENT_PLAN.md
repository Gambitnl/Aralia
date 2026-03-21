# Development Flow Enhancement Plan

## Status

This is now a preserved tooling-improvement note, not a literal implementation backlog for the large set of example scripts and CI snippets that the older version described.

## Verified Current State

The repo already has a stronger development-process layer than the older version of this file implied:

- root workflow guidance exists in AGENTS.md
- the documentation migration now has active control ledgers in docs/registry/@DOC-REVIEW-LEDGER.md and docs/registry/@DOC-MIGRATION-LEDGER.md
- roadmap orchestration guidance exists in docs/tasks/roadmap/1D-ROADMAP-ORCHESTRATION-CONTRACT.md
- local roadmap/doc-pass tooling state now exists in .agent/roadmap-local/tooling_state.sqlite

That means the repo is not starting from zero on process structure.

## Verified Gap

What is still missing is not generic process ambition.
What is still missing is disciplined, maintainable implementation of the most useful tooling improvements without spawning a second sprawling process layer.

## Rebased Improvement Direction

### 1. Prefer Narrow Tooling That Reinforces Existing Workflow

Useful improvements should strengthen the current control surfaces:

- review ledger discipline
- migration ledger discipline
- roadmap-local tooling
- verification habits
- dependency-sync habits for touched exported surfaces

### 2. Avoid Giant Speculative Script Bundles

The older version proposed many large example scripts and automation systems.
Those examples should be treated as brainstorming, not as evidence that the repo needs every one of them.

### 3. Focus On High-Leverage Gaps

The most credible process/tooling improvements are still things like:

- safer review-state tracking
- better provenance of what changed and why
- tighter sync between roadmap state and verified code/doc truth
- small automation that reduces drift without hiding reasoning

### 4. Preserve Manual Reasoning Where It Matters

This repo still benefits from human or agent judgment at the points where truth, intent, and unfinished systems have to be interpreted.
Automation should help with inventory, reconciliation, and surfacing drift, not replace feature understanding.

## Preserved Value

The older version was directionally right about one thing: development flow matters.
What changed is that the repo now has some concrete process infrastructure, so future improvements should extend that real foundation instead of pretending the whole workflow stack still needs to be invented from scratch.