import "server-only";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

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
