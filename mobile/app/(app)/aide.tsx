import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "../../src/auth/session";
import { useReferentiel } from "../../src/donnees/referentiel";
import { ecussonDuRang } from "../../src/donnees/ecussons";
import { Carte, Ornement, TitreSection } from "../../src/composants/Carte";
import { Logotype } from "../../src/composants/Logo";
import { Chargement } from "../../src/composants/Etats";
import {
  POLICE_TEXTE,
  POLICE_TEXTE_MOYEN,
  POLICE_TITRE,
  LETTRAGE_TITRE,
  type Couleurs,
} from "../../src/theme/couleurs";
import { useStyles } from "../../src/theme/theme";

/**
 * Comment l'application fonctionne.
 *
 * **Aucun chiffre n'est écrit en dur** : le barème, les seuils de rang et les
 * libellés viennent tous de `GET /referentiel`. Une page d'aide qui recopie
 * les règles finit toujours par mentir — c'est la première chose qu'on oublie
 * de mettre à jour quand une valeur bouge, et une aide fausse est pire que
 * pas d'aide.
 */
export default function Aide() {
  const styles = useStyles(creerStyles);
  const { referentiel } = useReferentiel();
  const { moi } = useSession();
  const marges = useSafeAreaInsets();

  if (!referentiel) return <Chargement message="Chargement de l'aide…" />;

  const { bareme } = referentiel.lp;
  const rangCourant = moi?.rang.slug;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.contenu, { paddingTop: marges.top + 16, paddingBottom: 40 }]}
    >
      <Logotype taille={96} style={styles.logotype} />
      <Text style={styles.titre}>Aide</Text>

      <TitreSection>Le principe</TitreSection>
      <Carte style={styles.carte}>
        <Text style={styles.texte}>
          Tu t&apos;entraînes, tu valides tes séances, tu gagnes des Δ. Les Δ te font monter les
          rangs, du simple fantassin jusqu&apos;à l&apos;Olympe.
        </Text>
        <Text style={styles.appui}>
          Règle unique et sans exception : <Text style={styles.fort}>aucune perte de Δ, jamais</Text>
          . Une semaine manquée ne retire rien — elle ne rapporte simplement pas. Le compteur ne
          redescend pas.
        </Text>
      </Carte>

      <TitreSection>Gagner des Δ</TitreSection>
      <Carte style={styles.carte}>
        <Bareme libelle="Séance du jour validée" valeur={bareme.seanceComplete} />
        <Bareme libelle="Séance seulement entamée" valeur={bareme.seancePartielle} />
        <Bareme libelle="Séance bonus" valeur={bareme.seanceBonus} />
        <Bareme libelle="Finisher complété" valeur={bareme.finisher} />
        <Bareme libelle="Régularité" valeur={bareme.regularite} />
        <Bareme libelle="Pesée du jour" valeur={bareme.pesee} />
        <Text style={styles.appui}>
          Une séance compte pleinement à partir de {Math.round(referentiel.lp.seuilComplet * 100)} %
          d&apos;exercices faits, et partiellement à partir de{" "}
          {Math.round(referentiel.lp.seuilPartiel * 100)} %. La régularité s&apos;ajoute dès la{" "}
          {referentiel.lp.seancesAvantRegularite + 1}
          <Text style={styles.exposant}>e</Text> séance sur sept jours glissants. Le bonus est
          plafonné à un par jour, pour ne pas récompenser le surentraînement.
        </Text>
      </Carte>

      <TitreSection>Les rangs</TitreSection>
      <Text style={styles.intro}>
        Huit paliers. Les six premiers comptent quatre divisions de{" "}
        {referentiel.lpParDivision} Δ ; les deux derniers n&apos;en ont pas.
      </Text>
      {referentiel.rangs.map((rang) => (
        <Palier key={rang.slug} rang={rang} courant={rang.slug === rangCourant} />
      ))}

      <Ornement style={styles.ornement} />

      <TitreSection>Ton plan</TitreSection>
      <Carte style={styles.carte}>
        <Text style={styles.texte}>
          Chaque groupe que tu as choisi est visé <Text style={styles.fort}>deux fois par
          semaine</Text> — la fréquence sur laquelle s&apos;accordent les salles comme les études.
        </Text>
        <Text style={styles.appui}>
          Quand tu choisis plus de groupes que tu n&apos;as de jours, les séances deviennent{" "}
          <Text style={styles.fort}>hybrides</Text> : deux groupes le même jour, appariés selon ce
          qui travaille ensemble. Pectoraux avec dos ou avec les bras, jambes avec les abdos. Jamais
          pectoraux et épaules ensemble — le deltoïde antérieur travaille déjà au développé et
          serait fatigué deux fois pour un seul gain. Jamais jambes et dos non plus : ce sont les
          deux séances les plus lourdes, réunies elles dépassent ce qu&apos;on tient en une fois.
        </Text>
        <Text style={styles.appui}>
          Un même groupe n&apos;est jamais programmé deux jours de suite : il lui faut 48 heures.
          Le cardio fait exception, il ne réclame pas la même récupération.
        </Text>
      </Carte>

      <TitreSection>Le ressenti</TitreSection>
      <Carte style={styles.carte}>
        <Text style={styles.texte}>
          À la fin de chaque séance, tu dis comment c&apos;était. C&apos;est ce qui calibre la
          suivante — l&apos;app n&apos;a aucun autre moyen de savoir si le niveau te va.
        </Text>
        {referentiel.ressentis.map((r) => (
          <View key={r.id} style={styles.ressenti}>
            <Text style={styles.ressentiNom}>{r.label}</Text>
            <Text style={styles.ressentiAide}>{r.aide}</Text>
          </View>
        ))}
        <Text style={styles.appui}>
          Le calibrage est propre à chaque groupe : tu peux être à l&apos;aise sur le haut du corps
          et en difficulté sur les jambes.
        </Text>
      </Carte>

      <TitreSection>Séries non terminées</TitreSection>
      <Carte style={styles.carte}>
        <Text style={styles.texte}>
          Si tu n&apos;arrives pas au bout d&apos;une série, dis-le. Elle comptera pour moitié
          plutôt que d&apos;être ignorée.
        </Text>
        <Text style={styles.appui}>
          C&apos;est délibéré : si signaler un échec revenait à se pénaliser, personne ne le
          signalerait, et le calibrage se ferait sur des chiffres faux.
        </Text>
      </Carte>

      <TitreSection>La pesée</TitreSection>
      <Carte style={styles.carte}>
        <Text style={styles.texte}>
          Une pesée par jour suffit, et seule la première du jour rapporte des Δ. La courbe des
          progrès affiche aussi une moyenne sur sept jours : le poids d&apos;un matin dépend de
          l&apos;hydratation et du dernier repas, la tendance est le seul chiffre qui veuille dire
          quelque chose.
        </Text>
      </Carte>
    </ScrollView>
  );
}

