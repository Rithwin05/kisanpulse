import { ShieldCheck, AlertTriangle } from "lucide-react";
import { inr } from "../../lib/format";
import SourceChip from "../SourceChip";

export default function OffersList({ lot, onAccept, accepting }) {
  const offers = lot.offers || [];
  const pending = lot.offers_expected - offers.length;
  const open = lot.status === "open";
  return (
    <div className="kp-card p-5 sm:p-6" data-testid="offers-list">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base md:text-lg font-semibold">Offers <span className="num text-emerald-300/70">{offers.length}/{lot.offers_expected}</span></h3>
        <SourceChip source="buyer response simulator · seeded buyers" />
      </div>
      {offers.length === 0 && (
        <div className="text-sm text-emerald-200/70 flex items-center gap-2" data-testid="offers-waiting"><span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" /> Buyers are reviewing your lot. Simulated responses arrive 10–20 s after creation.</div>
      )}
      <div className="space-y-3">
        {offers.map((o, i) => {
          const best = open && o.nrv === Math.max(...offers.filter((x) => x.status === "open").map((x) => x.nrv));
          return (
            <div key={o.id} className={`kp-panel p-4 reveal ${best ? "border-emerald-500/50" : ""} ${o.status === "declined" ? "opacity-50" : ""}`} data-testid={`offer-card-${i}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold flex items-center gap-2">{o.buyer_name} <span className="text-xs text-emerald-300/60 capitalize">{o.buyer_type.replace("_", " ")}</span>
                    {o.status !== "open" && <span className="chip sim">{o.status}</span>}</div>
                  <div className="text-xs text-emerald-200/60 mt-0.5">{o.distance_km} km · pays in {o.payment_days} d · match {o.match_score}</div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs" data-testid={`offer-trust-${i}`}>
                    <ShieldCheck size={13} className={o.trust_band === "high" ? "text-emerald-400" : o.trust_band === "medium" ? "text-amber-400" : "text-red-400"} />
                    Trust <b className="num">{o.trust_score}</b>/100 <span className="chip sim">simulated history</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-2xl font-semibold" data-testid={`offer-price-${i}`}>{inr(o.price_per_q)}<span className="text-xs text-emerald-300/60">/q</span></div>
                  <div className="text-xs text-emerald-200/70">NRV <b className="num" data-testid={`offer-nrv-${i}`}>{inr(o.nrv)}</b> · {o.qty_q} q</div>
                  {o.below_mav && <div className="text-xs text-amber-300 flex items-center gap-1 justify-end mt-1" data-testid={`offer-below-mav-${i}`}><AlertTriangle size={12} /> below min acceptable value</div>}
                </div>
              </div>
              {open && o.status === "open" && (
                <button onClick={() => onAccept(o)} disabled={accepting} className={`mt-3 w-full text-sm ${best ? "btn-primary" : "btn-ghost"}`} data-testid={`accept-offer-${i}`}>
                  {best ? "Accept best offer" : "Accept this offer"}
                </button>
              )}
            </div>
          );
        })}
        {open && pending > 0 && offers.length > 0 && <div className="text-xs text-emerald-300/60 pulse-dot">{pending} more buyer{pending > 1 ? "s" : ""} responding…</div>}
      </div>
    </div>
  );
}
