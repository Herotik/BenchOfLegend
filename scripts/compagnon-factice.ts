/**
 * Compagnon factice, pour éprouver la phalange sans deuxième téléphone.
 *
 *   npx tsx --conditions=react-server scripts/compagnon-factice.ts <ton-email> [options]
 *
 * Options :
 *   --nom <Nom>          Nom affiché. Détermine aussi l'adresse du compte,
 *                        donc relancer avec le même nom met à jour le même
 *                        compagnon au lieu d'en créer un second. (Brasidas)
 *   --lp <n>             Δ cumulés, qui décident du rang. (1800)
 *   --assiduite <0-100>  Part des séances de la semaine déjà validées. (100)
 *   --seances <n>        Séances prévues cette semaine. (4)
 *   --sans-demande       N'envoie pas de demande : à toi d'entrer le code.
 *   --supprimer          Efface tous les compagnons factices et s'arrête.
 *
 * Par défaut le compagnon t'envoie une demande, pour que tu aies quelque chose
 * à accepter en ouvrant l'app. Avec `--sans-demande`, le script se contente
 * d'afficher son code : c'est l'autre moitié du parcours, celle où c'est toi
 * qui demandes.
 *
 * `--conditions=react-server` est nécessaire : `lib/amis` est marqué
 * `server-only` et refuse de se charger sans.
 */
import { prisma } from "../lib/prisma";
import { codePersonnel, demander } from "../lib/amis";
import { estEchec } from "../lib/erreurs";
import { debutSemaineUTC, indexJour } from "../lib/semaine";

/** Suffixe réservé : c'est à lui que `--supprimer` reconnaît ses comptes. */
const DOMAINE = "@factice.frameoflegends.local";

/** Groupes travaillés par le compagnon — n'importe lesquels font l'affaire. */
const GROUPES = ["dos", "pectoraux", "jambes", "bras"];

function option(nom: string, defaut: string): string {
  const index = process.argv.indexOf(`--${nom}`);
  return index === -1 ? defaut : (process.argv[index + 1] ?? defaut);
}

async function main() {
  if (process.argv.includes("--supprimer")) {
    const { count } = await prisma.user.deleteMany({
      where: { email: { endsWith: DOMAINE } },
    });
    console.log(`${count} compagnon(s) factice(s) supprimé(s).`);
    console.log("Les liens partent avec eux : ils disparaîtront de ta phalange.");
    return;
  }

  const monEmail = process.argv[2];
  if (!monEmail || monEmail.startsWith("--")) {
    throw new Error(
      "Usage : npx tsx --conditions=react-server scripts/compagnon-factice.ts <ton-email> [--nom …]",
    );
  }

  const moi = await prisma.user.findUnique({ where: { email: monEmail } });
  if (!moi) throw new Error(`Aucun compte pour ${monEmail}`);

  const nom = option("nom", "Brasidas");
  const lp = Number(option("lp", "1800"));
  const assiduite = Number(option("assiduite", "100"));
  const seances = Number(option("seances", "4"));

  if (!Number.isFinite(lp) || lp < 0) throw new Error("--lp attend un entier positif.");
  if (!Number.isFinite(assiduite) || assiduite < 0 || assiduite > 100) {
    throw new Error("--assiduite attend un nombre entre 0 et 100.");
  }

  const email = `${nom.toLowerCase().replace(/[^a-z0-9]/g, "")}${DOMAINE}`;

  const compagnon = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: nom,
      onboarded: true,
      lp,
      daysPerWeek: 4,
      muscleGroups: { create: GROUPES.map((groupId) => ({ groupId })) },
    },
    update: { name: nom, lp },
  });

  // --- La semaine du compagnon ---------------------------------------------
  //
  // Seuls les jours **déjà passés** comptent : `lib/amis.ts` borne l'assiduité
  // à aujourd'hui, comme `lib/stats.ts`. Un lundi, il n'y a donc qu'un seul
  // jour disponible, et demander quatre séances n'en produirait pas quatre.
  const lundi = debutSemaineUTC();
  const joursEcoules = indexJour() + 1;
  const aPlanifier = Math.min(seances, joursEcoules, GROUPES.length);
  const faites = Math.round((assiduite / 100) * aPlanifier);

  await prisma.planDay.deleteMany({
    where: { userId: compagnon.id, date: { gte: lundi } },
  });
  await prisma.planDay.createMany({
    data: Array.from({ length: aPlanifier }, (_, i) => ({
      userId: compagnon.id,
      date: new Date(lundi.getTime() + i * 86_400_000),
      muscleGroup: GROUPES[i]!,
      // MANQUE et non PREVU pour les jours passés non faits : c'est ce que
      // `assurerPlans` en aurait fait, et l'assiduité les compte pareil.
      status: i < faites ? ("FAIT" as const) : ("MANQUE" as const),
    })),
  });

  const code = await codePersonnel(compagnon.id);
  const reel = aPlanifier > 0 ? Math.round((faites / aPlanifier) * 100) : null;

  console.log(`Compagnon « ${nom} » prêt.`);
  console.log(`  Δ ${lp}`);
  console.log(
    reel === null
      ? "  aucune séance cette semaine (nous sommes en début de semaine)"
      : `  ${faites} / ${aPlanifier} séances cette semaine, soit ${reel} %`,
  );
  if (aPlanifier < seances) {
    console.log(
      `  (${seances} demandées, mais la semaine ne compte que ${joursEcoules} jour(s) écoulé(s))`,
    );
  }
  console.log(`  code : ${code}`);

  if (process.argv.includes("--sans-demande")) {
    console.log("\nEntre ce code dans l'app : Aujourd'hui → Ma phalange → Rejoindre quelqu'un.");
    return;
  }

  const monCode = await codePersonnel(moi.id);
  const demande = await demander(compagnon.id, monCode);

  if (estEchec(demande)) {
    console.log(`\nPas de demande envoyée : ${demande.erreur}`);
    console.log("Vous êtes sans doute déjà liés — regarde ta phalange dans l'app.");
    return;
  }

  console.log("\nDemande envoyée. Ouvre l'app : elle t'attend en haut de la phalange.");
  console.log("Pour tout effacer ensuite : relance avec --supprimer.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
