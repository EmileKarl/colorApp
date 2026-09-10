# Color Code

Scanne une couleur réelle, obtiens son code (HEX/RGB/HSL), sauvegarde-la, partage-la et
participe à la base de données communautaire de couleurs nommées et votées.

Application mobile Android + iOS construite avec [Expo](https://expo.dev) (React Native +
TypeScript) et [Supabase](https://supabase.com) (Postgres, Auth, Storage).

Voir `docs/PRODUCT_DISCOVERY.md` pour l'audit de faisabilité complet, la roadmap MVP1→MVP5, la
justification des choix techniques et l'estimation des coûts.

## Statut actuel

- ✅ Scan caméra / import galerie → extraction de couleur → HEX/RGB/HSL/famille
- ✅ Sauvegarde personnelle (collection privée, par compte)
- ✅ Détection de couleur déjà connue de la communauté (dédoublonnage par proximité de couleur)
- ✅ Proposition de nom de couleur → file de modération → vote communautaire → classement
- ✅ Carte partageable (image) générée depuis l'écran résultat
- ✅ Authentification par courriel, suppression de compte (droit à l'effacement)
- ⏳ Modération (interface admin), feed social, gamification : prévus en MVP4 (non commencés)
- ⏳ Paiements / fonctionnalités premium : prévus en MVP5 (non commencés)

## Démarrage

### Prérequis

- Node.js 20+
- Un compte [Supabase](https://supabase.com) gratuit (à créer par toi — voir
  `docs/PRODUCT_DISCOVERY.md` §9 pour la répartition des responsabilités)
- Expo Go (sur ton téléphone) ou un émulateur Android/iOS pour tester

### Installation

```bash
npm install --legacy-peer-deps
cp .env.example .env.local
# renseigne EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY dans .env.local
```

Applique le schéma de base de données : voir `supabase/README.md`.

### Lancer l'app en développement

```bash
npm start
```

Scanne le QR code avec Expo Go, ou appuie sur `a`/`i` pour lancer un émulateur Android/iOS.

### Qualité

```bash
npm run lint       # ESLint (eslint-config-expo)
npm run typecheck  # TypeScript strict, aucune erreur
npm test           # Jest — logique couleur pure, testable sans appareil/émulateur
```

Ces trois commandes tournent aussi en CI sur chaque pull request (`.github/workflows/ci.yml`).

## Structure du projet

```
app/                  Écrans (Expo Router — un fichier = une route)
  (tabs)/             Scanner, Collection, Communauté, Profil
  auth/                Connexion / création de compte
  result.tsx           Résultat du scan (codes, sauvegarde, partage, proposition de nom)
src/
  components/          Composants d'interface réutilisables
  context/AuthContext   État d'authentification global (Supabase Auth)
  data/                 Dictionnaire de noms de couleurs de secours (hors-ligne)
  lib/                  Logique métier : conversions couleur, accès Supabase, extraction caméra
  types/database.ts     Types TypeScript du schéma Supabase
supabase/
  migrations/           Schéma SQL complet (tables, RLS, anti-spam, suppression de compte)
docs/
  PRODUCT_DISCOVERY.md  Audit de faisabilité, roadmap, architecture, coûts
```

## Sécurité et vie privée (résumé — détails dans `docs/PRODUCT_DISCOVERY.md` et `supabase/README.md`)

- Row Level Security activée sur toutes les tables ; un utilisateur ne modifie jamais les
  données d'un autre.
- Limite de 20 propositions (couleur ou nom) par heure et par utilisateur, appliquée côté
  serveur (impossible à contourner depuis le client).
- Suppression de compte en libre-service (`delete_own_account`), conforme au droit à
  l'effacement.
- Aucun secret dans le dépôt : `.env.local` est ignoré par Git, seule la clé publique
  (anon) Supabase est utilisée côté client.
- La couleur affichée est une estimation basée sur la caméra du téléphone, pas une mesure
  colorimétrique professionnelle — voir l'avertissement affiché à l'utilisateur dans l'app.

## Ce qui reste à faire avant une publication sur les stores

Voir `docs/PRODUCT_DISCOVERY.md` §9 — notamment la création des comptes développeur Apple et
Google (payants, identité personnelle requise), la génération des icônes/splash définitifs, et
les fiches de politique de confidentialité / conditions d'utilisation à faire valider légalement.
