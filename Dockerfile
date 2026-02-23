# ---------- deps (install all deps for build) ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder (compile TS -> dist) ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build NestJS
RUN npm run build

# ---------- runner (minimal production image) ----------
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN useradd -m nestuser

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# Copy only what we need to run
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built app + prisma artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
# If you have any static files needed at runtime, copy them too:
# COPY --from=builder /app/uploads ./uploads

# Your app seems to use PORT=4000 in env, so expose that
EXPOSE 4000

USER nestuser


# Use sourcemaps if you want better stack traces (your start:prod:sm)
CMD ["node", "--enable-source-maps", "dist/main.js"]