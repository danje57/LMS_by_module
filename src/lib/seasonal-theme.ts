export type SeasonalTheme = {
  key: string;
  label: string;
  emoji: string;
  message: string;
  gradient: string;
  textColor: string;
  borderColor: string;
};

function easterDate(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function inRange(
  now: Date,
  startMonth: number, startDay: number,
  endMonth: number, endDay: number,
): boolean {
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const start = startMonth * 100 + startDay;
  const end = endMonth * 100 + endDay;
  const cur = m * 100 + d;
  if (start <= end) return cur >= start && cur <= end;
  // wraps year boundary (e.g. Dec 26 → Jan 5)
  return cur >= start || cur <= end;
}

function daysFromEaster(now: Date, year: number): number {
  const e = easterDate(year);
  const easter = new Date(year, e.month - 1, e.day);
  return Math.round((now.getTime() - easter.getTime()) / 86400000);
}

export function getCurrentTheme(now: Date = new Date()): SeasonalTheme | null {
  const year = now.getFullYear();
  const diff = daysFromEaster(now, year);

  // Pâques : du Jeudi Saint (-3j) au lundi de Pâques (+1j)
  if (diff >= -3 && diff <= 1) {
    return {
      key: "paques",
      label: "Joyeuses Pâques",
      emoji: "🐣",
      message: "Joyeuses Pâques à toute l'équipe !",
      gradient: "from-yellow-50 to-green-50 dark:from-yellow-900/20 dark:to-green-900/20",
      textColor: "text-green-800 dark:text-green-300",
      borderColor: "border-green-200 dark:border-green-700",
    };
  }

  if (inRange(now, 12, 26, 1, 5)) {
    return {
      key: "nouvel-an",
      label: "Bonne année",
      emoji: "🎆",
      message: `Bonne année ${now.getMonth() === 11 ? year + 1 : year} à toute l'équipe !`,
      gradient: "from-indigo-50 to-sky-50 dark:from-indigo-900/20 dark:to-sky-900/20",
      textColor: "text-indigo-800 dark:text-indigo-300",
      borderColor: "border-indigo-200 dark:border-indigo-700",
    };
  }

  // Carnaval : Mardi Gras = Pâques − 47j, on affiche les 3 jours avant
  const mardiGrasDiff = diff + 47; // jours depuis Mardi Gras (0 = Mardi Gras)
  if (mardiGrasDiff >= -3 && mardiGrasDiff <= 0) {
    return {
      key: "carnaval",
      label: "Carnaval",
      emoji: "🎭",
      message: "C'est le Carnaval ! Bonne fête masquée.",
      gradient: "from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20",
      textColor: "text-purple-800 dark:text-purple-300",
      borderColor: "border-purple-200 dark:border-purple-700",
    };
  }

  if (inRange(now, 4, 30, 5, 1)) {
    return {
      key: "fete-travail",
      label: "Fête du Travail",
      emoji: "🌸",
      message: "Bonne fête du Travail ! La plateforme vous remercie.",
      gradient: "from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20",
      textColor: "text-pink-800 dark:text-pink-300",
      borderColor: "border-pink-200 dark:border-pink-700",
    };
  }

  if (inRange(now, 6, 22, 6, 23)) {
    return {
      key: "fete-nationale-lu",
      label: "Fête Nationale",
      emoji: "🇱🇺",
      message: "Vive le Grand-Duché ! Bonne Fête Nationale.",
      gradient: "from-red-50 to-blue-50 dark:from-red-900/20 dark:to-blue-900/20",
      textColor: "text-blue-800 dark:text-blue-300",
      borderColor: "border-blue-200 dark:border-blue-700",
    };
  }

  if (inRange(now, 7, 14, 7, 14)) {
    return {
      key: "fete-nationale-fr",
      label: "Fête Nationale",
      emoji: "🇫🇷",
      message: "Bonne Fête Nationale ! Liberté, Égalité, Fraternité.",
      gradient: "from-blue-50 to-red-50 dark:from-blue-900/20 dark:to-red-900/20",
      textColor: "text-blue-800 dark:text-blue-300",
      borderColor: "border-blue-200 dark:border-blue-700",
    };
  }

  if (inRange(now, 9, 1, 9, 8)) {
    return {
      key: "rentree",
      label: "Bonne rentrée",
      emoji: "📚",
      message: "C'est la rentrée ! Bonne nouvelle saison de formation.",
      gradient: "from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20",
      textColor: "text-amber-800 dark:text-amber-300",
      borderColor: "border-amber-200 dark:border-amber-700",
    };
  }

  if (inRange(now, 10, 25, 10, 31)) {
    return {
      key: "halloween",
      label: "Halloween",
      emoji: "🎃",
      message: "Trick or treat ! Joyeux Halloween.",
      gradient: "from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20",
      textColor: "text-orange-800 dark:text-orange-300",
      borderColor: "border-orange-200 dark:border-orange-700",
    };
  }

  if (inRange(now, 11, 1, 11, 1)) {
    return {
      key: "toussaint",
      label: "Toussaint",
      emoji: "🕯️",
      message: "Bonne Toussaint.",
      gradient: "from-slate-50 to-gray-50 dark:from-slate-900/20 dark:to-gray-900/20",
      textColor: "text-slate-700 dark:text-slate-300",
      borderColor: "border-slate-200 dark:border-slate-600",
    };
  }

  if (inRange(now, 12, 1, 12, 25)) {
    return {
      key: "noel",
      label: "Joyeux Noël",
      emoji: "🎄",
      message: "Joyeux Noël et bonnes fêtes de fin d'année !",
      gradient: "from-green-50 to-red-50 dark:from-green-900/20 dark:to-red-900/20",
      textColor: "text-green-800 dark:text-green-300",
      borderColor: "border-green-200 dark:border-green-700",
    };
  }

  return null;
}
