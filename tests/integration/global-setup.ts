import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Prépare la base de test, une fois pour toute la suite.
 *
 * `prisma/dev.db` contient les vraies données de l'utilisateur et ne doit
 * jamais être touchée : tout passe par `prisma/test.db`, créée ici et
 * supprimée au démontage.
 */

const RACINE = path.resolve(import.meta.dirname, "..", "..");

/** Chemin relatif au `schema.prisma`, comme le fait `.env` pour dev.db. */
export const URL_BASE_TEST = "file:./test.db";
const FICHIER_BASE_TEST = path.join(RACINE, "prisma", "test.db");

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

/**
 * Supprime la base de test et ses fichiers annexes (journal, WAL).
 *
 * `maxRetries` : sous Windows, le fichier reste verrouillé quelques
 * millisecondes après la fermeture du dernier processus de test.
 */
function supprimerBaseTest(): void {
  for (const suffixe of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(`${FICHIER_BASE_TEST}${suffixe}`, { force: true, maxRetries: 20, retryDelay: 100 });
  }
}

export default async function preparerBaseDeTest() {
  process.env.DATABASE_URL = URL_BASE_TEST;

  // On repart d'un fichier vierge plutôt que de demander à Prisma un
  // `--force-reset` : le résultat est le même, et supprimer un fichier dont on
  // maîtrise le nom ne peut pas déraper sur une autre base.
  supprimerBaseTest();

  lancer(BINAIRE_PRISMA, ["db", "push", "--skip-generate"]);
  lancer(BINAIRE_TSX, [path.join("prisma", "seed.ts")]);

  // Vérification a posteriori : on demande à SQLite quel fichier il a
  // réellement ouvert. Un test ne démarre pas tant que ce n'est pas test.db.
  const { PrismaClient } = await import("@prisma/client");
  const client = new PrismaClient();
  try {
    const bases = await client.$queryRawUnsafe<{ file: string }[]>("PRAGMA database_list");
    const fichier = bases[0]?.file ?? "";
    if (path.resolve(fichier) !== FICHIER_BASE_TEST) {
      throw new Error(
        `Base inattendue : les tests s'apprêtaient à écrire dans « ${fichier} » ` +
          `au lieu de « ${FICHIER_BASE_TEST} ». Suite interrompue.`,
      );
    }
    const exercices = await client.exercise.count();
    if (exercices === 0) throw new Error("Le seed n'a chargé aucun exercice.");
  } finally {
    await client.$disconnect();
  }

  return () => supprimerBaseTest();
}
