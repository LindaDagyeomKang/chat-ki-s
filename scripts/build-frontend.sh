#!/bin/sh
npm install --workspaces
cd apps/frontend
../../node_modules/.bin/next build
cp .next/standalone/apps/frontend/server.js .next/standalone/server.js
mkdir -p .next/standalone/.next
cp -r .next/standalone/apps/frontend/.next/* .next/standalone/.next/
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
cp -r .next /app/.next
