"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Award, FileText, ChevronDown, ChevronRight, Search,
  BookOpen, ShieldCheck, LayoutList, Users, UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CertRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  courseTitle: string;
  isPdf: boolean;
  hasQuiz: boolean;
  completedAt: string;
};

type GroupRow = {
  userId: string;
  userName: string;
  userEmail: string;
  teamNames: string[];
  certs: Omit<CertRow, "userId" | "userName" | "userEmail">[];
};

type TeamMemberRow = {
  userId: string;
  userName: string;
  userEmail: string;
  certs: Omit<CertRow, "userId" | "userName" | "userEmail">[];
};

type TeamGroupRow = {
  teamId: string;
  teamName: string;
  totalMembers: number;
  certCount: number;
  members: TeamMemberRow[];
};

type TableResponse   = { view: "table";   rows: CertRow[];       total: number;      page: number; limit: number };
type GroupedResponse = { view: "grouped"; groups: GroupRow[];    totalUsers: number; page: number; limit: number };
type TeamResponse    = { view: "team";    groups: TeamGroupRow[]; totalTeams: number; page: number; limit: number };

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

function TypeBadge({ isPdf }: { isPdf: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5",
      isPdf
        ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600"
        : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600",
    )}>
      {isPdf ? <FileText className="w-3 h-3" /> : <Award className="w-3 h-3" />}
      {isPdf ? "GRC" : "Formation"}
    </span>
  );
}

function Pagination({ page, total, limit, label, onChange }: {
  page: number; total: number; limit: number; label: string; onChange: (p: number) => void;
}) {
  const pages = Math.ceil(total / limit);
  return (
    <div className="flex items-center justify-between pt-4 border-t border-[#E5E5EA] dark:border-[#3A3A3C]">
      <span className="text-[12px] text-[#ADADB8]">{total} {label}{total > 1 ? "s" : ""}</span>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-[12px] border border-[#E5E5EA] dark:border-[#3A3A3C] disabled:opacity-30 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
          >‹</button>
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
            let p = i + 1;
            if (pages > 7) {
              if (page <= 4) p = i + 1;
              else if (page >= pages - 3) p = pages - 6 + i;
              else p = page - 3 + i;
            }
            return (
              <button
                key={p}
                onClick={() => onChange(p)}
                className={cn(
                  "w-8 h-8 rounded-lg text-[12px] font-medium transition-colors",
                  p === page
                    ? "bg-[#0071E3] text-white"
                    : "hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#8E8E93]",
                )}
              >{p}</button>
            );
          })}
          <button
            onClick={() => onChange(page + 1)}
            disabled={page >= pages}
            className="px-3 py-1.5 rounded-lg text-[12px] border border-[#E5E5EA] dark:border-[#3A3A3C] disabled:opacity-30 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors"
          >›</button>
        </div>
      )}
    </div>
  );
}

