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
  // ---- Pectoraux -----------------------------------------------------------
  "Pompes sur les genoux": "pompe",
  "Pompes inclinées sur support": "pompe",
  "Pompes classiques": "pompe",
  "Pompes déclinées": "pompe",
  "Pompes en déficit": "pompe",
  "Pompes archer": "pompe",
  "Pompes claquées": "pompe",
  "Pompes sur une main": "pompe",
  "Pompes prise large": "pompe",
  "Dips entre deux chaises": "dips",
  "Développé couché haltères au sol": "developpe-couche",
  "Développé couché haltères": "developpe-couche",
  "Développé couché barre": "developpe-couche",
  "Développé incliné haltères": "developpe-incline",
  "Écartés couché haltères": "ecarte-couche",
  "Écartés élastique debout": "ecarte-debout",
  "Pull-over haltère": "pull-over",
  "Pompes contre un mur": "pompe",
  "Serrage de paumes isométrique": "serrage-paumes",
  "Écartés au sol avec bouteilles d'eau": "ecarte-couche",
  "Pull-over au sol avec bouteille d'eau": "pull-over",

  // ---- Dos -----------------------------------------------------------------
  "Pompes scapulaires": "pompe-scapulaire",
  "Superman au sol": "superman",
  "Nageur au sol": "superman",
  "Rowing inversé sous une table": "rowing-inverse",
  "Rowing inversé jambes tendues": "rowing-inverse",
  "Rowing inversé à un bras": "rowing-inverse",
  "Suspension à la barre": "suspension",
  "Tractions négatives": "traction",
  "Tractions supination": "traction",
  "Tractions pronation": "traction",
  "Tractions prise large": "traction",
  "Rowing haltère à un bras": "rowing",
  "Rowing barre buste penché": "rowing",
  "Soulevé de terre barre": "souleve-de-terre",
  "Tirage horizontal élastique": "tirage-horizontal",
  "Tirage vertical élastique": "tirage-vertical",
  "Rowing kettlebell à un bras": "rowing",
  "Shrugs haltères": "shrugs",
  "Bird dog au sol": "bird-dog",
  "Y-T-W au sol": "superman",
  "Rowing avec bouteilles d'eau buste penché": "rowing",
  "Pull-apart à la serviette": "tirage-horizontal",

  // ---- Épaules -------------------------------------------------------------
  "Cercles de bras": "cercles-bras",
  "Pompes piquées genoux au sol": "pompe-piquee",
  "Pompes piquées": "pompe-piquee",
  "Pompes piquées surélevées": "pompe-piquee",
  "Pompes en équilibre contre un mur": "equilibre-mur",
  "Tenue en équilibre contre un mur": "equilibre-mur",
  // « En position de planche bras tendus » : le rendu 3D dit la position de
  // départ mieux que le bonhomme vectoriel, même s'il ne montre pas le bras
  // qui se lève.
  "Élévations frontales en gainage": "planche-haute",
  "Développé militaire haltères": "developpe-militaire",
  "Développé militaire barre": "developpe-militaire",
  "Développé Arnold haltères": "developpe-militaire",
  "Élévations latérales haltères": "elevations-laterales",
  "Élévations frontales haltères": "elevations-frontales",
  "Oiseau haltères buste penché": "oiseau",
  "Élévations latérales élastique": "elevations-laterales",
  "Rotations externes élastique": "rotation-externe",
  "Développé militaire kettlebell à un bras": "developpe-militaire",
  "Touches d'épaules en gainage": "planche-haute",
  "Élévations latérales avec bouteilles d'eau": "elevations-laterales",
  "Élévations frontales avec bouteilles d'eau": "elevations-frontales",
  "Oiseau avec bouteilles d'eau buste penché": "oiseau",

  // ---- Bras ----------------------------------------------------------------
  "Pompes prise serrée sur les genoux": "pompe",
  "Pompes diamant": "pompe",
  "Pompes diamant déclinées": "pompe",
  "Dips sur chaise": "dips",
  "Dips sur chaise jambes tendues": "dips",
  "Extensions triceps au sol": "extension-triceps-sol",
  "Curl à la serviette en auto-résistance": "curl",
  "Tractions supination prise serrée": "traction",
  "Curl biceps haltères": "curl",
  "Curl marteau haltères": "curl",
  "Curl incliné haltères": "curl-incline",
  "Curl barre": "curl",
  "Curl biceps élastique": "curl",
  "Extensions triceps nuque haltère": "extension-triceps",
  "Barre au front haltères": "barre-au-front",
  "Kickback triceps haltère": "kickback-triceps",
  "Extensions triceps élastique": "extension-triceps",
  "Curl kettlebell à deux mains": "curl",
  "Extensions triceps à la serviette en auto-résistance": "extension-triceps",
  "Curl avec bouteilles d'eau": "curl",

  // ---- Jambes --------------------------------------------------------------
  "Squat sur chaise": "squat",
  "Squat au poids du corps": "squat",
  "Fentes avant": "fente",
  "Fentes bulgares sur chaise": "fente-bulgare",
  "Squat pistol assisté": "pistol",
  "Squat pistol": "pistol",
  "Squat sauté": "saut",
  "Fentes sautées": "fente-sautee",
  "Pont fessier au sol": "pont-fessier",
  "Pont fessier sur une jambe": "pont-fessier",
  "Mollets debout au poids du corps": "mollets",
  "Mollets debout sur une jambe": "mollets",
  "Chaise contre le mur": "chaise-mur",
  "Goblet squat kettlebell": "squat",
  "Swing kettlebell": "swing",
  "Squat barre": "squat-barre",
  "Fentes haltères": "fente",
  "Fentes bulgares haltères": "fente-bulgare",
  "Soulevé de terre roumain haltères": "souleve-de-terre",
  "Mollets debout haltères": "mollets",
  "Squat élastique": "squat",
  "Abduction de hanche élastique": "abduction-hanche",
  "Hip thrust sur banc avec haltère": "pont-fessier",

  // ---- Abdos ---------------------------------------------------------------
  "Crunchs au sol": "crunch",
  "Crunchs jambes levées": "crunch",
  "Relevés de jambes au sol": "releve-jambes",
  "Relevés de jambes suspendu": "releve-jambes-suspendu",
  // Le catalogue distingue les deux appuis, et les démonstrations aussi
  // désormais : « appui sur les avant-bras » pour le gainage planche, « en
  // planche bras tendus » pour les touches d'épaules. Un seul rendu pour les
  // deux faisait mentir la description de l'exercice.
  "Gainage planche": "planche-basse",
  "Planche avec touches d'épaules": "planche-haute",
  "Gainage planche sur un bras": "planche-basse",
  "Gainage latéral": "gainage-lateral",
  "Gainage latéral avec élévation de hanche": "gainage-lateral",
  "Mountain climbers": "mountain-climber",
  "Mountain climbers croisés": "mountain-climber",
  "Dead bug au sol": "dead-bug",
  "Tenue en creux": "tenue-creux",
  "Relevés en V": "releve-en-v",
  "Sit-ups au sol": "crunch",
  "Russian twist au poids du corps": "russian-twist",
  "Russian twist kettlebell": "russian-twist",
  "Crunchs avec haltère sur la poitrine": "crunch",
  "Rotations obliques élastique": "russian-twist",
  "Crunchs élastique à genoux": "crunch-genoux",

  // ---- Cardio --------------------------------------------------------------
  "Jumping jacks": "jumping-jack",
  "Talons-fesses sur place": "talons-fesses",
  "Montées de genoux sur place": "montee-genoux",
  "Sprints sur place": "montee-genoux",
  "HIIT au poids du corps": "montee-genoux",
  "Pas chassés latéraux": "pas-chasses",
  "Burpees sans pompe": "burpee",
  "Burpees": "burpee",
  "Burpees avec saut groupé": "burpee",
  "Saut à la corde de base": "corde-a-sauter",
  "Intervalles à la corde à sauter": "corde-a-sauter",
  "Double under à la corde": "corde-a-sauter",
  "Marche rapide sur tapis": "marche-tapis",
  "Endurance fondamentale sur tapis": "marche-tapis",
  "Fractionné 30/30 sur tapis": "course-tapis",
  "Fractionné en côte sur tapis": "course-tapis",
  "Swing kettlebell en intervalles": "swing",
  "Course sur place avec élastique": "montee-genoux",
  "Shadow boxing": "shadow-boxing",
  "Sauts à la corde à vide": "corde-a-sauter",
  "Marche de l'ours": "marche-ours",
};

/** Geste d'un exercice, ou `null` si aucun ne le montre correctement. */
export const gesteDe = (nomExercice: string | null | undefined): string | null =>
  (nomExercice ? GESTE_PAR_EXERCICE[nomExercice] : null) ?? null;
