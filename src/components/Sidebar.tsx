import { useEffect } from "react";
import {
  Layers, Box, Globe, Shield,
  FileText, AlertTriangle, HardDrive, Network
} from "lucide-react";
import { useAppStore, ResourceKind } from "../stores/appStore";
import { api } from "../lib/tauri";

const RESOURCE_ITEMS: { kind: ResourceKind; label: string; icon: React.ReactNode }[] = [
  { kind: "pods", label: "Pods", icon: <Box size={16} /> },
  { kind: "deployments", label: "Deployments", icon: <Layers size={16} /> },
  { kind: "services", label: "Services", icon: <Globe size={16} /> },
  { kind: "configmaps", label: "ConfigMaps", icon: <FileText size={16} /> },
  { kind: "secrets", label: "Secrets", icon: <Shield size={16} /> },
  { kind: "ingresses", label: "Ingresses", icon: <Network size={16} /> },
  { kind: "pvcs", label: "PVCs", icon: <HardDrive size={16} /> },
  { kind: "events", label: "Events", icon: <AlertTriangle size={16} /> },
];

export function Sidebar() {
  const {
    contexts, activeContext, namespaces, activeNamespace, activeKind,
    setContexts, setActiveContext, setNamespaces, setActiveNamespace,
    setActiveKind, setResources, setLoading, setError,
  } = useAppStore();

  useEffect(() => {
    api.listContexts().then((ctxs) => {
      setContexts(ctxs);
      const active = ctxs.find((c) => c.is_active);
      if (active) setActiveContext(active.name);
    }).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!activeContext) return;
    api.listNamespaces(activeContext).then(setNamespaces).catch(() => setNamespaces(["default"]));
  }, [activeContext]);

  useEffect(() => {
    if (!activeContext) return;
    setLoading(true);
    api.listResources(activeContext, activeKind, activeNamespace)
      .then((r) => { setResources(r); setError(null); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [activeContext, activeNamespace, activeKind]);

  return (
    <div className="w-56 h-full bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col overflow-y-auto">
      {/* Cluster selector */}
      <div className="p-3 border-b border-[var(--border)]">
        <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Cluster</label>
        <select
          className="w-full mt-1 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm rounded px-2 py-1.5 border border-[var(--border)] outline-none"
          value={activeContext || ""}
          onChange={(e) => setActiveContext(e.target.value)}
        >
          {contexts.map((ctx) => (
            <option key={ctx.name} value={ctx.name}>{ctx.name}</option>
          ))}
        </select>
      </div>

      {/* Namespace selector */}
      <div className="p-3 border-b border-[var(--border)]">
        <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Namespace</label>
        <select
          className="w-full mt-1 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm rounded px-2 py-1.5 border border-[var(--border)] outline-none"
          value={activeNamespace}
          onChange={(e) => setActiveNamespace(e.target.value)}
        >
          <option value="_all">All Namespaces</option>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
        </select>
      </div>

      {/* Resource list */}
      <div className="p-2 flex-1">
        <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wider px-1">Resources</label>
        <div className="mt-1 space-y-0.5">
          {RESOURCE_ITEMS.map((item) => (
            <button
              key={item.kind}
              onClick={() => setActiveKind(item.kind)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                activeKind === item.kind
                  ? "bg-[color:rgba(56,189,248,0.15)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
