/**
 * Assiduité d'une semaine : la part des séances prévues qui a été tenue.
 *
 * ## Ce qu'on ne compte pas contre soi
 *
 * Une séance prévue **aujourd'hui** n'est pas encore manquée : la journée n'est
 * pas finie. Le calcul ne jugeait que sur les jours écoulés, aujourd'hui
 * compris, si bien qu'un lundi matin affichait 0 % — la séance du jour comptait
 * pour ratée avant même qu'on ait eu l'occasion de la faire. C'est exactement
 * ce que la spec interdit : la sanction est l'absence de gain, jamais un
 * reproche anticipé.
 *
 * Un jour n'entre donc au dénominateur qu'une fois **jugé** : soit la journée
 * est passée, soit la séance est validée. Le reste attend son heure.
 *
 * ## Les deux zéros, qui ne veulent pas dire la même chose
 *
 * Une semaine qui ne prévoit rien rend `null` : il n'y a pas de mesure, et
 * afficher 0 % ferait passer pour paresseux quelqu'un qui n'avait rien à faire.
 *
 * Une semaine qui commence, elle, rend **100** : rien n'a encore été manqué.
 * On part de la semaine parfaite et on en retire au fil des jours réellement
 * écoulés, plutôt que de partir de zéro et de faire remonter.
 *
 * Aucune dépendance : ni Prisma, ni `server-only`. Deux appelants s'en servent
 * — les statistiques et la phalange — et ils divergeaient déjà.
 */

/** Ce qu'une ligne de plan doit porter pour être jugée. Les repos sont exclus par l'appelant. */
export interface JourPlanifie {
  date: Date;
  status: string;
}

export interface Assiduite {
  /** Séances prévues sur la semaine, **celles à venir comprises**. */
  prevues: number;
  faites: number;
  /** `null` quand la semaine ne prévoit rien du tout. */
  assiduite: number | null;
}

export function assiduiteDe(jours: JourPlanifie[], aujourdhui: Date): Assiduite {
  const debutDuJour = aujourdhui.getTime();

  let faites = 0;
  let juges = 0;

  for (const jour of jours) {
    const fait = jour.status === "FAIT";
    if (fait) faites += 1;
    // Jugé : la journée est derrière nous, ou la séance est déjà validée.
    if (fait || jour.date.getTime() < debutDuJour) juges += 1;
  }

  return {
    prevues: jours.length,
    faites,
    assiduite: jours.length === 0 ? null : juges === 0 ? 100 : Math.round((faites / juges) * 100),
  };
}
