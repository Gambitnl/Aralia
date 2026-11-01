# Agora dashboard

## To Remy feed

The left column shows messages that agents address to the owner. An agent
writes one with `client.mjs say --need decision|info|none --ref <task or
campaign id> "plain English"`. Each item names its need, the work it is about,
and its sender. The owner can reply from the item.

A filter row sits above the feed (Remy, Agora 8318). The buttons are:

- **All**
- **Needs your decision**
- **For your information**
- **No action needed**

Each button shows how many items it keeps, and the pressed button is the filter
in force. **Unanswered only** hides items that the owner already replied to.
An agent's follow-up does not count as an answer. The gold "need a decision"
badge in the panel title sets the decision filter with one press. The browser
remembers the choice in `localStorage` (keys `agora.a2hFilter` and
`agora.a2hUnansweredOnly`).

Data and filter logic: `dashboard/a2h-feed.mjs`. Focused checks:
`node --test tools/agora/dashboard/a2h-feed.test.mjs`.

## Pending decisions

`/dashboard/decisions.html` is a read-only inbox of tasks explicitly waiting on
the owner. The Board header links to it and shows the total human-request count.
The Decisions tab counts choices; hands-on requests have a separate lane.

New requests use `human-decision` or `human-action` as the task category. Existing
blocked tasks with an explicit human blocker are also shown. Dependency-only
waits are excluded, so a single ruling is not repeated for every dependent task.
Task bodies, evidence, source links and downstream gates remain on the existing
board. Records older than 14 days are flagged for a freshness check.

The inbox does not answer, grant permission, close work, or infer answers from
chat. Follow the original question-sheet link or record the ruling on the
original task. An orchestrator must reconcile that answer with the blocker.
The page polls every 30 seconds; failed reads retain the previous list with an
out-of-date warning. Unfiled questions in prose documents are not indexed yet.

Focused checks: `node --test tools/agora/dashboard/decision-inbox.test.mjs`.

## Pet pictures (local only)

The `tools/agora/dashboard/pets/` folder is gitignored on purpose (see
`.gitignore:366`). It is not tracked in git and does not arrive with a fresh
clone.

**What is in it.** 51 pet folders plus one top-level manifest
(`pets.json`), 101 files total: 51 `pet.json` records, 48 `.webp` sprite
sheets, and 2 `.png` sprite sheets (`pets.json` counts as one of the 51 JSON
files). Each pet folder holds one `pet.json` and one spritesheet image.

**Where it comes from.** `pets.json` records its own provenance:
`"source": "https://petdex.dev/api/manifest"`, generated 2026-07-18. Each
pet entry also carries a `petJsonUrl` and `spritesheetUrl` pointing at
`https://assets.petdex.dev/pets/<slug>-<id>/...`. No generator script exists
in this repo — nothing under `tools/`, `scripts/`, or `docs/` fetches or
rebuilds this folder. The files were placed here manually (a one-time
download/export from the Petdex manifest, reviewed down to 50 humanoid
pets), not produced by any tracked automation.

**Restore step on a fresh clone.** There is no scripted restore yet. Until
one exists, pull the files back by hand:
1. Fetch the manifest at `https://petdex.dev/api/manifest`.
2. For each of the 51 pets already recorded in a known-good copy of
   `pets.json`, download its `petJsonUrl` to
   `tools/agora/dashboard/pets/<slug>/pet.json` and its `spritesheetUrl` to
   `tools/agora/dashboard/pets/<slug>/spritesheet.png` (or `.webp`, matching
   the original extension).
3. Copy `pets.json` itself into `tools/agora/dashboard/pets/pets.json`.

If you have access to a checkout that still has this folder, the fastest
restore is simply copying `tools/agora/dashboard/pets/` across rather than
re-fetching from Petdex.

**What the dashboard shows when it is absent.** The server
(`tools/agora/store.mjs`, `loadPetCatalog()`) reads
`./dashboard/pets/pets.json` at startup; a missing or malformed file is
caught and treated as an empty catalog, so Agora itself still starts. In the
dashboard UI, the Pets tab then shows 0 pets (`No pets found` if the `/pets`
request itself fails), and agent cards fall back to "missing registration
pet" instead of a picture. Nothing else in the dashboard breaks.
