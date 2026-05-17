"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { LayoutDashboard, BookOpen, Settings, GraduationCap, Users, UsersRound, Award, BadgeCheck, BarChart2 } from "lucide-react";

const navItems = [
  { href: "/dashboard",                    label: "Tableau de bord",    icon: LayoutDashboard, adminOnly: false, userOnly: false, managerOnly: false },
  { href: "/dashboard/courses",            label: "Cours",              icon: BookOpen,        adminOnly: false, userOnly: false, managerOnly: false },
  { href: "/dashboard/certificates",       label: "Certificats",        icon: Award,           adminOnly: false, userOnly: true,  managerOnly: false },
  { href: "/dashboard/progress",           label: "Suivi",              icon: BarChart2,       adminOnly: false, userOnly: false, managerOnly: true  },
  { href: "/dashboard/admin/users",        label: "Utilisateurs",       icon: Users,           adminOnly: true,  userOnly: false, managerOnly: false },
  { href: "/dashboard/admin/teams",        label: "Équipes",            icon: UsersRound,      adminOnly: true,  userOnly: false, managerOnly: false },
  { href: "/dashboard/admin/progress",     label: "Suivi",              icon: BarChart2,       adminOnly: true,  userOnly: false, managerOnly: false },
  { href: "/dashboard/admin/certificates", label: "Gérer certificats",  icon: BadgeCheck,      adminOnly: true,  userOnly: false, managerOnly: false },
  { href: "/dashboard/settings",           label: "Paramètres",         icon: Settings,        adminOnly: true,  userOnly: false, managerOnly: false },
];

interface SidebarProps {
  appName: string;
  logoPath: string | null;
  isAdmin?: boolean;
  isManager?: boolean;
}

export function Sidebar({ appName, logoPath, isAdmin = false, isManager = false }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-white border-r border-[#E5E5EA] flex flex-col shrink-0">

      {/* Logo */}
      <Link href="/dashboard" className="px-5 py-5 border-b border-[#E5E5EA] block hover:bg-[#F5F5F7] transition-colors">
        {logoPath ? (
          <Image src={logoPath} alt={appName} width={100} height={32} className="object-contain" unoptimized />
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0071E3] flex items-center justify-center shrink-0">
              <GraduationCap className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <span className="text-[15px] font-semibold text-[#1D1D1F] tracking-tight">{appName}</span>
          </div>
        )}
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.filter((item) =>
          (!item.adminOnly || isAdmin) &&
          (!item.userOnly || !isAdmin) &&
          (!item.managerOnly || isManager)
        ).map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[14px] font-medium transition-all",
                active
                  ? "bg-[#0071E3]/10 text-[#0071E3]"
                  : "text-[#3C3C43] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active ? "text-[#0071E3]" : "text-[#8E8E93]")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-[#E5E5EA]">
        <p className="text-[11px] text-[#ADADB8] text-center">{appName} · v0.1</p>
      </div>
    </aside>
  );
}
