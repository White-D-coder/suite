# Stage 1: Build compilation
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency configs
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code files
COPY . .

# Generate Prisma client and compile code
RUN npx prisma generate
RUN npm run build

# Remove devDependencies to optimize image size
RUN npm prune --production

# Stage 2: Production runtime image
FROM node:22-alpine

WORKDIR /usr/src/app

# Set env context variables
ENV NODE_ENV=production

# Copy compiled code and clean dependencies
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

# Expose backend port
EXPOSE 3000

# Start backend services
CMD ["node", "dist/src/main.js"]
