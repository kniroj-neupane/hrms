# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
# Pinned to the "packageManager" field in package.json.
RUN npm install -g pnpm@9.15.0
WORKDIR /app

# --- Dependencies ---
FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
# The hoisted linker gives a flat, npm-style node_modules so individual
# packages can be copied into the runner stage without pnpm's symlink store.
RUN pnpm install --frozen-lockfile --node-linker=hoisted

# --- Build ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the bundle at build time, so they must
# be supplied here rather than through the runtime env file.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_BETTER_AUTH_URL
ARG NEXT_PUBLIC_R2_ENDPOINT_URL
ARG NEXT_PUBLIC_R2_BUCKET_NAME
ARG NEXT_PUBLIC_R2_PUBLIC_URL
ARG NEXT_PUBLIC_C15T_URL

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL
ENV NEXT_PUBLIC_R2_ENDPOINT_URL=$NEXT_PUBLIC_R2_ENDPOINT_URL
ENV NEXT_PUBLIC_R2_BUCKET_NAME=$NEXT_PUBLIC_R2_BUCKET_NAME
ENV NEXT_PUBLIC_R2_PUBLIC_URL=$NEXT_PUBLIC_R2_PUBLIC_URL
ENV NEXT_PUBLIC_C15T_URL=$NEXT_PUBLIC_C15T_URL

# Server-side secrets are only present at runtime; see src/env.js.
ENV SKIP_ENV_VALIDATION=1
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# --- Production ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Standalone Next.js server
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migrations run before the server starts. Next's output tracing only keeps the
# drizzle-orm files the app itself imports, so copy both packages in full to
# make the migrator entrypoint resolvable.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --chown=nextjs:nodejs scripts/migrate.mjs ./scripts/migrate.mjs

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
