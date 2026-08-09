/**
 * Méandre grec — la « grecque », frise à angles droits qu'on trouve sur les
 * poteries attiques et les frontons. C'est le motif le plus identifiable de
 * l'ornementation grecque, et il figure déjà sur l'écusson de Myrmidon.
 *
 * Rendu en SVG répété plutôt qu'en image : il suit la couleur du texte et
 * reste net à n'importe quelle densité d'écran.
 */
export function Meandre({
  className = "",
  couleur = "currentColor",
  opacite = 0.35,
}: {
  className?: string;
  couleur?: string;
  opacite?: number;
}) {
  return (
    <div className={`h-3 w-full ${className}`} aria-hidden style={{ opacity: opacite }}>
      <svg width="100%" height="12" viewBox="0 0 48 12" preserveAspectRatio="xMidYMid repeat">
        <defs>
          <pattern id="meandre" width="24" height="12" patternUnits="userSpaceOnUse">
            <path
              d="M0 11h22V3H6v5h10V6H9"
              fill="none"
              stroke={couleur}
              strokeWidth="1.4"
              strokeLinecap="square"
            />
          </pattern>
        </defs>
        <rect width="100%" height="12" fill="url(#meandre)" />
      </svg>
    </div>
  );
}

/**
 * Séparateur de section : un losange encadré de deux filets, repris de la
 * planche de rangs d'origine où il sépare chaque écusson de son titre.
 */
export function SeparateurLosange({ couleur = "var(--color-or-600)" }: { couleur?: string }) {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${couleur})` }} />
      <svg width="9" height="9" viewBox="0 0 9 9">
        <path d="M4.5 0L9 4.5L4.5 9L0 4.5Z" fill={couleur} />
      </svg>
      <span className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${couleur})` }} />
    </div>
  );
}

/**
 * Couronne de laurier ouverte, posée derrière un contenu mis en avant.
 * Purement décorative, d'où l'`aria-hidden`.
 */
export function Laurier({ couleur = "var(--color-or-600)" }: { couleur?: string }) {
  const feuille = (x: number, y: number, rotation: number, echelle: number) => (
    <ellipse
      key={`${x}-${y}`}
      cx={x}
      cy={y}
      rx={7 * echelle}
      ry={3 * echelle}
      fill={couleur}
      transform={`rotate(${rotation} ${x} ${y})`}
    />
  );

  // Deux branches symétriques, feuilles disposées le long d'un arc.
  const branche = (sens: 1 | -1) =>
    Array.from({ length: 7 }, (_, i) => {
      const t = i / 6;
      const angle = Math.PI * (0.62 + t * 0.5);
      const x = 60 + sens * Math.cos(angle) * -46;
      const y = 62 - Math.sin(angle) * 44;
      return feuille(x, y, sens * (-58 + t * 70), 1 - t * 0.32);
    });

  return (
    <svg viewBox="0 0 120 80" className="size-full" aria-hidden>
      <g opacity="0.5">
        {branche(1)}
        {branche(-1)}
      </g>
    </svg>
  );
}
