# ColorLens — Audit du projet existant

Exigé par le §13 du cahier des charges ColorLens : *« Commence par l'audit du projet
existant et attends la validation du plan avant une refonte massive. »*

Ce document répond aux 12 points d'inspection obligatoires. Le plan de refonte est dans
`docs/COLORLENS_PLAN.md`. **Aucune ligne de code produit n'a été modifiée avant ta
validation** — seuls ces deux documents ont été ajoutés.

Date de l'audit : commit `9e7614f`, branche `claude/color-code-app-455juh`.

---

## 0. Résumé pour décision

| | |
|---|---|
| État de santé du code existant | **Bon** — 0 erreur TypeScript, 0 erreur ESLint, 263/263 tests verts, bundle iOS construit |
| Réutilisable tel quel pour ColorLens | **~70 % du code non-écran** (moteur couleur, domaine, auth, Supabase) |
| Part de ColorLens déjà couverte | **9 pages sur 24** (dont 5 partiellement) |
| Le plus gros manque | **Le Studio objet (pages 9 à 15, 17, 18, 22)** — c'est la fonction différenciante, et elle n'existe pas du tout |
| Bonne nouvelle technique | **Skia est inclus dans Expo Go** → la recoloration par masques est faisable **sans development build** |
| Décision qui t'appartient | **Les images des mockups** — je peux écrire le moteur de rendu, je ne peux pas produire de photos d'objets (§4, ci-dessous) |

---

## 1. Inspection du projet

84 fichiers sources, 6 161 lignes d'écrans + composants + domaine, hors moteur couleur.

```
app/                 15 routes (7 onglets, 6 modales, 2 auth)
src/color-engine/    18 modules + 5 suites de tests   ← moteur colorimétrique scientifique
src/domain/          11 modules + 2 suites de tests   ← logique produit pure
src/components/      10 composants réutilisables
src/context/          2 providers (Auth, RecentColors)
src/lib/              7 modules (couleur, pixels, extraction, 3 API Supabase)
supabase/migrations/  8 migrations SQL
docs/                 4 documents
```

Vérifications exécutées pendant l'audit :

```
npm run typecheck   → 0 erreur
npm run lint        → 0 erreur
npm test            → 9 suites, 263 tests, 263 passés (8,0 s)
```

## 2. Framework et versions

| Paquet | Version installée | Exigé par ColorLens §7 |
|---|---|---|
| Expo SDK | 57.0.22 | ✅ |
| React Native | 0.86.3 | ✅ |
| React | 19.2.3 | — |
| TypeScript | 6.0.3 (mode strict) | ✅ |
| Expo Router | 57.0.21 | ✅ |
| expo-camera | 57.0.5 | ✅ |
| expo-image-picker | 57.0.17 | ✅ |
| expo-sharing | 57.0.19 | ✅ |
| @supabase/supabase-js | 2.116.0 | ✅ |
| react-native-svg | 15.15.4 | — (utile, voir §4) |
| react-native-view-shot | 5.1.0 | — (export PNG) |
| **TanStack Query** | ❌ absent | demandé |
| **Zustand** | ❌ absent (Context utilisé à la place, ce que le §7 autorise) | « Zustand ou Context » |
| **Reanimated** | ❌ absent du projet | demandé |
| **Gesture Handler** | ❌ absent du projet | demandé |
| **expo-file-system** | ❌ absent du projet | demandé |

### Découverte importante : ce qu'Expo Go contient déjà

Contrainte du projet depuis le début : n'utiliser que des modules natifs embarqués dans
Expo Go, pour pouvoir tester sur iPhone sans compte Apple Developer payant. J'ai
re-vérifié `node_modules/expo/bundledNativeModules.json` contre les besoins ColorLens :

