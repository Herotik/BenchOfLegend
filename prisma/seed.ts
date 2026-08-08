import { PrismaClient } from "@prisma/client";
import { EQUIPMENTS, MUSCLE_GROUPS, AUCUN_EQUIPEMENT, parseEquipment } from "../lib/referentiel";
import { EXERCISES } from "./exercises";

const prisma = new PrismaClient();

/**
 * Le catalogue d'exercices est du contenu écrit à la main : une faute de frappe
 * dans un nom de progression ou un slug de matériel passerait inaperçue et
 * casserait le moteur de séance bien plus tard. On vérifie donc tout avant
 * d'écrire quoi que ce soit en base.
 */
function validerExercices(): void {
  const erreurs: string[] = [];

  const groupesConnus = new Set<string>(MUSCLE_GROUPS.map((g) => g.id));
  const materielConnu = new Set<string>(EQUIPMENTS.map((e) => e.id));
  const noms = new Set<string>();

  for (const exo of EXERCISES) {
    if (noms.has(exo.name)) erreurs.push(`Nom en double : « ${exo.name} »`);
    noms.add(exo.name);

    if (!groupesConnus.has(exo.muscleGroup)) {
      erreurs.push(`« ${exo.name} » : groupe musculaire inconnu « ${exo.muscleGroup} »`);
    }

    for (const slug of parseEquipment(exo.equipment)) {
      if (!materielConnu.has(slug)) {
        erreurs.push(`« ${exo.name} » : matériel inconnu « ${slug} »`);
      }
    }

    if ((exo.type === "CARDIO") !== (exo.muscleGroup === "cardio")) {
      erreurs.push(
        `« ${exo.name} » : le type CARDIO et le groupe « cardio » vont de pair (type=${exo.type}, groupe=${exo.muscleGroup})`,
      );
    }

    if (!exo.description || exo.description.trim().length < 20) {
      erreurs.push(`« ${exo.name} » : description absente ou trop courte`);
    }

    if (exo.progression === exo.name) {
      erreurs.push(`« ${exo.name} » : se référence elle-même en progression`);
    }
  }

  // Les progressions doivent pointer vers un exercice existant...
  for (const exo of EXERCISES) {
    if (exo.progression && !noms.has(exo.progression)) {
      erreurs.push(`« ${exo.name} » : progression orpheline vers « ${exo.progression} »`);
    }
  }

  // ...et ne jamais boucler, sinon la suggestion de variante tournerait en rond.
  const parNom = new Map(EXERCISES.map((e) => [e.name, e]));
  for (const depart of EXERCISES) {
    const vus = new Set<string>([depart.name]);
    let courant = depart.progression;
    while (courant) {
      if (vus.has(courant)) {
        erreurs.push(`Cycle de progression détecté à partir de « ${depart.name} »`);
        break;
      }
      vus.add(courant);
      courant = parNom.get(courant)?.progression ?? null;
    }
  }

  // Un utilisateur sans matériel doit avoir de quoi remplir une séance (4 à 6
  // exercices) sur n'importe quel groupe qu'il aura choisi.
  const MIN_POIDS_DE_CORPS = 6;
  for (const groupe of MUSCLE_GROUPS) {
    const n = EXERCISES.filter(
      (e) => e.muscleGroup === groupe.id && e.equipment === AUCUN_EQUIPEMENT,
    ).length;
    if (n < MIN_POIDS_DE_CORPS) {
      erreurs.push(
        `Groupe « ${groupe.id} » : ${n} exercice(s) au poids de corps, ${MIN_POIDS_DE_CORPS} attendus`,
      );
    }
  }

  if (erreurs.length > 0) {
    throw new Error(`Catalogue d'exercices invalide :\n  - ${erreurs.join("\n  - ")}`);
  }
}

async function main() {
  validerExercices();

  for (const equipement of EQUIPMENTS) {
    await prisma.equipment.upsert({
      where: { id: equipement.id },
      update: { label: equipement.label },
      create: { ...equipement },
    });
  }

  for (const groupe of MUSCLE_GROUPS) {
    await prisma.muscleGroup.upsert({
      where: { id: groupe.id },
      update: { label: groupe.label },
      create: { ...groupe },
    });
  }

  // `name` est unique : on peut rejouer le seed sans dupliquer le catalogue.
  for (const exo of EXERCISES) {
    await prisma.exercise.upsert({
      where: { name: exo.name },
      update: exo,
      create: exo,
    });
  }

  const total = await prisma.exercise.count();
  console.log(
    `Seed terminé : ${EQUIPMENTS.length} équipements, ${MUSCLE_GROUPS.length} groupes musculaires, ${total} exercices.`,
  );

  for (const groupe of MUSCLE_GROUPS) {
    const tous = await prisma.exercise.count({ where: { muscleGroup: groupe.id } });
    const pdc = await prisma.exercise.count({
      where: { muscleGroup: groupe.id, equipment: AUCUN_EQUIPEMENT },
    });
    console.log(`  ${groupe.label.padEnd(12)} ${String(tous).padStart(3)} dont ${pdc} au poids de corps`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
