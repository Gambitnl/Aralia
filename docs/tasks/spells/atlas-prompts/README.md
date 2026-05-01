# Atlas dispatch prompts

This folder holds **per-bucket dispatch wrappers** for the spell-bucket
agents. Each file is a short self-contained handoff that:

1. Identifies the bucket the agent is assigned to.
2. Carries the bucket's metadata (kind, gates, tracker doc path).
3. Notes whether this agent is a first-timer or returning from a
   previous round.
4. Points at the round's main prompt (`ATLAS_AGENT_PROMPT_V<N>.md`).

The dispatch wrapper exists so that an agent receiving the file has
zero additional context needs - they can hand it off to their work
session and start reading immediately, without needing chat-history
context to know which bucket they own.

## When to create a dispatch

Create one when:

- A bucket is being assigned to a brand-new agent (no prior session
  history). E.g. the V2 round had three buckets (`Components`,
  `Attack-Roll Riders`, `Structured Markdown`) that didn't file a
  report; for V3 those buckets need fresh agents who don't share
  conversation context with the orchestrator.
- A returning agent's session was lost and they need to be re-spun-up
  from scratch.

You don't need a dispatch for buckets where the agent's existing
conversation history already supplies the bucket identity. The
top-level `ATLAS_AGENT_PROMPT_V<N>.md` is sufficient in that case.

## Folder layout

```
atlas-prompts/
  README.md                       <- this file
  <bucket-slug>-v<N>.md           <- one dispatch per bucket per round
  ...
```

Slug rules match `atlas-reports/`: lowercase, spaces and slashes become
hyphens. Examples: `components-v3.md`, `attack-roll-riders-v3.md`,
`structured-markdown-v3.md`.

## File contents

Each dispatch file should:

- Start with a one-line bucket assignment.
- Include a small metadata table (kind / gates / tracker doc / current
  `lastUpdated`).
- **Carry a "Background - the task behind the task" section** giving a
  fresh agent the strategic context that returning agents have
  implicitly: what the spell pipeline is, what the bucket "kinds" are,
  what the Atlas + dispatch loop is *for*, and what THIS specific
  bucket's role is in the larger pipeline. Without this, a fresh agent
  reading only the procedural V3 prompt may correctly fill in fields
  without understanding why - which is how papered-over modeling
  decisions creep in.
- Note whether this is a first-time engagement or a re-verification.
- Link to the round's main prompt (e.g. `ATLAS_AGENT_PROMPT_V3.md`)
  and explicitly call out the section the agent should pay extra
  attention to.
- Specify the report file path (e.g.
  `atlas-reports/<bucket-slug>/v3.md`).

Returning-agent dispatches can skip the background (their conversation
history already supplies it). First-time dispatches should always
include it.
