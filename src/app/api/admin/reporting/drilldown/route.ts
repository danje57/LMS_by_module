import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type DrillRow = {
  id: string;
  label: string;
  sub?: string;
  badge?: string;
  value?: string;
};

const COURSE_TYPE_LABELS: Record<string, string> = {
  h5p: "H5P",
  native_video: "Vidéo",
  pptx: "PowerPoint",
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const type = new URL(req.url).searchParams.get("type");

  switch (type) {

    case "courses": {
      const courses = await prisma.course.findMany({
        where: { isActive: true, courseType: { not: "pdf" } },
        orderBy: { title: "asc" },
        select: {
          id: true, title: true, courseType: true,
          _count: { select: { assignments: true } },
        },
      });
      return NextResponse.json(courses.map((c): DrillRow => ({
        id: c.id,
        label: c.title,
        badge: COURSE_TYPE_LABELS[c.courseType] ?? c.courseType,
        value: `${c._count.assignments} inscrits`,
      })));
    }

    case "users": {
      const users = await prisma.user.findMany({
        where: { isActive: true, roles: { some: { role: { name: "learner" } } } },
        orderBy: { name: "asc" },
        select: {
          id: true, name: true, email: true,
          _count: { select: { certificates: true } },
          teams: { select: { team: { select: { name: true } } }, take: 1 },
        },
      });
      return NextResponse.json(users.map((u): DrillRow => ({
        id: u.id,
        label: u.name ?? u.email,
        sub: u.email + (u.teams[0] ? ` · ${u.teams[0].team.name}` : ""),
        value: `${u._count.certificates} certif.`,
      })));
    }

    case "completions": {
      const rows = await prisma.userCourseProgress.findMany({
        where: { completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: 200,
        select: {
          completedAt: true,
          user: { select: { name: true, email: true } },
          course: { select: { id: true, title: true } },
        },
      });
      return NextResponse.json(rows.map((r, i): DrillRow => ({
        id: String(i),
        label: r.user.name ?? r.user.email,
        sub: r.course.title,
        value: new Date(r.completedAt!).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
      })));
    }

    case "certificates": {
      const certs = await prisma.certificate.findMany({
        orderBy: { issuedAt: "desc" },
        take: 200,
        select: {
          id: true, issuedAt: true, courseTitle: true,
          user: { select: { name: true, email: true } },
        },
      });
      return NextResponse.json(certs.map((c): DrillRow => ({
        id: c.id,
        label: c.user.name ?? c.user.email,
        sub: c.courseTitle,
        value: new Date(c.issuedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
      })));
    }

    case "active_week": {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const logs = await prisma.auditLog.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          action: { in: ["course.start", "course.complete", "quiz.submit", "certificate.generate", "document.signed"] },
          actorId: { not: null },
        },
        orderBy: { createdAt: "desc" },
        select: { actorId: true, actorName: true, actorEmail: true, action: true, targetLabel: true, createdAt: true },
      });
      // Dédupliquer par actorId — garder la dernière action
      const seen = new Map<string, typeof logs[0]>();
      for (const l of logs) if (l.actorId && !seen.has(l.actorId)) seen.set(l.actorId, l);

      const ACTION_LABELS: Record<string, string> = {
        "course.start":         "Cours démarré",
        "course.complete":      "Cours terminé",
        "quiz.submit":          "Quiz soumis",
        "certificate.generate": "Certificat généré",
        "document.signed":      "Document signé",
      };

      return NextResponse.json([...seen.values()].map((l): DrillRow => ({
        id: l.actorId!,
        label: l.actorName ?? l.actorEmail ?? "—",
        sub: l.targetLabel ?? undefined,
        badge: ACTION_LABELS[l.action] ?? l.action,
        value: new Date(l.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      })));
    }

    case "documents": {
      const docs = await prisma.course.findMany({
        where: { isActive: true, courseType: "pdf" },
        orderBy: { title: "asc" },
        select: { id: true, title: true, category: true,
          _count: { select: { assignments: true, pdfSignatures: true } } },
      });
      return NextResponse.json(docs.map((d): DrillRow => {
        const assigned = d._count.assignments;
        const signed   = d._count.pdfSignatures;
        const rate     = assigned > 0 ? Math.round((signed / assigned) * 100) : 0;
        return {
          id: d.id,
          label: d.title,
          sub: d.category ?? undefined,
          badge: assigned > 0 ? `${rate}%` : "0 assigné",
          value: `${signed}/${assigned} signés`,
        };
      }));
    }

    case "signatures": {
      const sigs = await prisma.pdfSignature.findMany({
        where: { course: { isActive: true, courseType: "pdf" } },
        orderBy: { signedAt: "desc" },
        take: 200,
        select: {
          id: true, signedAt: true,
          user:   { select: { name: true, email: true } },
          course: { select: { title: true } },
        },
      });
      return NextResponse.json(sigs.map((s): DrillRow => ({
        id: s.id,
        label: s.user.name ?? s.user.email,
        sub: s.course.title,
        value: new Date(s.signedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
      })));
    }

    case "fully_signed": {
      const docs = await prisma.course.findMany({
        where: { isActive: true, courseType: "pdf" },
        select: { id: true, title: true, category: true,
          _count: { select: { assignments: true, pdfSignatures: true } } },
      });
      const fully = docs.filter((d) => d._count.assignments > 0 && d._count.pdfSignatures === d._count.assignments);
      return NextResponse.json(fully.map((d): DrillRow => ({
        id: d.id,
        label: d.title,
        sub: d.category ?? undefined,
        value: `${d._count.pdfSignatures}/${d._count.assignments} signés`,
      })));
    }

    case "unsigned": {
      const assignments = await prisma.courseAssignment.findMany({
        where: { course: { courseType: "pdf", isActive: true } },
        select: {
          userId: true, courseId: true,
          user:   { select: { name: true, email: true } },
          course: { select: { title: true } },
        },
      });
      const signedPairs = await prisma.pdfSignature.findMany({
        select: { userId: true, courseId: true },
      });
      const signedSet = new Set(signedPairs.map((s) => `${s.userId}:${s.courseId}`));
      const unsigned = assignments.filter((a) => !signedSet.has(`${a.userId}:${a.courseId}`));
      return NextResponse.json(unsigned.map((a, i): DrillRow => ({
        id: String(i),
        label: a.user.name ?? a.user.email,
        sub: a.course.title,
      })));
    }

    default:
      return NextResponse.json({ error: "Type inconnu" }, { status: 400 });
  }
}
