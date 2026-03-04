import { useEffect } from "react";
import { useAppStore } from "../stores/appStore";

export function useKeyboardShortcuts() {
  const { resources, selectedResource, setSelectedResource, detailMode, exitDetailMode, setDetailResource } = useAppStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      if (e.key === "Escape") {
        if (detailMode) {
          exitDetailMode();
        } else {
          setSelectedResource(null);
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      // Enter opens detail view for selected resource
      if (e.key === "Enter" && !detailMode && selectedResource) {
        e.preventDefault();
        setDetailResource(selectedResource);
        return;
      }

      // j/k navigation only in list mode
      if (detailMode) return;

      const currentIndex = selectedResource
        ? resources.findIndex((r) => r.name === selectedResource.name)
        : -1;

      switch (e.key) {
        case "j":
          e.preventDefault();
          if (currentIndex < resources.length - 1) {
            setSelectedResource(resources[currentIndex + 1]);
          }
          break;
        case "k":
          e.preventDefault();
          if (currentIndex > 0) {
            setSelectedResource(resources[currentIndex - 1]);
          }
          break;
        case "/":
          e.preventDefault();
          document.querySelector<HTMLInputElement>("input[type=text]")?.focus();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [resources, selectedResource, detailMode]);
}
