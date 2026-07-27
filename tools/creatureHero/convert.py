"""Hero pipeline stage 2 (Python variant): reference.png -> master.glb via
microsoft/TRELLIS.2. Exists because the JS gradio client does not forward
ZeroGPU token auth correctly; the Python client does (HF_TOKEN from env).

Usage: py tools/creatureHero/convert.py <entryId> [--space microsoft/TRELLIS.2]
"""
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

from gradio_client import Client, handle_file

if len(sys.argv) < 2:
    print("usage: py tools/creatureHero/convert.py <entryId> [--space owner/name]", file=sys.stderr)
    sys.exit(1)

entry_id = sys.argv[1]
space = "microsoft/TRELLIS.2"
if "--space" in sys.argv:
    space = sys.argv[sys.argv.index("--space") + 1]

base = Path("public/creatures3d/hero")
hero_dir = base / entry_id
reference = hero_dir / "reference.png"
master = hero_dir / "master.glb"
record_path = hero_dir / "hero.json"

if not reference.exists():
    print(f'stage "reference" artifact missing for {entry_id} — run the earlier stage first', file=sys.stderr)
    sys.exit(1)

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
result = client.predict(decimation_target=30000, texture_size=1024, api_name="/extract_glb")
print("extract result:", str(result)[:300])

# result is a filepath (or tuple containing one) to the GLB on the client cache
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

record = {"entryId": entry_id, "stages": {}, "status": "generated"}
if record_path.exists():
    record = json.loads(record_path.read_text(encoding="utf-8"))
record.setdefault("stages", {})["master"] = {
    "at": datetime.now(timezone.utc).isoformat(),
    "note": space,
}
record_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
print(f"master.glb written ({master.stat().st_size / 1024 / 1024:.1f} MB)")
