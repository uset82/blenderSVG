import React, { useState, useRef } from 'react'
import { Tldraw, Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import './styles/studio.css'

import { AvatarShapeUtil } from './shapes/AvatarCanvasShape.js'
import { VectorStudioShapeUtil } from './shapes/VectorStudioCanvasShape.js'
import { BlenderConnectorShapeUtil } from './shapes/BlenderConnectorCanvasShape.js'

import { StudioWindowBar } from './components/StudioWindowBar.js'
import { StudioToolbar } from './components/StudioToolbar.js'
import { AgentHarnessSidebar } from './components/AgentHarnessSidebar.js'
import { StudioInspector } from './components/StudioInspector.js'
import { RecentsDashboard } from './components/RecentsDashboard.js'

const customShapeUtils = [AvatarShapeUtil, VectorStudioShapeUtil, BlenderConnectorShapeUtil]

export function App() {
  const editorRef = useRef<Editor | null>(null)
  const [projectTitle, setProjectTitle] = useState('Untitled')
  const [activeMode, setActiveMode] = useState<'design' | 'agents' | 'blender'>('design')
  const [activeTool, setActiveTool] = useState('select')
  const [isRecentsOpen, setIsRecentsOpen] = useState(false)
  const [isAgentSidebarOpen, setIsAgentSidebarOpen] = useState(true)
  const [isInspectorOpen, setIsInspectorOpen] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)

  const handleMount = (editor: Editor) => {
    editorRef.current = editor

    // Listen to selection changes for inspector
    editor.sideEffects.registerAfterChangeHandler('instance_page_state', () => {
      const selected = editor.getSelectedShapeIds()
      setSelectedShapeId(selected.length > 0 && selected[0] ? String(selected[0]) : null)
      setZoomLevel(editor.getZoomLevel())
    })

    // Clean up any outdated prototype shapes from earlier sessions
    const oldShapes = editor.getCurrentPageShapes().filter((s: any) => s.type === 'avatar' || s.type === 'vector-studio')
    if (oldShapes.length > 0) {
      editor.deleteShapes(oldShapes.map((s: any) => s.id))
    }

    // Spawn central Artboard Frame if none exists (pen.dev style)
    const existingFrames = editor.getCurrentPageShapes().filter((s: any) => s.type === 'frame')
    if (existingFrames.length === 0) {
      editor.createShape({
        type: 'frame',
        x: 140,
        y: 80,
        props: {
          w: 1080,
          h: 720,
          name: 'Frame'
        }
      })
      editor.zoomToFit()
    }
  }

  const handleAddShape = (type: 'frame' | 'avatar' | 'vector-studio' | 'blender-connector' | 'geo' | 'text') => {
    const editor = editorRef.current
    if (!editor) return

    const center = editor.getViewportPageBounds().center

    if (type === 'frame') {
      editor.createShape({
        type: 'frame',
        x: center.x - 450,
        y: center.y - 300,
        props: { w: 900, h: 600, name: 'Frame' }
      })
    } else if (type === 'geo') {
      editor.createShape({
        type: 'geo',
        x: center.x - 100,
        y: center.y - 100,
        props: { w: 200, h: 200, geo: 'rectangle', color: 'blue', fill: 'solid' }
      })
    } else if (type === 'text') {
      editor.createShape({
        type: 'text',
        x: center.x - 100,
        y: center.y - 20,
        props: { text: 'New Canvas Text' } as any
      })
    }
  }

  const handleInsertSvgToCanvas = (svg: string, label?: string) => {
    const editor = editorRef.current
    if (!editor) return

    const center = editor.getViewportPageBounds().center
    editor.createShape({
      type: 'geo',
      x: center.x - 120,
      y: center.y - 120,
      props: {
        w: 240,
        h: 240,
        geo: 'rectangle',
        color: 'black',
        fill: 'solid'
      }
    })
  }

  const handleSendToBlender = (_svg: string) => {
    setIsInspectorOpen(true)
  }

  const handleZoomIn = () => {
    editorRef.current?.zoomIn()
    if (editorRef.current) setZoomLevel(editorRef.current.getZoomLevel())
  }

  const handleZoomOut = () => {
    editorRef.current?.zoomOut()
    if (editorRef.current) setZoomLevel(editorRef.current.getZoomLevel())
  }

  const handleZoomReset = () => {
    editorRef.current?.resetZoom()
    if (editorRef.current) setZoomLevel(editorRef.current.getZoomLevel())
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#090a0d'
      }}
    >
      {/* Top Window Bar */}
      <StudioWindowBar
        projectTitle={projectTitle}
        onTitleChange={setProjectTitle}
        activeMode={activeMode}
        onModeChange={(m) => {
          setActiveMode(m)
          if (m === 'agents') setIsAgentSidebarOpen(true)
          if (m === 'blender') setIsInspectorOpen(true)
        }}
        isRecentsOpen={isRecentsOpen}
        onToggleRecents={() => setIsRecentsOpen(!isRecentsOpen)}
        isAgentSidebarOpen={isAgentSidebarOpen}
        onToggleAgentSidebar={() => setIsAgentSidebarOpen(!isAgentSidebarOpen)}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen(!isInspectorOpen)}
        zoomLevel={zoomLevel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onExport={() => alert('Exporting canvas project...')}
      />

      {/* Main Workspace (Docked Left Sidebar | Canvas Viewport | Docked Right Inspector) */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* On-Canvas Agent Harness Sidebar (pen.dev + ZCode) */}
        {isAgentSidebarOpen && (
          <AgentHarnessSidebar
            isOpen={isAgentSidebarOpen}
            onClose={() => setIsAgentSidebarOpen(false)}
            onInsertSvgToCanvas={handleInsertSvgToCanvas}
            onSendToBlender={handleSendToBlender}
          />
        )}

        {/* Central Infinite Canvas Container */}
        <div style={{ position: 'relative', flex: 1, height: '100%', overflow: 'hidden' }}>
          {/* Floating Canvas Toolbar */}
          <StudioToolbar
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            onAddShape={handleAddShape}
          />

          {/* Tldraw Canvas with default UI disabled */}
          <Tldraw hideUi={true} shapeUtils={customShapeUtils} onMount={handleMount} />
        </div>

        {/* Right Inspector & Blender 3D Bridge */}
        {isInspectorOpen && (
          <StudioInspector
            isOpen={isInspectorOpen}
            onClose={() => setIsInspectorOpen(false)}
            selectedShapeId={selectedShapeId}
          />
        )}
      </div>

      {/* Full-Screen Recents & Projects Dashboard (Paper.design style) */}
      <RecentsDashboard
        isOpen={isRecentsOpen}
        onClose={() => setIsRecentsOpen(false)}
        onOpenProject={(id) => {
          setProjectTitle(id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '))
        }}
        onNewFile={() => {
          setProjectTitle('Untitled')
          editorRef.current?.selectAll().deleteShapes(editorRef.current.getSelectedShapeIds())
          handleAddShape('frame')
        }}
      />
    </div>
  )
}

export default App
