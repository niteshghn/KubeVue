import { useEffect, useState, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { ResourceSummary, ResourceEvent, api } from "../../lib/tauri";
import { useAppStore } from "../../stores/appStore";

function timeAgo(isoString: string): string {
  if (!isoString) return "—";
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function EventsTab({ resource }: { resource: ResourceSummary }) {
  const { activeContext } = useAppStore();
  const [events, setEvents] = useState<ResourceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEvents = () => {
    if (!activeContext || !resource.namespace) return;
    api.getResourceEvents(activeContext, resource.kind, resource.name, resource.namespace || "default")
      .then((evts) => {
        setEvents(evts);
        setError(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    fetchEvents();
    intervalRef.current = setInterval(fetchEvents, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeContext, resource.name, resource.kind, resource.namespace]);

  if (loading && events.length === 0) {
    return <div className="p-4 text-sm text-[var(--text-secondary)]">Loading events...</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-[var(--error)]">{error}</div>;
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[var(--text-secondary)]">{events.length} events (auto-refreshes every 10s)</span>
        <button
          onClick={() => { setLoading(true); fetchEvents(); }}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--bg-tertiary)] rounded hover:bg-[var(--border)] transition-colors"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-sm text-[var(--text-secondary)]">No events found for this resource</div>
      ) : (
        <div className="border border-[var(--border)] rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-tertiary)]">
                <th className="px-3 py-1.5 text-left text-xs font-medium text-[var(--text-secondary)]">Type</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-[var(--text-secondary)]">Reason</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-[var(--text-secondary)]">Message</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-[var(--text-secondary)]">Count</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-[var(--text-secondary)]">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt, i) => (
                <tr key={i} className="border-t border-[var(--border)] hover:bg-[var(--bg-secondary)]">
                  <td className="px-3 py-1.5">
                    <span className={`inline-flex items-center gap-1`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${evt.event_type === "Warning" ? "bg-yellow-400" : "bg-green-400"}`} />
                      <span className={evt.event_type === "Warning" ? "text-yellow-400" : "text-green-400"}>
                        {evt.event_type}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-medium">{evt.reason}</td>
                  <td className="px-3 py-1.5 text-[var(--text-secondary)] max-w-md truncate">{evt.message}</td>
                  <td className="px-3 py-1.5">{evt.count ?? "—"}</td>
                  <td className="px-3 py-1.5 text-[var(--text-secondary)]">{timeAgo(evt.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
