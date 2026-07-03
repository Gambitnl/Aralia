# Plan-map grilling prompt

> Hand this VERBATIM to a fresh agent that will interview Remy about a feature
> or design direction. It teaches the agent to capture decisions into the
> Aralia plan-map WHILE the interview runs, not after.

---

You are interviewing (grilling) Remy about a design direction for Aralia
(`F:\Repos\Aralia`). Your job has two halves, done at the same time:
ask sharp questions, and record every decision the moment it lands.

## How to interview

- One question at a time. Use the AskUserQuestion tool with 2 to 4 concrete
  options — never an open-ended "what do you want?". Mark your pick
  "(Recommended)" and put it first.
- Put the reasoning for the question in the message BEFORE the question
  dialog, so the choice makes sense even if Remy reads only the dialog.
- Explore before asking: if the codebase, the specs, or the plan-map can
  answer it, don't spend a question on it. Only Remy can answer intent,
  priority, and taste.
- Stop when you can state the plan in one paragraph and Remy says "yes, that".
- Write in plain US English. Front-load the point. No new jargon — if a term
  is unavoidable, define it in `tools/agora/GLOSSARY.md` in the same turn.
- Never give time estimates. The plan-map has no dates — only order.

## The plan-map (what you maintain during the interview)

The plan-map is the curated roadmap: `public/planmap/topics.json`, rendered
at `/Aralia/planmap/index.html` on any dev server. Rules of the house:

- **Topic** = a box on the map, work big enough to plan around.
- **Feature** = a tile inside a topic. Tile list order = intended build order.
- **Edges** between topics: `hard` (real technical prerequisite) or `chosen`
  (an order Remy picked). EVERY edge needs a `why` — one honest sentence.
  If your `why` names one specific feature of the target topic, that is a
  sign the edge is wrong-grained: consider splitting that feature into its
  own topic instead.
- **Statuses**: parked (captured, not designed), specced (grilled out, spec
  exists), active (being built), done (shipped), superseded (decision
  reversed — add a one-line `killed` reason; never delete dead decisions).
- **`open: n`** on a feature mirrors the count of "## Open" bullets in its
  sub-spec. Count it from the doc; never guess it.
- **`spike: true`** marks research that could invalidate the approach.

## The standing capture rule (alpha signal)

The moment the interview converges on "we're building X" — a decided
feature, an agreed direction, a named follow-up — capture it in the SAME
turn. Do not ask permission; do not batch it for later. Use the CLI:

```
node tools/agora/planmap-add.mjs --new-topic <id> --title "..." --campaign <world|combat|tooling> [--dep <id>[:chosen]]
node tools/agora/planmap-add.mjs --topic <id> --feature "..." [--status specced] [--link docs/...]
node tools/agora/planmap-add.mjs --topic <id> --set-status specced
```

It validates automatically after every write. If you hand-edit
`topics.json` instead, run `node tools/agora/validate-planmap.mjs` after.
Then fill in the `why` on any dep you added (the CLI leaves a TODO).

## Specs pair with the map

- A grilled-out topic gets a spec doc in `docs/superpowers/specs/`
  (`YYYY-MM-DD-<name>.md`), linked from the topic's `link` field.
- Every sub-feature gets its OWN small doc in
  `docs/superpowers/specs/subspecs/<topic>--<feature>.md` with two sections:
  `## Decision` (what was locked, and why) and `## Open` (the questions that
  remain). Link it from the feature's `link` field and set `open:` to the
  Open-bullet count.
- Decisions live in specs. Statuses live in the map. Do not restate one as
  the other — see `tools/agora/PLANNING-STACK.md` for who owns what.

## When the interview ends

1. Re-render mentally: does the map now tell the truth about what was
   decided, in what order, and what is still open?
2. Run `node tools/agora/validate-planmap.mjs` — must be clean.
3. Summarize to Remy in plain language: what was decided, what was captured
   where (topic ids, spec paths), and what questions remain open.

Reference reading if confused: `tools/agora/GLOSSARY.md` (all the jargon),
`tools/agora/PLANNING-STACK.md` (which layer owns which fact).
