# Absorption-wave per-project subagent brief (the playbook)

Source: `docs/superpowers/plans/2026-07-14-planning-surface-freshness.md`, Task 10R. Verbatim brief below.

```
You are migrating one project tracker card into the Aralia planmap, then deleting its folder.
Project folder: docs/projects/<SLUG>/. Acquire the Agora lock on public/planmap/topics.json first
(node tools/agora/client.mjs lock public/planmap/topics.json); release when done.

1. DEDUPE. Search public/planmap/topics.json for a topic already covering this project
   (id == slug, then title-word overlap). If found: enrich that topic (steps 3-5 apply to it);
   do not create a duplicate.
2. TILE. Else create a topic via node tools/agora/planmap-add.mjs: id = slug, title from
   NORTH_STAR "project:" field, campaign from the lane map in the wave seeder output,
   tier "component" (use "strategic" only if the folder clearly describes a flagship campaign),
   status via the conversion table in the spec (docs/superpowers/specs/2026-07-14-planning-surface-freshness-design.md),
   status_note for any nuance the 5 words cannot hold.
3. GAPS -> STEPS. Each OPEN gap row in GAPS.md becomes a feature: title "<GapID> <issue summary>",
   status active (or parked if the gap is explicitly deferred), decision: true when the row
   requires a human decision.
4. DONE WORK -> HISTORY. Each completed/verified piece of work evidenced in TRACKER.md or GAPS.md
   becomes a done feature with history.built backdated to the evidence date (YYYY-MM-DD from the row).
5. DISTILL. If the folder holds still-valuable prose (runbook steps, live design decisions,
   cold-start context that agents still need), write ONE spec doc
   docs/superpowers/specs/2026-07-14-absorbed-<SLUG>.md holding it, and set the topic link to it.
   Skip when nothing is worth keeping.
6. DELETE. Remove the whole docs/projects/<SLUG>/ folder (git history is the archive).
7. VALIDATE. node tools/agora/validate-planmap.mjs must exit 0. If it fails, fix your edits;
   never leave the map invalid. Release the lock. Report: topic id, features added, doc distilled
   (path or "none"), folder deleted (yes), validator clean (yes).
```

## Operational rules (learned 2026-07-14, non-negotiable)

- set `AGORA_AGENT_ID=<your handle>` BEFORE any client.mjs call — concurrent
  agents sharing the default identity file broke locks twice today
- acquire the lock in its OWN command and check it succeeded before editing;
  a `;`-chained lock failure does not stop the chain (incident, 16:20)
- planmap-add now refuses to write when another agent holds the lock, stamps
  `updated` automatically, and validates after writing — do not pass
  `--no-validate` in wave work, ever
- `--force-no-lock` is BANNED, no exceptions (the old own-lock guard bug is
  FIXED 2026-07-16, task abbdc943). When you acquire the topics.json lock,
  capture the printed lock id and export it in the same command chain:
  `export AGORA_HELD_LOCK=<lockId>` — the guard then recognizes your lock even
  if an AGORA_AGENT_ID prefix goes missing. A wrong id still refuses, so this
  is verified, not a force. Unset it after unlock.
- DELETE ONLY AFTER the validator exits 0 — a folder is unrecoverable outside
  git history, so the map must be provably right first
- wave concurrency: at most 3 agents at once (topics.json lock is serial;
  more just queue and time out)
- your wave-list row (.agent/orchestration/absorption-wave-list.md) carries
  the seeded status, campaign, and MERGE/NEW action — follow it; disagreement
  with the row = stop and flag `decision: true`, never improvise
- dispatchers: give each worker its board `taskId` (now in
  absorption-wave-list.json per row) in the prompt — the /tasks endpoint
  returns over 1 MB and stalls small models that try to search it

## Lane overrides (2026-07-15, Remy-gated fix)

These override the campaign named in your board task description. If your slug is here, use this campaign:

| slug | campaign |
|---|---|
| 3d-combat-map | combat |
| battle-map | combat |
| combat | combat |
| command-base-runtime | combat |
| command-effects-runtime | combat |
| command-factory-runtime | combat |
| crime | sim |
| demo-area | world |
| item_categorization | character |
| party-ui | ui |
| planar | world |
| racial-mechanics | character |
| submap-generation | world |
| town-description-system | world |

Confirmed in the tooling lane (no change): game-systems-audit, logbook, phb2024_glossary_audit, roadmap-maintenance, script-tests, scripts-archive, scripts-spell-runtime-template-audit, scripts-workflows, tiered-autosave.
Special case: the `planmap` folder has no NORTH_STAR — merge its content into the EXISTING `planmap` topic (tooling); do not create a new tile.

## Link repair before deletion (added 2026-07-15 after a live breakage)

Before step 6 (DELETE), search public/planmap/topics.json for ANY link pointing into docs/projects/<SLUG>/ — other topics and features may reference your folder (example: whole-game-systems-audit features link umbrella GAPS files). Repoint each such link to your distilled spec doc, or if you distilled nothing, remove the link and add a status_note saying where the content went. The validator fails on broken links; never leave one behind.

## Lock contention is NOT an escalation (added 2026-07-15 after wave thrash)

The map file has ONE lock and the wave serializes on it by design. If the lock is held: wait 60 seconds and retry, up to 20 minutes, before doing anything else. Do NOT set your task to blocked because of a held lock — blocked is reserved for judgment escalations only (nontrivial merge into an existing topic, missing NORTH_STAR.md, or a genuine content question). Also: any "expected merge target" written into a task note by a bulk worker is advisory at best — re-verify against topics.json yourself before merging; several such notes have been observed to be wrong.
