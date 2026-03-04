import { Sidebar } from "./components/Sidebar";
import { ResourceTable } from "./components/ResourceTable";
import { ResourceDetail } from "./components/detail/ResourceDetail";
import { StatusBar } from "./components/StatusBar";
import { CommandPalette } from "./components/CommandPalette";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useAppStore } from "./stores/appStore";

function App() {
  useKeyboardShortcuts();
  const detailMode = useAppStore((s) => s.detailMode);
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <CommandPalette />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        {detailMode ? <ResourceDetail /> : <ResourceTable />}
      </div>
      <StatusBar />
    </div>
  );
}

export default App;
