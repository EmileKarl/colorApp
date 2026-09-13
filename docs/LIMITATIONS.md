# Limites connues — ColorLens

Exigé par le §54 du spec produit. Ce document dit ce que l'application **ne fait pas**,
et pourquoi — pour qu'aucune décision ne repose sur une capacité supposée.

## 1. Limites imposées par Expo Go

L'application n'utilise que des modules natifs embarqués dans Expo Go, ce qui permet de
tester sur un téléphone sans compte développeur Apple payant. Ce choix a un coût :

| Fonctionnalité du spec | État | Raison |
|---|---|---|
| **Live Color temps réel (§6)** | ❌ non faisable | `expo-camera` n'expose aucun callback de frame (vérifié : seuls `onBarcodeScanned`, `onCameraReady`, `onMountError`…). `react-native-vision-camera`, qui fournit les frame processors, n'est pas dans `bundledNativeModules.json`. Nécessite un **development build**. |
| **Color Reel / vidéo (§32)** | ❌ non implémenté | L'encodage vidéo demande un module natif absent d'Expo Go. Même contrainte que ci-dessus. |
| **Loupe 2×/4×/8×/12× (§7)** | 🟡 partiel | Le viseur affiche la couleur échantillonnée agrandie, mais pas un zoom pixel de l'image : lire les pixels d'une vue à l'écran demanderait une capture par déplacement du doigt, trop coûteuse pour rester fluide. |
| **Export WebP (page 19)** | ❌ non disponible | `react-native-view-shot`, seul module de capture inclus dans Expo Go, n'encode qu'en PNG, JPG et WebM. Proposer un bouton WebP qui produirait un PNG serait pire que de ne pas le proposer. |

**En revanche, le Color Studio ne demande rien de plus.** `@shopify/react-native-skia` est
inclus dans Expo Go, ce qui rend la recoloration par masques possible sans development build —
contrairement au temps réel. Voir `docs/OBJECT_STUDIO.md`.

**Ce qu'il faudrait pour lever ces limites** : un development build (`eas build --profile
development`), qui suppose un compte Apple Developer à 99 $/an pour l'installer sur un
iPhone physique. À décider en fonction de la valeur réelle du temps réel pour le produit.

## 2. Limite fondamentale de la mesure

**L'erreur d'exposition est indétectable depuis une seule pastille de couleur.**

Une surface foncée photographiée 1,8× trop clair produit exactement les mêmes pixels qu'une
surface moyenne photographiée correctement. Aucun algorithme ne peut les distinguer.

Conséquences assumées :
- Le moteur ne descend jamais sous **3 ΔE00 d'incertitude annoncée**
  (`IRREDUCIBLE_UNCERTAINTY`).
- Un test dans `benchmark.test.ts` **affirme cette limite** plutôt que de la masquer.
- Seule une charte colorimétrique dans le cadre la lèverait — protocole décrit dans
  `docs/COLOR_ENGINE.md`.

Voir `docs/COLOR_ENGINE.md` pour les mesures détaillées : moyenne 3,79 ΔE00 sur le jeu
synthétique, mais 12–15 ΔE00 sur les cas sur/sous-exposés.

## 3. Fonctionnalités du spec non implémentées

| Section | Fonctionnalité | Pourquoi |
|---|---|---|
| — | Color Story **générative** | La Color Story déterministe est livrée : elle assemble des phrases à partir des mesures et reste modifiable. Une version rédigée par un modèle de langage demanderait une clé API, un coût par usage et un écran de consentement (§11) ; le réglage existe déjà, désactivé. |
| — | Psychologie des couleurs | Volontairement absente. « Le bleu inspire confiance » n'est ni mesurable ni universel ; l'affirmer serait inventer une expertise. |
| §14, §15, §16 | Color Match, Color Advisor | Les recommandations « vêtement / intérieur / maquillage » seraient inventées : aucune donnée ne les fonde. |
| §43 | Recherche en langage naturel | La recherche par famille, qualificatif et hex fonctionne hors ligne (`src/domain/search.ts`). Les requêtes libres du type « une palette pour du luxe » nécessiteraient un LLM. |
| §19 | Material Mode | Le squelette conceptuel existe (le moteur module déjà la confiance), mais sans données mesurées par matériau, un facteur de confiance par matériau serait arbitraire. |
| §25, §26, §27 | Éditeur de template, AutoLayout, Brand Kit | Le Create Studio livre 4 modèles × 5 formats en création rapide, conformément à la consigne « ne pas transformer l'application en Canva ». L'édition libre est un projet à part entière. |
| §34, §35 · page 21 | Tendances, couleurs populaires, créateurs, défis | Ces sections demandent une audience que l'application n'a pas. Les remplir avec des chiffres inventés serait fabriquer des statistiques. L'Explorer affiche à la place des thèmes composés — annoncés comme tels — et un état vide explicite. |
| page 14 | Visualisation 3D | Hors MVP par le §14 lui-même. L'architecture est prête (`model_3d_url`, liste de vues, `expo-gl` inclus dans Expo Go) mais rien n'est implémenté. |
| page 6 | Mockups photographiques | Le moteur de rendu les accepte (masques PNG, compositing Skia) ; **les images restent à produire ou à acquérir**. Voir `docs/COLORLENS_AUDIT.md`, décision 1. |
| §48 | Réseau social complet | Les abstractions existent (schéma Supabase avec profils, votes, modération) ; l'infrastructure sociale n'est pas construite, conformément au spec. |

## 4. Ce qui n'a pas été testé sur appareil réel

Tout ce qui touche au matériel n'a pu être vérifié que par le typage, les tests unitaires
et la construction du bundle — cet environnement n'a ni caméra ni simulateur :

- capture caméra, lampe torche, bascule avant/arrière ;
- extraction de couleur sur une vraie photo ;
- retour haptique ;
- partage natif et export d'image ;
- performance réelle du pipeline sur le thread JS d'un téléphone.

**C'est la vérification la plus importante qui reste à faire**, et elle t'appartient :
`npx expo start -c`, puis Expo Go.

## 5. Dette technique assumée

- **Base de couleurs de référence réduite** (~37 entrées). La couleur du jour se répète
  donc souvent. Élargir la base est la correction ; tirer une couleur au hasard donnerait
  des couleurs sans nom ni provenance, ce qui serait pire.
- **Les trois modèles d'objets sont dessinés en aveugle.** Leurs chemins SVG ont été écrits
  en coordonnées, sans jamais être affichés. Les tests vérifient leur cohérence (aucune
  couche ne référence une zone absente, aucune zone déclarée n'est jamais peinte) mais
  **pas leur allure**. Écran *Profil → Vérifier le rendu*.
- **Certains thèmes de l'Explorer ont des paires proches en vision daltonienne.** Une palette
  pastel ne peut pas être à la fois pastel et largement séparée. Ces cas sont **affichés**
  sur la carte du thème plutôt que masqués.
- **Poids de classification non appris.** Les pondérations de `colorMatcher.ts` viennent
  de principes, pas de données. Les calibrer sur des données synthétiques n'apprendrait
  que le simulateur.
- **Pas de tests de composants React.** Les tests couvrent la logique pure (263 tests) ;
  les écrans sont vérifiés par le typage et la construction du bundle, pas par des tests
  de rendu.
