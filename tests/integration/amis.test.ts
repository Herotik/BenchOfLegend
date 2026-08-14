import { afterEach, describe, expect, it } from "vitest";
import {
  codePersonnel,
  demander,
  listerPhalange,
  normaliserCode,
  repondre,
  rompre,
} from "@/lib/amis";
import { estEchec } from "@/lib/erreurs";
import { jourUTC } from "@/lib/dates";
import { debutSemaineUTC } from "@/lib/semaine";
import { GET as getPhalange, POST as postDemande } from "@/app/api/v1/amis/route";
import { GET as getCode } from "@/app/api/v1/amis/code/route";
import { creerUtilisateur, nettoyerBase, prisma, reponseJson, requeteApi } from "./aide";

/**
 * La phalange.
 *
 * Deux choses se jouent ici et aucune ne lève d'exception quand elle rate. La
 * première : ne jamais laisser sortir d'un compte ce qui n'a pas à en sortir —
 * un poids qui fuit ne se voit pas dans les tests fonctionnels, seulement dans
 * l'app de quelqu'un d'autre. La seconde : l'unicité de la paire, dont
 * l'absence produirait deux amitiés entre les mêmes personnes sans que rien ne
 * proteste.
 */

afterEach(nettoyerBase);

/** Deux comptes prêts à se lier. */
async function deuxComptes() {
  const alex = await creerUtilisateur();
  const sam = await creerUtilisateur();
  return { alex, sam };
}

/** Noue une amitié acceptée entre deux comptes. */
async function lier(a: { id: string }, b: { id: string }) {
  const code = await codePersonnel(b.id);
  const demande = await demander(a.id, code);
  if (estEchec(demande)) throw new Error(demande.erreur);
  const reponse = await repondre(b.id, demande.amitieId, true);
  if (estEchec(reponse)) throw new Error(reponse.erreur);
  return demande.amitieId;
}

describe("code personnel", () => {
  it("est stable d'un appel à l'autre", async () => {
    const user = await creerUtilisateur();
    expect(await codePersonnel(user.id)).toBe(await codePersonnel(user.id));
  });

  it("n'emploie aucun caractère ambigu", async () => {
    const user = await creerUtilisateur();
    const code = await codePersonnel(user.id);
    // Ni O ni 0, ni I ni 1 : le code se recopie à la main aussi souvent qu'il
    // se colle, et ces quatre-là se confondent deux à deux.
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });

  it("change à la régénération, et l'ancien ne vaut plus rien", async () => {
    const { alex, sam } = await deuxComptes();
    const ancien = await codePersonnel(sam.id);
    const nouveau = await codePersonnel(sam.id, { regenerer: true });

    expect(nouveau).not.toBe(ancien);
    const avecAncien = await demander(alex.id, ancien);
    expect(estEchec(avecAncien) && avecAncien.code).toBe("code_inconnu");
  });

  it("accepte le code sans tiret et en minuscules", () => {
    expect(normaliserCode("abcd2345")).toBe("ABCD-2345");
    expect(normaliserCode(" abcd-2345 ")).toBe("ABCD-2345");
    expect(normaliserCode("ABCD-234")).toBeNull();
    // O et I n'appartiennent pas à l'alphabet : les accepter reviendrait à
    // livrer un code que personne ne porte.
    expect(normaliserCode("ABCO-2345")).toBeNull();
  });
});

describe("demander", () => {
  it("refuse son propre code", async () => {
    const user = await creerUtilisateur();
    const resultat = await demander(user.id, await codePersonnel(user.id));
    expect(estEchec(resultat) && resultat.code).toBe("code_personnel");
  });

  it("refuse un code inconnu, et un code malformé", async () => {
    const user = await creerUtilisateur();
    expect(estEchec(await demander(user.id, "ABCD-2345")) && true).toBe(true);
    const malforme = await demander(user.id, "pas-un-code-du-tout");
    expect(estEchec(malforme) && malforme.code).toBe("code_malforme");
  });

  it("ne crée qu'une ligne, quel que soit le sens de la seconde demande", async () => {
    const { alex, sam } = await deuxComptes();
    const codeSam = await codePersonnel(sam.id);
    const codeAlex = await codePersonnel(alex.id);

    const premiere = await demander(alex.id, codeSam);
    expect(estEchec(premiere)).toBe(false);

    // Sam demande à son tour, sans savoir qu'Alex l'a déjà fait. Sans la clé de
    // paire canonique, une seconde ligne naîtrait et les deux seraient amis
    // deux fois.
    const seconde = await demander(sam.id, codeAlex);
    expect(estEchec(seconde) && seconde.code).toBe("demande_en_attente");
    expect(await prisma.amitie.count()).toBe(1);
  });

  it("refuse une demande vers quelqu'un qui est déjà de la phalange", async () => {
    const { alex, sam } = await deuxComptes();
    await lier(alex, sam);

    const encore = await demander(alex.id, await codePersonnel(sam.id));
    expect(estEchec(encore) && encore.code).toBe("deja_amis");
  });
});

