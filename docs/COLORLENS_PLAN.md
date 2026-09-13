# ColorLens — Plan de refonte

Suite de `docs/COLORLENS_AUDIT.md`. Exigé par le §13 du cahier des charges.

**Ce plan attend ta validation.** Rien n'a été implémenté. Trois décisions sont à
trancher avant le premier lot — elles sont regroupées à la fin du document.

---

## 1. Principe directeur

Le cahier des charges décrit un produit qui contient, en volume, à peu près deux fois ce
qui existe aujourd'hui. Le §13 impose d'implémenter **par lots, avec test après chaque
lot**. Je propose donc **9 lots**, chacun se terminant sur un état livrable et vérifié
(`npm test`, `npm run typecheck`, `npm run lint`, construction du bundle), plutôt qu'une
refonte simultanée de tout.

Ordre choisi selon un critère simple : **le Studio objet d'abord**, parce que c'est la
fonction différenciante, et parce que tout le reste (variantes, avant/après, sauvegarde,
Explorer, profil) en dépend. La marque, le splash et l'onboarding — qui sont visibles mais
peu risqués — viennent après, une fois qu'il y a quelque chose à montrer.

---

## 2. Décision technique : comment recolorer un objet

Le §6 exige que la recoloration **préserve les ombres, les lumières, les textures et les
volumes**. C'est le point technique central du projet.

### La méthode

Un mockup photographique se décompose en :

```
base_image.png    la photo de l'objet, désaturée en luminance (les volumes)
mask_body.png     un canal alpha par zone recolorable
mask_collar.png
shadows.png       les ombres à réappliquer par-dessus
highlights.png    les lumières spéculaires
texture.png       le grain du matériau (trame du coton, grain du cuir…)
metadata.json     zones, matériaux, vues, dimensions
```

La recoloration d'une zone est alors, par pixel :

```
résultat = couleur × luminance(base)      ← multiply : la couleur prend les volumes
         + highlights                      ← screen : les spéculaires restent blanches
         × texture                         ← multiply : le grain du matériau
appliqué uniquement là où mask = 1
```

C'est la technique standard des générateurs de mockups. Elle est **déterministe** — aucune
IA générative, donc aucune dérive de forme, ce qui satisfait mieux le §15 (« l'IA doit
préserver forme, volumes, proportions, zones, ombres ») que ne le ferait un modèle
génératif.

### Ce qui la rend possible dans Expo Go

`@shopify/react-native-skia` **2.6.2 est inclus dans Expo Go** (vérifié dans
`node_modules/expo/bundledNativeModules.json`). Skia fournit exactement les primitives
nécessaires, sur GPU :

| Besoin | Primitive Skia |
|---|---|
| Multiplier une couleur sur la luminance | `<Blend mode="multiply">` + `ColorMatrix` |
| Limiter à une zone | `<Mask>` avec le PNG de masque |
| Réappliquer lumières et ombres | `<Blend mode="screen">` / `"multiply"` |
| Matériaux (brillance, rugosité, métallique) | `ColorMatrix`, `Blur`, `Shader` |
| Éclairages (studio, néon, chaud, froid) | dégradés + `ColorMatrix` sur la composition |
| Exporter le rendu en PNG | `makeImageSnapshot()` → base64 |

**Aucun development build n'est nécessaire.** Contrairement au Live Color temps réel, qui
reste impossible, le Color Studio tourne dans Expo Go sur ton iPhone.

Repli si Skia posait problème sur appareil réel : `react-native-svg` (également embarqué)
avec `<Mask>` et `mixBlendMode`, moins performant mais suffisant pour des modèles
vectoriels. Je vérifierai Skia sur appareil dès le lot 2, avant d'y construire dessus.

### Ce qui reste bloqué : les images

Le moteur ci-dessus consomme des images que je ne peux pas produire. Décision 1, plus bas.

---

## 3. Les 9 lots

### Lot 0 — Fondations (aucune fonctionnalité visible)

- Ajouter `react-native-reanimated`, `react-native-gesture-handler`, `expo-file-system`,
  `expo-image`, `@shopify/react-native-skia` — toutes versions Expo Go.
- Étendre `src/theme.ts` : fond ivoire en clair, noir bleuté en sombre, surfaces,
  rayons de bordure, ombres discrètes, échelle typographique, accent dérivé de la couleur
  capturée (§5).
- Créer les composants de base manquants : `Screen` (safe-area + scroll +
  `KeyboardAvoidingView`, ce qui corrige d'un coup les 4 écrans où le clavier masque les
  champs), `Card`, `Sheet`, `Chip`, `Slider`, `StateView` (les 19 états du §10 : chargement,
  analyse, génération, sauvegarde, export, hors ligne, permission refusée, quota,
  liste vide… chacun avec explication, action corrective et bouton Réessayer).
