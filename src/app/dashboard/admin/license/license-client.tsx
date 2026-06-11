"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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

export function LicenseClient() {
  const [status,           setStatus]          = useState<LicenseStatus | null>(null);
  const [unlocked,         setUnlocked]         = useState(false);
  const [password,         setPassword]         = useState("");
  const [showPwd,          setShowPwd]          = useState(false);
  const [pwdError,         setPwdError]         = useState<string | null>(null);
  const [pwdLoading,       setPwdLoading]       = useState(false);
  const [token,            setToken]            = useState("");
  const [loading,          setLoading]          = useState(false);
  const [result,           setResult]           = useState<{ ok?: boolean; error?: string; backupOk?: boolean } | null>(null);
  const [recovering,       setRecovering]       = useState(false);
  const [recoverResult,    setRecoverResult]    = useState<{ ok?: boolean; courses?: number; videos?: number; errors?: number } | null>(null);
  const [recoverableCount, setRecoverableCount] = useState<number | null>(null);
  const router = useRouter();

  const loadStatus = useCallback(async () => {
    const data = await fetch("/api/admin/license/status").then(r => r.json());
    setStatus(data);
  }, []);

  const checkRecoverable = useCallback(async () => {
    const res = await fetch("/api/admin/license/recover-keys");
    if (res.ok) { const { recoverableContent } = await res.json(); setRecoverableCount(recoverableContent); }
  }, []);

  useEffect(() => { loadStatus(); checkRecoverable(); }, [loadStatus, checkRecoverable]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setPwdLoading(true);
    setPwdError(null);
    try {
      const res  = await fetch("/api/auth/confirm-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) { setUnlocked(true); setPassword(""); }
      else setPwdError(data.error ?? "Mot de passe incorrect.");
    } catch {
      setPwdError("Erreur réseau.");
    } finally {
      setPwdLoading(false);
    }
  }

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res  = await fetch("/api/admin/license/renew", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token: token.replace(/\s+/g, "") }),
      });
      const data = await res.json();
      setResult(data);
      if (data.ok) {
        setToken("");
        await loadStatus();
        await checkRecoverable();
        router.refresh();
      }
    } catch {
      setResult({ error: "Erreur réseau" });
    } finally {
      setLoading(false);
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
          Licence
        </h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
          Gestion de la licence applicative.
        </p>
      </div>

      {/* Licence courante */}
      <div className="rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Licence courante</h2>
          <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full ${badgeColor}`}>
            {badgeLabel}
          </span>
        </div>

        {status?.activated ? (
          <dl className="grid grid-cols-2 gap-y-3 text-[14px]">
            <dt className="text-[#6E6E73] dark:text-[#8E8E93]">Société</dt>
            <dd className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{status.company}</dd>
            <dt className="text-[#6E6E73] dark:text-[#8E8E93]">Email</dt>
            <dd className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{status.email}</dd>
            <dt className="text-[#6E6E73] dark:text-[#8E8E93]">Expiration</dt>
            <dd className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{expiryDate ?? "Aucune"}</dd>
            <dt className="text-[#6E6E73] dark:text-[#8E8E93]">ID Licence</dt>
            <dd className="font-mono text-[12px] text-[#6E6E73] dark:text-[#8E8E93] truncate">{status.licenseId}</dd>
          </dl>
        ) : (
          <p className="text-[14px] text-[#6E6E73] dark:text-[#8E8E93]">Aucune licence active.</p>
        )}

        {status?.renewalInProgress && (
          <div className="text-[13px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
            ⏳ Renouvellement en cours — l&apos;application reste accessible.
          </div>
        )}
      </div>

      {/* Renouvellement */}
      <div className="rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] p-6 space-y-4">
        <h2 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
          {status?.activated ? "Renouveler la licence" : "Activer la licence"}
        </h2>

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
                className="w-full rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-2.5 pr-16 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F] dark:focus:ring-[#F5F5F7]"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
              >
                {showPwd ? "Masquer" : "Voir"}
              </button>
            </div>
            {pwdError && (
              <p className="text-[13px] text-red-600 dark:text-red-400">{pwdError}</p>
            )}
            <button
              type="submit"
              disabled={pwdLoading || !password}
              className="w-full rounded-xl bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] text-[14px] font-medium py-2.5 disabled:opacity-40 hover:opacity-80 transition-opacity"
            >
              {pwdLoading ? "Vérification…" : "Déverrouiller"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRenew} className="space-y-3">
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
              rows={5}
              disabled={loading}
              className="w-full rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-2.5 text-[13px] font-mono text-[#1D1D1F] dark:text-[#F5F5F7] resize-none focus:outline-none focus:ring-2 focus:ring-[#1D1D1F] dark:focus:ring-[#F5F5F7]"
            />
            {result?.error && (
              <p className="text-[13px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                {result.error}
              </p>
            )}
            {result?.ok && (
              <p className="text-[13px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                ✅ Licence {status?.activated ? "renouvelée" : "activée"} avec succès.
                {result.backupOk === false && " ⚠️ Backup non effectué (licence était expirée)."}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setUnlocked(false); setResult(null); setToken(""); }}
                className="flex-1 rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] text-[14px] font-medium py-2.5 text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || !token.trim()}
                className="flex-1 rounded-xl bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] text-[14px] font-medium py-2.5 disabled:opacity-40 hover:opacity-80 transition-opacity"
              >
                {loading ? "Traitement en cours…" : status?.activated ? "Renouveler" : "Activer"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Récupération clés (réinstallation) */}
      {recoverableCount !== null && recoverableCount > 0 && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-6 space-y-4">
          <div>
            <h2 className="text-[17px] font-semibold text-amber-800 dark:text-amber-300">Restauration d&apos;accès</h2>
            <p className="text-[13px] text-amber-700 dark:text-amber-400 mt-1">
              {recoverableCount} fichier{recoverableCount > 1 ? "s chiffrés ont" : " chiffré a"} une clé de récupération disponible.
              Si vous venez de réinstaller l&apos;application, restaurez l&apos;accès au contenu.
            </p>
          </div>
          {!recoverResult && (
            <button
              onClick={async () => {
                setRecovering(true);
                try {
                  const res  = await fetch("/api/admin/license/recover-keys", { method: "POST" });
                  const data = await res.json();
                  setRecoverResult(data);
                  setRecoverableCount(0);
                } catch { setRecoverResult({ errors: 1 }); } finally { setRecovering(false); }
              }}
              disabled={recovering}
              className="w-full rounded-xl bg-amber-600 text-white text-[14px] font-medium py-2.5 disabled:opacity-40 hover:opacity-80 transition-opacity"
            >
              {recovering ? "Restauration en cours…" : "Restaurer l'accès au contenu"}
            </button>
          )}
          {recoverResult && (
            <p className={`text-[13px] rounded-lg px-3 py-2 ${recoverResult.errors ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"}`}>
              {recoverResult.errors
                ? `⚠️ Partiel : ${recoverResult.courses ?? 0} cours, ${recoverResult.videos ?? 0} vidéos restaurés, ${recoverResult.errors} erreurs.`
                : `✅ Restauration réussie : ${recoverResult.courses ?? 0} cours et ${recoverResult.videos ?? 0} vidéos.`}
            </p>
          )}
        </div>
      )}

      {/* Historique */}
      {status?.history && status.history.length > 0 && (
        <div className="rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] p-6 space-y-3">
          <h2 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Historique</h2>
          <div className="space-y-2">
            {status.history.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-[13px] py-2 border-b border-[#F5F5F7] dark:border-[#2C2C2E] last:border-0">
                <div>
                  <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{h.company}</span>
                  <span className="text-[#6E6E73] dark:text-[#8E8E93] ml-2">{h.email}</span>
                </div>
                <div className="text-[#6E6E73] dark:text-[#8E8E93] text-right">
                  <div>Remplacée le {new Date(h.replacedAt).toLocaleDateString("fr-FR")}</div>
                  {h.expiresAt && <div className="text-[11px]">expirait le {new Date(h.expiresAt).toLocaleDateString("fr-FR")}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
