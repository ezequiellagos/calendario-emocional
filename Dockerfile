ARG NODE_IMAGE=node:24-trixie-slim

FROM ${NODE_IMAGE} AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
ENV DATABASE_PATH=/app/data/emotional-calendar.sqlite

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

RUN mkdir -p /app/data \
	&& chown -R node:node /app

EXPOSE 4321

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '4321') + '/').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server/entry.mjs"]