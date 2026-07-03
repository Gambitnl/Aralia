# AI Arbiter — Full DM Authority via NPC Embodiment (2026-07-02)

**Status:** direction decided in interview, architecture unexplored. Not built.

## The decision (Remy, 2026-07-02)

The AI arbiter gets **FULL DM AUTHORITY** — but exercised in a specific,
grounded way: it "crawls into the head" of an NPC and **thinks as that NPC**,
steering their behavior through **hidden controls** — the same kind of action
surface a player has, exposed programmatically (a "Playwright for the game":
an NPC-action API the arbiter drives without the player seeing the strings).

So the arbiter's power is not rule-bending from above; it is embodied
puppeteering from inside: an NPC in combat (or out of it) can at any moment be
"possessed" by the arbiter, which perceives the situation and acts with the
NPC's knowledge, personality (values/fears/quirks — already generated per
NPC), relationships, and goals.

Named powers so far:
- Rule a crossfire civilian death as an authored story hook (the exception to
  crossfire protection — see `subspecs/reactions--crossfire-protection.md`).
- Drive NPC combat/social behavior beyond scripted disposition when the
  moment warrants (a guard captain making a clever call, a victim's brother
  doing something rash).

## Perception + control (open architecture questions)

Remy raised: "some kind of vision model or PC-use capability or playwright
ability." Two candidate perception paths:
1. **Structured state feed (technically favored):** the game hands the
   arbiter perfect structured context (visible referee state from that NPC's
   LOS, relationships, recent events). Cheap, fast, deterministic to log.
2. **Vision model (screenshots):** the arbiter literally sees the scene.
   Expensive and lossy for a game that can already serialize its truth —
   but may matter if embodiment fidelity ever needs what the state feed
   can't express.

Control path in both cases: an **NPC action API** — walk-to, attack, cast,
speak, flee, interact — mirroring player-available verbs, invoked invisibly.

## Constraints to design in

- Turn-time budget: combat can't stall on LLM latency every NPC turn —
  embodiment is likely selective (arbiter picks WHICH NPC/moments to inhabit;
  default NPCs run mechanical disposition).
- Verifiability: arbiter actions must flow through the same referee (no
  rule-breaking outputs; full DM authority means narrative freedom, not
  physics violations).
- Logging: every arbiter intervention recorded (Debug-Log-grade visibility).

## Related
- Parent design: `2026-07-02-fight-in-place-combat-design.md`
- Crossfire override: `subspecs/reactions--crossfire-protection.md`
- Existing LLM-intent precedent: the combat-oriented opening (free text →
  intent → dice) and NPC dialogue integration.
