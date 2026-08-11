/**
 * Les équerres — l'actif signature de Frame of Legends.
 *
 * Quatre angles, filet d'un pixel, **jamais reliés**. Un cadre fermé enferme ;
 * un cadre ouvert désigne. C'est toute la différence entre une bordure
 * décorative et un viseur, et c'est ce qui sépare cet actif d'un filet
 * quelconque.
 *
 * Toujours quatre : jamais deux, jamais trois. D'où l'absence de toute option
 * permettant d'en retirer.
 */
export function Equerres({
  taille = 18,
  retrait = 12,
  couleur = "var(--accent)",
  anime = false,
}: {
  /** Longueur des branches, 18 px à taille de base. */
  taille?: number;
  /** Retrait depuis le bord du conteneur. */
  retrait?: number;
  couleur?: string;
  /** Tracé en séquence à l'apparition. */
  anime?: boolean;
}) {
  const angles = [
    { cle: "hg", styles: { top: retrait, left: retrait, borderRight: 0, borderBottom: 0 }, delai: 0 },
    { cle: "hd", styles: { top: retrait, right: retrait, borderLeft: 0, borderBottom: 0 }, delai: 100 },
    { cle: "bd", styles: { bottom: retrait, right: retrait, borderLeft: 0, borderTop: 0 }, delai: 200 },
    { cle: "bg", styles: { bottom: retrait, left: retrait, borderRight: 0, borderTop: 0 }, delai: 300 },
  ] as const;

  return (
    <>
      {angles.map((a) => (
        <span
          key={a.cle}
          aria-hidden
          className={`pointer-events-none absolute ${anime ? "motion-safe:animate-[equerre_0.55s_ease_both]" : ""}`}
          style={{
            width: taille,
            height: taille,
            border: `1px solid ${couleur}`,
            animationDelay: anime ? `${a.delai}ms` : undefined,
            ...a.styles,
          }}
        />
      ))}
    </>
  );
}

/**
 * Conteneur cadré : le motif le plus courant de la marque — cadrer un chiffre,
 * un écusson, une carte.
 */
export function Cadre({
  children,
  className = "",
  taille,
  retrait,
  couleur,
  anime,
}: {
  children: React.ReactNode;
  className?: string;
  taille?: number;
  retrait?: number;
  couleur?: string;
  anime?: boolean;
}) {
  return (
    <div className={`relative grid place-items-center ${className}`}>
      <Equerres taille={taille} retrait={retrait} couleur={couleur} anime={anime} />
      {children}
    </div>
  );
}
