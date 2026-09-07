export default function ConfidenceBadge({ score, factors = [], size = "md" }) {
  const color = score >= 70 ? "#10b981" : score >= 45 ? "#f59e0b" : "#ef4444";
  const big = size === "lg";
  return (
    <div className="flex items-center gap-3" data-testid="confidence-badge" title={factors.map((f) => `${f.factor} (${f.delta})`).join("\n")}>
      <div className="relative" style={{ width: big ? 72 : 44, height: big ? 72 : 44 }}>
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${score * 0.974} 100`} strokeLinecap="round" />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center num font-semibold ${big ? "text-lg" : "text-xs"}`} style={{ color }}>
          {score}
        </div>
      </div>
      <div>
        <div className="eyebrow">Confidence</div>
        <div className="text-sm" style={{ color }}>{score >= 70 ? "High" : score >= 45 ? "Moderate" : "Low"}</div>
      </div>
    </div>
  );
}
