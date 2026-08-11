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
    <section className="surface mt-6 border-negatif/40 p-5">
      <h2 className="text-base font-semibold text-texte">Tes données</h2>

      <a
        href="/api/export"
        download
        className="mt-4 inline-block rounded-lg border border-filet px-4 py-2.5 text-sm text-texte-2 transition hover:text-texte"
      >
        Exporter en JSON
      </a>
      <p className="mt-2 text-xs text-texte-3">
        Profil, matériel, pesées, séances et plan — tout ce que l&apos;app conserve sur toi.
      </p>

      <hr className="my-5 border-filet/60" />

      {!ouvert ? (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="text-sm text-negatif transition hover:brightness-125"
        >
          Supprimer mon compte
        </button>
      ) : (
        <div>
          <p className="text-sm text-texte-2">
            Cette action efface définitivement ton compte, tes séances, tes pesées et ta
            progression. Elle est irréversible — pense à exporter tes données d&apos;abord.
          </p>

          <label className="mt-4 block">
            <span className="text-sm text-texte-2">
              Recopie <span className="text-texte">SUPPRIMER</span> pour confirmer
            </span>
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full max-w-56 rounded-lg border border-filet bg-fond px-3 py-2.5 text-texte"
            />
          </label>

          {erreur && (
            <p role="alert" className="mt-3 text-sm text-negatif">
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
              className="rounded-lg border border-negatif px-4 py-2.5 text-sm text-negatif transition hover:bg-negatif/10 disabled:cursor-not-allowed disabled:opacity-40"
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
              className="rounded-lg px-4 py-2.5 text-sm text-texte-2 transition hover:text-texte"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
