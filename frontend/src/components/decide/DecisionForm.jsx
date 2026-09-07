import { MARKETS } from "../../lib/api";

export default function DecisionForm({ form, setForm, onSubmit, loading }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form className="kp-card p-5 sm:p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }} data-testid="decision-form">
      <div className="eyebrow">Describe your lot</div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-emerald-200/70">Commodity
          <select className="kp-input mt-1" value={form.commodity} onChange={(e) => setForm((f) => ({ ...f, commodity: e.target.value, market: MARKETS[e.target.value][0] }))} data-testid="form-commodity">
            {Object.keys(MARKETS).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-xs text-emerald-200/70">Nearest mandi
          <select className="kp-input mt-1" value={form.market} onChange={(e) => set("market", e.target.value)} data-testid="form-market">
            {MARKETS[form.commodity].map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label className="text-xs text-emerald-200/70">Quantity (quintals)
          <input type="number" min="1" className="kp-input mt-1" value={form.qty_q} onChange={(e) => set("qty_q", Number(e.target.value))} data-testid="form-qty" />
        </label>
        <label className="text-xs text-emerald-200/70">Grade
          <select className="kp-input mt-1" value={form.grade} onChange={(e) => set("grade", e.target.value)} data-testid="form-grade">
            {["A", "B", "C"].map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
        <label className="text-xs text-emerald-200/70">Moisture %
          <input type="number" step="0.5" className="kp-input mt-1" value={form.moisture_pct} onChange={(e) => set("moisture_pct", Number(e.target.value))} data-testid="form-moisture" />
        </label>
        <label className="text-xs text-emerald-200/70">Min acceptable ₹/q (optional)
          <input type="number" className="kp-input mt-1" placeholder="defaults to mandi-now NRV" value={form.min_acceptable_price ?? ""} onChange={(e) => set("min_acceptable_price", e.target.value ? Number(e.target.value) : null)} data-testid="form-min-price" />
        </label>
      </div>
      <div className="text-xs text-emerald-300/60">Location: Niphad, Nashik (20.08, 74.11) · single demo farmer profile</div>
      <button type="submit" className="btn-primary w-full" disabled={loading} data-testid="decision-form-submit-button">
        {loading ? "Scoring 5 pathways…" : "What should I do?"}
      </button>
    </form>
  );
}
