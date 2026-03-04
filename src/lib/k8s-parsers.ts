// Pure functions for parsing K8s raw API objects

export interface ContainerInfo {
  name: string;
  image: string;
  ports: { name?: string; containerPort: number; protocol?: string }[];
  env: { name: string; value?: string; valueFrom?: string }[];
  resources: { requests?: Record<string, string>; limits?: Record<string, string> };
  volumeMounts: { name: string; mountPath: string; readOnly?: boolean }[];
}

export interface DeploymentOverviewData {
  strategy: string;
  replicas: { desired: number; ready: number; updated: number; available: number };
  conditions: { type: string; status: string; reason?: string; message?: string; lastTransitionTime?: string }[];
  containers: ContainerInfo[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  selector: Record<string, string>;
  namespace: string;
  creationTimestamp: string;
}

export interface PodOverviewData {
  phase: string;
  podIP: string;
  hostIP: string;
  nodeName: string;
  conditions: { type: string; status: string; reason?: string }[];
  containers: (ContainerInfo & { ready: boolean; restartCount: number; state: string })[];
  volumes: { name: string; type: string; source?: string }[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  namespace: string;
  creationTimestamp: string;
  serviceAccount: string;
}

function parseContainer(c: any): ContainerInfo {
  return {
    name: c.name || "",
    image: c.image || "",
    ports: (c.ports || []).map((p: any) => ({
      name: p.name,
      containerPort: p.containerPort,
      protocol: p.protocol,
    })),
    env: (c.env || []).map((e: any) => ({
      name: e.name,
      value: e.value,
      valueFrom: e.valueFrom
        ? e.valueFrom.secretKeyRef ? `secret:${e.valueFrom.secretKeyRef.name}`
        : e.valueFrom.configMapKeyRef ? `configmap:${e.valueFrom.configMapKeyRef.name}`
        : e.valueFrom.fieldRef ? `field:${e.valueFrom.fieldRef.fieldPath}`
        : "ref"
        : undefined,
    })),
    resources: {
      requests: c.resources?.requests,
      limits: c.resources?.limits,
    },
    volumeMounts: (c.volumeMounts || []).map((vm: any) => ({
      name: vm.name,
      mountPath: vm.mountPath,
      readOnly: vm.readOnly,
    })),
  };
}

export function parseDeploymentOverview(raw: any): DeploymentOverviewData {
  const spec = raw.spec || {};
  const status = raw.status || {};
  const meta = raw.metadata || {};

  return {
    strategy: spec.strategy?.type || "RollingUpdate",
    replicas: {
      desired: spec.replicas ?? 0,
      ready: status.readyReplicas ?? 0,
      updated: status.updatedReplicas ?? 0,
      available: status.availableReplicas ?? 0,
    },
    conditions: (status.conditions || []).map((c: any) => ({
      type: c.type,
      status: c.status,
      reason: c.reason,
      message: c.message,
      lastTransitionTime: c.lastTransitionTime,
    })),
    containers: (spec.template?.spec?.containers || []).map(parseContainer),
    labels: meta.labels || {},
    annotations: meta.annotations || {},
    selector: spec.selector?.matchLabels || {},
    namespace: meta.namespace || "",
    creationTimestamp: meta.creationTimestamp || "",
  };
}

export function parsePodOverview(raw: any): PodOverviewData {
  const spec = raw.spec || {};
  const status = raw.status || {};
  const meta = raw.metadata || {};
  const containerStatuses = status.containerStatuses || [];

  return {
    phase: status.phase || "Unknown",
    podIP: status.podIP || "",
    hostIP: status.hostIP || "",
    nodeName: spec.nodeName || "",
    conditions: (status.conditions || []).map((c: any) => ({
      type: c.type,
      status: c.status,
      reason: c.reason,
    })),
    containers: (spec.containers || []).map((c: any) => {
      const cs = containerStatuses.find((s: any) => s.name === c.name);
      const stateKey = cs?.state ? Object.keys(cs.state)[0] : "unknown";
      return {
        ...parseContainer(c),
        ready: cs?.ready ?? false,
        restartCount: cs?.restartCount ?? 0,
        state: stateKey,
      };
    }),
    volumes: (spec.volumes || []).map((v: any) => {
      const keys = Object.keys(v).filter((k) => k !== "name");
      const type = keys[0] || "unknown";
      let source: string | undefined;
      if (type === "configMap") source = v.configMap?.name;
      else if (type === "secret") source = v.secret?.secretName;
      else if (type === "persistentVolumeClaim") source = v.persistentVolumeClaim?.claimName;
      else if (type === "hostPath") source = v.hostPath?.path;
      return { name: v.name, type, source };
    }),
    labels: meta.labels || {},
    annotations: meta.annotations || {},
    namespace: meta.namespace || "",
    creationTimestamp: meta.creationTimestamp || "",
    serviceAccount: spec.serviceAccountName || spec.serviceAccount || "",
  };
}

// Secret overview

export interface SecretOverviewData {
  type: string;
  data: Record<string, string>; // base64-encoded values
  labels: Record<string, string>;
  annotations: Record<string, string>;
  namespace: string;
  creationTimestamp: string;
}

export function parseSecretOverview(raw: any): SecretOverviewData {
  const meta = raw.metadata || {};
  return {
    type: raw.type || "Opaque",
    data: raw.data || {},
    labels: meta.labels || {},
    annotations: meta.annotations || {},
    namespace: meta.namespace || "",
    creationTimestamp: meta.creationTimestamp || "",
  };
}

// PVC overview

export interface PVCOverviewData {
  phase: string;
  storageClass: string;
  accessModes: string[];
  requestedStorage: string;
  provisionedStorage: string;
  volumeName: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  namespace: string;
  creationTimestamp: string;
}

export function parsePVCOverview(raw: any): PVCOverviewData {
  const spec = raw.spec || {};
  const status = raw.status || {};
  const meta = raw.metadata || {};
  return {
    phase: status.phase || "Unknown",
    storageClass: spec.storageClassName || "",
    accessModes: spec.accessModes || [],
    requestedStorage: spec.resources?.requests?.storage || "",
    provisionedStorage: status.capacity?.storage || "",
    volumeName: spec.volumeName || "",
    labels: meta.labels || {},
    annotations: meta.annotations || {},
    namespace: meta.namespace || "",
    creationTimestamp: meta.creationTimestamp || "",
  };
}

export interface PVCTableRow {
  name: string;
  namespace: string;
  status: string;
  storageClass: string;
  capacity: string;
  accessModes: string;
  volume: string;
  age: string;
}

export function getPVCTableData(raw: any): Partial<PVCTableRow> {
  const spec = raw.spec || {};
  const status = raw.status || {};
  return {
    status: status.phase || "Unknown",
    storageClass: spec.storageClassName || "",
    capacity: spec.resources?.requests?.storage || "",
    accessModes: (spec.accessModes || []).join(", "),
    volume: spec.volumeName || "",
  };
}

// Table data helpers

export interface DeploymentTableRow {
  name: string;
  namespace: string;
  ready: string;
  desired: number;
  upToDate: number;
  available: number;
  age: string;
}

export function getDeploymentTableData(raw: any): Partial<DeploymentTableRow> {
  const status = raw.status || {};
  const spec = raw.spec || {};
  return {
    ready: `${status.readyReplicas ?? 0}/${spec.replicas ?? 0}`,
    desired: spec.replicas ?? 0,
    upToDate: status.updatedReplicas ?? 0,
    available: status.availableReplicas ?? 0,
  };
}

export interface PodTableRow {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  node: string;
  ip: string;
  age: string;
}

export function getPodTableData(raw: any): Partial<PodTableRow> {
  const status = raw.status || {};
  const spec = raw.spec || {};
  const containerStatuses = status.containerStatuses || [];
  const readyCount = containerStatuses.filter((c: any) => c.ready).length;
  const totalCount = containerStatuses.length || (spec.containers || []).length;
  const restarts = containerStatuses.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0);
  return {
    status: status.phase || "Unknown",
    ready: `${readyCount}/${totalCount}`,
    restarts,
    node: spec.nodeName || "",
    ip: status.podIP || "",
  };
}

export interface ServiceTableRow {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: string;
  age: string;
}

export function getServiceTableData(raw: any): Partial<ServiceTableRow> {
  const spec = raw.spec || {};
  const ports = (spec.ports || [])
    .map((p: any) => `${p.port}${p.targetPort ? ":" + p.targetPort : ""}/${p.protocol || "TCP"}`)
    .join(", ");
  return {
    type: spec.type_ || spec.type || "ClusterIP",
    clusterIP: spec.clusterIP || "",
    ports,
  };
}
