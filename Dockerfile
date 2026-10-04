# Use official Node.js production image
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependencies first for efficient layer caching
COPY package*.json ./
RUN npm ci

# Copy full source and build production bundles
COPY . .
RUN npm run build

# Production runtime container
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy production assets from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Expose server-authoritative multiplayer port
EXPOSE 3000

# Execute server
CMD ["npm", "start"]
