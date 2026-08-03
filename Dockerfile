# STAGE 1: Build do Frontend React
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# STAGE 2: Build do Backend & Imagem Final
FROM node:20-slim AS final
WORKDIR /app

# Copiar package.json e instalar dependências
COPY backend/package*.json ./
RUN npm install

# Copiar código-fonte do backend
COPY backend/ ./

# Copiar build do frontend para ser servido estaticamente pelo Fastify
COPY --from=frontend-builder /app/frontend/dist ./public

# Compilar TypeScript
RUN npm run build

# Criar pasta para volume SQLite
RUN mkdir -p /app/data

ENV PORT=3001
ENV DB_PATH=/app/data/mockforge.db

EXPOSE 3001

CMD ["npm", "start"]
