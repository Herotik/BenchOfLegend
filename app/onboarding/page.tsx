import { requireUser } from "@/lib/session";
import { deconnexion } from "@/app/actions/auth";

export default async function OnboardingPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
      <p className="font-display text-xs tracking-[0.3em] text-or-500 uppercase">Bienvenue</p>
      <h1 className="mt-4 text-3xl font-bold text-ivoire">Ton profil, en quatre étapes</h1>
      <p className="mt-4 leading-relaxed text-brume">
        Taille et poids, matériel disponible, groupes musculaires à travailler, puis nombre de
        séances par semaine. On génère ensuite ta première semaine d&apos;entraînement.
      </p>

      <div className="surface mt-8 p-5">
        <p className="text-sm text-brume">
          Le wizard est la prochaine étape de développement. La connexion, elle, fonctionne :
          tu es identifié comme{" "}
          <span className="text-ivoire">{user.email ?? user.name ?? user.id}</span>.
        </p>
      </div>

      <form action={deconnexion} className="mt-6">
        <button type="submit" className="text-sm text-cendre underline transition hover:text-brume">
          Se déconnecter
        </button>
      </form>
    </main>
  );
}