- **Vérification :** typecheck, lint, tests, bundle. Aucune régression fonctionnelle.

### Lot 1 — Données et navigation

- Migrations SQL : `palettes`, `palette_colors`, `objects`, `creations`, `collections`,
  `collection_items`, `likes`, `colors` personnelle ; `bio` sur `profiles` ; RLS complète
  sur chaque table (privé par défaut, §11 : « publication jamais automatique »).
- Renommage `colors` → `community_colors` (décision 2), migration de `saved_colors` vers
  la nouvelle `colors` **sans perte de données**.
- Services : `paletteApi`, `objectApi`, `creationApi`, `collectionApi` étendu,
  `storageApi` (upload image source + aperçu, redimensionnement avant envoi, §11).
- Navigation ramenée à **5 onglets** : Accueil · Scanner · Créer (bouton central) ·
  Explorer · Profil. Palettes, Collection et Communauté deviennent des sections
  d'Explorer et de Profil — rien n'est supprimé (décision 3).
- **Vérification :** migrations appliquées sur un vrai projet Supabase (tâche partagée
  avec toi), navigation parcourue écran par écran, états vides contrôlés.

### Lot 2 — Moteur de rendu d'objet

Le cœur. Ne produit pas encore d'écran fini, mais rend le reste possible.

- Format de modèle : `src/objects/types.ts` — zones, masques, matériaux, vues,
  métadonnées ; un seul format acceptant **et** les modèles vectoriels **et** les mockups
  photographiques.
- `src/objects/renderer/` — le compositeur Skia décrit au §2 ci-dessus.
- `src/domain/materials.ts` — les 12 matériaux du §13 exprimés en paramètres de rendu
  (brillance, rugosité, métallique, opacité, relief) ; les 7 éclairages.
- Tests unitaires sur la partie pure : le calcul des paramètres de matériau, la
  composition des couches, la résolution des zones. Le rendu GPU lui-même se vérifie sur
  appareil.
- **Vérification prioritaire sur ton iPhone** avant de bâtir dessus.

### Lot 3 — Bibliothèque d'objets et Studio (pages 9, 10, 11, 12)

- Page 9 : grille par catégories (Mode, Chaussures, Automobile, Maison, Accessoires,
  Design), recherche, filtres, favoris, récemment utilisés, mini-aperçus.
- Page 10 : détail du modèle — zones, matériaux, vues, 2D/3D.
- Page 11 : **Color Studio** — prévisualisation, sélecteur de couleur/palette, sélection
  de zone, matériaux, rendu, annuler/rétablir, réinitialiser, enregistrer, exporter.
- Page 12 : éditeur par zones — couleur, texture, matériau, opacité, brillance, rugosité,
  métallique, relief par zone.
- Premiers modèles livrés : **t-shirt, sneaker, voiture** (les trois du MVP §12).
- **Vérification :** contrôle UI/UX page par page selon la liste du §13.

### Lot 4 — Variantes, avant/après, sauvegarde (pages 15, 17, 18)

- Variantes automatiques **déterministes** : Original, Monochrome, Sombre, Pastel,
  Premium, Contrasté, Sportif, Streetwear, Futuriste, Minimaliste — chacune est une
  transformation en LCh de la palette appliquée, construite sur `src/domain/harmony.ts`
  et `palette.ts` qui existent déjà. Les demandes « plus discret / plus luxueux / plus
  sportif… » sont les mêmes transformations, exposées en boutons.
- Curseur avant/après (Reanimated + Gesture Handler), zoom, capture.
- Sauvegarde d'une création : nom, image source, couleur, palette, objet, variantes,
  matériaux, arrière-plan, paramètres de rendu, tags, collection, privé/public, date.
  Dupliquer, modifier, exporter, partager, supprimer.

### Lot 5 — Couleur, palette et Lab complétés (pages 6, 7, 8)

- Détail couleur : ajouter CMYK approximatif (avec avertissement : sans profil ICC, c'est
  une conversion indicative, pas une épreuve d'impression), température chaude/froide/
  neutre, et surtout le bouton **« Appliquer à un objet »**.
- Palette : interprétation esthétique (chaleureuse, naturelle, luxueuse, sportive,
  futuriste, douce, minimaliste, énergique, vintage) **dérivée des mesures** — teinte
  moyenne, chroma, luminosité, écart entre couleurs — et non inventée. Usages suggérés
  idem, par règles explicites et documentées.
- Color Lab : mélange A/B avec curseur de ratio **en espace Lab** (un mélange en sRGB
  donne des teintes ternes — c'est une erreur classique que le moteur permet d'éviter),
  éclaircir/assombrir, saturer/désaturer, historique, favoris, « Surprise me ».

### Lot 6 — Collections, Explorer, création publique (pages 20, 21, 22)

- Collections nommées : créer, renommer, ajouter, supprimer, réorganiser, dupliquer,
  partager, public/privé.
- Explorer : créations publiques, collections thématiques, thèmes (Minimalisme, Luxe,
  Streetwear, Nature, Cyberpunk, Vintage, Tropical, Monochrome, Pastel, Futuriste), et la
  communauté de noms votés conservée en section.
- Détail d'une création publique + **Remixer** (reprendre une création et en changer
  couleurs, matériaux, arrière-plan, objet).
