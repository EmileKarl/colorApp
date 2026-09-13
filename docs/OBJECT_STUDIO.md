# Moteur de rendu d'objet

Comment ColorLens applique une couleur capturée à un objet, et pourquoi de cette façon.
Référence : §6, §13 et §15 du cahier des charges.

## Le principe

Le §6 exige que la recoloration **préserve les ombres, les lumières, les textures et les
volumes**. Un objet n'est donc jamais peint en aplat. Chaque zone est composée de trois
couches :

```
teinte de base      la couleur de l'utilisateur, modulée par le matériau
+ côté ombré        la même couleur assombrie vers la lumière d'ambiance
+ côté éclairé      un reflet spéculaire, dont la couleur dépend du matériau
```

C'est **entièrement déterministe** : aucune IA générative n'intervient. Le §15 demande que
la forme, les volumes, les proportions et les zones soient préservés — avec une
recoloration par masques ils le sont *par construction*, ce qu'aucun modèle génératif ne
peut garantir.

## La règle qui compte le plus : métal contre non-métal

**Les métaux teintent leur reflet ; tout le reste, non.**

Un conducteur (or, cuivre, aluminium anodisé) réfléchit sa propre couleur, parce que sa
réflectance varie avec la longueur d'onde. Un diélectrique (coton, plastique, peinture,
verre) a un reflet quasiment incolore. C'est pourquoi une boule de plastique rouge a un
reflet **blanc**, alors qu'une boule de métal rouge a un reflet **rouge**.

C'est le paramètre `metallic` de `src/domain/materials.ts`, et c'est la façon la plus
visible de rater un mockup recoloré. Quatre tests l'assurent dans
`src/objects/__tests__/shading.test.ts`.

Le second paramètre qui compte est la rugosité. Elle ne change pas la *quantité* de
lumière réfléchie, mais son **étalement** : un miroir concentre le reflet en un point, de
l'acier brossé l'étale sur toute la surface.

## Deux décisions colorimétriques

**Tout se passe en LCh, jamais en RGB.** Multiplier les canaux sRGB par 0,7 pour
« assombrir » fait aussi dériver la teinte — les jaunes assombris tournent olive, les
cyans tournent bleu. Or la teinte est précisément ce que l'utilisateur est allé mesurer.

**Le hors-gamut est traité en réduisant le chroma, jamais en clampant les canaux.**
Assombrir une couleur saturée la fait sortir de ce que le sRGB sait afficher. Clamper
chaque canal à 0–255 les écrête inégalement et **fait tourner la teinte** : mesuré sur un
vert saturé, un assombrissement de 20 unités dérivait de plus de 4°. Une recherche
dichotomique sur le chroma ramène la couleur dans le gamut en conservant la teinte
exactement. Ce défaut a été trouvé par un test, pas par relecture.

**Les ombres ne sont jamais noires.** Une surface non éclairée l'est quand même — par le
remplissage, le ciel, les murs de la pièce. L'ombre est donc la couleur de base assombrie
*vers la couleur de la lumière d'ambiance*. C'est pourquoi les ombres en extérieur
paraissent bleues, et pourquoi peindre les ombres en gris est le signe classique d'un
rendu faux.

## Les deux types de modèle

Un seul format, deux sources — c'est ce qui permet au Studio d'exister avant qu'un seul
mockup photographique n'ait été produit.

| | Vectoriel | Photographique |
|---|---|---|
| Où | Dans le bundle de l'app | Table `objects` + Storage |
| Hors ligne | ✅ | ❌ téléchargé et mis en cache |
| Rendu | Stylisé, propre | Photoréaliste |
| Produit par | Le projet (chemins SVG) | À fournir (images + masques) |
| État | ✅ 3 modèles livrés | 🟡 code prêt, **aucun asset** |

Les deux se résolvent en un même `RenderPlan`, donc remplacer un modèle vectoriel par un
mockup photographique est une insertion de ligne en base, pas une modification de code.

### Format d'un mockup photographique

Si tu fournis des mockups, voici ce que le moteur consomme :

```
object/
  base_image.png     l'objet photographié, désaturé en luminance (les volumes)
  mask_body.png      un masque par zone — blanc dans la zone, noir ailleurs
  mask_collar.png
  shadows.png        les ombres à réappliquer
  highlights.png     les reflets spéculaires
  texture.png        le grain du matériau
  metadata.json      zones, matériaux, vues, dimensions
```

La composition appliquée est exactement celle du §6 :

```
résultat = couleur × luminance(base)   ← multiply, la couleur prend les volumes
         + highlights                   ← screen, les spéculaires restent blancs
         × texture                      ← multiply, le grain du matériau
```

## Pourquoi Skia, et pourquoi ça marche dans Expo Go

`@shopify/react-native-skia` 2.6.2 **est embarqué dans Expo Go**. Il fournit sur GPU
exactement les primitives nécessaires : masques par luminance, modes de fusion multiply et
screen, dégradés, filtres, et l'export du rendu en image.

**Aucun development build n'est requis.** Contrairement au Live Color temps réel, qui reste
impossible (voir `docs/LIMITATIONS.md`), le Color Studio tourne dans Expo Go.

Repli si Skia posait problème sur appareil : `react-native-svg`, également embarqué, avec
`<Mask>` et `mixBlendMode`. Moins performant, suffisant pour les modèles vectoriels.

## Ce qui est testé, et ce qui ne peut pas l'être

`src/objects/__tests__/shading.test.ts` — 40 tests. Ils couvrent l'arithmétique :
conservation de la teinte, gamut, couleur spéculaire selon le matériau, cast des ombres,
bornes des opacités sur **toutes** les combinaisons matériau × éclairage × réglages,
cohérence des modèles (aucune couche ne référence une zone absente, aucune zone déclarée
n'est jamais peinte), et la sérialisation d'un projet.

Deux défauts réels ont été trouvés par ces tests et corrigés :

1. La dérive de teinte de 4,5° au clamping hors-gamut, décrite plus haut.
2. Un utilisateur qui met « ombres » à 0 et « contraste » au minimum obtenait une opacité
   d'ombre de 0 — une silhouette parfaitement plate, sans volume. Le §6 l'interdit. Un
   plancher à 0,08 garantit que l'objet reste lisible comme objet.

**Ce qui n'est pas testé : l'apparence.** Un test peut vérifier que le reflet d'un métal
rouge est rouge ; il ne peut pas vérifier que le t-shirt ressemble à un t-shirt. Les trois
modèles vectoriels ont été dessinés à l'aveugle, en coordonnées, sans jamais être affichés.
**Il est probable qu'ils demandent des retouches une fois vus sur un écran.**

L'écran **Profil → Vérifier le rendu** existe pour ça : il affiche les trois objets avec un
sélecteur de couleur, de matériau et d'éclairage. C'est aussi le test de performance de
Skia sur ton appareil. À faire avant que le Studio ne soit construit par-dessus — si Skia
ne tient pas, mieux vaut le découvrir maintenant.
