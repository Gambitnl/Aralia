# Jules spell icons — design

Date: 2026-07-13
Status: draft for review

## Goal

Fill the design preview's Spell Icons section with custom, school-colored magical
SVGs, one set per spell. Jules makes the art. Nothing touches the live game yet.
You review the options in the preview and pick your favorites. A later pass promotes
the chosen icons into the game.

## Scope

- Spells first. 483 spells live in `public/data/spells/` (levels 0 to 9).
- The target is the Spell Icons section at `misc/design.html?step=icons`.
- Racial traits and class abilities come later. They reuse the same machinery and
  get their own preview sections.

## What Jules makes per spell

For every spell, Jules makes nine SVGs: three different concepts, and three versions
of each concept.

- Concept: a distinct way to depict the spell. The three concepts must look clearly
  different from each other, so you have real choices.
- Version: a draft and two rounds of improvement. For each concept, Jules drafts
  version 1, improves it into version 2, then improves it once more into version 3.

So each spell gets 3 concepts times 3 versions, which is 9 SVGs. You see all nine
grouped by spell, judge the concepts and how each one improved, and pick one.

Jules's method, per spell:

1. read the spell's name, school, and description from its JSON file
2. think of the concept and how to show it in an SVG
3. draft version 1
4. improve it into version 2
5. improve it once more into version 3
6. repeat steps 2 to 5 for a second and third distinct concept

## Icon style

- Canvas: `viewBox="0 0 100 100"`. This matches the hand-made Fire Bolt reference
  already in the preview and gives room for a rich look.
- Look: radial gradients, a soft glow filter, and an arcane-circle feel, like the
  Fire Bolt reference at `PreviewIcons.tsx` around line 828.
- Colour: each spell's dominant colour follows its school (see the colour map).
- Hardcoded hex colours, not `currentColor`.
- Well-formed, self-contained `<svg>` — no external files, no scripts.

## School colour map

Formalised from the scheme already in the preview code
(`PreviewIcons.tsx` around line 894). You approve this before the run.

| School | Dominant hue | Hex |
|---|---|---|
| Evocation | red | #F87171 |
| Abjuration | blue | #60A5FA |
| Divination | teal | #2DD4BF |
| Conjuration | indigo | #818CF8 |
| Illusion | purple | #C084FC |
| Transmutation | amber | #FBBF24 |
| Necromancy | emerald | #34D399 |
| (no school) | slate | #94A3B8 |

Jules uses the school hue as the main colour and shades it with darker and lighter
tones for depth.

## Where the files land

One folder per spell, nine files inside:

```
public/assets/icons/spells/{spell-id}/c1-v1.svg
public/assets/icons/spells/{spell-id}/c1-v2.svg
public/assets/icons/spells/{spell-id}/c1-v3.svg
public/assets/icons/spells/{spell-id}/c2-v1.svg
...
public/assets/icons/spells/{spell-id}/c3-v3.svg
```

`c` is the concept number (1 to 3). `v` is the version (1 to 3). The spell id is the
`id` field from the spell JSON, for example `fire-bolt`.

## Preview changes I build

In the Spell Icons section, each spell gets a panel that shows its nine SVGs, laid
out as a 3 by 3 grid: three concept columns, three version rows. Missing files leave
a blank slot, so the grid fills in as Jules delivers.

- The panel loads each of the nine files by path. A missing file shows a placeholder.
- You click a concept-version to mark it as the winner for that spell.
- Your picks save to `public/data/spell-icon-picks.json`, so they survive a reload
  and can drive a later promotion pass.
- The coverage tracker at the top counts spells that have all nine SVGs, and spells
  with a pick.

This only changes the design preview. The live game is untouched.

## Delivery without a pull request

Jules runs on Google's servers and sends work back through GitHub. Its REST API has a
default mode that makes no pull request. We use that mode.

- Each batch is one Jules session. The session pushes its SVGs to its own branch.
- A local command fetches those branches and copies the SVGs into
  `public/assets/icons/spells/`.
- You never open or review a pull request.
- My working copy stays on master. I only fetch and copy files. I never switch
  branches.

Retrieval detail to confirm during the plan: the exact way to read a session's
output branch from the API. Fallback, for retrieval only: create the session with a
pull request, then fetch its head branch by script without you reviewing it.

