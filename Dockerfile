# Stage 1: Build the frontend SPA
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Set up the backend server and copy frontend build
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --omit=dev
WORKDIR /app
COPY server/ ./server/
COPY --from=frontend-builder /app/dist ./server/public

EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production
ENV DATA_DIR=/app/server/data

CMD ["node", "server/index.js"]
