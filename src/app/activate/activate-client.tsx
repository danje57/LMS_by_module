"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  isRenewal:      boolean;
  expired:        boolean;
  currentCompany: string | null;
  currentEmail:   string | null;
  currentExpiry:  string | null;
}

export function ActivateClient({ isRenewal, expired, currentCompany, currentEmail, currentExpiry }: Props) {
  const [token,     setToken]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [activated, setActivated] = useState(false);

  // Recovery state (shown after activation if recoverable content exists)
  const [recovering,        setRecovering]        = useState(false);
  const [recoverResult,     setRecoverResult]      = useState<{ courses?: number; videos?: number; errors?: number } | null>(null);
  const [recoverableCount,  setRecoverableCount]   = useState<number | null>(null);

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint = isRenewal ? "/api/admin/license/renew" : "/api/admin/license/activate";
      const res  = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setActivated(true);
        // Check for recoverable content (reinstall scenario)
        const checkRes = await fetch("/api/admin/license/recover-keys");
        if (checkRes.ok) {
          const { recoverableContent } = await checkRes.json();
          setRecoverableCount(recoverableContent);
          if (recoverableContent === 0) {
            router.push("/dashboard");
            router.refresh();
          }
        } else {
          router.push("/dashboard");
          router.refresh();
        }
      } else {
        setError(data.error ?? "Erreur lors de l'activation");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecover() {
    setRecovering(true);
    try {
      const res  = await fetch("/api/admin/license/recover-keys", { method: "POST" });
      const data = await res.json();
      setRecoverResult(data);
    } catch {
      setRecoverResult({ errors: 1 });
    } finally {
      setRecovering(false);
    }
  }

  const expiryDate = currentExpiry
    ? new Date(currentExpiry).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0A0A0F] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-lg p-8 space-y-6">

        {/* En-tête */}
        <div className="text-center space-y-2">
          <div className="text-4xl">{expired ? "⚠️" : isRenewal ? "🔄" : "🔐"}</div>
          <h1 className="text-[22px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {expired ? "Licence expirée" : isRenewal ? "Renouveler la licence" : "Activation de la licence"}
          </h1>
          {expired && currentCompany && (
            <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
              Licence <span className="font-medium">{currentCompany}</span> expirée
              {expiryDate && <> le {expiryDate}</>}.
            </p>
          )}
          {!isRenewal && (
            <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
              Saisissez la clé de licence fournie pour activer l&apos;application.
            </p>
          )}
          {isRenewal && !expired && (
            <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93]">
              Licence actuelle : <span className="font-medium">{currentCompany}</span>
              {expiryDate && <> — expire le {expiryDate}</>}
            </p>
          )}
        </div>

        {/* Récupération des clés après réinstallation */}
        {activated && recoverableCount !== null && recoverableCount > 0 && !recoverResult && (
          <div className="space-y-3">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3 space-y-2">
              <p className="text-[13px] font-medium text-amber-800 dark:text-amber-300">
                Réinstallation détectée
              </p>
              <p className="text-[13px] text-amber-700 dark:text-amber-400">
                {recoverableCount} fichier{recoverableCount > 1 ? "s" : ""} chiffré{recoverableCount > 1 ? "s" : ""} nécessite{recoverableCount > 1 ? "nt" : ""} une restauration
                des clés d&apos;accès.
              </p>
            </div>
            <button
              onClick={handleRecover}
              disabled={recovering}
              className="w-full rounded-xl bg-amber-600 text-white text-[14px] font-medium py-2.5 disabled:opacity-40 hover:opacity-80 transition-opacity"
            >
              {recovering ? "Restauration en cours…" : "Restaurer l'accès au contenu"}
            </button>
          </div>
        )}

        {recoverResult && (
          <div className="space-y-3">
            <div className={`rounded-xl px-4 py-3 text-[13px] ${recoverResult.errors && recoverResult.errors > 0 ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"}`}>
              {recoverResult.errors && recoverResult.errors > 0
                ? `⚠️ Restauration partielle : ${recoverResult.courses ?? 0} cours, ${recoverResult.videos ?? 0} vidéos restaurés, ${recoverResult.errors} erreurs.`
                : `✅ Restauration réussie : ${recoverResult.courses ?? 0} cours et ${recoverResult.videos ?? 0} vidéos accessibles.`
              }
            </div>
            <button
              onClick={() => { router.push("/dashboard"); router.refresh(); }}
              className="w-full rounded-xl bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] text-[14px] font-medium py-2.5 hover:opacity-80 transition-opacity"
            >
              Accéder au tableau de bord
            </button>
          </div>
        )}

        {/* Formulaire principal */}
        {!activated && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5">
                Clé de licence
              </label>
              <textarea
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Collez ici la clé de licence reçue…"
                rows={5}
                className="w-full rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-2.5 text-[13px] font-mono text-[#1D1D1F] dark:text-[#F5F5F7] resize-none focus:outline-none focus:ring-2 focus:ring-[#1D1D1F] dark:focus:ring-[#F5F5F7]"
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-[13px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full rounded-xl bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] text-[14px] font-medium py-3 disabled:opacity-40 hover:opacity-80 transition-opacity"
            >
              {loading ? "Vérification…" : isRenewal ? "Renouveler" : "Activer"}
            </button>
          </form>
        )}

        {!activated && (
          <p className="text-center text-[11px] text-[#8E8E93] dark:text-[#6E6E73]">
            Contactez votre fournisseur de licence pour obtenir une clé valide.
          </p>
        )}
      </div>
    </div>
  );
}
