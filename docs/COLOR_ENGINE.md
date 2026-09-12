# Moteur de détection de couleur — architecture et limites

Moteur de vision par ordinateur de Color App, dans `src/color-engine/`.
Écrit en TypeScript pur, **sans aucune dépendance** : il ne connaît ni React Native
ni Expo, ce qui est précisément ce qui permet de le tester dans Node contre les
données de référence publiées par la CIE.

## Avertissement sur la précision — à lire en premier

Ce document ne revendique **aucune précision de 95 %**, et le code non plus.

Les chiffres du benchmark ci-dessous sont mesurés contre un **simulateur de caméra**,
pas contre un vrai capteur. Ils prouvent que les mathématiques sont correctes et
protègent contre les régressions. Ils ne disent **rien** de la précision réelle,
parce qu'un capteur physique a une réponse spectrale, un dématriçage, une
courbe tonale et un traitement propriétaire que le simulateur ne reproduit pas.

Toute affirmation de précision destinée aux utilisateurs devra venir du protocole
ColorChecker décrit en fin de document — jamais du jeu synthétique.

## Pipeline

```
Image
  ↓ ROI centrée (viseur à l'écran)
  ↓ Qualité d'image (exposition, bruit, netteté, écrêtage)
  ↓ Estimation de l'illuminant sur le POURTOUR uniquement
  ↓ Correction (Shades of Gray, p=6) en lumière linéaire
  ↓ sRGB → linéaire → XYZ → CIELAB
  ↓ Rejet d'aberrants (MAD par canal + distance perceptuelle ΔE00)
  ↓ k-means déterministe en Lab, k choisi automatiquement
  ↓ Fusion de 3 estimateurs (médiane, histogramme, cluster)
  ↓ Classification ΔE2000 contre la base de référence
  ↓ Score de confiance + incertitude
```

## Modules

| Dossier | Rôle |
|---|---|
| `color-spaces/` | sRGB (linéarisation), XYZ (+ adaptation chromatique Bradford), CIELAB/LCh, HSV |
| `metrics/` | ΔE76, ΔE94, **ΔE2000** |
| `capture/` | Score de qualité d'image (Immerkær pour le bruit, variance du laplacien pour la netteté) |
| `correction/` | Gray World, White Patch, Shades of Gray, application des gains |
| `segmentation/` | ROI, pourtour, rejet d'aberrants (MAD, IQR, distance perceptuelle) |
| `analysis/` | k-means déterministe, estimateurs de couleur dominante |
| `classification/` | Base de couleurs de référence, matcher ΔE2000 |
| `confidence/` | Score de confiance et incertitude |
| `pipeline/` | `analyzeColor(image, options)` |

## Validation

**ΔE2000 est vérifié contre les 34 paires de test publiées** par Sharma, Wu &
Dalal (2005), à 4 décimales près. C'est la référence qui permet d'affirmer qu'une
implémentation CIEDE2000 est correcte — la plupart échouent sur le terme de
rotation de teinte dans la région des bleus. Les valeurs Lab des primaires sRGB
sont également vérifiées contre les valeurs publiées.

## Résultats du benchmark (jeu synthétique, 108 cas)

```
moyenne ΔE00 :       3.79
médiane ΔE00 :       0.41
95e centile ΔE00 :  15.86
précision famille : 95.4 %
```

Par condition (moyenne ΔE00) :

| Condition | ΔE00 | Lecture |
|---|---|---|
| idéal | **0.00** | exact |
| reflets spéculaires | **0.00** | le rejet d'aberrants les élimine complètement |
| ombres | **0.00** | idem |
| dominante tungstène | 0.26 | la constance chromatique fonctionne |
| bruit | 0.75 | les statistiques robustes absorbent le bruit |
| dominante ombre bleutée | 0.91 | |
| combiné | 5.71 | |
| **surexposé** | **11.99** | voir ci-dessous |
| **sous-exposé** | **14.52** | voir ci-dessous |

Reproduire : `npm test -- benchmark`.

## Deux corrections importantes trouvées par le benchmark

Ces deux défauts étaient invisibles à la lecture du code et n'ont été révélés
que par la mesure.

**1. Estimation circulaire de l'illuminant.** L'illuminant était estimé sur
l'image entière, pastille mesurée comprise. La pastille tirait la moyenne de la
scène, l'estimateur y voyait une dominante colorée, et la correction repoussait
la mesure loin de la vérité. Symptôme : une capture *idéale* n'était pas meilleure
qu'une capture sous forte dominante tungstène. Correction : estimer uniquement
sur le pourtour.

