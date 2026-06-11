"use client";

import { useEffect, useRef, useState } from "react";

const sections = [
  { id: "personnalisation", label: "Personnalisation" },
  { id: "email",            label: "Notifications email" },
  { id: "retention",        label: "Conservation des données" },
  { id: "themes",           label: "Thèmes saisonniers" },
  { id: "maintenance",      label: "Bannière maintenance" },
  { id: "chiffrement",      label: "Protection du contenu" },
  { id: "licence",          label: "Licence" },
  { id: "backup",           label: "Sauvegardes" },
];

export function SettingsNav() {
  const [active, setActive] = useState<string>(sections[0].id);
  const ignoreRef = useRef(false);

  useEffect(() => {
    // Le scroll container est le <main> parent (overflow-y-auto dans dashboard/layout.tsx)
    const scrollEl = document.querySelector("main");
    if (!scrollEl) return;

    const observers: IntersectionObserver[] = [];

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !ignoreRef.current) setActive(id);
        },
        {
          root: scrollEl,
          rootMargin: "-20% 0px -60% 0px",
          threshold: 0,
        }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    const scrollEl = document.querySelector("main");
    if (!el || !scrollEl) return;

    setActive(id);
    ignoreRef.current = true;

    const elTop = el.getBoundingClientRect().top;
    const scrollTop = scrollEl.getBoundingClientRect().top;
    scrollEl.scrollBy({ top: elTop - scrollTop - 24, behavior: "smooth" });

    setTimeout(() => { ignoreRef.current = false; }, 800);
  }

  return (
    <nav className="sticky top-0 w-44 shrink-0 space-y-0.5 pt-1">
      <p className="text-[11px] font-semibold text-[#8E8E93] dark:text-[#6E6E73] uppercase tracking-wider px-3 pb-2">
        Navigation
      </p>
      {sections.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => scrollTo(id)}
          className={`w-full text-left text-[13px] px-3 py-1.5 rounded-lg transition-colors ${
            active === id
              ? "bg-[#F0F0F5] dark:bg-[#2C2C2E] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]"
              : "text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-[#F5F5F7]/60 dark:hover:bg-[#2C2C2E]/50"
          }`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
