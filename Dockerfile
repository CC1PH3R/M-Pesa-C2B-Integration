# Use official Node.js LTS image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./

# Install all dependencies (including devDeps for build)
RUN npm ci

# Copy application source
COPY src ./src

# Build TypeScript and generate Prisma Client
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Expose port
EXPOSE 3000

# Run database migrations and start server
CMD npx prisma migrate deploy && npm start