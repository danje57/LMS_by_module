import { AlertTriangle, Info, XOctagon } from "lucide-react";
import { cn } from "@/lib/utils";

type Color = "orange" | "red" | "blue";

const STYLES: Record<Color, { bg: string; border: string; text: string; icon: React.ElementType }> = {
  orange: {
    bg: "from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20",
    border: "border-amber-200 dark:border-amber-700",
    text: "text-amber-800 dark:text-amber-300",
    icon: AlertTriangle,
  },
  red: {
    bg: "from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20",
    border: "border-red-200 dark:border-red-700",
    text: "text-red-800 dark:text-red-300",
    icon: XOctagon,
  },
  blue: {
    bg: "from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20",
    border: "border-sky-200 dark:border-sky-700",
    text: "text-sky-800 dark:text-sky-300",
    icon: Info,
  },
};

type Props = {
  enabled: boolean;
  message: string | null;
  color: string;
  endsAt: Date | null;
};

export function MaintenanceBanner({ enabled, message, color, endsAt }: Props) {
  if (!enabled) return null;

  // Auto-expire si la date de fin est passée
  if (endsAt && new Date() > endsAt) return null;

  const style = STYLES[(color as Color) in STYLES ? (color as Color) : "orange"];
  const Icon = style.icon;

  const endsAtLabel = endsAt
    ? new Date(endsAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className={cn("flex items-center gap-4 px-6 py-4 bg-gradient-to-r border", style.bg, style.border)}>
      <Icon className={cn("w-5 h-5 shrink-0", style.text)} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-[14px] font-semibold", style.text)}>
          {message || "Maintenance en cours"}
        </p>
        {endsAtLabel && (
          <p className={cn("text-[12px] opacity-75", style.text)}>
            Fin prévue le {endsAtLabel}
          </p>
        )}
      </div>
    </div>
  );
}