| Module | Dans Expo Go | Ce qu'il débloque pour ColorLens |
|---|---|---|
| `@shopify/react-native-skia` | ✅ **2.6.2** | **Recoloration par masques, compositing GPU, filtres, export d'image.** C'est la brique qui rend le Studio faisable. |
| `react-native-reanimated` | ✅ 4.5.1 | Animations du splash, pager d'onboarding, curseur avant/après |
| `react-native-gesture-handler` | ✅ ~2.32.0 | Sélection de zone au doigt, curseur avant/après, pincer-zoomer |
| `expo-file-system` | ✅ ~57.0.7 | Cache local des modèles, suppression des fichiers temporaires (§11) |
| `expo-image` | ✅ ~57.0.5 | Lazy loading, miniatures, cache disque (§11) |
| `expo-media-library` | ✅ ~57.0.5 | Enregistrer un export dans la pellicule |
| `expo-gl` | ✅ ~57.0.2 | Contexte OpenGL → three.js possible pour la phase 3D (§14) |
| `react-native-svg` | ✅ 15.15.4 | Modèles vectoriels, masques, dégradés, filtres `<Fe*>` |
| `expo-three` | ❌ absent | non bloquant : `three` est du JS pur, `expo-gl` fournit le contexte |

**Conséquence :** contrairement au Live Color temps réel (qui reste impossible, voir
`docs/LIMITATIONS.md`), **le Color Studio ne nécessite pas de development build.** Aucun
compte Apple Developer à 99 $/an n'est requis pour la fonction différenciante de
ColorLens.

## 3. Navigation

Actuel — **7 onglets** :

```
Accueil · Scanner · Palettes · Créer · Collection · Communauté · Profil
```

ColorLens §3 — **5 onglets** :

```
Accueil · Scanner · Créer · Explorer · Profil
```

Modales existantes : `result`, `tap`, `compare`, `moderation`, `auth/sign-in`,
`auth/sign-up`.

**Problèmes relevés :**

- **7 onglets, c'est trop.** Sur un iPhone SE (375 pt), 7 libellés dans la tab bar
  donnent des textes tronqués. Le §13 interdit explicitement qu'un texte dépasse ou
  qu'un bouton soit coupé. C'est le défaut d'ergonomie le plus visible du projet.
- Pas de **Splash** (page 1), pas d'**Onboarding** (page 2), pas de **Paramètres**
  (page 24) — ces routes n'existent pas.
- Pas de bouton central « + » (§3).
- « Communauté » et « Modération » ne correspondent à aucune page ColorLens : ce sont des
  restes du produit précédent (base communautaire de noms de couleurs votés). **Ils ne
  doivent pas être supprimés sans décision de ta part** (§13 : « ne pas supprimer une
  fonctionnalité existante sans justification »).

## 4. Écrans existants, comparés aux 24 pages ColorLens

