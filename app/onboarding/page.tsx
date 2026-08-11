import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { WizardOnboarding } from "@/components/onboarding/WizardOnboarding";

export default async function OnboardingPage() {
  const user = await requireUser();
  // Repasser ici une fois le profil rempli n'aurait aucun sens : le wizard
  // écraserait les préférences. Les modifications passent par /parametres.
  if (user.onboarded) redirect("/dashboard");

  const prenom = user.name?.split(" ")[0] ?? "toi";

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <p className="font-display text-xs tracking-[0.3em] text-accent uppercase">Bienvenue</p>
      <h1 className="mt-3 text-3xl font-bold text-texte">Quatre étapes, {prenom}</h1>
      <p className="mt-3 text-sm leading-relaxed text-texte-2">
        On construit ton programme à partir de ce que tu as sous la main et de ce que tu veux
        travailler. Deux minutes, et ta première semaine est prête.
      </p>

      <div className="mt-10">
        <WizardOnboarding prenom={prenom} />
      </div>
    </main>
  );
}
