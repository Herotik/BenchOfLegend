import "server-only";
import { z } from "zod";
import {
  verifierIdentiteApple,
  verifierIdentiteDiscord,
  verifierIdentiteGoogle,
  audiencesApple,
} from "@/lib/api/jetons";
import type { IdentiteFournisseur } from "@/lib/api/comptes";
import { retourAutorise } from "@/lib/api/relais";
import { echec, estEchec, type EchecMetier } from "@/lib/erreurs";

/**
 * Preuves d'identité rapportées par l'app, et leur vérification.
 *
 * Les mêmes preuves servent à deux choses : **se connecter** (`/auth/*`) et
 * **rattacher une connexion de plus** à un compte déjà identifié
 * (`/me/connexions`). La vérification, elle, ne change pas d'un cas à
 * l'autre — et c'est heureux : c'est le seul endroit où l'on décide qu'une
 * identité est authentique.
 */

export const schemaPreuve = z.discriminatedUnion("fournisseur", [
  z.object({
    fournisseur: z.literal("google"),
    /** `id_token` rendu par la feuille de comptes du système. */
    idToken: z.string().min(20),
  }),
  z.object({
    fournisseur: z.literal("apple"),
    identityToken: z.string().min(20),
    /** Apple ne donne le nom qu'à la première autorisation. */
    nom: z.string().max(120).optional(),
  }),
  z.object({
    fournisseur: z.literal("discord"),
    /** Discord n'a pas de connexion native : l'app ne rapporte qu'un code. */
    code: z.string().min(10).max(512),
    verificateur: z.string().min(20).max(256),
    redirection: z.string().max(512),
  }),
]);

export type Preuve = z.infer<typeof schemaPreuve>;

/**
 * Vérifie la preuve et rend l'identité qu'elle porte.
 *
 * Rien de ce que l'app annonce n'est cru sur parole : les jetons sont
 * confrontés aux clés publiques de leur émetteur, et le code Discord est
 * échangé par le serveur lui-même.
 */
export async function identiteDepuisPreuve(
  preuve: Preuve,
): Promise<IdentiteFournisseur | EchecMetier> {
  switch (preuve.fournisseur) {
    case "google": {
      const identite = await verifierIdentiteGoogle(preuve.idToken);
      if (!identite) return echec("Identité Google non vérifiable", "google_invalide", 401);
      return { fournisseur: "google", ...identite };
    }

    case "apple": {
      // Distingué du refus : sans audience déclarée, aucun jeton ne peut être
      // accepté, et « non vérifiable » enverrait chercher chez Apple un
      // problème qui est entièrement de configuration.
      if (audiencesApple().length === 0) {
        return echec(
          "Connexion Apple non configurée sur le serveur : AUTH_APPLE_ID_IOS est absente ou vide.",
          "apple_non_configure",
          503,
        );
      }

      const identite = await verifierIdentiteApple(preuve.identityToken);
      if (!identite) {
        return echec(
          "Identité Apple non vérifiable : le jeton ne correspond pas à l'audience déclarée.",
          "apple_invalide",
          401,
        );
      }
      return {
        fournisseur: "apple",
        sub: identite.sub,
        email: identite.email,
        emailVerifie: identite.emailVerifie,
        nom: preuve.nom ?? null,
        image: null,
      };
    }

    case "discord": {
      // La redirection vient de la requête et repart chez Discord : on n'accepte
      // que les schémas de l'app, sans quoi cette route deviendrait un moyen
      // d'obtenir un code pour une application tierce.
      if (!retourAutorise(preuve.redirection)) {
        return echec("Adresse de retour non autorisée", "retour_invalide", 400);
      }

      const identite = await verifierIdentiteDiscord(
        preuve.code,
        preuve.verificateur,
        preuve.redirection,
      );
      if (!identite) return echec("Identité Discord non vérifiable", "discord_invalide", 401);
      return { fournisseur: "discord", ...identite };
    }
  }
}

export { estEchec };
