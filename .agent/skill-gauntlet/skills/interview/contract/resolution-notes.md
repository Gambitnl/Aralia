# Resolution notes

All audit findings were applied except the following.

## Rejected

**1.4 — "the `description` field is never accounted for."**
No requirement follows from it. The field is a human-facing summary line; its substantive content
("in-depth", "detailed spec") is already captured as a constraint via finding 1.3, and its only other
function is discovery, which §6 covers. Reproducing the string itself would add nothing normative and
would work against the neutrality the audit demands elsewhere (§5). Nothing changed for this finding.

**2.8 — "altering the user's existing files" is stricter than the tool allowlist enforces.**
Rejected as framed. The audit derives the permitted scope of action from what a write capability can
technically do; the contract derives it from what the skill is for — ask, then produce a spec. Under
that reading, editing the user's other documents is out of bounds regardless of what any tool could
reach. Reasoning from tool capability is also exactly the leak the audit objects to in 4.1–4.3. The
constraint is kept, but the audit's secondary point is honored: it is now marked as this contract's
inference (§5, §7) rather than presented as an owner statement.

## Applied with a narrower fix than requested

**3.4 — ranking.** The ranking is now explicitly labeled as the contract's judgment and all
"the owner says X twice" narration is gone. The order was not changed: the audit itself grants that
rankings are legitimately interpretive and asks only that they be flagged, and the evidence it cites
for re-ranking (a repetition count in the source) was removed as a fingerprint under 5.6.

**4.5 — activation apparatus.** The enumerated auto-activation scenarios and the format-specific
framing are deleted. A short boundary statement remains: an outcome contract still has to say the run
is user-initiated, and stated plainly that claim reveals nothing about the artifact's format.

**2.7 / 5.1 — the domain list.** These pull in opposite directions (2.7 wants a more faithful
rendering of one item, 5.1 wants the list de-fingerprinted). Resolved in favor of 5.1: coverage is
now stated as unbounded prose with reordered, non-parallel, differently-grouped illustrations. The
interface half of 2.7's concern is preserved inside that prose ("look and feel to someone using it")
without restoring a one-to-one mapping to the source list.
