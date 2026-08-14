import { reinitialiserCompteApi } from "../api/routes";
import { oublierSeances } from "./cache";
import { attendreEnvoi, viderFile } from "./file-attente";

/**
 * Remise à zéro du compte, serveur **et** appareil.
 *
 * L'appel serveur ne suffit pas : l'app garde deux choses qui survivraient à
 * l'effacement et le défairaient.
 *
 *  · La **file d'attente** des séances terminées hors ligne. Laissée en place,
 *    elle repart au prochain retour du réseau et recrée les séances qu'on vient
 *    d'effacer — la remise à zéro serait annulée toute seule, quelques secondes
 *    ou quelques heures plus tard, sans que personne ne comprenne pourquoi.
 *  · Les **séances en cache**, prescrites à partir d'ajustements de difficulté
 *    qui n'existent plus.
 *
 * L'ordre est ce qui rend l'opération sûre, et il ne se réarrange pas :
 *
 *  1. laisser un envoi déjà lancé se terminer — l'interrompre au milieu ferait
 *     réapparaître la file au moment où il conclut ;
 *  2. jeter la file, pour que plus rien de local ne parte ;
 *  3. effacer côté serveur, ce qui emporte au passage ce que l'envoi de
 *     l'étape 1 aurait réussi à faire enregistrer ;
 *  4. oublier les séances en cache.
 *
 * Rien n'est effacé localement avant l'étape 3 qui ne puisse être reperdu : si
 * le serveur refuse, la file est déjà vide. C'est assumé — ces séances-là
 * étaient sur le point d'être effacées de toute façon, et une file qu'on garde
 * « au cas où » finirait par ressusciter le passé au pire moment.
 */
export async function reinitialiser(): Promise<{
  seances: number;
  pesees: number;
  joursDePlan: number;
  charges: number;
}> {
  await attendreEnvoi();
  await viderFile();

  const { efface } = await reinitialiserCompteApi();

  await oublierSeances();

  return efface;
}
