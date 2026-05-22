"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ProgressClient } from "@/components/admin/progress-client";
import { MyProgressView } from "@/components/progress/my-progress-view";
import type { AssignmentRow, UserProgressRow } from "@/components/admin/progress-client";

interface ProgressTabsProps {
  myAssignments: AssignmentRow[];
  generalData: { courses: { id: string; title: string }[]; teams: { id: string; name: string }[]; users: UserProgressRow[] } | null;
  isManager: boolean;
  labelMine: string;
  labelGeneral: string;
}

export function ProgressTabs({ myAssignments, generalData, isManager, labelMine, labelGeneral }: ProgressTabsProps) {
  const [tab, setTab] = useState<"mine" | "general">("mine");

  const tabs = [
    { key: "mine" as const,    label: labelMine,    count: myAssignments.length },
    { key: "general" as const, label: labelGeneral, count: generalData?.users.length ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex border-b border-[#E5E5EA] dark:border-[#3A3A3C]">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-[14px] font-medium border-b-2 -mb-px transition-colors",
              tab === key
                ? "border-[#0071E3] text-[#0071E3]"
                : "border-transparent text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
            )}
          >
            {label}
            <span className={cn(
              "text-[12px] font-medium px-1.5 py-0.5 rounded-md",
              tab === key ? "bg-[#0071E3]/10 text-[#0071E3]" : "bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#ADADB8]"
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {tab === "mine" && <MyProgressView assignments={myAssignments} />}

      {tab === "general" && (
        generalData
          ? <ProgressClient courses={generalData.courses} teams={generalData.teams} users={generalData.users} />
          : <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[#E5E5EA] dark:border-[#3A3A3C] p-12 text-center">
              <p className="text-[14px] text-[#6E6E73] dark:text-[#8E8E93]">
                {isManager ? "Aucune équipe ni affectation." : "Aucune affectation créée."}
              </p>
            </div>
      )}
    </div>
  );
}
