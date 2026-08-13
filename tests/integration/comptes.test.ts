import { afterEach, describe, expect, it } from "vitest";
import { detacher, listerConnexions, rattacherA, rattacherOuCreer } from "@/lib/api/comptes";
import { estEchec } from "@/lib/erreurs";
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

/**
 * Rattachement depuis les réglages, compte déjà ouvert.
 *
 * Toute la différence avec ce qui précède : l'identité est prouvée par la
 * session, non par l'adresse. C'est ce qui permet de réunir un identifiant
 * Apple et un compte Google qui n'en partagent aucune — mais c'est aussi ce
 * qui rend le garde-fou du compte d'autrui indispensable.
 */
describe("rattacherA", () => {
  const preuve = (over: Record<string, unknown> = {}) => ({
    fournisseur: "apple",
    sub: "sub-apple-1",
    email: "autre@icloud.test",
    nom: null,
    image: null,
    emailVerifie: true,
    ...over,
  });

  it("rattache une connexion dont l'adresse n'a rien à voir", async () => {
    // Le cas qui a motivé la fonction : l'iCloud et le Gmail d'une même
    // personne n'ont aucune raison de coïncider.
    const user = await creerUtilisateur();
    await prisma.user.update({ where: { id: user.id }, data: { email: "moi@gmail.test" } });
    await prisma.account.create({
      data: { userId: user.id, type: "oidc", provider: "google", providerAccountId: "g-1" },
    });

    expect(await rattacherA(user.id, preuve())).toEqual({ ok: true });
    expect(await listerConnexions(user.id)).toEqual(["apple", "google"]);
  });

  it("ne déplace jamais une connexion appartenant à un autre compte", async () => {
    // La déplacer priverait l'autre compte de sa porte d'entrée, peut-être la
    // seule — c'est exactement le doublon qu'on cherche à réunir, et il ne faut
    // surtout pas le faire dans son dos.
    const autre = await creerUtilisateur();
    await prisma.account.create({
      data: { userId: autre.id, type: "oidc", provider: "apple", providerAccountId: "sub-apple-1" },
    });
    const moi = await creerUtilisateur();

    const resultat = await rattacherA(moi.id, preuve());

    expect(estEchec(resultat) && resultat.code).toBe("deja_rattachee_ailleurs");
    expect(await listerConnexions(moi.id)).toEqual([]);
    expect(await listerConnexions(autre.id)).toEqual(["apple"]);
  });

  it("ne se plaint pas quand la connexion est déjà la sienne", async () => {
    const user = await creerUtilisateur();
    await rattacherA(user.id, preuve());

    expect(await rattacherA(user.id, preuve())).toEqual({ ok: true });
    expect(await prisma.account.count()).toBe(1);
  });

  it("refuse un second compte du même fournisseur", async () => {
    const user = await creerUtilisateur();
    await rattacherA(user.id, preuve());

    const resultat = await rattacherA(user.id, preuve({ sub: "sub-apple-2" }));

    expect(estEchec(resultat) && resultat.code).toBe("fournisseur_deja_present");
  });
});

describe("detacher", () => {
  async function utilisateurAvec(...fournisseurs: string[]) {
    const user = await creerUtilisateur();
    for (const f of fournisseurs) {
      await prisma.account.create({
        // L'identifiant porte celui de l'utilisateur : `[provider,
        // providerAccountId]` est unique, et deux utilisateurs de test ne
        // peuvent pas se partager la même identité chez un fournisseur.
        data: { userId: user.id, type: "oidc", provider: f, providerAccountId: `${f}-${user.id}` },
      });
    }
    return user;
  }

  it("retire une connexion quand il en reste une autre", async () => {
    const user = await utilisateurAvec("google", "apple");

    expect(await detacher(user.id, "apple")).toEqual({ ok: true });
    expect(await listerConnexions(user.id)).toEqual(["google"]);
  });

  it("refuse de retirer la dernière", async () => {
    // Sans mot de passe, ce serait fermer le compte définitivement, sans
    // aucun recours — pas même par une adresse e-mail.
    const user = await utilisateurAvec("google");

    const resultat = await detacher(user.id, "google");

    expect(estEchec(resultat) && resultat.code).toBe("derniere_connexion");
    expect(await listerConnexions(user.id)).toEqual(["google"]);
  });

  it("refuse une connexion qui n'est pas rattachée", async () => {
    const user = await utilisateurAvec("google", "apple");

    const resultat = await detacher(user.id, "discord");

    expect(estEchec(resultat) && resultat.code).toBe("connexion_absente");
    expect(await listerConnexions(user.id)).toHaveLength(2);
  });

  it("ne touche jamais aux connexions d'autrui", async () => {
    const autre = await utilisateurAvec("google");
    const moi = await utilisateurAvec("google", "apple");

    await detacher(moi.id, "google");

    expect(await listerConnexions(autre.id)).toEqual(["google"]);
  });
});
