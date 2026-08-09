#!/usr/bin/env python3
"""Phase F: skill builder. Fresh agent, sees contract + original + iteration tasks
(+ blind judge feedback from earlier cycles). Never sees sealed tasks or judge identity."""
import os, sys, shutil, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import runner
from units import UNITS

G = r"F:\Repos\Aralia\.agent\skill-gauntlet"

BUILD = """You are a skill builder upgrading a Claude Code skill for the Opus 5 model generation.

Materials in your working directory:
- `contract.md` — the frozen outcome contract. This is the ONLY definition of success.
- `original/` — the current skill implementation. You may keep, rewrite, shrink, or discard any of it. Its methods are NOT requirements unless the contract says so.
- `iteration-tasks/` — sample tasks (prompts + fixtures) like those the skill will be evaluated on. Learn the SHAPE of the work from them. Do not hard-code answers to them; the real evaluation uses different, unseen tasks.
{feedback_clause}

Standing principle: a skill should primarily contain what the model could not reasonably know on its own — project-specific facts, non-obvious pitfalls, hard-won environment knowledge, exact commands and paths. Opus 5 is a very strong model: cut generic advice, motivational framing, and step-by-step hand-holding it does not need. Keep the skill lean, precise, and trigger-accurate (the description controls activation; make it fire exactly when the contract's activation boundary says).

Investigate and decide freely: restructure, merge resources, rewrite the description, change format — whatever you believe produces the strongest general result under the contract.

Output: write the complete upgraded skill into `candidate/`:
- kind=skill → candidate/SKILL.md (+ any resource files)
- kind=command → candidate/<same-filename>.md
- kind=command-family → one .md per command, same filenames as original/
Keep required frontmatter valid. Write nothing outside candidate/."""


def build(uid, cycle=1):
    u = UNITS[uid]
    sdir = os.path.join(G, "skills", uid)
    sb = runner.new_sandbox("build-" + uid[:16])
    shutil.copy(os.path.join(sdir, "contract", "FROZEN-contract.md"), os.path.join(sb, "contract.md"))
    orig = os.path.join(sb, "original")
    if isinstance(u["src"], list):
        os.makedirs(orig)
        for f in u["src"]:
            shutil.copy(f, orig)
    elif u["kind"] == "command":
        os.makedirs(orig)
        shutil.copy(u["src"], orig)
    else:
        shutil.copytree(u["src"], orig)
    it = os.path.join(sb, "iteration-tasks")
    os.makedirs(it)
    src_it = os.path.join(sdir, "bench", "iteration")
    for f in os.listdir(src_it):
        t = json.load(open(os.path.join(src_it, f), encoding="utf-8"))
        json.dump({"prompt": t["prompt"], "fixtures": t.get("fixtures", {}), "kind": t.get("kind")},
                  open(os.path.join(it, f), "w", encoding="utf-8"), indent=2)
    fb = ""
    fbfile = os.path.join(sdir, "feedback", f"cycle{cycle - 1}.md")
    if cycle > 1 and os.path.exists(fbfile):
        shutil.copy(fbfile, os.path.join(sb, "feedback.md"))
        fb = ("- `feedback.md` — anonymized judge feedback on your previous candidate's blind "
              "losses and wins. Diagnose WHY it lost and address the causes, not the specific tasks.")
    prompt = BUILD.format(feedback_clause=fb) + f"\n\nSkill id: {uid}. Kind: {u['kind']}. Install scope: {u['scope']}."
    rec = runner.run("claude-opus-5", prompt, sb, os.path.join(sdir, "candidate", f"v{cycle}-build-run.json"),
                     max_turns=40, timeout=2400)
    cand = os.path.join(sb, "candidate")
    dst = os.path.join(sdir, "candidate", f"v{cycle}")
    if os.path.exists(cand):
        if os.path.exists(dst):
            shutil.rmtree(dst)
        shutil.copytree(cand, dst)
        return uid, "BUILT v%d" % cycle, rec.get("cost_usd")
    return uid, "NO-CANDIDATE", rec.get("cost_usd")


if __name__ == "__main__":
    uid = sys.argv[1]
    cycle = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    print(json.dumps(build(uid, cycle)))
