#!/bin/sh
set -e

echo "Running Drizzle migrations..."
node scripts/migrate.mjs

echo "Starting HRMS..."
exec node server.js
