# PRD.md

## Vision produit
Construire une application LMS évolutive, professionnelle, sécurisée, **dockerisée** et **sans stockage externe type S3**, permettant à un administrateur de gérer des cours H5P, de personnaliser l’interface, et à terme :
- de suivre l’état d’apprentissage des apprenants ;
- de gérer des utilisateurs locaux et via Microsoft Entra ID ;
- d’envoyer des rappels email via Exchange Online ;
- de sauvegarder et restaurer l’état de l’application.

## Objectif du MVP
Le MVP doit permettre à un administrateur de :
- se connecter ;
- personnaliser le nom, le logo et la bannière de login de l’application ;
- uploader un fichier de cours H5P ;
- renseigner les métadonnées du cours ;
- lister les cours ;
- filtrer les cours ;
- lancer un cours pour le visualiser dans l’application.

L’application doit être **dockerisée**, avec **données persistantes** (base de données + fichiers de cours), et la structure de modèle doit permettre plus tard l’ajout de la progression apprenant et d’une fonction de backup/restore.

## Périmètre fonctionnel MVP

### 1. Authentification administrateur
L’application propose une page de login pour l’administrateur.
Dans cette première phase, des comptes locaux sont autorisés.
L’admin gère l’application, pas le parcours apprenant.

### 2. Branding de l’application
L’administrateur peut configurer :
- le nom de l’application ;
- le logo ;
- une bannière personnalisée pour la page de login.

### 3. Upload de cours H5P
L’administrateur peut uploader un fichier de cours au format .h5p uniquement.
Contraintes :
- taille minimale supportée : 500 MB au moins ;
- validation du type de fichier ;
- stockage dans le backend (stockage local persistant, pas S3).

### 4. Métadonnées de cours
À l’upload, l’administrateur doit renseigner :
- le nom du cours ;
- la durée du cours ;
- la présence ou non d’un quiz ;
- le passing score du quiz si quiz présent.

### 5. Liste des cours
Les cours uploadés doivent être affichés dans une liste.
La liste doit permettre :
- la recherche par nom de cours ;
- le filtre par présence de quiz.

### 6. Visualisation du cours
Depuis la liste, l’administrateur doit pouvoir lancer un cours pour le visualiser dans l’application.

## Hors périmètre MVP (mais préparés dans le modèle)

Les fonctionnalités suivantes ne sont pas à développer dans le MVP, mais le modèle de données et l’architecture doivent les permettre :

### Progression de l’apprenant
- L’application doit mémoriser la progression de chaque apprenant pour chaque cours.
- Un apprenant doit pouvoir :
  - commencer un cours ;
  - s’arrêter ;
  - reprendre sa progression et son état de quiz plus tard.
- Les données suivantes doivent être stockées :
  - progression (0–100 %) ;
  - date de début et de fin (ou dernier accès) ;
  - résultats de quiz, tentatives, score obtenu, passing score, réussite/échec.

### Docker, persistance et sauvegarde
- L’application doit être déployable via Docker.
- La base de données doit être persistante (volume Docker).
- Les fichiers H5P doivent être stockés de façon persistante (volume ou bind mount), pas uniquement dans le container.
- Pas de S3 ni autre stockage objet externe dans le MVP.
- Les données de progression apprenant, de cours, de quiz, de branding, etc., doivent être incluses dans toute sauvegarde/restauration.
- Un mécanisme de backup/restore est prévu, avec une interface admin à terme (lancement, téléchargement de sauvegarde, restauration, vérification de l’état).

## Évolutions futures prévues

### Authentification
- Des utilisateurs locaux.
- Des utilisateurs via Microsoft Entra ID.
- Coexistence des deux modes d’identité dans la même base.

### Rôles
- admin
- creator
- employee

Un employee peut aussi être creator si on lui attribue ce rôle.

### Séparation admin / métier
- L’admin est un utilisateur à part, dédié à la gestion de l’application.
- L’admin ne fait pas partie du parcours apprenant.
- Les employés (simples ou creators) sont les utilisateurs métier.
- Les creators peuvent aussi recevoir des cours et des assignations.

### Assignation de cours
À terme, un cours pourra être assigné à un ou plusieurs utilisateurs :
- tous les employés pourront recevoir des cours ;
- les creators pourront aussi recevoir des cours ;
- le statut creator ne doit jamais empêcher l’assignation d’un cours ;
- l’assignation doit être pensée sur les users métier, pas sur l’admin.

### État d’apprentissage
- Progression de chaque apprenant par cours.
- Reprise de la progression et des quiz.
- Interface utilisateur pour suivre la progression, plus tard.

### Notifications email
À terme, l’application pourra envoyer des rappels email aux employés via le compte Exchange Online de l’entreprise, potentiellement via Microsoft Graph.

## Contraintes de sécurité
La sécurité est une exigence fondamentale.
- Un utilisateur ne doit pas pouvoir contourner son rôle.
- Toutes les vérifications d’accès doivent être faites côté serveur.
- Les actions sensibles (upload, accès aux cours, modification de données, backup restore) doivent être protégées.
- L’interface ne doit jamais être la seule couche de sécurité.
- L’upload doit être validé strictement côté client et côté serveur.

## Contraintes techniques
L’application doit être pensée pour une évolution progressive vers un vrai LMS, avec :
- une base de données relationnelle facile à gérer (PostgreSQL) ;
- un modèle de données extensible (utilisateurs, rôles, cours, assignations, progression, quiz, branding, backup) ;
- une séparation claire entre code et données ;
- un déploiement Docker planifié dès le début ;
- une absence de S3/stockage objet externe pour le MVP ;
- une architecture compatible avec une authentification fédérée Microsoft Entra ID.

## Exigences UX/UI
L’interface doit être :
- professionnelle ;
- claire ;
- responsive ;
- cohérente avec une application B2B ;
- suffisamment flexible pour intégrer le branding administrateur ;
- pensée pour évoluer vers une interface d’apprenant avec suivi de progression.

## Critères d’acceptation MVP
Le MVP est considéré comme acceptable si :
- l’administrateur peut se connecter ;
- il peut personnaliser le branding ;
- il peut uploader un .h5p (validé et stocké correctement) ;
- les métadonnées du cours sont enregistrées ;
- les cours sont listés et filtrables ;
- un cours peut être lancé dans l’application ;
- aucun accès sensible ne peut être obtenu sans le bon rôle ;
- l’application est containerisée, avec données de base et de fichiers persistantes ;
- tout cela est fait **sans S3 ni autre stockage objet externe**.

## Principes de décision produit
- Avancer par étapes.
- Ne pas surconcevoir le MVP.
- Prévoir l’évolution dès maintenant.
- Sécuriser dès la première version.
- Garder le modèle prêt pour les futurs besoins d’entreprise (rôles, progression apprenant, backup/restore, Exchange Online, Entra ID).