describe("après un refus", () => {
  it("le demandeur ne peut pas insister", async () => {
    const { alex, sam } = await deuxComptes();
    const codeSam = await codePersonnel(sam.id);

    const demande = await demander(alex.id, codeSam);
    if (estEchec(demande)) throw new Error(demande.erreur);
    await repondre(sam.id, demande.amitieId, false);

    // C'est tout l'intérêt de conserver le refus : sans la ligne, Alex
    // recommencerait dans la seconde, autant de fois qu'il le veut.
    const insiste = await demander(alex.id, codeSam);
    expect(estEchec(insiste) && insiste.code).toBe("demande_refusee");
    expect(await prisma.amitie.count()).toBe(1);
  });

  it("celui qui a refusé peut revenir dessus", async () => {
    const { alex, sam } = await deuxComptes();
    const demande = await demander(alex.id, await codePersonnel(sam.id));
    if (estEchec(demande)) throw new Error(demande.erreur);
    await repondre(sam.id, demande.amitieId, false);

    const retour = await demander(sam.id, await codePersonnel(alex.id));
    expect(estEchec(retour)).toBe(false);

    const ligne = await prisma.amitie.findFirstOrThrow();
    expect(ligne.statut).toBe("EN_ATTENTE");
    expect(ligne.demandeurId).toBe(sam.id);
    expect(await prisma.amitie.count()).toBe(1);
  });
});

describe("répondre", () => {
  it("n'appartient qu'au destinataire", async () => {
    const { alex, sam } = await deuxComptes();
    const demande = await demander(alex.id, await codePersonnel(sam.id));
    if (estEchec(demande)) throw new Error(demande.erreur);

    // Alex ne peut pas accepter sa propre demande.
    const parLeDemandeur = await repondre(alex.id, demande.amitieId, true);
    expect(estEchec(parLeDemandeur) && parLeDemandeur.statut).toBe(404);

    // Un tiers non plus, et il reçoit la même réponse : dire « ce n'est pas
    // pour toi » confirmerait que deux comptes se connaissent.
    const tiers = await creerUtilisateur();
    const parUnTiers = await repondre(tiers.id, demande.amitieId, true);
    expect(estEchec(parUnTiers) && parUnTiers.statut).toBe(404);
  });

  it("ne se répond qu'une fois", async () => {
    const { alex, sam } = await deuxComptes();
    const demande = await demander(alex.id, await codePersonnel(sam.id));
    if (estEchec(demande)) throw new Error(demande.erreur);

    expect(estEchec(await repondre(sam.id, demande.amitieId, true))).toBe(false);
    expect(estEchec(await repondre(sam.id, demande.amitieId, false))).toBe(true);
  });
});

describe("rompre", () => {
  it("peut venir de l'un comme de l'autre", async () => {
    const { alex, sam } = await deuxComptes();
    const amitieId = await lier(alex, sam);

    // Le destinataire part : il n'a pas à demander l'accord du demandeur.
    expect(estEchec(await rompre(sam.id, amitieId))).toBe(false);
    expect(await prisma.amitie.count()).toBe(0);
  });

  it("rouvre la porte, contrairement à un refus", async () => {
    const { alex, sam } = await deuxComptes();
    const amitieId = await lier(alex, sam);
    await rompre(alex.id, amitieId);

    const denouveau = await demander(alex.id, await codePersonnel(sam.id));
    expect(estEchec(denouveau)).toBe(false);
  });

  it("reste hors de portée d'un tiers", async () => {
    const { alex, sam } = await deuxComptes();
    const amitieId = await lier(alex, sam);
    const tiers = await creerUtilisateur();

    expect(estEchec(await rompre(tiers.id, amitieId))).toBe(true);
    expect(await prisma.amitie.count()).toBe(1);
  });
});

