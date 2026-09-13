# ColorLens — Product Discovery (Phase 0 & 1)

> Document d'origine, écrit quand le produit s'appelait Color Code et se limitait à
> la capture de couleur. Conservé pour l'historique des décisions ; le cahier des
> charges en vigueur est `docs/COLORLENS_AUDIT.md` et `docs/COLORLENS_PLAN.md`.

Statut : brouillon de décision, en attente de validation des points BLOQUANTS (voir section 8).
Dépôt : `EmileKarl/colorapp` — branche de travail `claude/color-code-app-455juh`.

## 1. Résumé de l'idée

Une application permettant de scanner/photographier une couleur, d'en extraire le code
(HEX/RGB/HSL), de la nommer, de la sauvegarder, de la partager, et — à terme — de bâtir une
base de données communautaire de couleurs nommées et votées.

## 2. Audit de faisabilité

| Dimension | Évaluation | Risque |
|---|---|---|
| Technique (extraction couleur) | Faisable avec une caméra de téléphone, **mais précision non professionnelle** (voir §3) | 🟡 |
| Technique (app mobile Android+iOS) | Faisable avec Expo/React Native, code partagé ~95% | 🟢 |
| Économique (MVP) | Réalisable à coût ~0$ sur paliers gratuits | 🟢 |
| Mobile (permissions caméra/photos) | Standard, bien documenté sur Expo | 🟢 |
| Compte développeur Apple/Google | Obligatoire, payant, identité personnelle requise | 🔴 (hors contrôle Claude Code) |
| Communauté (noms, votes, photos) | Nécessite modération dès le lancement public | 🟡→🔴 si lancé sans modération |
| Vie privée / Loi 25 (Québec) | Applicable si utilisateurs qc/canadiens ; consentement + droit de suppression requis | 🟡 |
| Scalabilité | Non prioritaire tant que < 10k utilisateurs | 🟢 |
| Dépendance API tierces | Aucune API tierce payante indispensable au MVP1 | 🟢 |

