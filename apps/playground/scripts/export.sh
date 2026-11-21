#!/bin/sh
# Build the playground and export it as a static page: export.sh <page-name> [out-dir]
set -eu
name=$1
out=${2:-$HOME/work/reports/keyhall-ui}
cd "$(dirname "$0")/.."
pnpm exec vite build
mkdir -p "$out/assets" "$out/art"
cp dist/assets/* "$out/assets/"
cp dist/art/* "$out/art/"
cp dist/index.html "$out/$name.html"
echo "$out/$name.html"
