import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { inr, fmtDate } from "../lib/format";
import SourceChip from "../components/SourceChip";

const Stat = ({ label, value, sub, testId }) => (
  <div className="kp-card p-4" data-testid={testId}><div className="eyebrow">{label}</div><div className="num text-2xl mt-1">{value}</div>{sub && <div className="text-xs text-emerald-300/60 mt-1">{sub}</div>}</div>
);

export default function Console() {
  const [c, setC] = useState(null);
  useEffect(() => { api.console().then(setC); }, []);
  if (!c) return <div className="text-sm text-emerald-200/60">Loading console…</div>;
  return (
    <div className="space-y-6" data-testid="console-page">
      <div><div className="eyebrow mb-2">Govt / MSAMB · read-only · {c.demo_today}</div><h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">State console</h1><p className="text-emerald-200/70 mt-2 text-sm">Same data the farmer sees, aggregated. Model backtests answer "why this model".</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Lots created" value={c.lots} testId="console-lots" />
        <Stat label="Closed transactions" value={c.closed_transactions} testId="console-closed" />
        <Stat label="Δ vs mandi baseline" value={inr(c.total_delta_vs_baseline)} sub="from outcome ledger" testId="console-delta" />
        <Stat label="Seeded buyers" value={c.buyers} sub="simulated" testId="console-buyers" />
      </div>
      <div className="kp-card p-5 sm:p-6" data-testid="backtest-table">
        <h2 className="text-base md:text-lg font-semibold mb-3">Forecast backtest · rolling-origin, 4 folds × 7 days</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left eyebrow border-b border-[var(--line)]"><th className="py-2 pr-3">Series</th><th className="py-2 pr-3 text-right">LightGBM MAPE</th><th className="py-2 pr-3 text-right">ETS MAPE</th><th className="py-2 pr-3 text-right">Seasonal-naive MAPE</th><th className="py-2 pr-3">Champion</th><th className="py-2 pr-3 text-right">P10–P90 coverage</th><th className="py-2 pr-3 text-right">History</th><th className="py-2">Source</th></tr></thead>
          <tbody>
            {c.backtests.map((b) => (
              <tr key={b.commodity + b.market} className="border-b border-[var(--line)]" data-testid={`backtest-row-${b.commodity.toLowerCase()}-${b.market.replace(/\s+/g, "-").toLowerCase()}`}>
                <td className="py-2 pr-3 font-medium">{b.commodity} · {b.market}</td>
                <td className="py-2 pr-3 text-right num">{b.mape.lgbm}%</td><td className="py-2 pr-3 text-right num">{b.mape.ets}%</td><td className="py-2 pr-3 text-right num">{b.mape.snaive}%</td>
                <td className="py-2 pr-3 text-emerald-300 num">{b.champion}</td><td className="py-2 pr-3 text-right num">{Math.round((b.band_coverage_p10_p90 || 0) * 100)}%</td><td className="py-2 pr-3 text-right num">{b.history_days} d</td><td className="py-2"><SourceChip source={b.source_chip} /></td>
              </tr>
            ))}
            {c.backtests.length === 0 && <tr><td colSpan="8" className="py-3 text-emerald-200/60 text-xs">Forecasts warming up — open the dashboard once and return.</td></tr>}
          </tbody>
        </table>
        <p className="text-xs text-emerald-300/60 mt-3">Anomalies (&gt;3σ daily move) are flagged and excluded from training. Forecast errors from closed lots are "logged for retraining" — no live recalibration is claimed.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="kp-card p-5"><h3 className="font-semibold mb-3">Data coverage</h3>{c.data.commodities.map((d) => <div key={d.commodity} className="text-xs py-1.5 border-b border-[var(--line)] flex justify-between"><span>{d.commodity}</span><span className="num text-emerald-200/70">{d.records} rec · {fmtDate(d.first_date)}→{fmtDate(d.latest_date)} · {d.anomalies_flagged}σ</span></div>)}<div className="mt-2"><SourceChip source={c.data.commodities[0]?.source} /></div></div>
        <div className="kp-card p-5"><h3 className="font-semibold mb-3">Top arrivals · 7 days</h3>{c.top_arrivals_7d.map((a, i) => <div key={i} className="text-xs py-1.5 border-b border-[var(--line)] flex justify-between"><span>{a.commodity} · {a.district}</span><span className="num">{a.arrivals_q.toLocaleString("en-IN")} q</span></div>)}<div className="mt-2"><SourceChip source="simulated arrivals" /></div></div>
        <div className="kp-card p-5"><h3 className="font-semibold mb-3">Storage & freight</h3>{c.warehouses.map((w) => <div key={w.id} className="text-xs py-1.5 border-b border-[var(--line)] flex justify-between"><span>{w.name}</span><span className="num text-emerald-200/70">{w.capacity_q} q · ₹{w.rate_per_q_per_day}/q/d</span></div>)}{c.transport_rates.map((t) => <div key={t.id} className="text-xs py-1.5 border-b border-[var(--line)] flex justify-between"><span>{t.band_km} km · {t.vehicle}</span><span className="num text-emerald-200/70">₹{t.rate_per_q_km}/q/km + ₹{t.fixed}</span></div>)}</div>
      </div>
    </div>
  );
}
