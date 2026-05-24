"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LayoutDashboard, BookOpen, Settings, GraduationCap, Users, UsersRound, Award, BadgeCheck, BarChart2, ClipboardList, UserCog, Activity, PieChart } from "lucide-react";

const navItems = [
  { href: "/dashboard",                    key: "dashboard",          icon: LayoutDashboard, adminOnly: false, userOnly: false, managerOnly: false, strictManagerOnly: false },
  { href: "/dashboard/courses",            key: "courses",            icon: BookOpen,        adminOnly: false, userOnly: false, managerOnly: false, strictManagerOnly: false },
  { href: "/dashboard/certificates",       key: "certificates",       icon: Award,           adminOnly: false, userOnly: true,  managerOnly: false, strictManagerOnly: false },
  { href: "/dashboard/progress",           key: "progress",           icon: BarChart2,       adminOnly: false, userOnly: false, managerOnly: true,  strictManagerOnly: false },
  { href: "/dashboard/manager/team",       key: "myTeam",             icon: UserCog,         adminOnly: false, userOnly: false, managerOnly: false, strictManagerOnly: true  },
  { href: "/dashboard/admin/users",        key: "users",              icon: Users,           adminOnly: true,  userOnly: false, managerOnly: false, strictManagerOnly: false },
  { href: "/dashboard/admin/teams",        key: "teams",              icon: UsersRound,      adminOnly: true,  userOnly: false, managerOnly: false, strictManagerOnly: false },
  { href: "/dashboard/admin/progress",     key: "progress",           icon: BarChart2,       adminOnly: true,  userOnly: false, managerOnly: false, strictManagerOnly: false },
  { href: "/dashboard/admin/certificates", key: "manageCertificates", icon: BadgeCheck,      adminOnly: true,  userOnly: false, managerOnly: false, strictManagerOnly: false },
  { href: "/dashboard/admin/reporting",    key: "reporting",          icon: PieChart,        adminOnly: true,  userOnly: false, managerOnly: false, strictManagerOnly: false },
  { href: "/dashboard/admin/activity",    key: "activity",           icon: Activity,        adminOnly: true,  userOnly: false, managerOnly: false, strictManagerOnly: false },
  { href: "/dashboard/admin/audit",        key: "audit",              icon: ClipboardList,   adminOnly: true,  userOnly: false, managerOnly: false, strictManagerOnly: false },
  { href: "/dashboard/settings",           key: "settings",           icon: Settings,        adminOnly: true,  userOnly: false, managerOnly: false, strictManagerOnly: false },
];

interface SidebarProps {
  appName: string;
  logoPath: string | null;
  isAdmin?: boolean;
  isManager?: boolean;
  isStrictManager?: boolean;
}

export function Sidebar({ appName, logoPath, isAdmin = false, isManager = false, isStrictManager = false }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <aside className="w-60 bg-white dark:bg-[#111114] border-r border-[#E5E5EA] dark:border-[#2C2C30] flex flex-col shrink-0">

      {/* Logo */}
      <Link href="/dashboard" className="px-5 py-5 border-b border-[#E5E5EA] dark:border-[#2C2C30] block hover:bg-[#F5F5F7] dark:hover:bg-[#1C1C20] transition-colors">
        {logoPath ? (
          <Image src={logoPath} alt={appName} width={100} height={32} className="object-contain" unoptimized />
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0071E3] flex items-center justify-center shrink-0">
              <GraduationCap className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <span className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">{appName}</span>
          </div>
        )}
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.filter((item) =>
          (!item.adminOnly || isAdmin) &&
          (!item.userOnly || !isAdmin) &&
          (!item.managerOnly || isManager) &&
          (!item.strictManagerOnly || isStrictManager)
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
                  ? "bg-[#0071E3]/10 dark:bg-[#0071E3]/20 text-[#0071E3]"
                  : "text-[#3C3C43] dark:text-[#AEAEB2] hover:bg-[#F5F5F7] dark:hover:bg-[#1C1C20] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active ? "text-[#0071E3]" : "text-[#8E8E93]")} />
              {t(item.key as Parameters<typeof t>[0])}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-[#E5E5EA] dark:border-[#2C2C30]">
        <p className="text-[11px] text-[#ADADB8] dark:text-[#636366] text-center">{appName} · v0.1</p>
      </div>
    </aside>
  );
}
