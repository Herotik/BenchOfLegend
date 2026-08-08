"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enregistrerPesee } from "@/app/actions/pesee";

/**
 * Check-in quotidien du poids (spec §4.3).
 *
 * Modale bloquante à la première connexion du jour. Le bouton « Passer »
 * n'apparaît qu'au bout de trois secondes : assez pour ne pas prendre en
 * otage quelqu'un qui n'a pas de balance sous la main, assez peu pour que le
 * geste par défaut reste la pesée. Seule la pesée validée rapporte 2 LP.
 */
export function ModalePesee({ dernierPoids }: { dernierPoids: number | null }) {
  const [valeur, setValeur] = useState(dernierPoids ? String(dernierPoids) : "");
  const [passable, setPassable] = useState(false);
  const [ferme, setFerme] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  const champ = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => setPassable(true), 3000);
    champ.current?.focus();
    champ.current?.select();
    return () => clearTimeout(t);
  }, []);

  // La modale est bloquante : on neutralise le défilement de la page derrière.
  useEffect(() => {
    if (ferme) return;
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = precedent;
    };
  }, [ferme]);

  if (ferme) return null;

  function valider() {
    const kg = Number(valeur.replace(",", "."));
    if (!Number.isFinite(kg)) return setErreur("Entre un poids en kilogrammes");

    setErreur(null);
    startTransition(async () => {
      const r = await enregistrerPesee(kg);
      if ("erreur" in r) {
        setErreur(r.erreur ?? "Enregistrement impossible");
        return;
      }
      setFerme(true);
      router.refresh();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titre-pesee"
      className="fixed inset-0 z-50 flex items-center justify-center bg-nuit-950/90 p-5 backdrop-blur-sm"
    >
      <div className="surface w-full max-w-sm p-6">
        <h2 id="titre-pesee" className="text-lg font-semibold text-ivoire">
          Ton poids du jour
        </h2>
        <p className="mt-2 text-sm text-brume">
          {dernierPoids
            ? `Dernière pesée : ${dernierPoids} kg.`
            : "C'est le point de départ de ta courbe."}
        </p>

        <div className="mt-5 flex items-center gap-3">
          <input
            ref={champ}
            type="number"
            inputMode="decimal"
            step="0.1"
            value={valeur}
            onChange={(e) => setValeur(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && valider()}
            aria-label="Poids en kilogrammes"
            className="w-full rounded-lg border border-nuit-600 bg-nuit-900 px-3 py-3 text-lg text-ivoire"
          />
          <span className="text-brume">kg</span>
        </div>

        {erreur && (
          <p role="alert" className="mt-3 text-sm text-manque">
            {erreur}
          </p>
        )}

        <button
          type="button"
          onClick={valider}
          disabled={enCours}
          className="mt-5 w-full rounded-lg border border-or-600/60 bg-or-500/10 px-6 py-3 font-medium text-or-400 transition hover:bg-or-500/20 disabled:opacity-40"
        >
          {enCours ? "Enregistrement…" : "Valider (+2 LP)"}
        </button>

        {passable && (
          <button
            type="button"
            onClick={() => setFerme(true)}
            className="mt-3 w-full text-xs text-cendre transition hover:text-brume"
          >
            Passer aujourd&apos;hui
          </button>
        )}
      </div>
    </div>
  );
}
