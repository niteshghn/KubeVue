import { useMemo, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";
import { Search, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { ResourceSummary, PodMetricsResult, api } from "../lib/tauri";
import { useAppStore, ResourceKind } from "../stores/appStore";
import {
  getDeploymentTableData,
  getPodTableData,
  getServiceTableData,
  getPVCTableData,
} from "../lib/k8s-parsers";

const columnHelper = createColumnHelper<ResourceSummary>();

function StatusBadge({ status }: { status: string }) {
  let color = "var(--text-secondary)";
  const lower = status.toLowerCase();
  if (lower === "running" || lower.includes("active") || lower === "bound") color = "var(--success)";
  else if (lower.includes("error") || lower.includes("crash") || lower === "failed") color = "var(--error)";
  else if (lower === "pending" || lower === "terminating") color = "var(--warning)";

  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {status}
    </span>
  );
}

function formatCpuShort(nanos: number): string {
  if (nanos >= 1_000_000_000) return `${(nanos / 1_000_000_000).toFixed(1)}`;
  return `${Math.round(nanos / 1_000_000)}m`;
}

function formatMemShort(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}Gi`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))}Mi`;
  return `${Math.round(bytes / 1024)}Ki`;
}

function getColumnsForKind(kind: ResourceKind, podMetrics?: Record<string, PodMetricsResult>): ColumnDef<ResourceSummary, any>[] {
  switch (kind) {
    case "deployments":
      return [
        columnHelper.accessor("namespace", { header: "Namespace", size: 120, minSize: 60 }),
        columnHelper.accessor("name", { header: "Name", size: 250, minSize: 100 }),
        columnHelper.display({
          id: "ready",
          header: "Ready",
          size: 80,
          minSize: 50,
          cell: (info) => getDeploymentTableData(info.row.original.raw).ready,
          sortingFn: (a, b) => {
            const aVal = a.original.raw?.status?.readyReplicas ?? 0;
            const bVal = b.original.raw?.status?.readyReplicas ?? 0;
            return aVal - bVal;
          },
        }),
        columnHelper.display({
          id: "desired",
          header: "Desired",
          size: 80,
          minSize: 50,
          cell: (info) => getDeploymentTableData(info.row.original.raw).desired,
          sortingFn: (a, b) => {
            const aVal = a.original.raw?.spec?.replicas ?? 0;
            const bVal = b.original.raw?.spec?.replicas ?? 0;
            return aVal - bVal;
          },
        }),
        columnHelper.display({
          id: "upToDate",
          header: "Up-to-date",
          size: 100,
          minSize: 60,
          cell: (info) => getDeploymentTableData(info.row.original.raw).upToDate,
          sortingFn: (a, b) => {
            const aVal = a.original.raw?.status?.updatedReplicas ?? 0;
            const bVal = b.original.raw?.status?.updatedReplicas ?? 0;
            return aVal - bVal;
          },
        }),
        columnHelper.display({
          id: "available",
          header: "Available",
          size: 90,
          minSize: 50,
          cell: (info) => getDeploymentTableData(info.row.original.raw).available,
          sortingFn: (a, b) => {
            const aVal = a.original.raw?.status?.availableReplicas ?? 0;
            const bVal = b.original.raw?.status?.availableReplicas ?? 0;
            return aVal - bVal;
          },
        }),
        columnHelper.accessor("age", { header: "Age", size: 80, minSize: 50 }),
      ];
    case "pods":
      return [
        columnHelper.accessor("namespace", { header: "Namespace", size: 120, minSize: 60 }),
        columnHelper.accessor("name", { header: "Name", size: 220, minSize: 100 }),
        columnHelper.display({
          id: "ready",
          header: "Ready",
          size: 70,
          minSize: 50,
          cell: (info) => getPodTableData(info.row.original.raw).ready,
        }),
        columnHelper.display({
          id: "status",
          header: "Status",
          size: 100,
          minSize: 60,
          cell: (info) => <StatusBadge status={getPodTableData(info.row.original.raw).status || ""} />,
          sortingFn: (a, b) => {
            const aVal = a.original.raw?.status?.phase || "";
            const bVal = b.original.raw?.status?.phase || "";
            return aVal.localeCompare(bVal);
          },
        }),
        columnHelper.display({
          id: "restarts",
          header: "Restarts",
          size: 80,
          minSize: 50,
          cell: (info) => getPodTableData(info.row.original.raw).restarts,
          sortingFn: (a, b) => {
            const aCs = a.original.raw?.status?.containerStatuses || [];
            const bCs = b.original.raw?.status?.containerStatuses || [];
            const aVal = aCs.reduce((s: number, c: any) => s + (c.restartCount || 0), 0);
            const bVal = bCs.reduce((s: number, c: any) => s + (c.restartCount || 0), 0);
            return aVal - bVal;
          },
        }),
        columnHelper.display({
          id: "node",
          header: "Node",
          size: 150,
          minSize: 60,
          cell: (info) => getPodTableData(info.row.original.raw).node,
          sortingFn: (a, b) => {
            const aVal = a.original.raw?.spec?.nodeName || "";
            const bVal = b.original.raw?.spec?.nodeName || "";
            return aVal.localeCompare(bVal);
          },
        }),
        columnHelper.display({
          id: "ip",
          header: "IP",
          size: 120,
          minSize: 60,
          cell: (info) => getPodTableData(info.row.original.raw).ip,
        }),
        columnHelper.display({
          id: "cpu",
          header: "CPU",
          size: 70,
          minSize: 50,
          cell: (info) => {
            const m = podMetrics?.[info.row.original.name];
            if (!m?.available) return <span className="text-[var(--text-secondary)]">—</span>;
            const total = m.containers.reduce((s, c) => s + c.cpu_nano, 0);
            return formatCpuShort(total);
          },
        }),
        columnHelper.display({
          id: "memory",
          header: "Memory",
          size: 80,
          minSize: 50,
          cell: (info) => {
            const m = podMetrics?.[info.row.original.name];
            if (!m?.available) return <span className="text-[var(--text-secondary)]">—</span>;
            const total = m.containers.reduce((s, c) => s + c.memory_bytes, 0);
            return formatMemShort(total);
          },
        }),
        columnHelper.accessor("age", { header: "Age", size: 80, minSize: 50 }),
      ];
    case "services":
      return [
        columnHelper.accessor("namespace", { header: "Namespace", size: 120, minSize: 60 }),
        columnHelper.accessor("name", { header: "Name", size: 250, minSize: 100 }),
        columnHelper.display({
          id: "type",
          header: "Type",
          size: 110,
          minSize: 60,
          cell: (info) => getServiceTableData(info.row.original.raw).type,
          sortingFn: (a, b) => {
            const aVal = a.original.raw?.spec?.type || a.original.raw?.spec?.type_ || "";
            const bVal = b.original.raw?.spec?.type || b.original.raw?.spec?.type_ || "";
            return aVal.localeCompare(bVal);
          },
        }),
        columnHelper.display({
          id: "clusterIP",
          header: "Cluster IP",
          size: 130,
          minSize: 70,
          cell: (info) => getServiceTableData(info.row.original.raw).clusterIP,
        }),
        columnHelper.display({
          id: "ports",
          header: "Ports",
          size: 200,
          minSize: 80,
          cell: (info) => getServiceTableData(info.row.original.raw).ports,
        }),
        columnHelper.accessor("age", { header: "Age", size: 80, minSize: 50 }),
      ];
    case "pvcs":
      return [
        columnHelper.accessor("namespace", { header: "Namespace", size: 120, minSize: 60 }),
        columnHelper.accessor("name", { header: "Name", size: 200, minSize: 100 }),
        columnHelper.display({
          id: "status",
          header: "Status",
          size: 90,
          minSize: 60,
          cell: (info) => <StatusBadge status={getPVCTableData(info.row.original.raw).status || ""} />,
          sortingFn: (a, b) => {
            const aVal = a.original.raw?.status?.phase || "";
            const bVal = b.original.raw?.status?.phase || "";
            return aVal.localeCompare(bVal);
          },
        }),
        columnHelper.display({
          id: "storageClass",
          header: "Storage Class",
          size: 140,
          minSize: 80,
          cell: (info) => getPVCTableData(info.row.original.raw).storageClass,
        }),
        columnHelper.display({
          id: "capacity",
          header: "Capacity",
          size: 90,
          minSize: 60,
          cell: (info) => getPVCTableData(info.row.original.raw).capacity,
        }),
        columnHelper.display({
          id: "accessModes",
          header: "Access Modes",
          size: 140,
          minSize: 80,
          cell: (info) => getPVCTableData(info.row.original.raw).accessModes,
        }),
        columnHelper.display({
          id: "volume",
          header: "Volume",
          size: 200,
          minSize: 80,
          cell: (info) => getPVCTableData(info.row.original.raw).volume,
        }),
        columnHelper.accessor("age", { header: "Age", size: 80, minSize: 50 }),
      ];
    default:
      return [
        columnHelper.accessor("name", { header: "Name", size: 300, minSize: 100 }),
        columnHelper.accessor("namespace", { header: "Namespace", size: 150, minSize: 60 }),
        columnHelper.accessor("status", {
          header: "Status",
          size: 150,
          minSize: 60,
          cell: (info) => <StatusBadge status={info.getValue()} />,
        }),
        columnHelper.accessor("age", { header: "Age", size: 80, minSize: 50 }),
      ];
  }
}

