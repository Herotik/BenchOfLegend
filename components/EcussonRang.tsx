"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { rankProgressForLp, rankLabel } from "@/lib/ranks";
import { Laurier, SeparateurLosange } from "@/components/ornements/Meandre";

/**
 * Écusson du rang courant avec la barre de progression LP.
 *
 * Composant client pour deux raisons : le halo « respire » derrière l'écusson,
 * et le compteur de LP monte plutôt que d'apparaître d'un coup — un chiffre
 * qui grimpe se lit comme une progression, un chiffre posé comme un état.
 */
export function EcussonRang({ lp, taille = 132 }: { lp: number; taille?: number }) {
  const { rank, lpInDivision, lpToNextDivision, progress } = rankProgressForLp(lp);
  const compteur = useCompteur(lpInDivision);
  const [barre, setBarre] = useState(0);

  // La barre part de zéro au montage : on voit le remplissage, ce qui donne
  // sa valeur au gain de LP qu'on vient d'obtenir.
  useEffect(() => {
    const t = setTimeout(() => setBarre(progress), 120);
    return () => clearTimeout(t);
  }, [progress]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center" style={{ width: taille * 1.6, height: taille * 1.15 }}>
        {/* Halo à la couleur du rang : le rang colore sa propre lumière. */}
        <span
          aria-hidden
          className="absolute rounded-full blur-2xl motion-safe:animate-[souffle_5s_ease-in-out_infinite]"
          style={{
            width: taille * 0.95,
            height: taille * 0.95,
            backgroundColor: rank.color,
            opacity: 0.45,
          }}
        />
        <span aria-hidden className="absolute inset-0" style={{ color: rank.color }}>
          <Laurier couleur="currentColor" />
        </span>

        <Image
          src={rank.logo}
          alt={`Écusson ${rank.name}`}
          width={taille}
          height={taille}
          style={{ width: taille, height: taille }}
          className="relative motion-safe:surgit"
          preload
        />
      </div>

      <div className="text-center">
        <p
          className="font-display text-2xl font-bold motion-safe:apparait"
          style={{ color: rank.color }}
        >
          {rankLabel(lp)}
        </p>
        <p className="mt-0.5 text-xs tracking-wide text-brume uppercase">{rank.subtitle}</p>
      </div>

      <div className="w-full max-w-60">
        <div
          className="relative h-2 overflow-hidden rounded-full bg-nuit-800"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progression vers la division suivante"
        >
          <div
            className="h-full rounded-full transition-[width] duration-1000 ease-out"
            style={{ width: `${barre * 100}%`, backgroundColor: rank.color }}
          />
          {/* Éclat qui balaie la barre, comme la lumière sur du métal poli. */}
          <span
            aria-hidden
            className="absolute inset-y-0 w-8 bg-white/20 blur-[2px] motion-safe:animate-[lueur_3.5s_ease-in-out_infinite]"
          />
        </div>
        <p className="mt-2 text-center text-xs tabular-nums text-cendre">
          {rank.divisions > 1 ? `${compteur} / ${lpToNextDivision} LP` : `${lp} LP`}
        </p>
      </div>

      <div className="mt-1 w-full max-w-60">
        <SeparateurLosange couleur={rank.color} />
      </div>

      <p className="max-w-xs text-center text-sm text-brume">{rank.description}</p>
    </div>
  );
}

/** Compteur qui monte de 0 à `cible` en une seconde. */
function useCompteur(cible: number): number {
  const [valeur, setValeur] = useState(cible);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValeur(cible);
      return;
    }

    const depart = performance.now();
    const duree = 900;
    let frame = 0;

    const avancer = (t: number) => {
      const p = Math.min(1, (t - depart) / duree);
      // Décélération : la fin du décompte doit être lisible.
      setValeur(Math.round(cible * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(avancer);
    };

    frame = requestAnimationFrame(avancer);
    return () => cancelAnimationFrame(frame);
  }, [cible]);

  return valeur;
}
