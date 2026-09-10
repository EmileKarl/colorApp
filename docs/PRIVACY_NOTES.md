# Notes de confidentialité — brouillon technique (§12)

**Ceci n'est pas un avis juridique.** Ce document liste ce que l'application collecte
techniquement, pour servir de base à une politique de confidentialité rédigée/validée par un
juriste avant toute publication. Si le public visé inclut le Québec/Canada, la Loi 25 impose
notamment : un consentement clair au moment de la collecte, la possibilité de retirer ce
consentement, la désignation d'un responsable de la protection des renseignements personnels, et
la notification en cas d'incident de confidentialité présentant un risque de préjudice sérieux.

## Données collectées

| Donnée | Pourquoi | Conservation | Qui y accède | Suppression |
|---|---|---|---|---|
| Courriel (compte) | Authentification | Tant que le compte existe | Supabase Auth (chiffré au repos) | Suppression immédiate via `delete_own_account()` |
| Nom d'utilisateur / profil public | Identifier les contributions communautaires | Tant que le compte existe | Public (lecture par tous) | Supprimé avec le compte |
| Photos scannées (si sauvegardées) | Afficher/partager la couleur extraite | Tant que l'utilisateur ne la supprime pas | Le propriétaire uniquement (RLS) | Suppression immédiate depuis la collection |
| Couleurs/nom proposés à la communauté | Fonctionnalité communautaire (§31) | Permanent (contenu partagé, comme un post public) | Public une fois approuvé | Détachés de l'identité (pas supprimés) si le compte est supprimé, pour ne pas casser le classement d'autrui |
| Votes | Classement communautaire | Permanent, liés à l'auteur du vote | Agrégés publiquement (le détail par utilisateur reste privé) | Supprimés avec le compte |
| Signalements de modération | Sécurité/modération du contenu | Jusqu'à résolution + délai raisonnable | Modérateurs uniquement | Sur demande |

Aucune donnée de localisation précise, aucune donnée de paiement, aucune donnée de santé ne sont
collectées dans la portée actuelle du projet.

## Permissions natives demandées et pourquoi

- **Caméra** : nécessaire à la fonctionnalité principale (scanner une couleur).
- **Photos/Galerie** : alternative à la caméra pour choisir une image existante, et pour
  enregistrer une carte partageable générée par l'app.

Aucune permission de localisation, contacts, micro ou notifications push n'est demandée dans la
portée actuelle.

## À faire avant publication

1. Faire rédiger/valider une politique de confidentialité et des conditions d'utilisation par un
   professionnel du droit (obligatoire pour la publication sur l'App Store et Google Play).
2. Décider et documenter un mécanisme de consentement explicite à l'inscription (case à cocher
   liée à la politique de confidentialité).
3. Désigner un point de contact pour les demandes d'accès/suppression de données.
