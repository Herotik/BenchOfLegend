import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma, StatutAmitie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jourUTC } from "@/lib/dates";
import { echec, type EchecMetier } from "@/lib/erreurs";
import { assiduiteDe } from "@/lib/assiduite";
import { rankForLp, rankLabel } from "@/lib/ranks";
import { debutSemaineUTC } from "@/lib/semaine";

/**
 * La phalange : les comptes qu'on a choisi de suivre, et eux seuls.
 *
 * ## Ce qui ne sort jamais d'un compte
 *
 * Le poids et la taille. Ce sont les données les plus intimes de l'app, et une
 * comparaison de poids entre proches ne motive personne — elle blesse. Aucune
 * fonction de ce module ne les lit ; c'est délibéré, et un test le vérifie.
 *
 * Les charges non plus. Comparer un développé couché entre un débutant de
 * soixante kilos et un confirmé de quatre-vingt-dix ne veut rien dire, sinon
 * décourager le premier.
 *
 * Ne circulent que trois choses, chacune pour une raison :
 *  · le **rang et les Δ**, déjà l'identité publique du compte — l'écusson est
 *    fait pour être montré ;
 *  · l'**assiduité de la semaine**, rapportée aux séances prévues : elle ne
 *    récompense ni le temps libre ni la force, seulement la constance, et c'est
 *    exactement ce que l'app veut encourager ;
 *  · le **nom et l'image** du fournisseur de connexion, sans quoi on ne saurait
 *    pas qui l'on regarde.
 *
 * ## Pourquoi la semaine compte autant que le total
 *
 * Les Δ ne redescendent jamais. Quelqu'un qui rejoint une phalange où l'on est
 * à deux mille Δ ne rattrapera pas son retard, et un classement qui ne dirait
 * que cela l'installerait dernier pour toujours. L'assiduité de la semaine
 * repart de zéro chaque lundi : elle est la seule mesure sur laquelle un
 * nouveau venu peut gagner dès sa première semaine.
 *
 * ## Aucune recherche
 *
 * Il n'existe aucune fonction qui prenne un nom, une adresse ou un identifiant
 * d'utilisateur en entrée. On entre dans une phalange par un code que son
 * porteur a donné, et par rien d'autre : une recherche, même restreinte,
 * permettrait de savoir qui possède un compte.
 */

// ---------------------------------------------------------------------------
// Code personnel
// ---------------------------------------------------------------------------

/**
 * Alphabet sans caractère ambigu : ni O ni 0, ni I ni 1. Un code se lit à voix
 * haute et se recopie à la main aussi souvent qu'il se colle.
 *
 * Trente-deux symboles exactement, ce qui divise 256 : tirer un octet et le
 * réduire modulo 32 ne favorise alors aucune lettre, là où un alphabet de
 * taille quelconque rendrait les premières plus probables que les dernières.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Huit symboles, soit 32⁸ ≈ 1 100 milliards de codes. */
const LONGUEUR_CODE = 8;

/** Nombre de tirages avant d'abandonner, en cas de collision. */
const ESSAIS_CODE = 5;

function tirerCode(): string {
  const octets = randomBytes(LONGUEUR_CODE);
  let brut = "";
  for (const octet of octets) brut += ALPHABET[octet % ALPHABET.length];
  // Coupé en deux : quatre symboles se retiennent le temps de les recopier,
  // huit d'affilée non.
  return `${brut.slice(0, 4)}-${brut.slice(4)}`;
}

/** Forme acceptée en entrée, tirets et casse mis à part. */
export function normaliserCode(saisi: string): string | null {
  const nu = saisi.trim().toUpperCase().replace(/[\s-]/g, "");
  if (nu.length !== LONGUEUR_CODE) return null;
  if (![...nu].every((c) => ALPHABET.includes(c))) return null;
  return `${nu.slice(0, 4)}-${nu.slice(4)}`;
}

/**
 * Code personnel du compte, créé au premier appel.
 *
 * Avec `regenerer`, l'ancien cesse aussitôt de fonctionner — c'est le recours
 * de qui a partagé le sien trop largement. Les amitiés déjà nouées survivent :
 * le code ne sert qu'à demander, jamais à maintenir un lien.
 */
export async function codePersonnel(
  userId: string,
  options: { regenerer?: boolean } = {},
): Promise<string> {
  if (!options.regenerer) {
    const existant = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { codeAmi: true },
    });
    if (existant.codeAmi) return existant.codeAmi;
  }

  for (let essai = 0; essai < ESSAIS_CODE; essai++) {
    const code = tirerCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { codeAmi: code } });
      return code;
    } catch (cause) {
      // P2002 : le code est déjà pris. Improbable, mais on retire plutôt que
      // de rendre une erreur qu'un simple nouveau tirage résout.
      const collision =
        cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002";
      if (!collision) throw cause;
    }
  }

  throw new Error("Impossible de tirer un code personnel libre.");
}

