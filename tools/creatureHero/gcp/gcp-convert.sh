#!/usr/bin/env bash
# Hero pipeline stage 2 on a self-owned GCP spot L4 (project crimson-ledger-503109).
# One command: creates the VM, installs TRELLIS.2 from Microsoft's prebuilt
# wheels, converts reference.png -> master.glb, copies it back, DELETES the VM.
#
# Usage: bash tools/creatureHero/gcp/gcp-convert.sh <entryId>
# Cost: spot g2-standard-8 (1x L4) ~ EUR 0.25-0.40/hr; a run is ~15-25 min.
set -euo pipefail

# Detached launches (Start-Process) get a minimal env where gcloud loses its
# config; pin it to the real per-user config directory.
export CLOUDSDK_CONFIG="${CLOUDSDK_CONFIG:-/c/Users/Gambit/AppData/Roaming/gcloud}"

ENTRY_ID="${1:?usage: gcp-convert.sh <entryId>}"

# HF token comes from Windows Credential Manager (AgentMatrix/HuggingFace/HF_TOKEN
# — Remy's PAT store), read at runtime, never persisted. TRELLIS.2 downloads
# Meta's gated DINOv3 encoder — verify token + gate BEFORE creating a billable VM.
HF_TOKEN="$(powershell -NoProfile -ExecutionPolicy Bypass -File tools/creatureHero/gcp/read-hf-token.ps1 | tr -d '\r')"
[ -n "${HF_TOKEN:-}" ] || { echo "could not read AgentMatrix/HuggingFace/HF_TOKEN from Credential Manager" >&2; exit 1; }
WHO=$(curl -s -H "Authorization: Bearer $HF_TOKEN" https://huggingface.co/api/whoami-v2 | head -c 200)
echo "$WHO" | grep -q '"name"' || { echo "HF token invalid: $WHO" >&2; exit 1; }
GATE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $HF_TOKEN" https://huggingface.co/facebook/dinov3-vitl16-pretrain-lvd1689m/resolve/main/config.json)
[ "$GATE" = "200" ] || { echo "DINOv3 gate not accepted for this token (HTTP $GATE) — click agree at https://huggingface.co/facebook/dinov3-vitl16-pretrain-lvd1689m" >&2; exit 1; }
echo "HF auth OK, DINOv3 gate open"

PROJECT=crimson-ledger-503109
VM=trellis-hero
ZONES=(europe-west4-a europe-west4-b europe-west4-c)
HERO_DIR="public/creatures3d/hero/${ENTRY_ID}"
REF="${HERO_DIR}/reference.png"
OUT="${HERO_DIR}/master.glb"

[ -f "$REF" ] || { echo "missing ${REF} — run the reference stage first" >&2; exit 1; }

cleanup() {
  echo "deleting VM ${VM}…"
  gcloud compute instances delete "$VM" --project "$PROJECT" --zone "$ZONE" --quiet || true
}
trap cleanup EXIT

# L4 capacity fluctuates minute to minute: walk zones on SPOT first (cheap),
# then on-demand (separate pool, ~3x price, still cents for one run) — and
# repeat the whole walk for up to ROUNDS rounds, because stockouts churn.
CREATED=""
ROUNDS="${ROUNDS:-8}"
for ROUND in $(seq 1 "$ROUNDS"); do
echo "capacity round ${ROUND}/${ROUNDS}…"
for MODEL in SPOT STANDARD; do
  for MACHINE in g2-standard-8 g2-standard-4; do
  for ZONE in "${ZONES[@]}"; do
    echo "creating L4 VM (${MODEL}, ${MACHINE}, ${ZONE})…"
    EXTRA=()
    if [ "$MODEL" = "SPOT" ]; then
      EXTRA=(--provisioning-model=SPOT --instance-termination-action=DELETE)
    fi
    if gcloud compute instances create "$VM" \
      --project "$PROJECT" --zone "$ZONE" \
      --machine-type "$MACHINE" \
      --accelerator type=nvidia-l4,count=1 \
      --image-family pytorch-2-9-cu129-ubuntu-2404-nvidia-580 \
      --image-project deeplearning-platform-release \
      --boot-disk-size 150GB --boot-disk-type pd-ssd \
      "${EXTRA[@]}" \
      --metadata=install-nvidia-driver=True \
      --no-restart-on-failure --maintenance-policy=TERMINATE; then
      CREATED=yes
      break 4
    fi
  done
  done
done
[ -n "$CREATED" ] || sleep 60
done
[ -n "$CREATED" ] || { echo "no L4 capacity in any europe-west4 zone after ${ROUNDS} rounds — try later" >&2; exit 1; }

echo "waiting for SSH…"
for i in $(seq 1 30); do
  gcloud compute ssh "$VM" --project "$PROJECT" --zone "$ZONE" --command "true" 2>/dev/null && break
  sleep 10
done

echo "uploading reference + runner…"
gcloud compute scp "$REF" "$VM":/tmp/reference.png --project "$PROJECT" --zone "$ZONE"
gcloud compute scp tools/creatureHero/gcp/run_trellis2.py "$VM":/tmp/run_trellis2.py --project "$PROJECT" --zone "$ZONE"
gcloud compute scp tools/creatureHero/gcp/remote-bootstrap.sh "$VM":/tmp/remote-bootstrap.sh --project "$PROJECT" --zone "$ZONE"

echo "remote install + run (this is the long part)…"
gcloud compute ssh "$VM" --project "$PROJECT" --zone "$ZONE" --command "HF_TOKEN='$HF_TOKEN' bash /tmp/remote-bootstrap.sh"

echo "downloading master.glb…"
gcloud compute scp "$VM":/tmp/master.glb "$OUT" --project "$PROJECT" --zone "$ZONE"
echo "master.glb written to ${OUT}"
# VM deleted by trap
