/**
 * Toutes les dates « jour » de l'app (pesées, jours de plan) sont normalisées
 * à minuit UTC. Sans ça, deux pesées du même jour saisies à des heures
 * différentes créeraient deux lignes, et la contrainte d'unicité
 * `[userId, date]` ne servirait à rien.
 */

/**
 * Minuit UTC du jour civil **local** de la date donnée.
 *
 * On lit volontairement les composantes locales : le « jour » d'une pesée est
 * celui que l'utilisateur a sous les yeux, pas celui du fuseau UTC. Un Français
 * qui se pèse le 9 août à 00h30 doit être enregistré au 9, pas au 8.
 */
export function jourUTC(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/** Vrai si les deux dates tombent le même jour civil local. */
export function memeJour(a: Date, b: Date): boolean {
  return jourUTC(a).getTime() === jourUTC(b).getTime();
}
