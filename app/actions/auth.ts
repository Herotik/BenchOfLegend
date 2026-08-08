"use server";

import { signIn, signOut } from "@/auth";

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

export async function connexionGoogle(formData: FormData) {
  await signIn("google", { redirectTo: destinationSure(formData.get("suivant")) });
}

export async function deconnexion() {
  await signOut({ redirectTo: "/" });
}
