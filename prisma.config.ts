import path from "node:path";
import fs from "node:fs";
import { defineConfig } from "prisma/config";

// Remplace la clé `prisma` du package.json, dépréciée et retirée en Prisma 7.
//
// Dès qu'un fichier de config existe, la CLI Prisma cesse de charger `.env`
// toute seule — il faut le faire ici, sinon DATABASE_URL est introuvable.
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
