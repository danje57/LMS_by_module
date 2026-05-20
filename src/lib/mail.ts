import nodemailer from "nodemailer";
import { getMailConfig, isConfigured, type MailConfig } from "@/lib/mail-config";

export interface MailPayload {
  to: string;
  subject: string;
  html: string;
}

async function sendViaSMTP(cfg: MailConfig, payload: MailPayload): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost!,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth: { user: cfg.smtpUser!, pass: cfg.smtpPass! },
  });
  await transporter.sendMail({
    from: `"${cfg.fromName}" <${cfg.smtpFrom}>`,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });
}

// ── Microsoft Graph API (Exchange Online / Microsoft 365) ────────────────────
// Prérequis Azure AD :
//   1. Enregistrer une app dans Azure AD (Entra ID)
//   2. Accorder l'autorisation d'application : Mail.Send
//   3. Créer un secret client

async function getGraphToken(cfg: MailConfig): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${cfg.graphTenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: cfg.graphClientId!,
        client_secret: cfg.graphClientSecret!,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );
  if (!res.ok) throw new Error(`Graph token error: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

async function sendViaGraph(cfg: MailConfig, payload: MailPayload): Promise<void> {
  const token = await getGraphToken(cfg);
  const from = cfg.graphFrom!;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: payload.subject,
          body: { contentType: "HTML", content: payload.html },
          toRecipients: [{ emailAddress: { address: payload.to } }],
          from: { emailAddress: { address: from } },
        },
        saveToSentItems: true,
      }),
    }
  );
  if (!res.ok && res.status !== 202) {
    const err = await res.text();
    throw new Error(`Graph sendMail error ${res.status}: ${err}`);
  }
}

// ── Point d'entrée unique ────────────────────────────────────────────────────

export async function sendMail(payload: MailPayload): Promise<void> {
  const cfg = await getMailConfig();
  if (cfg.provider === "graph") {
    await sendViaGraph(cfg, payload);
  } else {
    await sendViaSMTP(cfg, payload);
  }
}

export async function isMailConfigured(): Promise<boolean> {
  const cfg = await getMailConfig();
  return isConfigured(cfg);
}