function TableView({ data, onPageChange }: { data: TableResponse; onPageChange: (p: number) => void }) {
  if (data.rows.length === 0) {
    return <p className="py-12 text-center text-[14px] text-[#ADADB8]">Aucun certificat trouvé</p>;
  }
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C]">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E5EA] dark:border-[#3A3A3C] bg-[#F5F5F7] dark:bg-[#2C2C2E]">
              <th className="px-4 py-3 font-semibold text-[#6E6E73] dark:text-[#8E8E93]">Apprenant</th>
              <th className="px-4 py-3 font-semibold text-[#6E6E73] dark:text-[#8E8E93]">Cours / Document</th>
              <th className="px-4 py-3 font-semibold text-[#6E6E73] dark:text-[#8E8E93]">Type</th>
              <th className="px-4 py-3 font-semibold text-[#6E6E73] dark:text-[#8E8E93]">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5EA] dark:divide-[#3A3A3C]">
            {data.rows.map((row) => (
              <tr key={row.id} className="bg-white dark:bg-[#1C1C1E] hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">{row.userName}</p>
                  <p className="text-[11px] text-[#ADADB8]">{row.userEmail}</p>
                </td>
                <td className="px-4 py-3 max-w-[220px]">
                  <p className="text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{row.courseTitle}</p>
                </td>
                <td className="px-4 py-3"><TypeBadge isPdf={row.isPdf} /></td>
                <td className="px-4 py-3 text-[#6E6E73] dark:text-[#8E8E93] whitespace-nowrap">{fmtDate(row.completedAt)}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/certificates/${row.id}`}
                    className="text-[12px] text-[#0071E3] hover:underline whitespace-nowrap"
                  >
                    Voir ↗
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={data.page} total={data.total} limit={data.limit} label="certificat" onChange={onPageChange} />
    </div>
  );
}

function CertList({ certs }: { certs: Omit<CertRow, "userId" | "userName" | "userEmail">[] }) {
  return (
    <div className="border-t border-[#E5E5EA] dark:border-[#3A3A3C] divide-y divide-[#E5E5EA] dark:divide-[#3A3A3C]">
      {certs.map((c) => (
        <div key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors">
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
            c.isPdf ? "bg-indigo-50 dark:bg-indigo-500/10" : "bg-emerald-50 dark:bg-emerald-500/10",
          )}>
            {c.isPdf
              ? <FileText className="w-3.5 h-3.5 text-indigo-500" />
              : <Award className="w-3.5 h-3.5 text-emerald-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{c.courseTitle}</p>
            <p className="text-[11px] text-[#ADADB8]">{fmtDate(c.completedAt)}</p>
          </div>
          <TypeBadge isPdf={c.isPdf} />
          <Link href={`/dashboard/certificates/${c.id}`} className="text-[12px] text-[#0071E3] hover:underline whitespace-nowrap shrink-0">
            Voir ↗
          </Link>
        </div>
      ))}
    </div>
  );
}

function GroupedView({ data, onPageChange }: { data: GroupedResponse; onPageChange: (p: number) => void }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggle(uid: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  }

  if (data.groups.length === 0) {
    return <p className="py-12 text-center text-[14px] text-[#ADADB8]">Aucun certificat trouvé</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {data.groups.map((g) => {
          const isOpen = open.has(g.userId);
          return (
            <div key={g.userId} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden">
              <button
                onClick={() => toggle(g.userId)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-[#6E6E73] dark:text-[#8E8E93]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{g.userName}</p>
                    {g.teamNames.length > 0 && (
                      <span className="text-[12px] text-[#ADADB8] truncate">— {g.teamNames.join(", ")}</span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#ADADB8]">{g.userEmail}</p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold bg-[#0071E3]/10 text-[#0071E3] rounded-full px-2 py-0.5">
                  {g.certs.length} certif.
                </span>
                {isOpen
                  ? <ChevronDown className="w-4 h-4 text-[#ADADB8] shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-[#ADADB8] shrink-0" />}
              </button>
              {isOpen && <CertList certs={g.certs} />}
            </div>
          );
        })}
      </div>
      <Pagination page={data.page} total={data.totalUsers} limit={data.limit} label="apprenant" onChange={onPageChange} />
    </div>
  );
}

function TeamView({ data, onPageChange }: { data: TeamResponse; onPageChange: (p: number) => void }) {
  const [openTeams, setOpenTeams] = useState<Set<string>>(new Set());
  const [openUsers, setOpenUsers] = useState<Set<string>>(new Set());

  function toggleTeam(id: string) {
    setOpenTeams((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleUser(id: string) {
    setOpenUsers((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  if (data.groups.length === 0) {
    return <p className="py-12 text-center text-[14px] text-[#ADADB8]">Aucune équipe trouvée</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {data.groups.map((team) => {
          const isTeamOpen = openTeams.has(team.teamId);
          return (
            <div key={team.teamId} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] overflow-hidden">
              {/* Team header */}
              <button
                onClick={() => toggleTeam(team.teamId)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center shrink-0">
                  <UsersRound className="w-4 h-4 text-[#6E6E73] dark:text-[#8E8E93]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{team.teamName}</p>
                  <p className="text-[12px] text-[#ADADB8]">{team.totalMembers} membre{team.totalMembers > 1 ? "s" : ""}</p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold bg-[#0071E3]/10 text-[#0071E3] rounded-full px-2 py-0.5">
                  {team.certCount} certif.
                </span>
                {isTeamOpen
                  ? <ChevronDown className="w-4 h-4 text-[#ADADB8] shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-[#ADADB8] shrink-0" />}
              </button>

              {/* Team members */}
              {isTeamOpen && (
                <div className="border-t border-[#E5E5EA] dark:border-[#3A3A3C]">
                  {team.members.length === 0 ? (
                    <p className="px-5 py-4 text-[13px] text-[#ADADB8]">Aucun certificat pour cette équipe</p>
                  ) : (
                    team.members.map((member) => {
                      const isUserOpen = openUsers.has(member.userId);
                      return (
                        <div key={member.userId} className="border-b border-[#E5E5EA] dark:border-[#3A3A3C] last:border-b-0">
                          <button
                            onClick={() => toggleUser(member.userId)}
                            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#F5F5F7] dark:hover:bg-[#2C2C2E] transition-colors text-left"
                          >
                            <div className="w-6 h-6 rounded-lg bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center shrink-0">
                              <Users className="w-3 h-3 text-[#ADADB8]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] truncate">{member.userName}</p>
                              <p className="text-[11px] text-[#ADADB8]">{member.userEmail}</p>
                            </div>
                            <span className="shrink-0 text-[11px] text-[#ADADB8]">
                              {member.certs.length} certif.
                            </span>
                            {isUserOpen
                              ? <ChevronDown className="w-3.5 h-3.5 text-[#ADADB8] shrink-0" />
                              : <ChevronRight className="w-3.5 h-3.5 text-[#ADADB8] shrink-0" />}
                          </button>
                          {isUserOpen && <CertList certs={member.certs} />}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Pagination page={data.page} total={data.totalTeams} limit={data.limit} label="équipe" onChange={onPageChange} />
    </div>
  );
}

export function CertificatesListPanel() {
  const [search, setSearch]     = useState("");
  const [type, setType]         = useState<"all" | "courses" | "grc">("all");
  const [viewMode, setViewMode] = useState<"table" | "grouped" | "team">("table");
  const [page, setPage]         = useState(1);
  const [data, setData]         = useState<TableResponse | GroupedResponse | TeamResponse | null>(null);
  const [loading, setLoading]   = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page), type, view: viewMode,
      ...(search ? { search } : {}),
    });
    fetch(`/api/admin/certificates/list?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, type, viewMode, search]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(val: string) { setSearch(val); setPage(1); }
  function handleType(val: "all" | "courses" | "grc") { setType(val); setPage(1); }
  function handleView(val: "table" | "grouped" | "team") { setViewMode(val); setPage(1); setData(null); }

  const typeOptions: { key: "all" | "courses" | "grc"; label: string; icon: React.ElementType }[] = [
    { key: "all",     label: "Tous",       icon: Award },
    { key: "courses", label: "Formations", icon: BookOpen },
    { key: "grc",     label: "GRC",        icon: ShieldCheck },
  ];

  const viewOptions: { key: "table" | "grouped" | "team"; label: string; icon: React.ElementType }[] = [
    { key: "table",   label: "Tableau",        icon: LayoutList },
    { key: "grouped", label: "Par utilisateur", icon: Users },
    { key: "team",    label: "Par équipe",      icon: UsersRound },
  ];

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#ADADB8]" />
          <input
            type="text"
            placeholder="Nom, email, cours…"
            defaultValue={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-9 rounded-xl border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#ADADB8] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1 p-1 bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-xl">
          {typeOptions.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleType(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all",
                type === key
                  ? "bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-sm"
                  : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]",
              )}
            >
              <Icon className="w-3 h-3" />{label}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex gap-1 p-1 bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-xl ml-auto">
          {viewOptions.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleView(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all",
                viewMode === key
                  ? "bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-sm"
                  : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]",
              )}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 text-[#ADADB8]">
          <Award className="w-4 h-4 animate-pulse" />
          <span className="text-[13px]">Chargement…</span>
        </div>
      ) : data?.view === "table" ? (
        <TableView data={data} onPageChange={(p) => setPage(p)} />
      ) : data?.view === "grouped" ? (
        <GroupedView data={data} onPageChange={(p) => setPage(p)} />
      ) : data?.view === "team" ? (
        <TeamView data={data} onPageChange={(p) => setPage(p)} />
      ) : null}
    </div>
  );
}
