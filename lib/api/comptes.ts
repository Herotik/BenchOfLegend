import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { echec, type EchecMetier } from "@/lib/erreurs";

/**
 * Rattachement d'un compte natif de l'app mobile.
 *
 * Les connexions natives — Google, Apple, Discord — court-circuitent Auth.js :
 * l'app mène le flux elle-même et nous transmet une preuve d'identité, que la
 * route vérifie avant d'arriver ici. Il reste à retrouver l'utilisateur, ou à
 * le créer, **exactement comme l'adaptateur Auth.js le ferait côté web** —
 * faute de quoi se connecter depuis le téléphone créerait un compte parallèle,
 * avec ses propres séances et son propre rang.
 *
 * Ce module existe parce que la règle est subtile et qu'il y en a désormais
 * trois exemplaires possibles. Recopiée trois fois, elle aurait divergé.
 */

export interface IdentiteFournisseur {
  /** Identifiant Auth.js du fournisseur : « google », « apple », « discord ». */
  fournisseur: string;
  /** Identifiant stable de l'utilisateur **chez lui**. */
  sub: string;
  email: string | null;
  nom: string | null;
  image: string | null;
  /**
   * Le fournisseur a-t-il vérifié cette adresse ?
   *
   * Décisif : c'est la seule chose qui autorise à rattacher cette connexion à
   * un compte existant portant la même adresse. Sans vérification, déclarer
   * l'adresse d'autrui suffirait à entrer chez lui.
   */
  emailVerifie: boolean;
}

/**
 * Rattache une connexion à un compte **déjà identifié**.
 *
 * Ici, l'adresse e-mail n'arbitre rien : c'est la session en cours qui prouve
 * qui l'on est. C'est ce qui permet de réunir un identifiant Apple et un compte
 * Google qui ne portent pas la même adresse — cas courant, l'iCloud et le Gmail
 * d'une même personne n'ayant aucune raison de coïncider.
 *
 * Le contrôle qui compte est ailleurs : une identité déjà rattachée à **un
 * autre** compte n'est jamais déplacée. La déplacer priverait cet autre compte
 * de sa porte d'entrée, peut-être la seule.
 */
export async function rattacherA(
  userId: string,
  identite: IdentiteFournisseur,
): Promise<{ ok: true } | EchecMetier> {
  const { fournisseur, sub } = identite;

  const existant = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: fournisseur, providerAccountId: sub } },
  });

  if (existant) {
    // Déjà la sienne : on ne fait rien, et on ne s'en plaint pas. Appuyer deux
    // fois sur le bouton ne doit pas produire une erreur.
    if (existant.userId === userId) return { ok: true };
    return echec(
      "Cette connexion est déjà rattachée à un autre compte. Connecte-toi avec elle, puis supprime ce compte-là.",
      "deja_rattachee_ailleurs",
      409,
    );
  }

  const duMemeFournisseur = await prisma.account.findFirst({
    where: { userId, provider: fournisseur },
  });
  if (duMemeFournisseur) {
    return echec(
      `Une connexion ${fournisseur} est déjà rattachée à ce compte.`,
      "fournisseur_deja_present",
      409,
    );
  }

  await prisma.account.create({
    data: { userId, type: "oidc", provider: fournisseur, providerAccountId: sub },
  });

  return { ok: true };
}

/** Façons de se connecter actuellement rattachées, dans un ordre stable. */
export async function listerConnexions(userId: string) {
  const comptes = await prisma.account.findMany({
    where: { userId },
    select: { provider: true },
    orderBy: { provider: "asc" },
  });
  return comptes.map((c) => c.provider);
}

/**
 * Retire une façon de se connecter — **jamais la dernière**.
 *
 * L'app n'a pas de mot de passe : retirer la seule connexion restante rendrait
 * le compte définitivement inaccessible, sans aucun recours.
 */
export async function detacher(
  userId: string,
  fournisseur: string,
): Promise<{ ok: true } | EchecMetier> {
  const comptes = await prisma.account.findMany({ where: { userId } });

  if (!comptes.some((c) => c.provider === fournisseur)) {
    return echec("Cette connexion n'est pas rattachée à ce compte.", "connexion_absente", 404);
  }
  if (comptes.length <= 1) {
    return echec(
      "C'est ta seule façon de te connecter : la retirer fermerait ton compte pour de bon.",
      "derniere_connexion",
      409,
    );
  }

  await prisma.account.deleteMany({ where: { userId, provider: fournisseur } });
  return { ok: true };
}

export async function rattacherOuCreer(identite: IdentiteFournisseur): Promise<User> {
  const { fournisseur, sub, email, nom, image } = identite;

  // 1. Cette connexion est-elle déjà connue ? C'est le cas courant.
  const existant = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: fournisseur, providerAccountId: sub } },
    include: { user: true },
  });
  if (existant) return existant.user;

  // 2. Un compte porte-t-il déjà cette adresse ? Se connecter autrement ne doit
  //    pas dupliquer le compte — mais seulement si l'adresse a été vérifiée.
  if (email && identite.emailVerifie) {
    const parEmail = await prisma.user.findUnique({ where: { email } });
    if (parEmail) {
      await prisma.account.create({
        data: { userId: parEmail.id, type: "oidc", provider: fournisseur, providerAccountId: sub },
      });
      return parEmail;
    }
  }

  // 3. Personne : c'est une première connexion.
  return prisma.user.create({
    data: {
      // L'adresse n'est retenue que vérifiée : la colonne est unique, et une
      // adresse déclarative y planterait le drapeau de quelqu'un d'autre pour
      // le jour où celui-ci se connecterait vraiment.
      email: identite.emailVerifie ? email : null,
      name: nom,
      image,
      accounts: {
        create: { type: "oidc", provider: fournisseur, providerAccountId: sub },
      },
    },
  });
}
