# 1. Judgment surfaces and recorded verdicts

Date: 2026-08-05

## Status

Accepted

## Context

Aralia's visual work needs a human eye. A generator can measure that a fern is
1.05 m tall. It cannot decide whether the fern reads as a fern. Only Remy can.

Today that judgment happens in chat. An agent captures a screenshot, pastes it
into the conversation, and asks. This has four faults, and a single session on
2026-08-05 hit all four.

**The verdict is not written down.** Remy judged the forest understory twice in
one session. Neither answer exists anywhere but the transcript. The next agent
to touch that code will rediscover both.

**The surface is built for the moment.** Each agent wrote its own capture rig.
Several produced worthless frames: one anchored the camera 7.8 m underground,
another dismissed a modal by clicking a button that navigated away. Nobody
could tell a bad frame from a bad subject.

**The distance is wrong and nobody notices.** The orbit camera clamps at 20 m,
so a fern occupies about 15 screen pixels. Two before-and-after captures came
back looking identical for this reason alone. The subject had changed. The
surface could not show it.

**Nothing detects rot.** A capture rig, a preview page, and a verdict all age
silently. The code moves and the surface keeps claiming to show it.

The project already has the raw material. `design.html?step=X` hosts preview
surfaces. The plan map already carries a `decision` field, used by 11 of 650
features. Neither is wired to visual judgment.

## Decision

Visual decisions happen on a **judgment surface**, and the answer is recorded
as a **verdict**.

A judgment surface is built for one decision. It shows the subject at the
distance the decision needs, beside whatever the subject must be judged
against. It is reachable by URL and it can be returned to.

A verdict names five things:

- the subject
- the decision
- the person
- the day
- the version of the subject that was judged

Verdicts live beside their subject, inside the repository. They move with the
code, they appear in a diff, and a reader finds one where the work is.

The plan map indexes them. It links to each verdict and lists what still needs
an eye. It holds no verdict of its own, so there is one source of truth per
decision and one place to see them all.

A verdict that names the version it judged makes **verdict drift** detectable.
When the subject changes, the verdict stops matching, and that is a fact a
check can find rather than a thing a person must remember.

## Consequences

**A screenshot in chat stops being an acceptable ask.** Building a surface
costs more than pasting an image. That cost is the point. It is paid once per
decision rather than once per attempt, and this session paid the second price
repeatedly.

**Surfaces need their own maintenance.** A judgment surface is code. It rots.
A future task must evaluate staleness and drift across all preview surfaces,
because a stale surface is worse than a missing one — a reader trusts it.

**Some judgments will be batched.** Fifteen material stacks are fifteen cut
faces. They belong on one surface reviewed in one sitting, not fifteen asks.

**Agents can author, humans still gate.** Agents write the candidates cheaply.
The review budget is the human eye, and it is the real constraint on how much
authored content the project can carry. Surfaces exist to spend that budget
well.

## Alternatives considered

**Keep judging in chat.** Fastest per instance and needs no build. Rejected:
it loses every verdict, and it produced four distinct failures in one session.

**Store verdicts only in the plan map.** One list, easy to scan. Rejected: the
verdict sits away from the code it judges, so a diff cannot show that the
subject moved underneath it.

**Store verdicts only beside the subject.** Correct locality, no overview.
Rejected on its own: nobody could see what awaits an eye. Adopted together
with the plan map as an index.
