import { prisma } from "@/lib/prisma";
import { authentifier } from "@/lib/api/garde";
import { jsonPrive } from "@/lib/api/reponse";
import { lirePreferences } from "@/lib/preferences";
import { rankLabel, rankProgressForLp } from "@/lib/ranks";

/**
 * Profil, préférences, rang et progression.
 *
 * `authentifier` seul, et non `authentifierOnboarde` : l'app appelle cette
 * route juste après la connexion, précisément pour savoir s'il faut afficher
 * l'onboarding. La lui refuser par un 409 la laisserait sans rien à montrer.
 */
export async function GET(requete: Request) {
  const auth = await authentifier(requete);
  if (!auth.ok) return auth.reponse;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: auth.valeur.id },
    select: { id: true, name: true, email: true, image: true, onboarded: true, lp: true, createdAt: true },
  });

  const progression = rankProgressForLp(user.lp);

  return jsonPrive({
    utilisateur: {
      id: user.id,
      nom: user.name,
      email: user.email,
      image: user.image,
      onboarded: user.onboarded,
      inscritLe: user.createdAt.toISOString(),
    },
    // Un profil incomplet n'a pas encore de préférences à montrer : les lire
    // quand même rendrait des valeurs par défaut que l'utilisateur n'a jamais
    // choisies, et que le formulaire présenterait comme siennes.
    preferences: user.onboarded ? await lirePreferences(user.id) : null,
    lp: user.lp,
    rang: {
      slug: progression.rank.slug,
      nom: progression.rank.name,
      sousTitre: progression.rank.subtitle,
      couleur: progression.rank.color,
      logo: progression.rank.logo,
      division: progression.division,
      libelle: rankLabel(user.lp),
      lpDansDivision: progression.lpInDivision,
      lpProchaineDivision: progression.lpToNextDivision,
      progression: progression.progress,
    },
  });
}
