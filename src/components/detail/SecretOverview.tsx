import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { ResourceSummary } from "../../lib/tauri";
import { parseSecretOverview } from "../../lib/k8s-parsers";

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

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
    </button>
  );
}

function SecretValue({ encodedValue, revealed }: { encodedValue: string; revealed: boolean }) {
  if (!revealed) {
    return <span className="text-[var(--text-secondary)] font-mono">••••••••</span>;
  }
  try {
    const decoded = atob(encodedValue);
    return <span className="text-[var(--text-primary)] font-mono break-all">{decoded}</span>;
  } catch {
    return <span className="text-[var(--warning)] font-mono">(invalid base64)</span>;
  }
}

export function SecretOverview({ resource }: { resource: ResourceSummary }) {
  const data = parseSecretOverview(resource.raw);
  const keys = Object.keys(data.data);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const allRevealed = keys.length > 0 && keys.every((k) => revealedKeys.has(k));

  const toggleKey = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (allRevealed) {
      setRevealedKeys(new Set());
    } else {
      setRevealedKeys(new Set(keys));
    }
  };

  const getDecodedValue = (key: string) => {
    try {
      return atob(data.data[key]);
    } catch {
      return data.data[key];
    }
  };

  return (
    <div className="p-4 space-y-2">
      <Section title="Secret Info">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-[var(--text-secondary)]">Type:</span> <Badge>{data.type}</Badge></div>
          <div><span className="text-[var(--text-secondary)]">Namespace:</span> {data.namespace}</div>
          <div><span className="text-[var(--text-secondary)]">Keys:</span> {keys.length}</div>
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

      <Section
        title={`Data (${keys.length} keys)`}
        action={
          keys.length > 0 && (
            <button
              onClick={toggleAll}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--bg-tertiary)] rounded hover:bg-[var(--border)] transition-colors"
            >
              {allRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
              {allRevealed ? "Hide All" : "Reveal All"}
            </button>
          )
        }
      >
        {keys.length === 0 ? (
          <div className="text-sm text-[var(--text-secondary)]">No data keys</div>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => {
              const isRevealed = revealedKeys.has(key);
              return (
                <div key={key} className="bg-[var(--bg-tertiary)] rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium font-mono">{key}</span>
                    <div className="flex items-center gap-1">
                      <CopyButton value={getDecodedValue(key)} />
                      <button
                        onClick={() => toggleKey(key)}
                        className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="text-xs">
                    <SecretValue encodedValue={data.data[key]} revealed={isRevealed} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
