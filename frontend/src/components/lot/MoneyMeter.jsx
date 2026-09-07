import { inr, pct } from "../../lib/format";
import SourceChip from "../SourceChip";

export default function MoneyMeter({ mm }) {
  const done = mm.complete && mm.realised.nrv !== null;
  const base = mm.baseline.nrv;
  const real = mm.realised.nrv ?? 0;
  const max = Math.max(base, real, 1);
  return (
    <div className="kp-hero p-6" data-testid="money-meter">
      <div className="relative z-10">
        <div className="flex items-center justify-between"><div className="eyebrow text-emerald-300">Money Meter</div><SourceChip source={mm.source} /></div>
        {!done && <div className="text-sm text-emerald-200/70 mt-3" data-testid="money-meter-pending">Realised value appears once payment is settled. Baseline (mandi-now NRV) is {inr(base)}.</div>}
        {done && (
          <>
            <div className="mt-3 flex items-end gap-6 flex-wrap">
              <div><div className="text-xs text-slate-400">{mm.baseline.label}</div><div className="num text-2xl text-slate-300" data-testid="money-meter-baseline">{inr(base)}</div></div>
              <div><div className="text-xs text-emerald-300/70">{mm.realised.label}</div><div className="num text-4xl font-bold text-emerald-300" data-testid="money-meter-realised">{inr(real)}</div></div>
              <div><div className="text-xs text-emerald-300/70">Delta</div><div className={`num text-3xl font-semibold ${mm.delta >= 0 ? "text-emerald-300" : "text-red-300"}`} data-testid="money-meter-delta">{mm.delta >= 0 ? "+" : ""}{inr(mm.delta)} <span className="text-base">({pct((real / base - 1) * 100)})</span></div></div>
            </div>
            <div className="mt-4 space-y-2">
              {[["Baseline", base, "bg-slate-500"], ["Realised", real, "bg-emerald-400"]].map(([l, v, c]) => (
                <div key={l} className="flex items-center gap-3 text-xs"><span className="w-16 text-emerald-200/60">{l}</span><div className="flex-1 h-3 rounded-full bg-emerald-950/60 overflow-hidden"><div className={`h-full ${c} transition-all duration-700`} style={{ width: `${(v / max) * 100}%` }} /></div><span className="num w-24 text-right">{inr(v)}</span></div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
              <div className="kp-panel p-3"><div className="eyebrow mb-1">Baseline breakdown</div>{Object.entries(mm.baseline.breakdown).map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-emerald-200/60 capitalize">{k.replace("_", " ")}</span><span className="num">{inr(v)}</span></div>)}</div>
              <div className="kp-panel p-3"><div className="eyebrow mb-1">Realised breakdown</div>{Object.entries(mm.realised.breakdown).map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-emerald-200/60 capitalize">{k.replace("_", " ")}</span><span className="num">{inr(v)}</span></div>)}</div>
            </div>
            {mm.outcome && (
              <div className="mt-4 kp-panel p-3 text-xs" data-testid="outcome-forecast-check">
                <div className="eyebrow mb-1">Forecast check</div>
                <div className="flex flex-wrap gap-4"><span>Predicted P50 day-1: <b className="num">{inr(mm.outcome.forecast_p50_day1)}</b></span><span>Actual mandi modal: <b className="num">{inr(mm.outcome.actual_mandi_modal)}</b></span><span>Error: <b className={`num ${Math.abs(mm.outcome.forecast_error_pct) < 5 ? "text-emerald-300" : "text-amber-300"}`}>{pct(mm.outcome.forecast_error_pct)}</b></span><span className="chip sim">{mm.outcome.retraining_note}</span></div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