- **Réserve honnête :** « Couleurs populaires », « Palettes tendances », « Créateurs »,
  « Défis » exigent de vrais utilisateurs. Tant qu'il n'y en a pas, ces sections
  afficheront un état vide explicite. Je ne fabriquerai pas de statistiques.

### Lot 7 — Profil, paramètres, marque (pages 1, 2, 23, 24)

- Profil : avatar, nom d'utilisateur, bio, créations, collections, couleurs sauvegardées,
  public/privé, statistiques **réelles** (couleurs capturées, palettes créées, objets
  personnalisés, créations partagées, remixes, couleur la plus utilisée — toutes calculées
  depuis la base, aucune inventée).
- Paramètres : compte, apparence (clair/sombre/dynamique), langue, qualité de rendu,
  animations, notifications, confidentialité (autorisations, traitement local/serveur,
  suppression des images temporaires, projets privés/publics, consentement IA), stockage
  (cache, synchronisation, suppression des données locales).
- Renommage **Color Code → ColorLens** : `app.json`, `package.json`, README, écrans,
  icônes.
- Splash animé (point de couleur → palette → objet) et onboarding 4 écrans avec
  « Continuer sans compte ».

### Lot 8 — Export élargi et finitions (page 19)

- Formats : PNG, JPG, WebP, PNG transparent, fiche couleur, moodboard, fiche produit,
  story verticale, post carré, TikTok, Pinterest.
- Export de données : HEX, RGB, HSL, JSON, CSS, variables de design.
- Performance (§11) : compression, miniatures, lazy loading, pagination, cache,
  redimensionnement avant upload, suppression des fichiers temporaires.
- Passe finale de contrôle UI/UX sur les 24 pages selon la liste complète du §13, sur
  petit et grand écran.

---

## 4. Color Story et IA (page 16, §8)

Le §8 partage les rôles : le Color Engine calcule, l'IA raconte. Je propose de livrer en
deux temps :

- **Immédiat, sans IA, dans le lot 5 :** une Color Story construite à partir des faits
  mesurés — famille, température, chroma, luminosité, harmonie détectée, contraste,
  matériaux compatibles, usages. Le texte est assemblé par règles, il est vrai, il est
  modifiable par l'utilisateur (§16 le demande), et il ne coûte rien.
- **Plus tard, avec IA, si tu le décides :** des noms et descriptions génératifs
  nécessitent un appel réseau vers un modèle de langage, donc une clé API, un coût par
  usage, un écran de consentement (§11 « consentement IA ») et une Edge Function pour ne
  pas exposer la clé dans l'application. C'est un projet à part entière, à chiffrer
  séparément.

Dans les deux cas, et conformément au §8, **aucune valeur colorimétrique ne sera jamais
calculée par un modèle de langage** : le moteur déterministe garde ce rôle.

## 5. 3D (page 14)

