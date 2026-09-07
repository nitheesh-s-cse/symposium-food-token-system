const VARIANTS = {
  success: "bg-emerald-100 text-emerald-800 border-emerald-200",
  danger: "bg-rose-100 text-rose-800 border-rose-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
};

export function Badge({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: keyof typeof VARIANTS;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${VARIANTS[variant]}`}
    >
      {children}
    </span>
  );
}
