"use server";

import { signIn, signOut } from "@/auth";
import { fournisseursActifs } from "@/lib/fournisseurs";

/**
 * `suivant` vient de la query string, donc de l'extérieur : on n'accepte
 * qu'un chemin interne. Un `//evil.com` commence par "/" mais serait une URL
 * protocol-relative — c'est-à-dire une redirection ouverte.
 */
function destinationSure(valeur: FormDataEntryValue | null): string {
  if (typeof valeur !== "string") return "/dashboard";
  if (!valeur.startsWith("/") || valeur.startsWith("//")) return "/dashboard";
  return valeur;
}

/**
 * Le fournisseur vient d'un champ de formulaire, donc de l'extérieur lui aussi.
 * On ne retient que ceux réellement configurés : sans ce filtre, une valeur
 * fabriquée ferait remonter une erreur interne d'Auth.js au lieu d'un refus.
 */
function fournisseurSur(valeur: FormDataEntryValue | null): string | null {
  if (typeof valeur !== "string") return null;
  return fournisseursActifs().some((f) => f.id === valeur) ? valeur : null;
}

export async function connexion(formData: FormData) {
  const fournisseur = fournisseurSur(formData.get("fournisseur"));
  if (!fournisseur) return;

  await signIn(fournisseur, { redirectTo: destinationSure(formData.get("suivant")) });
}

export async function deconnexion() {
  await signOut({ redirectTo: "/" });
}
