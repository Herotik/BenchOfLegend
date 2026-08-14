import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Export de toutes les données de l'utilisateur (RGPD, spec §12).
 *
 * Route handler et non Server Action : c'est un téléchargement de fichier, il
 * faut un `Content-Disposition`.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Authentification requise" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      equipments: true,
      muscleGroups: true,
      weighIns: { orderBy: { date: "asc" } },
      workouts: { orderBy: { date: "asc" } },
      planDays: { orderBy: { date: "asc" } },
      // Un lien est aussi une donnée du compte : savoir avec qui l'on s'est
      // comparé fait partie de ce qu'on est en droit de récupérer. On ne prend
      // du compagnon que son nom d'affichage — celui-là est déjà sous les yeux
      // de qui exporte, alors que son adresse, ses Δ ou son identifiant ne le
      // sont pas et n'ont rien à faire dans un fichier qui peut être déposé
      // n'importe où.
      amitiesDemandees: { select: { statut: true, createdAt: true, destinataire: { select: { name: true } } } },
      amitiesRecues: { select: { statut: true, createdAt: true, demandeur: { select: { name: true } } } },
    },
  });

  if (!user) return Response.json({ error: "Compte introuvable" }, { status: 404 });

  const donnees = {
    exporteLe: new Date().toISOString(),
    profil: {
      nom: user.name,
      email: user.email,
      inscritLe: user.createdAt,
      taille: user.heightCm,
      niveau: user.level,
      objectif: user.goal,
      seancesParSemaine: user.daysPerWeek,
      lp: user.lp,
    },
    materiel: user.equipments.map((e) => e.equipmentId),
    groupesMusculaires: user.muscleGroups.map((g) => ({
      groupe: g.groupId,
      priorite: g.priority,
    })),
    pesees: user.weighIns.map((p) => ({ date: p.date, kg: p.kg })),
    seances: user.workouts.map((s) => ({
      date: s.date,
      groupe: s.muscleGroup,
      bonus: s.isBonus,
      lpGagnes: s.lpEarned,
      dureeMin: s.durationMin,
      ressenti: s.feeling,
      exercices: s.exercises,
    })),
    plan: user.planDays.map((p) => ({
      date: p.date,
      groupe: p.muscleGroup,
      statut: p.status,
    })),
    phalange: [
      ...user.amitiesDemandees.map((a) => ({
        compagnon: a.destinataire.name,
        sens: "demandee" as const,
        statut: a.statut,
        depuis: a.createdAt,
      })),
      ...user.amitiesRecues.map((a) => ({
        compagnon: a.demandeur.name,
        sens: "recue" as const,
        statut: a.statut,
        depuis: a.createdAt,
      })),
    ],
  };

  const jour = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(donnees, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="la-faille-${jour}.json"`,
      // Données personnelles : ni cache navigateur, ni cache intermédiaire.
      "Cache-Control": "no-store",
    },
  });
}
