FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY src ./src
COPY tsconfig.json .
COPY .env.example .env.example

# Build TypeScript (backend + shared output)
RUN npm run build

# Build the React frontend production bundle (emitted to dist/frontend/build,
# which src/backend/app.ts serves via express.static and the SPA fallback).
RUN npm run build:frontend

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built files from builder. The compiled backend (dist), the built React
# bundle (dist/frontend/build) and package metadata are copied here. Node
# modules are NOT cross-copied from the builder: the large node_modules COPY
# over WSL2 overlayfs routinely stalls, so production dependencies are instead
# installed directly in this runtime stage from the (tiny) package files.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json* ./package-lock.json*
RUN npm install --omit=dev --legacy-peer-deps

# The appuser (non-root runtime) needs a writable location for the Winston
# logger's ./logs directory. /app is root-owned, so pre-create and own just the
# logs directory (non-recursive chown - fast, avoids the WSL2 overlayfs stall).
RUN mkdir -p /app/logs && chown appuser:appgroup /app/logs

# The LocalStorageProvider writes uploaded files to <cwd>/uploads (which is
# /app/uploads when the runtime starts in /app). Pre-create the directory and
# hand ownership to the non-root runtime user so the application can create,
# read, and delete uploaded files without weakening filesystem security
# (no chmod 777, no root runtime).
RUN mkdir -p /app/uploads && chown appuser:appgroup /app/uploads

USER appuser

# Expose port
EXPOSE 5000

# Environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start server
CMD ["node", "dist/index.js"]