function Bareme({ libelle, valeur }: { libelle: string; valeur: number }) {
  const styles = useStyles(creerStyles);
  return (
    <View style={styles.ligneBareme}>
      <Text style={styles.baremeLibelle}>{libelle}</Text>
      <Text style={styles.baremeValeur}>+{valeur} Δ</Text>
    </View>
  );
}

/** Un palier de l'échelle, avec son écusson et son seuil. */
function Palier({
  rang,
  courant,
}: {
  rang: {
    slug: string;
    nom: string;
    sousTitre: string;
    lore: string;
    minLp: number;
    divisions: number;
  };
  courant: boolean;
}) {
  const styles = useStyles(creerStyles);
  const ecusson = ecussonDuRang(rang.slug);

  return (
    <Carte style={[styles.palier, courant && styles.palierCourant]}>
      {ecusson ? <Image source={ecusson} style={styles.ecusson} resizeMode="contain" /> : null}
      <View style={styles.palierTexte}>
        <View style={styles.palierEntete}>
          <Text style={styles.palierNom}>{rang.nom}</Text>
          {courant ? <Text style={styles.icibas}>tu es ici</Text> : null}
        </View>
        <Text style={styles.palierSous}>{rang.sousTitre}</Text>
        <Text style={styles.palierSeuil}>
          {rang.minLp === 0 ? "Point de départ" : `À partir de ${rang.minLp} Δ`}
          {rang.divisions > 1 ? ` · ${rang.divisions} divisions` : " · sans division"}
        </Text>
        <Text style={styles.palierLore}>{rang.lore}</Text>
      </View>
    </Carte>
  );
}

const creerStyles = (c: Couleurs) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: c.fond,
  },
  contenu: {
    paddingHorizontal: 18,
    gap: 8,
  },
  logotype: {
    alignSelf: "center",
    marginBottom: 22,
    marginTop: 8,
  },
  titre: {
    color: c.texte,
    fontFamily: POLICE_TITRE,
    fontSize: 30,
    marginBottom: 4,
  },
  carte: {
    gap: 10,
  },
  intro: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  texte: {
    fontFamily: POLICE_TEXTE,
    color: c.texte,
    fontSize: 14.5,
    lineHeight: 22,
  },
  appui: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13,
    lineHeight: 20,
  },
  fort: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte,
  },
  exposant: {
    fontSize: 9,
  },
  ligneBareme: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  },
  baremeLibelle: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 13.5,
    flexShrink: 1,
  },
  baremeValeur: {
    fontFamily: POLICE_TITRE,
    color: c.accent,
    fontSize: 14,
  },
  palier: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  palierCourant: {
    borderColor: c.accent,
  },
  ecusson: {
    width: 54,
    height: 54,
  },
  palierTexte: {
    flex: 1,
    gap: 2,
  },
  palierEntete: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  palierNom: {
    fontFamily: POLICE_TITRE,
    color: c.texte,
    fontSize: 17,
    flexShrink: 1,
  },
  icibas: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.accent,
    fontSize: 10,
    letterSpacing: LETTRAGE_TITRE,
    textTransform: "uppercase",
  },
  palierSous: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 12.5,
  },
  palierSeuil: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte3,
    fontSize: 11.5,
    marginTop: 1,
  },
  palierLore: {
    fontFamily: POLICE_TEXTE,
    color: c.texte3,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 3,
  },
  ressenti: {
    gap: 1,
  },
  ressentiNom: {
    fontFamily: POLICE_TEXTE_MOYEN,
    color: c.texte,
    fontSize: 14,
  },
  ressentiAide: {
    fontFamily: POLICE_TEXTE,
    color: c.texte2,
    fontSize: 12.5,
    lineHeight: 18,
  },
  ornement: {
    marginVertical: 12,
  },
});
