# Claude.md

## Rôle du projet
Tu travailles sur une application LMS évolutive, pensée d’abord comme un MVP, puis comme une plateforme complète avec gestion des utilisateurs, des rôles, des cours H5P, de l’authentification locale, de Microsoft Entra ID, et plus tard des notifications email via Exchange Online.

## Objectif produit
Créer une application professionnelle permettant :
- à un administrateur de se connecter ;
- d’uploader des fichiers de cours H5P ;
- de renseigner les métadonnées du cours ;
- de lister et filtrer les cours ;
- de lancer un cours pour le visualiser dans l’application ;
- de personnaliser le branding de l’application ;
- de préparer une évolution vers un vrai LMS multi-rôles, multi-sources d’authentification, multi-utilisateurs, multi-assignations, avec progression apprenant et sauvegarde/restauration.

## Stack recommandée
Utiliser une stack moderne, maintenable et évolutive :
- Frontend : Next.js.
- Backend : API route handlers ou server actions Next.js.
- Base de données : PostgreSQL.
- ORM : Prisma.
- Authentification : solution compatible avec comptes locaux et future connexion Microsoft Entra ID.
- Stockage des fichiers : stockage local dans le backend, via Docker volumes (pas de S3 ni autre stockage objet externe).
- UX : UI professionnelle, cohérente, adaptée à une application B2B.

## Principes d’architecture
- Séparer strictement la couche d’interface, la couche métier et la couche de persistance.
- Prévoir dès maintenant une architecture modulaire.
- Ne pas figer le système d’authentification sur un seul provider.
- Prévoir dès le début le support de :
  - comptes locaux ;
  - connexion Microsoft Entra ID plus tard ;
  - liaison éventuelle d’un compte local avec un compte externe.
- Prévoir une couche notifications distincte du cœur LMS.
- Prévoir un modèle de données extensible pour les rôles, les utilisateurs, les cours, les assignations, la progression apprenant, et le branding.

## Docker et persistance
- L’application doit être pensée pour être déployée via Docker (docker-compose ou équivalent).
- Les données de la base de données doivent être persistantes via un volume Docker.
- Les fichiers de cours H5P doivent être stockés dans un dossier partagé/monté persistant (volume ou bind mount), pas uniquement dans le container.
- L’architecture ne doit pas introduire de S3 ou autre stockage objet externe dans le MVP.
- Le système de backup/restore doit porter sur la base de données + les données de progression utilisateurs + les uploads de cours.
- Cette couche doit permettre à terme une interface admin pour lancer backup/restore.

## Sauvegarde et restauration
- Les données de l’application doivent être facilement sauvegardables et restaurables.
- Les sauvegardes doivent inclure :
  - la base de données (utilisateurs, rôles, cours, assignations, progression, quiz, branding, etc.) ;
  - les fichiers de cours H5P.
- Les restaurations doivent permettre de revenir à un état cohérent de l’application.
- La fonction de backup/restore pourra être exposée via une interface admin, mais ce n’est pas requis dans le MVP, le modèle doit juste la permettre.

## Sécurité
La sécurité est une exigence centrale.
- Tous les contrôles d’accès doivent être vérifiés côté serveur.
- Aucun accès sensible ne doit dépendre uniquement du frontend.
- Un utilisateur ne doit jamais pouvoir contourner le rôle qui lui est attribué.
- Les routes, actions serveur, API et accès aux ressources doivent être protégés.
- Les permissions doivent être vérifiées à chaque action sensible.
- Le middleware seul ne suffit pas : il faut aussi une vérification serveur sur les pages et endpoints.

## Rôles et identité
Le système doit être prévu pour évoluer vers plusieurs rôles :
- creator
- admin
- employee

Un employee peut aussi devenir creator si on lui attribue ce rôle.
Prévoir une logique de rôles et permissions extensible, idéalement via une table de rôles ou un mécanisme de permissions centralisé.

## Séparation des rôles métier et admin
- L’admin est un profil séparé dédié à la gestion de l’application.
- L’admin ne sert pas au parcours apprenant.
- Les users métier sont les employés, qu’ils soient simples employees ou creators.
- Un creator reste assignable à des cours.
- Le fait d’être creator ne doit jamais bloquer l’assignation de cours.

