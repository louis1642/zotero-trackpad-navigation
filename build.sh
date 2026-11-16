#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
output_dir="$project_dir/out"
artifact="$output_dir/zotero-trackpad-navigation-1.0.5.xpi"

mkdir -p "$output_dir"
rm -f "$artifact"

cd "$project_dir"
zip -q -X "$artifact" \
  manifest.json \
  bootstrap.js \
  README.md \
  LICENSE \
  CHANGELOG.md

printf '%s\n' "$artifact"
