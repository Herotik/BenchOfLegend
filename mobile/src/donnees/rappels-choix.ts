/**
 * Quels rappels poser, et lequel dire.
 *
 * Séparé de `rappels.ts` — qui parle à `expo-notifications` et n'est donc
 * testable que sur un téléphone — parce que c'est ici que sont les décisions,
 * et que trois défauts s'y sont succédé sans que rien ne les attrape :
 *
 *  · un jour portant deux groupes produisait deux notifications au même
 *    instant, le plan les rendant sur deux lignes ;
 *  · une journée à moitié faite ne se distinguait pas d'une journée finie ;
 *  · s'entraîner avant l'heure du rappel valait quand même un rappel.
 *
 * Aucune dépendance, pas même aux types de l'API : la fonction ne demande que
 * ce qu'elle regarde, ce qui la rend appelable depuis un test sans monter le
 * moindre morceau de React Native.
 */

/** Ce qu'une ligne de plan doit porter pour être classée. */
export interface LignePlan {
  /** Jour civil, `AAAA-MM-JJ`. */
  date: string;
  groupe: string;
  statut: string;
}

export interface RappelAPoser {
  date: string;
  quand: Date;
  /**
   * `rappel` quand il reste du travail, `felicitations` quand tout est validé
   * avant l'heure — le moment où le téléphone allait réclamer est exactement
   * celui où il vaut mieux féliciter.
   */
  genre: "rappel" | "felicitations";
}

/**
 * `AAAA-MM-JJ` + heure → instant local.
 *
 * Construit à partir des composantes locales, comme le reste de l'app : un
 * `new Date("2026-08-14T18:00:00Z")` désignerait 20 h en France.
 */
export function instantLocal(iso: string, heure: number): Date {
  const [annee, mois, jour] = iso.split("-").map(Number) as [number, number, number];
  return new Date(annee, mois - 1, jour, heure, 0, 0, 0);
}

export function rappelsAPoser(
  jours: LignePlan[],
  options: { heure: number; aujourdhui: string; maintenant: number; maximum: number },
): RappelAPoser[] {
  const { heure, aujourdhui, maintenant, maximum } = options;

  // Un jour peut porter **deux groupes** — bras et abdos le même soir — et le
  // plan les rend sur deux lignes. On regroupe donc par jour : sinon deux
  // notifications identiques partiraient au même instant.
  const parJour = new Map<string, LignePlan[]>();
  for (const jour of jours) {
    if (jour.groupe === "repos" || jour.date < aujourdhui) continue;
    const lignes = parJour.get(jour.date);
    if (lignes) lignes.push(jour);
    else parJour.set(jour.date, [jour]);
  }

  const poses: RappelAPoser[] = [];

  for (const date of [...parJour.keys()].sort().slice(0, maximum)) {
    const lignes = parJour.get(date) ?? [];
    const quand = instantLocal(date, heure);
    // L'heure du jour est peut-être déjà passée : la programmer ferait sonner
    // le téléphone immédiatement.
    if (quand.getTime() <= maintenant) continue;

    // Tant qu'un groupe reste à faire, il y a bien quelque chose à rappeler :
    // une journée bras + abdos dont seuls les bras sont validés n'est pas finie.
    const reste = lignes.some((l) => l.statut === "PREVU");
    const tout = lignes.every((l) => l.statut === "FAIT");

    if (reste) poses.push({ date, quand, genre: "rappel" });
    else if (tout) poses.push({ date, quand, genre: "felicitations" });
    // Ni l'un ni l'autre : la journée est manquée. On ne dit rien — la spec
    // interdit de culpabiliser, la sanction est l'absence de gain.
  }

  return poses;
}
