# Multi-stage Dockerfile for Unified AI Hub Backend

# Stage 1: Base
FROM node:18-alpine AS base
LABEL maintainer="Unified AI Hub Team"
LABEL description="Unified AI Hub - Multi-provider AI platform"

# Install system dependencies
RUN apk add --no-cache \
    curl \
    tini

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Stage 2: Dependencies
FROM base AS dependencies

# Install all dependencies (including dev dependencies for building)
RUN npm ci --include=dev

# Copy source code
COPY backend ./backend
COPY config ./config

# Stage 3: Builder
FROM dependencies AS builder

# Build TypeScript to JavaScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Stage 4: Production
FROM base AS production

# Set NODE_ENV to production
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies from dependencies stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy config files
COPY --from=builder --chown=nodejs:nodejs /app/config ./config

# Create storage directory
RUN mkdir -p /app/storage && chown -R nodejs:nodejs /app/storage

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "dist/backend/index.js"]

# Stage 5: Development
FROM dependencies AS development

# Set NODE_ENV to development
ENV NODE_ENV=development

# Expose application port and debug port
EXPOSE 3000 9229

# Use nodemon for hot reloading
RUN npm install -g nodemon

# Development command with debugging
CMD ["nodemon", "--watch", "backend", "--ext", "ts", "--exec", "ts-node --inspect=0.0.0.0:9229 backend/index.ts"]
