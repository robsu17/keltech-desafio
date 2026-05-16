# ─────────────────────────────────────────────
# Stage 1: builder
# Instala todas as dependências, gera o Prisma
# client e compila o TypeScript.
# ─────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Copia manifests primeiro para aproveitar cache de camadas
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma.config.ts ./
COPY prisma/ ./prisma/

RUN npm ci

# Gera o Prisma client (cria generated/prisma/ com os .ts)
RUN npx prisma generate

# Copia o source e compila
COPY src/ ./src/
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: production
# Imagem final enxuta com apenas o necessário
# para executar a aplicação.
# ─────────────────────────────────────────────
FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# prisma precisa estar disponível para rodar migrate deploy
COPY package*.json ./
RUN npm ci --omit=dev

# Copia o output compilado (inclui dist/generated/prisma/)
COPY --from=builder /app/dist ./dist

# Copia schema e migrations para o prisma migrate deploy
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Diretório de uploads (deve ser montado como volume em produção)
RUN mkdir -p uploads

EXPOSE 3333

# Aplica migrations pendentes e inicia a aplicação
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
