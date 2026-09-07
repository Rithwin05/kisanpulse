import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { inr, fmtTime } from "../lib/format";

export default function Lots() {
  const [lots, setLots] = useState([]);
  useEffect(() => { api.lots().then(setLots); }, []);
  return (
    <div className="space-y-6" data-testid="lots-page">
      <div className="flex items-end justify-between">
        <div><div className="eyebrow mb-2">Ledger</div><h1 className="text-3xl sm:text-4xl font-extrabold">My lots</h1></div>
        <Link to="/decide" className="btn-primary text-sm" data-testid="lots-new-button">New decision</Link>
      </div>
      {lots.length === 0 && <div className="kp-panel p-8 text-sm text-emerald-200/60" data-testid="lots-empty">No lots yet. Run a decision and create a lot.</div>}
      <div className="grid gap-3">
        {lots.map((l) => (
          <Link key={l.id} to={`/lots/${l.id}`} className="kp-card p-4 flex flex-wrap items-center justify-between gap-3" data-testid={`lot-row-${l.id}`}>
            <div><div className="font-semibold">{l.qty_q} q {l.commodity} · Grade {l.grade}</div><div className="text-xs text-emerald-200/60">{l.market} · {fmtTime(l.created_at)} · {l.decision.action_label}</div></div>
            <div className="flex items-center gap-4"><span className="num text-emerald-300">{inr(l.decision.recommended.economics.nrv)}</span><span className={`chip ${l.status === "open" ? "real" : "sim"}`}>{l.status}</span></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
