/**
 * Quel geste montrer pour quel exercice.
 *
 * ## Regrouper par mouvement, pas par matériel
 *
 * Un développé militaire haltères et un développé militaire barre se
 * démontrent avec la même animation : le personnage ferme le poing, ni barre
 * ni haltère n'est modélisée, et la seule différence entre les deux exercices
 * disparaît à l'écran. Même chose pour les six curls, les quatre rowings, les
 * treize pompes. La consigne écrite porte le détail ; la démonstration porte le
 * schéma.
 *
 * ## Ne rien montrer plutôt que montrer à côté
 *
 * Un exercice absent de cette table n'affiche aucune démonstration, et c'est un
 * choix. Associer le tirage horizontal élastique — qui se fait debout — au
 * rowing buste penché apprendrait une posture au lieu d'un geste, et la posture
 * est justement ce qu'un débutant rate. Associer un développé couché à des
 * pompes ferait pousser vers le haut ce qui pousse vers le bas.
 *
 * Une association douteuse coûte plus cher qu'une case vide : elle est
 * silencieuse, et l'utilisateur qui la suit croit bien faire.
 *
 * ## Ce que couvre la table
 *
 * Environ deux exercices sur cinq. Ce qui manque tient à des gestes qu'on n'a
 * pas encore : dips, fentes, mollets, soulevé de terre, gainage latéral,
 * relevés de jambes, corde à sauter, développé couché. Les ajouter ne demande
 * que de rendre le geste et de compléter ici.
 *
 * ## La clé, c'est le nom de l'exercice
 *
 * Comme pour `ExerciseLoad` côté serveur. Un nom retouché dans le catalogue
 * perdrait donc son animation sans bruit — d'où le test qui vérifie que chaque
 * nom d'ici existe bien dans `prisma/exercises.ts`, et que chaque geste visé
 * existe bien en planche ou en motif.
 */

/**
 * Nom exact de l'exercice → identifiant du geste.
 *
 * Le geste est résolu par `Demonstration` : planche 3D si elle existe, motif
 * vectoriel sinon.
 */
export const GESTE_PAR_EXERCICE: Record<string, string> = {
  // ---- Pectoraux : tout ce qui pousse au sol, face au sol ------------------
  "Pompes sur les genoux": "pompe",
  "Pompes inclinées sur support": "pompe",
  "Pompes classiques": "pompe",
  "Pompes déclinées": "pompe",
  "Pompes en déficit": "pompe",
  "Pompes archer": "pompe",
  "Pompes claquées": "pompe",
  "Pompes sur une main": "pompe",
  "Pompes prise large": "pompe",
  "Pompes contre un mur": "pompe",

  // ---- Dos ----------------------------------------------------------------
  "Tractions négatives": "traction",
  "Tractions supination": "traction",
  "Tractions pronation": "traction",
  "Tractions prise large": "traction",
  "Rowing haltère à un bras": "rowing",
  "Rowing barre buste penché": "rowing",
  "Rowing kettlebell à un bras": "rowing",
  "Rowing avec bouteilles d'eau buste penché": "rowing",

  // ---- Épaules ------------------------------------------------------------
  "Développé militaire haltères": "developpe-militaire",
  "Développé militaire barre": "developpe-militaire",
  "Développé militaire kettlebell à un bras": "developpe-militaire",
  "Développé Arnold haltères": "developpe-militaire",
  "Élévations latérales haltères": "elevations-laterales",
  "Élévations latérales élastique": "elevations-laterales",
  "Élévations latérales avec bouteilles d'eau": "elevations-laterales",
  "Élévations frontales haltères": "elevations-frontales",
  "Élévations frontales avec bouteilles d'eau": "elevations-frontales",
  "Oiseau haltères buste penché": "oiseau",
  "Oiseau avec bouteilles d'eau buste penché": "oiseau",
  "Touches d'épaules en gainage": "planche",

  // ---- Bras ---------------------------------------------------------------
  // Les pompes serrées restent des pompes : de profil, l'écart des mains est
  // dans l'axe de la caméra et ne se verrait pas de toute façon.
  "Pompes prise serrée sur les genoux": "pompe",
  "Pompes diamant": "pompe",
  "Pompes diamant déclinées": "pompe",
  "Tractions supination prise serrée": "traction",
  "Curl biceps haltères": "curl",
  "Curl marteau haltères": "curl",
  "Curl barre": "curl",
  "Curl biceps élastique": "curl",
  "Curl kettlebell à deux mains": "curl",
  "Curl à la serviette en auto-résistance": "curl",
  "Curl avec bouteilles d'eau": "curl",
  "Extensions triceps nuque haltère": "extension-triceps",
  "Extensions triceps élastique": "extension-triceps",
  "Extensions triceps à la serviette en auto-résistance": "extension-triceps",
  "Kickback triceps haltère": "kickback-triceps",

  // ---- Jambes -------------------------------------------------------------
  "Squat sur chaise": "squat",
  "Squat au poids du corps": "squat",
  "Squat élastique": "squat",
  "Goblet squat kettlebell": "squat",
  "Squat barre": "squat-barre",
  "Squat sauté": "saut",

  // ---- Abdos --------------------------------------------------------------
  "Crunchs au sol": "crunch",
  "Crunchs jambes levées": "crunch",
  "Crunchs avec haltère sur la poitrine": "crunch",
  "Sit-ups au sol": "crunch",
  "Gainage planche": "planche",
  "Gainage planche sur un bras": "planche",
  "Planche avec touches d'épaules": "planche",

  // ---- Cardio -------------------------------------------------------------
  "Jumping jacks": "jumping-jack",
  Burpees: "burpee",
  "Burpees sans pompe": "burpee",
  "Burpees avec saut groupé": "burpee",
};

/** Geste d'un exercice, ou `null` si aucun ne le montre correctement. */
export const gesteDe = (nomExercice: string | null | undefined): string | null =>
  (nomExercice ? GESTE_PAR_EXERCICE[nomExercice] : null) ?? null;
