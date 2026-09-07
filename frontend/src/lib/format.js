export const inr = (x, d = 0) =>
  x === null || x === undefined ? "—" : `₹${Number(x).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d })}`;
export const pct = (x, d = 1) => (x === null || x === undefined ? "—" : `${x > 0 ? "+" : ""}${Number(x).toFixed(d)}%`);
export const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—");
export const fmtTime = (s) => (s ? new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—");
export const PATHWAY_SHORT = { mandi_now: "Mandi now", direct_buyer: "Direct buyer", fpo_aggregate: "FPO pool", store: "Store", split: "Split lot" };
