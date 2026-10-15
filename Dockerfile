# TruERP web UI — Next.js standalone server.
#
# Build & run directly:
#   docker build -t truerp-web \
#     --build-arg NEXT_PUBLIC_API_URL=/api/v1 \
#     --build-arg TRUERP_API_PROXY=https://your-api-host .
#   docker run -p 3000:3000 truerp-web
#
# Or via the dedicated compose file:
#   docker compose up --build -d
#
# NOTE: NEXT_PUBLIC_API_URL and TRUERP_API_PROXY are baked into the build —
# changing the API target requires a rebuild.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_API_URL goes into the client bundle; TRUERP_API_PROXY is read by
# next.config.mjs rewrites -> routes manifest. Both are build-time only.
ARG NEXT_PUBLIC_API_URL=/api/v1
ARG TRUERP_API_PROXY=http://host.docker.internal:8088
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    TRUERP_API_PROXY=$TRUERP_API_PROXY
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
