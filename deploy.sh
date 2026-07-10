#!/bin/bash
set -e

cd /code
git pull origin dev

rm -f .next/build.lock

npm install --omit=dev

echo "Restarting server..."
supervisorctl restart nextjs-server
