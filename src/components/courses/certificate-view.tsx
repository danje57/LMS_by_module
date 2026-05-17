"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface CertificateViewProps {
  id: string;
  courseTitle: string;
  learnerName: string;
  completedAt: Date;
  hasQuiz: boolean;
  logoPath?: string | null;
  inlineMode?: boolean;
}

export function CertificateView({ id, courseTitle, learnerName, completedAt, hasQuiz, logoPath, inlineMode = false }: CertificateViewProps) {
  const dateStr = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(completedAt));

  const certNumber = id.toUpperCase();

  return (
    <>
      <style>{`
        .cert-screen-wrapper {
          padding: 2.5rem 1.5rem;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .cert-toolbar {
          width: 100%;
          max-width: 980px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
        }
        .cert-outer {
          width: min(980px, 95vw);
          aspect-ratio: 297 / 210;
          background: #E8E8E8;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          border: 5px solid #1B2E4B;
          position: relative;
          box-shadow: 0 24px 64px rgba(0,0,0,0.25);
          display: flex;
          align-items: stretch;
        }
        /* Inner gold border */
        .cert-outer::before {
          content: '';
          position: absolute;
          inset: 8px;
          border: 1.5px solid #C9A84C;
          pointer-events: none;
          z-index: 1;
        }
        /* Second inner border */
        .cert-outer::after {
          content: '';
          position: absolute;
          inset: 16px;
          border: 0.5px solid #C9A84C55;
          pointer-events: none;
          z-index: 1;
        }
        .cert-left-band {
          width: 14px;
          background: linear-gradient(180deg, #1B2E4B 0%, #2E4A7A 50%, #1B2E4B 100%);
          flex-shrink: 0;
        }
        .cert-right-band {
          width: 14px;
          background: linear-gradient(180deg, #1B2E4B 0%, #2E4A7A 50%, #1B2E4B 100%);
          flex-shrink: 0;
        }
        .cert-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3% 7%;
          text-align: center;
          position: relative;
          z-index: 2;
        }
        /* Logo top-left */
        .cert-logo {
          position: absolute;
          top: 6%;
          left: 4%;
          z-index: 3;
          max-height: clamp(28px, 5.5%, 48px);
          width: auto;
          max-width: 18%;
          object-fit: contain;
        }
        .cert-overline {
          font-size: clamp(10px, 1.3vw, 14px);
          font-weight: 700;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: #C9A84C;
          margin-bottom: 2%;
        }
        .cert-divider {
          display: flex;
          align-items: center;
          gap: 0.6em;
          width: 55%;
          margin: 1.5% auto;
          color: #C9A84C;
          font-size: clamp(9px, 1.1vw, 12px);
        }
        .cert-divider::before, .cert-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: linear-gradient(to right, transparent, #C9A84C);
        }
        .cert-divider::after {
          background: linear-gradient(to left, transparent, #C9A84C);
        }
        .cert-subtitle {
          font-size: clamp(11px, 1.4vw, 16px);
          color: #5A5A6A;
          margin-bottom: 2%;
        }
        .cert-name {
          font-size: clamp(22px, 3.8vw, 46px);
          font-weight: 700;
          color: #1B2E4B;
          letter-spacing: 0.02em;
          line-height: 1.1;
          margin-bottom: 1%;
          font-family: Georgia, 'Times New Roman', serif;
        }
        .cert-name-line {
          width: 40%;
          height: 1px;
          background: linear-gradient(to right, transparent, #C9A84C, transparent);
          margin: 1% auto 2%;
        }
        .cert-course-label {
          font-size: clamp(9px, 1.2vw, 13px);
          color: #8E8E93;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-bottom: 1%;
        }
        .cert-course-title {
          font-size: clamp(15px, 2.4vw, 28px);
          font-weight: 600;
          color: #1B2E4B;
          line-height: 1.2;
          max-width: 80%;
          margin-bottom: 3%;
          font-family: Georgia, 'Times New Roman', serif;
        }
        .cert-footer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          margin-top: 1%;
        }
        .cert-eval-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4em;
          font-size: clamp(8px, 1vw, 12px);
          color: #2E6B3E;
          background: #EAF5EE;
          border: 0.5px solid #A8D4B4;
          border-radius: 100px;
          padding: 0.4em 1em;
          font-weight: 600;
          letter-spacing: 0.04em;
        }
        .cert-date {
          font-size: clamp(8px, 1vw, 12px);
          color: #8E8E93;
        }
        .cert-date strong {
          color: #3C3C43;
        }
        .cert-id {
          font-size: clamp(9px, 1.1vw, 13px);
          color: #3C3C43;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-top: 1.5%;
          font-weight: 800;
        }

        @media print {
          @page { size: A4 landscape; margin: 0; }

          /* Reset layout constraints */
          html, body {
            margin: 0; padding: 0; background: white;
            height: auto; overflow: visible;
          }

          /* Hide sidebar, header and toolbar */
          aside, header, .no-print { display: none !important; }

          /* Flatten all parent containers so nothing clips the cert */
          body > div, body > div > div, main {
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }

          .cert-screen-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            min-height: unset !important;
            background: transparent !important;
          }

          .cert-outer {
            width: 297mm !important;
            height: 210mm !important;
            aspect-ratio: unset !important;
            box-shadow: none !important;
            border-width: 6px !important;
            margin: 0 !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="cert-screen-wrapper">
        {/* Toolbar — hidden in inline mode */}
        {!inlineMode && (
          <div className="cert-toolbar no-print">
            <Link
              href="/dashboard/certificates"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "13px", color: "#3C3C43", textDecoration: "none" }}
            >
              <ArrowLeft style={{ width: 16, height: 16 }} />
              Mes certificats
            </Link>
            <button
              onClick={() => window.print()}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.5rem",
                padding: "0.5rem 1rem", background: "#0071E3", color: "white",
                border: "none", borderRadius: "0.75rem", fontSize: "13px",
                fontWeight: 500, cursor: "pointer",
              }}
            >
              <Printer style={{ width: 16, height: 16 }} />
              Télécharger / Imprimer
            </button>
          </div>
        )}

        {/* Certificate */}
        <div className="cert-outer">
          <div className="cert-left-band" />

          {logoPath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="cert-logo" src={logoPath} alt="Logo" />
          )}

          <div className="cert-body">
            <p className="cert-overline">✦ &nbsp; Certificat de réussite &nbsp; ✦</p>

            <div className="cert-divider">✦</div>

            <p className="cert-subtitle">Ce document atteste que</p>

            <p className="cert-name">{learnerName}</p>
            <div className="cert-name-line" />

            <p className="cert-course-label">a complété avec succès le cours</p>
            <p className="cert-course-title">{courseTitle}</p>

            <div className="cert-footer-row">
              {hasQuiz ? (
                <span className="cert-eval-badge">
                  ✓ &nbsp; Sanctionné par une évaluation des connaissances
                </span>
              ) : (
                <span style={{ flex: 1 }} />
              )}
              <span className="cert-date">
                Délivré le &nbsp;<strong>{dateStr}</strong>
              </span>
            </div>

            <p className="cert-id">N° {certNumber}</p>
          </div>

          <div className="cert-right-band" />
        </div>
      </div>
    </>
  );
}
