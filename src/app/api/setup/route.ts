import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { validatePassword } from "@/lib/password";
import { auditLog } from "@/lib/audit";

async function adminExists() {
  const role = await prisma.role.findUnique({ where: { name: "admin" }, include: { users: { take: 1 } } });
  return role && role.users.length > 0;
}

export async function GET() {
  const exists = await adminExists();
  return NextResponse.json({ setupDone: exists });
}

export async function POST(req: Request) {
  if (await adminExists()) {
    return NextResponse.json({ error: "Setup déjà effectué." }, { status: 403 });
  }

  const { name, email, password } = await req.json();

  if (!email?.trim()) return NextResponse.json({ error: "Email requis." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email invalide." }, { status: 400 });

  const check = validatePassword(password ?? "");
  if (!check.valid) return NextResponse.json({ error: `Mot de passe trop faible : ${check.errors.join(", ")}.` }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);

  let adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
  if (!adminRole) {
    adminRole = await prisma.role.create({ data: { name: "admin", description: "Administrateur" } });
  }

  const user = await prisma.user.create({
    data: {
      name: name?.trim() || null,
      email: email.trim().toLowerCase(),
      passwordHash,
      isActive: true,
      roles: { create: { roleId: adminRole.id } },
    },
  });

  await auditLog({ actor: { id: user.id, name: user.name, email: user.email }, action: "setup.init", targetLabel: user.email });
  return NextResponse.json({ ok: true });
}
