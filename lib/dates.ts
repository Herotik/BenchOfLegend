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

/**
 * Midi local du jour civil porté par un `jourUTC()`.
 *
 * Un jour normalisé à minuit UTC ne peut pas être relu comme un instant : à
 * l'ouest de Greenwich il tombe la veille au soir, à l'est il reste le bon jour.
 * Or la graine du moteur (`grainesSemaine` + numéro de jour epoch) se calcule
 * sur un instant. Midi est la seule heure qui désigne le même jour civil dans
 * tous les fuseaux, en heure locale comme en UTC.
 *
 * C'est ce qui permet de régénérer une séance à l'identique un jour plus tard,
 * quand elle a été validée hors ligne et n'arrive au serveur que le lendemain.
 */
export function midiLocal(jour: Date): Date {
  return new Date(jour.getUTCFullYear(), jour.getUTCMonth(), jour.getUTCDate(), 12);
}

/**
 * `AAAA-MM-JJ` → jour normalisé, ou `null` si la chaîne n'en est pas un.
 *
 * `new Date("2026-08-12")` conviendrait — l'ISO court est déjà lu en UTC — mais
 * accepterait aussi « 2026-08-12T22:00:00Z » et bien d'autres formes, dont un
 * `Invalid Date` silencieux. On découpe donc à la main.
 */
export function jourDepuisIso(iso: string): Date | null {
  const trouve = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!trouve) return null;

  const [, annee, mois, jour] = trouve.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(annee, mois - 1, jour));

  // Écarte le 31 février : `Date.UTC` le reporterait sur mars sans broncher.
  return date.getUTCMonth() === mois - 1 && date.getUTCDate() === jour ? date : null;
}
