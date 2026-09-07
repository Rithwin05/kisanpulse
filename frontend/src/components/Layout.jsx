import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Activity, LayoutDashboard, Scale, Boxes, Map as MapIcon, Landmark, RotateCcw } from "lucide-react";
import { api } from "../lib/api";
import SourceChip from "./SourceChip";
import { toast } from "sonner";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, id: "nav-dashboard" },
  { to: "/decide", label: "What should I do?", icon: Scale, id: "nav-decide" },
  { to: "/lots", label: "My lots", icon: Boxes, id: "nav-lots" },
  { to: "/pulse", label: "Market Pulse", icon: MapIcon, id: "nav-pulse" },
  { to: "/console", label: "MSAMB console", icon: Landmark, id: "nav-console" },
];

export default function Layout({ children }) {
  const [state, setState] = useState(null);
  const loc = useLocation();
  useEffect(() => { api.demoState().then(setState).catch(() => {}); }, [loc.pathname]);

  const reset = async () => {
    await api.reset();
    toast.success("Demo reset: lots, offers, transactions and audit log cleared");
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-[var(--line)] bg-[#081912] p-5 sticky top-0 h-screen">
        <Link to="/" className="flex items-center gap-2.5 mb-8" data-testid="brand-link">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <Activity size={18} className="text-emerald-400" />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-tight">KisanPulse</div>
            <div className="eyebrow" style={{ fontSize: 9 }}>SIH26132 · Maharashtra</div>
          </div>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, id }) => (
            <NavLink key={to} to={to} end={to === "/"} data-testid={id}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30" : "text-emerald-100/70 hover:bg-emerald-500/8 hover:text-emerald-100"}`}>
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          {state && (
            <div className="kp-panel p-3 text-xs space-y-1.5" data-testid="demo-state-panel">
              <div className="flex justify-between"><span className="text-emerald-300/60">Farmer</span><span>{state.farmer?.name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-emerald-300/60">Village</span><span>{state.farmer?.village || "—"}, {state.farmer?.district || "—"}</span></div>
              <div className="flex justify-between items-center"><span className="text-emerald-300/60">Today</span><span className="num" data-testid="demo-today">{state.demo_today || "—"}</span></div>
              <div className="pt-1"><SourceChip source={state.source_chip} testId="demo-source-chip" /></div>
            </div>
          )}
          <button onClick={reset} className="btn-ghost w-full text-xs flex items-center justify-center gap-2" data-testid="demo-reset-button">
            <RotateCcw size={12} /> Reset demo
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--line)] bg-[#081912]">
          <Link to="/" className="font-display font-bold">KisanPulse</Link>
          <nav className="flex gap-3 text-xs">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} className="text-emerald-200/80">{n.label.split(" ")[0]}</NavLink>)}
          </nav>
        </header>
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
