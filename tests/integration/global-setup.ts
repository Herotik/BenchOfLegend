import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Prépare la base de test, une fois pour toute la suite.
 *
 * La base de développement contient les vraies données de l'utilisateur et ne
 * doit jamais être touchée : tout passe par une base Postgres distincte,
 * `lafaille_test`, sur la même instance Docker. Elle est recréée à vide ici.
 */

const RACINE = path.resolve(import.meta.dirname, "..", "..");

/** Base de test dédiée, sur l'instance Postgres montée par docker compose. */
export const NOM_BASE_TEST = "lafaille_test";
export const URL_BASE_TEST =
  process.env.DATABASE_URL_TEST ??
  `postgresql://lafaille:lafaille@localhost:5433/${NOM_BASE_TEST}?schema=public`;

/** Même instance, mais base d'administration : on ne peut pas supprimer celle où l'on est connecté. */
const URL_ADMIN = URL_BASE_TEST.replace(`/${NOM_BASE_TEST}?`, "/postgres?");

const BINAIRE_PRISMA = path.join(RACINE, "node_modules", "prisma", "build", "index.js");
const BINAIRE_TSX = path.join(RACINE, "node_modules", "tsx", "dist", "cli.mjs");

function lancer(script: string, args: string[]): void {
  execFileSync(process.execPath, [script, ...args], {
    cwd: RACINE,
    // Les variables déjà présentes dans l'environnement priment sur `.env` :
    // `prisma.config.ts` a beau appeler `process.loadEnvFile`, DATABASE_URL
    // reste celle qu'on impose ici.
    env: { ...process.env, DATABASE_URL: URL_BASE_TEST },
    stdio: "pipe",
  });
}

/** Recrée la base de test à vide, en se connectant à `postgres` pour la piloter. */
async function recreerBaseTest(): Promise<void> {
  const { PrismaClient } = await import("@prisma/client");
  const admin = new PrismaClient({ datasourceUrl: URL_ADMIN });
  try {
    // WITH (FORCE) coupe les connexions restées ouvertes par une exécution
    // précédente interrompue, sinon le DROP reste bloqué indéfiniment.
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${NOM_BASE_TEST}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${NOM_BASE_TEST}"`);
  } finally {
    await admin.$disconnect();
  }
}

export default async function preparerBaseDeTest() {
  process.env.DATABASE_URL = URL_BASE_TEST;

  // On repart d'une base vierge plutôt que de demander à Prisma un
  // `--force-reset` : le résultat est le même, et piloter un nom de base qu'on
  // maîtrise ne peut pas déraper sur celle de développement.
  await recreerBaseTest();

  lancer(BINAIRE_PRISMA, ["db", "push", "--skip-generate"]);
  lancer(BINAIRE_TSX, [path.join("prisma", "seed.ts")]);

  // Vérification a posteriori : on demande à Postgres à quelle base il est
  // réellement connecté. Un test ne démarre pas tant que ce n'est pas celle-ci.
  const { PrismaClient } = await import("@prisma/client");
  const client = new PrismaClient();
  try {
    const [{ current_database }] = await client.$queryRawUnsafe<{ current_database: string }[]>(
      "SELECT current_database()",
    );
    if (current_database !== NOM_BASE_TEST) {
      throw new Error(
        `Base inattendue : les tests s'apprêtaient à écrire dans « ${current_database} » ` +
          `au lieu de « ${NOM_BASE_TEST} ». Suite interrompue.`,
      );
    }
    const exercices = await client.exercise.count();
    if (exercices === 0) throw new Error("Le seed n'a chargé aucun exercice.");
  } finally {
    await client.$disconnect();
  }
}
