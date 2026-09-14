# Portable API container for a continuously running Node service.
# Build context is the repository root, never server/ alone.
FROM node:24-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci --workspace=@lantern-post/api --workspace=@lantern-post/shared-types \
    --include-workspace-root --include=dev --no-audit --no-fund
COPY tsconfig.base.json ./
COPY server/ server/
COPY packages/shared-types/ packages/shared-types/
COPY scripts/build-hosted-api.mjs scripts/build-hosted-api.mjs
RUN npm run build:hosted-api \
    && npm prune --workspace=@lantern-post/api --workspace=@lantern-post/shared-types \
       --include-workspace-root --omit=dev --ignore-scripts --no-audit --no-fund \
    && mkdir -p server/node_modules \
    && node -e "require('@prisma/client'); require('@nestjs/core'); require('ws')"

FROM base AS runtime
ENV NODE_ENV=production PORT=3000 MODERATION_MODE=disabled EXPO_PUSH_ENABLED=false
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server/package.json ./server/package.json
COPY --from=build --chown=node:node /app/server/dist ./server/dist
COPY --from=build --chown=node:node /app/server/node_modules ./server/node_modules
COPY --from=build --chown=node:node /app/packages/shared-types ./packages/shared-types
USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
CMD ["node", "server/dist/main.js"]
