/**
 * Gestes, dessinés en bonshommes bâton.
 *
 * ## Pourquoi pas Unity, ni une vidéo
 *
 * Un moteur de jeu ne **fabrique** pas un mouvement : il rejoue une animation
 * que quelqu'un a posée image par image. Les bibliothèques humanoïdes gratuites
 * couvrent la marche, la course et le combat — pas le kickback triceps. Il
 * faudrait donc animer les cent quarante-sept gestes à la main de toute façon,
 * puis les exporter en vidéos embarquées, et l'app pèserait des dizaines de
 * mégaoctets pour un contenu que la salle en sous-sol doit pouvoir afficher
 * sans réseau. Embarquer Unity dans une app Expo imposerait en plus une
 * reconstruction native à chaque retouche, là où tout le reste part par
 * `eas update`.
 *
 * Ici, un geste est une **poignée de nombres**. Le squelette compte sept
 * points, un mouvement deux ou trois poses, et l'app interpole entre elles.
 * Quelques centaines d'octets par geste, aucun fichier, aucune dépendance
 * nouvelle : `react-native-svg` est déjà embarqué pour les icônes d'onglets.
 *
 * ## Pourquoi cinquante-huit gestes suffisent à cent quarante-sept exercices
 *
 * Le curl haltères, le curl marteau, le curl barre, le curl élastique et le
 * curl aux bouteilles d'eau sont **le même mouvement** : le coude fléchit. Ce
 * qui change est la charge tenue, pas le geste. Un exercice pointe donc vers un
 * motif, et un motif nouveau n'est nécessaire que lorsque le corps bouge
 * autrement.
 */

/** Un point du squelette, en pourcentage d'une boîte de 100 × 100. */
export type Point = readonly [number, number];

/**
 * Sept points, et pas davantage.
 *
 * Ni épaule ni hanche : à cette échelle elles se confondent avec le cou et le
 * bassin, et les distinguer doublerait le travail d'écriture sans rien ajouter
 * à la lecture du geste. Le bras part du cou, la jambe du bassin.
 */
export interface Pose {
  tete: Point;
  cou: Point;
  bassin: Point;
  coude: Point;
  poignet: Point;
  genou: Point;
  cheville: Point;

  /**
   * Membres du fond, quand ils ne suivent pas ceux de devant.
   *
   * Facultatifs : le bonhomme bâton s'en passe, il décale et pâlit une copie du
   * membre visible. Un personnage habillé, lui, ne le peut pas — un bras de
   * derrière obtenu par décalage trahit à la première image. Ces points sont
   * donc renseignés à mesure que les gestes passent en version habillable, sans
   * qu'il faille tout reprendre d'un coup.
   */
  coudeFond?: Point;
  poignetFond?: Point;
  genouFond?: Point;
  chevilleFond?: Point;
}

/**
 * Membres du fond, avec repli sur le décalage du bonhomme bâton.
 *
 * Un seul endroit décide : le rendu habillé et le rendu bâton lisent la même
 * chose, et un geste passé en version complète profite aux deux sans qu'on
 * touche à l'un ou à l'autre.
 */
export function membresDuFond(pose: Pose, decalage: number) {
  const recule = (p: Point): Point => [p[0] - decalage, p[1]];
  return {
    coude: pose.coudeFond ?? recule(pose.coude),
    poignet: pose.poignetFond ?? recule(pose.poignet),
    genou: pose.genouFond ?? recule(pose.genou),
    cheville: pose.chevilleFond ?? recule(pose.cheville),
    /** Vrai quand les membres sont réellement posés, non déduits. */
    poses:
      pose.coudeFond !== undefined ||
      pose.poignetFond !== undefined ||
      pose.genouFond !== undefined ||
      pose.chevilleFond !== undefined,
  };
}

/** Ce que la silhouette tient, dessiné aux poignets. */
export type Charge = "haltere" | "barre" | "kettlebell" | "corde" | null;

/** Repère de décor, pour situer le corps dans l'espace. */
export type Decor = "sol" | "mur" | "barre" | "chaise" | "banc" | null;

export interface Motif {
  /** Libellé du geste, pour l'aperçu de développement. */
  nom: string;
  /**
   * Poses clés. L'animation les parcourt puis revient sur ses pas, si bien que
   * deux poses suffisent à un aller-retour — et c'est ce qu'est un mouvement
   * de musculation.
   */
  poses: Pose[];
  /** Millisecondes pour un aller simple. Par défaut 900. */
  duree?: number;
  charge?: Charge;
  decor?: Decor;
}

/**
 * Fabrique une pose à partir d'une pose de référence.
 *
 * La plupart des mouvements ne déplacent que deux ou trois points : écrire les
 * sept à chaque fois masquerait ce qui bouge réellement sous ce qui ne bouge
 * pas.
 */
export const derive = (base: Pose, changements: Partial<Pose>): Pose => ({
  ...base,
  ...changements,
});

// ---------------------------------------------------------------------------
// Postures de départ, partagées
// ---------------------------------------------------------------------------

/**
 * Debout, de profil, face à la droite de l'écran.
 *
 * Le bras part **nettement en avant** du tronc et la jambe porte un genou
 * légèrement fléchi. Ce n'est pas de la coquetterie : un bras posé sur l'axe du
 * corps se confond avec lui et disparaît, et une jambe parfaitement droite ne
 * se lit plus comme une jambe mais comme la suite du tronc.
 */
