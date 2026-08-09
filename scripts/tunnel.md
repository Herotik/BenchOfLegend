# Exposer le serveur de développement à un téléphone

L'app mobile ne peut pas se connecter à `localhost` : ce n'est pas la même
machine. Et l'adresse locale du PC — `http://192.168.0.34:3000` — ne convient
pas non plus, pour une raison qui n'a rien à voir avec le réseau : **Google
refuse les adresses IP privées comme URI de redirection OAuth**. Un flux de
connexion lancé depuis le téléphone échouerait en `redirect_uri_mismatch`.

Un tunnel HTTPS règle les deux à la fois — il donne une adresse publique que
Google accepte, et évite d'ouvrir un port dans le pare-feu.

## Marche à suivre

**1. Lancer le tunnel**, dans un terminal à part :

```bash
cloudflared tunnel --url http://localhost:3000
```

Il affiche une adresse du type `https://xxxx-yyyy-zzzz.trycloudflare.com`.
Elle change à chaque lancement — c'est le prix d'un tunnel sans compte.

**2. Déclarer cette adresse à Google.** Dans la
[console Google Cloud](https://console.cloud.google.com/auth/clients), ouvrir
le client OAuth **Web** et ajouter aux URI de redirection autorisés :

```
https://xxxx-yyyy-zzzz.trycloudflare.com/api/auth/callback/google
```

**3. Aligner le backend.** Dans `.env` à la racine :

```
AUTH_URL="https://xxxx-yyyy-zzzz.trycloudflare.com"
```

Puis redémarrer `npm run dev` — Next ne relit pas `.env` à chaud.

**4. Aligner l'app mobile.** Dans `mobile/.env` :

```
EXPO_PUBLIC_API_URL=https://xxxx-yyyy-zzzz.trycloudflare.com
```

**5. Démarrer Expo** :

```bash
cd mobile && npx expo start
```

Scanner le QR code avec l'appareil photo de l'iPhone, Expo Go s'ouvre.

## Quand ce sera déployé

Ces quatre alignements disparaissent : l'app pointe sur le domaine de
production, une bonne fois. Le tunnel n'est qu'une béquille de développement.

## Si tu préfères éviter le tunnel

L'alternative est de déployer le backend — même sur un hébergement gratuit.
L'adresse devient stable, Google n'a plus besoin d'être reconfiguré à chaque
session, et le téléphone y accède de n'importe où, pas seulement depuis le
réseau de la maison.
