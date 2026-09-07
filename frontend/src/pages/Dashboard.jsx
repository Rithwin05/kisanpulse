import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, Users, TrendingUp, Database } from "lucide-react";
import { api, MARKETS } from "../lib/api";
import { inr, pct, fmtDate } from "../lib/format";
import SourceChip from "../components/SourceChip";
import PriceChart from "../components/PriceChart";
import StaleBanner from "../components/StaleBanner";

export default function Dashboard() {
  const [commodity, setCommodity] = useState("Onion");
  const [market, setMarket] = useState("Lasalgaon");
  const [latest, setLatest] = useState(null);
  const [series, setSeries] = useState([]);
  const [fc, setFc] = useState(null);
  const [meta, setMeta] = useState(null);

  useEffect(() => { setMarket(MARKETS[commodity][0]); }, [commodity]);
  useEffect(() => {
    api.latest(commodity).then(setLatest);
    api.pricesMeta().then(setMeta);
  }, [commodity]);
  useEffect(() => {
    setFc(null);
    api.series(commodity, market, 180).then((d) => setSeries(d.points));
    api.forecast(commodity, market).then(setFc).catch(() => setFc(null));
  }, [commodity, market]);

  const home = latest?.markets.find((m) => m.market === market);
  const p50 = fc?.p50?.[6];
  const move = home && p50 ? ((p50 / home.modal) - 1) * 100 : null;

  return (
    <div className="space-y-6 reveal" data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">Nashik · {commodity} · demo date {latest?.demo_today}</div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">Namaskar, Ramesh.</h1>
          <p className="text-emerald-200/70 mt-2 text-sm sm:text-base max-w-xl">One risk-adjusted selling decision per lot. Every number carries its source; nothing here is invented without a label.</p>
        </div>
        <div className="flex gap-2">
          {Object.keys(MARKETS).map((c) => (
            <button key={c} onClick={() => setCommodity(c)} data-testid={`commodity-toggle-${c.toLowerCase()}`}
              className={`px-4 py-2 rounded-full text-sm border transition-colors ${commodity === c ? "bg-emerald-500 text-[#04130d] border-emerald-400 font-semibold" : "border-emerald-500/30 text-emerald-200/80 hover:bg-emerald-500/10"}`}>{c}</button>
          ))}
        </div>
      </div>

      {home && <StaleBanner freshnessDays={home.freshness_days} source={home.source_chip} />}
      {meta?.commodities?.find((c) => c.commodity === commodity)?.source === "synthetic-seasonal" && (
        <div className="kp-panel px-4 py-2.5 text-xs text-amber-200/90 flex items-center gap-2" data-testid="synthetic-notice">
          <Database size={14} /> Agmarknet fetch (data.gov.in) is rate-limited right now — prices shown are a <b>labelled synthetic-seasonal</b> series modelled on Lasalgaon seasonality. The scheduler retries nightly; every chip tells you which it is.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
        <div className="xl:col-span-2 kp-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <div className="eyebrow">Modal price · {market}</div>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="num text-4xl font-semibold" data-testid="home-modal-price">{home ? inr(home.modal) : "—"}</span>
                <span className="text-emerald-300/70 text-sm">/quintal</span>
                {home?.wow_pct !== null && home && (
                  <span className={`num text-sm flex items-center ${home.wow_pct >= 0 ? "text-emerald-400" : "text-red-400"}`} data-testid="home-wow-pct">
                    {home.wow_pct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{pct(home.wow_pct)} w/w
                  </span>
                )}
              </div>
              <div className="mt-2 flex gap-2 flex-wrap"><SourceChip source={home?.source_chip} testId="home-price-source" />{fc && <SourceChip source={`forecast ${fc.backtest.champion} · MAPE ${fc.backtest.mape[fc.backtest.champion]}%`} testId="forecast-model-chip" />}</div>
            </div>
            <select value={market} onChange={(e) => setMarket(e.target.value)} className="kp-input w-auto text-xs" data-testid="market-select">
              {MARKETS[commodity].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <PriceChart series={series} forecast={fc} />
          {fc && (
            <div className="grid grid-cols-3 gap-3 mt-4" data-testid="forecast-band-summary">
              {[["P10 (pessimistic)", fc.p10[6]], ["P50 (expected)", fc.p50[6]], ["P90 (optimistic)", fc.p90[6]]].map(([l, v]) => (
                <div key={l} className="bg-emerald-950/40 border border-emerald-500/20 rounded-lg p-3">
                  <div className="eyebrow" style={{ fontSize: 9.5 }}>{l} · day 7</div>
                  <div className="num text-lg mt-1">{inr(v)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Link to="/decide" className="kp-hero block p-6 group" data-testid="dashboard-decide-cta">
            <div className="eyebrow text-emerald-300">Primary action</div>
            <div className="font-display text-2xl font-bold mt-2">What should I do with my lot?</div>
            <p className="text-sm text-emerald-100/70 mt-2">300 q Grade-A onion, Niphad. Get a 5-pathway NRV decision with confidence and evidence.</p>
            {move !== null && (
              <div className="mt-4 flex items-center gap-2 text-sm">
                <TrendingUp size={16} className="text-amber-400" />
                <span className="text-emerald-100/80">7-day P50 move</span>
                <span className={`num font-semibold ${move >= 0 ? "text-emerald-300" : "text-red-300"}`} data-testid="dashboard-p50-move">{pct(move)}</span>
              </div>
            )}
            <div className="mt-5 inline-flex btn-primary text-sm group-hover:translate-y-[-1px]">Open decision engine →</div>
          </Link>

          <div className="kp-card p-5" data-testid="fpo-opportunity-card">
            <div className="flex items-center gap-2 mb-2"><Users size={16} className="text-amber-400" /><span className="eyebrow">FPO aggregation opportunity</span></div>
            <p className="text-sm text-emerald-100/80">Niphad FPC is pooling <b className="num">1,240 q</b> onion for a Pune retail-chain contract this week. A consolidated 25 t truck cuts transport ~40% per lot and bulk premium is ~3%.</p>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div className="bg-emerald-950/40 rounded-lg p-2"><div className="text-emerald-300/60">Your transport</div><div className="num text-base">{inr(300 * 15 * 0.85 + 1500)} → {inr((300 * 15 * 0.85 + 1500) * 0.6)}</div></div>
              <div className="bg-emerald-950/40 rounded-lg p-2"><div className="text-emerald-300/60">Members joined</div><div className="num text-base">14 / 20</div></div>
            </div>
            <div className="mt-3"><SourceChip source="simulated FPO · read-only card" /></div>
          </div>
        </div>
      </div>

      <div className="kp-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4"><h2 className="text-base md:text-lg font-semibold">Nearby mandis · {commodity}</h2><span className="eyebrow">distance from Niphad</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="mandi-table">
            <thead><tr className="text-left eyebrow border-b border-[var(--line)]"><th className="py-2 pr-3">Mandi</th><th className="py-2 pr-3">District</th><th className="py-2 pr-3 text-right">Modal ₹/q</th><th className="py-2 pr-3 text-right">Min–Max</th><th className="py-2 pr-3 text-right">w/w</th><th className="py-2 pr-3 text-right">km</th><th className="py-2 pr-3">Source</th></tr></thead>
            <tbody>
              {latest?.markets.map((m) => (
                <tr key={m.market} className="border-b border-[var(--line)] hover:bg-emerald-500/5 cursor-pointer" onClick={() => setMarket(m.market)} data-testid={`mandi-row-${m.market.replace(/\s+/g, "-").toLowerCase()}`}>
                  <td className="py-2.5 pr-3 font-medium">{m.market}</td><td className="py-2.5 pr-3 text-emerald-200/70">{m.district}</td>
                  <td className="py-2.5 pr-3 text-right num">{inr(m.modal)}</td><td className="py-2.5 pr-3 text-right num text-emerald-200/60">{inr(m.min)}–{inr(m.max)}</td>
                  <td className={`py-2.5 pr-3 text-right num ${m.wow_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>{pct(m.wow_pct)}</td>
                  <td className="py-2.5 pr-3 text-right num">{m.distance_km}</td><td className="py-2.5 pr-3"><SourceChip source={m.source_chip} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta && <div className="text-xs text-emerald-300/50 mt-3">Coverage: {meta.commodities.map((c) => `${c.commodity} ${c.records} rec · ${fmtDate(c.first_date)}→${fmtDate(c.latest_date)} · ${c.anomalies_flagged} anomalies flagged`).join(" | ")}</div>}
      </div>
    </div>
  );
}
