import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { corpsJson, erreur } from "@/lib/api/garde";
import { creerCouple, verifierIdentiteGoogle } from "@/lib/api/jetons";

const schema = z.object({
  /** `id_token` obtenu par la connexion Google native de l'app. */
  idToken: z.string().min(20),
  /** Libellé libre, pour distinguer les appareils dans les réglages. */
  appareil: z.string().max(120).optional(),
});

/**
 * Connexion de l'app mobile.
 *
 * L'app mène le flux OAuth elle-même — iOS l'impose, via SFAuthenticationSession
 * et PKCE — puis nous transmet le jeton d'identité. On le vérifie contre les
 * clés publiques de Google, jamais en faisant confiance à son contenu.
 *
 * Le compte est rattaché par `providerAccountId`, exactement comme le fait
 * l'adaptateur Auth.js côté web : se connecter depuis le téléphone retrouve le
 * même utilisateur que depuis le navigateur, pas un doublon.
 */
export async function POST(requete: Request) {
  const corps = await corpsJson<unknown>(requete);
  if (!corps.ok) return corps.reponse;

  const parse = schema.safeParse(corps.valeur);
  if (!parse.success) {
    return erreur(parse.error.issues[0]?.message ?? "Requête invalide", 400, "requete_invalide");
  }

  const identite = await verifierIdentiteGoogle(parse.data.idToken);
  if (!identite) {
    return erreur("Identité Google non vérifiable", 401, "google_invalide");
  }

  const existant = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: identite.sub,
      },
    },
    include: { user: true },
  });

  let user = existant?.user ?? null;

  if (!user && identite.email) {
    // Compte web déjà créé avec la même adresse : on rattache plutôt que de
    // dupliquer. Sûr ici parce que Google a vérifié l'adresse pour nous.
    const parEmail = await prisma.user.findUnique({ where: { email: identite.email } });
    if (parEmail) {
      user = parEmail;
      await prisma.account.create({
        data: {
          userId: parEmail.id,
          type: "oidc",
          provider: "google",
          providerAccountId: identite.sub,
        },
      });
    }
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: identite.email,
        name: identite.nom,
        image: identite.image,
        accounts: {
          create: { type: "oidc", provider: "google", providerAccountId: identite.sub },
        },
      },
    });
  }

  const jetons = await creerCouple(user.id, parse.data.appareil);

  return Response.json(
    {
      ...jetons,
      utilisateur: {
        id: user.id,
        email: user.email,
        nom: user.name,
        image: user.image,
        onboarded: user.onboarded,
        lp: user.lp,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
