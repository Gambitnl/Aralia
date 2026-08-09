#!/usr/bin/env python3
"""Phase A: fresh-agent outcome-contract extraction for every unit, 3-way concurrent."""
import os, sys, shutil, json
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import runner
from units import UNITS

G = r"F:\Repos\Aralia\.agent\skill-gauntlet"

PROMPT = """You are an outcome-contract extractor. You have never seen this skill before and know nothing about why it exists beyond what is in front of you.

In your working directory, `original/` contains the complete original Claude Code skill "{uid}" (kind: {kind}, install scope: {scope}). Additional evidence:
{evidence}

Inspect everything in `original/`{extra_read}. Then write the file `outcome-contract.md` in your working directory: a frozen, implementation-neutral specification of what the OWNER of this skill actually cares about. Sections, exactly these:

1. Purpose — the real job the skill exists to do, in one short paragraph.
2. Success — what a successful result looks like, observable from the outside.
3. Qualities ranked — which qualities matter most, in priority order, and why.
4. Hard constraints — what any implementation must respect.
5. Must never — outcomes that disqualify a result.
6. Activation boundary — when the skill should trigger, and when it must stay silent.

Rules:
- Distinguish ends from means. Do NOT carry a procedure, prompting technique, tool sequence, or implementation choice into the contract unless the method itself is genuinely part of the owner's requirement (say so explicitly when it is).
- Strip all distinctive wording, examples, catchphrases, personas, and procedural clues that could fingerprint which skill version produced an output. Describe requirements in neutral language.
- Where the original is ambiguous, state the most faithful reading, not your preference.
- Keep it under 120 lines.

Write ONLY outcome-contract.md. Do not modify original/."""


def extract(uid):
    u = UNITS[uid]
    sb = runner.new_sandbox("contract-" + uid[:20])
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
    ev = "\n".join("- " + e for e in u["evidence"]) or "- (none)"
    extra = ""
    extras = [e for e in u["evidence"] if "Read-only context in the real repo" in e]
    if extras:
        extra = " and the read-only repo paths named in the evidence (read them, change nothing there)"
    prompt = PROMPT.format(uid=uid, kind=u["kind"], scope=u["scope"], evidence=ev, extra_read=extra)
    out = os.path.join(G, "skills", uid, "contract")
    os.makedirs(out, exist_ok=True)
    rec = runner.run("claude-opus-5", prompt, sb, os.path.join(out, "extract-run.json"),
                     max_turns=25, timeout=1500,
                     extra_args=["--add-dir", r"F:\Repos\Aralia"] if extras else None)
    src = os.path.join(sb, "outcome-contract.md")
    ok = os.path.exists(src)
    if ok:
        shutil.copy(src, os.path.join(out, "draft.md"))
    return uid, ok, rec.get("model_verified"), rec.get("cost_usd")


if __name__ == "__main__":
    todo = sys.argv[1:] or list(UNITS)
    with ThreadPoolExecutor(max_workers=3) as ex:
        for uid, ok, mv, cost in ex.map(extract, todo):
            print(json.dumps({"unit": uid, "draft": ok, "model_verified": mv, "cost": cost}))
