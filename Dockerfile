# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build

# Coolify peut injecter NODE_ENV=production au build → forcer devDeps (@nestjs/cli, etc.)
ENV NODE_ENV=development

WORKDIR /app

# OpenSSL requis par le moteur Prisma
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

# generate → build Nest (le seed s'exécute au démarrage conteneur, pas ici)
RUN npx prisma generate \
  && npm run build \
  && npm prune --omit=dev

# ---

FROM node:22-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

# OpenSSL (Prisma)
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node package.json package-lock.json ./
# prisma + tsx : nécessaires au migrate/seed au démarrage (devDeps hors image)
RUN npm ci --omit=dev \
  && npm install prisma@7.10.1 tsx@4.23.15 --no-save \
  && npm cache clean --force

COPY --chown=node:node prisma ./prisma
COPY --chown=node:node prisma.config.ts ./
COPY --chown=node:node docker-entrypoint.sh ./
COPY --chown=node:node --from=build /app/dist ./dist
# Client Prisma généré pour `tsx prisma/seed.ts`
COPY --chown=node:node --from=build /app/src/generated ./src/generated

RUN chmod +x docker-entrypoint.sh

USER node

EXPOSE 8000

# Healthcheck sans curl/wget — GET /health (route publique)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8000)+'/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
