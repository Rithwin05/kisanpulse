import { Truck, PackageCheck, Banknote, ClipboardCheck, Handshake, BookCheck } from "lucide-react";
import { inr, fmtTime } from "../../lib/format";

const STEPS = [
  { key: "accepted", label: "Offer accepted", icon: Handshake, next: "Book transport" },
  { key: "logistics_booked", label: "Transport booked", icon: Truck, next: "Dispatch vehicle" },
  { key: "in_transit", label: "In transit", icon: Truck, next: "Confirm delivery & weighing" },
  { key: "delivered", label: "Delivered & weighed", icon: PackageCheck, next: "Release payment (simulated escrow)" },
  { key: "payment_released", label: "Payment settled", icon: Banknote, next: "Close & record outcome" },
  { key: "closed", label: "Outcome in ledger", icon: BookCheck, next: null },
];

export default function TransactionTimeline({ tx, onAdvance, busy }) {
  const idx = STEPS.findIndex((s) => s.key === tx.stage);
  const cur = STEPS[idx];
  return (
    <div className="kp-card p-5 sm:p-6" data-testid="transaction-timeline">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base md:text-lg font-semibold flex items-center gap-2"><ClipboardCheck size={16} className="text-emerald-400" /> Lot → cash</h3>
        <span className="chip sim">logistics & payment simulated</span>
      </div>
      <ol className="space-y-3">
        {STEPS.map((s, i) => {
          const done = i <= idx;
          const st = tx.stages.find((x) => x.stage === s.key);
          const Icon = s.icon;
          return (
            <li key={s.key} className={`flex gap-3 ${done ? "" : "opacity-40"}`} data-testid={`tx-step-${s.key}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border shrink-0 ${done ? "bg-emerald-500/20 border-emerald-400 text-emerald-300" : "border-emerald-500/30"}`}><Icon size={14} /></div>
              <div className="flex-1 text-sm">
                <div className="flex justify-between"><span className="font-medium">{s.label}</span>{st && <span className="num text-xs text-emerald-300/60">{fmtTime(st.at)}</span>}</div>
                {st?.note && <div className="text-xs text-emerald-200/70">{st.note}</div>}
              </div>
            </li>
          );
        })}
      </ol>
      {tx.logistics && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs" data-testid="logistics-details">
          <div className="kp-panel p-2"><div className="text-emerald-300/60">Vehicle</div><div>{tx.logistics.vehicle}</div></div>
          <div className="kp-panel p-2"><div className="text-emerald-300/60">Distance</div><div className="num">{tx.logistics.distance_km} km · {tx.logistics.eta_hours} h</div></div>
          <div className="kp-panel p-2"><div className="text-emerald-300/60">Cost</div><div className="num">{inr(tx.logistics.cost)}</div></div>
        </div>
      )}
      {tx.payment && <div className="mt-3 text-xs kp-panel p-2 flex justify-between" data-testid="payment-details"><span>{tx.payment.method} · UTR {tx.payment.utr}</span><span className="num text-emerald-300">{inr(tx.payment.amount)}</span></div>}
      {cur.next && (
        <button onClick={onAdvance} disabled={busy} className="btn-primary w-full mt-5" data-testid="tx-advance-button">{busy ? "…" : cur.next}</button>
      )}
    </div>
  );
}
