# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json* turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
COPY packages/db/package.json packages/db/

RUN --mount=type=cache,target=/root/.npm \
    npm install --workspaces --include-workspace-root --no-audit --no-fund

COPY apps/api apps/api
COPY packages/types packages/types
COPY packages/db packages/db

RUN npx turbo run build --filter=@fluentquest/api

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache tini

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/api/package.json ./package.json
COPY --from=builder /repo/apps/api/dist ./dist
COPY --from=builder /repo/packages ./packages

USER node
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
