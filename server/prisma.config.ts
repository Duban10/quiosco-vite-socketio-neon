import { defineConfig } from "prisma/config";

// DATABASE_URL viene directo del entorno en Railway/producción.
// El bloque try/catch permite que el config cargue incluso durante el build,
// cuando la variable puede no estar disponible aún.
const databaseUrl = process.env.DATABASE_URL ?? '';

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  ...(databaseUrl ? {
    datasource: {
      url: databaseUrl,
    },
  } : {}),
});
