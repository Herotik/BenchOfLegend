import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Frame of Legends — entraînement classé",
    short_name: "Frame of Legends",
    description:
      "Ton programme de musculation hebdomadaire, tes séances validées et ta progression d'Hoplite à Dieu de l'Olympe.",
    lang: "fr",
    start_url: "/dashboard",
    // `standalone` retire la barre d'URL : l'app est utilisée téléphone en
    // main pendant la séance, chaque pixel d'écran compte.
    display: "standalone",
    orientation: "portrait",
    background_color: "#05080d",
    theme_color: "#05080d",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // `maskable` autorise le lanceur à rogner l'icône à sa forme : le
      // contenu utile tient dans les 80 % centraux, marge prévue au montage.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Séance du jour", url: "/dashboard" },
      { name: "Séance bonus", url: "/seance-bonus" },
      { name: "Calendrier", url: "/calendrier" },
    ],
  };
}
