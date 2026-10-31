#!/bin/sh
set -e

# Migrations + seed admin (ADMIN_*) avant Nest.
# Coolify injecte déjà l'environnement — pas de chargement .env ici.
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL manquant — impossible de démarrer."
  exit 1
fi

echo "Prisma migrate deploy..."
npx prisma migrate deploy

echo "Prisma seed (admin)..."
npx tsx prisma/seed.ts

exec "$@"
