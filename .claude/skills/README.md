# Skills installées

Skills tierces installées dans ce dépôt pour assister le travail de design.
**Ce ne sont pas du code applicatif** : rien ici n'entre dans le bundle de ColorLens.

## Provenance

| Dossier | Source | Version | Licence |
|---|---|---|---|
| `ui-ux-pro-max/`, `ui-styling/`, `design/`, `design-system/`, `brand/`, `slides/`, `banner-design/` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 2.13.0 | MIT |
| `impeccable/` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | 4.3.1 | Apache 2.0 |

Les deux dépôts sont en réalité des **plugins Claude Code** ; seul leur dossier
`.claude/skills/` a été copié ici.

## Deux choses à savoir

1. **`impeccable` télécharge et exécute un binaire.** Son lanceur
   (`impeccable/scripts/impeccable`) récupère un exécutable depuis les *GitHub releases*
   de `pbakaus/impeccable` au premier usage, et **vérifie son SHA-256 avant de l'exécuter**
   — il refuse de continuer si la somme ne correspond pas ou si aucun outil de hachage
   n'est disponible. Le binaire n'est pas committé ici.
2. **Certaines fonctions de `design/` demandent des clés d'API** (Gemini, Atlas Cloud,
   MuAPI pour la génération de logos et d'icônes). Sans clé, ces parties-là ne
   fonctionneront pas ; le reste de la skill oui.

## Ce qui est utile — et ce qui ne l'est pas — pour ColorLens

ColorLens est une application **React Native**. Certaines skills sont orientées web :

- ✅ **`impeccable`** — critique et polissage d'interface, indépendant de la plateforme.
- ✅ **`ui-ux-pro-max`** — inclut une base de données de stacks avec React Native.
- ⚠️ **`ui-styling`** (5,8 Mo) — construite autour de **shadcn/ui et Tailwind**, donc
  **web uniquement**. Sans usage ici. C'est le plus gros dossier : supprime-le si tu veux
  alléger le dépôt.
- ⚠️ **`design`, `brand`, `slides`, `banner-design`** — identité de marque, présentations,
  bannières. Utiles pour communiquer autour du produit, pas pour l'app elle-même.

## Outillage du projet

`.claude/` est exclu d'ESLint (`eslint.config.js`), de TypeScript (`tsconfig.json`) et de
Jest (`package.json`). Sans ces exclusions, le JavaScript minifié embarqué par les skills
produit une trentaine d'erreurs de lint et fait échouer la CI — des erreurs qui ne disent
rien sur ColorLens.

Vérifié après installation : lint propre, `tsc` propre, 401 tests verts, expo-doctor 21/21,
et le bundle iOS a **exactement le même hash** qu'avant l'installation.

## Mettre à jour

```bash
git clone --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git /tmp/uiux
cp -R /tmp/uiux/.claude/skills/. .claude/skills/

git clone --depth 1 https://github.com/pbakaus/impeccable.git /tmp/impeccable
cp -R /tmp/impeccable/.claude/skills/. .claude/skills/
```

Alternative sans alourdir le dépôt — installer en tant que plugins, mis à jour
automatiquement, hors du dépôt :

```
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin marketplace add pbakaus/impeccable
```

puis `/plugin install` pour chacun. Dans ce cas, supprime `.claude/skills/`.
