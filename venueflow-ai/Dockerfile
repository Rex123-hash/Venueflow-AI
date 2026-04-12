# Use pre-built frontend (dist folder committed to source)
# Only build the backend in Cloud Build

FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm install --no-audit --no-fund

# Generate Prisma Client
RUN npx prisma generate

# Copy backend source and build
COPY backend/ ./
RUN npm run build || true

# Copy pre-built frontend static files
COPY frontend/dist ./public

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "dist/index.js"]
