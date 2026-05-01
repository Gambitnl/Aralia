# Atlas agent reports

This folder collects the per-round bucket-agent reports written in
response to `docs/tasks/spells/ATLAS_AGENT_PROMPT_V2.md` (and successor
prompts). Each report is one bucket-agent's answer to one round of
dispatch.

## Folder layout

```
atlas-reports/
  <bucket-slug>/
    v2.md            <- first V2 report for this bucket
    v2-2.md          <- second V2 report (if the agent re-submits before the round closes)
    v3.md            <- after the next round of dispatches goes out
    ...
```

One folder per bucket. One file per submission. Versions track the
dispatch round (`v2` = the V2 prompt, etc.), not edit count.

## Bucket-slug table

Buckets are slugged consistently so agents never have to guess. Lowercase;
spaces and slashes become hyphens.

| `BUCKET_META.bucket` | folder slug |
| --- | --- |
| `Classes` | `classes` |
| `Sub-Classes` | `sub-classes` |
| `Casting Time` | `casting-time` |
| `Range/Area` | `range-area` |
| `Components` | `components` |
| `Material Component` | `material-component` |
| `Duration` | `duration` |
| `Description` | `description` |
| `Higher Levels` | `higher-levels` |
| `School` | `school` |
| `Damage Type` | `damage-type` |
| `Attack-Roll Riders` | `attack-roll-riders` |
| `Conditions` | `conditions` |
| `Summoned Entities` | `summoned-entities` |
| `Structured Markdown` | `structured-markdown` |

If a new bucket appears in `BUCKET_META`, add it to this table when its
first report lands.

## File contents

Each report follows the §1-§5 template defined in the **"How to report
back"** section of `ATLAS_AGENT_PROMPT_V2.md`. Don't deviate from the
template - the orchestrator reads reports side-by-side and missing
sections look like skipped checks.

If a section genuinely doesn't apply (e.g. bucket has no edge cases),
write `N/A - <one-clause reason>` rather than deleting the row.

## What happens to these files

- **During a round**: the orchestrator collects them, spot-checks
  against the live Atlas, and uses §3 (gaps reported) + §4 (doc / UI
  friction) + §5 (ready / not-ready) to decide whether the model needs
  another iteration.
- **After a round**: the next prompt (e.g. V3) summarizes the changes
  made in response and asks each agent to re-verify. Old reports stay
  here as the audit trail - a V3 report sits next to its V2 predecessor
  so we can see what changed.
- **Long-term**: nothing gets deleted. The folder is the durable
  history of how each bucket converged on the model.