// ---------------------------------------------------------------------------
// Nouer et rompre
// ---------------------------------------------------------------------------

/** Clé de la paire, indépendante du sens. Voir la note du modèle `Amitie`. */
const clePaire = (a: string, b: string): string => [a, b].sort().join(":");

/**
 * Demande à rejoindre la phalange du porteur d'un code.
 *
 * Rien n'est visible tant que la demande n'est pas acceptée. C'est ce qui rend
 * un code sans danger : le partager trop largement ne coûte au pire que des
 * sollicitations à refuser.
 */
export async function demander(
  userId: string,
  codeSaisi: string,
): Promise<{ amitieId: string } | EchecMetier> {
  const code = normaliserCode(codeSaisi);
  if (!code) return echec("Ce code n'a pas la bonne forme.", "code_malforme", 400);

  const cible = await prisma.user.findUnique({
    where: { codeAmi: code },
    select: { id: true },
  });
  if (!cible) return echec("Aucun compte ne porte ce code.", "code_inconnu", 404);

  if (cible.id === userId) {
    return echec("C'est ton propre code.", "code_personnel", 422);
  }

  const paire = clePaire(userId, cible.id);
  const existante = await prisma.amitie.findUnique({ where: { paire } });

  if (existante) {
    if (existante.statut === StatutAmitie.ACCEPTEE) {
      return echec("Vous êtes déjà de la même phalange.", "deja_amis", 409);
    }
    if (existante.statut === StatutAmitie.EN_ATTENTE) {
      return echec("Une demande est déjà en attente.", "demande_en_attente", 409);
    }

    // Refusée. Celui qui a refusé peut revenir dessus : sa demande remplace la
    // ligne, dans l'autre sens. Le demandeur d'origine, lui, reste bloqué —
    // c'est précisément ce que la conservation du refus protège, et le laisser
    // insister rendrait un code partagé publiquement intenable pour son
    // porteur.
    if (existante.destinataireId !== userId) {
      return echec("Cette demande a déjà été refusée.", "demande_refusee", 409);
    }

    const rouverte = await prisma.amitie.update({
      where: { paire },
      data: {
        demandeurId: userId,
        destinataireId: cible.id,
        statut: StatutAmitie.EN_ATTENTE,
        reponduLe: null,
      },
    });
    return { amitieId: rouverte.id };
  }

  const creee = await prisma.amitie.create({
    data: { demandeurId: userId, destinataireId: cible.id, paire },
  });
  return { amitieId: creee.id };
}

/**
 * Accepte ou refuse une demande reçue.
 *
 * Une demande adressée à quelqu'un d'autre est traitée comme inexistante,
 * plutôt que refusée explicitement : répondre « ce n'est pas pour toi »
 * confirmerait qu'elle existe, et donc que deux comptes se connaissent.
 */
export async function repondre(
  userId: string,
  amitieId: string,
  accepte: boolean,
): Promise<{ ok: true } | EchecMetier> {
  const demande = await prisma.amitie.findFirst({
    where: { id: amitieId, destinataireId: userId, statut: StatutAmitie.EN_ATTENTE },
  });
  if (!demande) return echec("Demande introuvable.", "demande_introuvable", 404);

  await prisma.amitie.update({
    where: { id: amitieId },
    data: {
      statut: accepte ? StatutAmitie.ACCEPTEE : StatutAmitie.REFUSEE,
      reponduLe: new Date(),
    },
  });
  return { ok: true };
}

/**
 * Rompt le lien, dans quelque état qu'il soit.
 *
 * Symétrique : chacun des deux peut partir, sans que l'autre ait son mot à
 * dire. Et la ligne est supprimée, non marquée — après une rupture, chacun
 * redevient joignable par le code de l'autre, ce qu'un refus conservé
 * interdirait.
 */
