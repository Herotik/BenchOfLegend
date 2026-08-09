import { DECALAGE_MAX } from "@/lib/engine/workout";

/**
 * Ajustement de difficulté par le ressenti de fin de séance.
 *
 * La spec §5.2 prévoyait de proposer la variante supérieure « quand
 * l'utilisateur dépasse la fourchette haute de reps deux séances de suite ».
 * Inapplicable : l'app prescrit un nombre de répétitions précis, on ne le
 * dépasse donc pas, et l'interface n'enregistre pas les reps réellement
 * faites. Le ressenti déclaré remplit le même rôle, marche aussi bien au
 * poids de corps qu'avec des charges, et coûte un appui.
 */

export type Ressenti = "facile" | "juste" | "difficile";

export const RESSENTIS: { cle: Ressenti; label: string; aide: string }[] = [
  { cle: "facile", label: "Facile", aide: "Il te restait de la marge" },
  { cle: "juste", label: "Juste ce qu'il faut", aide: "Difficile mais bouclé" },
  { cle: "difficile", label: "Trop dur", aide: "Séries non terminées" },
];

/** Valeur stockée dans `WorkoutLog.feeling` (échelle 1-5 du modèle). */
export const VALEUR_RESSENTI: Record<Ressenti, number> = {
  difficile: 2,
  juste: 3,
  facile: 4,
};

export const RESSENTI_DEPUIS_VALEUR = (v: number | null): Ressenti | null =>
  v === null ? null : v >= 4 ? "facile" : v <= 2 ? "difficile" : "juste";

/**
 * Décalage proposé à partir d'un ressenti, ou `null` si rien à proposer.
 *
 * On ne propose qu'un cran à la fois, et jamais au-delà des bornes : sauter
 * deux paliers de variantes d'un coup est le meilleur moyen de se blesser.
 */
export function decalagePropose(
  ressenti: Ressenti,
  decalageActuel: number,
): { delta: 1 | -1; message: string } | null {
  if (ressenti === "facile" && decalageActuel < DECALAGE_MAX) {
    return {
      delta: 1,
      message: "Tu as trouvé ça facile. On passe à des variantes plus dures sur ce groupe ?",
    };
  }
  if (ressenti === "difficile" && decalageActuel > -DECALAGE_MAX) {
    return {
      delta: -1,
      message: "Trop dur, c'est noté. On revient à des variantes plus accessibles ?",
    };
  }
  return null;
}
