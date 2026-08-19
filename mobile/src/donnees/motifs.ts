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

// ---------------------------------------------------------------------------
// Les gestes
// ---------------------------------------------------------------------------

export const MOTIFS: Record<string, Motif> = {
  pompe: {
    nom: "Pompes",
    decor: "sol",
    poses: [
      APPUI_FACIAL,
      // Descente : les coudes fléchissent, le corps reste aligné.
      derive(APPUI_FACIAL, {
        tete: [22, 62],
        cou: [32, 66],
        bassin: [62, 74],
        coude: [22, 72],
        genou: [80, 82],
        cheville: [94, 90],
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
      derive(DEBOUT, { coude: [55, 40], poignet: [58, 55] }),
      // Le coude reste au corps, l'avant-bras monte seul.
      derive(DEBOUT, { coude: [55, 40], poignet: [64, 26] }),
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
      SUSPENDU,
      // Le corps monte, les coudes passent sous les mains restées à la barre.
      derive(SUSPENDU, {
        tete: [48, 20],
        cou: [50, 30],
        bassin: [50, 56],
        coude: [64, 22],
        genou: [46, 70],
        cheville: [50, 84],
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
};

/** Motif d'un exercice, ou `null` si le geste n'est pas encore dessiné. */
export const motifDe = (slug: string | null | undefined): Motif | null =>
  (slug ? MOTIFS[slug] : null) ?? null;
