# La Faille

Application web de suivi d'entraînement gamifiée : un programme hebdomadaire personnalisé,
des séances validées qui rapportent des LP, et une progression par rangs inspirée de League
of Legends transposée en mythologie grecque — **Hoplite → Dieu de l'Olympe**.

La spécification complète est dans [SPEC-la-faille.md](SPEC-la-faille.md).

## Rangs

Les 8 rangs sont définis dans [`lib/ranks.ts`](lib/ranks.ts) — source de vérité unique pour
les noms, sous-titres, descriptions, couleurs d'accent et seuils LP.

| Rang | Palier | LP d'entrée |
|---|---|---|
| Hoplite | Fer | 0 |
| Myrmidon | Bronze | 400 |
| Spartiate | Argent | 800 |
| Héraclès | Or | 1200 |
| Élyséen | Platine | 1600 |
| Titan | Diamant | 2000 |
| Demi-Dieu | Maître | 2400 |
| Dieu de l'Olympe | Challenger | 3000 |

![Les 8 rangs](docs/rangs.png)

Les écussons (`public/ranks/*.png`, 512×512 transparents) sont découpés depuis
[`docs/planche-rangs-source.png`](docs/planche-rangs-source.png) par
[`scripts/extract-ranks.py`](scripts/extract-ranks.py) :

```bash
python scripts/extract-ranks.py
```

Le script demande `pillow`, `numpy` et `scipy`. Il n'a besoin d'être relancé que si la
planche source change.