**2. Absence de bande de garde.** Même en excluant la ROI, le sujet déborde du
viseur, et la norme de Minkowski (p=6) pondère fortement les valeurs élevées :
un mince liseré orange suffisait à produire un gain rouge de 0,45 sur un fond
parfaitement neutre, soit ~18 ΔE00 d'erreur. Correction : exclure aussi une bande
de garde de 1,8× la ROI.

Après ces deux corrections : moyenne 7,69 → 3,79, médiane 4,40 → 0,41.

## Limite fondamentale : l'exposition n'est pas observable

C'est la limite la plus importante du moteur, et elle n'est **pas** corrigeable
par un meilleur algorithme.

Une surface foncée photographiée 1,8× trop clair produit exactement les mêmes
pixels qu'une surface moyenne photographiée correctement. Aucune analyse ne peut
les distinguer : tous les signaux internes du moteur (uniformité, accord entre
estimateurs, netteté) restent parfaits pendant que l'erreur réelle dépasse
10 ΔE00.

Réponses apportées, plutôt que de prétendre le contraire :

1. **Plancher d'incertitude** (`IRREDUCIBLE_UNCERTAINTY = 3 ΔE00`) : le moteur
   n'annonce jamais une précision meilleure, parce qu'il ne peut pas la justifier.
2. **Test qui documente la limite** — `benchmark.test.ts` contient un test qui
   *affirme* que l'erreur d'exposition est indétectable. Ajuster les poids jusqu'à
   ce que la calibration paraisse bonne reviendrait à s'ajuster au benchmark, pas
   à corriger le moteur.
3. **Protocole de calibration** ci-dessous, qui rend l'exposition observable.

## Protocole de calibration (à faire par l'utilisateur)

La seule façon de dépasser le plancher d'incertitude est d'introduire dans le
cadre une surface de **réflectance connue**. Étapes :

1. Se procurer une charte colorimétrique (X-Rite ColorChecker Classic ou
   équivalent). C'est un achat physique — je ne peux pas le simuler.
2. Photographier la charte avec l'appareil à calibrer, sous au moins trois
   éclairages différents (lumière du jour, intérieur tungstène, ombre).
3. Extraire le Lab observé de chaque pastille et le comparer au Lab de référence
   fourni par le fabricant.
4. Ajuster une matrice de correction 3×3 (ou une régression polynomiale) par
   moindres carrés : `C_corrigé = M · C_observé`.
5. Stocker cette matrice comme profil d'appareil (`CameraProfile`).

**Non implémenté à ce jour, volontairement.** Écrire un ajusteur de matrice sans
une seule mesure réelle produirait du code non validé qui donnerait une fausse
impression de rigueur. Le module s'écrit en une session dès que les données
existent.

## Ce que le spec demandait et qui reste à faire

| Élément | État | Pourquoi |
|---|---|---|
| Espaces colorimétriques, ΔE, qualité, ROI, aberrants, clustering, classification, confiance | ✅ fait et testé | |
| Constance chromatique (Gray World / White Patch / Shades of Gray) | ✅ fait | Retinex non implémenté : gain marginal pour un coût de calcul élevé sur mobile |
| Dataset synthétique + benchmark | ✅ fait | |
| GMM | ❌ | k-means suffit pour des pastilles quasi uniformes ; un GMM coûte plus cher sans bénéfice démontré sur ce cas d'usage |
| Calibration caméra (matrice 3×3 / LUT) | ❌ | Nécessite une charte physique — voir protocole |
| Modèle bayésien, poids appris | ❌ | Nécessite un jeu de données étiqueté réel. Apprendre des poids sur des données synthétiques n'apprendrait que le simulateur |
| EXIF (ISO, vitesse, balance des blancs) | 🟡 structure prête | `takePictureAsync({ exif: true })` est disponible sans dépendance ; les champs sont transportés dans le résultat mais n'influencent pas la mesure, faute de données pour justifier une pondération |
| Météo / localisation | ❌ | Conformément au §27 du spec : le contexte environnemental ne doit corriger une estimation que lorsque les données démontrent un gain. Ces données n'existent pas encore |

## Contraintes respectées

- **Aucune dépendance ajoutée** pour le moteur (calcul pur).
- **Déterministe** : mêmes pixels → même réponse, toujours (k-means à graine fixe).
- **Hors ligne** : aucun appel réseau, aucune métadonnée requise.
- **Testable sans React Native** : 195 tests tournent dans Node.
- **Rapide** : analyse sur une image réduite à 96 px de large, k-means sur
  ~1500 pixels, quelques millisecondes sur le thread JS.
