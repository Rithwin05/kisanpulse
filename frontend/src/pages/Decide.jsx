import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, DEFAULT_LOT } from "../lib/api";
import DecisionForm from "../components/decide/DecisionForm";
import DecisionHero from "../components/decide/DecisionHero";
import NrvTable from "../components/decide/NrvTable";
import WhyPanel from "../components/decide/WhyPanel";
import WhatIfPanel from "../components/decide/WhatIfPanel";
import StaleBanner from "../components/StaleBanner";
import { inr } from "../lib/format";

const BASE_WHATIF = { wait_days: null, price_shock_pct: 0, transport_multiplier: 1, split_ratio: 0.6 };

export default function Decide() {
  const nav = useNavigate();
  const [form, setForm] = useState({ ...DEFAULT_LOT, min_acceptable_price: null });
  const [base, setBase] = useState(null);
  const [current, setCurrent] = useState(null);
  const [whatif, setWhatif] = useState(BASE_WHATIF);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const timer = useRef();

  const run = async () => {
    setLoading(true);
    try {
      const d = await api.decide({ ...form, whatif: BASE_WHATIF });
      setBase(d); setCurrent(d); setWhatif(BASE_WHATIF);
    } catch (e) { toast.error(e?.response?.data?.detail || "Decision failed"); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!base) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setBusy(true);
      try { setCurrent(await api.decide({ ...form, whatif })); } finally { setBusy(false); }
    }, 250);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatif]);

  const createLot = async () => {
    setCreating(true);
    try {
      const lot = await api.createLot({ ...form, whatif: BASE_WHATIF });
      toast.success(`Lot created · ${lot.qty_q} q ${lot.commodity}. Buyer simulator will send 3 offers in 10–20 s.`);
      nav(`/lots/${lot.id}`);
    } catch (e) { toast.error("Could not create lot"); } finally { setCreating(false); }
  };

  return (
    <div className="space-y-6" data-testid="decide-page">
      <div>
        <div className="eyebrow mb-2">Decision engine</div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">What should I do?</h1>
        <p className="text-emerald-200/70 mt-2 text-sm sm:text-base">Scores five pathways on net realizable value, then explains itself.</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
        <DecisionForm form={form} setForm={setForm} onSubmit={run} loading={loading} />
        <div className="xl:col-span-2 space-y-4 md:space-y-6">
          {!current && (
            <div className="kp-panel p-8 text-center text-emerald-200/60 text-sm h-full flex items-center justify-center" data-testid="decision-empty-state">
              Fill the lot details and press <b className="mx-1 text-emerald-200">What should I do?</b> — the engine returns ACTION + economics + confidence + why + alternatives + liquidity impact.
            </div>
          )}
          {current && (
            <>
              <StaleBanner freshnessDays={current.context.freshness_days} source={current.context.mandi.source} />
              {current.context.fallback_level !== "local" && <div className="stale rounded-xl px-4 py-2 text-xs text-amber-200" data-testid="fallback-banner">No local history — {current.context.fallback_level} fallback used, confidence capped at 40%.</div>}
              <DecisionHero decision={current} onCreateLot={createLot} creating={creating} />
            </>
          )}
        </div>
      </div>
      {current && (
        <>
          <NrvTable pathways={current.pathways} recommendedKey={current.action} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
            <WhyPanel why={current.why} confidence={current.confidence} />
            <WhatIfPanel whatif={whatif} setWhatif={setWhatif} base={base} current={current} latency={current.latency_ms} busy={busy} />
          </div>
          <div className="kp-card p-5 text-sm" data-testid="alternatives-panel">
            <div className="eyebrow mb-2">Alternatives</div>
            <div className="flex flex-wrap gap-2">
              {current.alternatives.map((a) => (
                <span key={a.key} className="px-3 py-1.5 rounded-full border border-emerald-500/25 text-emerald-100/80">{a.label} <span className="num text-red-300">{inr(a.delta_vs_best)}</span></span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
