"use client";

import { useState, useTransition } from "react";
import { supprimerCompte } from "@/app/actions/preferences";

/** Export JSON et suppression de compte (RGPD, spec §12). */
export function ZoneDanger() {
  const [ouvert, setOuvert] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  return (
    <section className="surface mt-6 border-manque/40 p-5">
      <h2 className="text-base font-semibold text-ivoire">Tes données</h2>

      <a
        href="/api/export"
        download
        className="mt-4 inline-block rounded-lg border border-nuit-600 px-4 py-2.5 text-sm text-brume transition hover:text-ivoire"
      >
        Exporter en JSON
      </a>
      <p className="mt-2 text-xs text-cendre">
        Profil, matériel, pesées, séances et plan — tout ce que l&apos;app conserve sur toi.
      </p>

      <hr className="my-5 border-nuit-700/60" />

      {!ouvert ? (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="text-sm text-manque transition hover:brightness-125"
        >
          Supprimer mon compte
        </button>
      ) : (
        <div>
          <p className="text-sm text-brume">
            Cette action efface définitivement ton compte, tes séances, tes pesées et ta
            progression. Elle est irréversible — pense à exporter tes données d&apos;abord.
          </p>

          <label className="mt-4 block">
            <span className="text-sm text-brume">
              Recopie <span className="text-ivoire">SUPPRIMER</span> pour confirmer
            </span>
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full max-w-56 rounded-lg border border-nuit-600 bg-nuit-900 px-3 py-2.5 text-ivoire"
            />
          </label>

          {erreur && (
            <p role="alert" className="mt-3 text-sm text-manque">
              {erreur}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={enCours || confirmation !== "SUPPRIMER"}
              onClick={() =>
                startTransition(async () => {
                  const r = await supprimerCompte(confirmation);
                  // En cas de succès l'action déconnecte et redirige : on
                  // n'arrive ici que si elle a refusé.
                  if (r?.erreur) setErreur(r.erreur);
                })
              }
              className="rounded-lg border border-manque px-4 py-2.5 text-sm text-manque transition hover:bg-manque/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {enCours ? "Suppression…" : "Supprimer définitivement"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOuvert(false);
                setConfirmation("");
                setErreur(null);
              }}
              className="rounded-lg px-4 py-2.5 text-sm text-brume transition hover:text-ivoire"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
