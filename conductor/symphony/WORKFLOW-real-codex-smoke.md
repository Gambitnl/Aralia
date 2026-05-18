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
  interval_ms: 30000

server:
  port: 8093

workspace:
  root: "./.workspaces"

agent:
  max_concurrent_agents: 1
  max_turns: 1
  max_retry_backoff_ms: 60000

codex:
  command: "codex app-server"
  approval_policy: "never"
  thread_sandbox: "workspace-write"
  turn_sandbox_policy: "workspaceWrite"
  turn_timeout_ms: 120000
  read_timeout_ms: 30000
---

# Symphony Smoke Test: {{ issue.identifier }}

You are running inside an isolated smoke-test workspace for Symphony.

Do not modify files outside the current workspace.
Create a short file named `symphony-smoke-result.txt` with one sentence saying the smoke test ran for {{ issue.identifier }}.
Then stop.
