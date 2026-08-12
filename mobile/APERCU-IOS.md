# Voir l'app sur iOS depuis Windows

Le Simulateur iOS fait partie de Xcode et ne tourne que sur macOS. Il n'existe
pas d'émulateur iOS sous Windows — ce qu'on trouve sous ce nom n'en est pas.

Le contournement tient en deux temps : **EAS compile dans le cloud**, sur les
machines macOS d'Expo, et **Appetize diffuse un vrai Simulateur** dans un
navigateur.

## Ce que ça ne demande pas

**Pas de compte Apple Developer.** Une build destinée au Simulateur n'est pas
signée — la signature ne sert qu'à installer sur un appareil réel. Les 99 $
restent nécessaires pour l'iPhone, pas pour ceci.

## Marche à suivre

**1. Une fois pour toutes**, depuis `mobile/` :

```bash
npx eas-cli login          # compte Expo, gratuit
npx eas-cli init           # inscrit un projectId dans app.json
```

**2. Lancer la build** :

```bash
npx eas-cli build --platform ios --profile simulateur
```

Compte une dizaine de minutes, file d'attente comprise. La commande rend une
URL de téléchargement : c'est une archive contenant un `.app`.

**3. Le faire tourner.** Sur [appetize.io](https://appetize.io), créer un
compte gratuit et téléverser l'archive. Le Simulateur s'ouvre dans le
navigateur, avec les vraies polices système, les vraies marges de sécurité et
le vrai clavier — tout ce que l'aperçu `react-native-web` ne peut pas rendre.

Le palier gratuit d'Appetize se compte en dizaines de minutes par mois : c'est
fait pour vérifier, pas pour développer dedans.

## Les profils de `eas.json`

| Profil         | À quoi il sert                                                     |
| -------------- | ------------------------------------------------------------------ |
| `simulateur`   | Simulateur iOS, non signé — le seul qui marche sans compte Apple.   |
| `developpement` | Build de développement pour appareil réel. Demande le compte Apple. |
| `apercu`       | Distribution interne, sans client de développement.                 |
| `production`   | Ce qui part sur les magasins.                                       |

## Le reste du temps

Pour le travail courant, l'aperçu navigateur reste plus rapide — il rend le
vrai code, sans compilation :

```bash
npm --prefix mobile run start -- --web --port 8082
```

Il ne montre pas le rendu iOS, mais il a trouvé la plupart des défauts de mise
en page corrigés jusqu'ici. Un émulateur **Android**, lui, tourne localement
sur Windows : même code React Native, donc il attrape ce qui relève de la
disposition et de la logique.
