# Stage 1 : Base
FROM node:26-alpine AS base

RUN npm install -g corepack \
    && corepack enable \
    && corepack prepare pnpm@10.33.4 --activate

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

# Stage 2 : Prune
FROM base AS pruner

COPY . .

RUN pnpm dlx turbo@2.9.15 prune app --docker

# Stage 3 : Install
FROM base AS installer

COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --frozen-lockfile

# Stage 4 : Build
FROM base AS builder

COPY --from=installer /app/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/full/ ./

ARG VITE_API_URL
ARG VITE_APP_URL
ARG VITE_WEB_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_WEB_URL=$VITE_WEB_URL

RUN pnpm turbo run build --filter=app

# Stage 5: Serve
FROM nginx:alpine AS server

COPY --from=builder /app/apps/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80