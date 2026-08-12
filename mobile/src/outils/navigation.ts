import { router, type Href } from "expo-router";

/**
 * Revient en arrière, ou rejoint un écran de repli.
 *
 * `router.back()` échoue quand il n'y a rien derrière — après un lien profond,
 * un rechargement du navigateur, ou une redirection qui a remplacé la pile. Le
 * bouton « Retour » restait alors sans effet, ce qui donne à croire que l'app
 * a planté. On désigne donc toujours où retomber.
 */
export function revenir(repli: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(repli);
}
