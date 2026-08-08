import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { jourUTC } from "@/lib/dates";
import { Navigation } from "@/components/Navigation";
import { ModalePesee } from "@/components/ModalePesee";

/**
 * Coquille des pages connectées. Le groupe de routes `(app)` n'apparaît pas
 * dans l'URL : /dashboard reste /dashboard. L'onboarding et la landing en
 * sont volontairement exclus — on n'y navigue pas, on les traverse.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth();

  // Le check-in vit dans le layout et non dans le tableau de bord : la spec le
  // veut à chaque connexion, quelle que soit la page d'arrivée.
  let peseeDuJour: { manquante: boolean; dernierPoids: number | null } | null = null;

  if (session?.user?.onboarded) {
    const [aujourdhui, derniere] = await Promise.all([
      prisma.weighIn.findUnique({
        where: { userId_date: { userId: session.user.id, date: jourUTC() } },
      }),
      prisma.weighIn.findFirst({
        where: { userId: session.user.id },
        orderBy: { date: "desc" },
      }),
    ]);
    peseeDuJour = { manquante: !aujourdhui, dernierPoids: derniere?.kg ?? null };
  }

  return (
    <div className="flex min-h-full flex-col sm:pl-56">
      <Navigation />
      {/* pb-20 : la barre de navigation mobile est fixée en bas et
          masquerait le dernier élément de la page. */}
      <div className="flex flex-1 flex-col pb-20 sm:pb-0">{children}</div>
      {peseeDuJour?.manquante && <ModalePesee dernierPoids={peseeDuJour.dernierPoids} />}
    </div>
  );
}
