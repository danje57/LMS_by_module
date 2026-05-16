# LMS by Module

Plateforme LMS évolutive — Next.js 15, PostgreSQL, Prisma, H5P, Docker.

## Stack

- **Frontend/Backend** : Next.js 15 (App Router, Server Actions)
- **Base de données** : PostgreSQL 16 + Prisma ORM
- **Auth** : NextAuth.js v5 (credentials locaux, extensible Entra ID)
- **UI** : Tailwind CSS + shadcn/ui
- **Stockage** : Local (volumes Docker), pas de S3
- **Déploiement** : Docker + docker-compose

## Démarrage rapide

```bash
# 1. Variables d'environnement
cp .env.example .env
# Éditez .env avec vos valeurs

# 2. Dépendances
npm install

# 3. Base de données
npx prisma db push
npx prisma db seed

# 4. Démarrage
npm run dev
```

Compte admin par défaut : `admin@lms.local` / `Admin@123`

## Docker

```bash
docker-compose up -d
```

## Structure du projet

```
src/
├── app/
│   ├── login/           # Page de connexion
│   ├── dashboard/       # Interface admin
│   │   ├── courses/     # Gestion des cours H5P
│   │   └── settings/    # Branding
│   └── api/             # API Routes
├── components/          # Composants React
├── lib/                 # Prisma, Auth, utils
└── types/               # Types TypeScript
prisma/
└── schema.prisma        # Modèle de données complet
```
