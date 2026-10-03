"""Create an Aralia master creature mesh through Microsoft's hosted TRELLIS.2.

This is the canonical authenticated Hugging Face route for hero assets because
the Python Gradio client carries HF_TOKEN into ZeroGPU jobs. It turns the staged
reference image into a high-detail master.glb. The separate optimize.mjs stage
then reduces that master to Aralia's 30,000-triangle runtime budget.

Usage: py tools/creatureHero/convert.py <entryId> [--space microsoft/TRELLIS.2] [--base directory]
"""
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

from gradio_client import Client, handle_file

# ============================================================================
# Live TRELLIS export contract
# ============================================================================
# Microsoft TRELLIS.2 enforced a 100,000-face minimum during the authenticated
# 2026-08-12 pipeline proof. Exporting the larger master preserves detail, while
# optimize.mjs remains the single owner of Aralia's smaller runtime budget.
TRELLIS_EXPORT_FACE_TARGET = 100_000
TRELLIS_TEXTURE_SIZE = 1024

# ============================================================================
# Requested hero asset and local stage paths
# ============================================================================
# The command operates on one existing reference image and refuses to invent a
# replacement when the earlier collection stage has not completed.
if len(sys.argv) < 2:
    print("usage: py tools/creatureHero/convert.py <entryId> [--space owner/name]", file=sys.stderr)
    sys.exit(1)

entry_id = sys.argv[1]
space = "microsoft/TRELLIS.2"
if "--space" in sys.argv:
    space = sys.argv[sys.argv.index("--space") + 1]

# Hero Lab passes a job-specific scratch root here. The public library remains
# the command-line default so existing manual usage keeps working unchanged.
base = Path("public/creatures3d/hero")
if "--base" in sys.argv:
    base = Path(sys.argv[sys.argv.index("--base") + 1])
hero_dir = base / entry_id
reference = hero_dir / "reference.png"
master = hero_dir / "master.glb"
record_path = hero_dir / "hero.json"

if not reference.exists():
    print(f'stage "reference" artifact missing for {entry_id} — run the earlier stage first', file=sys.stderr)
    sys.exit(1)

# ============================================================================
# Authenticated remote generation
# ============================================================================
# HF_TOKEN is read from the process environment so the private credential never
# becomes part of the command arguments, generated files, or repository history.
token = os.environ.get("HF_TOKEN")
print(f"connecting to {space}… (token: {'yes' if token else 'no'})")
client = Client(space, hf_token=token)

print("start_session…")
client.predict(api_name="/start_session")

print("preprocess_image…")
processed = client.predict(input=handle_file(str(reference)), api_name="/preprocess_image")
print("preprocessed:", str(processed)[:160])

print("image_to_3d… (the slow GPU part)")
client.predict(image=handle_file(str(processed)) if isinstance(processed, str) else processed, seed=1, api_name="/image_to_3d")

print("extract_glb…")
# TRELLIS produces a reusable high-detail master here. The next local pipeline
# stage performs the game-specific triangle reduction and verifies its budget.
result = client.predict(
    decimation_target=TRELLIS_EXPORT_FACE_TARGET,
    texture_size=TRELLIS_TEXTURE_SIZE,
    api_name="/extract_glb",
)
print("extract result:", str(result)[:300])

# ============================================================================
# Downloaded GLB selection
# ============================================================================
# Gradio versions return either one cached filepath or a collection containing
# it. Accept those known shapes and fail loudly if no real GLB reached the client.
glb_path = None
candidates = result if isinstance(result, (list, tuple)) else [result]
for c in candidates:
    if isinstance(c, str) and c.lower().endswith(".glb"):
        glb_path = c
        break
    if isinstance(c, dict) and str(c.get("value", "")).lower().endswith(".glb"):
        glb_path = c["value"]
        break
if glb_path is None or not Path(glb_path).exists():
    print(f"no GLB in extract result: {result!r}", file=sys.stderr)
    sys.exit(1)

shutil.copyfile(glb_path, master)

# ============================================================================
# Durable stage provenance
# ============================================================================
# Record which hosted Space produced the master so later optimization, review,
# and approval never confuse this asset with the earlier code-sculpt candidate.
record = {"entryId": entry_id, "stages": {}, "status": "generated"}
if record_path.exists():
    record = json.loads(record_path.read_text(encoding="utf-8"))
record.setdefault("stages", {})["master"] = {
    "at": datetime.now(timezone.utc).isoformat(),
    "note": space,
}
record_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
print(f"master.glb written ({master.stat().st_size / 1024 / 1024:.1f} MB)")
