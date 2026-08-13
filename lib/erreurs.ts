/**
 * Échec d'une règle métier.
 *
 * Une même règle sert désormais deux transports : une Server Action, qui n'a
 * qu'un message à afficher, et une route HTTP, qui doit choisir un statut. Le
 * code et le statut voyagent donc avec le message depuis `lib/`, au lieu d'être
 * réinterprétés par chaque appelant — c'est ce qui garantit qu'un refus veut
 * dire la même chose sur le web et dans l'app.
 */

export interface EchecMetier {
  /** Message destiné à l'utilisateur, en français. */
  erreur: string;
  /** Identifiant stable : c'est là-dessus qu'un client branche son comportement. */
  code: string;
  /**
   * 400 requête malformée · 401 identité non prouvée · 404 ressource
   * inexistante ou appartenant à quelqu'un d'autre · 409 conflit d'état ·
   * 422 règle métier violée · 503 dépendance non configurée côté serveur.
   *
   * Les deux derniers venus — 401 et 503 — servent aux preuves d'identité des
   * connexions natives : un jeton qu'on ne peut pas vérifier n'est pas une
   * règle métier violée, et une variable d'environnement absente encore moins.
   */
  statut: 400 | 401 | 404 | 409 | 422 | 503;
}

export const echec = (
  erreur: string,
  code: string,
  statut: EchecMetier["statut"],
): EchecMetier => ({ erreur, code, statut });

export function estEchec<T extends object>(resultat: T | EchecMetier): resultat is EchecMetier {
  return "erreur" in resultat;
}
