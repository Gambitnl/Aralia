#!/usr/bin/env python3
"""Phase E: blind trials + blind judging.

Conditions:
  A = claude-opus-4-8 + original skill
  B = claude-opus-5, no skill
  C = claude-opus-5 + original skill
  D = claude-opus-5 + candidate skill

Each sample: fresh sandbox, fixtures installed, skill installed per condition,
one headless run, artifacts collected (final message + git diff + new files).
Each judgment: fresh opus-5 run, packet + two anonymized artifacts in random order.
"""
import os, sys, shutil, json, random, subprocess, hashlib
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import runner
from units import UNITS

G = r"F:\Repos\Aralia\.agent\skill-gauntlet"

CMD_INVOKE = {  # slash-command units: how a with-skill run is invoked
    "interview": "interview", "ralph-loop": "ralph-loop", "pickle-rick": "pickle-rick",
}

COND_MODEL = {"A": "claude-opus-4-8", "B": "claude-opus-5", "C": "claude-opus-5", "D": "claude-opus-5"}


def install_fixtures(sb, task):
    for rel, content in (task.get("fixtures") or {}).items():
        p = os.path.join(sb, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(p) or sb, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)
    subprocess.run(["git", "add", "-A"], cwd=sb, capture_output=True)
    subprocess.run(["git", "-c", "user.email=g@g", "-c", "user.name=g", "commit", "-qm", "fixtures", "--allow-empty"], cwd=sb, capture_output=True)


def install_condition_skill(sb, uid, cond, candidate_dir):
    u = UNITS[uid]
    if cond == "B":
        return None
    src = candidate_dir if cond == "D" else u["src"]
    if u["kind"] == "skill":
        runner.install_skill(sb, src, name=uid)
    elif u["kind"] == "command":
        runner.install_skill(sb, src, as_command=True)
    elif u["kind"] == "command-family":
        for f in (src if isinstance(src, list) else [os.path.join(src, x) for x in os.listdir(src)]):
            runner.install_skill(sb, f, as_command=True)
    return src


def make_prompt(uid, cond, task):
    p = task["prompt"]
    u = UNITS[uid]
    if cond != "B" and u["kind"] == "command" and uid in CMD_INVOKE:
        return f"/{CMD_INVOKE[uid]} {p}"
    return p


def collect(sb, rec):
    diff = subprocess.run(["git", "diff"], cwd=sb, capture_output=True, text=True,
                          encoding="utf-8", errors="replace").stdout
    untracked = subprocess.run(["git", "ls-files", "-o", "--exclude=.claude"], cwd=sb,
                               capture_output=True, text=True, encoding="utf-8", errors="replace").stdout.split()
    files = {}
    for f in untracked[:25]:
        fp = os.path.join(sb, f)
        try:
            if os.path.getsize(fp) < 40000:
                files[f] = open(fp, encoding="utf-8", errors="replace").read()
        except OSError:
            pass
    return {"final_message": rec.get("result"), "num_turns": rec.get("num_turns"),
            "diff": diff[:40000], "new_files": files}


def run_sample(uid, task, cond, candidate_dir, outdir):
    tag = f"{uid[:12]}-{task['id']}-{cond}"
    out = os.path.join(outdir, f"{task['id']}-{cond}.json")
    art = os.path.join(outdir, f"{task['id']}-{cond}-artifact.json")
    if os.path.exists(art):
        return json.load(open(art, encoding="utf-8"))
    sb = runner.new_sandbox(tag)
    install_fixtures(sb, task)
    install_condition_skill(sb, uid, cond, candidate_dir)
    rec = runner.run(COND_MODEL[cond], make_prompt(uid, cond, task), sb, out,
                     max_turns=40, timeout=1800)
    a = collect(sb, rec)
    a.update({"cond": cond, "task": task["id"], "model_verified": rec.get("model_verified"),
              "models_used": rec.get("models_used"), "cost": rec.get("cost_usd")})
    json.dump(a, open(art, "w", encoding="utf-8"), indent=2)
    return a


