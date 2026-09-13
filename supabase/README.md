# Supabase — ColorLens

Ce dossier contient le schéma complet (MVP1 → MVP3) de la base de données, en migrations SQL
ordonnées. Aucune donnée d'exemple ni secret n'est inclus.

## Tables

### ColorLens (§9)

- `colors` — les couleurs capturées par un utilisateur (`user_id`, `hex`, `rgb`/`hsl`/`hsv`/`lab`,
  `source_type`, `uncertainty`, `is_public`). **Privée par défaut.**
- `palettes` + `palette_colors` — palettes enregistrées et leurs couleurs ordonnées
- `objects` — catalogue des modèles d'objets recolorables (contenu du projet, en lecture seule
  depuis l'app) ; `object_favorites` pour les favoris par utilisateur
- `creations` — un objet recoloré, avec `project_data` (l'état complet du Studio) ; `likes` et la
  vue `creation_like_counts`
- `collections` + `collection_items` — collections nommées, hétérogènes (couleurs, palettes,
  créations)
- `profile_stats` (vue) — statistiques de profil calculées à la lecture

### Communauté de noms votés (conservée)

- `profiles` — profil public lié à `auth.users` (créé automatiquement à l'inscription)
- `community_colors` — couleurs canoniques découvertes par la communauté (dédoublonnage par
  proximité perceptuelle). **Renommée depuis `colors`** : ColorLens §9 réserve ce nom à la table
  personnelle. Voir `20260913100000_colorlens_rename_community.sql`.
- `color_names` — noms proposés pour une couleur, avec statut de modération
- `votes` — un vote (+1/-1) par utilisateur et par nom proposé
- `color_name_rankings` (vue) — classement des noms approuvés par score net
- `reports` — signalements de contenu (couleur, nom, profil) pour la modération

`saved_colors` a été **migrée puis supprimée** : son contenu vit désormais dans `colors`.
La migration copie les lignes avant de supprimer la table, donc aucune donnée n'est perdue.

### Vues et RLS

Les trois vues (`color_name_rankings`, `creation_like_counts`, `profile_stats`) sont déclarées en
`security_invoker = on`. Sans cela une vue s'exécute avec les droits de son propriétaire et
**contourne la RLS** des tables sous-jacentes — les couleurs privées d'un autre utilisateur
seraient comptées dans ce que tu peux lire.

Row Level Security (RLS) est activé sur **toutes** les tables : un utilisateur non authentifié ne
voit que le contenu public/approuvé, un utilisateur authentifié ne modifie que ses propres
données, et les actions de modération sont réservées aux profils `role in ('moderator','admin')`.

## Protection anti-abus intégrée

- Une seule ligne par `(voter_id, color_name_id)` empêche les votes multiples.
- Un déclencheur (`enforce_submission_rate_limit`) limite chaque utilisateur à 20 propositions
  (couleurs ou noms) par heure, appliqué côté serveur (impossible à contourner depuis le client).
- Les noms et couleurs restent au statut `pending`/non publiés tant qu'un modérateur ne les a pas
  approuvés (`color_names.status`).

## Promouvoir un modérateur

Il n'y a volontairement aucune interface dans l'app pour changer le rôle d'un compte (éviter
qu'un utilisateur puisse se l'attribuer lui-même). Pour donner accès à l'écran de modération de
l'app à un compte existant, exécute dans l'éditeur SQL Supabase :

```sql
update public.profiles set role = 'moderator' where id = '<uuid-du-compte>';
```

L'`id` correspond à l'UUID visible dans **Authentication → Users**.

## Suppression de compte (§12, Loi 25)

La fonction `delete_own_account()` est appelable via
`supabase.rpc('delete_own_account')` depuis un client authentifié. Elle supprime la ligne
`auth.users`, ce qui entraîne en cascade la suppression du profil, de la collection privée, des
votes et détache (sans les supprimer) les couleurs/noms déjà publiés que d'autres utilisateurs
peuvent référencer.

## Comment appliquer ces migrations

Ceci nécessite un projet Supabase (à créer par l'utilisateur — voir
`docs/PRODUCT_DISCOVERY.md` §9 pour la répartition des responsabilités).

```bash
npm install -g supabase
supabase login
supabase link --project-ref <votre-project-ref>
supabase db push
```

Ou, sans CLI, coller le contenu de chaque fichier (dans l'ordre numérique) dans l'éditeur SQL du
tableau de bord Supabase.

## Buckets de stockage à créer

Les migrations ne créent pas les buckets (l'API Storage n'est pas du SQL). À créer dans
**Storage** du tableau de bord Supabase, avec ces réglages :

| Bucket | Accès public | Contenu |
|---|---|---|
| `sources` | ❌ privé | Photos d'origine d'une couleur capturée. Lecture par URL signée uniquement. |
| `previews` | ✅ public | Aperçus rendus des créations, pour qu'une création partagée s'affiche. |
| `avatars` | ✅ public | Photos de profil. |

Puis, pour chaque bucket, une politique qui restreint l'écriture au dossier de l'utilisateur
(`src/lib/storageApi.ts` préfixe chaque chemin par l'`user_id`, exprès pour que cette règle soit
un simple préfixe) :

```sql
create policy "Users write only in their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'sources' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read only their own sources"
  on storage.objects for select to authenticated
  using (bucket_id = 'sources' and (storage.foldername(name))[1] = auth.uid()::text);
```

Répète la politique d'écriture pour `previews` et `avatars` (leur lecture est publique par
configuration du bucket).

## Variables d'environnement requises côté application

Voir `.env.example` à la racine du projet — `EXPO_PUBLIC_SUPABASE_URL` et
`EXPO_PUBLIC_SUPABASE_ANON_KEY` uniquement (la clé anonyme est publique par design côté client ;
jamais la `service_role` key, qui ne doit vivre que côté serveur/Edge Functions).
