/**
 * Sert une séance bidon, pour voir les démonstrations tourner dans l'app.
 *
 *     node scripts/bouchon-seance.js            # écoute sur 8787
 *
 * ## Pourquoi
 *
 * Les planches sont rendues, déclarées et associées à leurs exercices bien
 * avant que quiconque les ait vues **dans l'app**. C'est là que se trouvent les
 * fautes que ni `verifier-planches.py` ni la page de revue ne peuvent voir :
 * la première fois que l'écran de séance a été chargé pour de bon, la
 * démonstration était collée à la marge gauche et faisait soixante points de
 * haut sur un écran qui en fait sept cents.
 *
 * L'écran de séance demande un serveur et un compte. Ce bouchon remplace le
 * serveur ; un jeton quelconque dans le trousseau remplace le compte.
 *
 * ## La recette complète
 *
 *     node scripts/bouchon-seance.js &
 *     cd mobile
 *     echo "EXPO_PUBLIC_API_URL=http://localhost:8787" > .env
 *     npx expo start --web
 *
 * puis, dans la console du navigateur, avant d'ouvrir une séance :
 *
 *     localStorage.setItem("fol.jeton_acces", "apercu")
 *     localStorage.setItem("fol.jeton_rafraichissement", "apercu")
 *
 * et l'on va sur `/seance/pectoraux`, `/seance/cardio`, etc.
 *
 * La séance servie ne contient que les exercices **qui ont une planche** :
 * c'est une revue des démonstrations, pas un programme d'entraînement.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const RACINE = path.dirname(__dirname);
const lire = (p) => fs.readFileSync(path.join(RACINE, p), "utf8");

const planches = new Set(
  [...lire("mobile/src/donnees/planches.ts").matchAll(
    /^ {2}"?([\w-]+)"?: \{\n\s*source:/gm)].map((m) => m[1]),
);
const geste = Object.fromEntries(
  [...lire("mobile/src/donnees/gestes.ts").matchAll(
    /^ {2}"([^"]+)": "([\w-]+)",/gm)].map((m) => [m[1], m[2]]),
);

const parGroupe = {};
for (const m of lire("prisma/exercises.ts").matchAll(
  /name: "([^"]+)",\s*\n\s*muscleGroup: "([a-z]+)"/g)) {
  const [, nom, groupe] = m;
  if (planches.has(geste[nom])) (parGroupe[groupe] ??= []).push(nom);
}

const PORT = Number(process.env.PORT ?? 8787);

http
  .createServer((requete, reponse) => {
    const url = new URL(requete.url, "http://bouchon");
    reponse.setHeader("Access-Control-Allow-Origin", "*");
    reponse.setHeader("Access-Control-Allow-Headers", "*");
    if (requete.method === "OPTIONS") return reponse.end();

    if (url.pathname !== "/api/v1/seance") {
      reponse.statusCode = 404;
      return reponse.end("{}");
    }

    const groupe = url.searchParams.get("groupe") ?? "pectoraux";
    const noms = parGroupe[groupe] ?? [];
    reponse.setHeader("Content-Type", "application/json");
    reponse.end(JSON.stringify({
      groupe,
      date: new Date().toISOString().slice(0, 10),
      planDayId: "apercu",
      dejaValidee: false,
      avertissement: null,
      seancesSur7Jours: 0,
      bonusDejaCompte: false,
      seance: {
        muscleGroup: groupe,
        echauffement: ["Cinq minutes de mobilité articulaire"],
        seriesTotal: noms.length * 3,
        exercices: noms.map((nom, rang) => ({
          exerciceId: `apercu-${rang}`,
          nom,
          type: "POLYARTICULAIRE",
          description: "Aperçu : cet écran sert à voir la démonstration 3D.",
          series: 3,
          reps: 10,
          restSec: 90,
          finisher: false,
          chargeRequise: false,
          progression: null,
        })),
      },
    }));
  })
  .listen(PORT, () => {
    const compte = Object.entries(parGroupe)
      .map(([g, l]) => `${g} ${l.length}`)
      .join(", ");
    console.log(`bouchon sur http://localhost:${PORT} — ${compte}`);
  });
