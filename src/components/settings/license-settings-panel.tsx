"use client";

import { useState, useEffect, useCallback } from "react";

interface LicenseStatus {
  activated: boolean;
  licenseId?: string;
  company?: string;
  email?: string;
  expiresAt?: string | null;
  expired?: boolean;
  daysLeft?: number | null;
  renewalInProgress?: boolean;
  history: { licenseId: string; company: string; email: string; expiresAt: string | null; replacedAt: string }[];
}

export function LicenseSettingsPanel() {
  const [status,       setStatus]       = useState<LicenseStatus | null>(null);
  const [unlocked,     setUnlocked]     = useState(false);
  const [password,     setPassword]     = useState("");
  const [showPwd,      setShowPwd]      = useState(false);
  const [pwdError,     setPwdError]     = useState<string | null>(null);
  const [pwdLoading,   setPwdLoading]   = useState(false);
  const [token,        setToken]        = useState("");
  const [saving,       setSaving]       = useState(false);
  const [saveResult,   setSaveResult]   = useState<{ ok?: boolean; error?: string; backupOk?: boolean } | null>(null);

  const loadStatus = useCallback(async () => {
    const data = await fetch("/api/admin/license/status").then(r => r.json());
    setStatus(data);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setPwdLoading(true);
    setPwdError(null);
    try {
      const res  = await fetch("/api/auth/confirm-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        setUnlocked(true);
        setPassword("");
      } else {
        setPwdError(data.error ?? "Mot de passe incorrect.");
      }
    } catch {
      setPwdError("Erreur réseau.");
    } finally {
      setPwdLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const endpoint = status?.activated ? "/api/admin/license/renew" : "/api/admin/license/activate";
      const res  = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token: token.replace(/\s+/g, "") }),
      });
      const data = await res.json();
      setSaveResult(data);
      if (data.ok) {
        setToken("");
        setUnlocked(false);
        await loadStatus();
      }
    } catch {
      setSaveResult({ error: "Erreur réseau." });
    } finally {
      setSaving(false);
    }
  }

  const badgeColor = !status?.activated
    ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
    : status.expired
    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    : (status.daysLeft ?? 999) < 30
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";

  const badgeLabel = !status?.activated
    ? "Non activée"
    : status.expired
    ? "Expirée"
    : (status.daysLeft ?? 999) < 30
    ? `Expire dans ${status.daysLeft} j`
    : "Active";

  const expiryDate = status?.expiresAt
    ? new Date(status.expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] p-6 space-y-5">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Licence</h2>
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">Gestion de la licence applicative.</p>
        </div>
        <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full ${badgeColor}`}>
          {badgeLabel}
        </span>
      </div>

      {/* Infos licence courante */}
      {status?.activated && (
        <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
          <dt className="text-[#6E6E73] dark:text-[#8E8E93]">Société</dt>
          <dd className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{status.company}</dd>
          <dt className="text-[#6E6E73] dark:text-[#8E8E93]">Email</dt>
          <dd className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{status.email}</dd>
          <dt className="text-[#6E6E73] dark:text-[#8E8E93]">Expiration</dt>
          <dd className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{expiryDate ?? "Aucune"}</dd>
          <dt className="text-[#6E6E73] dark:text-[#8E8E93]">ID</dt>
          <dd className="font-mono text-[11px] text-[#8E8E93] dark:text-[#6E6E73] truncate">{status.licenseId}</dd>
        </dl>
      )}

      {!status?.activated && !unlocked && (
        <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">Aucune licence active.</p>
      )}

      {status?.renewalInProgress && (
        <p className="text-[13px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          ⏳ Renouvellement en cours — l&apos;application reste accessible.
        </p>
      )}

      {/* Séparateur */}
      <div className="border-t border-[#F5F5F7] dark:border-[#2C2C2E]" />

      {/* Étape 1 : confirmation mot de passe */}
      {!unlocked ? (
        <form onSubmit={handleUnlock} className="space-y-3">
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
            Confirmez votre mot de passe admin pour {status?.activated ? "modifier" : "activer"} la licence.
          </p>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mot de passe"
              autoComplete="current-password"
              disabled={pwdLoading}
              className="w-full rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-2.5 pr-10 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F] dark:focus:ring-[#F5F5F7]"
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] text-[11px]"
            >
              {showPwd ? "Masquer" : "Voir"}
            </button>
          </div>
          {pwdError && (
            <p className="text-[12px] text-red-600 dark:text-red-400">{pwdError}</p>
          )}
          <button
            type="submit"
            disabled={pwdLoading || !password}
            className="w-full rounded-xl bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] text-[13px] font-medium py-2.5 disabled:opacity-40 hover:opacity-80 transition-opacity"
          >
            {pwdLoading ? "Vérification…" : "Déverrouiller"}
          </button>
        </form>
      ) : (
        /* Étape 2 : saisie du token */
        <form onSubmit={handleSave} className="space-y-3">
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
            {status?.activated
              ? "Collez le token de renouvellement fourni par votre prestataire."
              : "Collez la clé de licence fournie par votre prestataire."}
            {status?.activated && (
              <span className="block text-[12px] mt-0.5 text-amber-600 dark:text-amber-400">
                Un backup automatique sera effectué avant le renouvellement.
              </span>
            )}
          </p>
          <textarea
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Collez ici la clé de licence…"
            rows={4}
            disabled={saving}
            className="w-full rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-2.5 text-[12px] font-mono text-[#1D1D1F] dark:text-[#F5F5F7] resize-none focus:outline-none focus:ring-2 focus:ring-[#1D1D1F] dark:focus:ring-[#F5F5F7]"
          />
          {saveResult?.error && (
            <p className="text-[12px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {saveResult.error}
            </p>
          )}
          {saveResult?.ok && (
            <p className="text-[12px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
              ✅ {status?.activated ? "Licence renouvelée" : "Licence activée"} avec succès.
              {saveResult.backupOk === false && " ⚠️ Backup non effectué (licence expirée)."}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setUnlocked(false); setSaveResult(null); setToken(""); }}
              className="flex-1 rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] text-[13px] font-medium py-2.5 text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !token.trim()}
              className="flex-1 rounded-xl bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] text-[13px] font-medium py-2.5 disabled:opacity-40 hover:opacity-80 transition-opacity"
            >
              {saving ? "Traitement…" : status?.activated ? "Renouveler" : "Activer"}
            </button>
          </div>
        </form>
      )}

      {/* Historique */}
      {status?.history && status.history.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[12px] font-medium text-[#6E6E73] dark:text-[#8E8E93] uppercase tracking-wide">Historique</p>
          {status.history.map((h, i) => (
            <div key={i} className="flex items-center justify-between text-[12px] py-1.5 border-b border-[#F5F5F7] dark:border-[#2C2C2E] last:border-0">
              <div>
                <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{h.company}</span>
                <span className="text-[#6E6E73] dark:text-[#8E8E93] ml-1.5">{h.email}</span>
              </div>
              <span className="text-[#8E8E93] dark:text-[#6E6E73]">
                remplacée le {new Date(h.replacedAt).toLocaleDateString("fr-FR")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
