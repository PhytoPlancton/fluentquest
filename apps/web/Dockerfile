# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json* turbo.json tsconfig.base.json ./
# Copy ALL workspace package.json files so npm install can resolve every workspace declared in root.
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/desktop/package.json apps/desktop/
COPY packages/types/package.json packages/types/
COPY packages/db/package.json packages/db/
COPY packages/sdk/package.json packages/sdk/
COPY packages/ui/package.json packages/ui/

RUN --mount=type=cache,target=/root/.npm \
    npm install --workspaces --include-workspace-root --no-audit --no-fund

COPY apps/web apps/web
COPY packages/types packages/types
COPY packages/sdk packages/sdk
COPY packages/ui packages/ui

ARG VITE_API_URL=https://api-fluentquest.nmt.ovh
ENV VITE_API_URL=$VITE_API_URL

RUN npx turbo run build --filter=@fluentquest/web

FROM nginx:1.27-alpine AS runner
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
