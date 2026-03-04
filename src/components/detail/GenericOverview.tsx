import { ResourceSummary } from "../../lib/tauri";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex px-2 py-0.5 text-xs rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
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

export function GenericOverview({ resource }: { resource: ResourceSummary }) {
  const meta = resource.raw?.metadata || {};
  const spec = resource.raw?.spec || {};
  const status = resource.raw?.status || {};
  const labels: Record<string, string> = meta.labels || {};
  const annotations: Record<string, string> = meta.annotations || {};

  // Extract interesting top-level spec keys to display
  const specEntries = Object.entries(spec).filter(
    ([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean"
  );
  const statusEntries = Object.entries(status).filter(
    ([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean"
  );

  return (
    <div className="p-4 space-y-2">
      {/* Metadata */}
      <Section title="Metadata">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-[var(--text-secondary)]">Name:</span> {resource.name}</div>
          <div><span className="text-[var(--text-secondary)]">Kind:</span> {resource.kind}</div>
          <div><span className="text-[var(--text-secondary)]">Namespace:</span> {resource.namespace || "—"}</div>
          <div><span className="text-[var(--text-secondary)]">Age:</span> {resource.age}</div>
          <div><span className="text-[var(--text-secondary)]">Status:</span> {resource.status}</div>
          {meta.creationTimestamp && (
            <div><span className="text-[var(--text-secondary)]">Created:</span> {new Date(meta.creationTimestamp).toLocaleString()}</div>
          )}
        </div>
      </Section>

      {/* Labels */}
      {Object.keys(labels).length > 0 && (
        <Section title="Labels">
          <div className="flex flex-wrap gap-1">
            {Object.entries(labels).map(([k, v]) => (
              <Badge key={k}>{k}={v}</Badge>
            ))}
          </div>
        </Section>
      )}

      {/* Annotations */}
      {Object.keys(annotations).length > 0 && (
        <Section title="Annotations">
          <div className="space-y-1">
            {Object.entries(annotations).map(([k, v]) => (
              <div key={k} className="text-xs font-mono">
                <span className="text-[var(--text-primary)]">{k}</span>
                <span className="text-[var(--text-secondary)]"> = {typeof v === "string" && v.length > 80 ? v.slice(0, 80) + "..." : String(v)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Spec fields */}
      {specEntries.length > 0 && (
        <Section title="Spec">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {specEntries.map(([k, v]) => (
              <div key={k}>
                <span className="text-[var(--text-secondary)]">{k}:</span> {String(v)}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Status fields */}
      {statusEntries.length > 0 && (
        <Section title="Status">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {statusEntries.map(([k, v]) => (
              <div key={k}>
                <span className="text-[var(--text-secondary)]">{k}:</span> {String(v)}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
