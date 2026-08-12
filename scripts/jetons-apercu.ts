/**
 * Émet un couple de jetons pour prévisualiser l'app dans un navigateur.
 *
 * Le relais navigateur ne fonctionne pas sur le web : `retourAutorise` n'y
 * accepte que des schémas d'application, précisément pour ne pas devenir une
 * redirection ouverte. Pour regarder les écrans, on court-circuite donc le
 * relais en signant directement — avec les fonctions du serveur, pas une
 * imitation, de sorte que ce qui s'affiche est bien ce que l'API renvoie.
 *
 *     npx tsx scripts/jetons-apercu.ts
 *
 * À n'utiliser qu'en développement, sur sa propre base.
 */
import { prisma } from "../lib/prisma";
import { creerJetonAcces, creerJetonRafraichissement } from "../lib/api/jetons";

async function main() {
  const utilisateur = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true },
  });

  if (!utilisateur) {
    console.error("Aucun utilisateur en base. Connecte-toi d'abord sur le web.");
    process.exit(1);
  }

  const accessToken = await creerJetonAcces(utilisateur.id);
  const refreshToken = await creerJetonRafraichissement(utilisateur.id, "Aperçu navigateur");

  console.log(
    JSON.stringify(
      {
        compte: utilisateur.email ?? utilisateur.name ?? utilisateur.id,
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