export function ResourceTable() {
  const { resources, isLoading, error, selectedResource, setDetailResource, activeKind, activeContext, activeNamespace } = useAppStore();
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [podMetrics, setPodMetrics] = useState<Record<string, PodMetricsResult>>({});

  // Fetch pod metrics when viewing pods
  useEffect(() => {
    if (activeKind !== "pods" || !activeContext) {
      setPodMetrics({});
      return;
    }
    const fetchMetrics = () => {
      api.getAllPodMetrics(activeContext, activeNamespace)
        .then(setPodMetrics)
        .catch(() => setPodMetrics({}));
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15000);
    return () => clearInterval(interval);
  }, [activeKind, activeContext, activeNamespace]);

  const columns = useMemo(() => getColumnsForKind(activeKind, podMetrics), [activeKind, podMetrics]);

  // Column resizing state
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});

  const table = useReactTable({
    data: resources,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { globalFilter, sorting, columnSizing },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 36,
    overscan: 20,
  });

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--error)]">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Search bar */}
      <div className="p-2 border-b border-[var(--border)] flex items-center gap-2">
        <Search size={16} className="text-[var(--text-secondary)]" />
        <input
          type="text"
          placeholder={`Search ${activeKind}... (/ to focus)`}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="flex-1 bg-transparent text-[var(--text-primary)] text-sm outline-none placeholder:text-[var(--text-secondary)]"
        />
        <span className="text-xs text-[var(--text-secondary)]">{rows.length} items</span>
      </div>

      {/* Table header */}
      <div className="flex border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        {table.getHeaderGroups().map((headerGroup) =>
          headerGroup.headers.map((header) => (
            <div
              key={header.id}
              className="relative px-3 py-2 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider select-none group"
              style={{ width: header.getSize() }}
            >
              <div
                className={`flex items-center gap-1 ${header.column.getCanSort() ? "cursor-pointer hover:text-[var(--text-primary)]" : ""}`}
                onClick={header.column.getToggleSortingHandler()}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {header.column.getCanSort() && (
                  header.column.getIsSorted() === "asc" ? <ArrowUp size={12} /> :
                  header.column.getIsSorted() === "desc" ? <ArrowDown size={12} /> :
                  <ChevronsUpDown size={12} className="opacity-30 group-hover:opacity-70" />
                )}
              </div>
              {/* Resize handle */}
              <div
                onMouseDown={header.getResizeHandler()}
                onTouchStart={header.getResizeHandler()}
                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--accent)] active:bg-[var(--accent)]"
                style={{ userSelect: "none", touchAction: "none" }}
              />
            </div>
          ))
        )}
      </div>

      {/* Virtualized rows */}
      <div ref={tableContainerRef} className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-[var(--text-secondary)]">Loading...</div>
        ) : (
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isSelected = selectedResource?.name === row.original.name;
              return (
                <div
                  key={row.id}
                  className={`absolute w-full flex items-center cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-[color:rgba(56,189,248,0.12)]"
                      : "hover:bg-[var(--bg-secondary)]"
                  }`}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => setDetailResource(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      className="px-3 py-2 text-sm truncate"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
