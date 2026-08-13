import { afterEach, describe, expect, it } from "vitest";
import { rattacherOuCreer } from "@/lib/api/comptes";
import { creerUtilisateur, nettoyerBase, prisma } from "./aide";

/**
 * Rattachement des connexions natives de l'app mobile.
 *
 * C'est le module qui décide si l'on retrouve son compte ou si l'on en crée un
 * second, avec ses propres séances et son propre rang. Une erreur ici ne lève
 * aucune exception : elle dédouble silencieusement, et ne se découvre qu'au
 * moment où l'historique a disparu.
 */

afterEach(nettoyerBase);

const identite = (over: Record<string, unknown> = {}) => ({
  fournisseur: "google",
  sub: "sub-google-1",
  email: "alex@exemple.test",
  nom: "Alex",
  image: null,
  emailVerifie: true,
  ...over,
});

describe("rattacherOuCreer", () => {
  it("retrouve le compte déjà lié à cette connexion", async () => {
    const user = await creerUtilisateur();
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "oidc",
        provider: "google",
        providerAccountId: "sub-google-1",
      },
    });

    const trouve = await rattacherOuCreer(identite());

    expect(trouve.id).toBe(user.id);
    expect(await prisma.user.count()).toBe(1);
  });

  it("rattache une connexion neuve au compte portant la même adresse vérifiée", async () => {
    // Le cas central : inscrit par le site avec Google, on revient par Apple.
    const user = await creerUtilisateur();
    await prisma.user.update({
      where: { id: user.id },
      data: { email: "alex@exemple.test" },
    });

    const trouve = await rattacherOuCreer(
      identite({ fournisseur: "apple", sub: "sub-apple-1" }),
    );

    expect(trouve.id).toBe(user.id);
    expect(await prisma.user.count()).toBe(1);
    const lien = await prisma.account.findFirstOrThrow({ where: { provider: "apple" } });
    expect(lien.userId).toBe(user.id);
  });

  it("ne rattache jamais sur une adresse non vérifiée", async () => {
    // Sans cette règle, déclarer l'adresse de quelqu'un chez un fournisseur
    // qui ne la vérifie pas — Discord en accepte — suffirait à entrer chez lui.
    const user = await creerUtilisateur();
    await prisma.user.update({
      where: { id: user.id },
      data: { email: "alex@exemple.test" },
    });

    const trouve = await rattacherOuCreer(
      identite({ fournisseur: "discord", sub: "sub-discord-1", emailVerifie: false }),
    );

    expect(trouve.id).not.toBe(user.id);
    expect(await prisma.user.count()).toBe(2);
    // L'adresse n'est pas retenue non plus : la colonne est unique, et la
    // planter là condamnerait le vrai titulaire à ne jamais pouvoir entrer.
    expect(trouve.email).toBeNull();
  });

  it("crée un compte à la première connexion", async () => {
    const cree = await rattacherOuCreer(identite());

    expect(cree.email).toBe("alex@exemple.test");
    expect(cree.name).toBe("Alex");
    expect(cree.onboarded).toBe(false);
    const lien = await prisma.account.findFirstOrThrow({ where: { userId: cree.id } });
    expect(lien.providerAccountId).toBe("sub-google-1");
  });

  it("ne confond pas deux fournisseurs partageant un même identifiant", async () => {
    // `sub` n'est unique que chez son fournisseur : rien n'interdit à Discord
    // d'attribuer un jour le même identifiant que Google.
    const premier = await rattacherOuCreer(identite({ email: null }));
    const second = await rattacherOuCreer(
      identite({ fournisseur: "discord", email: null, emailVerifie: false }),
    );

    expect(second.id).not.toBe(premier.id);
    expect(await prisma.account.count()).toBe(2);
  });

  it("est idempotent : deux connexions successives ne dédoublent pas", async () => {
    const premier = await rattacherOuCreer(identite());
    const second = await rattacherOuCreer(identite());

    expect(second.id).toBe(premier.id);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.account.count()).toBe(1);
  });
});