## Assignation des cours
- Tous les employés peuvent recevoir des cours.
- Les creators peuvent aussi recevoir des cours.
- Un cours peut être assigné à un ou plusieurs utilisateurs.
- Les assignations doivent être pensées sur les users métier, pas sur le seul rôle admin.
- Cette fonctionnalité peut être développée plus tard, mais le modèle doit la permettre dès maintenant.

## État d’apprentissage de l’apprenant
- L’application doit, à terme, mémoriser l’état d’apprentissage de chaque apprenant.
- Un apprenant doit pouvoir :
  - commencer un cours ;
  - s’arrêter ;
  - reprendre là où il s’est arrêté.
- Les données suivantes doivent être stockées :
  - progression du cours (ex. 0–100 %) ;
  - date de début et de fin du cours (ou dernier accès) ;
  - résultats de quiz, tentatives, score obtenu, passing score, réussite/échec.
- Ces données doivent être liées au user et au course, et rester valables après un déploiement, un redémarrage ou une restauration de backup.

## Authentification future
L’application doit supporter à terme :
- des utilisateurs locaux ;
- une connexion via Microsoft Entra ID ;
- la coexistence des deux modes dans une même base utilisateur ;
- une logique de liaison entre identité locale et identité externe si nécessaire.

L’architecture doit permettre d’ajouter ce support sans refonte majeure.

## Notifications futures
Prévoir plus tard une fonction de rappel email aux employés.
- Envoi via Exchange Online de Microsoft 365.
- Intégration probable via Microsoft Graph.
- Cette fonctionnalité n’est pas dans le MVP, mais l’architecture doit la rendre simple à ajouter.
- Prévoir une couche de service email distincte et remplaçable.

## Branding et interface
L’interface doit être professionnelle et personnalisable.
L’administrateur doit pouvoir définir :
- le nom de l’application ;
- le logo ;
- une bannière personnalisée sur la page de login.

Prévoir aussi la possibilité d’évoluer plus tard vers :
- favicon ;
- couleurs de marque ;
- autres éléments visuels.

## Gestion des cours H5P
L’administrateur doit pouvoir :
- uploader uniquement des fichiers .h5p ;
- uploader des fichiers d’au moins 500 MB ;
- renseigner le nom du cours ;
- renseigner la durée ;
- indiquer s’il y a un quiz ;
- renseigner le passing score du quiz.

Après upload :
- les cours doivent être listés ;
- ils doivent pouvoir être filtrés par nom ;
- ils doivent pouvoir être filtrés par présence de quiz ;
- ils doivent pouvoir être lancés pour visualisation dans l’application.

## Règles d’upload
- Valider côté client et côté serveur.
- Vérifier l’extension .h5p.
- Vérifier la taille maximale autorisée.
- Ne jamais se fier uniquement au nom de fichier.
- S’assurer que le traitement d’upload est sécurisé et robuste.

## Modèle de données attendu
Prévoir au minimum :
- users
- roles
- user_roles (ou permissions équivalentes)
- courses
- course_assets
- course_assignments
- user_course_progress
- user_quiz_results
- branding_settings
- auth_accounts (pour lier local et Entra)
- backup_settings (pour configurer backups admin, plus tard)

## Qualité attendue
- Code propre, lisible, documenté sobrement.
- Structure prête pour montée en charge.
- Découpage clair des responsabilités.
- Sécurité par défaut.
- Préparation des futures fonctionnalités sans sur-ingénierie.

## Livrables attendus
Le projet doit pouvoir évoluer étape par étape :
1. login administrateur ;
2. upload H5P ;
3. listing et filtrage ;
4. lecture du cours ;
5. branding admin ;
6. auth locale + Entra ID ;
7. rôles avancés ;
8. assignations de cours ;
9. état d’apprentissage de l’apprenant ;
10. backup/restore (CLI puis, plus tard, via interface admin) ;
11. rappels email Exchange Online.
