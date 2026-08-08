import { Navigation } from "@/components/Navigation";

/**
 * Coquille des pages connectées. Le groupe de routes `(app)` n'apparaît pas
 * dans l'URL : /dashboard reste /dashboard. L'onboarding et la landing en
 * sont volontairement exclus — on n'y navigue pas, on les traverse.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col sm:pl-56">
      <Navigation />
      {/* pb-20 : la barre de navigation mobile est fixée en bas et
          masquerait le dernier élément de la page. */}
      <div className="flex flex-1 flex-col pb-20 sm:pb-0">{children}</div>
    </div>
  );
}
