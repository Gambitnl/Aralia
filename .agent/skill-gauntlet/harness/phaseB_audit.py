#!/usr/bin/env python3
"""Phase B: independent contract audit + resolve + freeze, per unit."""
import os, sys, shutil, json
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import runner
from units import UNITS

G = r"F:\Repos\Aralia\.agent\skill-gauntlet"

AUDIT = """You are an independent contract auditor. You had no part in writing the draft.

`original/` holds the complete original Claude Code skill "{uid}". `draft-contract.md` claims to be a faithful, implementation-neutral outcome contract for it.

Compare the draft against the original. Write `audit.md` in your working directory with:
1. OMITTED — important owner requirements present in the original but missing from the draft.
2. DISTORTED — draft statements that misstate what the original requires.
3. MISLABELED — genuine requirements the draft demoted to preferences, or preferences it promoted to requirements.
4. LEAKED MEANS — procedures or implementation choices the draft carried over that are not truly part of the owner's requirement.
5. FINGERPRINTS — any distinctive wording or examples in the draft that could reveal which skill version produced an output.
6. VERDICT — "PASS" if the draft is faithful with at most trivial issues, otherwise "REVISE".

Be concrete: quote the original where you claim an omission or distortion. Write ONLY audit.md."""

RESOLVE = """You are a contract resolver. `original/` holds the original skill "{uid}", `draft-contract.md` is a proposed outcome contract, and `audit.md` lists an independent auditor's findings.

Produce `final-contract.md`: the draft with every substantiated audit finding fixed. Reject findings that are wrong, and note rejections in a short `resolution-notes.md`. Keep the contract implementation-neutral, fingerprint-free, and under 120 lines. Write only those two files."""


def stage(uid, files, prompt, outdir, outname, runname):
    sb = runner.new_sandbox(runname[:6] + "-" + uid[:18])
    orig = os.path.join(sb, "original")
    u = UNITS[uid]
    if isinstance(u["src"], list):
        os.makedirs(orig)
        for f in u["src"]:
            shutil.copy(f, orig)
    elif u["kind"] == "command":
        os.makedirs(orig)
        shutil.copy(u["src"], orig)
    else:
        shutil.copytree(u["src"], orig)
    for name, src in files.items():
        shutil.copy(src, os.path.join(sb, name))
    rec = runner.run("claude-opus-5", prompt.format(uid=uid), sb,
                     os.path.join(outdir, runname + "-run.json"), max_turns=25, timeout=1500)
    produced = {}
    for f in outname:
        p = os.path.join(sb, f)
        if os.path.exists(p):
            shutil.copy(p, outdir)
            produced[f] = True
    return rec, produced


def process(uid):
    cdir = os.path.join(G, "skills", uid, "contract")
    draft = os.path.join(cdir, "draft.md")
    if not os.path.exists(draft):
        return uid, "NO-DRAFT"
    stage(uid, {"draft-contract.md": draft}, AUDIT, cdir, ["audit.md"], "audit")
    audit = os.path.join(cdir, "audit.md")
    if not os.path.exists(audit):
        return uid, "NO-AUDIT"
    verdict = open(audit, encoding="utf-8", errors="replace").read()
    if "REVISE" in verdict.upper().split("VERDICT")[-1]:
        stage(uid, {"draft-contract.md": draft, "audit.md": audit}, RESOLVE, cdir,
              ["final-contract.md", "resolution-notes.md"], "resolve")
        final = os.path.join(cdir, "final-contract.md")
        if not os.path.exists(final):
            return uid, "NO-FINAL"
    else:
        shutil.copy(draft, os.path.join(cdir, "final-contract.md"))
    # freeze: read-only copy
    frozen = os.path.join(cdir, "FROZEN-contract.md")
    shutil.copy(os.path.join(cdir, "final-contract.md"), frozen)
    os.chmod(frozen, 0o444)
    return uid, "FROZEN"


if __name__ == "__main__":
    todo = sys.argv[1:] or list(UNITS)
    with ThreadPoolExecutor(max_workers=3) as ex:
        for uid, status in ex.map(process, todo):
            print(json.dumps({"unit": uid, "contract": status}))
