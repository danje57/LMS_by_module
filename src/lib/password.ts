export interface PasswordCheck {
  valid: boolean;
  errors: string[];
  strength: "weak" | "medium" | "strong";
}

const RULES = [
  { test: (p: string) => p.length >= 8,           msg: "8 caractères minimum" },
  { test: (p: string) => /[A-Z]/.test(p),         msg: "une majuscule" },
  { test: (p: string) => /[a-z]/.test(p),         msg: "une minuscule" },
  { test: (p: string) => /[0-9]/.test(p),         msg: "un chiffre" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), msg: "un caractère spécial (!@#$…)" },
];

export function validatePassword(password: string): PasswordCheck {
  const errors = RULES.filter((r) => !r.test(password)).map((r) => r.msg);
  const passed = RULES.length - errors.length;
  const strength: PasswordCheck["strength"] =
    passed <= 2 ? "weak" : passed <= 4 ? "medium" : "strong";
  return { valid: errors.length === 0, errors, strength };
}

export { RULES };

// Génère un mot de passe fort aléatoire (12 caractères, toutes règles respectées)
export function generateStrongPassword(): string {
  const upper  = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower  = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*-_=+?";
  const all = upper + lower + digits + special;

  const rand = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

  // Garantir au moins 1 de chaque catégorie
  const mandatory = [rand(upper), rand(lower), rand(digits), rand(special)];
  const rest = Array.from({ length: 8 }, () => rand(all));

  // Mélanger
  return [...mandatory, ...rest]
    .sort(() => Math.random() - 0.5)
    .join("");
}
