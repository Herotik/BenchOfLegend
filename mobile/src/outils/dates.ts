/**
 * Dates de l'app.
 *
 * Toutes les dates « jour » de Frame of Legends (pesées, jours de plan, séances) sont
 * stockées à minuit UTC — mais **à partir des composantes civiles locales**,
 * pas d'une conversion de fuseau : `lib/dates.ts` à la racine construit
 * `Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())`. Un Français
 * qui se pèse le 9 août à 00h30 est enregistré au 9, pas au 8.
 *
 * L'app doit donc envoyer **le jour civil du téléphone**, formaté à la main.
 * `toISOString().slice(0, 10)` donnerait la veille entre minuit et deux heures
 * du matin en France, et la séance du jour serait refusée en `seance_passee`.
 *
 * Cela suppose que téléphone et serveur partagent le fuseau — c'est le cas ici,
 * le backend tournant sur le PC du réseau local.
 */

const deuxChiffres = (n: number): string => String(n).padStart(2, "0");

/** Jour civil local, AAAA-MM-JJ — la clé de jour telle que le serveur l'attend. */
export const jourCivilISO = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`;

/** Lundi de la semaine ISO en cours, AAAA-MM-JJ — même découpage que le serveur. */
export function lundiCivilISO(date: Date = new Date()): string {
  const lundi = new Date(date.getTime());
  // 0 = lundi … 6 = dimanche, comme `indexJour` côté serveur.
  const index = (lundi.getDay() + 6) % 7;
  lundi.setDate(lundi.getDate() - index);
  return jourCivilISO(lundi);
}

/** « lundi 10 août », à partir d'un AAAA-MM-JJ. */
export function jourEnFrancais(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return iso;

  // Lecture en UTC : la chaîne désigne un jour civil, pas un instant. Sans ce
  // fuseau explicite, un téléphone à l'ouest de Greenwich afficherait la veille.
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

/** « 1:30 » à partir d'un nombre de secondes. */
export function chronoEnTexte(secondes: number): string {
  const total = Math.max(0, Math.round(secondes));
  const minutes = Math.floor(total / 60);
  const reste = total % 60;
  return `${minutes}:${deuxChiffres(reste)}`;
}
