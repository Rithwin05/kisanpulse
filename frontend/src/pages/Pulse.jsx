import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { api, MARKETS } from "../lib/api";
import { inr, pct } from "../lib/format";
import SourceChip from "../components/SourceChip";

const COLORS = { surplus: "#f59e0b", balanced: "#10b981", shortage: "#ef4444", "no-data": "#334155" };
const STYLE = {
  version: 8,
  sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap" } },
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#05130d" } }, { id: "osm", type: "raster", source: "osm", paint: { "raster-opacity": 0.35, "raster-saturation": -0.9, "raster-brightness-max": 0.6 } }],
};

export default function Pulse() {
  const [commodity, setCommodity] = useState("Onion");
  const [data, setData] = useState(null);
  const ref = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);

  useEffect(() => { api.pulse(commodity).then(setData); }, [commodity]);

  useEffect(() => {
    if (map.current || !ref.current) return;
    map.current = new maplibregl.Map({ container: ref.current, style: STYLE, center: [76.3, 19.3], zoom: 5.8, attributionControl: false });
    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  }, []);

  useEffect(() => {
    if (!map.current || !data) return;
    markers.current.forEach((m) => m.remove());
    markers.current = data.districts.filter((d) => d.status !== "no-data").map((d) => {
      const el = document.createElement("div");
      const size = 14 + Math.min(40, Math.sqrt(d.arrivals_q_per_day) / 3);
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${COLORS[d.status]};opacity:.85;border:2px solid rgba(255,255,255,.5);box-shadow:0 0 16px ${COLORS[d.status]}88;cursor:pointer;display:flex;align-items:center;justify-content:center;font:600 10px JetBrains Mono;color:#04130d`;
      el.textContent = d.price_trend_pct === null ? "" : d.price_trend_pct >= 0 ? "▲" : "▼";
      el.setAttribute("data-testid", `pulse-marker-${d.district.toLowerCase()}`);
      const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`<div style="font-size:12px"><b>${d.district}</b> · ${d.status}<br/>arrivals ${d.arrivals_q_per_day.toLocaleString("en-IN")} q/d vs demand ${d.demand_q_per_day.toLocaleString("en-IN")} q/d<br/>avg modal ${d.avg_modal ? inr(d.avg_modal) : "—"} · trend ${pct(d.price_trend_pct)}</div>`);
      return new maplibregl.Marker({ element: el }).setLngLat([d.lon, d.lat]).setPopup(popup).addTo(map.current);
    });
  }, [data]);

  const counts = data ? data.districts.reduce((a, d) => ({ ...a, [d.status]: (a[d.status] || 0) + 1 }), {}) : {};

  return (
    <div className="space-y-6" data-testid="pulse-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="eyebrow mb-2">Market Pulse · {data?.demo_today}</div><h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">Where is the produce going?</h1><p className="text-emerald-200/70 mt-2 text-sm">District supply vs demand (7-day) with price trend arrows. This map is the digital twin.</p></div>
        <div className="flex gap-2">{Object.keys(MARKETS).map((c) => <button key={c} onClick={() => setCommodity(c)} data-testid={`pulse-commodity-${c.toLowerCase()}`} className={`px-4 py-2 rounded-full text-sm border ${commodity === c ? "bg-emerald-500 text-[#04130d] border-emerald-400 font-semibold" : "border-emerald-500/30 text-emerald-200/80"}`}>{c}</button>)}</div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 md:gap-6">
        <div className="xl:col-span-3 kp-card overflow-hidden" style={{ height: 560 }}><div ref={ref} className="w-full h-full" data-testid="pulse-map" /></div>
        <div className="space-y-4">
          <div className="kp-card p-4">
            <div className="eyebrow mb-3">Legend</div>
            {Object.entries(COLORS).filter(([k]) => k !== "no-data").map(([k, c]) => <div key={k} className="flex items-center justify-between text-sm py-1"><span className="flex items-center gap-2 capitalize"><span className="w-3 h-3 rounded-full" style={{ background: c }} />{k}</span><span className="num text-emerald-300/70" data-testid={`pulse-count-${k}`}>{counts[k] || 0}</span></div>)}
            <div className="text-xs text-emerald-300/60 mt-2">Surplus &gt;1.15× demand · Shortage &lt;0.85× · ▲▼ 7d price trend</div>
            <div className="mt-3 flex flex-wrap gap-1"><SourceChip source="arrivals & demand simulated" /><SourceChip source="prices: prices collection" /></div>
          </div>
          <div className="kp-card p-4 max-h-[340px] overflow-y-auto">
            <div className="eyebrow mb-2">Districts</div>
            <table className="w-full text-xs" data-testid="pulse-table">
              <tbody>
                {data?.districts.filter((d) => d.status !== "no-data").sort((a, b) => b.ratio - a.ratio).map((d) => (
                  <tr key={d.district} className="border-b border-[var(--line)]"><td className="py-1.5"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: COLORS[d.status] }} />{d.district}</td><td className="py-1.5 text-right num">{d.ratio}×</td><td className={`py-1.5 text-right num ${d.price_trend_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>{pct(d.price_trend_pct)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
