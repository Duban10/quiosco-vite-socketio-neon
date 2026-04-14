FROM node:20.19.1-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Instalar dependencias
RUN npm ci --omit=dev

# Copiar el resto del código
COPY . .

# Generar el cliente de Prisma
RUN npx prisma generate --schema=prisma/schema.prisma

# Exponer puerto
EXPOSE 3001

# Comando de inicio
CMD ["node", "--import", "tsx/esm", "index.ts"]
