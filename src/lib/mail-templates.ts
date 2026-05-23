// Templates d'email HTML — inline CSS pour compatibilité maximale avec les clients mail

export interface MailBranding {
  appName: string;
  logoUrl?: string;
  appUrl?: string;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function baseLayout(
  branding: MailBranding,
  headerColor: string,
  headerEmoji: string,
  headerLabel: string,
  body: string
): string {
  const { appName, logoUrl, appUrl } = branding;

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${appName}" height="36" style="display:block;border:0;" />`
    : `<span style="font-size:18px;font-weight:700;color:#1D1D1F;letter-spacing:-0.3px;">${appName}</span>`;

  const appLink = appUrl
    ? `<a href="${appUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#0071E3;color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">Accéder à la plateforme</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${appName}</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F5F7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Logo / App name -->
          <tr>
            <td align="center" style="padding-bottom:20px;">
              ${logoHtml}
            </td>
          </tr>

          <!-- Carte principale -->
          <tr>
            <td style="background:#fff;border-radius:18px;border:1px solid #E5E5EA;overflow:hidden;">

              <!-- Bandeau coloré -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:${headerColor};padding:20px 28px;">
                    <span style="font-size:22px;">${headerEmoji}</span>
                    <span style="display:inline-block;margin-left:10px;font-size:16px;font-weight:700;color:#fff;vertical-align:middle;">${headerLabel}</span>
                  </td>
                </tr>
              </table>

              <!-- Corps -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:28px;">
                    ${body}
                    ${appLink ? `<div style="margin-top:24px;">${appLink}</div>` : ""}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#ADADB8;">
                Cet email a été envoyé automatiquement par ${appName}. Ne pas répondre à ce message.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── 1. Création de compte ────────────────────────────────────────────────────

export function templateAccountCreated(opts: {
  branding: MailBranding;
  userName: string;
  email: string;
  password: string;
}): { subject: string; html: string } {
  const { branding, userName, email, password } = opts;

  const loginHtml = branding.appUrl
    ? `<a href="${branding.appUrl}/login" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#0071E3;color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">Se connecter</a>`
    : "";

  const body = `
    <p style="margin:0 0 4px;font-size:15px;color:#1D1D1F;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6E6E73;">
      Votre compte sur <strong>${branding.appName}</strong> a été créé. Voici vos identifiants de connexion.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background:#F5F5F7;border-radius:12px;padding:18px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-bottom:10px;">
                <p style="margin:0;font-size:12px;font-weight:600;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;">Email</p>
                <p style="margin:4px 0 0;font-size:15px;color:#1D1D1F;">${email}</p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #E5E5EA;padding-top:10px;">
                <p style="margin:0;font-size:12px;font-weight:600;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;">Mot de passe temporaire</p>
                <p style="margin:4px 0 0;font-size:17px;font-weight:700;color:#1D1D1F;letter-spacing:1px;font-family:monospace;">${password}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:16px 0 0;font-size:13px;color:#8E8E93;">
      Pour des raisons de sécurité, pensez à modifier votre mot de passe après votre première connexion.
    </p>
    ${loginHtml}
  `;

  return {
    subject: `🎉 Bienvenue sur ${branding.appName} — vos accès`,
    html: baseLayout(branding, "#0071E3", "🎉", `Bienvenue sur ${branding.appName}`, body),
  };
}

// ── 2. Suspension de compte ──────────────────────────────────────────────────

export function templateAccountSuspended(opts: {
  branding: MailBranding;
  userName: string;
}): { subject: string; html: string } {
  const { branding, userName } = opts;

  const body = `
    <p style="margin:0 0 4px;font-size:15px;color:#1D1D1F;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6E6E73;">
      Votre accès à <strong>${branding.appName}</strong> a été suspendu par un administrateur.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background:#FFF1F2;border:1px solid #FECDD3;border-radius:12px;padding:16px 18px;">
          <p style="margin:0;font-size:14px;color:#BE123C;">
            Vous ne pouvez plus vous connecter à la plateforme jusqu'à la réactivation de votre compte.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:20px 0 0;font-size:13px;color:#8E8E93;">
      Si vous pensez qu'il s'agit d'une erreur, rapprochez-vous de votre administrateur.
    </p>
  `;

  return {
    subject: `⚠️ Votre compte ${branding.appName} a été suspendu`,
    html: baseLayout(branding, "#DC2626", "⚠️", "Compte suspendu", body),
  };
}

// ── 3. Réactivation de compte ────────────────────────────────────────────────

export function templateAccountReactivated(opts: {
  branding: MailBranding;
  userName: string;
}): { subject: string; html: string } {
  const { branding, userName } = opts;

  const body = `
    <p style="margin:0 0 4px;font-size:15px;color:#1D1D1F;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6E6E73;">
      Votre accès à <strong>${branding.appName}</strong> a été réactivé. Vous pouvez vous reconnecter.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:16px 18px;">
          <p style="margin:0;font-size:14px;color:#15803D;">
            Votre compte est à nouveau actif — bienvenue de retour !
          </p>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `✅ Votre compte ${branding.appName} a été réactivé`,
    html: baseLayout(branding, "#16A34A", "✅", "Compte réactivé", body),
  };
}

// ── 4. Suppression de compte ─────────────────────────────────────────────────

export function templateAccountDeleted(opts: {
  branding: MailBranding;
  userName: string;
}): { subject: string; html: string } {
  const { branding, userName } = opts;

  const body = `
    <p style="margin:0 0 4px;font-size:15px;color:#1D1D1F;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6E6E73;">
      Votre compte sur <strong>${branding.appName}</strong> a été supprimé définitivement par un administrateur.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background:#F5F5F7;border-radius:12px;padding:16px 18px;">
          <p style="margin:0;font-size:14px;color:#6E6E73;">
            Toutes vos données ont été effacées. Vos certificats déjà obtenus restent disponibles si vous en avez conservé une copie.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:20px 0 0;font-size:13px;color:#8E8E93;">
      Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur.
    </p>
  `;

  return {
    subject: `Votre compte ${branding.appName} a été supprimé`,
    html: baseLayout(branding, "#6E6E73", "🗑️", "Compte supprimé", body),
  };
}

// ── 5. Affectation d'un cours ────────────────────────────────────────────────

export function templateAssignment(opts: {
  branding: MailBranding;
  userName: string;
  courseTitle: string;
  dueDate?: Date | null;
  assignedByName?: string | null;
}): { subject: string; html: string } {
  const { branding, userName, courseTitle, dueDate, assignedByName } = opts;

  const dueLine = dueDate
    ? `<p style="margin:12px 0 0;font-size:14px;color:#6E6E73;">
        <strong style="color:#1D1D1F;">Date limite&nbsp;:</strong> ${formatDate(dueDate)}
       </p>`
    : "";

  const assignedLine = assignedByName
    ? `<p style="margin:12px 0 0;font-size:13px;color:#8E8E93;">Assigné par ${assignedByName}</p>`
    : "";

  const body = `
    <p style="margin:0 0 4px;font-size:15px;color:#1D1D1F;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6E6E73;">Un nouveau cours vient de vous être assigné.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background:#F5F5F7;border-radius:12px;padding:16px 18px;">
          <p style="margin:0;font-size:16px;font-weight:700;color:#1D1D1F;">${courseTitle}</p>
          ${dueLine}
          ${assignedLine}
        </td>
      </tr>
    </table>

    <p style="margin:20px 0 0;font-size:14px;color:#6E6E73;">
      Rendez-vous sur la plateforme pour commencer votre formation.
    </p>
  `;

  return {
    subject: `📚 Nouveau cours assigné : ${courseTitle}`,
    html: baseLayout(branding, "#0071E3", "📚", "Nouveau cours assigné", body),
  };
}

// ── 2. Deadline approchante ──────────────────────────────────────────────────

export function templateDeadlineWarning(opts: {
  branding: MailBranding;
  userName: string;
  courseTitle: string;
  dueDate: Date;
  daysLeft: number;
}): { subject: string; html: string } {
  const { branding, userName, courseTitle, dueDate, daysLeft } = opts;

  const urgency = daysLeft <= 1
    ? "plus qu'<strong>1 jour</strong>"
    : `plus que <strong>${daysLeft} jours</strong>`;

  const body = `
    <p style="margin:0 0 4px;font-size:15px;color:#1D1D1F;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6E6E73;">
      La deadline de votre cours approche — il vous reste ${urgency} pour le terminer.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background:#FFF8EC;border:1px solid #FDE68A;border-radius:12px;padding:16px 18px;">
          <p style="margin:0;font-size:16px;font-weight:700;color:#1D1D1F;">${courseTitle}</p>
          <p style="margin:8px 0 0;font-size:14px;color:#92400E;">
            <strong>Date limite&nbsp;:</strong> ${formatDate(dueDate)}
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:20px 0 0;font-size:14px;color:#6E6E73;">
      Connectez-vous maintenant pour reprendre votre formation et valider dans les temps.
    </p>
  `;

  return {
    subject: `⏰ Deadline approchante : ${courseTitle} (${daysLeft} j restant${daysLeft > 1 ? "s" : ""})`,
    html: baseLayout(branding, "#D97706", "⏰", "Deadline approchante", body),
  };
}

// ── 3. Deadline dépassée ─────────────────────────────────────────────────────

export function templateCreatorPromoted(opts: {
  branding: MailBranding;
  userName: string;
  managerName: string;
}): { subject: string; html: string } {
  const { branding, userName, managerName } = opts;

  const body = `
    <p style="margin:0 0 4px;font-size:15px;color:#1D1D1F;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6E6E73;">
      <strong>${managerName}</strong> vous a accordé le rôle <strong>Créateur</strong> sur <strong>${branding.appName}</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:16px 18px;">
          <p style="margin:0;font-size:14px;color:#92400E;">
            Vous pouvez désormais <strong>créer et publier des cours</strong> ainsi que les affecter aux apprenants de votre équipe.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:20px 0 0;font-size:14px;color:#6E6E73;">
      Connectez-vous à la plateforme pour commencer à créer votre premier cours.
    </p>
  `;

  return {
    subject: `✨ Vous êtes maintenant Créateur sur ${branding.appName}`,
    html: baseLayout(branding, "#D97706", "✨", "Rôle Créateur accordé", body),
  };
}

export function templateCreatorDemoted(opts: {
  branding: MailBranding;
  userName: string;
  managerName: string;
}): { subject: string; html: string } {
  const { branding, userName, managerName } = opts;

  const body = `
    <p style="margin:0 0 4px;font-size:15px;color:#1D1D1F;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6E6E73;">
      <strong>${managerName}</strong> a retiré votre rôle <strong>Créateur</strong> sur <strong>${branding.appName}</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background:#F5F5F7;border-radius:12px;padding:16px 18px;">
          <p style="margin:0;font-size:14px;color:#6E6E73;">
            Votre accès aux cours reste actif en tant qu'<strong>Apprenant</strong>. Vous ne pouvez plus créer ni publier de cours.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:20px 0 0;font-size:13px;color:#8E8E93;">
      Si vous pensez qu'il s'agit d'une erreur, contactez votre manager.
    </p>
  `;

  return {
    subject: `Votre rôle Créateur a été retiré sur ${branding.appName}`,
    html: baseLayout(branding, "#6E6E73", "ℹ️", "Rôle Créateur retiré", body),
  };
}

export function templateDeadlineExpired(opts: {
  branding: MailBranding;
  userName: string;
  courseTitle: string;
  dueDate: Date;
}): { subject: string; html: string } {
  const { branding, userName, courseTitle, dueDate } = opts;

  const body = `
    <p style="margin:0 0 4px;font-size:15px;color:#1D1D1F;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6E6E73;">
      La deadline de votre cours est dépassée. Rapprochez-vous de votre responsable si nécessaire.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background:#FFF1F2;border:1px solid #FECDD3;border-radius:12px;padding:16px 18px;">
          <p style="margin:0;font-size:16px;font-weight:700;color:#1D1D1F;">${courseTitle}</p>
          <p style="margin:8px 0 0;font-size:14px;color:#BE123C;">
            <strong>Date limite dépassée&nbsp;:</strong> ${formatDate(dueDate)}
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:20px 0 0;font-size:14px;color:#6E6E73;">
      Vous pouvez toujours terminer ce cours en accédant à la plateforme.
    </p>
  `;

  return {
    subject: `🔴 Deadline dépassée : ${courseTitle}`,
    html: baseLayout(branding, "#DC2626", "🔴", "Deadline dépassée", body),
  };
}
