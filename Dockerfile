FROM node:22.17.1-bookworm-slim AS frontend-dependencies
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci

FROM frontend-dependencies AS frontend-build
COPY public ./public
COPY src ./src
ENV NODE_ENV=production
RUN npm run build

FROM node:22.17.1-bookworm-slim AS server-dependencies
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22.17.1-bookworm-slim AS application
ENV NODE_ENV=production \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=3001 \
    FRONTEND_DIRECTORY=/app/public
WORKDIR /app
COPY --chown=node:node server/package.json server/package-lock.json ./server/
COPY --chown=node:node server/app.js server/auth.js server/db.js server/email.js server/server.js ./server/
COPY --chown=node:node server/middleware ./server/middleware
COPY --chown=node:node server/models ./server/models
COPY --chown=node:node server/routes ./server/routes
COPY --chown=node:node server/utils ./server/utils
COPY --chown=node:node server/migrations ./server/migrations
COPY --chown=node:node server/seeds ./server/seeds
COPY --chown=node:node server/scripts ./server/scripts
COPY --chown=node:node server/migration-tooling/lib/sharedCatalog.js ./server/migration-tooling/lib/sharedCatalog.js
COPY --chown=node:node src/services/builtInIngredients.js ./src/services/builtInIngredients.js
COPY --from=server-dependencies --chown=node:node /build/server/node_modules ./server/node_modules
COPY --from=frontend-build --chown=node:node /build/build ./public
USER node
EXPOSE 3001
CMD ["node", "server/server.js"]