export async function rompre(
  userId: string,
  amitieId: string,
): Promise<{ ok: true } | EchecMetier> {
  const lien = await prisma.amitie.findFirst({
    where: {
      id: amitieId,
      OR: [{ demandeurId: userId }, { destinataireId: userId }],
    },
  });
  if (!lien) return echec("Lien introuvable.", "amitie_introuvable", 404);

  await prisma.amitie.delete({ where: { id: amitieId } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export interface Compagnon {
  amitieId: string;
  nom: string | null;
  image: string | null;
  lp: number;
  rang: { slug: string; nom: string; couleur: string; libelle: string };
  /** Séances validées cette semaine, et prévues jusqu'à aujourd'hui inclus. */
  semaine: { faites: number; prevues: number; assiduite: number | null };
}

export interface DemandeRecue {
  amitieId: string;
  nom: string | null;
  image: string | null;
  demandeLe: string;
}

export interface Phalange {
  /** Soi compris, pour que l'écran affiche un classement sans cas particulier. */
  compagnons: Compagnon[];
  recues: DemandeRecue[];
  /** Demandes qu'on a envoyées et qui attendent encore. */
  envoyees: { amitieId: string; nom: string | null }[];
}

/** Ce que l'on montre d'un compte, et rien de plus. Ni poids, ni taille. */
const CHAMPS_PUBLICS = { id: true, name: true, image: true, lp: true } as const;

/**
 * La phalange complète, en un nombre fixe de requêtes.
 *
 * Trois requêtes quel que soit le nombre d'amis : les liens, les comptes, puis
 * un agrégat du plan de la semaine pour tout le monde à la fois. Interroger
 * compte par compte tiendrait à cinq amis et s'effondrerait à trente.
 */
export async function listerPhalange(userId: string): Promise<Phalange> {
  const liens = await prisma.amitie.findMany({
    where: { OR: [{ demandeurId: userId }, { destinataireId: userId }] },
    orderBy: { createdAt: "asc" },
  });

  const acceptees = liens.filter((l) => l.statut === StatutAmitie.ACCEPTEE);
  const enAttente = liens.filter((l) => l.statut === StatutAmitie.EN_ATTENTE);

  const recuesLiens = enAttente.filter((l) => l.destinataireId === userId);
  const envoyeesLiens = enAttente.filter((l) => l.demandeurId === userId);

  // L'autre bout de chaque lien accepté, plus soi-même : l'écran compare, et
  // se comparer suppose d'être dans la liste.
  const idsAmis = acceptees.map((l) => (l.demandeurId === userId ? l.destinataireId : l.demandeurId));
  const tousIds = [userId, ...idsAmis];

  const finSemaine = new Date(debutSemaineUTC().getTime() + 7 * 86_400_000);

  const [comptes, agregats] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: [...tousIds, ...recuesLiens.map((l) => l.demandeurId), ...envoyeesLiens.map((l) => l.destinataireId)] } },
      select: CHAMPS_PUBLICS,
    }),
    // La semaine **entière**, à venir comprise : une séance de jeudi compte
    // parmi les prévues dès le lundi, sans peser sur l'assiduité tant que le
    // jour n'est pas passé. La règle est partagée avec les statistiques —
    // voir `lib/assiduite.ts`, où l'on explique pourquoi un lundi matin ne
    // vaut pas 0 %.
    //
    // Les lignes plutôt qu'un `groupBy` : le regroupement perdait la date, donc
    // le moyen de savoir quel jour est écoulé. Sept lignes par compagnon au
    // plus, la requête reste unique.
    prisma.planDay.findMany({
      where: {
        userId: { in: tousIds },
        muscleGroup: { not: "repos" },
        date: { gte: debutSemaineUTC(), lt: finSemaine },
      },
      select: { userId: true, date: true, status: true },
    }),
  ]);

  const parId = new Map(comptes.map((c) => [c.id, c]));

  const semaines = new Map<string, { date: Date; status: string }[]>();
  for (const ligne of agregats) {
    const lignes = semaines.get(ligne.userId);
    if (lignes) lignes.push(ligne);
    else semaines.set(ligne.userId, [ligne]);
  }

  const compagnon = (id: string, amitieId: string): Compagnon | null => {
    const compte = parId.get(id);
    if (!compte) return null;

    const semaine = assiduiteDe(semaines.get(id) ?? [], jourUTC());
    const rang = rankForLp(compte.lp);

    return {
      amitieId,
      nom: compte.name,
      image: compte.image,
      lp: compte.lp,
      rang: { slug: rang.slug, nom: rang.name, couleur: rang.color, libelle: rankLabel(compte.lp) },
      semaine,
    };
  };

  const compagnons = [
    // `amitieId` vide pour soi : on ne peut pas se retirer de sa propre
    // phalange, et l'écran s'en sert pour ne pas proposer le geste.
    compagnon(userId, ""),
    ...acceptees.map((l) =>
      compagnon(l.demandeurId === userId ? l.destinataireId : l.demandeurId, l.id),
    ),
  ].filter((c): c is Compagnon => c !== null);

  return {
    compagnons,
    recues: recuesLiens.map((l) => ({
      amitieId: l.id,
      nom: parId.get(l.demandeurId)?.name ?? null,
      image: parId.get(l.demandeurId)?.image ?? null,
      demandeLe: l.createdAt.toISOString(),
    })),
    envoyees: envoyeesLiens.map((l) => ({
      amitieId: l.id,
      nom: parId.get(l.destinataireId)?.name ?? null,
    })),
  };
}
