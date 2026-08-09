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
