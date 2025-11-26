FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM heroiclabs/nakama:3.22.0

# Copy built module
COPY --from=builder /app/build /nakama/data/modules

# Expose ports
EXPOSE 7350 7351

# Nakama will be started by Render with environment variables
