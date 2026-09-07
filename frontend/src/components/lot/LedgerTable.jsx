import { fmtTime } from "../../lib/format";

export default function LedgerTable({ events }) {
  return (
    <div className="kp-card p-5 sm:p-6" data-testid="audit-ledger">
      <div className="flex items-center justify-between mb-3"><h3 className="text-base md:text-lg font-semibold">Outcome ledger · audit log</h3><span className="eyebrow">{events.length} events · append-only</span></div>
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left eyebrow border-b border-[var(--line)]"><th className="py-2 pr-3">Time</th><th className="py-2 pr-3">Actor</th><th className="py-2 pr-3">Event</th><th className="py-2">Payload</th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-[var(--line)] align-top" data-testid={`audit-row-${e.event}`}>
                <td className="py-2 pr-3 num text-emerald-300/70 whitespace-nowrap">{fmtTime(e.ts)}</td>
                <td className="py-2 pr-3 text-emerald-200/70">{e.actor}</td>
                <td className="py-2 pr-3 font-medium num">{e.event}</td>
                <td className="py-2 num text-emerald-100/70 break-all">{JSON.stringify(e.payload)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
