#!/usr/bin/env bash
# Deploy claude-ui to https://hermes.cy-pharm.com:9080/claude/
set -e
cd "$(dirname "$0")/.."

echo "▸ build"
pnpm build

echo "▸ sync to /var/www/claude/"
sudo mkdir -p /var/www/claude
sudo find /var/www/claude -mindepth 1 -delete
sudo cp -r dist/. /var/www/claude/

echo "▸ smoke test"
JS=$(ls /var/www/claude/assets/*.js | head -1 | xargs basename)
for u in "/claude/" "/claude/assets/$JS" "/claude/some/spa/route"; do
  code=$(curl -sk -o /dev/null -w "%{http_code}" "https://hermes.cy-pharm.com:9080$u")
  echo "  $u → $code"
done
echo "✓ deployed"