## Batching and limits

You are on Google AI Pro, which gives Jules in Pro: 15 tasks at once, 100 tasks a day.

- Each Jules agent handles about 10 spells. That is 90 SVGs per agent.
- 15 agents at once cover 150 spells per wave.
- 483 spells take about four waves. Well within 100 tasks a day.

## The Jules prompt

I write one prompt template, reused for every batch. It states:

- the method above (3 concepts, each drafted then improved twice)
- the style rules (100 by 100, gradients, glow, school colour, hardcoded hex)
- the exact output paths, and the rule to write only SVG files in the spell's icon
  folder — no code edits, no other files
- the list of spell ids and JSON paths for that batch

## What I build

- the list of all spell ids, split into batches
- the Jules prompt template
- the batch script that creates the Jules sessions through the API
- the fetch-and-copy command that pulls SVGs from the Jules branches
- the preview panel that shows the nine SVGs per spell and records your pick
- the colour map

## What you provide

- a Jules API key, made in Jules Settings (I cannot make it)
- you paste the key into the operator dashboard's PAT vault
  (`http://127.0.0.1:3040/pat_vault.html`), on the "Jules API key" card. It writes
  to Windows Credential Manager at `AgentMatrix/Jules/JULES_API_KEY`, the same
  style as the Groq key. I never see the value.
- my batch script reads that target at run time through CredRead, and reports only
  its length and that it loaded — never the value. It never lands in a file or in git.

## Verify before the full run

1. Run one batch of about 10 spells.
2. Look at the results in the preview.
3. Check the school colours read right, the three concepts differ, the versions
   improve, and no SVG is broken.
4. Adjust the prompt or colours.
5. Then run the rest.

## Preview filters — BUILT 2026-07-14

All requested filters are live in the Spell Icons panel, and they combine.

- has all 9 icons, partial (1 to 8), no icons yet
- overlapping: spells where 2 or more of the 9 SVGs are byte-identical (Jules
  repeating art instead of making 3 distinct concepts)
- picked / not picked
- by level (cantrip to 9), by class, by school
- plus the original free-text name/school box, and a Reset button

A summary line shows progress across all spells: shown, complete, partial, no icons,
overlapping, picked.

How it works: a new endpoint `GET /api/spell-icon-coverage`
(`scripts/vite-plugins/spellIconPicksManager.ts`) scans the icons folder on disk and
reports, per spell, how many of the 9 exist and which ones share a SHA-1 hash. The
lazy-loading grid cannot know this, so coverage comes from the server, not the DOM.

Verified: complete → 1 (Fire Bolt), none → 472, Necromancy → 36,
Necromancy + cantrip → 4, Wizard → 313.

### Overlap detection is similarity-based, not byte-identity (fixed 2026-07-14)

The first version hashed the files and looked for identical bytes. That test is
useless: the Jules batch scored 0 overlapping while its three "distinct" concepts
shared 88-96% of their markup. Nothing was byte-identical, so nothing was flagged.

Now we measure content similarity (Jaccard over character trigrams of the normalised
markup) and report the two ways a generator fakes the job:

- conceptsSimilar (>= 0.85): the 3 concepts are near-copies — you have 1 idea, not 3
- versionsStagnant (>= 0.93): a version barely changed — the iteration did no work

Both surface as warnings on the spell panel, and drive the overlapping filter.

Proof: re-scored the real Jules batch — 10/10 spells flagged (93-96% concept
similarity), where the old byte-hash flagged 0/10. Fire Bolt, whose 3 concepts are
genuinely different subjects (82%), is correctly NOT flagged.

## Follow-on: racials and abilities

Same machinery. Racial traits and class abilities get their own icon folders, their
own preview sections, and the same 3-concept, 3-version method. We start these once
you are happy with spells.

## Risks and open points

- The Jules API is an alpha release. Specifications may change.
- The exact API call to read a session's output branch needs confirming in the plan.
- Volume: 483 spells times 9 is about 4,347 small SVG files. Fine on disk. The
  preview loads them lazily so it stays responsive.
- Cost and time: four waves of 15 agents, each doing real iterative work, will take
  time and use daily task quota. We pace it across days if needed.
