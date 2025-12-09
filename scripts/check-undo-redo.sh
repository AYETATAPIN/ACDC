#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-"http://localhost:3000/api/v1"}
JQ_BIN=${JQ_BIN:-jq}

say() { printf "\n== %s ==\n" "$*"; }

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "Required tool '$1' not found"; exit 1; }
}

need curl

maybe_jq() {
  if command -v "$JQ_BIN" >/dev/null 2>&1; then
    "$JQ_BIN" "$@"
  else
    cat
  fi
}

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

say "Create diagram"
create_payload='{"name":"Undo/Redo Check","type":"class","svg_data":"<svg>v1</svg>"}'
create_res=$(curl -s -X POST "$BASE_URL/diagrams" -H "Content-Type: application/json" -d "$create_payload")
diagram_id=$(printf "%s" "$create_res" | maybe_jq -r '.id // .diagram_id // empty')
if [[ -z "$diagram_id" ]]; then
  echo "Failed to create diagram: $create_res"
  exit 1
fi
echo "Diagram id: $diagram_id"

say "Update diagram (creates new snapshot)"
update_payload='{"name":"Undo/Redo Check v2","svg_data":"<svg>v2</svg>"}'
curl -s -X PUT "$BASE_URL/diagrams/$diagram_id" -H "Content-Type: application/json" -d "$update_payload" | maybe_jq .

say "History after update"
curl -s "$BASE_URL/diagrams/$diagram_id/history" | maybe_jq .

say "Undo"
undo_res=$(curl -s -X POST "$BASE_URL/diagrams/$diagram_id/undo")
printf "%s\n" "$undo_res" | maybe_jq .

say "Redo"
redo_res=$(curl -s -X POST "$BASE_URL/diagrams/$diagram_id/redo")
printf "%s\n" "$redo_res" | maybe_jq .

say "Final history"
curl -s "$BASE_URL/diagrams/$diagram_id/history" | maybe_jq .
