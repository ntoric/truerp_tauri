# TruERP web UI — Next.js standalone server.
#
# Build & run directly:
#   docker build -t truerp-web --build-arg NEXT_PUBLIC_API_URL=/api/v1 .
#   docker run -p 3000:3000 -e TRUERP_API_PROXY=https://your-api-host truerp-web
#
# Or via the dedicated compose file:
#   docker compose up --build -d
#
# NOTE: NEXT_PUBLIC_API_URL is baked into the build (client bundle) — changing
# it requires a rebuild. TRUERP_API_PROXY is read by middleware.ts at runtime —
# set it as a container env var, no rebuild needed.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_API_URL goes into the client bundle — build-time only.
# TRUERP_API_PROXY is intentionally NOT baked: middleware.ts reads it at
# runtime in the standalone server.
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