| # | Page ColorLens | État | Fichier |
|---|---|---|---|
| 1 | Splash | ❌ absent | — |
| 2 | Onboarding | ❌ absent | — |
| 3 | Accueil | 🟡 partiel — couleur du jour, actions rapides, récents ; manque header/avatar, « continuer votre création », inspirations | `app/(tabs)/index.tsx` |
| 4 | Scanner / caméra | 🟡 partiel — aperçu, viseur, flash, bascule, capture, galerie ; manque zoom, verrouillage, aperçu temps réel (impossible en Expo Go) | `app/(tabs)/scan.tsx` |
| 5 | Importation et analyse d'image | ✅ couvert — import, sélection de zone au doigt, couleur moyenne/dominante, palette auto avec proportions réelles | `app/tap.tsx`, `src/domain/photoPalette.ts` |
| 6 | Détail de la couleur | 🟡 partiel — HEX/RGB/HSL/HSV/LAB, confiance, harmonies, copie, sauvegarde, partage ; **manque CMYK, température chaude/froide, « appliquer à un objet »** | `app/result.tsx`, `src/components/ColorLab.tsx` |
| 7 | Palette associée | 🟡 partiel — 15 schémas d'harmonie, 10 styles × 3/5/8/12 ; **manque interprétation esthétique et usages suggérés** | `app/(tabs)/palettes.tsx`, `src/domain/palette.ts` |
| 8 | Color Lab / création | 🟡 partiel — comparaison, niveaux de détail ; **manque mélange A/B, ratio, éclaircir/assombrir, « surprise me », historique** | `src/components/ColorLab.tsx`, `app/compare.tsx` |
| 9 | Bibliothèque d'objets | ❌ absent | — |
| 10 | Détail de l'objet | ❌ absent | — |
| 11 | **Color Studio** | ❌ absent | — |
| 12 | Éditeur par zones | ❌ absent | — |
| 13 | Matériaux et rendu | ❌ absent | — |
| 14 | Visualisation 3D | ❌ absent (explicitement hors MVP par le §14 lui-même) | — |
| 15 | Variantes automatiques | ❌ absent | — |
| 16 | Color Story | ❌ absent | — |
| 17 | Aperçu avant/après | ❌ absent | — |
| 18 | Sauvegarde de création | ❌ absent | — |
| 19 | Export et partage | 🟡 partiel — 4 modèles × 5 formats sociaux, PNG, partage natif ; **manque JPG/WebP, export JSON/CSS/variables de design** | `app/(tabs)/create.tsx`, `src/components/ShareCard.tsx` |
| 20 | Collections | 🟡 partiel — une seule liste plate « ma collection » avec recherche ; **pas de collections nommées, ni réorganisation, ni public/privé** | `app/(tabs)/collection.tsx` |
| 21 | Explorer | 🟡 partiel — classement communautaire de noms votés, filtres par famille ; **pas de créations, ni thèmes, ni créateurs** | `app/(tabs)/community.tsx` |
| 22 | Détail d'une création publique | ❌ absent | — |
| 23 | Profil | 🔴 très incomplet — courriel, date, déconnexion, suppression ; **pas d'avatar, ni bio, ni créations, ni statistiques** | `app/(tabs)/profile.tsx` |
| 24 | Paramètres | ❌ absent — quelques actions de compte sont dans Profil | — |

**Décompte : 0 page complète, 9 partielles, 15 absentes.** Les pages 9 à 15, 17, 18 et
22 — le cœur produit de ColorLens — représentent à elles seules la majorité du travail
restant.

## 5. Composants

| Composant | Réutilisable pour ColorLens |
|---|---|
| `PrimaryButton` | ✅ à passer en boutons capsule (§5) |
| `ColorSwatch`, `CodeRow` | ✅ tels quels |
| `PaletteStrip`, `HarmonyPalette` | ✅ tels quels |
| `ConfidencePanel` | ✅ tel quel (honnêteté de la mesure) |
| `ColorLab` | 🟡 à étendre (mélange A/B, variantes) |
| `ShareCard` | 🟡 base d'export solide, à généraliser aux créations |
| `EmptyState`, `ErrorBanner` | ✅ mais insuffisants pour les 19 états du §10 |

**Manquant pour ColorLens :** carte objet, grille de catégories, sélecteur de zones,
sélecteur de matériaux, curseur avant/après, bandeau de variantes, carte de création,
carte de collection, pastille d'état/chargement, feuille modale (bottom sheet).

## 6. Services

| Module | Rôle | Verdict |
|---|---|---|
| `src/lib/supabase.ts` | Client, session persistée via AsyncStorage | ✅ conserver |
| `src/lib/collectionApi.ts` | Couleurs sauvegardées | 🟡 à étendre |
| `src/lib/communityApi.ts` | Couleurs, propositions, votes | 🟡 conserver, hors périmètre ColorLens |
| `src/lib/moderationApi.ts` | File de modération | 🟡 conserver |
| `src/lib/extractColor.ts` | Décodage PNG + pipeline d'analyse | ✅ conserver |
| `src/lib/pixels.ts` | Base64 → octets, recadrage, couleur dominante | ✅ conserver |

**Manquant :** aucun service pour palettes, objets, créations, collections nommées,
likes, ni pour Supabase Storage (upload d'images source et d'aperçus).

## 7. Connexion Supabase