Conformément au §14 lui-même (« pour le MVP, utiliser d'abord des mockups 2D réalistes »),
la 3D n'est dans aucun des 9 lots. Ce que je fais pour la préparer : le format de modèle
du lot 2 contient déjà `model_3d_url` et une liste de vues, et la table `objects` prévoit
le champ. `expo-gl` étant inclus dans Expo Go, `three` + `@react-three/fiber` restent
possibles sans development build le jour où tu voudras l'ajouter.

---

## 6. Ce qui reste impossible ou non prévu

Par honnêteté, et conformément au §29 du cahier des charges initial :

| Demande | État | Raison |
|---|---|---|
| Aperçu de couleur en **temps réel** sous le viseur (page 4) | ❌ impossible | `expo-camera` n'expose aucun callback de frame ; `react-native-vision-camera` n'est pas dans Expo Go. Nécessite un development build (compte Apple Developer, 99 $/an). Contournement prévu : capture instantanée → analyse en ~100 ms, ce qui donne une boucle très proche du temps réel. |
| Mockups **génératifs** par IA (§8) | ❌ non prévu | Un modèle génératif ne préserve pas la forme de l'objet, ce que le §15 exige explicitement. La recoloration par masques la préserve par construction. |
| Segmentation avancée par IA (§8) | ❌ non prévu | La segmentation actuelle (k-means + rejet d'aberrants) est mesurée et testée ; un modèle embarqué demanderait un development build. |
| Précision colorimétrique professionnelle | ❌ jamais promis | Incertitude irréductible de 3 ΔE00 sans charte de calibration. Voir `docs/LIMITATIONS.md` §2. |
| Tendances, défis, créateurs populaires | ⏳ en attente d'utilisateurs | Fabriquer ces chiffres serait mentir. |

---

## 7. Estimation

Ordre de grandeur, pas un engagement au jour près.

| Lot | Poids relatif | Livrable |
|---|---|---|
| 0 — Fondations | ▪ | Design system, composants d'état, clavier corrigé |
| 1 — Données et navigation | ▪▪ | 8 tables + RLS, 5 onglets, services |
| 2 — Moteur de rendu | ▪▪▪ | Compositeur Skia vérifié sur appareil |
| 3 — Bibliothèque + Studio | ▪▪▪▪ | La fonction différenciante, utilisable |
| 4 — Variantes, avant/après, sauvegarde | ▪▪ | Créations enregistrables |
| 5 — Couleur, palette, Lab | ▪▪ | Pages 6-7-8 complètes + Color Story |
| 6 — Collections, Explorer, remix | ▪▪ | Social de base |
| 7 — Profil, paramètres, marque | ▪▪ | ColorLens visible, splash, onboarding |
| 8 — Export et finitions | ▪ | Formats, performance, passe UI/UX |

Le lot 3 est le plus lourd et le plus incertain : son coût dépend entièrement de la
décision 1.

---

## 8. Les trois décisions que j'attends de toi

### Décision 1 — Les images des mockups (bloquante pour le lot 3)

| | A — Modèles vectoriels | B — Mockups photo | C — Les deux |
|---|---|---|---|
| Qui produit les images | moi | toi | moi d'abord, toi ensuite |
| Disponible | immédiatement | quand tu fournis | immédiatement, enrichi ensuite |
| Rendu | stylisé, propre, cohérent | photoréaliste | les deux coexistent |
| Coût | nul | achat ou commande de ~25 mockups + masques | nul au départ |
| Hors ligne | oui | non (téléchargement) | oui pour les vectoriels |
| Conforme au §6 à la lettre | non | oui | oui à terme |

**Ma recommandation : C.** Un seul format, un seul moteur, deux sources. Le Studio est
utilisable dès le lot 3 sans rien attendre de toi, et chaque mockup photographique que tu
ajoutes ensuite se branche sans modification du code. Si tu veux du photoréalisme dès le
départ, choisis B et indique-moi où tu comptes sourcer les images (banque sous licence,
graphiste, générateur) — je fournirai le gabarit exact de masques à respecter.

### Décision 2 — Le conflit sur la table `colors`

L'existant est un catalogue communautaire partagé ; ColorLens veut une table personnelle.
Ma recommandation : **renommer l'existant en `community_colors`**, créer la `colors`
personnelle de ColorLens, migrer `saved_colors` dedans sans perte. Alternative si la
communauté ne t'intéresse plus : supprimer purement le catalogue communautaire — mais le
§13 m'interdit de le décider seul.

### Décision 3 — Que faire de la communauté de noms votés

Elle fonctionne (proposition, modération, vote, classement, anti-spam) et n'apparaît nulle
part dans ColorLens. Trois options : **(a)** la garder en section de l'onglet Explorer —
ma recommandation ; **(b)** la garder mais la masquer derrière un réglage ; **(c)** la
retirer de l'application en conservant les migrations.

---

## 9. Ce que je ne peux pas vérifier moi-même

Rappel, parce que cela conditionne la valeur de tout ce qui précède :

- **Aucun projet Supabase n'est connecté.** Le code réseau compile mais n'a jamais tourné.
- **Rien n'a jamais été exécuté sur un appareil.** Cet environnement n'a ni caméra ni
  simulateur. Caméra, torche, haptique, partage natif, export, et — désormais crucial —
  **les performances de Skia sur le fil JS** restent à vérifier par toi.

La première chose que je ferai au lot 2, avant de construire le Studio dessus, sera de te
donner un écran de test Skia minimal à lancer sur ton iPhone. Si Skia ne tient pas ses
promesses sur ton appareil, mieux vaut le découvrir à ce moment-là qu'au lot 4.

---

**Dis-moi ce que tu valides — le plan tel quel, ou avec des changements — et tes réponses
aux trois décisions. Je commence au lot 0 dès ton accord.**
