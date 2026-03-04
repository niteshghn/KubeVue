import { useEffect, useState, useMemo, useRef } from "react";
import { ArrowLeft, FileText, ScrollText, AlertTriangle, Eye, EyeOff, Copy, RefreshCw, Trash2 } from "lucide-react";
import { stringify as yamlStringify } from "yaml";
import CodeMirror from "@uiw/react-codemirror";
import { yaml as yamlLang } from "@codemirror/lang-yaml";
import { EditorView } from "@codemirror/view";
import { useAppStore } from "../../stores/appStore";
import { api, events } from "../../lib/tauri";
import { DeploymentOverview } from "./DeploymentOverview";
import { PodOverview } from "./PodOverview";
import { SecretOverview } from "./SecretOverview";
import { PVCOverview } from "./PVCOverview";
import { EventsTab } from "./EventsTab";
import { GenericOverview } from "./GenericOverview";


function LogLine({ line }: { line: string }) {
  const parsed = useMemo(() => {
    try {
      const obj = JSON.parse(line);
      if (typeof obj === "object" && obj !== null) return obj;
    } catch { /* not JSON */ }
    return null;
  }, [line]);

  if (!parsed) {
    return <div className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-0.5">{line}</div>;
  }

  // Extract common log fields for a nice header
  const level = parsed.level || parsed.severity || parsed.lvl || "";
  const message = parsed.message || parsed.msg || parsed.text || "";
  const timestamp = parsed.timestamp || parsed.ts || parsed.time || "";

  const levelColor = (() => {
    const l = String(level).toLowerCase();
    if (l === "error" || l === "fatal" || l === "critical") return "text-[var(--error)]";
    if (l === "warn" || l === "warning") return "text-[var(--warning)]";
    if (l === "info") return "text-[var(--accent)]";
    if (l === "debug" || l === "trace") return "text-[var(--text-secondary)]";
    return "text-[var(--text-secondary)]";
  })();

  const otherKeys = Object.entries(parsed).filter(
    ([k]) => !["level", "severity", "lvl", "message", "msg", "text", "timestamp", "ts", "time"].includes(k)
  );

  return (
    <div className="py-1 border-b border-[var(--border)] hover:bg-[var(--bg-secondary)]">
      <div className="flex items-baseline gap-2">
        {timestamp && <span className="text-[color:rgba(148,163,184,0.6)] shrink-0">{String(timestamp).replace(/T/, " ").replace(/Z$/, "")}</span>}
        {level && <span className={`font-semibold uppercase shrink-0 ${levelColor}`}>{String(level).slice(0, 5).padEnd(5)}</span>}
        {message && <span className="text-[var(--text-primary)]">{String(message)}</span>}
      </div>
      {otherKeys.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 pl-2">
          {otherKeys.map(([k, v]) => (
            <span key={k}>
              <span className="text-[var(--accent)]">{k}</span>
              <span className="text-[var(--text-secondary)]">=</span>
              <span className="text-[color:rgba(251,191,36,0.8)]">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function cleanK8sObject(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  const cleaned = { ...obj };
  // Remove managedFields (verbose server-side apply noise)
  if (cleaned.metadata) {
    cleaned.metadata = { ...cleaned.metadata };
    delete cleaned.metadata.managedFields;
  }
  return cleaned;
}

export function ResourceDetail() {
  const { selectedResource, activeContext, detailTab, setDetailTab, exitDetailMode, setSelectedResource } = useAppStore();
  const [logs, setLogs] = useState<string[]>([]);
  const [showSecrets, setShowSecrets] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom when new lines arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Generate YAML directly from raw — instant, no API call needed
  const yamlContent = useMemo(() => {
    if (!selectedResource?.raw) return "";
    try {
      const cleaned = cleanK8sObject(selectedResource.raw);
      // Redact secret data values unless showSecrets is toggled on
      if (selectedResource.kind === "Secret" && !showSecrets && cleaned.data) {
        const redacted = { ...cleaned, data: { ...cleaned.data } };
        for (const key of Object.keys(redacted.data)) {
          redacted.data[key] = "••••••••";
        }
        return yamlStringify(redacted, { lineWidth: 120 });
      }
      return yamlStringify(cleaned, { lineWidth: 120 });
    } catch {
      return JSON.stringify(selectedResource.raw, null, 2);
    }
  }, [selectedResource, showSecrets]);

  useEffect(() => {
    if (!selectedResource || detailTab !== "logs" || selectedResource.kind !== "Pod" || !activeContext) return;
    setLogs([]);
    const ns = selectedResource.namespace || "default";
    api.streamLogs(activeContext, selectedResource.name, null, ns, true, 100);
    const unlisten = events.onLogLine((data) => {
      if (data.pod === selectedResource.name) {
        setLogs((prev) => [...prev.slice(-9999), data.line]);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [selectedResource, detailTab, activeContext]);

  if (!selectedResource) return null;

  const handleCopyYaml = async () => {
    if (yamlContent) {
      await navigator.clipboard.writeText(yamlContent);
    }
  };

  const handleRestart = () => {
    if (activeContext && selectedResource.namespace) {
      api.restartDeployment(activeContext, selectedResource.name, selectedResource.namespace);
    }
  };

  const handleDelete = () => {
    if (activeContext && selectedResource.namespace) {
      const kind = selectedResource.kind.toLowerCase() + "s";
      api.deleteResource(activeContext, kind, selectedResource.name, selectedResource.namespace || "default");
      setSelectedResource(null);
      exitDetailMode();
    }
  };

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: <Eye size={14} /> },
    { id: "yaml" as const, label: "YAML", icon: <FileText size={14} /> },
    ...(selectedResource.kind === "Pod" ? [{ id: "logs" as const, label: "Logs", icon: <ScrollText size={14} /> }] : []),
    { id: "events" as const, label: "Events", icon: <AlertTriangle size={14} /> },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-secondary)] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={exitDetailMode}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="text-sm font-medium">{selectedResource.name}</div>
            <div className="text-xs text-[var(--text-secondary)]">{selectedResource.kind} &middot; {selectedResource.namespace}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyYaml}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--bg-tertiary)] rounded hover:bg-[var(--border)] transition-colors"
          >
            <Copy size={12} /> Copy YAML
          </button>
          {selectedResource.kind === "Deployment" && (
            <button
              onClick={handleRestart}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--bg-tertiary)] rounded hover:bg-[var(--border)] transition-colors"
            >
              <RefreshCw size={12} /> Restart
            </button>
          )}
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--error)] bg-[var(--bg-tertiary)] rounded hover:bg-[var(--border)] transition-colors"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setDetailTab(tab.id)}
            className={`flex items-center gap-1 px-4 py-2 text-xs transition-colors ${
              detailTab === tab.id
                ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {detailTab === "overview" && (
          selectedResource.kind === "Deployment"
            ? <DeploymentOverview resource={selectedResource} />
            : selectedResource.kind === "Pod"
            ? <PodOverview resource={selectedResource} />
            : selectedResource.kind === "Secret"
            ? <SecretOverview resource={selectedResource} />
            : selectedResource.kind === "PVC"
            ? <PVCOverview resource={selectedResource} />
            : <GenericOverview resource={selectedResource} />
        )}

        {detailTab === "yaml" && (
          <div className="flex flex-col h-full">
            {selectedResource.kind === "Secret" && (
              <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex items-center gap-2">
                <button
                  onClick={() => setShowSecrets(!showSecrets)}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--bg-tertiary)] rounded hover:bg-[var(--border)] transition-colors"
                >
                  {showSecrets ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showSecrets ? "Hide Secrets" : "Show Secrets"}
                </button>
              </div>
            )}
            <CodeMirror
              value={yamlContent}
              extensions={[yamlLang(), EditorView.lineWrapping]}
              editable={false}
              basicSetup={{ foldGutter: true, lineNumbers: true, highlightActiveLine: false }}
              theme="dark"
              style={{ fontSize: "12px" }}
            />
          </div>
        )}

        {detailTab === "logs" && (
          <div className="p-4">
            {selectedResource.kind === "Pod" ? (
              <div className="text-xs font-mono">
                {logs.length === 0 && <span className="text-[var(--text-secondary)]">Waiting for logs...</span>}
                {logs.map((line, i) => (
                  <LogLine key={i} line={line} />
                ))}
                <div ref={logsEndRef} />
              </div>
            ) : (
              <div className="text-sm text-[var(--text-secondary)]">Logs only available for Pods</div>
            )}
          </div>
        )}

        {detailTab === "events" && (
          <EventsTab resource={selectedResource} />
        )}
      </div>
    </div>
  );
}
