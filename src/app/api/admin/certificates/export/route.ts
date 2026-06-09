import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import AdmZip from "adm-zip";
import { readFile } from "fs/promises";
import path from "path";
import { createElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import type { JSXElementConstructor, ReactElement } from "react";
import { CertificatePDF } from "@/components/certificates/certificate-pdf";

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

async function getLogoDataUri(): Promise<string | null> {
  try {
    const branding = await prisma.brandingSetting.findFirst({ select: { logoPath: true } });
    if (!branding?.logoPath) return null;
    const abs = path.join(UPLOAD_DIR, branding.logoPath);
    const ext = path.extname(branding.logoPath).toLowerCase();
    const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
               : ext === ".webp" ? "image/webp"
               : "image/png";
    const buf = await readFile(abs);
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function buildWhere(userId?: string, teamId?: string, year?: string, type?: string) {
  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (teamId) where.user = { teams: { some: { teamId } } };
  if (type === "courses") where.isPdf = false;
  if (type === "grc")     where.isPdf = true;
  if (year) {
    const y = parseInt(year);
    if (!isNaN(y)) {
      where.completedAt = {
        gte: new Date(`${y}-01-01`),
        lt: new Date(`${y + 1}-01-01`),
      };
    }
  }
  return where;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user.sessionMode !== "admin")
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const format = searchParams.get("format") ?? "csv";
  const userId = searchParams.get("userId") ?? undefined;
  const teamId = searchParams.get("teamId") ?? undefined;
  const year   = searchParams.get("year")   ?? undefined;
  const type   = searchParams.get("type")   ?? undefined;

  const certs = await prisma.certificate.findMany({
    where: buildWhere(userId, teamId, year, type),
    include: { user: { select: { name: true, email: true } } },
    orderBy: { completedAt: "desc" },
  });

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);

  // ── CSV ──────────────────────────────────────────────────────────────────────
  if (format === "csv") {
    const header = "ID Certificat;Type;Apprenant;Email;Cours / Document;Complété le;Certificat émis le;Évaluation";
    const rows = certs.map((c) => {
      const name     = c.user.name ?? "";
      const email    = c.user.email;
      const typeStr  = c.isPdf ? "Document GRC" : "Formation";
      const evalStr  = c.isPdf ? "" : c.hasQuiz ? "Evaluation validee" : "Sans evaluation";
      return `${c.id.toUpperCase()};${typeStr};${name};${email};"${c.courseTitle}";${fmt(c.completedAt)};${fmt(c.issuedAt)};${evalStr}`;
    });
    const csv = "﻿" + [header, ...rows].join("\n");
    const dateTag = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="certificats_${dateTag}.csv"`,
      },
    });
  }

  // ── ZIP with PDFs ─────────────────────────────────────────────────────────────
  if (format === "zip") {
    const logoSrc = await getLogoDataUri();
    const zip = new AdmZip();

    for (const cert of certs) {
      const learnerName = cert.user.name ?? cert.user.email;
      const pdfBuffer = await renderToBuffer(
        createElement(CertificatePDF, {
          id: cert.id,
          courseTitle: cert.courseTitle,
          learnerName,
          completedAt: cert.completedAt,
          hasQuiz: cert.hasQuiz,
          isPdf: cert.isPdf,
          logoSrc,
        }) as unknown as ReactElement<DocumentProps, JSXElementConstructor<DocumentProps>>
      );

      const safeName = learnerName.replace(/[^a-zA-Z0-9]/g, "_");
      const safeCourse = cert.courseTitle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
      const dateTag = cert.completedAt.toISOString().slice(0, 10);
      zip.addFile(`${dateTag}_${safeName}_${safeCourse}.pdf`, Buffer.from(pdfBuffer));
    }

    const zipBuffer = zip.toBuffer();
    const dateTag = new Date().toISOString().slice(0, 10);
    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="certificats_${dateTag}.zip"`,
      },
    });
  }

  return NextResponse.json({ error: "Format invalide (csv ou zip)" }, { status: 400 });
}