const DEBOUT: Pose = {
  tete: [48, 13],
  cou: [50, 25],
  bassin: [50, 53],
  coude: [58, 39],
  poignet: [60, 52],
  genou: [46, 72],
  cheville: [50, 93],
};

/** En appui facial, corps gainé — pompes, planche. */
const APPUI_FACIAL: Pose = {
  tete: [24, 46],
  cou: [34, 50],
  bassin: [62, 62],
  coude: [32, 66],
  poignet: [30, 84],
  genou: [80, 72],
  cheville: [94, 84],
};

/** Allongé sur le dos, genoux fléchis — crunchs, pont fessier. */
const DOS_AU_SOL: Pose = {
  tete: [18, 72],
  cou: [28, 76],
  bassin: [56, 84],
  coude: [26, 64],
  poignet: [20, 72],
  genou: [76, 64],
  cheville: [90, 84],
};

/**
 * Suspendu à une barre, bras tendus.
 *
 * Les bras montent **en écart**, non à la verticale du tronc : superposés à
 * lui, ils s'effaçaient entièrement et la silhouette n'était plus qu'un trait.
 */
const SUSPENDU: Pose = {
  tete: [48, 32],
  cou: [50, 42],
  bassin: [50, 68],
  coude: [58, 26],
  poignet: [62, 10],
  genou: [46, 82],
  cheville: [50, 95],
};

/** Assis au sol, buste relevé, genoux fléchis — sit-ups, russian twist, V. */
const ASSIS_AU_SOL: Pose = {
  tete: [30, 44],
  cou: [36, 52],
  bassin: [58, 80],
  coude: [40, 60],
  poignet: [48, 64],
  genou: [74, 62],
  cheville: [86, 82],
};

/** À quatre pattes — bird dog, et tout ce qui part du sol sans être à plat. */
const QUADRUPEDIE: Pose = {
  tete: [22, 44],
  cou: [32, 48],
  bassin: [64, 50],
  coude: [32, 64],
  poignet: [30, 82],
  genou: [66, 66],
  cheville: [78, 82],
};

/**
 * Gainage latéral, sur un avant-bras.
 *
 * Le corps est en diagonale et non à l'horizontale : de profil, un corps couché
 * sur le côté se confondrait avec une planche classique.
 */
const COTE_AU_SOL: Pose = {
  tete: [22, 40],
  cou: [32, 46],
  bassin: [58, 64],
  coude: [26, 60],
  poignet: [18, 76],
  genou: [74, 74],
  cheville: [88, 86],
};

/**
 * Suspendu bras tendus, corps relâché — départ des relevés de jambes.
 *
 * `SUSPENDU` sert aux tractions, où les jambes comptent peu ; ici c'est
 * l'inverse, et le bassin est placé plus haut pour laisser de la place au
 * mouvement des jambes.
 */
const SUSPENDU_JAMBES: Pose = {
  tete: [48, 28],
  cou: [50, 38],
  bassin: [50, 62],
  coude: [58, 22],
  poignet: [62, 8],
  genou: [50, 80],
  cheville: [52, 95],
};

// ---------------------------------------------------------------------------
// Les gestes
// ---------------------------------------------------------------------------

