import { PanelRight, Plus, Search, WandSparkles } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Chip,
  Combobox,
  Dialog,
  EmptyState,
  FloatingPill,
  IconButton,
  Kbd,
  Menu,
  Popover,
  ResizeHandle,
  Segmented,
  Skeleton,
  Tabs,
  Toast
} from "../ui/index.js";
import "./component-gallery.css";

type GalleryTheme = "dark" | "light" | "contrast";

const modelOptions = [
  { value: "first", label: "First model", description: "Available for chat" },
  { value: "second", label: "Second model", description: "A second catalog example" },
  { value: "unavailable", label: "Unavailable model", disabled: true }
] as const;

export default function ComponentGallery() {
  const [theme, setTheme] = useState<GalleryTheme>("dark");
  const [mode, setMode] = useState("design");
  const [model, setModel] = useState<string | null>("first");
  const [chipVisible, setChipVisible] = useState(true);
  const [chipPressed, setChipPressed] = useState(true);
  const [menuChecked, setMenuChecked] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [panelSize, setPanelSize] = useState(280);

  return (
    <Toast.Provider swipeDirection="right">
      <main className="studio-app component-gallery" data-theme={theme}>
        <header className="component-gallery__header">
          <div>
            <p className="component-gallery__eyebrow">Development gallery</p>
            <h1>Studio controls</h1>
            <p>Check the same components in every theme with a keyboard or pointer.</p>
          </div>
          <div className="component-gallery__theme" role="group" aria-label="Gallery theme">
            {(["dark", "light", "contrast"] as const).map((option) => (
              <Button
                key={option}
                variant={theme === option ? "primary" : "secondary"}
                aria-pressed={theme === option}
                onClick={() => setTheme(option)}
              >
                {option === "dark" ? "Dark" : option === "light" ? "Light" : "High contrast"}
              </Button>
            ))}
          </div>
        </header>

        <div className="component-gallery__grid">
          <section className="component-gallery__section" aria-labelledby="gallery-actions">
            <h2 id="gallery-actions">Actions and status</h2>
            <div className="component-gallery__row">
              <Button variant="primary">Primary action</Button>
              <Button>Secondary action</Button>
              <Button variant="ghost">Quiet action</Button>
              <Button variant="danger">Remove</Button>
            </div>
            <div className="component-gallery__row">
              <IconButton icon={<Plus size={16} />} label="Add context" shortcut="Ctrl K" />
              <IconButton icon={<Search size={16} />} label="Search" shortcut="/" variant="ghost" />
              <FloatingPill>
                <span>Untitled</span>
                <span className="component-gallery__subtle">Saved locally</span>
              </FloatingPill>
              <Kbd>Ctrl K</Kbd>
            </div>
            <div className="component-gallery__row">
              {chipVisible && (
                <Chip
                  label="Canvas context"
                  pressed={chipPressed}
                  onClick={() => setChipPressed((value) => !value)}
                  onRemove={() => setChipVisible(false)}
                />
              )}
              <Button size="compact" onClick={() => setChipVisible(true)}>
                Restore chip
              </Button>
            </div>
          </section>

          <section className="component-gallery__section" aria-labelledby="gallery-selection">
            <h2 id="gallery-selection">Selection controls</h2>
            <Tabs.Root defaultValue="agent">
              <Tabs.List aria-label="Studio panels">
                <Tabs.Trigger value="agent">Agent</Tabs.Trigger>
                <Tabs.Trigger value="layers">Layers</Tabs.Trigger>
                <Tabs.Trigger value="pages">Pages</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="agent">Agent panel content</Tabs.Content>
              <Tabs.Content value="layers">Layers panel content</Tabs.Content>
              <Tabs.Content value="pages">Pages panel content</Tabs.Content>
            </Tabs.Root>
            <Segmented
              label="Creation mode"
              value={mode}
              onValueChange={setMode}
              options={[
                { value: "design", label: "Design" },
                { value: "vector", label: "Vector asset" },
                { value: "image", label: "Image" }
              ]}
            />
            <Combobox label="Model" value={model} onValueChange={setModel} options={modelOptions} />
          </section>

          <section className="component-gallery__section" aria-labelledby="gallery-overlays">
            <h2 id="gallery-overlays">Menus and overlays</h2>
            <div className="component-gallery__row">
              <Menu.Root>
                <Menu.Trigger asChild>
                  <Button>Open menu</Button>
                </Menu.Trigger>
                <Menu.Content align="start">
                  <Menu.Label>Add to canvas</Menu.Label>
                  <Menu.Item onSelect={() => setToastOpen(true)}>New frame</Menu.Item>
                  <Menu.Item>Image or SVG</Menu.Item>
                  <Menu.Separator />
                  <Menu.CheckboxItem checked={menuChecked} onCheckedChange={(value) => setMenuChecked(value === true)}>
                    Show grid
                  </Menu.CheckboxItem>
                </Menu.Content>
              </Menu.Root>
              <Popover.Root>
                <Popover.Trigger asChild>
                  <Button>Open popover</Button>
                </Popover.Trigger>
                <Popover.Content align="start">
                  <p className="component-gallery__popover-copy">This panel follows its trigger and closes with Escape.</p>
                  <Popover.Close asChild>
                    <Button size="compact">Done</Button>
                  </Popover.Close>
                </Popover.Content>
              </Popover.Root>
              <Dialog.Root>
                <Dialog.Trigger asChild>
                  <Button>Open dialog</Button>
                </Dialog.Trigger>
                <Dialog.Content>
                  <Dialog.Title>Export current frame</Dialog.Title>
                  <Dialog.Description>Choose an output format before creating a local file.</Dialog.Description>
                  <Dialog.Close asChild>
                    <Button>Close</Button>
                  </Dialog.Close>
                </Dialog.Content>
              </Dialog.Root>
            </div>
            <Button onClick={() => setToastOpen(true)}>Show toast</Button>
            <Toast.Root open={toastOpen} onOpenChange={setToastOpen} duration={3500}>
              <Toast.Title>Toast example</Toast.Title>
              <Toast.Description>This sample does not save a project or send a message.</Toast.Description>
              <Toast.Close aria-label="Dismiss notification">Dismiss</Toast.Close>
            </Toast.Root>
          </section>

          <section className="component-gallery__section" aria-labelledby="gallery-feedback">
            <h2 id="gallery-feedback">Feedback and layout</h2>
            <EmptyState
              icon={<WandSparkles size={20} />}
              title="Nothing selected"
              description="Choose a frame on the canvas to inspect it."
              action={<Button size="compact">Create a frame</Button>}
            />
            <div className="component-gallery__row" aria-label="Loading examples">
              <Skeleton width={110} height={12} />
              <Skeleton width={60} height={12} />
              <Skeleton width={34} height={34} radius="pill" />
            </div>
            <div className="component-gallery__resize-demo">
              <div id="gallery-panel" style={{ width: panelSize }}>
                <PanelRight size={16} aria-hidden="true" /> Panel width: {panelSize}px
              </div>
              <ResizeHandle
                label="Resize demo panel"
                controls="gallery-panel"
                value={panelSize}
                min={200}
                max={360}
                onResize={setPanelSize}
              />
            </div>
          </section>
        </div>
        <Toast.Viewport />
      </main>
    </Toast.Provider>
  );
}
