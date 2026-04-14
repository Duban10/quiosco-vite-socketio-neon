// prisma.config.ts solo se usa en desarrollo local para el CLI (prisma db push, etc.)
// En producción Railway usa DATABASE_URL directamente en el runtime via PrismaPg adapter.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
});
