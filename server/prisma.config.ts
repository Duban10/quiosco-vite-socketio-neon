import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // La URL solo se provee si DATABASE_URL existe (desarrollo local).
  // En Railway/producción, prisma generate no necesita la URL —
  // solo la necesita prisma db push/migrate, que no corre en producción.
  ...(process.env.DATABASE_URL ? {
    datasource: { url: process.env.DATABASE_URL }
  } : {}),
});
