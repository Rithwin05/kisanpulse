import { inr } from "../../lib/format";
import SourceChip from "../SourceChip";

const RISK = { low: "text-emerald-300", medium: "text-amber-300", high: "text-red-300" };

export default function NrvTable({ pathways, recommendedKey }) {
  return (
    <div className="kp-card p-5 sm:p-6 overflow-x-auto reveal" data-testid="nrv-table">
      <div className="flex items-center justify-between mb-3"><h3 className="text-base md:text-lg font-semibold">5-pathway NRV comparison</h3><span className="eyebrow">NRV = qty × E[price] − transport − handling − commission − storage − E[spoilage] − risk</span></div>
      <table className="w-full text-sm min-w-[820px]">
        <thead>
          <tr className="text-left eyebrow border-b border-[var(--line)]">
            <th className="py-2 pr-3">Pathway</th><th className="py-2 pr-3 text-right">₹/q</th><th className="py-2 pr-3 text-right">Gross</th>
            <th className="py-2 pr-3 text-right">Transport</th><th className="py-2 pr-3 text-right">Comm.+Handling</th><th className="py-2 pr-3 text-right">Storage+Spoilage</th>
            <th className="py-2 pr-3 text-right">Risk adj.</th><th className="py-2 pr-3 text-right">NRV</th><th className="py-2 pr-3">Risk</th><th className="py-2 pr-3 text-right">Cash in</th><th className="py-2">Source</th>
          </tr>
        </thead>
        <tbody>
          {pathways.map((p) => {
            const e = p.economics;
            const rec = p.key === recommendedKey;
            return (
              <tr key={p.key} className={`border-b border-[var(--line)] ${rec ? "bg-emerald-500/10" : "hover:bg-emerald-500/5"}`} data-testid={`nrv-row-${p.key}`}>
                <td className="py-2.5 pr-3 font-medium">{rec && <span className="text-emerald-400 mr-1">★</span>}{p.label}<div className="text-[11px] text-emerald-200/50">{p.counterparty}</div></td>
                <td className="py-2.5 pr-3 text-right num">{inr(p.price_per_q)}</td>
                <td className="py-2.5 pr-3 text-right num">{inr(e.gross)}</td>
                <td className="py-2.5 pr-3 text-right num text-red-200/80">−{inr(e.transport)}</td>
                <td className="py-2.5 pr-3 text-right num text-red-200/80">−{inr(e.commission + e.handling)}</td>
                <td className="py-2.5 pr-3 text-right num text-red-200/80">−{inr(e.storage + e.spoilage)}</td>
                <td className="py-2.5 pr-3 text-right num text-amber-200/80" title={`payment ${inr(e.risk_breakdown.payment)} · rejection ${inr(e.risk_breakdown.rejection)} · volatility ${inr(e.risk_breakdown.volatility)}`}>−{inr(e.risk_adjustment)}</td>
                <td className={`py-2.5 pr-3 text-right num font-semibold ${rec ? "text-emerald-300" : ""}`} data-testid={`nrv-value-${p.key}`}>{inr(e.nrv)}</td>
                <td className={`py-2.5 pr-3 capitalize ${RISK[p.risk]}`}>{p.risk}</td>
                <td className="py-2.5 pr-3 text-right num">{p.days_to_cash} d</td>
                <td className="py-2.5"><SourceChip source={p.source} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
