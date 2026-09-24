import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Image,
  Layers3,
  type LucideIcon,
  Paintbrush,
  PanelsTopLeft
} from "lucide-react";
import { type CSSProperties, type KeyboardEvent, useEffect, useState } from "react";
import type { Editor } from "tldraw";
import { AgentHarnessSidebar, type AgentHarnessSidebarProps } from "./AgentHarnessSidebar.js";
import { LeftPanelTabBody } from "./LeftPanelTabs.js";
import { LEFT_PANEL_TABS, type LeftPanelTab, readLeftPanelTab, writeLeftPanelTab } from "./leftPanelTab.js";

export type StudioLeftPanelTab = LeftPanelTab;

const tabDetails = {
  agent: { label: "Agent", icon: Bot, description: "Choose a model and design with the agent." },
  layers: {
    label: "Layers",
    icon: Layers3,
    description: "Select, rename, reorder, hide, and lock canvas layers."
  },
  pages: {
    label: "Pages",
    icon: PanelsTopLeft,
    description: "Add, switch, rename, reorder, and delete pages. Scratchpad stays pinned first."
  },
  assets: {
    label: "Assets",
    icon: Image,
    description: "Browse images, SVGs, and avatars. Click or drag one onto the canvas."
  },
  styles: {
    label: "Styles",
    icon: Paintbrush,
    description: "View colors used on this page. Saved style libraries are not available yet."
  }
} satisfies Record<LeftPanelTab, { label: string; icon: LucideIcon; description: string }>;

const tabs = LEFT_PANEL_TABS.map((id) => ({ id, ...tabDetails[id] }));

interface StudioLeftPanelProps extends Omit<AgentHarnessSidebarProps, "className" | "isOpen"> {
  panelCollapsed: boolean;
  onPanelCollapsedChange: (collapsed: boolean) => void;
  editor: Editor | null;
  onOpenPage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
}

export function StudioLeftPanel({
  panelCollapsed,
  onPanelCollapsedChange,
  editor,
  onOpenPage,
  onDeletePage,
  ...agentProps
}: StudioLeftPanelProps) {
  const [activeTab, setActiveTab] = useState<StudioLeftPanelTab>(readLeftPanelTab);

  useEffect(() => {
    writeLeftPanelTab(activeTab);
  }, [activeTab]);

  const selectTab = (tab: StudioLeftPanelTab) => {
    setActiveTab(tab);
    if (panelCollapsed) onPanelCollapsedChange(false);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    const nextIndex =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? (currentIndex + 1) % tabs.length
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    if (nextTab) selectTab(nextTab.id);
    document.getElementById(`studio-left-tab-${nextTab?.id}`)?.focus();
  };

  const dimensions = {
    "--studio-panel-width": panelCollapsed ? "56px" : `${agentProps.panelWidth}px`,
    "--studio-mobile-panel-size": panelCollapsed ? "56px" : `${agentProps.panelHeight}px`
  } as CSSProperties;

  const activeDescription = tabs.find((tab) => tab.id === activeTab)?.description;

  return (
    <aside
      id="studio-agent-sidebar"
      className={`studio-agent-sidebar studio-left-panel${panelCollapsed ? " studio-left-panel--collapsed" : ""}`}
      aria-label="Canvas panels"
      style={dimensions}
    >
      <nav className="studio-left-panel__rail" aria-label="Canvas panels">
        <div className="studio-left-panel__tabs" role="tablist" aria-label="Canvas panels" aria-orientation="vertical">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`studio-left-tab-${id}`}
              className="studio-left-panel__tab"
              type="button"
              role="tab"
              aria-label={label}
              aria-selected={activeTab === id}
              aria-controls={`studio-left-panel-${id}`}
              title={label}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => selectTab(id)}
              onKeyDown={handleTabKeyDown}
            >
              <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
              <span className="studio-left-panel__tab-label">{label}</span>
            </button>
          ))}
        </div>
        <button
          className="studio-left-panel__collapse"
          type="button"
          aria-label={panelCollapsed ? "Expand left panel" : "Collapse left panel"}
          aria-pressed={panelCollapsed}
          title={panelCollapsed ? "Expand panel" : "Collapse panel"}
          onClick={() => onPanelCollapsedChange(!panelCollapsed)}
        >
          {panelCollapsed ? (
            <ChevronRight size={17} aria-hidden="true" />
          ) : (
            <ChevronLeft size={17} aria-hidden="true" />
          )}
        </button>
      </nav>
      <div className="studio-left-panel__body" hidden={panelCollapsed}>
        <div
          id="studio-left-panel-agent"
          className="studio-left-panel__agent-panel"
          role="tabpanel"
          aria-labelledby="studio-left-tab-agent"
          hidden={activeTab !== "agent"}
        >
          <AgentHarnessSidebar {...agentProps} editor={editor} className="studio-left-panel__agent" isOpen={true} />
        </div>
        {activeTab !== "agent" && (
          <div id={`studio-left-panel-${activeTab}`} role="tabpanel" aria-labelledby={`studio-left-tab-${activeTab}`}>
            <LeftPanelTabBody tab={activeTab} editor={editor} onOpenPage={onOpenPage} onDeletePage={onDeletePage} />
          </div>
        )}
        <span className="sr-only" aria-live="polite">
          {activeDescription}
        </span>
      </div>
    </aside>
  );
}
