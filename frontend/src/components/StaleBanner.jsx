import { AlertTriangle } from "lucide-react";

export default function StaleBanner({ freshnessDays, source }) {
  if (!freshnessDays || freshnessDays <= 3) return null;
  return (
    <div className="stale rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-amber-200" data-testid="stale-data-banner">
      <AlertTriangle size={18} />
      <span>
        Latest price record is <b className="num">{freshnessDays} days</b> old ({source}). Confidence penalised −15; decision still returned.
      </span>
    </div>
  );
}
