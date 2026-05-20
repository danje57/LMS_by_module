"use client";

import { useState, useEffect } from "react";
import { Mail, Server, Cloud, CheckCircle, AlertCircle, Send, Eye, EyeOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Provider = "smtp" | "graph";

interface MailSettingsData {
  provider: Provider;
  fromName: string;
  appUrl: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  graphTenantId: string;
  graphClientId: string;
  graphClientSecret: string;
  graphFrom: string;
  cronSecret: string;
  hasSmtpPass?: boolean;
  hasGraphSecret?: boolean;
  hasCronSecret?: boolean;
}

const EMPTY: MailSettingsData = {
  provider: "smtp",
  fromName: "LMS Notifications",
  appUrl: "",
  smtpHost: "smtp.gmail.com",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "",
  graphTenantId: "",
  graphClientId: "",
  graphClientSecret: "",
  graphFrom: "",
  cronSecret: "",
};

const fieldClass = "w-full h-11 px-3.5 rounded-xl border border-[#D2D2D7] bg-white text-[14px] text-[#1D1D1F] outline-none transition-all focus:border-[#0071E3] focus:ring-3 focus:ring-[#0071E3]/20 placeholder:text-[#ADADB8]";
const labelClass = "block text-[13px] font-medium text-[#1D1D1F] mb-1";
const hintClass = "text-[12px] text-[#8E8E93] mt-1";

function PasswordInput({ id, name, placeholder, hasExisting }: {
  id: string; name: string; placeholder?: string; hasExisting?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id} name={name} type={show ? "text" : "password"}
        placeholder={hasExisting ? "••••••••  (laisser vide pour conserver)" : placeholder}
        className={cn(fieldClass, "pr-10")}
      />
      <button type="button" onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1D1D1F] transition-colors">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function MailSettingsForm() {
  const [data, setData] = useState<MailSettingsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/mail-settings")
      .then((r) => r.json())
      .then((d) => { if (d) setData({ ...EMPTY, ...d }); })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      provider: fd.get("provider") as Provider,
      fromName: fd.get("fromName") as string,
      appUrl: fd.get("appUrl") as string,
      smtpHost: fd.get("smtpHost") as string,
      smtpPort: Number(fd.get("smtpPort")),
      smtpSecure: fd.get("smtpSecure") === "on",
      smtpUser: fd.get("smtpUser") as string,
      smtpPass: fd.get("smtpPass") as string,
      smtpFrom: fd.get("smtpFrom") as string,
      graphTenantId: fd.get("graphTenantId") as string,
      graphClientId: fd.get("graphClientId") as string,
      graphClientSecret: fd.get("graphClientSecret") as string,
      graphFrom: fd.get("graphFrom") as string,
      cronSecret: fd.get("cronSecret") as string,
    };
    const res = await fetch("/api/admin/mail-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setMsg({ type: "success", text: "Paramètres mail enregistrés." });
      // Rafraîchir pour mettre à jour hasSmtpPass / hasGraphSecret
      const refreshed = await fetch("/api/admin/mail-settings").then((r) => r.json());
      if (refreshed) setData((prev) => ({ ...prev, ...refreshed }));
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg({ type: "error", text: d.error ?? "Erreur lors de l'enregistrement." });
    }
    setSaving(false);
  }

  async function handleTest() {
    setTesting(true);
    setMsg(null);
    const res = await fetch("/api/admin/mail-settings/test", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ type: "success", text: `Email de test envoyé à ${d.sentTo}.` });
    } else {
      setMsg({ type: "error", text: d.error ?? "Échec de l'envoi." });
    }
    setTesting(false);
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E5EA] p-7 flex items-center gap-3 text-[#8E8E93]">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-[14px]">Chargement des paramètres…</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] p-7 space-y-7">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <Mail className="w-4 h-4 text-[#0071E3]" />
        </div>
        <div>
          <h2 className="text-[17px] font-semibold text-[#1D1D1F]">Notifications email</h2>
          <p className="text-[13px] text-[#6E6E73]">Configuration de l&apos;envoi d&apos;emails (affectations, deadlines).</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Fournisseur */}
        <div>
          <input type="hidden" name="provider" value={data.provider} />
          <p className={labelClass}>Fournisseur</p>
          <div className="flex gap-2 mt-1">
            {([
              { v: "smtp", icon: Server, label: "SMTP", desc: "Gmail, Exchange SMTP AUTH, tout serveur SMTP" },
              { v: "graph", icon: Cloud, label: "Microsoft Graph", desc: "Exchange Online / Microsoft 365 (OAuth2)" },
            ] as const).map(({ v, icon: Icon, label, desc }) => (
              <button key={v} type="button"
                onClick={() => setData((d) => ({ ...d, provider: v }))}
                className={cn(
                  "flex-1 flex items-start gap-3 px-4 py-3.5 rounded-xl border text-left transition-all",
                  data.provider === v
                    ? "border-[#0071E3] bg-blue-50/60 ring-2 ring-[#0071E3]/20"
                    : "border-[#E5E5EA] hover:border-[#D2D2D7]"
                )}>
                <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", data.provider === v ? "text-[#0071E3]" : "text-[#8E8E93]")} />
                <div>
                  <p className={cn("text-[13px] font-semibold", data.provider === v ? "text-[#0071E3]" : "text-[#1D1D1F]")}>{label}</p>
                  <p className="text-[11px] text-[#8E8E93] mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-[#F5F5F7]" />

        {/* Paramètres communs */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="fromName" className={labelClass}>Nom de l&apos;expéditeur</label>
            <input id="fromName" name="fromName" defaultValue={data.fromName} placeholder="LMS Notifications" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="appUrl" className={labelClass}>URL de l&apos;application</label>
            <input id="appUrl" name="appUrl" type="url" defaultValue={data.appUrl} placeholder="https://votre-domaine.com" className={fieldClass} />
            <p className={hintClass}>Lien inclus dans les emails.</p>
          </div>
        </div>

        <div className="h-px bg-[#F5F5F7]" />

        {/* SMTP */}
        {data.provider === "smtp" && (
          <div className="space-y-4">
            <p className="text-[13px] font-semibold text-[#1D1D1F] flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-[#8E8E93]" /> Configuration SMTP
            </p>

            <div className="bg-[#F5F5F7] rounded-xl px-4 py-3 text-[12px] text-[#6E6E73] space-y-1">
              <p><strong>Gmail</strong> : smtp.gmail.com · port 587 · sécurisé : non · mot de passe d&apos;application requis</p>
              <p><strong>Exchange Online</strong> : smtp.office365.com · port 587 · sécurisé : non · SMTP AUTH doit être activé</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="smtpHost" className={labelClass}>Serveur SMTP</label>
                <input id="smtpHost" name="smtpHost" defaultValue={data.smtpHost} placeholder="smtp.gmail.com" className={fieldClass} />
              </div>
              <div>
                <label htmlFor="smtpPort" className={labelClass}>Port</label>
                <input id="smtpPort" name="smtpPort" type="number" defaultValue={data.smtpPort} className={fieldClass} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input id="smtpSecure" name="smtpSecure" type="checkbox" defaultChecked={data.smtpSecure}
                className="w-4 h-4 rounded text-[#0071E3] accent-[#0071E3]" />
              <label htmlFor="smtpSecure" className="text-[13px] text-[#1D1D1F]">
                Connexion sécurisée TLS/SSL (port 465)
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="smtpUser" className={labelClass}>Identifiant (email)</label>
                <input id="smtpUser" name="smtpUser" defaultValue={data.smtpUser} placeholder="vous@gmail.com" className={fieldClass} />
              </div>
              <div>
                <label htmlFor="smtpPass" className={labelClass}>Mot de passe / App password</label>
                <PasswordInput id="smtpPass" name="smtpPass" hasExisting={data.hasSmtpPass} placeholder="xxxx xxxx xxxx xxxx" />
              </div>
            </div>

            <div>
              <label htmlFor="smtpFrom" className={labelClass}>Adresse d&apos;envoi</label>
              <input id="smtpFrom" name="smtpFrom" type="email" defaultValue={data.smtpFrom} placeholder="notifications@votre-domaine.com" className={fieldClass} />
              <p className={hintClass}>Adresse affichée dans le champ &quot;De&quot; des emails reçus.</p>
            </div>
          </div>
        )}

        {/* Microsoft Graph */}
        {data.provider === "graph" && (
          <div className="space-y-4">
            <p className="text-[13px] font-semibold text-[#1D1D1F] flex items-center gap-2">
              <Cloud className="w-3.5 h-3.5 text-[#8E8E93]" /> Microsoft Graph API
            </p>

            <div className="bg-[#F5F5F7] rounded-xl px-4 py-3 text-[12px] text-[#6E6E73] space-y-1">
              <p>1. Créer une app dans <strong>Azure AD (Entra ID)</strong></p>
              <p>2. Accorder l&apos;autorisation d&apos;application : <strong>Mail.Send</strong></p>
              <p>3. Créer un <strong>secret client</strong> et le coller ci-dessous</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="graphTenantId" className={labelClass}>Tenant ID</label>
                <input id="graphTenantId" name="graphTenantId" defaultValue={data.graphTenantId}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className={fieldClass} />
              </div>
              <div>
                <label htmlFor="graphClientId" className={labelClass}>Client ID (Application ID)</label>
                <input id="graphClientId" name="graphClientId" defaultValue={data.graphClientId}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className={fieldClass} />
              </div>
            </div>

            <div>
              <label htmlFor="graphClientSecret" className={labelClass}>Secret client</label>
              <PasswordInput id="graphClientSecret" name="graphClientSecret" hasExisting={data.hasGraphSecret} placeholder="Votre secret client Azure AD" />
            </div>

            <div>
              <label htmlFor="graphFrom" className={labelClass}>Adresse d&apos;envoi (boîte Exchange autorisée)</label>
              <input id="graphFrom" name="graphFrom" type="email" defaultValue={data.graphFrom}
                placeholder="notifications@votre-domaine.com" className={fieldClass} />
            </div>
          </div>
        )}

        <div className="h-px bg-[#F5F5F7]" />

        {/* Cron secret */}
        <div>
          <label htmlFor="cronSecret" className={labelClass}>Secret cron</label>
          <PasswordInput id="cronSecret" name="cronSecret" hasExisting={!!data.hasCronSecret}
            placeholder="Générez un token aléatoire fort" />
          <p className={hintClass}>
            Protège le endpoint <code className="bg-[#F5F5F7] px-1 py-0.5 rounded text-[11px]">/api/cron/notifications</code>.
            Appel Linux (8h chaque matin) :{" "}
            <code className="bg-[#F5F5F7] px-1 py-0.5 rounded text-[11px]">
              0 8 * * * curl -s -H &quot;Authorization: Bearer VOTRE_SECRET&quot; https://votre-domaine.com/api/cron/notifications
            </code>
          </p>
        </div>

        {/* Messages */}
        {msg && (
          <div className={cn(
            "flex items-center gap-2.5 px-4 py-3 rounded-xl border text-[13px] font-medium",
            msg.type === "success"
              ? "bg-green-50 border-green-100 text-green-700"
              : "bg-red-50 border-red-100 text-red-600"
          )}>
            {msg.type === "success"
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            {msg.text}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={saving}
            className="h-11 px-6 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium rounded-xl transition-colors disabled:opacity-60">
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button type="button" onClick={handleTest} disabled={testing || saving}
            className="h-11 px-5 flex items-center gap-2 border border-[#D2D2D7] text-[14px] font-medium text-[#1D1D1F] rounded-xl hover:bg-[#F5F5F7] transition-colors disabled:opacity-50">
            <Send className="w-3.5 h-3.5" />
            {testing ? "Envoi…" : "Envoyer un email de test"}
          </button>
        </div>
      </form>
    </div>
  );
}
