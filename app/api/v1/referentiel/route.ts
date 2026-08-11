import {
  EQUIPMENTS,
  GOAL_LABELS,
  LEVEL_HINTS,
  LEVEL_LABELS,
  MUSCLE_GROUPS,
  type Goal,
  type Level,
} from "@/lib/referentiel";
import { LP_PER_DIVISION, RANKS } from "@/lib/ranks";
import { BAREME, SEANCES_AVANT_REGULARITE, SEUIL_COMPLET, SEUIL_PARTIEL } from "@/lib/lp";
import { RESSENTIS } from "@/lib/difficulte";

/**
 * Référentiels de l'app mobile.
 *
 * **Publique** : l'écran d'onboarding en a besoin avant qu'un compte existe,
 * et rien ici n'est personnel — ce sont les constantes de `lib/referentiel.ts`,
 * `lib/ranks.ts` et `lib/lp.ts`, servies telles quelles.
 *
 * Le barème en fait partie : sans lui, l'app afficherait « +20 Δ » en dur et
 * se désynchroniserait du serveur à la première retouche. C'est exactement le
 * bug qu'avait connu l'aperçu web, qui annonçait 20 Δ sur une séance bonus
 * qui en rapporte 8.
 */
export async function GET() {
  return Response.json(
    {
      materiel: EQUIPMENTS.map((e) => ({ id: e.id, label: e.label })),
      groupesMusculaires: MUSCLE_GROUPS.map((g) => ({ id: g.id, label: g.label })),

      rangs: RANKS.map((r) => ({
        slug: r.slug,
        nom: r.name,
        sousTitre: r.subtitle,
        description: r.description,
        lore: r.lore,
        metal: r.metal,
        couleur: r.color,
        logo: r.logo,
        minLp: r.minLp,
        divisions: r.divisions,
      })),
      lpParDivision: LP_PER_DIVISION,

      objectifs: (Object.keys(GOAL_LABELS) as Goal[]).map((id) => ({
        id,
        label: GOAL_LABELS[id],
      })),
      niveaux: (Object.keys(LEVEL_LABELS) as Level[]).map((id) => ({
        id,
        label: LEVEL_LABELS[id],
        aide: LEVEL_HINTS[id],
      })),
      ressentis: RESSENTIS.map((r) => ({ id: r.cle, label: r.label, aide: r.aide })),

      lp: {
        bareme: BAREME,
        seuilComplet: SEUIL_COMPLET,
        seuilPartiel: SEUIL_PARTIEL,
        seancesAvantRegularite: SEANCES_AVANT_REGULARITE,
      },
    },
    {
      // Rien de personnel et rien qui bouge sans un déploiement : c'est la
      // seule route de l'API qu'un cache a le droit de garder.
      headers: { "Cache-Control": "public, max-age=3600" },
    },
  );
}