describe("listerPhalange", () => {
  it("se contient soi-même, sans identifiant de rupture", async () => {
    const user = await creerUtilisateur({ lp: 250 });
    const phalange = await listerPhalange(user.id);

    expect(phalange.compagnons).toHaveLength(1);
    expect(phalange.compagnons[0]!.lp).toBe(250);
    // On ne peut pas se retirer de sa propre phalange : l'écran s'en sert pour
    // ne pas proposer le geste.
    expect(phalange.compagnons[0]!.amitieId).toBe("");
  });

  it("ne montre rien tant que la demande n'est pas acceptée", async () => {
    const { alex, sam } = await deuxComptes();
    const demande = await demander(alex.id, await codePersonnel(sam.id));
    if (estEchec(demande)) throw new Error(demande.erreur);

    const cotéSam = await listerPhalange(sam.id);
    expect(cotéSam.compagnons).toHaveLength(1); // lui seul
    expect(cotéSam.recues).toHaveLength(1);

    const cotéAlex = await listerPhalange(alex.id);
    expect(cotéAlex.compagnons).toHaveLength(1);
    expect(cotéAlex.envoyees).toHaveLength(1);
  });

  it("rend le rang et l'assiduité de la semaine", async () => {
    const { alex, sam } = await deuxComptes();
    await prisma.user.update({ where: { id: sam.id }, data: { lp: 850 } });
    await lier(alex, sam);

    // Deux séances prévues cette semaine jusqu'à aujourd'hui, une faite.
    const lundi = debutSemaineUTC();
    await prisma.planDay.createMany({
      data: [
        { userId: sam.id, date: lundi, muscleGroup: "dos", status: "FAIT" },
        { userId: sam.id, date: jourUTC(), muscleGroup: "pectoraux", status: "PREVU" },
        // Un repos n'est pas une séance prévue, et un jour à venir n'est pas
        // encore manqué : ni l'un ni l'autre ne doit peser sur l'assiduité.
        { userId: sam.id, date: new Date(lundi.getTime() + 86_400_000), muscleGroup: "repos", status: "REPOS" },
        {
          userId: sam.id,
          date: new Date(jourUTC().getTime() + 86_400_000),
          muscleGroup: "jambes",
          status: "PREVU",
        },
      ],
    });

    const phalange = await listerPhalange(alex.id);
    const compagnon = phalange.compagnons.find((c) => c.lp === 850)!;

    expect(compagnon.rang.slug).toBe("spartiate");
    expect(compagnon.semaine).toEqual({ faites: 1, prevues: 2, assiduite: 50 });
  });

  it("ne rend pas 0 % quand aucune séance n'est prévue", async () => {
    const user = await creerUtilisateur();
    const phalange = await listerPhalange(user.id);
    // L'absence de mesure n'est pas un zéro : rendre 0 ferait passer pour
    // paresseux quelqu'un qui n'a rien à faire cette semaine.
    expect(phalange.compagnons[0]!.semaine.assiduite).toBeNull();
  });
});

describe("ce qui ne doit jamais sortir d'un compte", () => {
  it("ne laisse filtrer ni poids, ni taille, ni charge, ni adresse", async () => {
    const { alex, sam } = await deuxComptes();
    await lier(alex, sam);

    await prisma.weighIn.create({ data: { userId: sam.id, date: jourUTC(), kg: 78.5 } });
    await prisma.exerciseLoad.create({
      data: { userId: sam.id, exerciseName: "Développé couché", kg: 92.5 },
    });
    await prisma.user.update({ where: { id: sam.id }, data: { heightCm: 183 } });

    const brut = JSON.stringify(await listerPhalange(alex.id));

    // On cherche les valeurs elles-mêmes, pas les noms de champs : un jour
    // quelqu'un renommera `kg`, et le test doit continuer de mordre.
    expect(brut).not.toContain("78.5");
    expect(brut).not.toContain("92.5");
    expect(brut).not.toContain("183");
    expect(brut).not.toContain(sam.email!);
    // Et l'identifiant du compte non plus : seul celui de l'amitié sert à agir.
    expect(brut).not.toContain(sam.id);
  });
});

describe("cycle de vie du compte", () => {
  it("la suppression emporte les liens, dans les deux sens", async () => {
    const { alex, sam } = await deuxComptes();
    const tiers = await creerUtilisateur();
    await lier(alex, sam); // Alex demandeur
    await lier(tiers, alex); // Alex destinataire

    expect(await prisma.amitie.count()).toBe(2);
    await prisma.user.delete({ where: { id: alex.id } });

    // Sans la cascade sur les *deux* relations, l'un des liens survivrait en
    // pointant vers un compte disparu.
    expect(await prisma.amitie.count()).toBe(0);
  });

  it("la remise à zéro conserve la phalange", async () => {
    const { alex, sam } = await deuxComptes();
    await lier(alex, sam);

    const { reinitialiserCompte } = await import("@/lib/reinitialiser");
    await reinitialiserCompte(alex.id);

    // Repartir de zéro efface une progression, pas des relations. Perdre ses
    // compagnons en même temps que ses Δ serait une surprise, et le texte de
    // confirmation ne l'annonce pas.
    expect(await prisma.amitie.count()).toBe(1);
    const phalange = await listerPhalange(alex.id);
    expect(phalange.compagnons).toHaveLength(2);
  });
});

describe("routes HTTP", () => {
  it("exigent un jeton", async () => {
    const sansJeton = await getPhalange(await requeteApi("/api/v1/amis"));
    expect(sansJeton.status).toBe(401);
  });

  it("exigent un profil complet", async () => {
    const nouveau = await creerUtilisateur({ onboarded: false });
    const reponse = await getCode(await requeteApi("/api/v1/amis/code", { userId: nouveau.id }));
    const { statut, corps } = await reponseJson<{ code: string }>(reponse);
    expect(statut).toBe(409);
    expect(corps.code).toBe("onboarding_requis");
  });

  it("mènent une demande de bout en bout", async () => {
    const { alex, sam } = await deuxComptes();

    const reponseCode = await getCode(await requeteApi("/api/v1/amis/code", { userId: sam.id }));
    const { corps: avecCode } = await reponseJson<{ code: string }>(reponseCode);

    const reponseDemande = await postDemande(
      await requeteApi("/api/v1/amis", { userId: alex.id, corps: { code: avecCode.code } }),
    );
    const { statut, cache } = await reponseJson(reponseDemande);

    expect(statut).toBe(201);
    // Données personnelles : aucun intermédiaire ne doit les garder.
    expect(cache).toBe("no-store");
  });
});
