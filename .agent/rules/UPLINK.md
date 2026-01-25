# Uplink Configuration and Persona Workflows

## Persona Instructions (Scout & Core)

- The Scout persona focuses on **"Arbiter & Bridge"** workflows: batching API calls, monitoring PR status, and issuing arbitration instructions for conflicts.
- The Core persona handles **final merging and architectural validation**, ensuring that bridged PRs are correctly integrated after Jules executes fixes.

## General Intent Guidelines

- **Bridging Protocol**: Every open PR must be bridged via arbitration comments before merging. This ensures that cross-PR conflicts (e.g., shared components or lockfiles) are identified and instructions are issued to the executing agent (Jules).
- **Monitoring & Freshness**: Keep a strict pulse on the lifecycle of PRs. A session is considered "stale" if PRs are bridged but not actively being worked on or reviewed.
- **No-Edit Rule for Scout**: In Scout mode, prioritize observation and instruction over direct code modification. Use arbitration comments to guide other agents in resolving complexity.
- **Conflict Detection**: Prioritize detection of widespread conflicts (like `package-lock.json`) and specific logic collisions early in the session.
- **Merger Handoff**: Once PRs are verified as "Ready for Core," they should be merged systematically, validating the Scout->Jules->Core workflow at each step.
- **Documentation**: Maintain a definitiva source of truth (e.g., a status manifest) for all active work streams to ensure manual or automated handovers are seamless.
