export default function SourceChip({ source, className = "", testId }) {
  if (!source) return null;
  const s = String(source);
  const kind = /agmarknet/i.test(s) ? "real" : /simulat|assumption|synthetic|blend|fallback/i.test(s) ? "sim" : "";
  return (
    <span className={`chip ${kind} ${className}`} data-testid={testId || "source-chip"} title="Data source">
      {s}
    </span>
  );
}
