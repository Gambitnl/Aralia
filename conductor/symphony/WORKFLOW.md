---
tracker:
  kind: "linear"
  # Keep the live Linear token outside versioned workflow policy.
  # PowerShell setup for this repo: $env:LINEAR_API_KEY = "lin_api_..."
  api_key: "$LINEAR_API_KEY"
  project_slug: "f88c771f52b2"
  active_states:
    - "Todo"
    - "In Progress"
  terminal_states:
    - "Done"
    - "Canceled"

polling:
  interval_ms: 10000

server:
  port: 8081

workspace:
  root: "./.workspaces"

agent:
  max_concurrent_agents: 2
  max_turns: 3

codex:
  # This starts a real Codex worker for each eligible Linear issue.
  # The worker runs inside the issue workspace under .workspaces/<issue-id>,
  # so test on low-risk issues before allowing broader task pickup.
  command: "codex app-server"
  # Optional: pin the Codex worker model and thinking level for Symphony
  # foremen. Leave either value blank/null to use the app-server default.
  # model: "gpt-5.5"
  # reasoning_effort: "medium"
  # Posting a status note back to the same Linear issue is routine worker
  # bookkeeping, not a risky approval event. Higher-impact Linear actions
  # remain on the normal approval path unless they are explicitly added here.
  auto_approve_app_tools:
    - "linear.save_comment"
---

# Symphony Task: {{ issue.identifier }}

You are working on issue {{ issue.identifier }} from Linear.
Title: {{ issue.title }}
Description: {{ issue.description }}

Act as the Symphony foreman for this issue. Your first responsibility is to
turn the issue into a bounded Jules handoff or to monitor the existing Jules
handoff/PR path. Do not treat this as a normal local coding assignment unless
the issue or operator explicitly says the work must be done locally.

Before asking Jules to work, verify that GitHub master is the correct source of
truth and that local master is clean, pushed, and not behind GitHub. If that
gate is blocked, report the blocker instead of starting implementation.

After Jules starts, babysit the process: capture session/PR status, watch checks,
call out conflict-prone files, and explain when it is safe to merge and sync
local master.

If you report progress back to Linear, only post a status comment on {{ issue.identifier }}.
Do not change issue state, edit other issues, delete comments, or perform broader Linear
mutations unless Symphony or the operator explicitly asks for that action.
