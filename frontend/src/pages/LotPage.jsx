import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../lib/api";
import { inr } from "../lib/format";
import OffersList from "../components/lot/OffersList";
import TransactionTimeline from "../components/lot/TransactionTimeline";
import MoneyMeter from "../components/lot/MoneyMeter";
import LedgerTable from "../components/lot/LedgerTable";
import SourceChip from "../components/SourceChip";

export default function LotPage() {
  const { id } = useParams();
  const [lot, setLot] = useState(null);
  const [mm, setMm] = useState(null);
  const [audit, setAudit] = useState([]);
  const [busy, setBusy] = useState(false);
  const [override, setOverride] = useState(null);

  const refresh = useCallback(async () => {
    const l = await api.lot(id);
    setLot(l);
    setAudit(await api.audit(id));
    if (l.transaction) setMm(await api.moneyMeter(id));
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!lot || lot.status !== "open" || (lot.offers?.length ?? 0) >= lot.offers_expected) return;
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [lot, refresh]);

  const accept = async (o, force = false) => {
    setBusy(true);
    try {
      await api.acceptOffer(o.id, force);
      toast.success(`Accepted ${o.buyer_name} at ${inr(o.price_per_q)}/q`);
      setOverride(null);
      await refresh();
    } catch (e) {
      const d = e?.response?.data?.detail;
      if (d?.code === "BELOW_MAV") setOverride({ offer: o, ...d });
      else toast.error(typeof d === "string" ? d : "Could not accept offer");
    } finally { setBusy(false); }
  };

  const advance = async () => {
    setBusy(true);
    try { await api.advance(lot.transaction.id); await refresh(); } finally { setBusy(false); }
  };

  if (!lot) return <div className="text-emerald-200/60 text-sm">Loading lot…</div>;
  const rec = lot.decision.recommended;

  return (
    <div className="space-y-6" data-testid="lot-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2"><Link to="/lots" className="hover:text-emerald-200">My lots</Link> / {lot.id.slice(0, 8)} · <span className="capitalize">{lot.status}</span></div>
          <h1 className="text-3xl sm:text-4xl font-extrabold">{lot.qty_q} q {lot.commodity} · Grade {lot.grade}</h1>
          <div className="text-sm text-emerald-200/70 mt-1">Recommended: <b>{rec.label}</b> · NRV <span className="num">{inr(rec.economics.nrv)}</span> · confidence <span className="num">{lot.decision.confidence.score}</span> · MAV <span className="num" data-testid="lot-mav">{inr(lot.decision.min_acceptable_value)}</span></div>
          <div className="mt-2 flex gap-2"><SourceChip source={lot.context.mandi.source} /><SourceChip source={lot.context.forecast_summary.source_chip} /></div>
        </div>
      </div>

      {override && (
        <div className="stale rounded-xl p-4 text-sm reveal" data-testid="mav-override-dialog">
          <div className="font-semibold text-amber-200">Offer below Minimum Acceptable Value</div>
          <p className="text-amber-100/80 mt-1">{override.offer.buyer_name}'s offer NRV {inr(override.offer_nrv)} is {inr(override.shortfall)} below your MAV {inr(override.min_acceptable_value)} (mandi-now NRV). You can walk away or override — the override is logged.</p>
          <div className="flex gap-2 mt-3">
            <button className="btn-ghost text-xs" onClick={() => setOverride(null)} data-testid="mav-cancel-button">Keep looking</button>
            <button className="btn-primary text-xs !py-2" onClick={() => accept(override.offer, true)} data-testid="mav-override-button">Override & accept anyway</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        <OffersList lot={lot} onAccept={(o) => accept(o)} accepting={busy} />
        <div className="space-y-4 md:space-y-6">
          {lot.transaction ? <TransactionTimeline tx={lot.transaction} onAdvance={advance} busy={busy} /> : (
            <div className="kp-panel p-6 text-sm text-emerald-200/60" data-testid="tx-placeholder">Accept an offer to start logistics, payment and the outcome ledger.</div>
          )}
          {mm && <MoneyMeter mm={mm} />}
        </div>
      </div>
      <LedgerTable events={audit} />
    </div>
  );
}
