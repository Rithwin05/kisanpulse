import { CheckCircle2 } from "lucide-react";
import SourceChip from "../SourceChip";

export default function WhyPanel({ why, confidence }) {
  return (
    <div className="kp-card p-5 sm:p-6 reveal" data-testid="why-panel">
      <h3 className="text-base md:text-lg font-semibold mb-1">Why this decision?</h3>
      <p className="text-xs text-emerald-300/60 mb-4">Template-generated from engine output. No language model produced any number here.</p>
      <ul className="space-y-3">
        {why.map((b, i) => (
          <li key={i} className="flex gap-3 text-sm" data-testid={`why-bullet-${i}`}>
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div><span className="text-emerald-50/90">{b.text}</span> <SourceChip source={b.source} className="ml-1 align-middle" /></div>
          </li>
        ))}
      </ul>
      <div className="mt-5 pt-4 border-t border-[var(--line)]">
        <div className="eyebrow mb-2">Confidence factors</div>
        <div className="flex flex-wrap gap-2 text-xs" data-testid="confidence-factors">
          {confidence.factors.map((f, i) => (
            <span key={i} className="px-2 py-1 rounded-md bg-emerald-950/50 border border-emerald-500/20">{f.factor} <b className={`num ${f.delta < 0 ? "text-amber-300" : "text-emerald-300"}`}>{f.delta}</b></span>
          ))}
        </div>
      </div>
    </div>
  );
}
