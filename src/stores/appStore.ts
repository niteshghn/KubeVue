import { create } from "zustand";
import { ClusterContext, ResourceSummary } from "../lib/tauri";

export type ResourceKind = "pods" | "deployments" | "services" | "configmaps" | "secrets" | "ingresses" | "pvcs" | "events";

interface AppState {
  contexts: ClusterContext[];
  activeContext: string | null;
  namespaces: string[];
  activeNamespace: string;
  activeKind: ResourceKind;
  resources: ResourceSummary[];
  isLoading: boolean;
  error: string | null;
  selectedResource: ResourceSummary | null;
  detailMode: boolean;
  detailTab: "overview" | "yaml" | "logs" | "events";

  setContexts: (contexts: ClusterContext[]) => void;
  setActiveContext: (context: string) => void;
  setNamespaces: (namespaces: string[]) => void;
  setActiveNamespace: (namespace: string) => void;
  setActiveKind: (kind: ResourceKind) => void;
  setResources: (resources: ResourceSummary[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedResource: (resource: ResourceSummary | null) => void;
  setDetailResource: (resource: ResourceSummary) => void;
  exitDetailMode: () => void;
  setDetailTab: (tab: "overview" | "yaml" | "logs" | "events") => void;
}

export const useAppStore = create<AppState>((set) => ({
  contexts: [],
  activeContext: null,
  namespaces: [],
  activeNamespace: "default",
  activeKind: "pods",
  resources: [],
  isLoading: false,
  error: null,
  selectedResource: null,
  detailMode: false,
  detailTab: "overview",

  setContexts: (contexts) => set({ contexts }),
  setActiveContext: (activeContext) => set({ activeContext }),
  setNamespaces: (namespaces) => set({ namespaces }),
  setActiveNamespace: (activeNamespace) => set({ activeNamespace }),
  setActiveKind: (activeKind) => set({ activeKind, selectedResource: null, detailMode: false }),
  setResources: (resources) => set({ resources }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSelectedResource: (selectedResource) => set({ selectedResource }),
  setDetailResource: (resource) => set({ selectedResource: resource, detailMode: true, detailTab: "overview" }),
  exitDetailMode: () => set({ detailMode: false }),
  setDetailTab: (detailTab) => set({ detailTab }),
}));
