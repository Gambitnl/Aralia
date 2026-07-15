# AI Studio app-build prompt — spell-icon SVG forge

Paste the block below into AI Studio's **Build** mode. It describes an app to build,
not a single icon to draw. Everything after it is context for us, not for the model.

---

## The prompt

```
Build a web app called SPELL ICON FORGE.

WHAT IT IS FOR

I am building a dark-fantasy tabletop RPG. It has 473 spells, and every spell needs
an icon. Commissioning or hand-drawing 473 icons is not realistic, and picking a
single AI-generated icon sight-unseen is a bad bet — the first thing a model draws is
rarely the best thing it can draw.

So this app is not an icon generator. It is a CHOICE generator. Its job is to sit a
human designer in front of several genuinely different takes on the same spell, let
them watch each take get better, and let them pick the winner. The app's value is the
quality of the choice it presents, not the quantity of images it makes.

The output is SVG, because these icons must scale cleanly and stay tiny.

THE PROBLEM IT MUST SOLVE

I have already tried this with a coding agent and it failed in a specific, instructive
way. Asked for "three distinct concepts, each iterated three times", it produced nine
images per spell that were 88-96% identical to each other: one template — a dark
circle with a runic ring — with a slightly different little glyph dropped in the
middle each time. And each "improvement" changed almost nothing.

That is the natural failure mode of a language model asked to be creative in bulk. It
finds one safe composition and re-skins it. The whole point of this app is to fight
that. Two mechanisms:

1. FORCED DIVERGENCE. When the app asks for concept 2, it must show the model what
   concept 1 already was and require something fundamentally different — a different
   subject, a different composition, a different framing. Not the same picture with a
   new centrepiece. Concept 3 must diverge from both 1 and 2.

2. TRUE ITERATION. An improvement pass must be given the actual previous SVG and told
   to make THAT drawing better — not asked to draw the same idea again from scratch.
   The model should see its own work and build on it. If a version comes back nearly
   identical to its parent, the iteration did nothing and the app should say so.

WHAT THE APP DOES

The user gives it a spell: a name, a magic school, and the rules text describing what
the spell actually does.

The app then produces a small grid of candidates: a few genuinely different concepts
across, and a few rounds of refinement down. The user sees the whole grid at once,
compares, and clicks the one they want. They can regenerate any single cell they
dislike without redoing the rest, and re-roll a whole concept if it is a dud.

They can then export their chosen icon — and ideally the whole grid — as SVG files.

HOW TO BUILD IT

- Use the Gemini API to generate the SVG markup directly. The model writes SVG source,
  the app renders it. Prefer a fast model; let me switch models from the UI.
- Make each cell its own generation call, so one bad result never poisons the others
  and any single cell can be retried in isolation.
- Show progress as it goes. Generating a full grid takes a while and the user should
  watch it fill in, not stare at a spinner.
- Handle failure honestly: models return malformed SVG, hit rate limits, and return
  503 under load. Retry transient errors with backoff, and if a cell truly fails, show
  it as failed rather than silently leaving a hole.
- Guard the output: only accept a well-formed, self-contained <svg>. Reject anything
  with scripts, external references, or remote fonts. Strip markdown fences the model
  wraps around its answer.
- Give me a way to tell whether it actually worked: surface how similar the concepts
  are to one another, and how much each iteration really changed. If the app is
  producing one idea three times, I want it to tell me, not hide it.

HOUSE STYLE (bake these in as defaults, but let me edit them)

- Canvas: viewBox "0 0 100 100".
- Every icon's dominant colour comes from the spell's school:
    Evocation #F87171, Abjuration #60A5FA, Conjuration #818CF8, Divination #2DD4BF,
    Enchantment #F0ABFC, Illusion #C084FC, Necromancy #34D399, Transmutation #FBBF24,
    no school #94A3B8.
  Shaded darker and lighter for depth. Hardcoded hex, never currentColor.
- Rich but readable: gradients and a soft glow are welcome; the silhouette must still
  read at 64px. An icon that turns to mush when small has failed.
- The icon should depict what the spell DOES — the effect, the thing it summons, the
  moment it lands, its aftermath. Not a generic rune standing in for meaning.
- Downloads should be named so the concept and the iteration round are obvious from
  the filename.

Make it look good. This is a tool a designer will stare at for hours.
```

---

## Notes for us (do not paste)

**Why it is written this way.** The earlier version of this file was a turn-by-turn
prompt for drawing one icon. This one asks for an *app*, and leads with purpose — what
the thing is for and what problem it exists to solve — rather than dictating output
format. The model builds better when it understands the intent behind a constraint.

**The Jules evidence is in the prompt on purpose.** The measured failure (88-96%
self-similar concepts, inert iterations) is the single most useful thing we know, and
it justifies the two mechanisms. Without that paragraph the model will happily rebuild
the same trap.

**Where the files go.** Whatever the app exports, our pipeline expects:

```
public/assets/icons/spells/{spell-id}/c{concept}-v{version}.svg
```

Drop them there and the design preview picks them up with no code change — the 3x3
grid, click-to-pick, coverage and overlap warnings all work regardless of what
produced the SVGs. Spell ids and descriptions live in
`public/data/spells/level-{n}/{id}.json`.

**We already have the judge.** `GET /api/spell-icon-coverage` scores a spell's set:
concept-vs-concept similarity (>= 0.85 means one idea, not three) and version
stagnation (>= 0.93 means the iteration did nothing). It caught the Jules batch 10/10
where a byte-hash caught 0/10. So the app does not have to be trusted — it can be
checked.
