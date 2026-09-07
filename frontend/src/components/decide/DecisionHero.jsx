import { Clock, Wallet } from "lucide-react";
import { inr } from "../../lib/format";
import SourceChip from "../SourceChip";
import ConfidenceBadge from "../ConfidenceBadge";

export default function DecisionHero({ decision, onCreateLot, creating }) {
  const r = decision.recommended;
  const e = r.economics;
  const liq = decision.liquidity_impact;
  return (
    <div className="kp-hero p-6 sm:p-8 reveal" data-testid="decision-hero">
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div className="flex-1">
          <div className="eyebrow text-emerald-300">Recommended action</div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-2" data-testid="decision-action-label">{r.label}</h2>
          <div className="text-emerald-100/80 mt-1 text-sm">via <b>{r.counterparty}</b> · <span className="num">{inr(r.price_per_q)}/q</span>{r.band && <span className="num text-emerald-300/70"> (P10 {inr(r.band.p10)} · P90 {inr(r.band.p90)})</span>}</div>
          <div className="mt-5 flex flex-wrap items-end gap-6">
            <div>
              <div className="eyebrow">Net realizable value</div>
              <div className="num text-4xl sm:text-5xl font-semibold text-emerald-300 mt-1" data-testid="decision-nrv">{inr(e.nrv)}</div>
              <div className="text-xs text-emerald-200/60 mt-1">gross {inr(e.gross)} − costs {inr(e.transport + e.handling + e.commission + e.storage + e.spoilage)} − risk {inr(e.risk_adjustment)}</div>
            </div>
            <div className="text-sm">
              <div className="eyebrow">vs mandi-now baseline</div>
              <div className={`num text-2xl mt-1 ${e.nrv - decision.baseline_mandi_nrv >= 0 ? "text-emerald-300" : "text-red-300"}`} data-testid="decision-delta-baseline">
                {e.nrv - decision.baseline_mandi_nrv >= 0 ? "+" : ""}{inr(e.nrv - decision.baseline_mandi_nrv)}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2"><SourceChip source={r.source} testId="hero-source-chip" /><SourceChip source={decision.context.mandi.source} /><SourceChip source={decision.context.forecast_summary.source_chip} /></div>
        </div>
        <div className="lg:w-72 space-y-4">
          <ConfidenceBadge score={decision.confidence.score} factors={decision.confidence.factors} size="lg" />
          <div className="kp-panel p-3 text-xs space-y-1.5" data-testid="liquidity-impact">
            <div className="eyebrow flex items-center gap-1"><Wallet size={11} /> Liquidity impact</div>
            <div className="flex justify-between"><span className="text-emerald-200/70">Cash within 2 days</span><span className="num">{inr(liq.cash_within_2_days)}</span></div>
            <div className="flex justify-between"><span className="text-emerald-200/70">Cash later</span><span className="num">{inr(liq.cash_later)}</span></div>
            <div className="flex justify-between"><span className="text-emerald-200/70 flex items-center gap-1"><Clock size={10} /> Full cash in</span><span className="num">{liq.days_to_full_cash} d</span></div>
          </div>
          <button onClick={onCreateLot} disabled={creating} className="btn-primary w-full" data-testid="create-lot-button">
            {creating ? "Creating lot…" : "Create lot & invite offers"}
          </button>
          <div className="text-[11px] text-emerald-300/60 text-center">Min acceptable value {inr(decision.min_acceptable_value)} · engine {decision.latency_ms} ms</div>
        </div>
      </div>
    </div>
  );
}
