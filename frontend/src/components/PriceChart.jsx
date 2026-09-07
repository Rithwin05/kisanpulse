import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";
import { fmtDate, inr } from "../lib/format";

export default function PriceChart({ series = [], forecast, height = 280 }) {
  const hist = series.slice(-90).map((p) => ({ date: p.date, modal: p.anomaly ? null : p.modal, flagged: p.anomaly ? p.modal : null }));
  const fc = forecast
    ? forecast.dates.map((d, i) => ({ date: d, p50: forecast.p50[i], band: [forecast.p10[i], forecast.p90[i]] }))
    : [];
  const last = [...hist].reverse().find((h) => h.modal !== null);
  const clean = hist.filter((h) => !(h.modal === null && last && h.date > last.date));
  const data = [...clean, ...fc];
  if (last && fc.length) data[clean.length - 1] = { ...last, p50: last.modal, band: [last.modal, last.modal] };

  return (
    <div style={{ width: "100%", height }} data-testid="price-chart">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(110,231,183,0.08)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDate} stroke="rgba(110,231,183,0.4)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} minTickGap={40} />
          <YAxis stroke="rgba(110,231,183,0.4)" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} width={54} tickFormatter={(v) => `₹${v}`} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "#0f2b20", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 10, fontFamily: "JetBrains Mono", fontSize: 12 }}
            labelFormatter={fmtDate}
            formatter={(v, name) => (Array.isArray(v) ? [`${inr(v[0])} – ${inr(v[1])}`, "P10–P90"] : [inr(v), name === "p50" ? "P50 forecast" : name === "modal" ? "Modal" : name])}
          />
          <Area type="monotone" dataKey="band" stroke="none" fill="#10b981" fillOpacity={0.18} isAnimationActive={false} />
          <Line type="monotone" dataKey="modal" stroke="#a7f3d0" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          <Line type="monotone" dataKey="flagged" stroke="none" dot={{ r: 4, fill: "#ef4444", stroke: "#ef4444" }} isAnimationActive={false} name="anomaly (>3σ, excluded)" />
          <Line type="monotone" dataKey="p50" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          {last && <ReferenceLine x={last.date} stroke="rgba(245,158,11,0.5)" strokeDasharray="2 4" label={{ value: "today", fill: "#fcd34d", fontSize: 10, position: "insideTopRight" }} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
