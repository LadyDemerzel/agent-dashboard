const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> =
  {
    idle: {
      bg: "bg-zinc-800",
      text: "text-zinc-400",
      dot: "bg-zinc-500",
    },
    working: {
      bg: "bg-emerald-950",
      text: "text-emerald-400",
      dot: "bg-emerald-500",
    },
    review: {
      bg: "bg-amber-950",
      text: "text-amber-400",
      dot: "bg-amber-500",
    },
    "needs review": {
      bg: "bg-amber-950",
      text: "text-amber-400",
      dot: "bg-amber-500",
    },
    "requested changes": {
      bg: "bg-red-950",
      text: "text-red-400",
      dot: "bg-red-500",
    },
    blocked: {
      bg: "bg-red-950",
      text: "text-red-400",
      dot: "bg-red-500",
    },
    draft: {
      bg: "bg-zinc-800",
      text: "text-zinc-400",
      dot: "bg-zinc-500",
    },
    approved: {
      bg: "bg-emerald-950",
      text: "text-emerald-400",
      dot: "bg-emerald-500",
    },
    published: {
      bg: "bg-blue-950",
      text: "text-blue-400",
      dot: "bg-blue-500",
    },
  };

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.idle;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${style.dot} ${status === "working" ? "animate-pulse" : ""}`}
      />
      {status.replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}
