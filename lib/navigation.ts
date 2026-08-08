/** Entrées de navigation, partagées par la barre mobile et la colonne desktop. */
export const NAVIGATION = [
  { href: "/dashboard", label: "Aujourd'hui", icone: "flamme" },
  { href: "/calendrier", label: "Calendrier", icone: "calendrier" },
  { href: "/graphiques", label: "Courbes", icone: "courbe" },
  { href: "/historique", label: "Historique", icone: "liste" },
  { href: "/parametres", label: "Réglages", icone: "reglages" },
] as const;

export type IconeNav = (typeof NAVIGATION)[number]["icone"];
