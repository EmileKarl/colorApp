# Supabase — Color Code

Ce dossier contient le schéma complet (MVP1 → MVP3) de la base de données, en migrations SQL
ordonnées. Aucune donnée d'exemple ni secret n'est inclus.

## Tables

- `profiles` — profil public lié à `auth.users` (créé automatiquement à l'inscription)
- `colors` — couleurs canoniques découvertes par la communauté (dédoublonnage par hex)
- `color_names` — noms proposés pour une couleur, avec statut de modération
- `votes` — un vote (+1/-1) par utilisateur et par nom proposé
- `color_name_rankings` (vue) — classement des noms approuvés par score net
- `saved_colors` — collection privée d'un utilisateur (indépendante de la table communautaire)
- `reports` — signalements de contenu (couleur, nom, profil) pour la modération

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

## Variables d'environnement requises côté application

Voir `.env.example` à la racine du projet — `EXPO_PUBLIC_SUPABASE_URL` et
`EXPO_PUBLIC_SUPABASE_ANON_KEY` uniquement (la clé anonyme est publique par design côté client ;
jamais la `service_role` key, qui ne doit vivre que côté serveur/Edge Functions).
