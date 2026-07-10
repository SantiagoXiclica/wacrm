#!/bin/bash
set -e

echo "Building locally..."
pnpm build

echo "Uploading .next to server..."
rsync -avz --delete \
  .next/ \
  root@128.140.85.213:/code/.next/

echo "Restarting remote server..."
ssh root@128.140.85.213 "cd /code && rm -f .next/build.lock && supervisorctl restart nextjs-server"

echo "Deploy complete!"
