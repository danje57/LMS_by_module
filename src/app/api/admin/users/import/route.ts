import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { RoleType } from "@prisma/client";

type CsvRow = {
  prenom: string;
  nom: string;
  email: string;
  mot_de_passe: string;
  role: string;
  equipe: string;
};

function mapRoles(role: string): RoleType[] {
  switch (role.toLowerCase().trim()) {
    case "manager":  return ["manager", "creator", "learner"];
    case "createur":
    case "créateur": return ["creator", "learner"];
    case "admin":    return ["admin"];
    default:         return ["learner"];
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { rows } = await req.json() as { rows: CsvRow[] };
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "Aucune ligne à importer" }, { status: 400 });

  let created = 0;
  let updated = 0;
  const errors: { line: number; email: string; message: string }[] = [];

  // Cache équipes créées/trouvées durant l'import
  const teamCache = new Map<string, string>(); // name → id

  async function getOrCreateTeam(name: string): Promise<string> {
    const key = name.trim().toLowerCase();
    if (teamCache.has(key)) return teamCache.get(key)!;
    let team = await prisma.team.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" } } });
    if (!team) team = await prisma.team.create({ data: { name: name.trim() } });
    teamCache.set(key, team.id);
    return team.id;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2; // 1-indexed + header

    const email = row.email?.trim().toLowerCase();
    if (!email) { errors.push({ line: lineNum, email: "", message: "Email manquant" }); continue; }

    const roles = mapRoles(row.role ?? "");
    const name = [row.prenom, row.nom].filter(Boolean).map(s => s.trim()).join(" ") || null;

    try {
      const existing = await prisma.user.findUnique({ where: { email } });

      let userId: string;

      if (existing) {
        // Mettre à jour : nom, rôles, mot de passe si fourni
        const updateData: Record<string, unknown> = { name: name || existing.name };
        if (row.mot_de_passe?.trim()) {
          updateData.passwordHash = await bcrypt.hash(row.mot_de_passe.trim(), 10);
        }
        await prisma.user.update({ where: { id: existing.id }, data: updateData });

        // Remplacer les rôles
        await prisma.userRole.deleteMany({ where: { userId: existing.id } });
        for (const r of roles) {
          const role = await prisma.role.findUnique({ where: { name: r } });
          if (role) await prisma.userRole.create({ data: { userId: existing.id, roleId: role.id } });
        }

        userId = existing.id;
        updated++;
      } else {
        // Créer
        if (!row.mot_de_passe?.trim()) {
          errors.push({ line: lineNum, email, message: "Mot de passe requis pour un nouvel utilisateur" });
          continue;
        }
        const passwordHash = await bcrypt.hash(row.mot_de_passe.trim(), 10);
        const user = await prisma.user.create({ data: { email, name, passwordHash, isActive: true } });

        for (const r of roles) {
          const role = await prisma.role.findUnique({ where: { name: r } });
          if (role) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
        }

        userId = user.id;
        created++;
      }

      // Équipe
      if (row.equipe?.trim()) {
        const teamId = await getOrCreateTeam(row.equipe);

        // Ajouter comme membre
        await prisma.userTeam.upsert({
          where: { userId_teamId: { userId, teamId } },
          update: {},
          create: { userId, teamId },
        });

        // Si manager → désigner comme manager de l'équipe
        if (roles.includes("manager")) {
          await prisma.team.update({ where: { id: teamId }, data: { managerId: userId } });
        }
      }
    } catch (e) {
      errors.push({ line: lineNum, email, message: e instanceof Error ? e.message : "Erreur inconnue" });
    }
  }

  return NextResponse.json({ created, updated, errors });
}
