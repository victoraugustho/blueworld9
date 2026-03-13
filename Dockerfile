# Stage 1: dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on lockfile
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: build
FROM node:22-alpine AS builder
WORKDIR /app

# Keep secrets (e.g. OPENAI_API_KEY) out of build args; inject at runtime only.
# Copy deps stage snapshot (includes package files and node_modules when present)
COPY --from=deps /app/ ./
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Fallback for environments where node_modules is missing in deps snapshot
RUN if [ ! -d node_modules ]; then npm ci; fi

# Build app
RUN npm run build

# Stage 3: production
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy required build artifacts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start app
CMD ["node", "server.js"]
