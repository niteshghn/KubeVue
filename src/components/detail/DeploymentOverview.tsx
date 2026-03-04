import { useEffect, useState } from "react";
import { ResourceSummary, api } from "../../lib/tauri";
import { parseDeploymentOverview } from "../../lib/k8s-parsers";
import { useAppStore } from "../../stores/appStore";

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "error" }) {
  const colors = {
    default: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
    success: "bg-green-900/30 text-green-400",
    warning: "bg-yellow-900/30 text-yellow-400",
    error: "bg-red-900/30 text-red-400",
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

export function DeploymentOverview({ resource }: { resource: ResourceSummary }) {
  const { activeContext, setDetailResource } = useAppStore();
  const [relatedPods, setRelatedPods] = useState<ResourceSummary[]>([]);
  const [loadingPods, setLoadingPods] = useState(false);

  const data = parseDeploymentOverview(resource.raw);

  useEffect(() => {
    if (!activeContext || !resource.namespace) return;
    setLoadingPods(true);
    api.getDeploymentPods(activeContext, resource.name, resource.namespace)
      .then(setRelatedPods)
      .catch(() => setRelatedPods([]))
      .finally(() => setLoadingPods(false));
  }, [activeContext, resource.name, resource.namespace]);

  return (
    <div className="p-4 space-y-2">
      {/* Metadata */}
      <Section title="Metadata">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-[var(--text-secondary)]">Namespace:</span> {data.namespace}</div>
          <div><span className="text-[var(--text-secondary)]">Created:</span> {data.creationTimestamp ? new Date(data.creationTimestamp).toLocaleString() : "—"}</div>
          <div><span className="text-[var(--text-secondary)]">Strategy:</span> {data.strategy}</div>
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
        {Object.keys(data.annotations).length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-[var(--text-secondary)]">Annotations:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(data.annotations).map(([k, v]) => (
                <Badge key={k}>{k}={v.length > 40 ? v.slice(0, 40) + "..." : v}</Badge>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Replicas */}
      <Section title="Replicas">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Desired", value: data.replicas.desired },
            { label: "Ready", value: data.replicas.ready },
            { label: "Updated", value: data.replicas.updated },
            { label: "Available", value: data.replicas.available },
          ].map((item) => (
            <div key={item.label} className="bg-[var(--bg-tertiary)] rounded p-2 text-center">
              <div className="text-lg font-semibold">{item.value}</div>
              <div className="text-xs text-[var(--text-secondary)]">{item.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Conditions */}
      {data.conditions.length > 0 && (
        <Section title="Conditions">
          <div className="space-y-1">
            {data.conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Badge variant={c.status === "True" ? "success" : "warning"}>{c.type}</Badge>
                <span className="text-[var(--text-secondary)]">{c.reason}</span>
                {c.message && <span className="text-xs text-[var(--text-secondary)] truncate">{c.message}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Containers */}
      <Section title="Containers">
        {data.containers.map((c) => (
          <div key={c.name} className="bg-[var(--bg-tertiary)] rounded p-3 mb-2">
            <div className="text-sm font-medium mb-1">{c.name}</div>
            <div className="text-xs text-[var(--text-secondary)] mb-2 font-mono">{c.image}</div>
            {c.ports.length > 0 && (
              <div className="text-xs text-[var(--text-secondary)]">
                Ports: {c.ports.map((p) => `${p.containerPort}/${p.protocol || "TCP"}`).join(", ")}
              </div>
            )}
          </div>
        ))}
      </Section>

      {/* Related Pods */}
      <Section title="Related Pods">
        {loadingPods ? (
          <div className="text-sm text-[var(--text-secondary)]">Loading pods...</div>
        ) : relatedPods.length === 0 ? (
          <div className="text-sm text-[var(--text-secondary)]">No pods found</div>
        ) : (
          <div className="border border-[var(--border)] rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--bg-tertiary)]">
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-[var(--text-secondary)]">Name</th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-[var(--text-secondary)]">Status</th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-[var(--text-secondary)]">Restarts</th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-[var(--text-secondary)]">Age</th>
                </tr>
              </thead>
              <tbody>
                {relatedPods.map((pod) => {
                  const cs = pod.raw?.status?.containerStatuses || [];
                  const restarts = cs.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0);
                  return (
                    <tr
                      key={pod.name}
                      className="border-t border-[var(--border)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                      onClick={() => setDetailResource(pod)}
                    >
                      <td className="px-3 py-1.5 text-[var(--accent)]">{pod.name}</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center gap-1`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pod.status.toLowerCase() === "running" ? "bg-green-400" : pod.status.toLowerCase() === "pending" ? "bg-yellow-400" : "bg-gray-400"}`} />
                          {pod.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">{restarts}</td>
                      <td className="px-3 py-1.5">{pod.age}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
