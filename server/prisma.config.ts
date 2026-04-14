import { defineConfig } from "prisma/config";

// En Railway las variables de entorno ya están disponibles en process.env directamente.
// No usamos dotenv/config aquí para evitar errores cuando no hay archivo .env.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_URL no está definida en las variables de entorno.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
