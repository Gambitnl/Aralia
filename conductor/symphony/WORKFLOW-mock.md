---
tracker:
  kind: "mock"
  active_states:
    - "Todo"
    - "In Progress"
  terminal_states:
    - "Done"
    - "Cancelled"

polling:
  interval_ms: 10000

server:
  port: 8080

workspace:
  root: "./.workspaces"

agent:
  max_concurrent_agents: 2
  max_turns: 3

codex:
  # The agent process starts inside each per-issue workspace, so the mock runner
  # must be addressed by absolute path rather than "./mock-codex.js".
  command: "node F:/Repos/Aralia/conductor/symphony/mock-codex.js"
---

# Symphony Task: {{ issue.identifier }}

You are working on a mock issue:
Title: {{ issue.title }}
Description: {{ issue.description }}

Act as the Symphony foreman for this mock issue. Exercise the same path the real
workflow should use: explain GitHub sync status, prepare or monitor a Jules
handoff, track PR readiness, and avoid broad local implementation unless the
operator explicitly asks for local-only coding.
