import { createRequire } from 'node:module';
import { defineConfig, env } from 'prisma/config';

// Local : charge .env si dotenv est installé. Coolify / Docker injectent déjà l'env.
const require = createRequire(import.meta.url);
try {
  require('dotenv').config();
} catch {
  // dotenv absent en image prod — normal
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
