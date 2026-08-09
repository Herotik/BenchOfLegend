import { prisma } from "@/lib/prisma";
import type { Goal, Level } from "@prisma/client";
import { connecter } from "./session-courante";

/** Outils partagés par les tests d'intégration. */

let compteur = 0;

export interface GroupeVoulu {
  id: string;
  priority?: number;
  levelOffset?: number;
}

export interface OptionsUtilisateur {
  onboarded?: boolean;
  lp?: number;
  /** Date d'inscription. Explicite dans les tests qui jouent sur le calendrier. */
  createdAt?: Date;
  heightCm?: number | null;
  level?: Level;
  goal?: Goal;
  daysPerWeek?: number;
  equipments?: string[];
  muscleGroups?: GroupeVoulu[];
}

/**
 * Crée un utilisateur complet et le « connecte » pour les Server Actions.
 *
 * Par défaut : onboardé, sans matériel (poids de corps), trois groupes — le cas
 * le plus courant, et celui qui garantit un catalogue d'exercices non vide.
 */
export async function creerUtilisateur(options: OptionsUtilisateur = {}) {
  const n = ++compteur;

  const user = await prisma.user.create({
    data: {
      name: `Testeuse ${n}`,
      email: `testeuse-${n}@la-faille.test`,
      onboarded: options.onboarded ?? true,
      lp: options.lp ?? 0,
      heightCm: options.heightCm === undefined ? 172 : options.heightCm,
      level: options.level ?? "DEBUTANT",
      goal: options.goal ?? "HYPERTROPHIE",
      daysPerWeek: options.daysPerWeek ?? 4,
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    },
  });

  const equipments = options.equipments ?? [];
  if (equipments.length > 0) {
    await prisma.userEquipment.createMany({
      data: equipments.map((equipmentId) => ({ userId: user.id, equipmentId })),
    });
  }

  const groupes = options.muscleGroups ?? [{ id: "pectoraux" }, { id: "dos" }, { id: "jambes" }];
  if (groupes.length > 0) {
    await prisma.userMuscleGroup.createMany({
      data: groupes.map((g) => ({
        userId: user.id,
        groupId: g.id,
        priority: g.priority ?? 1,
        levelOffset: g.levelOffset ?? 0,
      })),
    });
  }

  connecter(user.id);
  return user;
}

/**
 * Vide les données utilisateur entre deux tests.
 *
 * Une seule suppression suffit : plan, séances, pesées, sessions et comptes
 * sont en `onDelete: Cascade`. Le référentiel (exercices, matériel, groupes)
 * survit — il vient du seed et ne change jamais.
 */
export async function nettoyerBase(): Promise<void> {
  await prisma.user.deleteMany();
  connecter(null);
}

/**
 * Exécute une action censée se terminer par `redirect()` et renvoie l'URL.
 *
 * `redirect()` lève une exception de contrôle que Next intercepte lui-même en
 * production ; ici c'est au test de la rattraper, sinon elle passe pour un
 * échec.
 */
export async function attraperRedirection(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
  } catch (erreur) {
    const digest = (erreur as { digest?: unknown }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT;")) {
      // Format : NEXT_REDIRECT;<type>;<url>;<code>;
      return digest.split(";").slice(2, -2).join(";");
    }
    throw erreur;
  }
  throw new Error("Aucune redirection : l'action s'est terminée normalement.");
}

export { prisma };
