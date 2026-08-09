/**
 * Migration SQLite → PostgreSQL, en deux temps.
 *
 * Un client Prisma ne connaît qu'un seul provider : impossible de lire l'une
 * et d'écrire l'autre dans le même processus. On passe donc par un fichier
 * JSON intermédiaire, entre lequel on bascule le schéma.
 *
 *   1. npx tsx scripts/migration-sqlite-postgres.ts export   (schéma SQLite)
 *   2. bascule du provider + `prisma db push` + `prisma db seed`
 *   3. npx tsx scripts/migration-sqlite-postgres.ts import   (schéma Postgres)
 *
 * Les référentiels — équipements, groupes, exercices — ne sont pas repris :
 * le seed les recrée à l'identique, et les réimporter risquerait de figer un
 * catalogue périmé.
 */
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const FICHIER = path.join(process.cwd(), "migration-donnees.json");

async function exporter() {
  const donnees = {
    users: await prisma.user.findMany(),
    accounts: await prisma.account.findMany(),
    sessions: await prisma.session.findMany(),
    userEquipments: await prisma.userEquipment.findMany(),
    userMuscleGroups: await prisma.userMuscleGroup.findMany(),
    weighIns: await prisma.weighIn.findMany(),
    workouts: await prisma.workoutLog.findMany(),
    planDays: await prisma.planDay.findMany(),
    charges: await prisma.exerciseLoad.findMany(),
  };

  fs.writeFileSync(FICHIER, JSON.stringify(donnees, null, 2));

  for (const [table, lignes] of Object.entries(donnees)) {
    console.log(`  ${table.padEnd(20)} ${lignes.length}`);
  }
  console.log(`\nÉcrit dans ${FICHIER}`);
}

async function importer() {
  if (!fs.existsSync(FICHIER)) throw new Error(`${FICHIER} introuvable — lance l'export d'abord`);
  const d = JSON.parse(fs.readFileSync(FICHIER, "utf8"));

  // Les dates repassent par des chaînes ISO dans le JSON.
  const dates = <T extends Record<string, unknown>>(ligne: T, champs: string[]): T => {
    const copie = { ...ligne } as Record<string, unknown>;
    for (const c of champs) if (copie[c]) copie[c] = new Date(copie[c] as string);
    return copie as T;
  };

  // Ordre imposé par les clés étrangères : l'utilisateur d'abord.
  await prisma.user.createMany({
    data: d.users.map((u: Record<string, unknown>) =>
      dates(u, ["emailVerified", "createdAt", "updatedAt"]),
    ),
  });
  await prisma.account.createMany({ data: d.accounts });
  await prisma.session.createMany({
    data: d.sessions.map((s: Record<string, unknown>) => dates(s, ["expires"])),
  });
  await prisma.userEquipment.createMany({ data: d.userEquipments });
  await prisma.userMuscleGroup.createMany({ data: d.userMuscleGroups });
  await prisma.weighIn.createMany({
    data: d.weighIns.map((w: Record<string, unknown>) => dates(w, ["date"])),
  });
  await prisma.workoutLog.createMany({
    data: d.workouts.map((w: Record<string, unknown>) => dates(w, ["date"])),
  });
  await prisma.planDay.createMany({
    data: d.planDays.map((p: Record<string, unknown>) => dates(p, ["date"])),
  });
  await prisma.exerciseLoad.createMany({
    data: d.charges.map((c: Record<string, unknown>) => dates(c, ["updatedAt"])),
  });

  console.log("Importé :");
  console.log(`  utilisateurs   ${await prisma.user.count()}`);
  console.log(`  comptes OAuth  ${await prisma.account.count()}`);
  console.log(`  sessions       ${await prisma.session.count()}`);
  console.log(`  pesées         ${await prisma.weighIn.count()}`);
  console.log(`  séances        ${await prisma.workoutLog.count()}`);
  console.log(`  jours de plan  ${await prisma.planDay.count()}`);
  console.log(`  charges        ${await prisma.exerciseLoad.count()}`);
}

const action = process.argv[2];
const taches: Record<string, () => Promise<void>> = { export: exporter, import: importer };

if (!taches[action]) {
  console.error("Usage : npx tsx scripts/migration-sqlite-postgres.ts export|import");
  process.exit(1);
}

taches[action]()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
