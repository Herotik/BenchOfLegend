import { requireOnboardedUser } from "@/lib/session";
import { EcussonRang } from "@/components/EcussonRang";
import { deconnexion } from "@/app/actions/auth";

export default async function DashboardPage() {
  const user = await requireOnboardedUser();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ivoire">Salut {user.name ?? "toi"}</h1>
          <p className="mt-1 text-sm text-brume">Ta séance du jour t&apos;attend.</p>
        </div>
        <form action={deconnexion}>
          <button
            type="submit"
            className="rounded-lg border border-nuit-600 px-3 py-1.5 text-sm text-brume transition hover:text-ivoire"
          >
            Se déconnecter
          </button>
        </form>
      </header>

      <section className="surface mt-8 flex justify-center p-8">
        <EcussonRang lp={user.lp} />
      </section>

      <p className="mt-8 text-center text-sm text-cendre">
        Séance du jour, checklist et chrono de repos arrivent à la phase suivante.
      </p>
    </main>
  );
}
