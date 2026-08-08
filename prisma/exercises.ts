// Catalogue d'exercices du seed. Les listes de matériel et de groupes
// musculaires vivent dans lib/referentiel.ts — les types en dérivent, pour
// qu'un slug inventé ici casse la compilation.
import type { ExoType, Level, MuscleGroupId } from "../lib/referentiel";

export interface ExerciseSeed {
  name: string;
  muscleGroup: MuscleGroupId;
  /** "aucun" = poids de corps. Sinon slug(s) d'équipement, séparés par "+" si plusieurs sont requis. */
  equipment: string;
  level: Level;
  type: ExoType;
  /** Consignes d'exécution réelles, 1 à 2 phrases. */
  description: string;
  /** Nom exact d'un autre exercice de cette liste, plus difficile. null si aucun. */
  progression: string | null;
}

export const EXERCISES: ExerciseSeed[] = [
  // ==========================================================================
  // PECTORAUX
  // ==========================================================================
  {
    name: "Pompes sur les genoux",
    muscleGroup: "pectoraux",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Genoux au sol, mains légèrement plus larges que les épaules, corps aligné des genoux aux épaules. Descendre jusqu'à frôler le sol avec la poitrine sans creuser le bas du dos.",
    progression: "Pompes inclinées sur support",
  },
  {
    name: "Pompes inclinées sur support",
    muscleGroup: "pectoraux",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Mains posées sur un plan surélevé (table, rebord de canapé), corps gainé en ligne droite des talons à la tête. Plus le support est haut, plus le mouvement est facile : baisser progressivement la hauteur.",
    progression: "Pompes classiques",
  },
  {
    name: "Pompes classiques",
    muscleGroup: "pectoraux",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Mains à largeur d'épaules, coudes à environ 45 degrés du buste, corps gainé de la tête aux talons. Descendre la poitrine à deux ou trois centimètres du sol puis remonter sans verrouiller brutalement les coudes.",
    progression: "Pompes déclinées",
  },
  {
    name: "Pompes déclinées",
    muscleGroup: "pectoraux",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Pieds surélevés sur une chaise ou un canapé, mains au sol à largeur d'épaules. Le travail se déporte sur le haut des pectoraux à mesure que les pieds montent : garder le bassin dans l'axe du corps.",
    progression: "Pompes en déficit",
  },
  {
    name: "Pompes en déficit",
    muscleGroup: "pectoraux",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Mains posées sur deux livres épais ou deux supports bas pour descendre la poitrine sous le niveau des mains. Contrôler la descente sur 3 secondes et rester dans une amplitude indolore pour les épaules.",
    progression: "Pompes archer",
  },
  {
    name: "Pompes archer",
    muscleGroup: "pectoraux",
    equipment: "aucun",
    level: "AVANCE",
    type: "POLYARTICULAIRE",
    description:
      "Bras très écartés, transférer le poids sur un bras qui fléchit pendant que l'autre reste tendu au sol. Alterner à chaque répétition en gardant le bassin stable et sans pivoter le buste.",
    progression: "Pompes claquées",
  },
  {
    name: "Pompes claquées",
    muscleGroup: "pectoraux",
    equipment: "aucun",
    level: "AVANCE",
    type: "POLYARTICULAIRE",
    description:
      "Descendre en pompe classique puis pousser explosivement pour décoller les mains et claquer avant de réceptionner coudes fléchis. Amortir la réception pour protéger poignets et épaules.",
    progression: "Pompes sur une main",
  },
  {
    name: "Pompes sur une main",
    muscleGroup: "pectoraux",
    equipment: "aucun",
    level: "AVANCE",
    type: "POLYARTICULAIRE",
    description:
      "Pieds très écartés pour élargir la base, une main au sol sous le sternum, l'autre dans le dos. Descendre lentement en résistant à la rotation du bassin et des épaules.",
    progression: null,
  },
  {
    name: "Pompes prise large",
    muscleGroup: "pectoraux",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Mains bien plus larges que les épaules, coudes ouverts vers l'extérieur pour maximiser l'étirement des pectoraux. L'amplitude est plus courte : ne pas descendre au point de sentir une tension dans l'avant de l'épaule.",
    progression: "Pompes archer",
  },
  {
    name: "Dips entre deux chaises",
    muscleGroup: "pectoraux",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Mains posées sur deux chaises stables, buste penché en avant et jambes fléchies pour cibler les pectoraux. Descendre jusqu'à ce que les bras forment un angle droit, pas plus bas, épaules basses.",
    progression: null,
  },
  {
    name: "Développé couché haltères au sol",
    muscleGroup: "pectoraux",
    equipment: "halteres",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Allongé au sol genoux fléchis, haltères à hauteur de poitrine, pousser à la verticale sans verrouiller les coudes. Le sol limite la descente et protège l'épaule : idéal pour apprendre la trajectoire.",
    progression: "Développé couché haltères",
  },
  {
    name: "Développé couché haltères",
    muscleGroup: "pectoraux",
    equipment: "banc+halteres",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Allongé sur le banc, omoplates serrées et pieds au sol, descendre les haltères à hauteur des pectoraux en gardant les poignets dans l'axe des avant-bras. Ne pas laisser les coudes s'ouvrir à 90 degrés du buste.",
    progression: "Développé couché barre",
  },
  {
    name: "Développé couché barre",
    muscleGroup: "pectoraux",
    equipment: "barre_dc+banc",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Barre descendue au niveau du bas des pectoraux, coudes à environ 45 degrés, omoplates serrées et fessiers en contact avec le banc. Garder les poignets droits et pousser en ligne au-dessus des épaules.",
    progression: null,
  },
  {
    name: "Développé incliné haltères",
    muscleGroup: "pectoraux",
    equipment: "banc+halteres",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Banc incliné à 30 ou 45 degrés, haltères descendus à hauteur des clavicules coudes légèrement rentrés. Un dossier trop redressé transfère le travail sur les épaules au lieu du haut des pectoraux.",
    progression: "Développé couché barre",
  },
  {
    name: "Écartés couché haltères",
    muscleGroup: "pectoraux",
    equipment: "banc+halteres",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Bras légèrement fléchis et verrouillés dans cet angle, ouvrir en arc de cercle jusqu'à sentir l'étirement des pectoraux. Ne pas descendre les coudes sous la ligne du banc et remonter sans transformer le mouvement en développé.",
    progression: null,
  },
  {
    name: "Écartés élastique debout",
    muscleGroup: "pectoraux",
    equipment: "elastiques",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Élastique fixé derrière soi à hauteur de poitrine, bras quasi tendus, ramener les mains devant le sternum en serrant les pectoraux. Garder le buste immobile et les côtes basses, sans compenser avec les lombaires.",
    progression: "Écartés couché haltères",
  },
  {
    name: "Pull-over haltère",
    muscleGroup: "pectoraux",
    equipment: "banc+halteres",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Allongé sur le banc, un haltère tenu à deux mains au-dessus de la poitrine, descendre derrière la tête bras légèrement fléchis. Limiter l'amplitude au confort de l'épaule et garder les côtes basses pour ne pas cambrer.",
    progression: null,
  },

  // ==========================================================================
  // DOS
  // ==========================================================================
  {
    name: "Pompes scapulaires",
    muscleGroup: "dos",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "En position de planche bras tendus, laisser le sternum descendre entre les omoplates puis pousser le sol pour les écarter. Les coudes restent tendus : seules les omoplates bougent.",
    progression: "Rowing inversé sous une table",
  },
  {
    name: "Superman au sol",
    muscleGroup: "dos",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Allongé sur le ventre, décoller simultanément les bras tendus et les jambes de quelques centimètres. Regarder le sol pour garder la nuque neutre et tenir 2 secondes en position haute.",
    progression: "Nageur au sol",
  },
  {
    name: "Nageur au sol",
    muscleGroup: "dos",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Sur le ventre, buste et bras décollés, décrire des cercles de bras en passant de la position tendue devant à mains dans le bas du dos. Garder les jambes et le bassin plaqués au sol pendant tout le mouvement.",
    progression: null,
  },
  {
    name: "Rowing inversé sous une table",
    muscleGroup: "dos",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Allongé sous une table solide, saisir le bord et tirer la poitrine vers le plateau, corps en ligne droite et talons au sol. Serrer les omoplates en fin de tirage plutôt que de tirer uniquement avec les bras.",
    progression: "Rowing inversé jambes tendues",
  },
  {
    name: "Rowing inversé jambes tendues",
    muscleGroup: "dos",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Même mouvement que le rowing sous table mais talons posés sur une chaise pour placer le corps à l'horizontale. Ne pas laisser le bassin s'affaisser pendant la descente.",
    progression: "Rowing inversé à un bras",
  },
  {
    name: "Rowing inversé à un bras",
    muscleGroup: "dos",
    equipment: "aucun",
    level: "AVANCE",
    type: "POLYARTICULAIRE",
    description:
      "Une seule main sur le bord de la table, l'autre bras le long du corps, tirer en résistant à la rotation du buste. Rapprocher les pieds pour redresser le corps et faciliter le mouvement si le contrôle est perdu.",
    progression: null,
  },
  {
    name: "Suspension à la barre",
    muscleGroup: "dos",
    equipment: "barre_traction",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Suspendu bras tendus en prise pronation à largeur d'épaules, relâcher les épaules puis les activer en abaissant les omoplates. Tenir 20 à 40 secondes pour construire la poigne et la stabilité scapulaire.",
    progression: "Tractions négatives",
  },
  {
    name: "Tractions négatives",
    muscleGroup: "dos",
    equipment: "barre_traction",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Partir menton au-dessus de la barre à l'aide d'un appui ou d'un saut, puis descendre en 4 à 6 secondes jusqu'aux bras tendus. Ne jamais relâcher la fin de la descente d'un coup.",
    progression: "Tractions supination",
  },
  {
    name: "Tractions supination",
    muscleGroup: "dos",
    equipment: "barre_traction",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Paumes tournées vers soi, mains à largeur d'épaules, tirer la poitrine vers la barre en gardant les côtes basses. Descendre jusqu'aux bras tendus sans balancer les jambes pour créer de l'élan.",
    progression: "Tractions pronation",
  },
  {
    name: "Tractions pronation",
    muscleGroup: "dos",
    equipment: "barre_traction",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Paumes vers l'avant, prise légèrement plus large que les épaules, initier le tirage en abaissant les omoplates avant de plier les coudes. Monter le menton au-dessus de la barre sans donner de coup de bassin.",
    progression: "Tractions prise large",
  },
  {
    name: "Tractions prise large",
    muscleGroup: "dos",
    equipment: "barre_traction",
    level: "AVANCE",
    type: "POLYARTICULAIRE",
    description:
      "Prise nettement plus large que les épaules, tirer le haut de la poitrine vers la barre en gardant les coudes dans le plan du corps. L'amplitude est plus courte : privilégier la qualité au nombre de répétitions.",
    progression: null,
  },
  {
    name: "Rowing haltère à un bras",
    muscleGroup: "dos",
    equipment: "halteres",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Un genou et une main en appui sur un support stable, dos plat, tirer l'haltère vers la hanche coude près du corps. Ne pas tourner le buste pour gagner de l'amplitude.",
    progression: "Rowing barre buste penché",
  },
  {
    name: "Rowing barre buste penché",
    muscleGroup: "dos",
    equipment: "barre_dc",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Buste penché à environ 45 degrés, dos plat et genoux légèrement fléchis, tirer la barre vers le nombril. Relâcher lentement sans se redresser à chaque répétition.",
    progression: "Soulevé de terre barre",
  },
  {
    name: "Soulevé de terre barre",
    muscleGroup: "dos",
    equipment: "barre_dc",
    level: "AVANCE",
    type: "POLYARTICULAIRE",
    description:
      "Barre à l'aplomb du milieu du pied, dos plat et épaules légèrement devant la barre, pousser le sol avec les jambes puis verrouiller les hanches. Le dos ne doit jamais s'arrondir : réduire la charge avant de dégrader la posture.",
    progression: null,
  },
  {
    name: "Tirage horizontal élastique",
    muscleGroup: "dos",
    equipment: "elastiques",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Élastique fixé devant soi à hauteur de nombril, tirer les poignées vers les hanches en serrant les omoplates. Garder les épaules basses, le buste gainé et éviter de reculer pour tricher.",
    progression: "Rowing haltère à un bras",
  },
  {
    name: "Tirage vertical élastique",
    muscleGroup: "dos",
    equipment: "elastiques",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Élastique ancré en hauteur, à genoux ou debout, tirer les mains vers les épaules en descendant les coudes le long du corps. Éviter de partir en arrière avec le buste pour compenser la résistance.",
    progression: "Tractions négatives",
  },
  {
    name: "Rowing kettlebell à un bras",
    muscleGroup: "dos",
    equipment: "kettlebell",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Buste penché dos plat, main libre en appui sur une cuisse ou un support, tirer la kettlebell le long du corps jusqu'à la hanche. Marquer un temps d'arrêt en haut et contrôler la descente complète.",
    progression: "Rowing barre buste penché",
  },
  {
    name: "Shrugs haltères",
    muscleGroup: "dos",
    equipment: "halteres",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Haltères le long du corps, monter les épaules vers les oreilles sans plier les coudes ni rouler les épaules. Tenir une seconde en haut puis redescendre lentement en amplitude complète.",
    progression: null,
  },

  // ==========================================================================
  // EPAULES
  // ==========================================================================
  {
    name: "Cercles de bras",
    muscleGroup: "epaules",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Debout, bras tendus à l'horizontale, décrire des cercles de petit puis de grand diamètre, dans un sens puis dans l'autre. Garder les épaules basses et le buste gainé, sans cambrer le bas du dos.",
    progression: "Élévations frontales en gainage",
  },
  {
    name: "Pompes piquées genoux au sol",
    muscleGroup: "epaules",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Bassin haut et tête dirigée vers le sol, genoux posés pour alléger la charge, fléchir les coudes pour descendre le sommet du crâne entre les mains. Garder les coudes proches du corps plutôt que largement ouverts.",
    progression: "Pompes piquées",
  },
  {
    name: "Pompes piquées",
    muscleGroup: "epaules",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "En V inversé bassin haut, descendre le sommet de la tête vers le sol entre les mains puis pousser. Plus les pieds sont proches des mains, plus la charge sur les épaules augmente.",
    progression: "Pompes piquées surélevées",
  },
  {
    name: "Pompes piquées surélevées",
    muscleGroup: "epaules",
    equipment: "aucun",
    level: "AVANCE",
    type: "POLYARTICULAIRE",
    description:
      "Pieds posés sur une chaise, bassin à la verticale des épaules, descendre la tête vers le sol. Garder le bassin haut : s'il recule, la charge revient sur les pectoraux.",
    progression: "Pompes en équilibre contre un mur",
  },
  {
    name: "Pompes en équilibre contre un mur",
    muscleGroup: "epaules",
    equipment: "aucun",
    level: "AVANCE",
    type: "POLYARTICULAIRE",
    description:
      "En appui tête en bas contre un mur, mains à largeur d'épaules et doigts écartés, descendre le sommet du crâne vers le sol puis pousser. Serrer le ventre et les fessiers pour éviter de creuser le dos.",
    progression: null,
  },
  {
    name: "Tenue en équilibre contre un mur",
    muscleGroup: "epaules",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Monter en équilibre ventre ou dos au mur, corps gainé et épaules poussées vers le haut. Tenir 20 à 45 secondes en respirant normalement, sans cambrer le bas du dos.",
    progression: "Pompes en équilibre contre un mur",
  },
  {
    name: "Élévations frontales en gainage",
    muscleGroup: "epaules",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "En position de planche bras tendus, décoller une main et tendre le bras devant soi à hauteur d'oreille. Écarter les pieds pour limiter la rotation du bassin et alterner lentement.",
    progression: null,
  },
  {
    name: "Développé militaire haltères",
    muscleGroup: "epaules",
    equipment: "halteres",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Debout ou assis, haltères à hauteur d'oreilles coudes sous les poignets, pousser à la verticale sans cambrer. Serrer fessiers et abdominaux pour verrouiller le bassin pendant la poussée.",
    progression: "Développé militaire barre",
  },
  {
    name: "Développé militaire barre",
    muscleGroup: "epaules",
    equipment: "barre_dc",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Barre sur le haut de la poitrine, pousser au-dessus de la tête en rentrant légèrement le menton pour laisser passer la barre. Verrouiller en amenant la tête sous la barre, côtes basses et jambes tendues.",
    progression: null,
  },
  {
    name: "Développé Arnold haltères",
    muscleGroup: "epaules",
    equipment: "halteres",
    level: "AVANCE",
    type: "POLYARTICULAIRE",
    description:
      "Partir paumes tournées vers soi devant le visage, pivoter les avant-bras vers l'extérieur pendant la poussée. Contrôler la rotation à la descente et rester sur des charges modérées.",
    progression: null,
  },
  {
    name: "Élévations latérales haltères",
    muscleGroup: "epaules",
    equipment: "halteres",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Bras légèrement fléchis, monter les haltères sur les côtés jusqu'à hauteur d'épaules sans monter plus haut. Descendre en 2 à 3 secondes sans donner d'élan avec le buste.",
    progression: null,
  },
  {
    name: "Élévations frontales haltères",
    muscleGroup: "epaules",
    equipment: "halteres",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Monter les haltères devant soi bras quasi tendus jusqu'à hauteur des yeux, ensemble ou en alternance. Gainer le ventre et rester parfaitement immobile pour ne pas cambrer.",
    progression: "Élévations latérales haltères",
  },
  {
    name: "Oiseau haltères buste penché",
    muscleGroup: "epaules",
    equipment: "halteres",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Buste penché à 45 degrés dos plat, ouvrir les bras sur les côtés coudes légèrement fléchis. Penser à écarter les coudes plutôt qu'à monter les mains pour cibler l'arrière de l'épaule.",
    progression: null,
  },
  {
    name: "Élévations latérales élastique",
    muscleGroup: "epaules",
    equipment: "elastiques",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Debout au centre de l'élastique, monter les bras sur les côtés jusqu'à l'horizontale contre la résistance. La tension étant maximale en haut, contrôler surtout la phase de descente.",
    progression: "Élévations latérales haltères",
  },
  {
    name: "Rotations externes élastique",
    muscleGroup: "epaules",
    equipment: "elastiques",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Coude collé au corps et fléchi à 90 degrés, faire pivoter l'avant-bras vers l'extérieur sans déplacer le coude. Mouvement lent et léger, utile en échauffement et en prévention de l'épaule.",
    progression: "Oiseau haltères buste penché",
  },
  {
    name: "Développé militaire kettlebell à un bras",
    muscleGroup: "epaules",
    equipment: "kettlebell",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Kettlebell en position rack contre l'avant-bras, pousser à la verticale en gainant fortement le côté opposé. Le poignet reste droit et la cloche repose sur l'avant-bras, jamais en appui sur le poignet.",
    progression: "Développé militaire barre",
  },

  // ==========================================================================
  // BRAS
  // ==========================================================================
  {
    name: "Pompes prise serrée sur les genoux",
    muscleGroup: "bras",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Genoux au sol, mains sous les épaules ou plus rapprochées, coudes qui frôlent les côtes pendant la descente. Ne pas laisser les coudes s'ouvrir vers l'extérieur, sinon le travail quitte les triceps.",
    progression: "Pompes diamant",
  },
  {
    name: "Pompes diamant",
    muscleGroup: "bras",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Index et pouces qui se touchent pour former un losange sous le sternum, coudes serrés le long du corps. Descendre la poitrine vers les mains en gardant le corps parfaitement gainé.",
    progression: "Pompes diamant déclinées",
  },
  {
    name: "Pompes diamant déclinées",
    muscleGroup: "bras",
    equipment: "aucun",
    level: "AVANCE",
    type: "POLYARTICULAIRE",
    description:
      "Mains en losange au sol et pieds surélevés sur une chaise, coudes le long du corps. Réduire la hauteur des pieds dès que le bas du dos se creuse.",
    progression: null,
  },
  {
    name: "Dips sur chaise",
    muscleGroup: "bras",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Mains sur le bord d'une chaise stable derrière soi, jambes fléchies pieds à plat, descendre en fléchissant les coudes vers l'arrière jusqu'à 90 degrés. Garder le dos près de la chaise et les épaules basses.",
    progression: "Dips sur chaise jambes tendues",
  },
  {
    name: "Dips sur chaise jambes tendues",
    muscleGroup: "bras",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Même mouvement mais jambes tendues devant, talons au sol ou posés sur un second appui. Descendre lentement sans hausser les épaules vers les oreilles.",
    progression: "Dips entre deux chaises",
  },
  {
    name: "Extensions triceps au sol",
    muscleGroup: "bras",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "En appui bras tendus mains sous les épaules, descendre en fléchissant uniquement les coudes jusqu'à poser les avant-bras au sol, puis pousser pour revenir. Les coudes restent fixes et proches du corps.",
    progression: null,
  },
  {
    name: "Curl à la serviette en auto-résistance",
    muscleGroup: "bras",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Tenir une extrémité de serviette dans chaque main, une main tire en flexion pendant que l'autre résiste vers le bas. Travailler 4 à 6 secondes par répétition en gardant les coudes collés au corps.",
    progression: "Curl biceps haltères",
  },
  {
    name: "Tractions supination prise serrée",
    muscleGroup: "bras",
    equipment: "barre_traction",
    level: "AVANCE",
    type: "POLYARTICULAIRE",
    description:
      "Prise supination mains rapprochées, tirer en gardant les coudes serrés devant soi pour maximiser le travail des biceps. Descendre bras tendus sans à-coups ni balancement.",
    progression: null,
  },
  {
    name: "Curl biceps haltères",
    muscleGroup: "bras",
    equipment: "halteres",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Coudes fixes contre les côtes, monter les haltères en tournant les paumes vers le haut, puis descendre en 3 secondes. Ne pas balancer le buste ni avancer les coudes en fin de montée.",
    progression: "Curl marteau haltères",
  },
  {
    name: "Curl marteau haltères",
    muscleGroup: "bras",
    equipment: "halteres",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Paumes face à face pendant tout le mouvement, coudes immobiles, monter jusqu'à hauteur d'épaule. Garder le poignet neutre et ferme pour solliciter le brachial et l'avant-bras.",
    progression: "Curl incliné haltères",
  },
  {
    name: "Curl incliné haltères",
    muscleGroup: "bras",
    equipment: "banc+halteres",
    level: "AVANCE",
    type: "ISOLATION",
    description:
      "Assis sur un banc incliné à 45 degrés, bras pendants légèrement derrière la ligne du corps, monter sans avancer les coudes. L'étirement de départ est le point clé : contrôler la descente jusqu'à extension complète.",
    progression: null,
  },
  {
    name: "Curl barre",
    muscleGroup: "bras",
    equipment: "barre_dc",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Barre en prise supination à largeur d'épaules, coudes fixes contre les côtes, monter jusqu'à la poitrine sans reculer le buste. Serrer abdominaux et fessiers pour éliminer le balancement lombaire.",
    progression: null,
  },
  {
    name: "Curl biceps élastique",
    muscleGroup: "bras",
    equipment: "elastiques",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Debout au centre de l'élastique, coudes plaqués aux côtes, monter les poignées jusqu'aux épaules. La résistance augmentant en fin de course, marquer une seconde en position haute.",
    progression: "Curl biceps haltères",
  },
  {
    name: "Extensions triceps nuque haltère",
    muscleGroup: "bras",
    equipment: "halteres",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Haltère tenu à deux mains au-dessus de la tête, descendre derrière la nuque en ne bougeant que les coudes. Garder les coudes serrés et les côtes basses pour ne pas cambrer le bas du dos.",
    progression: "Barre au front haltères",
  },
  {
    name: "Barre au front haltères",
    muscleGroup: "bras",
    equipment: "banc+halteres",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Allongé sur le banc, haltères au-dessus des épaules, fléchir les coudes pour descendre vers le front ou légèrement derrière la tête. Les bras restent fixes : seuls les avant-bras bougent.",
    progression: null,
  },
  {
    name: "Kickback triceps haltère",
    muscleGroup: "bras",
    equipment: "halteres",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Buste penché dos plat, coude remonté à hauteur du tronc et totalement immobile, tendre l'avant-bras vers l'arrière jusqu'au verrouillage du triceps. Ne pas balancer l'épaule pour lancer l'haltère.",
    progression: "Extensions triceps nuque haltère",
  },
  {
    name: "Extensions triceps élastique",
    muscleGroup: "bras",
    equipment: "elastiques",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Élastique ancré en hauteur, coudes collés au corps, tendre les avant-bras vers le bas jusqu'à extension complète. Remonter lentement sans laisser les coudes s'écarter du tronc.",
    progression: "Extensions triceps nuque haltère",
  },
  {
    name: "Curl kettlebell à deux mains",
    muscleGroup: "bras",
    equipment: "kettlebell",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Kettlebell tenue par les cornes à deux mains, coudes fixes, monter jusqu'à la poitrine puis descendre lentement. La charge décalée sollicite fortement la poigne : garder les poignets alignés avec les avant-bras.",
    progression: null,
  },

  // ==========================================================================
  // JAMBES
  // ==========================================================================
  {
    name: "Squat sur chaise",
    muscleGroup: "jambes",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Debout devant une chaise, descendre en poussant les hanches vers l'arrière jusqu'à effleurer l'assise, puis se relever. La chaise sert de repère de profondeur : ne pas s'y asseoir ni s'y laisser tomber.",
    progression: "Squat au poids du corps",
  },
  {
    name: "Squat au poids du corps",
    muscleGroup: "jambes",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Pieds à largeur de hanches et pointes légèrement ouvertes, descendre jusqu'à ce que les cuisses soient parallèles au sol en gardant les talons au sol. Les genoux suivent la ligne des pointes de pieds, sans rentrer vers l'intérieur.",
    progression: "Fentes avant",
  },
  {
    name: "Fentes avant",
    muscleGroup: "jambes",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Faire un grand pas en avant et descendre le genou arrière vers le sol, buste droit et genou avant à l'aplomb de la cheville. Pousser sur le talon avant pour revenir en position debout.",
    progression: "Fentes bulgares sur chaise",
  },
  {
    name: "Fentes bulgares sur chaise",
    muscleGroup: "jambes",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Pied arrière posé sur une chaise, pied avant assez loin devant, descendre à la verticale jusqu'à cuisse avant parallèle au sol. Garder le buste légèrement incliné et le poids sur la jambe avant.",
    progression: "Squat pistol assisté",
  },
  {
    name: "Squat pistol assisté",
    muscleGroup: "jambes",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Sur une jambe, l'autre tendue devant, descendre en se tenant à un montant de porte ou en posant une main sur une chaise. Réduire progressivement l'aide en gardant le talon au sol.",
    progression: "Squat pistol",
  },
  {
    name: "Squat pistol",
    muscleGroup: "jambes",
    equipment: "aucun",
    level: "AVANCE",
    type: "POLYARTICULAIRE",
    description:
      "Descendre sur une jambe, jambe libre tendue devant et bras en avant pour l'équilibre, jusqu'en bas puis remonter sans poser le pied. Garder le talon au sol et le genou aligné avec le pied.",
    progression: null,
  },
  {
    name: "Squat sauté",
    muscleGroup: "jambes",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Descendre en squat puis pousser explosivement pour décoller, réceptionner en amortissant genoux fléchis. Enchaîner sans temps mort mais interrompre la série dès que les genoux rentrent à la réception.",
    progression: "Fentes sautées",
  },
  {
    name: "Fentes sautées",
    muscleGroup: "jambes",
    equipment: "aucun",
    level: "AVANCE",
    type: "POLYARTICULAIRE",
    description:
      "Depuis une position de fente, sauter pour changer de jambe en l'air et réceptionner directement en fente. Amortir chaque réception et garder le buste droit tout au long de la série.",
    progression: null,
  },
  {
    name: "Pont fessier au sol",
    muscleGroup: "jambes",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Allongé sur le dos genoux fléchis pieds à plat, monter le bassin en serrant les fessiers jusqu'à aligner épaules, hanches et genoux. Ne pas chercher à monter plus haut en cambrant le bas du dos.",
    progression: "Pont fessier sur une jambe",
  },
  {
    name: "Pont fessier sur une jambe",
    muscleGroup: "jambes",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Même mouvement avec une jambe tendue ou le genou ramené vers la poitrine. Le bassin doit rester horizontal : ne pas laisser le côté libre s'affaisser.",
    progression: null,
  },
  {
    name: "Mollets debout au poids du corps",
    muscleGroup: "jambes",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Debout, monter sur la pointe des pieds le plus haut possible, marquer une seconde puis redescendre lentement le talon. Se tenir légèrement à un support pour rester stable et éviter de rebondir.",
    progression: "Mollets debout sur une jambe",
  },
  {
    name: "Mollets debout sur une jambe",
    muscleGroup: "jambes",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Sur une jambe, idéalement l'avant-pied sur une marche pour descendre le talon sous le niveau de l'appui. Amplitude complète et descente contrôlée en 3 secondes.",
    progression: null,
  },
  {
    name: "Chaise contre le mur",
    muscleGroup: "jambes",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Dos plaqué au mur, cuisses parallèles au sol et genoux à 90 degrés, tenir la position 30 à 60 secondes. Répartir le poids sur les talons et respirer normalement plutôt que de bloquer la respiration.",
    progression: "Squat sauté",
  },
  {
    name: "Goblet squat kettlebell",
    muscleGroup: "jambes",
    equipment: "kettlebell",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Kettlebell tenue par les cornes contre la poitrine coudes rentrés, descendre entre les jambes en gardant le buste droit. La charge placée devant aide à conserver le dos droit et la profondeur.",
    progression: "Squat barre",
  },
  {
    name: "Swing kettlebell",
    muscleGroup: "jambes",
    equipment: "kettlebell",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Mouvement de hanche et non de bras : basculer les hanches en arrière puis les projeter en avant pour envoyer la kettlebell à hauteur de poitrine. Ne pas squatter ni tenter de soulever la cloche avec les épaules.",
    progression: null,
  },
  {
    name: "Squat barre",
    muscleGroup: "jambes",
    equipment: "barre_dc",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Barre posée sur les trapèzes, pieds à largeur d'épaules, descendre hanches en arrière jusqu'à la parallèle en gardant le dos gainé. Pousser les genoux vers l'extérieur et remonter sans laisser le buste piquer en avant.",
    progression: null,
  },
  {
    name: "Fentes haltères",
    muscleGroup: "jambes",
    equipment: "halteres",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Un haltère dans chaque main bras le long du corps, réaliser des fentes avant ou marchées en gardant le buste droit. Poser le pied à plat et éviter les pas trop grands qui déséquilibrent.",
    progression: "Fentes bulgares haltères",
  },
  {
    name: "Fentes bulgares haltères",
    muscleGroup: "jambes",
    equipment: "banc+halteres",
    level: "AVANCE",
    type: "POLYARTICULAIRE",
    description:
      "Pied arrière posé sur le banc, un haltère dans chaque main, descendre à la verticale jusqu'à cuisse avant parallèle. Charger progressivement : la stabilité est le facteur limitant avant la force.",
    progression: null,
  },
  {
    name: "Soulevé de terre roumain haltères",
    muscleGroup: "jambes",
    equipment: "halteres",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Jambes quasi tendues, descendre les haltères le long des cuisses en poussant les hanches vers l'arrière, dos plat. S'arrêter dès que les ischio-jambiers tirent, sans arrondir le bas du dos.",
    progression: "Soulevé de terre barre",
  },
  {
    name: "Mollets debout haltères",
    muscleGroup: "jambes",
    equipment: "halteres",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Un haltère dans chaque main, monter sur la pointe des pieds en amplitude complète puis descendre lentement. Marquer un temps d'arrêt en bas au lieu de rebondir sur le tendon.",
    progression: null,
  },
  {
    name: "Squat élastique",
    muscleGroup: "jambes",
    equipment: "elastiques",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Élastique sous les pieds et passé sur les épaules, descendre en squat contre la résistance. Garder la tension même en position basse et remonter en poussant le sol avec les talons.",
    progression: "Goblet squat kettlebell",
  },
  {
    name: "Abduction de hanche élastique",
    muscleGroup: "jambes",
    equipment: "elastiques",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Mini-élastique placé au-dessus des genoux, en position de demi-squat, écarter les genoux contre la résistance sans bouger le bassin. Mouvement lent et contrôlé, très utile en échauffement des fessiers.",
    progression: null,
  },
  {
    name: "Hip thrust sur banc avec haltère",
    muscleGroup: "jambes",
    equipment: "banc+halteres",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Haut du dos calé sur le banc, haltère posé sur le pli des hanches, monter jusqu'à aligner buste et cuisses en serrant les fessiers. Rentrer le menton et ne pas hyperétendre le bas du dos en position haute.",
    progression: null,
  },

  // ==========================================================================
  // ABDOS
  // ==========================================================================
  {
    name: "Crunchs au sol",
    muscleGroup: "abdos",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Allongé genoux fléchis, mains aux tempes sans tirer sur la nuque, enrouler le buste pour décoller les omoplates. Le bas du dos reste plaqué au sol et l'amplitude reste courte.",
    progression: "Crunchs jambes levées",
  },
  {
    name: "Crunchs jambes levées",
    muscleGroup: "abdos",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Jambes fléchies à 90 degrés en l'air, enrouler le buste vers les genoux sans balancer les jambes. Souffler en montant et contrôler la descente sans relâcher les abdominaux.",
    progression: "Relevés de jambes au sol",
  },
  {
    name: "Relevés de jambes au sol",
    muscleGroup: "abdos",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Allongé, mains sous les fesses pour stabiliser le bassin, monter les jambes tendues à la verticale puis descendre lentement. Arrêter la descente dès que le bas du dos commence à se décoller.",
    progression: "Relevés de jambes suspendu",
  },
  {
    name: "Relevés de jambes suspendu",
    muscleGroup: "abdos",
    equipment: "barre_traction",
    level: "AVANCE",
    type: "ISOLATION",
    description:
      "Suspendu à la barre épaules actives, monter les jambes tendues jusqu'à l'horizontale ou plus haut en enroulant le bassin. Éviter tout balancement en marquant un arrêt entre les répétitions.",
    progression: null,
  },
  {
    name: "Gainage planche",
    muscleGroup: "abdos",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Appui sur les avant-bras et les pointes de pieds, corps aligné des talons à la tête, bassin légèrement rétroversé. Serrer fessiers et abdominaux sans creuser le bas du dos ni monter les fesses.",
    progression: "Planche avec touches d'épaules",
  },
  {
    name: "Planche avec touches d'épaules",
    muscleGroup: "abdos",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "En planche bras tendus pieds écartés, venir toucher l'épaule opposée avec une main en alternance. Le bassin ne doit pas basculer d'un côté à l'autre pendant les transferts.",
    progression: "Gainage planche sur un bras",
  },
  {
    name: "Gainage planche sur un bras",
    muscleGroup: "abdos",
    equipment: "aucun",
    level: "AVANCE",
    type: "ISOLATION",
    description:
      "En planche sur les avant-bras, décoller un bras et le tendre devant soi ou le poser dans le dos. Résister à la rotation du buste et tenir 10 à 20 secondes par côté.",
    progression: null,
  },
  {
    name: "Gainage latéral",
    muscleGroup: "abdos",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "En appui sur un avant-bras et le tranchant du pied, hanches décollées et alignées avec épaules et chevilles. Ne pas laisser le bassin descendre et garder la nuque dans l'axe du corps.",
    progression: "Gainage latéral avec élévation de hanche",
  },
  {
    name: "Gainage latéral avec élévation de hanche",
    muscleGroup: "abdos",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Depuis la position de gainage latéral, descendre la hanche à quelques centimètres du sol puis la remonter au-dessus de la ligne du corps. Mouvement lent, sans rotation du buste ni bascule vers l'avant.",
    progression: null,
  },
  {
    name: "Mountain climbers",
    muscleGroup: "abdos",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "En planche bras tendus, ramener alternativement un genou vers la poitrine à rythme soutenu. Garder le bassin bas et stable, les épaules à l'aplomb des mains.",
    progression: "Mountain climbers croisés",
  },
  {
    name: "Mountain climbers croisés",
    muscleGroup: "abdos",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "POLYARTICULAIRE",
    description:
      "Même mouvement mais le genou vient vers le coude opposé pour solliciter les obliques. Ralentir la cadence pour conserver un bassin stable et une planche propre.",
    progression: null,
  },
  {
    name: "Dead bug au sol",
    muscleGroup: "abdos",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Sur le dos, bras tendus vers le plafond et genoux à 90 degrés, descendre un bras et la jambe opposée sans décoller le bas du dos. Souffler pendant la descente et alterner lentement.",
    progression: "Tenue en creux",
  },
  {
    name: "Tenue en creux",
    muscleGroup: "abdos",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Sur le dos, bas du dos plaqué au sol, bras tendus derrière la tête et jambes tendues légèrement décollées. Si le dos se creuse, replier les genoux ou monter les jambes plus haut.",
    progression: "Relevés en V",
  },
  {
    name: "Relevés en V",
    muscleGroup: "abdos",
    equipment: "aucun",
    level: "AVANCE",
    type: "POLYARTICULAIRE",
    description:
      "Allongé bras tendus derrière la tête, monter simultanément buste et jambes tendues pour amener les mains vers les pieds. Enrouler la colonne au lieu de se plier d'un seul bloc.",
    progression: null,
  },
  {
    name: "Sit-ups au sol",
    muscleGroup: "abdos",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Pieds calés ou libres, monter le buste jusqu'à la position assise en déroulant la colonne vertèbre par vertèbre. Croiser les bras sur la poitrine plutôt que de tirer sur la nuque.",
    progression: "Relevés en V",
  },
  {
    name: "Russian twist au poids du corps",
    muscleGroup: "abdos",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Assis buste incliné à 45 degrés et pieds décollés, faire pivoter les épaules d'un côté à l'autre. La rotation vient du buste et non du seul déplacement des bras.",
    progression: "Russian twist kettlebell",
  },
  {
    name: "Russian twist kettlebell",
    muscleGroup: "abdos",
    equipment: "kettlebell",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Même position avec la kettlebell tenue à deux mains devant le sternum, pivoter en amenant la cloche près de la hanche. Garder le dos droit et ne pas s'arrondir sous la charge.",
    progression: null,
  },
  {
    name: "Crunchs avec haltère sur la poitrine",
    muscleGroup: "abdos",
    equipment: "halteres",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Haltère tenu contre la poitrine, enrouler le buste sur une amplitude courte en gardant le bas du dos au sol. N'ajouter du poids que lorsque 20 crunchs propres sont possibles sans charge.",
    progression: null,
  },
  {
    name: "Rotations obliques élastique",
    muscleGroup: "abdos",
    equipment: "elastiques",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "Élastique ancré sur le côté à hauteur de poitrine, bras tendus devant soi, pivoter le buste à l'opposé de l'ancrage en gardant les hanches face à l'avant. Revenir lentement en contrôlant la traction.",
    progression: null,
  },
  {
    name: "Crunchs élastique à genoux",
    muscleGroup: "abdos",
    equipment: "elastiques",
    level: "INTERMEDIAIRE",
    type: "ISOLATION",
    description:
      "À genoux face à un élastique ancré en hauteur, poignées près des tempes, enrouler le buste vers le sol avec les abdominaux. Ne pas tirer avec les bras ni s'asseoir sur les talons.",
    progression: null,
  },

  // ==========================================================================
  // CARDIO
  // ==========================================================================
  {
    name: "Jumping jacks",
    muscleGroup: "cardio",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "CARDIO",
    description:
      "Écarter simultanément jambes et bras au-dessus de la tête puis revenir, en réceptionnant sur l'avant du pied genoux souples. Garder un rythme régulier sur des blocs de 30 à 60 secondes.",
    progression: "Montées de genoux sur place",
  },
  {
    name: "Talons-fesses sur place",
    muscleGroup: "cardio",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "CARDIO",
    description:
      "Courir sur place en ramenant les talons vers les fessiers, buste droit et bras actifs. Rester sur l'avant du pied et maintenir une cadence élevée sans se pencher en avant.",
    progression: "Montées de genoux sur place",
  },
  {
    name: "Montées de genoux sur place",
    muscleGroup: "cardio",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "CARDIO",
    description:
      "Courir sur place en montant les genoux à hauteur de hanches, gainage serré et appuis dynamiques. Éviter de partir en arrière avec le buste pour monter les genoux plus haut.",
    progression: "Sprints sur place",
  },
  {
    name: "Sprints sur place",
    muscleGroup: "cardio",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "CARDIO",
    description:
      "Course sur place à intensité maximale par blocs de 20 à 30 secondes, appuis très rapides sur l'avant du pied. Récupérer 40 à 60 secondes entre les blocs pour tenir l'intensité.",
    progression: "HIIT au poids du corps",
  },
  {
    name: "HIIT au poids du corps",
    muscleGroup: "cardio",
    equipment: "aucun",
    level: "AVANCE",
    type: "CARDIO",
    description:
      "Enchaîner 4 à 6 exercices (burpees, montées de genoux, squats sautés, mountain climbers) en 30 secondes d'effort et 15 secondes de repos, sur 3 à 5 tours. Réduire l'intensité plutôt que la qualité d'exécution en fin de séance.",
    progression: null,
  },
  {
    name: "Pas chassés latéraux",
    muscleGroup: "cardio",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "CARDIO",
    description:
      "Se déplacer latéralement en position de demi-squat, bassin bas et pieds qui ne se croisent jamais. Changer de direction toutes les 4 à 6 foulées en gardant les appuis dynamiques.",
    progression: "Sprints sur place",
  },
  {
    name: "Burpees sans pompe",
    muscleGroup: "cardio",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "CARDIO",
    description:
      "Depuis debout, poser les mains au sol, projeter les jambes en arrière en planche, les ramener puis se relever. Version sans pompe ni saut pour apprendre l'enchaînement en gardant le dos gainé.",
    progression: "Burpees",
  },
  {
    name: "Burpees",
    muscleGroup: "cardio",
    equipment: "aucun",
    level: "INTERMEDIAIRE",
    type: "CARDIO",
    description:
      "Descendre en planche, réaliser une pompe complète, ramener les pieds puis sauter en tendant les bras au-dessus de la tête. Garder le dos gainé au moment où les jambes partent en arrière.",
    progression: "Burpees avec saut groupé",
  },
  {
    name: "Burpees avec saut groupé",
    muscleGroup: "cardio",
    equipment: "aucun",
    level: "AVANCE",
    type: "CARDIO",
    description:
      "Burpee complet terminé par un saut genoux ramenés vers la poitrine. Amortir chaque réception genoux fléchis et arrêter la série dès que la posture se dégrade.",
    progression: null,
  },
  {
    name: "Saut à la corde de base",
    muscleGroup: "cardio",
    equipment: "corde_a_sauter",
    level: "DEBUTANT",
    type: "CARDIO",
    description:
      "Sauts pieds joints de faible amplitude, rotation générée par les poignets et non par les bras, coudes près du corps. Rester sur l'avant du pied et regarder devant soi plutôt que la corde.",
    progression: "Intervalles à la corde à sauter",
  },
  {
    name: "Intervalles à la corde à sauter",
    muscleGroup: "cardio",
    equipment: "corde_a_sauter",
    level: "INTERMEDIAIRE",
    type: "CARDIO",
    description:
      "Alterner 30 secondes de saut rapide et 30 secondes de récupération active, sur 8 à 12 séries. Garder les sauts bas pour tenir la cadence sans accrocher la corde.",
    progression: "Double under à la corde",
  },
  {
    name: "Double under à la corde",
    muscleGroup: "cardio",
    equipment: "corde_a_sauter",
    level: "AVANCE",
    type: "CARDIO",
    description:
      "Sauter légèrement plus haut et accélérer la rotation des poignets pour passer la corde deux fois par saut. Travailler par séries courtes en alternant avec des sauts simples pour préserver les mollets.",
    progression: null,
  },
  {
    name: "Marche rapide sur tapis",
    muscleGroup: "cardio",
    equipment: "tapis_course",
    level: "DEBUTANT",
    type: "CARDIO",
    description:
      "Marcher 20 à 30 minutes à allure soutenue avec 1 à 3 pour cent de pente, buste droit et foulée naturelle. Ne se tenir aux barres que pour l'équilibre, jamais pour soulager le poids du corps.",
    progression: "Endurance fondamentale sur tapis",
  },
  {
    name: "Endurance fondamentale sur tapis",
    muscleGroup: "cardio",
    equipment: "tapis_course",
    level: "DEBUTANT",
    type: "CARDIO",
    description:
      "Courir 30 à 45 minutes à une allure permettant de tenir une conversation, environ 70 pour cent de la fréquence cardiaque maximale. Résister à la tentation d'accélérer : le volume prime sur l'intensité.",
    progression: "Fractionné 30/30 sur tapis",
  },
  {
    name: "Fractionné 30/30 sur tapis",
    muscleGroup: "cardio",
    equipment: "tapis_course",
    level: "INTERMEDIAIRE",
    type: "CARDIO",
    description:
      "Alterner 30 secondes à allure rapide et 30 secondes en trot léger, sur 10 à 20 répétitions. Régler les vitesses avant de commencer pour éviter les changements brusques en pleine course.",
    progression: "Fractionné en côte sur tapis",
  },
  {
    name: "Fractionné en côte sur tapis",
    muscleGroup: "cardio",
    equipment: "tapis_course",
    level: "AVANCE",
    type: "CARDIO",
    description:
      "Blocs de 45 à 60 secondes à 6 ou 10 pour cent de pente à allure soutenue, récupération à plat en marchant. Garder une foulée courte et un buste légèrement penché en avant.",
    progression: null,
  },
  {
    name: "Swing kettlebell en intervalles",
    muscleGroup: "cardio",
    equipment: "kettlebell",
    level: "INTERMEDIAIRE",
    type: "CARDIO",
    description:
      "Séries de 20 secondes de swings puissants suivies de 40 secondes de repos, sur 8 à 10 tours. La puissance vient des hanches : arrêter la série dès que le dos s'arrondit.",
    progression: null,
  },
  {
    name: "Course sur place avec élastique",
    muscleGroup: "cardio",
    equipment: "elastiques",
    level: "INTERMEDIAIRE",
    type: "CARDIO",
    description:
      "Élastique fixé à la taille et ancré derrière soi, courir sur place ou avancer de quelques pas contre la résistance. Blocs de 20 à 30 secondes, appuis rapides et buste légèrement penché en avant.",
    progression: null,
  },

  // ==========================================================================
  // COMPLÉMENT DÉBUTANT AU POIDS DE CORPS
  //
  // Le haut du corps manquait de mouvements accessibles à un débutant sans
  // matériel : pectoraux, dos et bras plafonnaient à 3 exercices et les
  // épaules à 2, alors que le moteur en sélectionne 4 à 6 par séance. C'est
  // pourtant le profil cible de l'app. Les quelques mouvements lestés
  // ci-dessous utilisent des bouteilles d'eau pleines, au même titre que la
  // chaise : disponibles partout, donc classés « aucun ».
  // ==========================================================================

  {
    name: "Pompes contre un mur",
    muscleGroup: "pectoraux",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Debout face à un mur, mains à hauteur d'épaules et pieds reculés de deux pas, fléchir les coudes pour amener la poitrine au mur puis pousser. Garder le corps aligné de la tête aux talons, sans casser au niveau des hanches.",
    progression: "Pompes sur les genoux",
  },
  {
    name: "Serrage de paumes isométrique",
    muscleGroup: "pectoraux",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Paumes jointes devant la poitrine, coudes écartés à l'horizontale, presser une main contre l'autre aussi fort que possible pendant 10 à 20 secondes. Souffler pendant l'effort plutôt que bloquer la respiration.",
    // Volontairement sans progression : un isométrique ne mène pas aux
    // pompes, et le rattacher à leur chaîne priverait le moteur du seul
    // mouvement de pectoraux distinct dont dispose un débutant sans matériel.
    progression: null,
  },

  {
    name: "Bird dog au sol",
    muscleGroup: "dos",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "À quatre pattes, tendre simultanément le bras droit devant et la jambe gauche derrière, à l'horizontale, puis alterner. Le bassin ne doit pas basculer : garder les hanches parallèles au sol tout au long du mouvement.",
    progression: "Superman au sol",
  },
  {
    name: "Y-T-W au sol",
    muscleGroup: "dos",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Allongé sur le ventre, front au sol, décoller les bras et dessiner successivement un Y, un T puis un W avec les coudes. Le mouvement vient des omoplates que l'on serre, pas des mains que l'on lève.",
    progression: "Nageur au sol",
  },

  {
    name: "Touches d'épaules en gainage",
    muscleGroup: "epaules",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "En position de planche bras tendus, venir toucher l'épaule opposée avec une main puis l'autre, en alternance. Écarter les pieds pour stabiliser et empêcher le bassin de tourner à chaque touche.",
    progression: "Élévations frontales en gainage",
  },
  {
    name: "Élévations latérales avec bouteilles d'eau",
    muscleGroup: "epaules",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Une bouteille d'eau pleine dans chaque main, bras le long du corps, monter latéralement jusqu'à l'horizontale, coudes très légèrement fléchis. Monter sans hausser les épaules et redescendre en freinant.",
    progression: "Élévations latérales haltères",
  },
  {
    name: "Élévations frontales avec bouteilles d'eau",
    muscleGroup: "epaules",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Bouteilles d'eau pleines en main, bras tendus devant les cuisses, monter jusqu'à hauteur des yeux puis redescendre lentement. Ne pas prendre d'élan avec le buste : le tronc reste immobile.",
    progression: "Élévations frontales haltères",
  },

  {
    name: "Extensions triceps à la serviette en auto-résistance",
    muscleGroup: "bras",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Une serviette tenue derrière la nuque, main basse qui retient et main haute qui pousse vers le plafond en tendant le coude. Le coude reste haut et près de la tête pendant toute l'extension, puis on inverse les rôles.",
    progression: "Extensions triceps au sol",
  },
  // Familles de mouvements manquantes. Le moteur ne sert qu'un maillon par
  // chaîne de progression, pour ne pas enchaîner trois variantes de pompes
  // dans la même séance : il lui faut donc au moins quatre familles distinctes
  // par groupe. Pectoraux et dos n'en avaient que deux, les épaules trois.
  {
    name: "Écartés au sol avec bouteilles d'eau",
    muscleGroup: "pectoraux",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Allongé sur le dos, une bouteille pleine dans chaque main bras tendus vers le plafond, ouvrir les bras en arc de cercle jusqu'à frôler le sol puis refermer. Coudes légèrement fléchis et figés : c'est l'épaule qui ouvre, pas le coude.",
    progression: "Écartés couché haltères",
  },
  {
    name: "Pull-over au sol avec bouteille d'eau",
    muscleGroup: "pectoraux",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Allongé sur le dos, une bouteille tenue à deux mains au-dessus de la poitrine, descendre les bras tendus derrière la tête puis revenir. Garder les lombaires plaquées au sol en gainant le ventre.",
    progression: "Pull-over haltère",
  },
  {
    name: "Rowing avec bouteilles d'eau buste penché",
    muscleGroup: "dos",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "POLYARTICULAIRE",
    description:
      "Buste penché à 45°, dos plat et genoux fléchis, tirer les bouteilles vers les hanches en serrant les omoplates puis redescendre. Les coudes longent le corps, ils ne s'écartent pas vers l'extérieur.",
    progression: "Rowing haltère à un bras",
  },
  {
    name: "Pull-apart à la serviette",
    muscleGroup: "dos",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Serviette tendue à deux mains devant soi, bras à hauteur d'épaules, écarter les mains en tirant sur le tissu jusqu'à ouvrir la poitrine. Le mouvement s'arrête quand les omoplates se touchent, sans cambrer.",
    progression: null,
  },
  {
    name: "Oiseau avec bouteilles d'eau buste penché",
    muscleGroup: "epaules",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Buste penché vers l'avant, bras pendants avec une bouteille dans chaque main, ouvrir latéralement jusqu'à l'horizontale puis redescendre. Monter avec les coudes plutôt qu'avec les mains, sans à-coup du buste.",
    progression: "Oiseau haltères buste penché",
  },

  // Le cardio au poids de corps se réduisait à deux familles — course sur
  // place et burpees — donc une séance de quatre exercices répétait forcément
  // le même mouvement. Ces trois-là sont volontairement autonomes : ce sont
  // des registres différents, pas des maillons d'une progression.
  {
    name: "Shadow boxing",
    muscleGroup: "cardio",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "CARDIO",
    description:
      "Debout en garde, enchaîner directs, crochets et esquives en restant mobile sur les appuis. Garder les mains hautes et ne jamais verrouiller le coude en fin de frappe pour protéger l'articulation.",
    progression: null,
  },
  {
    name: "Sauts à la corde à vide",
    muscleGroup: "cardio",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "CARDIO",
    description:
      "Reproduire le geste de la corde à sauter sans corde : petits sauts sur la pointe des pieds, poignets qui tournent le long du corps. Amortir en gardant les genoux souples, sans écraser les talons au sol.",
    progression: null,
  },
  {
    name: "Marche de l'ours",
    muscleGroup: "cardio",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "CARDIO",
    description:
      "À quatre pattes genoux décollés de quelques centimètres, avancer en déplaçant main et pied opposés simultanément. Garder le dos plat et le bassin bas : c'est le gainage qui travaille autant que le cardio.",
    progression: null,
  },

  {
    name: "Curl avec bouteilles d'eau",
    muscleGroup: "bras",
    equipment: "aucun",
    level: "DEBUTANT",
    type: "ISOLATION",
    description:
      "Une bouteille d'eau pleine dans chaque main, coudes collés au buste, fléchir jusqu'à l'épaule puis redescendre bras tendus. Éviter le balancement du dos, qui transfère le travail des biceps vers les lombaires.",
    progression: "Curl biceps haltères",
  },
];
