# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Single-service image: the API also serves the built SPA.
#
# Two containers would mean configuring CORS, two URLs and two deploy targets
# for what is one application. The API already knows how to serve the frontend
# (SERVE_SPA), so this builds both and ships one process.
#
# Debian slim rather than Alpine on purpose: better-sqlite3 publishes prebuilt
# binaries for glibc, and on musl every build would have to compile it from
# source with a full toolchain in the image.
# ---------------------------------------------------------------------------

# ---- 1. Build the frontend ------------------------------------------------
FROM node:22-slim AS frontend-build

WORKDIR /app/frontend

# Copy manifests first so this layer is cached unless dependencies change.
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
# The bundle talks to the same origin it was served from, which is what makes
# single-service mode work without any build-time API URL.
ENV VITE_API_URL=/api
RUN npm run build

# ---- 2. Build the backend -------------------------------------------------
FROM node:22-slim AS backend-build

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
RUN npm run build

# ---- 3. Runtime -----------------------------------------------------------
FROM node:22-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Production dependencies only: no TypeScript, no test runner, no linter.
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev && npm cache clean --force

COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# The database lives on a volume so it survives a redeploy.
RUN mkdir -p /app/data && chown -R node:node /app

ENV PORT=4000 \
    DATABASE_PATH=/app/data/dealership.db \
    SERVE_SPA=true \
    SPA_DIST_PATH=/app/frontend/dist \
    TRUST_PROXY=true

EXPOSE 4000

# Never run as root.
USER node

# The health endpoint really queries the database, so this is a genuine
# readiness check rather than "is the port open".
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/backend
CMD ["node", "dist/server.js"]