- Configuration par variables d'environnement `EXPO_PUBLIC_SUPABASE_URL` /
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`, lues depuis `.env.local` (ignoré par Git — aucun
  secret dans le dépôt).
- Échec bruyant au build de production si elles manquent ; valeurs de remplacement en
  développement pour que l'app démarre sans backend.
- Session persistée, rafraîchissement automatique du jeton.

🔴 **Point critique : la connexion n'a jamais été vérifiée contre un vrai projet
Supabase.** Cet environnement n'a pas de projet, et les migrations n'ont jamais été
appliquées. Tout le code réseau est donc typé et compilé, mais **non exécuté**. C'est,
avec le test sur appareil réel, la vérification la plus importante qui reste — et elle
te revient (voir `supabase/README.md`).

## 8. Tables et types

Existant (8 migrations) : `profiles`, `colors`, `color_names`, `votes`, `saved_colors`,
`reports`, `rate_limits`, + vue `color_name_rankings`, + RPC `delete_own_account`. RLS
activée partout, anti-spam à 20 propositions/heure appliqué côté serveur.

Face au §9 de ColorLens :

| Table ColorLens | État |
|---|---|
| `profiles` | 🟡 existe — manque `bio` ; `username` et `avatar_url` présents |
| `colors` | 🔴 **conflit de modèle** — voir ci-dessous |
| `palettes` | ❌ à créer |
| `palette_colors` | ❌ à créer |
| `objects` | ❌ à créer |
| `creations` | ❌ à créer |
| `collections` | ❌ à créer |
| `collection_items` | ❌ à créer |
| `likes` | ❌ à créer |

**Le conflit `colors`.** Dans le projet actuel, `colors` est un **catalogue communautaire
partagé** : une ligne par teinte distincte, dédoublonnée par proximité perceptuelle, que
la communauté nomme et vote. Dans ColorLens §9, `colors` est une **table personnelle** :
`user_id`, `is_public`, `source_image_url`, une ligne par couleur capturée par un
utilisateur. Ce sont deux choses différentes qui portent le même nom.

Les fusionner casserait le vote communautaire (§13 l'interdit sans justification). Ma
recommandation : **renommer l'existant `community_colors`** et créer la table `colors`
personnelle de ColorLens, les deux reliées par une clé étrangère optionnelle. `saved_colors`
devient alors redondante et sera migrée vers `colors` sans perte. C'est un point de
décision explicite dans le plan.

## 9. Fonctionnalités simulées

**Aucune trouvée.** Recherche de `TODO`, `FIXME`, `mock`, `fake`, `placeholder` : les
seules occurrences sont des `placeholder=` de champs de saisie et les valeurs de repli
Supabase en développement. Aucun bouton décoratif, aucune donnée inventée, aucune
statistique fabriquée. C'est une base saine pour repartir.

Deux nuances honnêtes :

- L'onglet Communauté sera **vide** tant qu'aucun projet Supabase n'est connecté — ce
  n'est pas une simulation, mais l'écran doit le dire clairement (il affiche un état vide).
- La couleur du jour tire dans une base de **37 références seulement** : elle se répète
  souvent sur un mois. Documenté dans `docs/LIMITATIONS.md` §5.

## 10. Erreurs TypeScript

**0.** `tsc --noEmit` en mode strict passe sans erreur. ESLint également.

Dette assumée signalée : `createClient` n'est pas paramétré par le type `Database`, à
cause des types de résolution de schéma de la version épinglée de `@supabase/supabase-js`.
Les types réels sont appliqués à la frontière, dans `src/lib/*Api.ts`. À corriger en
générant les types avec `supabase gen types typescript` une fois un vrai projet créé.

## 11. Problèmes de responsive design

Contrôlés contre la liste du §13. Résultats :

| Problème | Où | Gravité |
|---|---|---|
| **Le clavier masque les champs** — aucun `KeyboardAvoidingView` dans tout le projet | `auth/sign-in.tsx`, `auth/sign-up.tsx`, `result.tsx` (étiquette + proposition de nom), `collection.tsx` (recherche) | 🔴 violation directe du §13 |
| **Aucun écran ne s'adapte à la largeur** — zéro `useWindowDimensions`/`Dimensions` dans le projet | partout | 🟠 rendu identique sur iPhone SE et iPad, marges perdues sur grand écran |
| **Écrans non scrollables** | `profile.tsx`, `scan.tsx` (états de permission), `sign-in.tsx`, `sign-up.tsx` | 🟠 contenu coupé en police agrandie (accessibilité) ou en paysage |
| **7 onglets dans la tab bar** | `(tabs)/_layout.tsx` | 🔴 libellés tronqués sur petit écran |
| **Tailles d'export en pixels fixes** | `ShareCard.tsx` | 🟠 à valider sur appareil |
| **Pas de gestion du `safe-area` par écran** | `SafeAreaProvider` est monté, mais aucun écran n'utilise `useSafeAreaInsets` | 🟠 risque de chevauchement avec l'encoche / la barre de gestes |

## 12. Écrans incomplets

Classés par écart avec ColorLens :

1. 🔴 **Profil** (`profile.tsx`, 89 lignes) — c'est un écran de gestion de compte, pas un
   profil. Manque avatar, nom d'utilisateur, bio, créations, collections, statistiques
   (§23). Les actions de compte doivent partir dans Paramètres (§24).
2. 🔴 **Scanner** — pas de zoom, pas de verrouillage de couleur, pas d'aperçu temps réel
   (ce dernier restant impossible en Expo Go).
3. 🟠 **Accueil** — pas de header avec avatar, pas de « continuer votre création » (rien
   à continuer aujourd'hui), pas d'inspirations.
4. 🟠 **Détail couleur** — pas de CMYK, pas de température, et surtout **pas de
   « appliquer à un objet »** : c'est le lien qui fait exister ColorLens.
5. 🟠 **Collection** — liste plate, pas de vraies collections.
6. 🟠 **Explorer** — classement de noms, pas de créations.

---

## Le point de décision que je ne peux pas trancher seul : les images des mockups

Le §6 demande 25 modèles (5 t-shirts, 5 sneakers, 3 voitures, 3 sacs, 3 fauteuils,
3 montres, 3 objets de déco), chacun avec image de base, masques de zones, ombres,
lumières, texture, métadonnées, miniature et image de prévisualisation — soit environ
**175 fichiers images**.

**Je peux écrire le moteur de recoloration. Je ne peux pas produire de photographies
d'objets.** Je n'ai ni générateur d'images, ni accès à une banque de mockups sous licence.

Trois voies possibles, détaillées et chiffrées dans `docs/COLORLENS_PLAN.md` :

- **A — Modèles vectoriels que j'écris moi-même.** Je dessine chaque objet en chemins SVG,
  une zone par chemin, avec des dégradés pour les ombres et les lumières. Disponible
  immédiatement, 100 % hors ligne, recoloration instantanée et exacte. Rendu stylisé, pas
  photoréaliste.
- **B — Mockups photographiques que tu fournis.** Rendu réaliste conforme au §6. Tu
  sources ou commandes les images et leurs masques ; je construis le compositeur Skia qui
  les consomme. Bloqué tant que les images n'existent pas.
- **C — Les deux (ma recommandation).** Un seul format de modèle, un seul moteur de rendu,
  deux sources. On livre avec des modèles vectoriels pour que le Studio soit utilisable
  dès le premier lot, et chaque mockup photographique que tu fournis se branche ensuite
  sans toucher au code.

---

## Ce que je recommande de ne pas supprimer

Conformément au §13 (« ne pas supprimer une fonctionnalité existante sans
justification ») :

- **Le moteur couleur** (`src/color-engine/`, 18 modules, 173 tests) — il fournit
  exactement ce que le §8 exige du Color Engine déterministe, et il est vérifié contre
  les 34 paires de référence publiées de Sharma, Wu & Dalal pour CIEDE2000.
- **Le domaine** (`src/domain/`, 11 modules) — harmonies, palettes, contraste WCAG,
  daltonisme, comparaison : tout est directement réutilisable pages 6, 7, 8, 15.
- **L'authentification, la RLS, l'anti-spam, la suppression de compte** — conformes au §11
  et au droit à l'effacement.
- **La communauté de noms votés** — hors périmètre ColorLens, mais fonctionnelle. Je
  propose de la conserver derrière l'onglet Explorer plutôt que de la jeter. **À valider
  par toi.**