export const MOTIFS: Record<string, Motif> = {
  pompe: {
    nom: "Pompes",
    decor: "sol",
    poses: [
      derive(APPUI_FACIAL, {
        coudeFond: [26, 64],
        poignetFond: [24, 84],
        genouFond: [78, 76],
        chevilleFond: [92, 88],
      }),
      // Descente : les coudes fléchissent, le corps reste aligné.
      derive(APPUI_FACIAL, {
        tete: [22, 62],
        cou: [32, 66],
        bassin: [62, 74],
        coude: [22, 72],
        genou: [80, 82],
        cheville: [94, 90],
        coudeFond: [16, 70],
        poignetFond: [24, 84],
        genouFond: [78, 86],
        chevilleFond: [92, 92],
      }),
    ],
  },

  squat: {
    nom: "Squat",
    decor: "sol",
    poses: [
      DEBOUT,
      // Assis en arrière : le bassin recule et descend, le buste s'incline.
      derive(DEBOUT, {
        tete: [40, 32],
        cou: [44, 44],
        bassin: [38, 70],
        coude: [56, 48],
        poignet: [66, 44],
        genou: [60, 76],
        cheville: [50, 93],
      }),
    ],
  },

  curl: {
    nom: "Curl biceps",
    decor: "sol",
    charge: "haltere",
    poses: [
      derive(DEBOUT, {
        coude: [55, 40],
        poignet: [58, 55],
        coudeFond: [46, 40],
        poignetFond: [50, 28],
        genouFond: [52, 72],
        chevilleFond: [48, 93],
      }),
      // Le coude reste au corps, l'avant-bras monte seul. L'autre redescend :
      // c'est ainsi qu'on curle en alterné, et le geste se lit mieux.
      derive(DEBOUT, {
        coude: [55, 40],
        poignet: [64, 26],
        coudeFond: [46, 40],
        poignetFond: [44, 54],
        genouFond: [52, 72],
        chevilleFond: [48, 93],
      }),
    ],
  },

  crunch: {
    nom: "Crunchs",
    decor: "sol",
    poses: [
      DOS_AU_SOL,
      // Les épaules décollent, le bassin ne bouge pas.
      derive(DOS_AU_SOL, {
        tete: [30, 58],
        cou: [36, 68],
        coude: [34, 56],
        poignet: [28, 62],
      }),
    ],
  },

  planche: {
    nom: "Gainage planche",
    decor: "sol",
    duree: 2200,
    poses: [
      // Sur les avant-bras, et l'on tient. Le léger va-et-vient dit que le
      // corps travaille sans laisser croire à une répétition.
      derive(APPUI_FACIAL, { coude: [30, 84], poignet: [16, 88] }),
      derive(APPUI_FACIAL, {
        coude: [30, 84],
        poignet: [16, 88],
        bassin: [62, 66],
        genou: [80, 76],
      }),
    ],
  },

  traction: {
    nom: "Tractions",
    decor: "barre",
    poses: [
      derive(SUSPENDU, {
        coudeFond: [42, 26],
        poignetFond: [38, 10],
        genouFond: [54, 82],
        chevilleFond: [50, 95],
      }),
      // Le corps monte, les coudes passent sous les mains restées à la barre.
      derive(SUSPENDU, {
        tete: [48, 20],
        cou: [50, 30],
        bassin: [50, 56],
        coude: [64, 22],
        genou: [46, 70],
        cheville: [50, 84],
        coudeFond: [36, 22],
        poignetFond: [38, 10],
        genouFond: [56, 70],
        chevilleFond: [52, 84],
      }),
    ],
  },

  "developpe-militaire": {
    nom: "Développé militaire",
    decor: "sol",
    charge: "haltere",
    poses: [
      derive(DEBOUT, { coude: [62, 33], poignet: [60, 20] }),
      // Bras tendu au-dessus de la tête.
      derive(DEBOUT, { coude: [58, 20], poignet: [56, 5] }),
    ],
  },

  "jumping-jack": {
    nom: "Jumping jacks",
    decor: "sol",
    duree: 500,
    poses: [
      // De face : jambes serrées, bras le long du corps.
      {
        tete: [50, 14],
        cou: [50, 26],
        bassin: [50, 55],
        coude: [58, 40],
        poignet: [60, 53],
        genou: [55, 74],
        cheville: [56, 93],
      },
      // Jambes écartées, bras au-dessus de la tête.
      {
        tete: [50, 14],
        cou: [50, 26],
        bassin: [50, 55],
        coude: [66, 24],
        poignet: [74, 10],
        genou: [64, 74],
        cheville: [74, 93],
      },
    ],
  },

  // =========================================================================
  // Pectoraux
  // =========================================================================

  dips: {
    nom: "Dips",
    decor: "chaise",
    poses: [
      // Bras tendus, corps suspendu entre deux appuis derrière soi.
      {
        tete: [46, 20],
        cou: [48, 32],
        bassin: [48, 60],
        coude: [38, 44],
        poignet: [36, 58],
        genou: [66, 66],
        cheville: [80, 74],
      },
      // Descente : le coude passe derrière, le corps descend le long des appuis.
      {
        tete: [44, 34],
        cou: [46, 46],
        bassin: [46, 72],
        coude: [32, 46],
        poignet: [36, 58],
        genou: [66, 76],
        cheville: [80, 82],
      },
    ],
  },

  "developpe-couche": {
    nom: "Développé couché",
    decor: "banc",
    charge: "barre",
    poses: [
      // Charge en bas, coudes ouverts près de la poitrine.
      derive(DOS_AU_SOL, { coude: [18, 68], poignet: [32, 68] }),
      // Bras tendus vers le plafond.
      derive(DOS_AU_SOL, { coude: [29, 64], poignet: [31, 48] }),
    ],
  },

  "developpe-incline": {
    nom: "Développé incliné",
    decor: "banc",
    charge: "haltere",
    poses: [
      // Buste incliné : le tronc monte vers la tête, pas à plat.
      {
        tete: [22, 56],
        cou: [30, 62],
        bassin: [58, 82],
        coude: [22, 58],
        poignet: [34, 58],
        genou: [76, 66],
        cheville: [88, 86],
      },
      {
        tete: [22, 56],
        cou: [30, 62],
        bassin: [58, 82],
        coude: [31, 52],
        poignet: [34, 36],
        genou: [76, 66],
        cheville: [88, 86],
      },
    ],
  },

  "ecarte-couche": {
    nom: "Écartés couché",
    decor: "banc",
    charge: "haltere",
    poses: [
      // Bras ouverts en croix, coudes à peine fléchis.
      derive(DOS_AU_SOL, { coude: [16, 62], poignet: [10, 50] }),
      // Les mains se rejoignent au-dessus de la poitrine.
      derive(DOS_AU_SOL, { coude: [28, 60], poignet: [32, 46] }),
    ],
  },

  "ecarte-debout": {
    nom: "Écartés debout",
    decor: "sol",
    poses: [
      // De face : bras ouverts.
      {
        tete: [50, 14],
        cou: [50, 26],
        bassin: [50, 55],
        coude: [72, 34],
        poignet: [86, 36],
        genou: [55, 74],
        cheville: [56, 93],
        coudeFond: [28, 34],
        poignetFond: [14, 36],
      },
      // Les mains se rejoignent devant la poitrine.
      {
        tete: [50, 14],
        cou: [50, 26],
        bassin: [50, 55],
        coude: [62, 36],
        poignet: [54, 34],
        genou: [55, 74],
        cheville: [56, 93],
        coudeFond: [38, 36],
        poignetFond: [46, 34],
      },
    ],
  },

  "pull-over": {
    nom: "Pull-over",
    decor: "banc",
    charge: "haltere",
    poses: [
      // Bras tendus au-dessus de la poitrine.
      derive(DOS_AU_SOL, { coude: [28, 62], poignet: [30, 46] }),
      // Ils partent en arrière, au-delà de la tête, sans plier le coude.
      derive(DOS_AU_SOL, { coude: [18, 60], poignet: [8, 56] }),
    ],
  },

  "serrage-paumes": {
    nom: "Serrage de paumes",
    decor: "sol",
    poses: [
      // Paumes l'une contre l'autre devant la poitrine ; rien ne se déplace,
      // seule la pression change. Le va-et-vient minime dit l'effort tenu.
      derive(DEBOUT, { coude: [60, 36], poignet: [54, 34] }),
      derive(DEBOUT, { coude: [62, 36], poignet: [55, 33] }),
    ],
  },

  // =========================================================================
  // Dos
  // =========================================================================

  "pompe-scapulaire": {
    nom: "Pompes scapulaires",
    decor: "sol",
    poses: [
      // Bras **tendus** du début à la fin : seules les omoplates bougent, et
      // c'est tout l'exercice. Un coude qui plie en ferait une pompe.
      derive(APPUI_FACIAL, { cou: [34, 46], tete: [24, 42] }),
      derive(APPUI_FACIAL, { cou: [34, 54], tete: [24, 50] }),
    ],
  },

  superman: {
    nom: "Superman",
    decor: "sol",
    poses: [
      // À plat ventre, membres au sol.
      {
        tete: [20, 66],
        cou: [30, 70],
        bassin: [62, 76],
        coude: [20, 74],
        poignet: [8, 76],
        genou: [78, 80],
        cheville: [92, 82],
      },
      // Bras et jambes se décollent ensemble, le ventre reste au sol.
      {
        tete: [20, 58],
        cou: [30, 66],
        bassin: [62, 76],
        coude: [18, 62],
        poignet: [6, 58],
        genou: [80, 74],
        cheville: [94, 66],
      },
    ],
  },

  "rowing-inverse": {
    nom: "Rowing inversé",
    decor: "barre",
    poses: [
      // Suspendu sous une barre, corps gainé en diagonale, bras tendus.
      {
        tete: [26, 46],
        cou: [36, 50],
        bassin: [64, 66],
        coude: [40, 34],
        poignet: [44, 18],
        genou: [80, 76],
        cheville: [94, 84],
      },
      // Le corps monte vers la barre, les coudes filent en arrière.
      {
        tete: [26, 34],
        cou: [36, 38],
        bassin: [64, 58],
        coude: [30, 30],
        poignet: [44, 18],
        genou: [80, 70],
        cheville: [94, 82],
      },
    ],
  },

  suspension: {
    nom: "Suspension à la barre",
    decor: "barre",
    duree: 2400,
    poses: [
      // On tient, simplement. Le léger balancement dit que le corps pend.
      SUSPENDU_JAMBES,
      derive(SUSPENDU_JAMBES, {
        bassin: [52, 63],
        genou: [52, 81],
        cheville: [54, 96],
      }),
    ],
  },

  "souleve-de-terre": {
    nom: "Soulevé de terre",
    decor: "sol",
    charge: "barre",
    poses: [
      // Charnière de hanche : le bassin recule, le dos reste plat, les bras
      // pendent. C'est le dos plat qui compte — un dos rond ici blesse.
      derive(DEBOUT, {
        tete: [34, 34],
        cou: [42, 42],
        bassin: [56, 60],
        coude: [56, 58],
        poignet: [56, 74],
        genou: [52, 74],
      }),
      DEBOUT,
    ],
  },

  "tirage-horizontal": {
    nom: "Tirage horizontal",
    decor: "sol",
    poses: [
      // Debout, bras tendus devant soi.
      derive(DEBOUT, { coude: [64, 36], poignet: [78, 36] }),
      // Les coudes reviennent le long du corps, les omoplates se serrent.
      derive(DEBOUT, { coude: [44, 36], poignet: [58, 36] }),
    ],
  },

  "tirage-vertical": {
    nom: "Tirage vertical",
    decor: "sol",
    poses: [
      // Bras tendus vers le haut.
      derive(DEBOUT, { coude: [58, 20], poignet: [58, 5] }),
      // Les coudes descendent le long du corps.
      derive(DEBOUT, { coude: [64, 36], poignet: [60, 22] }),
    ],
  },

  shrugs: {
    nom: "Haussements d'épaules",
    decor: "sol",
    charge: "haltere",
    poses: [
      // Bras pendants, épaules basses.
      derive(DEBOUT, { cou: [50, 27], coude: [58, 41], poignet: [60, 54] }),
      // Les épaules montent vers les oreilles, les bras ne plient pas.
      derive(DEBOUT, {
        cou: [50, 21],
        tete: [48, 12],
        coude: [58, 35],
        poignet: [60, 48],
      }),
    ],
  },

  "bird-dog": {
    nom: "Bird dog",
    decor: "sol",
    poses: [
      QUADRUPEDIE,
      // Bras avant et jambe arrière opposés se tendent à l'horizontale.
      derive(QUADRUPEDIE, {
        coude: [22, 54],
        poignet: [10, 48],
        genou: [78, 56],
        cheville: [92, 48],
      }),
    ],
  },

  // =========================================================================
  // Épaules
  // =========================================================================

  "cercles-bras": {
    nom: "Cercles de bras",
    decor: "sol",
    duree: 600,
    poses: [
      // De face, le bras décrit un tour : trois poses au lieu de deux, sinon
      // l'aller-retour ferait un balancement et non un cercle.
      {
        tete: [50, 14],
        cou: [50, 26],
        bassin: [50, 55],
        coude: [70, 26],
        poignet: [84, 20],
        genou: [55, 74],
        cheville: [56, 93],
      },
      {
        tete: [50, 14],
        cou: [50, 26],
        bassin: [50, 55],
        coude: [70, 40],
        poignet: [82, 50],
        genou: [55, 74],
        cheville: [56, 93],
      },
      {
        tete: [50, 14],
        cou: [50, 26],
        bassin: [50, 55],
        coude: [64, 30],
        poignet: [62, 12],
        genou: [55, 74],
        cheville: [56, 93],
      },
    ],
  },

  "pompe-piquee": {
    nom: "Pompes piquées",
    decor: "sol",
    poses: [
      // Bassin haut, corps en V renversé : on pousse vers le haut, pas devant.
      {
        tete: [26, 52],
        cou: [34, 56],
        bassin: [62, 30],
        coude: [30, 68],
        poignet: [26, 84],
        genou: [72, 56],
        cheville: [80, 84],
      },
      // La tête descend vers les mains, les coudes s'ouvrent.
      {
        tete: [22, 70],
        cou: [32, 70],
        bassin: [62, 34],
        coude: [22, 76],
        poignet: [26, 84],
        genou: [72, 58],
        cheville: [80, 84],
      },
    ],
  },

  "equilibre-mur": {
    nom: "Équilibre contre un mur",
    decor: "mur",
    duree: 2400,
    poses: [
      // Tête en bas, mains au sol, pieds appuyés au mur.
      {
        tete: [42, 86],
        cou: [44, 74],
        bassin: [48, 44],
        coude: [36, 74],
        poignet: [32, 90],
        genou: [50, 26],
        cheville: [52, 8],
      },
      derive(
        {
          tete: [42, 86],
          cou: [44, 74],
          bassin: [48, 44],
          coude: [36, 74],
          poignet: [32, 90],
          genou: [50, 26],
          cheville: [52, 8],
        },
        { tete: [42, 90], cou: [44, 78], coude: [32, 78] },
      ),
    ],
  },

  "gainage-elevation": {
    nom: "Élévation en gainage",
    decor: "sol",
    poses: [
      // En planche, un bras se lève devant soi ; le bassin ne doit pas tourner.
      derive(APPUI_FACIAL, { coude: [30, 84], poignet: [16, 88] }),
      derive(APPUI_FACIAL, {
        coude: [18, 62],
        poignet: [6, 54],
        coudeFond: [30, 84],
        poignetFond: [16, 88],
      }),
    ],
  },

  "rotation-externe": {
    nom: "Rotations externes",
    decor: "sol",
    poses: [
      // Coude collé au corps, avant-bras qui pivote vers l'extérieur. C'est le
      // coude immobile qui fait l'exercice.
      derive(DEBOUT, { coude: [56, 40], poignet: [48, 34] }),
      derive(DEBOUT, { coude: [56, 40], poignet: [72, 36] }),
    ],
  },

  // =========================================================================
  // Bras
  // =========================================================================

  "extension-triceps-sol": {
    nom: "Extensions triceps au sol",
    decor: "sol",
    poses: [
      // En appui, mains sous les épaules, les coudes filent vers l'arrière et
      // restent au corps — c'est ce qui distingue le geste d'une pompe.
      derive(APPUI_FACIAL, { coude: [40, 66], poignet: [30, 84] }),
      derive(APPUI_FACIAL, {
        tete: [22, 60],
        cou: [32, 64],
        bassin: [62, 72],
        coude: [42, 76],
        poignet: [30, 84],
        genou: [80, 80],
        cheville: [94, 88],
      }),
    ],
  },

  "curl-incline": {
    nom: "Curl incliné",
    decor: "banc",
    charge: "haltere",
    poses: [
      // Buste incliné en arrière : le bras part derrière la ligne du corps,
      // ce qui étire le biceps et fait tout l'intérêt de la variante.
      {
        tete: [30, 34],
        cou: [38, 42],
        bassin: [62, 70],
        coude: [40, 60],
        poignet: [38, 78],
        genou: [80, 74],
        cheville: [92, 90],
      },
      {
        tete: [30, 34],
        cou: [38, 42],
        bassin: [62, 70],
        coude: [40, 60],
        poignet: [52, 46],
        genou: [80, 74],
        cheville: [92, 90],
      },
    ],
  },

  "barre-au-front": {
    nom: "Barre au front",
    decor: "banc",
    charge: "barre",
    poses: [
      // Couché, bras tendus au-dessus des épaules.
      derive(DOS_AU_SOL, { coude: [28, 62], poignet: [30, 46] }),
      // Seul l'avant-bras descend, vers le front ; le coude ne bouge pas.
      derive(DOS_AU_SOL, { coude: [28, 62], poignet: [16, 56] }),
    ],
  },

  // =========================================================================
  // Jambes
  // =========================================================================

  fente: {
    nom: "Fentes",
    decor: "sol",
    poses: [
      DEBOUT,
      // Un pied part devant, les deux genoux plient, le buste reste droit.
      derive(DEBOUT, {
        tete: [48, 22],
        cou: [50, 34],
        bassin: [50, 62],
        coude: [58, 48],
        poignet: [60, 61],
        genou: [70, 76],
        cheville: [70, 94],
        genouFond: [32, 82],
        chevilleFond: [28, 94],
      }),
    ],
  },

  "fente-bulgare": {
    nom: "Fentes bulgares",
    decor: "chaise",
    poses: [
      // Pied arrière posé en hauteur : tout le poids est sur la jambe avant.
      {
        tete: [46, 16],
        cou: [48, 28],
        bassin: [48, 56],
        coude: [56, 42],
        poignet: [58, 55],
        genou: [56, 74],
        cheville: [56, 94],
        genouFond: [30, 70],
        chevilleFond: [20, 62],
      },
      {
        tete: [46, 28],
        cou: [48, 40],
        bassin: [48, 68],
        coude: [56, 54],
        poignet: [58, 67],
        genou: [62, 80],
        cheville: [56, 94],
        genouFond: [26, 82],
        chevilleFond: [20, 62],
      },
    ],
  },

  "fente-sautee": {
    nom: "Fentes sautées",
    decor: "sol",
    duree: 500,
    poses: [
      // Fente d'un côté, saut, fente de l'autre : les jambes s'échangent.
      derive(DEBOUT, {
        bassin: [50, 62],
        genou: [70, 76],
        cheville: [70, 94],
        genouFond: [32, 82],
        chevilleFond: [28, 94],
      }),
      derive(DEBOUT, {
        bassin: [50, 62],
        genou: [32, 82],
        cheville: [28, 94],
        genouFond: [70, 76],
        chevilleFond: [70, 94],
      }),
    ],
  },

  pistol: {
    nom: "Squat pistol",
    decor: "sol",
    poses: [
      // Une jambe tendue devant, l'autre porte tout.
      derive(DEBOUT, {
        coude: [62, 36],
        poignet: [76, 34],
        genouFond: [66, 62],
        chevilleFond: [82, 58],
      }),
      derive(DEBOUT, {
        tete: [40, 40],
        cou: [44, 52],
        bassin: [40, 76],
        coude: [58, 52],
        poignet: [72, 50],
        genou: [58, 82],
        cheville: [48, 94],
        genouFond: [70, 74],
        chevilleFond: [88, 72],
      }),
    ],
  },

  "pont-fessier": {
    nom: "Pont fessier",
    decor: "sol",
    poses: [
      // Dos au sol, genoux pliés, bassin posé.
      derive(DOS_AU_SOL, { bassin: [56, 86], genou: [76, 66], cheville: [78, 88] }),
      // Le bassin monte jusqu'à aligner épaules, hanches et genoux.
      derive(DOS_AU_SOL, { bassin: [58, 68], genou: [76, 62], cheville: [78, 88] }),
    ],
  },

  mollets: {
    nom: "Mollets debout",
    decor: "sol",
    duree: 700,
    poses: [
      DEBOUT,
      // Le corps entier monte sur la pointe des pieds. Le talon quitte le sol,
      // le reste ne change pas — l'amplitude est courte, c'est normal.
      derive(DEBOUT, {
        tete: [48, 7],
        cou: [50, 19],
        bassin: [50, 47],
        coude: [58, 33],
        poignet: [60, 46],
        genou: [46, 66],
        cheville: [50, 87],
      }),
    ],
  },

  "chaise-mur": {
    nom: "Chaise contre le mur",
    decor: "mur",
    duree: 2400,
    poses: [
      // Dos au mur, cuisses à l'horizontale. On tient.
      {
        tete: [30, 22],
        cou: [32, 34],
        bassin: [34, 62],
        coude: [44, 46],
        poignet: [56, 50],
        genou: [64, 62],
        cheville: [64, 92],
      },
      {
        tete: [30, 24],
        cou: [32, 36],
        bassin: [34, 64],
        coude: [44, 48],
        poignet: [56, 52],
        genou: [64, 64],
        cheville: [64, 92],
      },
    ],
  },

  swing: {
    nom: "Swing kettlebell",
    decor: "sol",
    charge: "kettlebell",
    duree: 600,
    poses: [
      // Charge entre les jambes, bassin en arrière.
      derive(DEBOUT, {
        tete: [34, 34],
        cou: [42, 42],
        bassin: [56, 60],
        coude: [50, 58],
        poignet: [42, 70],
        genou: [52, 74],
      }),
      // La hanche se déverrouille et projette la charge à l'horizontale.
      derive(DEBOUT, { coude: [62, 34], poignet: [78, 32] }),
    ],
  },

  "abduction-hanche": {
    nom: "Abduction de hanche",
    decor: "sol",
    poses: [
      // De face : la jambe part sur le côté, le buste ne s'incline pas.
      {
        tete: [50, 14],
        cou: [50, 26],
        bassin: [50, 55],
        coude: [58, 40],
        poignet: [60, 53],
        genou: [54, 74],
        cheville: [55, 93],
        genouFond: [46, 74],
        chevilleFond: [45, 93],
      },
      {
        tete: [50, 14],
        cou: [50, 26],
        bassin: [50, 55],
        coude: [58, 40],
        poignet: [60, 53],
        genou: [66, 72],
        cheville: [78, 88],
        genouFond: [46, 74],
        chevilleFond: [45, 93],
      },
    ],
  },

  // =========================================================================
  // Abdos
  // =========================================================================

  "releve-jambes": {
    nom: "Relevés de jambes",
    decor: "sol",
    poses: [
      // Dos au sol, jambes tendues posées.
      derive(DOS_AU_SOL, {
        coude: [24, 78],
        poignet: [14, 82],
        genou: [76, 86],
        cheville: [92, 88],
      }),
      // Les jambes montent à la verticale, le bas du dos reste plaqué.
      derive(DOS_AU_SOL, {
        coude: [24, 78],
        poignet: [14, 82],
        genou: [64, 62],
        cheville: [68, 40],
      }),
    ],
  },

  "releve-jambes-suspendu": {
    nom: "Relevés de jambes suspendu",
    decor: "barre",
    poses: [
      SUSPENDU_JAMBES,
      // Les jambes montent devant, le buste reste immobile.
      derive(SUSPENDU_JAMBES, { genou: [64, 62], cheville: [78, 56] }),
    ],
  },

  "gainage-lateral": {
    nom: "Gainage latéral",
    decor: "sol",
    duree: 2200,
    poses: [
      COTE_AU_SOL,
      // La hanche monte : le corps redevient une ligne.
      derive(COTE_AU_SOL, { bassin: [58, 60], genou: [74, 70] }),
    ],
  },

  "mountain-climber": {
    nom: "Mountain climbers",
    decor: "sol",
    duree: 400,
    poses: [
      // En appui facial, un genou vient sous la poitrine…
      derive(APPUI_FACIAL, {
        genou: [58, 76],
        cheville: [66, 84],
        genouFond: [80, 74],
        chevilleFond: [94, 84],
      }),
      // … puis l'autre. Les mains ne bougent pas.
      derive(APPUI_FACIAL, {
        genou: [80, 74],
        cheville: [94, 84],
        genouFond: [58, 78],
        chevilleFond: [66, 86],
      }),
    ],
  },

  "dead-bug": {
    nom: "Dead bug",
    decor: "sol",
    poses: [
      // Dos au sol, bras et genoux levés — la position de départ, déjà active.
      derive(DOS_AU_SOL, {
        coude: [28, 60],
        poignet: [30, 46],
        genou: [70, 60],
        cheville: [72, 44],
      }),
      // Bras et jambe opposés se tendent vers le sol, le dos reste plaqué.
      derive(DOS_AU_SOL, {
        coude: [18, 62],
        poignet: [6, 58],
        genou: [76, 74],
        cheville: [92, 80],
      }),
    ],
  },

  "tenue-creux": {
    nom: "Tenue en creux",
    decor: "sol",
    duree: 2200,
    poses: [
      // Dos au sol, seuls les reins touchent : bras et jambes tendus décollés.
      {
        tete: [24, 66],
        cou: [32, 72],
        bassin: [58, 84],
        coude: [20, 62],
        poignet: [8, 58],
        genou: [76, 80],
        cheville: [92, 74],
      },
      {
        tete: [24, 68],
        cou: [32, 74],
        bassin: [58, 85],
        coude: [20, 64],
        poignet: [8, 61],
        genou: [76, 82],
        cheville: [92, 77],
      },
    ],
  },

  "releve-en-v": {
    nom: "Relevés en V",
    decor: "sol",
    poses: [
      // À plat, bras au-dessus de la tête.
      {
        tete: [24, 74],
        cou: [32, 78],
        bassin: [58, 86],
        coude: [18, 72],
        poignet: [6, 70],
        genou: [78, 86],
        cheville: [92, 88],
      },
      // Buste et jambes se rejoignent : le corps fait un V.
      {
        tete: [30, 44],
        cou: [38, 54],
        bassin: [58, 86],
        coude: [44, 46],
        poignet: [58, 42],
        genou: [74, 62],
        cheville: [86, 40],
      },
    ],
  },

  "russian-twist": {
    nom: "Russian twist",
    decor: "sol",
    duree: 600,
    poses: [
      // Assis en équilibre, les mains passent d'un côté à l'autre.
      derive(ASSIS_AU_SOL, { coude: [44, 62], poignet: [56, 68] }),
      derive(ASSIS_AU_SOL, { coude: [40, 58], poignet: [30, 62] }),
    ],
  },

  "crunch-genoux": {
    nom: "Crunchs à genoux",
    decor: "sol",
    poses: [
      // À genoux, mains près de la tête ; le buste s'enroule vers les cuisses.
      {
        tete: [40, 24],
        cou: [44, 34],
        bassin: [52, 58],
        coude: [50, 30],
        poignet: [44, 20],
        genou: [56, 82],
        cheville: [76, 88],
      },
      {
        tete: [40, 44],
        cou: [46, 48],
        bassin: [52, 58],
        coude: [52, 44],
        poignet: [46, 38],
        genou: [56, 82],
        cheville: [76, 88],
      },
    ],
  },

  // =========================================================================
  // Cardio
  // =========================================================================

  "montee-genoux": {
    nom: "Montées de genoux",
    decor: "sol",
    duree: 350,
    poses: [
      // Course sur place, genou haut, bras opposé devant.
      derive(DEBOUT, {
        coude: [58, 34],
        poignet: [62, 22],
        genou: [64, 54],
        cheville: [58, 70],
        genouFond: [44, 74],
        chevilleFond: [48, 93],
      }),
      derive(DEBOUT, {
        coude: [54, 42],
        poignet: [50, 56],
        genou: [46, 74],
        cheville: [50, 93],
        genouFond: [66, 54],
        chevilleFond: [60, 70],
      }),
    ],
  },

  "talons-fesses": {
    nom: "Talons-fesses",
    decor: "sol",
    duree: 350,
    poses: [
      // Le talon vient vers la fesse : c'est l'arrière de la jambe qui plie.
      derive(DEBOUT, {
        genou: [48, 72],
        cheville: [38, 58],
        genouFond: [52, 72],
        chevilleFond: [52, 93],
      }),
      derive(DEBOUT, {
        genou: [52, 72],
        cheville: [52, 93],
        genouFond: [48, 72],
        chevilleFond: [38, 58],
      }),
    ],
  },

  "pas-chasses": {
    nom: "Pas chassés",
    decor: "sol",
    duree: 400,
    poses: [
      // De face : les pieds se rapprochent puis s'écartent, genoux fléchis.
      {
        tete: [50, 16],
        cou: [50, 28],
        bassin: [50, 56],
        coude: [60, 40],
        poignet: [58, 52],
        genou: [58, 74],
        cheville: [64, 92],
        genouFond: [42, 74],
        chevilleFond: [36, 92],
      },
      {
        tete: [50, 16],
        cou: [50, 28],
        bassin: [50, 56],
        coude: [60, 40],
        poignet: [58, 52],
        genou: [54, 74],
        cheville: [54, 92],
        genouFond: [46, 74],
        chevilleFond: [46, 92],
      },
    ],
  },

  "corde-a-sauter": {
    nom: "Corde à sauter",
    decor: "sol",
    charge: "corde",
    duree: 400,
    poses: [
      // Appel : les pieds au sol, les poignets tournent près des hanches.
      derive(DEBOUT, {
        coude: [56, 42],
        poignet: [66, 46],
        genou: [46, 74],
        cheville: [50, 93],
      }),
      // Saut : tout le corps monte, les pieds quittent le sol.
      derive(DEBOUT, {
        tete: [48, 8],
        cou: [50, 20],
        bassin: [50, 48],
        coude: [56, 38],
        poignet: [66, 42],
        genou: [46, 66],
        cheville: [50, 84],
      }),
    ],
  },

  "marche-tapis": {
    nom: "Marche",
    decor: "sol",
    duree: 700,
    poses: [
      // Un pas : une jambe devant, le bras opposé avance.
      derive(DEBOUT, {
        coude: [58, 38],
        poignet: [64, 48],
        genou: [58, 72],
        cheville: [66, 92],
        genouFond: [42, 74],
        chevilleFond: [34, 92],
      }),
      derive(DEBOUT, {
        coude: [54, 40],
        poignet: [50, 52],
        genou: [42, 74],
        cheville: [34, 92],
        genouFond: [58, 72],
        chevilleFond: [66, 92],
      }),
    ],
  },

  "course-tapis": {
    nom: "Course",
    decor: "sol",
    duree: 380,
    poses: [
      // Course : le buste s'incline un peu, les genoux montent plus haut, et
      // les deux pieds quittent le sol à la suspension.
      derive(DEBOUT, {
        tete: [46, 12],
        cou: [49, 24],
        coude: [58, 34],
        poignet: [64, 24],
        genou: [64, 58],
        cheville: [58, 74],
        genouFond: [40, 74],
        chevilleFond: [30, 86],
      }),
      derive(DEBOUT, {
        tete: [46, 12],
        cou: [49, 24],
        coude: [52, 40],
        poignet: [46, 52],
        genou: [40, 72],
        cheville: [32, 88],
        genouFond: [64, 60],
        chevilleFond: [60, 76],
      }),
    ],
  },

  "shadow-boxing": {
    nom: "Shadow boxing",
    decor: "sol",
    duree: 400,
    poses: [
      // Garde haute, puis un direct : le bras se tend, l'autre protège.
      derive(DEBOUT, {
        coude: [54, 36],
        poignet: [50, 24],
        coudeFond: [46, 36],
        poignetFond: [44, 24],
      }),
      derive(DEBOUT, {
        coude: [64, 30],
        poignet: [78, 28],
        coudeFond: [46, 36],
        poignetFond: [44, 24],
      }),
    ],
  },

  "marche-ours": {
    nom: "Marche de l'ours",
    decor: "sol",
    duree: 600,
    poses: [
      // À quatre pattes, genoux décollés du sol, on avance en diagonale.
      derive(QUADRUPEDIE, {
        bassin: [64, 46],
        genou: [66, 62],
        cheville: [80, 78],
        coude: [32, 62],
        poignet: [28, 80],
      }),
      derive(QUADRUPEDIE, {
        bassin: [64, 46],
        genou: [58, 60],
        cheville: [70, 76],
        coude: [24, 60],
        poignet: [18, 78],
      }),
    ],
  },
};

/** Motif d'un exercice, ou `null` si le geste n'est pas encore dessiné. */
export const motifDe = (slug: string | null | undefined): Motif | null =>
  (slug ? MOTIFS[slug] : null) ?? null;
