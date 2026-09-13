# ColorLens

**« Capture une couleur. Crée ton univers. »**

Capture une couleur dans le monde réel, obtiens ses codes (HEX/RGB/HSL/HSV/LAB/CMYK), puis
applique-la à des objets — t-shirts, sneakers, voitures — zone par zone, avec matériaux et
éclairages. Enregistre, exporte, partage.

Application mobile Android + iOS construite avec [Expo](https://expo.dev) (React Native +
TypeScript) et [Supabase](https://supabase.com) (Postgres, Auth, Storage).

Voir `docs/PRODUCT_DISCOVERY.md` pour l'audit de faisabilité complet, la roadmap MVP1→MVP5, la
justification des choix techniques et l'estimation des coûts, `docs/COLOR_ENGINE.md` pour le
moteur colorimétrique et ses mesures, et `docs/LIMITATIONS.md` pour ce que l'application **ne
fait pas** et pourquoi.

## Statut actuel

**Le parcours ColorLens complet fonctionne** : capture → analyse → palette → objet → Studio →
personnalisation → variantes → sauvegarde → export.

### Capture et couleur
- ✅ Scan caméra / import galerie → HEX, RGB, HSL, HSV, LAB, LCh, CMYK approximatif
- ✅ Tap-to-Color : analyser n'importe quelle zone d'une photo
- ✅ Température, luminosité, saturation en langage clair
- ✅ Moteur colorimétrique scientifique avec score de confiance honnête
  (`docs/COLOR_ENGINE.md`)

### Studio objet — la fonction différenciante
- ✅ Bibliothèque d'objets (t-shirt, sneaker, voiture), recherche, favoris, récents
- ✅ Color Studio : couleur par zone, matériaux, éclairages, réglages de rendu
- ✅ 12 matériaux, 7 éclairages, recoloration qui préserve ombres et volumes
  (`docs/OBJECT_STUDIO.md`)
- ✅ 10 variantes automatiques + 7 ajustements cumulables, tous déterministes
- ✅ Comparateur avant/après, annuler/rétablir, réinitialiser

### Palettes et création
- ✅ 15 schémas d'harmonie, 10 styles de palette, photo → palette avec proportions réelles
- ✅ Interprétation esthétique et usages suggérés, **dérivés des mesures**
- ✅ Color Lab : mélange en CIELAB, déclinaisons, « Surprise me »
- ✅ Color Story déterministe
- ✅ Export PNG/JPG, HEX/RGB/HSL, JSON, CSS, variables de design, SVG

### Bibliothèque et social
- ✅ Couleurs, palettes, créations, collections nommées
- ✅ Explorer : thèmes composés, créations publiques, noms votés par la communauté
- ✅ Remix d'une création publique, avec lien vers l'originale
- ✅ Profil avec statistiques réelles, paramètres complets

### Accessibilité et honnêteté
- ✅ Contraste WCAG AA/AAA, simulation du daltonisme, alertes sur les palettes qui se confondent
- ✅ Les statistiques ne sont jamais estimées ; les tendances ne sont pas fabriquées
- ❌ Live Color temps réel : **impossible dans Expo Go** — voir `docs/LIMITATIONS.md`
- ❌ WebP : le module de capture d'Expo Go n'encode qu'en PNG et JPG
- ⏳ Mockups photographiques : le moteur les accepte, les images restent à fournir
- ⏳ 3D : architecture préparée, non implémentée (§14 la place hors MVP)

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
npx expo start -c
```

Scanne le QR code avec Expo Go sur ton téléphone, ou appuie sur `a` pour un émulateur
Android.

**Guide détaillé : `docs/TESTER.md`** — émulateur Android Studio, iPhone via Expo Go,
résolution des problèmes courants, et ce qu'il faut vérifier en priorité.

> Note : il n'y a pas de dossier `android/` ni `ios/`. C'est un projet Expo *managed* :
> Android Studio sert uniquement à fournir l'émulateur, on n'y ouvre pas le projet.

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

## Contrainte importante : compatibilité Expo Go

L'app n'utilise **que des modules natifs inclus dans Expo Go** (les paquets `expo-*` officiels,
plus `react-native-view-shot`, `react-native-svg` et `@react-native-async-storage/async-storage`,
qui figurent dans `node_modules/expo/bundledNativeModules.json`). C'est ce qui permet de tester
sur un téléphone avec Expo Go, sans compte développeur Apple payant ni development build.

Avant d'ajouter une dépendance contenant du code natif, vérifie qu'elle est dans ce fichier :

```bash
grep "<nom-du-paquet>" node_modules/expo/bundledNativeModules.json
```

Si elle n'y figure pas, l'app plantera sur l'appareil avec
`Cannot find native module '...'` — et, si l'import est en haut d'un fichier de route, l'erreur
se manifestera de façon trompeuse comme `Cannot read property 'ErrorBoundary' of undefined`.
C'est précisément pourquoi l'extraction de couleur est écrite en JavaScript pur
(`src/lib/pixels.ts`) plutôt qu'avec une librairie native.

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
