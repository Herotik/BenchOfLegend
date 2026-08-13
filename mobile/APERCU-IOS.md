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

| Profil          | À quoi il sert                                                       | Canal          |
| --------------- | -------------------------------------------------------------------- | -------------- |
| `developpement` | Client de développement : le JS vient de Metro, rechargé à chaud.     | `developpement` |
| `simulateur`    | Simulateur iOS, non signé — le seul qui marche sans compte Apple.     | `preview`      |
| `appareil`      | App autonome sur iPhone déclaré. Demande le compte Apple.             | `preview`      |
| `apercu`        | Distribution interne.                                                 | `preview`      |
| `production`    | Ce qui part sur les magasins.                                         | `production`   |

Chaque profil déclare son `environment` : sans lui, il n'hérite d'aucune
variable et l'app démarre sans savoir quelle API appeler — l'erreur du commit
`c1b9a02`, corrigée pour tous les profils.

---

# Ne plus reconstruire pour trois lignes

Une build EAS coûte une quinzaine de minutes. Deux mécanismes évitent de la
payer à chaque retouche, et ils ne servent pas au même moment.

## Pendant le travail : le client de développement

Une build, une seule fois :

```bash
npx eas-cli build --platform ios --profile developpement
```

Ensuite, à chaque session :

```bash
npm --prefix mobile run start -- --dev-client
```

L'iPhone se branche sur Metro par le Wi-Fi — même réseau que le PC, sinon
`--tunnel`. Un fichier sauvegardé, l'écran se recharge en quelques secondes.

## Pour livrer : les mises à jour à distance

L'app installée va chercher son JavaScript sur les serveurs d'Expo au
lancement. Une correction se pousse sans reconstruire ni réinstaller :

```bash
npx eas-cli update --channel preview --environment preview --message "ce que ça corrige"
```

> **Le `--environment preview` n'est pas décoratif.** Les `EXPO_PUBLIC_*` sont
> figées dans le paquet au moment où il est fabriqué — ici, au moment de la
> mise à jour, pas de la build. Sans ce drapeau, la mise à jour part sans
> `EXPO_PUBLIC_GOOGLE_ID_IOS` ni `EXPO_PUBLIC_DISCORD_ID`, et les boutons de
> connexion natifs disparaissent de l'app installée.

## Ce qui exige encore une build

`runtimeVersion` suit la politique **`fingerprint`** : l'empreinte du projet
natif. Une mise à jour ne descend que sur les builds dont le natif correspond
exactement — ce qui rend impossible d'envoyer un JavaScript appelant un module
absent du binaire, qui fermerait l'app au lancement.

Reconstruire reste donc nécessaire pour : une **dépendance native** ajoutée ou
retirée, un changement d'`app.json` touchant au natif (icône, écran de
lancement, permissions, identifiant de bundle), et une montée de SDK Expo. Tout
le reste — écrans, logique, styles, appels d'API — passe par `eas update`.

Si une mise à jour semble ne pas arriver, c'est en général que l'empreinte a
changé : le canal la sert toujours, mais plus au binaire installé.

## Le reste du temps

Pour le travail courant, l'aperçu navigateur reste le plus rapide — il rend le
vrai code, sans compilation :

```bash
npm --prefix mobile run start -- --web --port 8082
```

Il ne montre pas le rendu iOS, mais il a trouvé la plupart des défauts de mise
en page corrigés jusqu'ici. Un émulateur **Android**, lui, tourne localement
sur Windows : même code React Native, donc il attrape ce qui relève de la
disposition et de la logique.
