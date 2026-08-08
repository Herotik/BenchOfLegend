import Image from "next/image";
import { rankProgressForLp, rankLabel } from "@/lib/ranks";

/**
 * Écusson du rang courant avec la barre de progression LP.
 * Le dernier rang n'a pas de plafond : la barre y reste pleine.
 */
export function EcussonRang({ lp, taille = 128 }: { lp: number; taille?: number }) {
  const { rank, lpInDivision, lpToNextDivision, progress } = rankProgressForLp(lp);

  return (
    <div className="flex flex-col items-center gap-3">
      <Image
        src={rank.logo}
        alt={`Écusson ${rank.name}`}
        width={taille}
        height={taille}
        style={{ width: taille, height: taille }}
        preload
      />

      <div className="text-center">
        <p className="font-display text-2xl font-bold" style={{ color: rank.color }}>
          {rankLabel(lp)}
        </p>
        <p className="mt-0.5 text-xs tracking-wide text-brume uppercase">{rank.subtitle}</p>
      </div>

      <div className="w-full max-w-56">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-nuit-700"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progression vers la division suivante"
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${progress * 100}%`, backgroundColor: rank.color }}
          />
        </div>
        <p className="mt-2 text-center text-xs text-cendre">
          {rank.divisions > 1 ? `${lpInDivision} / ${lpToNextDivision} LP` : `${lp} LP`}
        </p>
      </div>

      <p className="max-w-xs text-center text-sm text-brume">{rank.description}</p>
    </div>
  );
}
