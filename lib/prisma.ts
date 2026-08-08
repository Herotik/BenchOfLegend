import { PrismaClient } from "@prisma/client";

// En développement, Next.js recharge les modules à chaque modification : sans
// ce cache global on ouvrirait une nouvelle connexion à chaque rechargement
// jusqu'à saturer la base.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
