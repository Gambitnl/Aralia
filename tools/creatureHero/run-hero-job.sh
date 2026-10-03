#!/usr/bin/env bash

# This launcher is the Linux/Codespaces boundary between Hero Lab and the
# hosted Hugging Face TRELLIS service.
#
# Codespaces supplies HF_TOKEN as a development-environment secret. This file
# verifies that the secret exists, passes it only to the child pipeline, and
# clears its shell copy on every exit. Generated files are restricted to
# Aralia's ignored Hero Lab scratch folder; promotion remains a separate API
# action that requires explicit confirmation in the page.

set -euo pipefail

entry_id="${1:-}"
base_dir="${2:-}"

# Reject malformed job names before using them in paths or subprocess calls.
if [[ ! "$entry_id" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  printf '%s\n' 'Hero Lab entry id must contain only letters, numbers, underscores, or hyphens.' >&2
  exit 1
fi

if [[ -z "$base_dir" ]]; then
  printf '%s\n' 'Hero Lab base directory is required.' >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
scratch_root="$(realpath -m "$repo_root/.agent/scratch/hero-lab/jobs")"
resolved_base="$(realpath -m "$base_dir")"

# A compromised request must not redirect generation outside ignored scratch
# storage. The trailing slash prevents a lookalike folder from passing.
case "$resolved_base/" in
  "$scratch_root/"*) ;;
  *)
    printf 'Hero Lab base directory must remain under %s\n' "$scratch_root" >&2
    exit 1
    ;;
esac

convert_script="$repo_root/tools/creatureHero/convert.py"
optimize_script="$repo_root/tools/creatureHero/optimize.mjs"

# Codespaces secrets are injected into the server environment by GitHub. They
# are never browser variables because the name does not start with VITE_. The
# trap limits the token's lifetime in this runner after success or failure.
trap 'unset HF_TOKEN' EXIT
if [[ -z "${HF_TOKEN:-}" ]]; then
  printf '%s\n' 'Hugging Face credential is unavailable. Add HF_TOKEN as a Codespaces secret and restart the Codespace.' >&2
  exit 1
fi

cd "$repo_root"
printf '%s\n' 'HERO_LAB_STAGE:preparing'

printf '%s\n' 'HERO_LAB_STAGE:generating'
python "$convert_script" "$entry_id" --base "$resolved_base"

printf '%s\n' 'HERO_LAB_STAGE:optimizing'
npx tsx "$optimize_script" "$entry_id" --base "$resolved_base"

printf '%s\n' 'HERO_LAB_STAGE:validating'
hero_path="$resolved_base/$entry_id/hero.glb"
metadata_path="$resolved_base/$entry_id/hero.json"
if [[ ! -f "$hero_path" || ! -f "$metadata_path" ]]; then
  printf '%s\n' 'The pipeline finished without a complete hero.glb and hero.json candidate.' >&2
  exit 1
fi

printf '%s\n' 'HERO_LAB_STAGE:ready'