**Remise en question de la spécification (règle #26 — simplicité) :** la liste de fonctionnalités
du §28 du prompt correspond en réalité à un produit complet (MVP1 à MVP4 combinés), pas à un MVP.
Recommandation : lancer d'abord la boucle « scan → couleur → sauvegarde → partage », sans compte
ni communauté, pour valider que l'usage de base a de la valeur avant d'investir dans la modération
communautaire (spam, votes, contenus offensants), qui est le poste de risque et de coût le plus
élevé du projet.

## 3. Limites techniques du scan de couleur (obligatoire à communiquer, §29)

Une caméra de téléphone **ne mesure pas une couleur physique de façon fiable**. Facteurs qui
faussent le résultat : balance des blancs automatique, exposition automatique, éclairage ambiant
(température de couleur), ombres, reflets, matériau (mat/brillant/translucide), traitement JPEG du
capteur. L'app affichera donc la couleur **perçue par la caméra dans les conditions actuelles**, pas
une mesure colorimétrique certifiée (type spectrophotomètre). Une fonctionnalité de calibration
(carte de référence grise, guide d'éclairage) est proposée comme amélioration V2+, pas pour le MVP.

## 4. Définition produit

- **Problème** : il est difficile d'identifier, nommer et partager rapidement la couleur d'un objet réel.
- **Utilisateur cible (MVP)** : créateurs de contenu, designers amateurs, curieux — public
  Android/iOS grand public, marché initial Canada/Québec.
- **Proposition de valeur** : transformer n'importe quelle couleur du monde réel en un objet
  numérique nommé, codé et partageable en quelques secondes.

### Roadmap (proposée, ajustable après réponses du §8)

| Version | Contenu |
|---|---|
| **MVP1** | Scan/photo → extraction couleur → HEX/RGB/HSL → famille de couleur → sauvegarde locale → carte partageable (image). Pas de compte. |
| **MVP2** | Comptes (email + Apple/Google Sign-In), sauvegarde cloud, collections, partage natif (share sheet) |
| **MVP3** | Base communautaire : proposer un nom, détection de doublon (couleur existante), modération, votes |
| **MVP4** | Feed, profils publics, classements, gamification |
| **MVP5** | Fonctionnalités premium (limites de scans, palettes avancées, export haute résolution) |

### Hors MVP1 (explicitement exclu pour l'instant)

Comptes utilisateurs, communauté, votes, modération, feed social, génération automatisée de
formats TikTok/Instagram, paiements.

## 5. Stack technique proposée

| Composant | Choix | Justification |
|---|---|---|
| App mobile | **Expo (React Native) + TypeScript** | Un seul code base Android/iOS (+ web via Expo Web en option), écosystème caméra/image mature, builds gérés (EAS), pas besoin de Mac pour builder iOS |
| Extraction couleur | Traitement **côté client** (expo-image-manipulator + échantillonnage de pixels / quantification simple) | Pas de round-trip serveur, fonctionne hors-ligne, coût 0 |
| Backend (MVP2+) | **Supabase** (Postgres + Auth + Storage + RLS + Edge Functions) | Base relationnelle adaptée aux besoins communautaires futurs (dédoublonnage, classements), palier gratuit généreux, outil déjà connecté à cet environnement |
| Stockage fichiers | Supabase Storage | Intégré à l'auth/RLS, pas de service supplémentaire |
| Cartes partageables | Rendu client (react-native-view-shot) → PNG | Aucun coût serveur |
| CI/CD | GitHub Actions (lint, tests, typecheck) + EAS Build | Standard, gratuit pour l'usage prévu au démarrage |
| Monitoring/erreurs | Sentry (palier gratuit) — différé à MVP2 | Pas nécessaire tant qu'il n'y a pas d'utilisateurs externes |
| Paiements (futur) | RevenueCat + App Store/Play Billing | Différé à MVP5 |

## 6. Architecture (vue d'ensemble MVP1 → MVP2)

```
MVP1 (hors-ligne, sans backend)
[Caméra/Galerie] → [Extraction couleur locale] → [Écran résultat HEX/RGB/HSL]
        → [Stockage local (SQLite/AsyncStorage)] → [Génération carte PNG] → [Partage natif OS]

MVP2 (ajout backend)
[App Expo] → [Supabase Auth] → [Supabase Postgres: colors, users, collections]
                            → [Supabase Storage: photos, cartes]
                            → [Row Level Security: un utilisateur ne modifie que ses données]
```

## 7. Estimation de complexité et coûts

**Complexité (ordre de grandeur, pas un engagement de délai) :**
MVP1 = Petit/Moyen · MVP2 = Moyen · MVP3 = Moyen/Grand (modération) · MVP4 = Grand · MVP5 = Petit/Moyen.

**Coûts externes (règle #27) :**

| Service | Obligatoire ? | Coût | 100 utilisateurs | 1 000 utilisateurs | 10 000 utilisateurs |
|---|---|---|---|---|---|
| Compte Apple Developer | Oui, pour publier sur iOS | 99 $ US/an | 99 $/an | 99 $/an | 99 $/an |
| Compte Google Play | Oui, pour publier sur Android | 25 $ US une fois | 25 $ (unique) | 25 $ (unique) | 25 $ (unique) |
| Supabase | Non pour MVP1, oui pour MVP2+ | Gratuit puis 25 $/mois (Pro) | 0 $ | 0-25 $/mois | 25-100 $/mois |
| EAS Build (Expo) | Non (des alternatives locales existent) | Gratuit (limité) puis ~99 $/mois | 0 $ | 0 $ | 0-99 $/mois |
| Domaine (optionnel) | Non | ~12 $/an | 0-12 $ | 0-12 $ | 0-12 $ |
| Modération contenu (MVP3+) | Recommandé, non obligatoire | Pay-per-use, faible volume | ~0 $ | quelques $ | quelques dizaines de $ |

Alternative gratuite à EAS Build : builds locaux (gratuits mais plus lents, iOS nécessite un Mac).

## 8. Questions BLOQUANTES

Voir les questions posées directement dans la conversation (scope du MVP1, plateforme cible,
choix du backend, budget de départ). Le développement ne démarre qu'après ces réponses.

## 9. Ce que Claude Code peut automatiser vs ce que l'utilisateur doit faire

**Automatisable par Claude Code :** code (app, backend, migrations, tests, CI/CD), configuration
des builds (app.json/eas.json), brouillons de politique de confidentialité/CGU, textes de fiche
store, structure du dépôt et documentation.

**À faire par l'utilisateur (identité/paiement requis) :** création et paiement des comptes Apple
Developer et Google Play Console, création du compte Supabase (facturation), fourniture des clés
dans des variables d'environnement sécurisées (jamais commitées), soumission finale des builds sur
App Store Connect / Google Play Console, validation juridique finale de la politique de
confidentialité, décision de marque définitive (nom, disponibilité).
