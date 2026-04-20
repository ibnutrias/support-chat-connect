import { cn } from "@/lib/utils";

interface Props {
  label: "positive" | "neutral" | "negative";
  score: number; // 0..1
}

const colors = {
  positive: "stroke-emerald-500",
  neutral: "stroke-amber-500",
  negative: "stroke-rose-500",
};
const fills = {
  positive: "text-emerald-600",
  neutral: "text-amber-600",
  negative: "text-rose-600",
};

export function SentimentArc({ label, score }: Props) {
  // Arc: from 180deg (left) to 360deg (right), so semicircle on top.
  // Map score 0..1 to angle 180..360 (i.e. 180deg sweep).
  const clamped = Math.max(0, Math.min(1, score));
  const sweep = clamped * 180; // degrees of progress
  const r = 60;
  const cx = 80;
  const cy = 80;
  const circumference = Math.PI * r; // half circle length
  const dash = (sweep / 180) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 160 100" className="w-44 h-28">
        {/* background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          className="stroke-muted"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* progress arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          className={cn("transition-all duration-700", colors[label])}
          strokeDasharray={`${dash} ${circumference}`}
        />
        <text x={cx} y={cy - 8} textAnchor="middle" className={cn("font-display text-2xl font-semibold", fills[label])}>
          {Math.round(clamped * 100)}
        </text>
      </svg>
      <div className={cn("text-sm font-medium capitalize -mt-2", fills[label])}>{label}</div>
    </div>
  );
}