JUDGE = """You are an independent judge. A user asked a coding agent for help; two different agents produced results. Decide which result is better FOR THIS USER.

`packet.json` describes the task, the parts of the user's requirements that apply, objective invariants, priorities, and disqualifiers. `result-X.json` and `result-Y.json` each hold one agent's final message, the file diff it made, and any new files it created. Labels X and Y are arbitrary. You do not know which system produced which result, and it must not matter.

Judge only against the packet. Verbosity is not quality. A result that violates an invariant or disqualifier loses regardless of polish.

Write `verdict.json`:
{"winner": "X"|"Y"|"tie", "confidence": "high"|"medium"|"low",
 "reason": "<concrete, specific comparison grounded in the packet>",
 "violations": {"X": ["..."], "Y": ["..."]},
 "notable": {"X": ["requirements handled especially well"], "Y": ["..."]}}
Write ONLY verdict.json."""


def judge_pair(uid, task, art1, art2, outpath):
    if os.path.exists(outpath):
        return json.load(open(outpath, encoding="utf-8"))
    sb = runner.new_sandbox(f"judge-{uid[:10]}-{task['id']}")
    pair = [art1, art2]
    seed = int(hashlib.md5((uid + task["id"] + art1["cond"] + art2["cond"]).encode()).hexdigest(), 16)
    flipped = random.Random(seed).random() < 0.5
    if flipped:
        pair = [art2, art1]
    labels = {"X": pair[0]["cond"], "Y": pair[1]["cond"]}
    json.dump(task["packet"], open(os.path.join(sb, "packet.json"), "w", encoding="utf-8"), indent=2)
    for lab, a in zip(("X", "Y"), pair):
        clean = {k: a[k] for k in ("final_message", "diff", "new_files")}
        json.dump(clean, open(os.path.join(sb, f"result-{lab}.json"), "w", encoding="utf-8"), indent=2)
    rec = runner.run("claude-opus-5", JUDGE, sb, outpath.replace(".json", "-run.json"),
                     max_turns=15, timeout=1200)
    vp = os.path.join(sb, "verdict.json")
    v = {}
    if os.path.exists(vp):
        try:
            v = json.load(open(vp, encoding="utf-8"))
        except Exception:
            v = {"error": "bad verdict json"}
    v["_labels"] = labels
    v["_winner_cond"] = labels.get(v.get("winner")) if v.get("winner") in ("X", "Y") else v.get("winner")
    v["_judge_model_verified"] = rec.get("model_verified")
    json.dump(v, open(outpath, "w", encoding="utf-8"), indent=2)
    return v


def load_tasks(uid, split):
    d = os.path.join(G, "skills", uid, "bench", split)
    return [json.load(open(os.path.join(d, f), encoding="utf-8")) for f in sorted(os.listdir(d)) if f.endswith(".json")]


def trial_unit(uid, split="iteration", conds="ABCD", cycle=1, workers=3):
    """Run all samples for the given conditions, then judge D against each baseline."""
    candidate = os.path.join(G, "skills", uid, "candidate", f"v{cycle}")
    outdir = os.path.join(G, "skills", uid, "runs", f"cycle{cycle}-{split}")
    jdir = os.path.join(G, "skills", uid, "judge", f"cycle{cycle}-{split}")
    os.makedirs(outdir, exist_ok=True); os.makedirs(jdir, exist_ok=True)
    tasks = load_tasks(uid, split)
    jobs = [(t, c) for t in tasks for c in conds]
    arts = {}
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for (t, c), a in zip(jobs, ex.map(lambda j: run_sample(uid, j[0], j[1], candidate, outdir), jobs)):
            arts[(t["id"], c)] = a
    verdicts = []
    if "D" in conds:
        pairs = [(t, b) for t in tasks for b in "ABC" if b in conds]
        with ThreadPoolExecutor(max_workers=workers) as ex:
            for (t, b), v in zip(pairs, ex.map(
                    lambda j: judge_pair(uid, j[0], arts[(j[0]["id"], j[1])], arts[(j[0]["id"], "D")],
                                         os.path.join(jdir, f"{j[0]['id']}-D-vs-{j[1]}.json")), pairs)):
                verdicts.append({"task": t["id"], "baseline": b, "winner": v.get("_winner_cond"),
                                 "confidence": v.get("confidence"), "reason": v.get("reason", "")[:300]})
    json.dump(verdicts, open(os.path.join(jdir, "summary.json"), "w", encoding="utf-8"), indent=2)
    return verdicts


if __name__ == "__main__":
    uid = sys.argv[1]
    split = sys.argv[2] if len(sys.argv) > 2 else "iteration"
    conds = sys.argv[3] if len(sys.argv) > 3 else "ABCD"
    cycle = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    for v in trial_unit(uid, split, conds, cycle):
        print(json.dumps(v))
