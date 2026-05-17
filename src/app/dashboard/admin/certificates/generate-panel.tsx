"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp, X } from "lucide-react";

interface User { id: string; name: string | null; email: string; isActive: boolean }
interface Course { id: string; title: string; hasQuiz: boolean }

export function GeneratePanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [showUsers, setShowUsers] = useState(true);
  const [showCourses, setShowCourses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ generated: number; skipped: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/users").then(r => r.json()).then((data: User[]) =>
      setUsers(data.filter(u => u.isActive))
    ).catch(() => {});
    fetch("/api/admin/courses").then(r => r.json()).then(setCourses).catch(() => {});
  }, []);

  const toggleUser = (id: string) =>
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleCourse = (id: string) =>
    setSelectedCourses(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const filteredUsers = users.filter(u =>
    (u.name ?? u.email).toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredCourses = courses.filter(c =>
    c.title.toLowerCase().includes(courseSearch.toLowerCase())
  );

  const handleGenerate = async () => {
    if (selectedUsers.length === 0 || selectedCourses.length === 0) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/admin/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedUsers, courseIds: selectedCourses }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResult(data);
      setSelectedUsers([]);
      setSelectedCourses([]);
    } catch {
      setError("Une erreur s'est produite.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-semibold text-[#1D1D1F]">Générer des certificats</h2>
        <p className="text-[14px] text-[#6E6E73] mt-0.5">
          Marque les cours comme terminés et émet les certificats pour les apprenants sélectionnés.
          Les certificats existants ne sont pas recréés.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Users */}
        <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden">
          <button
            onClick={() => setShowUsers(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <span className="text-[14px] font-semibold text-[#1D1D1F]">
              Apprenants
              {selectedUsers.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0071E3] text-[11px] font-bold text-white">
                  {selectedUsers.length}
                </span>
              )}
            </span>
            {showUsers ? <ChevronUp className="w-4 h-4 text-[#6E6E73]" /> : <ChevronDown className="w-4 h-4 text-[#6E6E73]" />}
          </button>

          {showUsers && (
            <div className="border-t border-[#F2F2F7]">
              <div className="px-4 py-2.5">
                <input
                  type="text"
                  placeholder="Rechercher un apprenant…"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="w-full h-8 rounded-lg border border-[#E5E5EA] bg-[#F5F5F7] px-3 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/40"
                />
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-[#F2F2F7]">
                {filteredUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F5F5F7]">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="rounded border-[#C7C7CC] text-[#0071E3] focus:ring-[#0071E3]/40"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#1D1D1F] truncate">{u.name ?? u.email}</p>
                      {u.name && <p className="text-[11px] text-[#6E6E73] truncate">{u.email}</p>}
                    </div>
                  </label>
                ))}
                {filteredUsers.length === 0 && (
                  <p className="px-4 py-4 text-[13px] text-[#6E6E73] text-center">Aucun apprenant trouvé</p>
                )}
              </div>
              {selectedUsers.length > 0 && (
                <div className="border-t border-[#F2F2F7] px-4 py-2 flex flex-wrap gap-1.5">
                  {selectedUsers.map(id => {
                    const u = users.find(x => x.id === id);
                    return (
                      <span key={id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-[#E8F0FE] text-[11px] text-[#0071E3] font-medium">
                        {u?.name ?? u?.email}
                        <button onClick={() => toggleUser(id)} className="hover:text-[#D32F2F]"><X className="w-3 h-3" /></button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Courses */}
        <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden">
          <button
            onClick={() => setShowCourses(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <span className="text-[14px] font-semibold text-[#1D1D1F]">
              Cours
              {selectedCourses.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0071E3] text-[11px] font-bold text-white">
                  {selectedCourses.length}
                </span>
              )}
            </span>
            {showCourses ? <ChevronUp className="w-4 h-4 text-[#6E6E73]" /> : <ChevronDown className="w-4 h-4 text-[#6E6E73]" />}
          </button>

          {showCourses && (
            <div className="border-t border-[#F2F2F7]">
              <div className="px-4 py-2.5">
                <input
                  type="text"
                  placeholder="Rechercher un cours…"
                  value={courseSearch}
                  onChange={e => setCourseSearch(e.target.value)}
                  className="w-full h-8 rounded-lg border border-[#E5E5EA] bg-[#F5F5F7] px-3 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/40"
                />
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-[#F2F2F7]">
                {filteredCourses.map(c => (
                  <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F5F5F7]">
                    <input
                      type="checkbox"
                      checked={selectedCourses.includes(c.id)}
                      onChange={() => toggleCourse(c.id)}
                      className="rounded border-[#C7C7CC] text-[#0071E3] focus:ring-[#0071E3]/40"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#1D1D1F] truncate">{c.title}</p>
                      <p className="text-[11px] text-[#6E6E73]">
                        {c.hasQuiz ? "Avec évaluation" : "Sans évaluation"}
                      </p>
                    </div>
                  </label>
                ))}
                {filteredCourses.length === 0 && (
                  <p className="px-4 py-4 text-[13px] text-[#6E6E73] text-center">Aucun cours trouvé</p>
                )}
              </div>
              {selectedCourses.length > 0 && (
                <div className="border-t border-[#F2F2F7] px-4 py-2 flex flex-wrap gap-1.5">
                  {selectedCourses.map(id => {
                    const c = courses.find(x => x.id === id);
                    return (
                      <span key={id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-[#E8F0FE] text-[11px] text-[#0071E3] font-medium">
                        {c?.title}
                        <button onClick={() => toggleCourse(id)} className="hover:text-[#D32F2F]"><X className="w-3 h-3" /></button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Summary + action */}
      <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5 space-y-4">
        {selectedUsers.length > 0 && selectedCourses.length > 0 ? (
          <p className="text-[13px] text-[#3C3C43]">
            Génération de{" "}
            <strong>{selectedUsers.length * selectedCourses.length}</strong> certificat(s) max —{" "}
            <strong>{selectedUsers.length}</strong> apprenant(s) × <strong>{selectedCourses.length}</strong> cours.
            Les certificats déjà existants seront ignorés.
          </p>
        ) : (
          <p className="text-[13px] text-[#6E6E73]">
            Sélectionnez au moins un apprenant et un cours.
          </p>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || selectedUsers.length === 0 || selectedCourses.length === 0}
          className="h-9 px-5 rounded-lg bg-[#0071E3] text-[13px] font-medium text-white hover:bg-[#0077ED] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Génération en cours…" : "Générer les certificats"}
        </button>

        {result && (
          <div className="flex items-start gap-2.5 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <p className="text-[13px] text-emerald-700">
              <strong>{result.generated}</strong> certificat(s) généré(s).
              {result.skipped > 0 && <> <strong>{result.skipped}</strong> ignoré(s) (déjà existants).</>}
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-100 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-[13px] text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
