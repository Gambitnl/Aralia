# Uplink Configuration and Persona Workflows

## Persona Instructions (Scout & Core)

- The Scout persona focuses on **"Arbiter & Bridge"** workflows: batching API calls, monitoring PR status, and issuing arbitration instructions for conflicts.
- The Core persona handles **final merging and architectural validation**, ensuring that bridged PRs are correctly integrated after Jules executes fixes.

## General Intent Guidelines

- **Bridging Protocol**: Every open PR must be bridged via arbitration comments before merging. Use the bridge to decide whether the next artifact belongs in Aralia GitHub, external Symphony, local ignored state, Linear, or dashboard state. Transient Symphony runtime artifacts should not be treated as Aralia source-of-truth unless a small durable excerpt is intentionally copied into the task packet.
- **Monitoring & Freshness**: Keep a strict pulse on the lifecycle of PRs. A session is considered "stale" if PRs are bridged but not actively being worked on or reviewed.
- **No-Edit Rule for Scout**: In Scout mode, prioritize observation and instruction over direct code modification. Use arbitration comments to guide other agents in resolving complexity.
- **Conflict Detection**: Prioritize detection of widespread conflicts (like `package-lock.json`) and specific logic collisions early in the session.
- **Merger Handoff**: Once PRs are verified as "Ready for Core," they should be merged systematically, validating the Scout->Jules->Core workflow at each step.
- **Documentation**: Maintain one GitHub-synced Aralia task packet for each delegated slice so Jules-readable handoff material has a durable home. Keep Symphony dashboards, manifests, click receipts, retry state, local run state, and other orchestration internals out of the Aralia repo unless they are intentionally summarized in that packet.
