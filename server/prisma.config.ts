import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // La URL de base de datos NO es necesaria para prisma generate.
  // Solo se necesita para prisma db push/migrate (que corren en desarrollo local).
  // En producción (Railway), el runtime usa el adapter PrismaPg con DATABASE_URL.
});
