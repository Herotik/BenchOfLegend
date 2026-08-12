/**
 * Compte d'essai vierge, pour éprouver l'onboarding.
 *
 * Le compte réel est déjà rempli, et `POST /me/onboarding` refuse d'être
 * rejoué — le rejouer écraserait des préférences choisies et la pesée du jour.
 * Plutôt que de retirer le drapeau sur un vrai compte, on en crée un à côté :
 * l'essai peut échouer sans conséquence, et se répéter autant que voulu.
 *
 *     npx tsx --conditions=react-server scripts/compte-essai.ts [--reinitialiser]
 *
 * Avec `--reinitialiser`, le compte existant est effacé puis recréé vierge.
 */
import { prisma } from "../lib/prisma";
import { creerJetonAcces, creerJetonRafraichissement } from "../lib/api/jetons";

const EMAIL = "essai@frameoflegends.local";

async function main() {
  if (process.argv.includes("--reinitialiser")) {
    // Les tables liées partent en cascade : voir les relations du schéma.
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  }

  const utilisateur =
    (await prisma.user.findUnique({ where: { email: EMAIL } })) ??
    (await prisma.user.create({
      data: { email: EMAIL, name: "Compte d'essai", onboarded: false },
    }));

  const accessToken = await creerJetonAcces(utilisateur.id);
  const refreshToken = await creerJetonRafraichissement(utilisateur.id, "Aperçu navigateur");

  console.log(
    JSON.stringify(
      {
        compte: utilisateur.email,
        onboarded: utilisateur.onboarded,
        "fol.jeton_acces": accessToken,
        "fol.jeton_rafraichissement": refreshToken,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
