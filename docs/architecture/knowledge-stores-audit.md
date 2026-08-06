# Knowledge stores — audit

Purpose: name every place this project keeps knowledge, say what each one is
for, and record where they overlap or contradict.

This file is living. Update it in place. Do not date a copy of it.

## The six stores

| Store | Size | Shape | Who writes it |
|---|---|---|---|
| Agent memory | 143 files, 301 links | Linked graph | Agents, per session |
| Plan map | 174 topics, 650 features | Tree with status | Agents, per build |
| `docs/` | 1,276 files | Mostly flat | Agents and people |
| Domain docs | 24 files | Living, one per domain | Agents, rarely |
| MemPalace | graph database | Graph | An MCP tool |
| `CONTEXT.md` | 1 file | Glossary | This session |

## What each store is actually for

**Agent memory.** Session-to-session recall for agents. Holds standing
directives, campaign status, and hard-won gotchas. It is already a graph: 143
nodes joined by 301 wiki links across 109 distinct targets.

**Plan map.** What is planned, in progress, and finished. 436 features are
done, 105 active, 68 specced, 39 parked.

**`docs/`.** Everything else. This is the problem store.

**Domain docs.** One file per domain, undated, describing the current shape of
a system and its verified entry points. This is the healthiest structure in the
repository.

**MemPalace.** A graph database reachable over MCP. It carries drift snapshots
going back to 2026-05-20.

**`CONTEXT.md`.** A glossary. Terms only, no implementation and no decisions.

## Findings

### Finding 1 — `docs/` is 40% dead

513 files have not been touched since 2026-06-01. 280 have been touched since
2026-07-01. So roughly two fifths of the tree is cold, and there is no signal
in the file itself that says so.

`docs/spells/` alone holds 536 files, 42% of the whole tree.

### Finding 2 — dated files are the safe default

162 files carry a date in the name. July alone produced 129, about four a day.

This is not laziness. An agent needs somewhere to put a finding, sees six
candidate homes, and has no rule saying which is right. A new dated file is the
only choice that cannot be wrong.

The system rewards a new file over an update. That is the root cause of the
sprawl, and it is a rule problem rather than a discipline problem.

### Finding 3 — memory and the plan map overlap heavily

76 of 144 memory files share a name with a plan-map topic. Over half the memory
store shadows something the plan map already tracks.

Neither is wrong. They hold different facets — the plan map holds status, and
memory holds the reasoning and the gotchas. But no rule states that split, so
both drift toward holding the whole story.

### Finding 4 — the domain docs carry no freshness signal

Zero of the 24 domain docs record when they were last verified. They each claim
"Verified Current Entry Points" and none says current as of when.

A living document with no verification date is a stale document that a reader
trusts. This is the surface-staleness fault named in `CONTEXT.md`, applied to
prose rather than to a preview page.

### Finding 5 — a domain is missing

There is no domain doc for the streamed 3D world.

`world-map.md`, `submap.md`, `town-map.md`, `battle-map.md` and
`environment-physics.md` all exist. Nothing owns terrain, water, vegetation, or
the ground a player walks on.

That gap has a direct cost. A facade audit written on 2026-08-05 had no home,
so it became another dated file. The missing domain manufactured the sprawl it
was documenting.

### Finding 6 — memory link health is good

9 broken wiki links out of 109 targets. 3 files missing from the index.

This store is the healthiest of the six by a wide margin, and it is the only
one with links between its parts.

### Finding 7 — verdicts have almost no home

11 of 650 plan-map features carry a decision field. 87 carry a status note.

So the record of what a person judged and approved sits mostly nowhere. See
`docs/adr/0001-judgment-surfaces-and-recorded-verdicts.md`.

## The contradiction worth naming

Memory says a campaign is live. The plan map says a feature is active. `docs/`
holds a dated report saying the same work is complete.

None of the three is wrong at the moment it was written. Nothing marks which
one is current, so a reader picks whichever they find first.

## What is not wrong

Six stores is not itself a fault. They hold genuinely different things.

The fault is that no rule says which store owns which kind of knowledge. Fix
the rule and the sprawl stops, because a new file stops being the only safe
answer.
