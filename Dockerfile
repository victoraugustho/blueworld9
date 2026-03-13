# Stage 1: build
FROM node:22-alpine AS builder
RUN ["apk", "add", "--no-cache", "libc6-compat"]
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN ["npm", "ci"]

# Keep secrets (e.g. OPENAI_API_KEY) out of build args; inject at runtime only.
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build app
RUN ["node", "./node_modules/next/dist/bin/next", "build"]

# Stage 2: production
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
