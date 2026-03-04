import { useEffect, useState } from "react";
import { ResourceSummary, PodMetricsResult, api } from "../../lib/tauri";
import { parsePodOverview } from "../../lib/k8s-parsers";
import { useAppStore } from "../../stores/appStore";

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

function formatCpu(nanos: number): string {
  if (nanos >= 1_000_000_000) return `${(nanos / 1_000_000_000).toFixed(2)} cores`;
  if (nanos >= 1_000_000) return `${Math.round(nanos / 1_000_000)}m`;
  return `${Math.round(nanos / 1_000)}u`;
}

function formatMemory(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}Gi`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))}Mi`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}Ki`;
  return `${bytes}B`;
}

function parseCpuLimit(val: string): number {
  if (val.endsWith("n")) return parseInt(val) || 0;
  if (val.endsWith("u")) return (parseInt(val) || 0) * 1_000;
  if (val.endsWith("m")) return (parseInt(val) || 0) * 1_000_000;
  return (parseFloat(val) || 0) * 1_000_000_000;
}

function parseMemLimit(val: string): number {
  if (val.endsWith("Ki")) return (parseInt(val) || 0) * 1024;
  if (val.endsWith("Mi")) return (parseInt(val) || 0) * 1024 * 1024;
  if (val.endsWith("Gi")) return (parseInt(val) || 0) * 1024 * 1024 * 1024;
  if (val.endsWith("k")) return (parseInt(val) || 0) * 1000;
  if (val.endsWith("M")) return (parseInt(val) || 0) * 1_000_000;
  if (val.endsWith("G")) return (parseInt(val) || 0) * 1_000_000_000;
  return parseInt(val) || 0;
}

function UsageBar({ label, used, limit, formatFn }: { label: string; used: number; limit: number; formatFn: (n: number) => string }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500";

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span>{formatFn(used)}{limit > 0 ? ` / ${formatFn(limit)}` : ""}</span>
      </div>
      {limit > 0 ? (
        <div className="w-full h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <div className="text-xs text-[var(--text-secondary)]">{formatFn(used)} (no limit set)</div>
      )}
    </div>
  );
}

export function PodOverview({ resource }: { resource: ResourceSummary }) {
  const { activeContext } = useAppStore();
  const data = parsePodOverview(resource.raw);
  const [metrics, setMetrics] = useState<PodMetricsResult | null>(null);

  useEffect(() => {
    if (!activeContext || !resource.namespace) return;
    api.getPodMetrics(activeContext, resource.name, resource.namespace || "default")
      .then(setMetrics)
      .catch(() => setMetrics(null));
  }, [activeContext, resource.name, resource.namespace]);

  return (
    <div className="p-4 space-y-2">
      {/* Pod Info */}
      <Section title="Pod Info">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-[var(--text-secondary)]">Status:</span>{" "}
            <Badge variant={data.phase === "Running" ? "success" : data.phase === "Pending" ? "warning" : "error"}>{data.phase}</Badge>
          </div>
          <div><span className="text-[var(--text-secondary)]">Node:</span> {data.nodeName || "—"}</div>
          <div><span className="text-[var(--text-secondary)]">Pod IP:</span> {data.podIP || "—"}</div>
          <div><span className="text-[var(--text-secondary)]">Host IP:</span> {data.hostIP || "—"}</div>
          <div><span className="text-[var(--text-secondary)]">Namespace:</span> {data.namespace}</div>
          <div><span className="text-[var(--text-secondary)]">Service Account:</span> {data.serviceAccount || "—"}</div>
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

      {/* Conditions */}
      {data.conditions.length > 0 && (
        <Section title="Conditions">
          <div className="flex flex-wrap gap-2">
            {data.conditions.map((c, i) => (
              <Badge key={i} variant={c.status === "True" ? "success" : "warning"}>{c.type}</Badge>
            ))}
          </div>
        </Section>
      )}

      {/* Containers */}
      <Section title={`Containers (${data.containers.length})`}>
        {data.containers.map((c) => (
          <div key={c.name} className="bg-[var(--bg-tertiary)] rounded p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{c.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant={c.ready ? "success" : "warning"}>{c.state}</Badge>
                {c.restartCount > 0 && <Badge variant="warning">{c.restartCount} restarts</Badge>}
              </div>
            </div>
            <div className="text-xs font-mono text-[var(--text-secondary)] mb-2">{c.image}</div>

            {/* Ports */}
            {c.ports.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-[var(--text-secondary)] mb-1">Ports:</div>
                <div className="flex flex-wrap gap-1">
                  {c.ports.map((p, i) => (
                    <Badge key={i} variant="info">{p.name ? `${p.name}:` : ""}{p.containerPort}/{p.protocol || "TCP"}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Resources */}
            {(c.resources.requests || c.resources.limits) && (
              <div className="mb-2">
                <div className="text-xs text-[var(--text-secondary)] mb-1">Resources:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {c.resources.requests && (
                    <div>
                      <span className="text-[var(--text-secondary)]">Requests:</span>{" "}
                      {Object.entries(c.resources.requests).map(([k, v]) => `${k}: ${v}`).join(", ")}
                    </div>
                  )}
                  {c.resources.limits && (
                    <div>
                      <span className="text-[var(--text-secondary)]">Limits:</span>{" "}
                      {Object.entries(c.resources.limits).map(([k, v]) => `${k}: ${v}`).join(", ")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Live Metrics */}
            {metrics?.available && (() => {
              const cm = metrics.containers.find((m) => m.name === c.name);
              if (!cm) return null;
              const cpuLimit = c.resources.limits?.cpu ? parseCpuLimit(c.resources.limits.cpu) : 0;
              const memLimit = c.resources.limits?.memory ? parseMemLimit(c.resources.limits.memory) : 0;
              return (
                <div className="mb-2">
                  <div className="text-xs text-[var(--text-secondary)] mb-1">Live Usage:</div>
                  <UsageBar label="CPU" used={cm.cpu_nano} limit={cpuLimit} formatFn={formatCpu} />
                  <UsageBar label="Memory" used={cm.memory_bytes} limit={memLimit} formatFn={formatMemory} />
                </div>
              );
            })()}

            {metrics !== null && !metrics.available && (
              <div className="mb-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded p-2">
                Metrics unavailable — metrics-server may not be installed
              </div>
            )}

            {/* Env Vars */}
            {c.env.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-[var(--text-secondary)] mb-1">Environment Variables ({c.env.length}):</div>
                <div className="space-y-0.5">
                  {c.env.map((e, i) => (
                    <div key={i} className="text-xs font-mono flex items-center gap-1">
                      <span className="text-[var(--text-primary)]">{e.name}</span>
                      <span className="text-[var(--text-secondary)]">=</span>
                      {e.valueFrom ? (
                        <Badge variant={e.valueFrom.startsWith("secret:") ? "warning" : "default"}>
                          {e.valueFrom.startsWith("secret:") && <span className="mr-1">S</span>}
                          {e.valueFrom}
                        </Badge>
                      ) : (
                        <span className="text-[var(--text-secondary)] truncate max-w-xs">{e.value || '""'}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Volume Mounts */}
            {c.volumeMounts.length > 0 && (
              <div>
                <div className="text-xs text-[var(--text-secondary)] mb-1">Volume Mounts:</div>
                <div className="space-y-0.5">
                  {c.volumeMounts.map((vm, i) => (
                    <div key={i} className="text-xs font-mono">
                      <span className="text-[var(--text-primary)]">{vm.mountPath}</span>
                      <span className="text-[var(--text-secondary)]"> ({vm.name}{vm.readOnly ? ", ro" : ""})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </Section>

      {/* Volumes */}
      {data.volumes.length > 0 && (
        <Section title="Volumes">
          <div className="space-y-1">
            {data.volumes.map((v, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span>{v.name}</span>
                <Badge>{v.type}</Badge>
                {v.source && <span className="text-xs text-[var(--text-secondary)]">{v.source}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
