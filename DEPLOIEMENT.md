# Déployer La Faille

Tout ce qui suit tient dans les offres gratuites. Les 99 €/an d'Apple ne
concernent que TestFlight et l'App Store, pas ce document.

Compter une trentaine de minutes la première fois.

---

## 1. Une base PostgreSQL managée

Crée un projet sur [Neon](https://neon.tech) (ou Supabase). Récupère **deux**
chaînes de connexion, ce n'est pas un détail :

| Variable | Chaîne | Pourquoi |
|---|---|---|
| `DATABASE_URL` | **poolée** (contient `-pooler`), avec `?sslmode=require&pgbouncer=true&connection_limit=1` | En serverless, chaque invocation ouvre sa propre connexion. Sans pooler, la base sature dès quelques visiteurs simultanés. |
| `DIRECT_URL` | **directe**, sans `-pooler` | Un pooler transactionnel ne sait pas exécuter un DDL : les migrations passeraient en erreur. |

## 2. Déployer sur Vercel

1. [vercel.com/new](https://vercel.com/new) → importer le dépôt GitHub.
2. Laisser la détection automatique de Next.js. Vercel appelle le script
   `vercel-build`, qui applique les migrations **avant** de compiler.
3. Déclarer les variables d'environnement :

```
DATABASE_URL        (la chaîne poolée)
DIRECT_URL          (la chaîne directe)
AUTH_SECRET         (voir ci-dessous)
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
AUTH_GOOGLE_ID_IOS
```

Plus, si tu les veux, les variables d'Apple et de Discord — voir la section
« Connexion » du README. Chaque fournisseur s'active seul ; il en faut au moins
un, l'app n'ayant pas de mot de passe.

> **Trois pièges, tous vécus.**
>
> **Une variable créée sans valeur compte pour absente** : le site affichera
> « Aucune connexion configurée » exactement comme si elle n'existait pas.
>
> **Les variables sont figées à la création du déploiement.** En ajouter une ne
> change rien tant qu'on n'a pas redéployé (Deployments → ⋯ → Redeploy).
>
> **Ne déclare pas `AUTH_URL` sur Vercel.** Auth.js déduit l'origine de l'hôte
> de la requête — `trustHost` est vrai dès que `VERCEL` est défini. Renseignée,
> elle **réécrit l'origine de chaque requête** : une valeur périmée (un ancien
> tunnel, par exemple) envoie au fournisseur une URI de redirection qui ne
> correspond à rien, et la connexion échoue sans que le message le dise.

**Génère un `AUTH_SECRET` neuf pour la production** — celui du `.env` local a
traversé une conversation :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 3. Autoriser le domaine chez les fournisseurs

Chaque fournisseur veut connaître l'adresse exacte de retour. Au caractère
près — un `s` de trop dans le nom de domaine suffit à provoquer un
`redirect_uri_mismatch` qu'on cherche longtemps.

| Fournisseur | Où | URI à déclarer |
|---|---|---|
| Google | [console.cloud.google.com/auth/clients](https://console.cloud.google.com/auth/clients) → client **Web** | `https://<ton-projet>.vercel.app/api/auth/callback/google` |
| Apple | developer.apple.com → **Services ID** → Configure | `https://<ton-projet>.vercel.app/api/auth/callback/apple` |
| Discord | Developer Portal → ton app → **OAuth2** | `https://<ton-projet>.vercel.app/api/auth/callback/discord` |

Côté Google, rien de plus : l'app est déjà publiée et ne demande que des scopes
non sensibles, donc aucune vérification n'est requise.

Côté Apple, il faut en plus **prouver que le domaine t'appartient** : Apple
télécharge un fichier que tu déposes dans `public/.well-known/`. Il se peut
qu'Apple refuse un sous-domaine `.vercel.app` et exige un domaine à toi — c'est
à vérifier au moment de le déclarer.

## 4. Charger le catalogue, une fois

Les migrations créent les tables vides. Les 8 équipements, 7 groupes
musculaires et 147 exercices se chargent par le seed, depuis ta machine :

```bash
DATABASE_URL="<chaîne directe de production>" \
DIRECT_URL="<chaîne directe de production>" \
npx prisma db seed
```

Le seed est idempotent — il fait des `upsert` — donc le rejouer après une
mise à jour du catalogue ne duplique rien.

## 5. Brancher l'app mobile

Dans `mobile/.env` :

```
EXPO_PUBLIC_API_URL=https://<ton-projet>.vercel.app
EXPO_PUBLIC_GOOGLE_ID_IOS=<client OAuth iOS>.apps.googleusercontent.com
EXPO_PUBLIC_DISCORD_ID=<identifiant de l'application Discord>
```

Ces trois-là sont **figées dans le bundle à la compilation**. Pour une build
EAS, elles doivent donc vivre dans l'environnement du profil, pas seulement
dans le fichier local :

```bash
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_GOOGLE_ID_IOS --value "…"
```

Côté serveur, la connexion Apple native demande en plus `AUTH_APPLE_ID_IOS`
— l'identifiant de bundle de l'app —, le jeton natif étant émis pour lui et
non pour l'identifiant de service du navigateur.

Puis `npx expo start --clear` : `EXPO_PUBLIC_*` est figé dans le bundle, sans
`--clear` l'ancienne adresse resterait.

Le tunnel `cloudflared` n'a plus lieu d'être : l'adresse est stable, Google
est configuré une fois pour toutes, et ton téléphone y accède de n'importe où.

---

## Les migrations, désormais

Le projet a longtemps utilisé `prisma db push`, qui applique un schéma sans
laisser de trace. Pratique en développement, intenable en production : ni
historique, ni retour arrière, et le risque d'une perte de données silencieuse
à chaque évolution.

```bash
npm run db:migrate    # développement : crée une migration et l'applique
npm run db:deploy     # production : applique celles qui manquent
npm run db:reset      # remet à zéro et rejoue tout, en local
```

Les tests d'intégration appliquent **les mêmes migrations** que la production,
et non le schéma directement : une migration qui aurait dérivé casse la suite
ici, pas au déploiement.

## Une fois en ligne

- **La PWA devient utilisable en salle** : sur ton iPhone, Safari →
  Partager → Sur l'écran d'accueil. Plus besoin que ton PC tourne.
- Les sessions durent 30 jours ; les jetons de l'API, 15 minutes renouvelables
  sur 60 jours.
- Vercel Hobby est réservé à un usage non commercial. Passer l'app en payant
  ou la publier sur l'App Store suppose une offre Pro.
