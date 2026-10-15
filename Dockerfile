# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# 先复制依赖清单以利用 Docker 缓存。
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY web/package.json ./web/package.json
COPY server/package.json ./server/package.json
RUN pnpm install --frozen-lockfile

COPY web ./web
COPY server ./server
COPY shared ./shared
COPY data ./data

RUN pnpm -C web build \
    && pnpm -C web typecheck \
    && pnpm -C server typecheck

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=8787
ENV DB_PATH=/app/storage/data.sqlite

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/data ./data
COPY --from=build /app/web/dist ./web/dist

RUN mkdir -p /app/storage \
    && chown -R node:node /app

USER node
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "node_modules/tsx/dist/cli.mjs", "server/index.ts"]

