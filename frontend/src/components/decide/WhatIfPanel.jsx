import { SlidersHorizontal } from "lucide-react";
import { inr, PATHWAY_SHORT } from "../../lib/format";

const Slider = ({ label, value, min, max, step, fmt, onChange, testId }) => (
  <label className="block text-xs text-emerald-200/70">
    <div className="flex justify-between mb-1"><span>{label}</span><span className="num text-emerald-100">{fmt(value)}</span></div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" data-testid={testId} />
  </label>
);

export default function WhatIfPanel({ whatif, setWhatif, base, current, latency, busy }) {
  const set = (k) => (v) => setWhatif((w) => ({ ...w, [k]: v }));
  return (
    <div className="kp-card p-5 sm:p-6 reveal" data-testid="whatif-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base md:text-lg font-semibold flex items-center gap-2"><SlidersHorizontal size={16} className="text-amber-400" /> What if?</h3>
        <span className="eyebrow">{busy ? <span className="pulse-dot">recomputing…</span> : `server ${latency ?? "—"} ms`}</span>
      </div>
      <div className="space-y-4">
        <Slider label="Wait days (store pathway)" value={whatif.wait_days ?? 0} min={0} max={30} step={1} fmt={(v) => (v ? `${v} d` : "auto (best)")} onChange={(v) => set("wait_days")(v || null)} testId="whatif-wait-days" />
        <Slider label="Price shock" value={whatif.price_shock_pct} min={-20} max={20} step={1} fmt={(v) => `${v > 0 ? "+" : ""}${v}%`} onChange={set("price_shock_pct")} testId="whatif-price-shock" />
        <Slider label="Transport cost" value={whatif.transport_multiplier} min={0.5} max={2} step={0.1} fmt={(v) => `×${v.toFixed(1)}`} onChange={set("transport_multiplier")} testId="whatif-transport" />
        <Slider label="Split ratio (sell now)" value={whatif.split_ratio} min={0.1} max={0.9} step={0.1} fmt={(v) => `${Math.round(v * 100)}% now`} onChange={set("split_ratio")} testId="whatif-split" />
      </div>
      {base && current && (
        <div className="mt-5 pt-4 border-t border-[var(--line)] text-xs space-y-1.5" data-testid="whatif-delta-table">
          <div className="flex justify-between eyebrow"><span>Pathway</span><span>Base → What-if</span></div>
          {current.pathways.map((p) => {
            const b = base.pathways.find((x) => x.key === p.key);
            const d = p.economics.nrv - (b?.economics.nrv ?? 0);
            return (
              <div key={p.key} className="flex justify-between">
                <span className={p.key === current.action ? "text-emerald-300 font-semibold" : "text-emerald-100/80"}>{PATHWAY_SHORT[p.key]}</span>
                <span className="num">{inr(b?.economics.nrv)} → {inr(p.economics.nrv)} <span className={d >= 0 ? "text-emerald-400" : "text-red-400"}>({d >= 0 ? "+" : ""}{inr(d)})</span></span>
              </div>
            );
          })}
          {current.action !== base.action && <div className="text-amber-300 pt-1" data-testid="whatif-action-changed">Recommendation flips to <b>{current.action_label}</b> under these assumptions.</div>}
        </div>
      )}
    </div>
  );
}
