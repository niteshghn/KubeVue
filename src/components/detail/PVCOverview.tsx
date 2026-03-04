import { ResourceSummary } from "../../lib/tauri";
import { parsePVCOverview } from "../../lib/k8s-parsers";

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "error" | "info" }) {
  const colors = {
    default: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
    success: "bg-green-900/30 text-green-400",
    warning: "bg-yellow-900/30 text-yellow-400",
    error: "bg-red-900/30 text-red-400",
    info: "bg-blue-900/30 text-blue-400",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs rounded ${colors[variant]}`}>
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  );
}

export function PVCOverview({ resource }: { resource: ResourceSummary }) {
  const data = parsePVCOverview(resource.raw);

  const phaseVariant = data.phase === "Bound" ? "success" : data.phase === "Pending" ? "warning" : "error";

  return (
    <div className="p-4 space-y-2">
      <Section title="PVC Info">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-[var(--text-secondary)]">Status:</span>{" "}
            <Badge variant={phaseVariant}>{data.phase}</Badge>
          </div>
          <div><span className="text-[var(--text-secondary)]">Namespace:</span> {data.namespace}</div>
          <div><span className="text-[var(--text-secondary)]">Storage Class:</span> {data.storageClass || "—"}</div>
          <div><span className="text-[var(--text-secondary)]">Volume:</span> {data.volumeName || "—"}</div>
          <div><span className="text-[var(--text-secondary)]">Created:</span> {data.creationTimestamp ? new Date(data.creationTimestamp).toLocaleString() : "—"}</div>
        </div>
        {Object.keys(data.labels).length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-[var(--text-secondary)]">Labels:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(data.labels).map(([k, v]) => (
                <Badge key={k}>{k}={v}</Badge>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="Capacity">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--bg-tertiary)] rounded p-3 text-center">
            <div className="text-lg font-semibold">{data.requestedStorage || "—"}</div>
            <div className="text-xs text-[var(--text-secondary)]">Requested</div>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded p-3 text-center">
            <div className="text-lg font-semibold">{data.provisionedStorage || "—"}</div>
            <div className="text-xs text-[var(--text-secondary)]">Provisioned</div>
          </div>
        </div>
      </Section>

      <Section title="Access Modes">
        <div className="flex flex-wrap gap-2">
          {data.accessModes.length > 0 ? (
            data.accessModes.map((mode, i) => (
              <Badge key={i} variant="info">{mode}</Badge>
            ))
          ) : (
            <span className="text-sm text-[var(--text-secondary)]">—</span>
          )}
        </div>
      </Section>
    </div>
  );
}
